#!/usr/bin/env node
/**
 * KFA Website — Static Code Audit Script
 * ========================================
 * Scans the entire codebase for three classes of production bugs:
 *
 * AUDIT-001: Unguarded .in() calls (the "arraylist" crash)
 *   → .in('col', someArray) where someArray could be empty → crashes Postgres
 *
 * AUDIT-002: Missing finally{} loading state cleanup
 *   → setLoading(true) inside try{} without a finally{} → stuck spinners
 *
 * AUDIT-003: Realtime channel subscriptions without cleanup
 *   → .channel(...).subscribe() without a matching removeChannel → memory + I/O leak
 *
 * Run: node tests/audit/code-audit.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// ── Helpers ────────────────────────────────────────────────────────────────

const SCAN_DIRS = ['app', 'src'];
const EXTENSIONS = ['.ts', '.tsx', '.js'];

function getAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'out', '.git'].includes(entry.name)) {
        results.push(...getAllFiles(full));
      }
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function relativePath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

// ── Audit 1: Unguarded .in() calls ─────────────────────────────────────────
//
// Pattern: .in('column', someVar)
// Safe if the line above or within 5 lines has:
//   - if (someVar.length === 0)
//   - if (!someVar.length)
//   - someVar.length > 0 ? ...
//   - someVar?.length
//   OR if the array is a hardcoded literal like ['teacher', 'admin']

function auditEmptyInCalls(files) {
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match .in('col', variable) — skip hardcoded arrays like ['a', 'b']
      const inMatch = line.match(/\.in\(\s*['"`][^'"` ]+['"`]\s*,\s*([a-zA-Z_$][a-zA-Z0-9_.]*)\s*\)/);
      if (!inMatch) continue;

      const varName = inMatch[1];

      // Skip if it's clearly a static/safe call (hardcoded values only)
      if (line.includes(`['`) || line.includes(`["`) || line.includes("['")) continue;

      // Check surrounding context (5 lines before) for a guard
      const contextStart = Math.max(0, i - 8);
      const context = lines.slice(contextStart, i + 1).join('\n');

      const isGuarded =
        context.includes(`${varName}.length === 0`) ||
        context.includes(`${varName}.length > 0`) ||
        context.includes(`!${varName}.length`) ||
        context.includes(`${varName}?.length`) ||
        context.includes(`if (${varName.split('.').pop()}`) ||
        context.includes(`${varName} && ${varName}.length`) ||
        context.includes(`length === 0) return`) ||
        context.includes(`length === 0) {`) ||
        context.includes(`=== 0) return`);

      if (!isGuarded) {
        findings.push({
          file: relativePath(file),
          line: i + 1,
          code: line.trim(),
          variable: varName,
          severity: 'CRITICAL',
        });
      }
    }
  }
  return findings;
}

// ── Audit 2: Missing finally{} loading state cleanup ───────────────────────
//
// Pattern: setXxxLoading(true) or setLoading(true) inside a try block
// but the corresponding setXxxLoading(false) is NOT in a finally{} block

function auditMissingFinally(files) {
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Find setXLoading(true) calls
      const loadMatch = line.match(/\b(set\w*[Ll]oading)\s*\(\s*true\s*\)/);
      if (!loadMatch) continue;

      const setterName = loadMatch[1];

      // Look ahead to find the enclosing try/catch/finally block
      // Search next 80 lines for a finally clause
      const ahead = lines.slice(i, Math.min(i + 120, lines.length)).join('\n');

      const hasTry = ahead.includes('try {') || ahead.includes('try{');
      const hasFinally = ahead.includes('finally {') || ahead.includes('finally{');
      const hasFalseInFinally = hasFinally && ahead.includes(`${setterName}(false)`);

      // Only flag if inside a try but no finally
      if (hasTry && !hasFinally) {
        // Also check if the false setter appears in a catch only
        const catchIndex = ahead.indexOf('} catch');
        const falseIndex = ahead.indexOf(`${setterName}(false)`);
        const inCatchOnly = falseIndex > 0 && falseIndex > catchIndex && !hasFalseInFinally;

        findings.push({
          file: relativePath(file),
          line: i + 1,
          code: line.trim(),
          setter: setterName,
          issue: 'No finally{} block found — if an error is thrown, spinner stays stuck forever',
          severity: 'HIGH',
        });
      }
    }
  }
  return findings;
}

// ── Audit 3: Realtime channel subscription leaks ────────────────────────────
//
// Pattern: .channel('name').on(...).subscribe() in a useEffect
// without removeChannel in the same file

function auditChannelLeaks(files) {
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    // Find all channel subscriptions
    const channelMatches = [...content.matchAll(/\.channel\(['"`]([^'"` ]+)['"`]\)/g)];
    if (channelMatches.length === 0) continue;

    const removeCount = (content.match(/removeChannel/g) || []).length;
    const subscribeCount = (content.match(/\.subscribe\(\)/g) || []).length;

    if (subscribeCount > removeCount) {
      findings.push({
        file: relativePath(file),
        subscriptions: subscribeCount,
        removals: removeCount,
        missing: subscribeCount - removeCount,
        channels: channelMatches.map(m => m[1]),
        severity: 'MEDIUM',
      });
    }
  }
  return findings;
}

// ── Audit 4: Large sequential fetches (N+1 patterns) ──────────────────────
//
// Pattern: .from('table') inside a for loop or Promise.all map
// with no batching

function auditNPlusOne(files) {
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // Look for supabase queries inside Promise.all / .map / forEach loops
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('.from(')) continue;

      // Check if it's inside a Promise.all map or forEach
      const contextBefore = lines.slice(Math.max(0, i - 5), i).join('\n');
      const isInLoop =
        contextBefore.includes('Promise.all') ||
        contextBefore.includes('.map(async') ||
        contextBefore.includes('.forEach(async') ||
        contextBefore.includes('for (') ||
        contextBefore.includes('for(');

      if (isInLoop) {
        findings.push({
          file: relativePath(file),
          line: i + 1,
          code: line.trim(),
          issue: 'Supabase query inside a loop — potential N+1 pattern, consider batching',
          severity: 'MEDIUM',
        });
      }
    }
  }
  return findings;
}

// ── Run all audits ──────────────────────────────────────────────────────────

const allFiles = SCAN_DIRS.flatMap(d => getAllFiles(path.join(ROOT, d)));
console.log(`\n🔍 KFA Website Code Audit\n${'═'.repeat(60)}`);
console.log(`   Scanning ${allFiles.length} files in ${SCAN_DIRS.join(', ')}/...\n`);

const audit1 = auditEmptyInCalls(allFiles);
const audit2 = auditMissingFinally(allFiles);
const audit3 = auditChannelLeaks(allFiles);
const audit4 = auditNPlusOne(allFiles);

// ── Report ─────────────────────────────────────────────────────────────────

const CRITICAL = '\x1b[31m[CRITICAL]\x1b[0m';
const HIGH     = '\x1b[33m[HIGH]    \x1b[0m';
const MEDIUM   = '\x1b[34m[MEDIUM]  \x1b[0m';
const OK       = '\x1b[32m[OK]      \x1b[0m';

console.log(`${'─'.repeat(60)}`);
console.log(`AUDIT-001: Unguarded .in() Calls (Empty Array → PostgreSQL Crash)`);
console.log(`${'─'.repeat(60)}`);
if (audit1.length === 0) {
  console.log(`${OK} No unguarded .in() calls found.`);
} else {
  console.log(`${CRITICAL} Found ${audit1.length} unguarded .in() call(s):\n`);
  for (const f of audit1) {
    console.log(`  ${CRITICAL} ${f.file}:${f.line}`);
    console.log(`            Variable: ${f.variable}`);
    console.log(`            Code:     ${f.code}\n`);
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`AUDIT-002: Missing finally{} — Stuck Loading Spinners`);
console.log(`${'─'.repeat(60)}`);
if (audit2.length === 0) {
  console.log(`${OK} All loading states have proper finally{} cleanup.`);
} else {
  console.log(`${HIGH} Found ${audit2.length} potential stuck spinner location(s):\n`);
  for (const f of audit2) {
    console.log(`  ${HIGH} ${f.file}:${f.line}`);
    console.log(`            Setter: ${f.setter}`);
    console.log(`            Issue:  ${f.issue}\n`);
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`AUDIT-003: Realtime Channel Subscription Leaks`);
console.log(`${'─'.repeat(60)}`);
if (audit3.length === 0) {
  console.log(`${OK} All Realtime channels are properly cleaned up.`);
} else {
  console.log(`${MEDIUM} Found ${audit3.length} file(s) with more subscriptions than removals:\n`);
  for (const f of audit3) {
    console.log(`  ${MEDIUM} ${f.file}`);
    console.log(`            Subscribes: ${f.subscriptions}, removeChannel calls: ${f.removals}, Missing: ${f.missing}`);
    console.log(`            Channels:   ${f.channels.join(', ')}\n`);
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`AUDIT-004: N+1 Query Patterns (Supabase calls inside loops)`);
console.log(`${'─'.repeat(60)}`);
if (audit4.length === 0) {
  console.log(`${OK} No obvious N+1 patterns found.`);
} else {
  console.log(`${MEDIUM} Found ${audit4.length} potential N+1 location(s):\n`);
  for (const f of audit4) {
    console.log(`  ${MEDIUM} ${f.file}:${f.line}`);
    console.log(`            Code: ${f.code}\n`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const totalCritical = audit1.length;
const totalHigh = audit2.length;
const totalMedium = audit3.length + audit4.length;

console.log(`\n${'═'.repeat(60)}`);
console.log(`AUDIT SUMMARY`);
console.log(`${'═'.repeat(60)}`);
console.log(`  🔴 CRITICAL issues (will crash the site):    ${totalCritical}`);
console.log(`  🟠 HIGH issues    (causes infinite loading): ${totalHigh}`);
console.log(`  🟡 MEDIUM issues  (performance / memory):   ${totalMedium}`);
console.log(`  📁 Total files scanned:                     ${allFiles.length}`);
console.log(`${'═'.repeat(60)}\n`);

// Write JSON report
const report = {
  generatedAt: new Date().toISOString(),
  summary: { critical: totalCritical, high: totalHigh, medium: totalMedium, filesScanned: allFiles.length },
  audit001_unguarded_in_calls: audit1,
  audit002_missing_finally: audit2,
  audit003_channel_leaks: audit3,
  audit004_n_plus_one: audit4,
};

fs.writeFileSync(
  path.join(ROOT, 'tests/audit/audit-report.json'),
  JSON.stringify(report, null, 2)
);
console.log(`📄 Full JSON report saved to: tests/audit/audit-report.json\n`);
