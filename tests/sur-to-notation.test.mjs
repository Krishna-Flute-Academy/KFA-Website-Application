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
  calculateSwaraFromMidi, 
  formatKfaToken, 
  KFA_SWARA_DEFINITIONS 
} = requireTs('../src/lib/audio/notation/swaraMapping.ts');

const { 
  PitchStabilizer 
} = requireTs('../src/lib/audio/notation/pitchStabilizer.ts');

const { 
  SUR_NOTATION_CONFIG 
} = requireTs('../src/lib/audio/notation/types.ts');

test('Central Configuration: SUR_NOTATION_CONFIG exposes required tunable thresholds', () => {
  assert.ok(SUR_NOTATION_CONFIG.rmsGate > 0, 'rmsGate must be > 0');
  assert.equal(SUR_NOTATION_CONFIG.stableDurationMs, 50, 'stableDurationMs should default to 50ms for low latency');
  assert.equal(SUR_NOTATION_CONFIG.releaseDurationMs, 45, 'releaseDurationMs should default to 45ms');
  assert.equal(SUR_NOTATION_CONFIG.medianWindowSize, 3, 'medianWindowSize should default to 3');
  assert.equal(SUR_NOTATION_CONFIG.retriggerDropRatio, 0.75, 'retriggerDropRatio should default to 0.75');
});

test('KFA Notation: Tivra Ma in middle octave is "M" and upper octave is "M\'"', () => {
  // Middle octave: Tivra Ma (semitone 6) is M
  const middleM = formatKfaToken('M', 0);
  assert.equal(middleM, 'M', 'Middle octave Tivra Ma must be "M", NOT "M\'"');

  // Upper octave: Tivra Ma (semitone 6) is M'
  const upperM = formatKfaToken('M', 1);
  assert.equal(upperM, "M'", 'Upper octave Tivra Ma must be "M\'"');

  // Lower octave: Tivra Ma (semitone 6) is M.
  const lowerM = formatKfaToken('M', -1);
  assert.equal(lowerM, 'M.', 'Lower octave Tivra Ma must be "M."');
});

test('Swara Mapping: Sa = C test scale', () => {
  // C4 = MIDI 60, D4 = 62, E4 = 64, F4 = 65, F#4 = 66, G4 = 67, A4 = 69, B4 = 71, C5 = 72, B3 = 59
  assert.equal(calculateSwaraFromMidi(60, 'C', 'C4', 261.6, 0).formattedToken, 'S');
  assert.equal(calculateSwaraFromMidi(62, 'C', 'D4', 293.7, 0).formattedToken, 'R');
  assert.equal(calculateSwaraFromMidi(64, 'C', 'E4', 329.6, 0).formattedToken, 'G');
  assert.equal(calculateSwaraFromMidi(65, 'C', 'F4', 349.2, 0).formattedToken, 'm');
  assert.equal(calculateSwaraFromMidi(66, 'C', 'F#4', 370.0, 0).formattedToken, 'M');
  assert.equal(calculateSwaraFromMidi(67, 'C', 'G4', 392.0, 0).formattedToken, 'P');
  assert.equal(calculateSwaraFromMidi(69, 'C', 'A4', 440.0, 0).formattedToken, 'D');
  assert.equal(calculateSwaraFromMidi(71, 'C', 'B4', 493.9, 0).formattedToken, 'N');
  assert.equal(calculateSwaraFromMidi(72, 'C', 'C5', 523.3, 0).formattedToken, "S'");
  assert.equal(calculateSwaraFromMidi(59, 'C', 'B3', 246.9, 0).formattedToken, 'N.');
});

test('Swara Mapping: Sa = D test scale', () => {
  // D4 = MIDI 62 (Sa), E4 = 64 (Re), F#4 = 66 (Ga), G4 = 67 (Ma), A4 = 69 (Pa), B4 = 71 (Dha), C#5 = 73 (Ni), D5 = 74 (Taar Sa)
  // C4 = MIDI 60 (Mandra Komal Ni -> n.), A3 = MIDI 57 (Mandra Pa -> P.)
  assert.equal(calculateSwaraFromMidi(62, 'D', 'D4', 293.7, 0).formattedToken, 'S');
  assert.equal(calculateSwaraFromMidi(64, 'D', 'E4', 329.6, 0).formattedToken, 'R');
  assert.equal(calculateSwaraFromMidi(66, 'D', 'F#4', 370.0, 0).formattedToken, 'G');
  assert.equal(calculateSwaraFromMidi(67, 'D', 'G4', 392.0, 0).formattedToken, 'm');
  assert.equal(calculateSwaraFromMidi(69, 'D', 'A4', 440.0, 0).formattedToken, 'P');
  assert.equal(calculateSwaraFromMidi(71, 'D', 'B4', 493.9, 0).formattedToken, 'D');
  assert.equal(calculateSwaraFromMidi(73, 'D', 'C#5', 554.4, 0).formattedToken, 'N');
  assert.equal(calculateSwaraFromMidi(74, 'D', 'D5', 587.3, 0).formattedToken, "S'");
  assert.equal(calculateSwaraFromMidi(60, 'D', 'C4', 261.6, 0).formattedToken, 'n.');
  assert.equal(calculateSwaraFromMidi(57, 'D', 'A3', 220.0, 0).formattedToken, 'P.');
});

test('PitchStabilizer: sustained note holds for 3 seconds and emits exactly ONE token', () => {
  const stabilizer = new PitchStabilizer();
  const startTime = 1000;
  const tokens = [];

  // Simulate 3 seconds (3000ms) of playing C4 (261.6 Hz) at 60 FPS (~16.6ms per frame)
  for (let t = 0; t <= 3000; t += 16) {
    const now = startTime + t;
    const res = stabilizer.processFrame(261.63, 0.08, 0.95, 'C', now);
    if (res.emittedToken) {
      tokens.push(res.emittedToken.formattedToken);
    }
  }

  assert.equal(tokens.length, 1, `Expected exactly 1 token for a held note, but got ${tokens.length}`);
  assert.equal(tokens[0], 'S');
});

test('PitchStabilizer: repeated articulated notes (S S S) emit consecutive tokens', () => {
  const stabilizer = new PitchStabilizer();
  let now = 1000;
  const tokens = [];

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

  const playArticulationGap = (gapMs) => {
    const end = now + gapMs;
    while (now < end) {
      // Volume dip during tongue / finger release
      stabilizer.processFrame(261.63, 0.005, 0.2, 'C', now);
      now += 16;
    }
  };

  // 1st S
  playNote(261.63, 200);
  // Break
  playArticulationGap(60);
  // 2nd S
  playNote(261.63, 200);
  // Break
  playArticulationGap(60);
  // 3rd S
  playNote(261.63, 200);

  assert.deepEqual(tokens, ['S', 'S', 'S'], `Expected ['S', 'S', 'S'], got: ${JSON.stringify(tokens)}`);
});
