import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moduleCache = new Map();

function requireTs(relativePath, fromDir = __dirname) {
  const fullPath = path.resolve(fromDir, relativePath.endsWith('.ts') ? relativePath : `${relativePath}.ts`);
  if (moduleCache.has(fullPath)) {
    return moduleCache.get(fullPath);
  }

  const source = readFileSync(fullPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });

  const moduleObj = { exports: {} };
  moduleCache.set(fullPath, moduleObj.exports);

  const customRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      return requireTs(specifier, path.dirname(fullPath));
    }
    return import(specifier);
  };

  const wrapper = vm.compileFunction(
    outputText,
    ['exports', 'require', 'module', '__filename', '__dirname'],
    { filename: fullPath }
  );

  wrapper(moduleObj.exports, customRequire, moduleObj, fullPath, path.dirname(fullPath));
  moduleCache.set(fullPath, moduleObj.exports);
  return moduleObj.exports;
}

const {
  normalizeSur,
  isDetectedNoteCorrect,
  evaluateExerciseStep,
  createInitialExerciseState,
  EXERCISE_PRESETS
} = requireTs('../src/lib/audio/notation/exerciseValidation.ts');

const {
  PitchStabilizer
} = requireTs('../src/lib/audio/notation/pitchStabilizer.ts');

const {
  calculateSwaraFromMidi
} = requireTs('../src/lib/audio/notation/swaraMapping.ts');

/**
 * Helper to construct a canonical SwaraNotationToken for testing.
 */
