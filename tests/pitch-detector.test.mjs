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

const { detectPitchYin, calculateRms } = await importTypeScriptModule('../src/lib/audio/pitch/yin.ts');
const { frequencyToNote, midiToFrequency, isNoteInTune } = await importTypeScriptModule('../src/lib/audio/pitch/noteUtils.ts');
const { getSwaraFromNote, getChromaticIndex } = await importTypeScriptModule('../src/lib/audio/pitch/swaraUtils.ts');

function generateSineWave(freq, sampleRate = 44100, numSamples = 2048, amplitude = 0.8) {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buffer;
}

test('YIN: accurately detects fundamental frequencies on synthetic sine waves', () => {
  const sampleRate = 44100;

  // A4 (440 Hz)
  const a4Buffer = generateSineWave(440, sampleRate);
  const resultA4 = detectPitchYin(a4Buffer, sampleRate);
  assert.ok(resultA4 !== null, 'A4 should be detected');
  assert.ok(Math.abs(resultA4.frequency - 440) < 1.0, `Expected ~440 Hz, got ${resultA4.frequency}`);
  assert.ok(resultA4.clarity > 0.9, `Clarity should be high: ${resultA4.clarity}`);

  // C4 (261.63 Hz)
  const c4Buffer = generateSineWave(261.63, sampleRate);
  const resultC4 = detectPitchYin(c4Buffer, sampleRate);
  assert.ok(resultC4 !== null, 'C4 should be detected');
  assert.ok(Math.abs(resultC4.frequency - 261.63) < 1.0, `Expected ~261.63 Hz, got ${resultC4.frequency}`);

  // D5 (587.33 Hz)
  const d5Buffer = generateSineWave(587.33, sampleRate);
  const resultD5 = detectPitchYin(d5Buffer, sampleRate);
  assert.ok(resultD5 !== null, 'D5 should be detected');
  assert.ok(Math.abs(resultD5.frequency - 587.33) < 2.0, `Expected ~587.33 Hz, got ${resultD5.frequency}`);

  // Low E3 (164.81 Hz - common bass bansuri low note)
  const e3Buffer = generateSineWave(164.81, sampleRate, 4096);
  const resultE3 = detectPitchYin(e3Buffer, sampleRate);
  assert.ok(resultE3 !== null, 'E3 should be detected');
  assert.ok(Math.abs(resultE3.frequency - 164.81) < 1.5, `Expected ~164.81 Hz, got ${resultE3.frequency}`);
});

test('YIN: rejects silence or low RMS amplitude', () => {
  const sampleRate = 44100;
  const silentBuffer = new Float32Array(2048);
  const result = detectPitchYin(silentBuffer, sampleRate);
  assert.equal(result, null, 'Silent buffer must return null');

  const whisperBuffer = generateSineWave(440, sampleRate, 2048, 0.005);
  const whisperResult = detectPitchYin(whisperBuffer, sampleRate, { minRms: 0.015 });
  assert.equal(whisperResult, null, 'Sub-threshold whisper must return null');
});

test('noteUtils: converts frequency to Western note, octave, and cents deviation', () => {
  // 440 Hz -> A4, 0 cents, in_tune
  const a4 = frequencyToNote(440.0, 440);
  assert.ok(a4 !== null);
  assert.equal(a4.noteName, 'A');
  assert.equal(a4.octave, 4);
  assert.equal(a4.cents, 0);
  assert.equal(a4.status, 'in_tune');

  // 261.63 Hz -> C4, 0 cents, in_tune
  const c4 = frequencyToNote(261.63, 440);
  assert.ok(c4 !== null);
  assert.equal(c4.noteName, 'C');
  assert.equal(c4.octave, 4);
  assert.equal(c4.cents, 0);
  assert.equal(c4.status, 'in_tune');

  // Sharp note (e.g. 443 Hz -> ~+12 cents sharp)
  const sharpA4 = frequencyToNote(443.0, 440);
  assert.ok(sharpA4 !== null);
  assert.equal(sharpA4.noteName, 'A');
  assert.ok(sharpA4.cents > 5, `Expected sharp cents, got ${sharpA4.cents}`);
  assert.equal(sharpA4.status, 'slightly_sharp');

  // Flat note (e.g. 433 Hz -> ~-28 cents flat)
  const flatA4 = frequencyToNote(433.0, 440);
  assert.ok(flatA4 !== null);
  assert.equal(flatA4.noteName, 'A');
  assert.ok(flatA4.cents < -15, `Expected flat cents, got ${flatA4.cents}`);
  assert.equal(flatA4.status, 'too_flat');

  // Calibration: A4 = 432 Hz
  const a4At432 = frequencyToNote(432.0, 432);
  assert.ok(a4At432 !== null);
  assert.equal(a4At432.noteName, 'A');
  assert.equal(a4At432.cents, 0);
  assert.equal(a4At432.status, 'in_tune');
});

