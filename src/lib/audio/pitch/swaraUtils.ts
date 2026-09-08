import { RootNote, SwaraInfo, OctaveSaptak } from './types';
import { CHROMATIC_SHARP_NOTES } from './noteUtils';

export interface SwaraDefinition {
    semitone: number;
    shortCode: string;
    name: string;
    displayName: string;
    devanagari: string;
}

export const SWARA_DEFINITIONS: readonly SwaraDefinition[] = [
    { semitone: 0,  shortCode: 'S',  name: 'Sa',         displayName: 'SA',        devanagari: 'सा' },
    { semitone: 1,  shortCode: 'r',  name: 'Komal Re',   displayName: 'KOMAL RE',  devanagari: '॒रे' },
    { semitone: 2,  shortCode: 'R',  name: 'Re',         displayName: 'RE',        devanagari: 'रे' },
    { semitone: 3,  shortCode: 'g',  name: 'Komal Ga',   displayName: 'KOMAL GA',  devanagari: '॒ग' },
    { semitone: 4,  shortCode: 'G',  name: 'Ga',         displayName: 'GA',        devanagari: 'ग' },
    { semitone: 5,  shortCode: 'm',  name: 'Ma',         displayName: 'MA',        devanagari: 'म' },
    { semitone: 6,  shortCode: "M'", name: 'Tivra Ma',   displayName: 'TIVRA MA',  devanagari: '॑म' },
    { semitone: 7,  shortCode: 'P',  name: 'Pa',         displayName: 'PA',        devanagari: 'प' },
    { semitone: 8,  shortCode: 'd',  name: 'Komal Dha',  displayName: 'KOMAL DHA', devanagari: '॒ध' },
    { semitone: 9,  shortCode: 'D',  name: 'Dha',        displayName: 'DHA',       devanagari: 'ध' },
    { semitone: 10, shortCode: 'n',  name: 'Komal Ni',   displayName: 'KOMAL NI',  devanagari: '॒नि' },
    { semitone: 11, shortCode: 'N',  name: 'Ni',         displayName: 'NI',        devanagari: 'नि' },
] as const;

/**
 * Maps a chromatic note to its 0-11 index (C = 0, C# = 1, ..., B = 11).
 */
export function getChromaticIndex(note: string): number {
    const clean = note.trim().toUpperCase().replace('/', '');
    if (clean.startsWith('C#') || clean.startsWith('DB')) return 1;
    if (clean.startsWith('D#') || clean.startsWith('EB')) return 3;
    if (clean.startsWith('F#') || clean.startsWith('GB')) return 6;
    if (clean.startsWith('G#') || clean.startsWith('AB')) return 8;
    if (clean.startsWith('A#') || clean.startsWith('BB')) return 10;
    if (clean.startsWith('C')) return 0;
    if (clean.startsWith('D')) return 2;
    if (clean.startsWith('E')) return 4;
    if (clean.startsWith('F')) return 5;
    if (clean.startsWith('G')) return 7;
    if (clean.startsWith('A')) return 9;
    if (clean.startsWith('B')) return 11;
    return 0;
}

/**
 * Returns the Saptak (octave) classification for a given octave number.
 */
export function getSaptakForOctave(octave: number): { saptak: OctaveSaptak; saptakLabel: string } {
    if (octave <= 3) {
        return { saptak: 'mandra', saptakLabel: 'Mandra Saptak (Lower Octave)' };
    } else if (octave === 4) {
        return { saptak: 'madhya', saptakLabel: 'Madhya Saptak (Middle Octave)' };
    } else if (octave === 5) {
        return { saptak: 'taar', saptakLabel: 'Taar Saptak (Upper Octave)' };
    } else {
        return { saptak: 'ati_taar', saptakLabel: 'Ati-Taar Saptak (Higher Register)' };
    }
}

/**
 * Dynamically computes the Indian Swara for a detected note relative to selected Sa.
 * 
 * @param noteName Western detected note (e.g. "G", "C#", "Eb")
 * @param octave Detected octave number (e.g. 4)
 * @param selectedSa Student's selected Sa root note (e.g. "C", "D#", "E")
 */
export function getSwaraFromNote(
    noteName: string,
    octave: number,
    selectedSa: RootNote
): SwaraInfo {
    const noteIdx = getChromaticIndex(noteName);
    const saIdx = getChromaticIndex(selectedSa);

    // Semitone distance relative to Sa (0 to 11)
    const semitoneOffset = ((noteIdx - saIdx) % 12 + 12) % 12;
    const swaraDef = SWARA_DEFINITIONS[semitoneOffset];

    const { saptak, saptakLabel } = getSaptakForOctave(octave);

    return {
        shortCode: swaraDef.shortCode,
        name: swaraDef.name,
        displayName: swaraDef.displayName,
        devanagari: swaraDef.devanagari,
        saptak,
        saptakLabel,
        semitoneOffset
    };
}
