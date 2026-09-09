import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const encodedModule = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return import(encodedModule);
}

const {
  DEFAULT_HOW_TO_GUIDES,
  POLICY_ID_NAMES,
  findGuideBySlugOrId,
  isMethodBasedGuide,
  TEACHER_SUBMISSION_EMAIL
} = await importTypeScriptModule('../src/lib/howToGuides.ts');

test('How-To Guides: default guides contain essential Leave and Task Submission workflows', () => {
  assert.equal(DEFAULT_HOW_TO_GUIDES.length, 2, 'Should provide exactly 2 initial guides');

  // 1. Leave Guide (flat steps)
  const leaveGuide = findGuideBySlugOrId('how-to-apply-leave');
  assert.ok(leaveGuide, 'Leave guide must exist');
  assert.equal(leaveGuide.slug, 'how-to-apply-leave');
  assert.equal(leaveGuide.title, 'How to Apply for Leave');
  assert.equal(leaveGuide.related_policy_id, 'attendance');
  assert.equal(isMethodBasedGuide(leaveGuide), false, 'Leave guide should be flat steps, not method-based');
  assert.equal(leaveGuide.steps.length, 6, 'Leave guide must have 6 flat steps');
  assert.ok(leaveGuide.steps.some(s => s.text.includes('Inform Absence / Request Excuse')), 'Must mention real button');
  assert.ok(leaveGuide.steps.some(s => s.text.includes('Attendance & Leave')), 'Must mention updated nav tab');

  // 2. Task Guide (3 structured methods)
  const taskGuide = findGuideBySlugOrId('how-to-submit-task');
  assert.ok(taskGuide, 'Task guide must exist');
  assert.equal(taskGuide.slug, 'how-to-submit-task');
  assert.equal(taskGuide.title, 'How to Submit a Task');
  assert.equal(taskGuide.related_policy_id, null, 'Task submission guide must not be linked to progress policy');
  assert.equal(isMethodBasedGuide(taskGuide), true, 'Task guide must be method-based');
  assert.equal(taskGuide.steps.length, 3, 'Must have exactly 3 submission methods');

  const [m1, m2, m3] = taskGuide.steps;

  // Method 1: YouTube Unlisted
  assert.equal(m1.key, 'youtube');
  assert.ok(m1.title.includes('YouTube'));
  assert.equal(m1.requiresTeacherAccess, false, 'YouTube unlisted does not require email permission share');
  assert.ok(m1.steps.length >= 6);
  assert.ok(m1.steps.some(s => s.text.includes('Unlisted')), 'Must explain Unlisted visibility');
  assert.ok(m1.importantNote.includes('Unlisted'));

  // Method 2: Google Drive
  assert.equal(m2.key, 'google-drive');
  assert.ok(m2.title.includes('Google Drive'));
  assert.equal(m2.requiresTeacherAccess, true, 'Google Drive requires explicit share');
  assert.equal(m2.teacherEmail, TEACHER_SUBMISSION_EMAIL);
  assert.equal(TEACHER_SUBMISSION_EMAIL, 'kgbhaumik86@gmail.com');
  assert.ok(m2.steps.length >= 6);
  assert.ok(m2.steps.some(s => s.text.includes('kgbhaumik86@gmail.com')));

  // Method 3: Portal Upload / Drive Picker
  assert.equal(m3.key, 'portal-upload');
  assert.ok(m3.title.includes('Upload'));
  assert.equal(m3.requiresTeacherAccess, true, 'Portal Drive Picker also requires sharing permissions on Drive');
  assert.equal(m3.teacherEmail, TEACHER_SUBMISSION_EMAIL);
  assert.ok(m3.steps.length >= 6);
  assert.ok(m3.steps.some(s => s.text.includes('Google Drive Picker')));
});

test('How-To Guides: policy mapping contains human-readable names for cross-linking', () => {
  assert.equal(POLICY_ID_NAMES['attendance'], 'Attendance & Leaves Policy');
  assert.equal(POLICY_ID_NAMES['progress'], 'Student Progress & Evaluation');
  assert.equal(POLICY_ID_NAMES['fees'], 'Fees & Payments Policy');
  assert.equal(POLICY_ID_NAMES['conduct'], 'General Conduct & Riyaaz');
  assert.equal(POLICY_ID_NAMES['ip'], 'Learning Materials & Copyright');
});