test('swaraUtils: maps dynamic Swara relative to Sa = C', () => {
  assert.equal(getSwaraFromNote('C', 4, 'C').name, 'Sa');
  assert.equal(getSwaraFromNote('C#', 4, 'C').name, 'Komal Re');
  assert.equal(getSwaraFromNote('D', 4, 'C').name, 'Re');
  assert.equal(getSwaraFromNote('D#', 4, 'C').name, 'Komal Ga');
  assert.equal(getSwaraFromNote('E', 4, 'C').name, 'Ga');
  assert.equal(getSwaraFromNote('F', 4, 'C').name, 'Ma');
  assert.equal(getSwaraFromNote('F#', 4, 'C').name, 'Tivra Ma');
  assert.equal(getSwaraFromNote('G', 4, 'C').name, 'Pa');
  assert.equal(getSwaraFromNote('G#', 4, 'C').name, 'Komal Dha');
  assert.equal(getSwaraFromNote('A', 4, 'C').name, 'Dha');
  assert.equal(getSwaraFromNote('A#', 4, 'C').name, 'Komal Ni');
  assert.equal(getSwaraFromNote('B', 4, 'C').name, 'Ni');
});

test('swaraUtils: maps dynamic Swara relative to Sa = E (E Bass Bansuri standard)', () => {
  // When Sa = E:
  // E is Sa, F is Komal Re, F# is Re, G is Komal Ga, G# is Ga, A is Ma, A# is Tivra Ma, B is Pa
  assert.equal(getSwaraFromNote('E', 4, 'E').name, 'Sa');
  assert.equal(getSwaraFromNote('F', 4, 'E').name, 'Komal Re');
  assert.equal(getSwaraFromNote('F#', 4, 'E').name, 'Re');
  assert.equal(getSwaraFromNote('G', 4, 'E').name, 'Komal Ga');
  assert.equal(getSwaraFromNote('G#', 4, 'E').name, 'Ga');
  assert.equal(getSwaraFromNote('A', 4, 'E').name, 'Ma');
  assert.equal(getSwaraFromNote('A#', 4, 'E').name, 'Tivra Ma');
  assert.equal(getSwaraFromNote('B', 4, 'E').name, 'Pa');
  assert.equal(getSwaraFromNote('C', 5, 'E').name, 'Komal Dha');
  assert.equal(getSwaraFromNote('C#', 5, 'E').name, 'Dha');
  assert.equal(getSwaraFromNote('D', 5, 'E').name, 'Komal Ni');
  assert.equal(getSwaraFromNote('D#', 5, 'E').name, 'Ni');
});

test('swaraUtils: supports chromatic aliases and flats', () => {
  assert.equal(getSwaraFromNote('Db', 4, 'C').name, 'Komal Re');
  assert.equal(getSwaraFromNote('Eb', 4, 'C').name, 'Komal Ga');
  assert.equal(getSwaraFromNote('Gb', 4, 'C').name, 'Tivra Ma');
  assert.equal(getSwaraFromNote('Ab', 4, 'C').name, 'Komal Dha');
  assert.equal(getSwaraFromNote('Bb', 4, 'C').name, 'Komal Ni');
});
