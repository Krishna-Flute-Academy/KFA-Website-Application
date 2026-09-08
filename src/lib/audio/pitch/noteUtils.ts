import { TuningStatus, DetectedNote } from './types';

export const CHROMATIC_SHARP_NOTES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const;

export const CHROMATIC_FLAT_NOTES = [
    'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
] as const;

export const CHROMATIC_ENHARMONIC_LABELS = [
    'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'
] as const;

/**
 * Converts a frequency in Hz to a detailed DetectedNote object.
 * 
 * @param frequency Measured frequency in Hz
 * @param a4Reference Reference frequency for A4 (default: 440 Hz, range 430 - 450)
 * @param inTuneTolerance Tolerance threshold in cents for "In Tune" (default: ±5 cents)
 */
export function frequencyToNote(
    frequency: number,
    a4Reference: number = 440,
    inTuneTolerance: number = 5
): Omit<DetectedNote, 'swara'> | null {
    if (frequency <= 0 || isNaN(frequency) || !isFinite(frequency)) {
        return null;
    }

    // MIDI Note number formula: 69 + 12 * log2(f / A4)
    const exactMidi = 69 + 12 * (Math.log(frequency / a4Reference) / Math.LN2);
    const roundMidi = Math.round(exactMidi);
    const cents = Math.round((exactMidi - roundMidi) * 100);

    const noteIndex = ((roundMidi % 12) + 12) % 12;
    // MIDI 12 = C0, MIDI 60 = C4
    const octave = Math.floor(roundMidi / 12) - 1;

    const sharpName = CHROMATIC_SHARP_NOTES[noteIndex];
    const flatName = CHROMATIC_FLAT_NOTES[noteIndex];
    const enharmonicName = CHROMATIC_ENHARMONIC_LABELS[noteIndex];
    const noteName = sharpName;
    const fullWesternNote = `${sharpName}${octave}`;

    // Categorize status
    let status: TuningStatus;
    let statusLabel: string;

    if (cents < -15) {
        status = 'too_flat';
        statusLabel = 'Too Flat';
    } else if (cents < -inTuneTolerance) {
        status = 'slightly_flat';
        statusLabel = 'Slightly Flat';
    } else if (cents > 15) {
        status = 'too_sharp';
        statusLabel = 'Too Sharp';
    } else if (cents > inTuneTolerance) {
        status = 'slightly_sharp';
        statusLabel = 'Slightly Sharp';
    } else {
        status = 'in_tune';
        statusLabel = 'In Tune';
    }

    return {
        frequency,
        noteName,
        sharpName,
        flatName,
        enharmonicName,
        midiNote: roundMidi,
        octave,
        fullWesternNote,
        cents,
        status,
        statusLabel,
        clarity: 1
    };
}

/**
 * Returns exact target frequency for a MIDI note given A4 reference.
 */
export function midiToFrequency(midiNote: number, a4Reference: number = 440): number {
    return a4Reference * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Checks if a note is considered in tune within the given tolerance.
 */
export function isNoteInTune(cents: number, tolerance: number = 5): boolean {
    return Math.abs(cents) <= tolerance;
}