function mockToken(tokenStr, cents = 0, overrides = {}) {
  const norm = normalizeSur(tokenStr);
  return {
    baseSwara: norm ? norm.baseSwara : tokenStr,
    formattedToken: norm ? norm.formattedToken : tokenStr,
    name: norm ? norm.canonicalName : tokenStr,
    devanagari: norm ? norm.devanagari : '',
    saptak: norm?.octaveOffset === 1 ? 'taar' : norm?.octaveOffset === -1 ? 'mandra' : 'madhya',
    semitoneOffset: norm ? norm.semitoneOffset : 0,
    octaveOffset: norm ? norm.octaveOffset : 0,
    westernNote: 'C4',
    frequency: 261.63,
    cents: cents,
    timestamp: Date.now(),
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CANONICAL KFA NOTATION NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

test('KFA Notation Normalization: conforms strictly to portal standard (m vs M, octaves)', () => {
  // Sa
  assert.equal(normalizeSur('S')?.baseSwara, 'S');
  assert.equal(normalizeSur('Sa')?.baseSwara, 'S');
  assert.equal(normalizeSur('sa')?.baseSwara, 'S');

  // Re: Komal (r) vs Shuddha (R)
  assert.equal(normalizeSur('r')?.baseSwara, 'r');
  assert.equal(normalizeSur('Komal Re')?.baseSwara, 'r');
  assert.equal(normalizeSur('R')?.baseSwara, 'R');
  assert.equal(normalizeSur('Shuddha Re')?.baseSwara, 'R');

  // Ga: Komal (g) vs Shuddha (G)
  assert.equal(normalizeSur('g')?.baseSwara, 'g');
  assert.equal(normalizeSur('G')?.baseSwara, 'G');

  // Ma: Shuddha Ma ('m') vs Tivra Ma ('M', "M'")
  assert.equal(normalizeSur('m')?.baseSwara, 'm', 'Shuddha Ma must be "m"');
  assert.equal(normalizeSur('Shuddha Ma')?.baseSwara, 'm');
  assert.equal(normalizeSur('M')?.baseSwara, 'M', 'Tivra Ma must be "M"');
  assert.equal(normalizeSur('Tivra Ma')?.baseSwara, 'M');
  assert.equal(normalizeSur("M'")?.baseSwara, 'M');

  // Pa, Dha, Ni
  assert.equal(normalizeSur('P')?.baseSwara, 'P');
  assert.equal(normalizeSur('d')?.baseSwara, 'd');
  assert.equal(normalizeSur('D')?.baseSwara, 'D');
  assert.equal(normalizeSur('n')?.baseSwara, 'n');
  assert.equal(normalizeSur('N')?.baseSwara, 'N');

  // Octave indicators: Mandra (dot suffix), Taar (prime suffix)
  assert.equal(normalizeSur('S.')?.formattedToken, 'S.');
  assert.equal(normalizeSur('S.')?.octaveOffset, -1);
  assert.equal(normalizeSur("S'")?.formattedToken, "S'");
  assert.equal(normalizeSur("S'")?.octaveOffset, 1);
  assert.equal(normalizeSur("S''")?.octaveOffset, 2);

  // Invalid strings return null
  assert.equal(normalizeSur(''), null);
  assert.equal(normalizeSur('   '), null);
  assert.equal(normalizeSur('invalid'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. NOTE MATCHING & CANONICAL TUNING TOLERANCE
// ─────────────────────────────────────────────────────────────────────────────

test('Note Matching: exact matches within canonical tolerance pass', () => {
  const token = mockToken('S', 10);
  const result = isDetectedNoteCorrect(token, 'S', 30);
  assert.equal(result.isMatch, true);
  assert.equal(result.isSwaraMatch, true);
  assert.equal(result.isInTune, true);
});

test('Note Matching: wrong note REJECTED immediately - Problem 1 root fix', () => {
  // Expected Sa, played Re
  const tokenRe = mockToken('R', 0);
  const resRe = isDetectedNoteCorrect(tokenRe, 'S');
  assert.equal(resRe.isMatch, false, 'Expected S, played R must reject');
  assert.match(resRe.reason, /Different Sur/);

  // Expected Sa, played adjacent semitone Komal Re ('r' - 100 cents away)
  const tokenKomalRe = mockToken('r', 0);
  const resKomalRe = isDetectedNoteCorrect(tokenKomalRe, 'S');
  assert.equal(resKomalRe.isMatch, false, 'Expected S, played adjacent Komal Re must reject');

  // Expected Shuddha Ma ('m'), played Tivra Ma ('M' - 100 cents away)
  const tokenTivraMa = mockToken('M', 0);
  const resMa = isDetectedNoteCorrect(tokenTivraMa, 'm');
  assert.equal(resMa.isMatch, false, 'Expected m, played M must reject');
});

test('Note Matching: cents tolerance boundary (±30 cents accepted, >35 cents rejected)', () => {
  // In tune within 25 cents
  assert.equal(isDetectedNoteCorrect(mockToken('S', 25), 'S', 30).isMatch, true);
  assert.equal(isDetectedNoteCorrect(mockToken('S', -25), 'S', 30).isMatch, true);

  // Out of tune (40 cents off-pitch)
  const outResult = isDetectedNoteCorrect(mockToken('S', 40), 'S', 30);
  assert.equal(outResult.isMatch, false, '40 cents off exceeds canonical tolerance');
  assert.match(outResult.reason, /Out of tune/);
});

test('Note Matching: silence, unvoiced frames, or null return false without crashing', () => {
  assert.equal(isDetectedNoteCorrect(null, 'S').isMatch, false);
  const res = isDetectedNoteCorrect(null, 'S');
  assert.equal(res.reason, 'No note detected');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROOT BUG TEST (Point 14): "Works once, then stops" PROOF OF FIX
// ─────────────────────────────────────────────────────────────────────────────

test('Root Bug Verification: Expected S -> Detected R (no move) -> S stable (moves to 1) -> R stable (moves to 2) -> full sequence', () => {
  const sequence = ['S', 'R', 'G', 'm'];
  const stabilityMs = 100; // Timestamp stability requirement (100ms)
  let state = createInitialExerciseState(sequence, stabilityMs);

  const tokenS = mockToken('S', 0);
  const tokenR = mockToken('R', 0);
  const tokenG = mockToken('G', 0);
  const tokenM = mockToken('m', 0);

  // Initial step 0
  assert.equal(state.currentIndex, 0);

  // 1. Time 0: Expected S, user plays R (WRONG NOTE)
  state = evaluateExerciseStep(state, tokenR, 1000, 0.08, false, 30);
  assert.equal(state.currentIndex, 0, 'Index must remain 0 when wrong note played');
  assert.equal(state.feedback.status, 'incorrect');

  // Time 50: Still playing wrong note R
  state = evaluateExerciseStep(state, tokenR, 1050, 0.08, false, 30);
  assert.equal(state.currentIndex, 0, 'Index must still be 0');

  // 2. Time 100: User starts playing correct note S
  state = evaluateExerciseStep(state, tokenS, 1100, 0.08, false, 30);
  assert.equal(state.currentIndex, 0, 'Should not advance on 1st match frame (0ms elapsed)');
  assert.equal(state.matchStartedAt, 1100);

  // Time 150: S continues matching (50ms elapsed < 100ms)
  state = evaluateExerciseStep(state, tokenS, 1150, 0.08, false, 30);
  assert.equal(state.currentIndex, 0, 'Should not advance before stability duration (50ms < 100ms)');

  // Time 210: S reaches 110ms >= 100ms -> ADVANCES TO STEP 1 EXACTLY ONCE!
  state = evaluateExerciseStep(state, tokenS, 1210, 0.08, false, 30);
  assert.equal(state.currentIndex, 1, 'MUST advance to step 1 after 100ms stability!');
  assert.equal(state.feedback.status, 'correct');
  assert.equal(state.isNoteLocked, true, 'Must lock note to prevent auto-advancing next note on same breath');

  // Time 220: User continues holding S (stale carryover)
  state = evaluateExerciseStep(state, tokenS, 1220, 0.08, false, 30);
  assert.equal(state.currentIndex, 1, 'Must remain at step 1 while holding previous note');

  // 3. Time 300: Now at step 1 (expecting R). User plays G (WRONG NOTE)
  state = evaluateExerciseStep(state, tokenG, 1300, 0.08, false, 30);
  assert.equal(state.currentIndex, 1, 'Index must remain 1 when wrong note G played');
  assert.equal(state.feedback.status, 'incorrect');

  // 4. Time 400: User plays correct note R (SECOND NOTE PROGRESSION - Problem 2 fix)
  state = evaluateExerciseStep(state, tokenR, 1400, 0.08, false, 30);
  assert.equal(state.currentIndex, 1, 'Step 1 should not advance at 0ms');

  // Time 450: R held for 50ms
  state = evaluateExerciseStep(state, tokenR, 1450, 0.08, false, 30);
  assert.equal(state.currentIndex, 1, 'Step 1 should not advance at 50ms');

  // Time 510: R held for 110ms >= 100ms -> ADVANCES TO STEP 2 EXACTLY ONCE!
  state = evaluateExerciseStep(state, tokenR, 1510, 0.08, false, 30);
  assert.equal(state.currentIndex, 2, 'MUST advance to step 2 on valid second note Re!');
  assert.equal(state.sequence[state.currentIndex], 'G');

  // 5. Step 2 (expecting G): Play G for 100ms
  state = evaluateExerciseStep(state, tokenG, 1600, 0.08, false, 30);
  state = evaluateExerciseStep(state, tokenG, 1710, 0.08, false, 30);
  assert.equal(state.currentIndex, 3, 'Must advance to step 3 (Shuddha Ma)');

  // 6. Step 3 (expecting m): Play m for 100ms
  state = evaluateExerciseStep(state, tokenM, 1800, 0.08, false, 30);
  state = evaluateExerciseStep(state, tokenM, 1910, 0.08, false, 30);
  assert.equal(state.currentIndex, 4);
  assert.equal(state.isComplete, true, 'Exercise must be marked complete');
  assert.equal(state.feedback.status, 'completed');
  assert.equal(state.feedback.message, 'Exercise Complete');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. REAL DETECTOR EVENT SEQUENCES (Point 15)
// ─────────────────────────────────────────────────────────────────────────────

test('Real Event Stream: silence -> noise -> wrong R -> correct S -> prolonged S -> next R', () => {
  const sequence = ['S', 'R'];
  let state = createInitialExerciseState(sequence, 100);

  const silence = null;
  const tokenR = mockToken('R');
  const tokenS = mockToken('S');

  // Stream simulation:
  // t=0: silence
  state = evaluateExerciseStep(state, silence, 1000, 0.002, true);
  assert.equal(state.currentIndex, 0);

  // t=50: noise (frequency=0, low RMS)
  state = evaluateExerciseStep(state, null, 1050, 0.005, true);
  assert.equal(state.currentIndex, 0);

  // t=100: wrong note R
  state = evaluateExerciseStep(state, tokenR, 1100, 0.08, false);
  assert.equal(state.currentIndex, 0);
  assert.equal(state.feedback.status, 'incorrect');

  // t=150: wrong note R continues
  state = evaluateExerciseStep(state, tokenR, 1150, 0.08, false);
  assert.equal(state.currentIndex, 0);

  // t=200: clean transition to correct note S
  state = evaluateExerciseStep(state, tokenS, 1200, 0.08, false);
  assert.equal(state.currentIndex, 0);

  // t=310: S held for 110ms -> advances to step 1
  state = evaluateExerciseStep(state, tokenS, 1310, 0.08, false);
  assert.equal(state.currentIndex, 1);

  // t=320..1500: prolonged correct note S held for over 1 second without releasing
  for (let t = 1320; t <= 2500; t += 100) {
    state = evaluateExerciseStep(state, tokenS, t, 0.08, false);
    assert.equal(state.currentIndex, 1, `Must not skip step 1 at t=${t}`);
  }

  // t=2600: player transitions to R (next note)
  state = evaluateExerciseStep(state, tokenR, 2600, 0.08, false);
  assert.equal(state.currentIndex, 1);

  // t=2710: R held for 110ms -> completes exercise
  state = evaluateExerciseStep(state, tokenR, 2710, 0.08, false);
  assert.equal(state.currentIndex, 2);
  assert.equal(state.isComplete, true);
});

test('Repeated Notes (S S R): requires fresh articulation / breath dip before accepting second identical note', () => {
  const sequence = ['S', 'S', 'R'];
  let state = createInitialExerciseState(sequence, 100);
  const tokenS = mockToken('S');
  const tokenR = mockToken('R');

  // 1. Play first S
  state = evaluateExerciseStep(state, tokenS, 1000, 0.10, false);
  state = evaluateExerciseStep(state, tokenS, 1110, 0.10, false);
  assert.equal(state.currentIndex, 1, 'First S accepted');
  assert.equal(state.isNoteLocked, true, 'Note lock active');

  // 2. Continue holding exact same S with constant volume (no tonguing/breath)
  for (let t = 1120; t <= 1500; t += 50) {
    state = evaluateExerciseStep(state, tokenS, t, 0.10, false);
    assert.equal(state.currentIndex, 1, 'Continuous unarticulated S MUST NOT advance second S');
  }

  // 3. Player articulates (30% volume dip during tonguing: from 0.10 down to 0.06)
  state = evaluateExerciseStep(state, tokenS, 1550, 0.06, false);
  assert.equal(state.isNoteLocked, false, 'Volume dip should unlock repeated note');

  // 4. Attack second S stably for 100ms
  state = evaluateExerciseStep(state, tokenS, 1560, 0.10, false);
  state = evaluateExerciseStep(state, tokenS, 1670, 0.10, false);
  assert.equal(state.currentIndex, 2, 'Articulated second S accepted -> now on R');

  // 5. Play R
  state = evaluateExerciseStep(state, tokenR, 1700, 0.10, false);
  state = evaluateExerciseStep(state, tokenR, 1810, 0.10, false);
  assert.equal(state.currentIndex, 3);
  assert.equal(state.isComplete, true);
});

test('Restart Responsibilities: restart resets step to 0 without tearing down audio', () => {
  const sequence = ['S', 'R', 'G', 'm'];
  let state = createInitialExerciseState(sequence, 100);

  // Advance to step 2
  state = evaluateExerciseStep(state, mockToken('S'), 1000, 0.08, false);
  state = evaluateExerciseStep(state, mockToken('S'), 1110, 0.08, false);
  state = evaluateExerciseStep(state, mockToken('R'), 1200, 0.08, false);
  state = evaluateExerciseStep(state, mockToken('R'), 1310, 0.08, false);
  assert.equal(state.currentIndex, 2);

  // Restart called
  const fresh = createInitialExerciseState(sequence, 100);
  assert.equal(fresh.currentIndex, 0);
  assert.equal(fresh.isComplete, false);
  assert.equal(fresh.matchStartedAt, null);
  assert.equal(fresh.isNoteLocked, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. FREE TRANSCRIBE REGRESSION (Point 11)
// ─────────────────────────────────────────────────────────────────────────────

test('Free Transcribe Regression: PitchStabilizer phrase transcription, repeated notes, and silence safety', () => {
  const stabilizer = new PitchStabilizer();
  const tokens = [];
  let now = 1000;

  // 1. Initial silence must NEVER emit a token (no fake SA)
  for (let t = 0; t < 200; t += 16) {
    const res = stabilizer.processFrame(0, 0.001, 0, 'C', now + t);
    assert.equal(res.emittedToken, null, 'Silence must NEVER emit a token');
  }
  now += 200;

  // Helper to simulate flute note
  const playNote = (freq, durationMs) => {
    const end = now + durationMs;
    while (now < end) {
      const res = stabilizer.processFrame(freq, 0.08, 0.95, 'C', now);
      if (res.emittedToken) {
        tokens.push(res.emittedToken.formattedToken);
      }
      now += 16;
    }
  };

  const playPause = (durationMs) => {
    const end = now + durationMs;
    while (now < end) {
      stabilizer.processFrame(0, 0.002, 0, 'C', now);
      now += 16;
    }
  };

  // Play phrase: Sa (261.63), pause, Re (293.66), pause, Ga (329.63)
  playNote(261.63, 150); // S
  playPause(60);
  playNote(293.66, 150); // R
  playPause(60);
  playNote(329.63, 150); // G

  assert.deepEqual(tokens, ['S', 'R', 'G'], `Expected ['S', 'R', 'G'], got: ${JSON.stringify(tokens)}`);
});
