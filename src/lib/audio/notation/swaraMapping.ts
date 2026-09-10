import { RootNote } from '../pitch/types';
import { getChromaticIndex } from '../pitch/swaraUtils';
import { OctaveSaptakType, SwaraNotationToken } from './types';

export interface BaseSwaraInfo {
    semitone: number;
    baseSwara: string;
    name: string;
    displayName: string;
    devanagari: string;
}

/**
 * KFA Canonical 12 Swara Definitions.
 * Note: Semitone 6 is strictly 'M' (Tivra Ma in middle octave), NOT 'M''.
 * Octave markers (. for Mandra, ' for Taar) are applied orthogonally.
 */
export const KFA_SWARA_DEFINITIONS: readonly BaseSwaraInfo[] = [
    { semitone: 0,  baseSwara: 'S', name: 'Sa',         displayName: 'SA',        devanagari: 'सा' },
    { semitone: 1,  baseSwara: 'r', name: 'Komal Re',   displayName: 'KOMAL RE',  devanagari: '॒रे' },
    { semitone: 2,  baseSwara: 'R', name: 'Re',         displayName: 'RE',        devanagari: 'रे' },
    { semitone: 3,  baseSwara: 'g', name: 'Komal Ga',   displayName: 'KOMAL GA',  devanagari: '॒ग' },
    { semitone: 4,  baseSwara: 'G', name: 'Ga',         displayName: 'GA',        devanagari: 'ग' },
    { semitone: 5,  baseSwara: 'm', name: 'Ma',         displayName: 'MA',        devanagari: 'म' },
    { semitone: 6,  baseSwara: 'M', name: 'Tivra Ma',   displayName: 'TIVRA MA',  devanagari: '॑म' },
    { semitone: 7,  baseSwara: 'P', name: 'Pa',         displayName: 'PA',        devanagari: 'प' },
    { semitone: 8,  baseSwara: 'd', name: 'Komal Dha',  displayName: 'KOMAL DHA', devanagari: '॒ध' },
    { semitone: 9,  baseSwara: 'D', name: 'Dha',        displayName: 'DHA',       devanagari: 'ध' },
    { semitone: 10, baseSwara: 'n', name: 'Komal Ni',   displayName: 'KOMAL NI',  devanagari: '॒नि' },
    { semitone: 11, baseSwara: 'N', name: 'Ni',         displayName: 'NI',        devanagari: 'नि' },
] as const;

/**
 * Returns formatted KFA notation string given base Swara and octave offset relative to Madhya Sa.
 *
 * Lower octave: S. R. G. m. M. P. D. N.
 * Middle octave: S R G m M P D N
 * Upper octave: S' R' G' m' M' P' D' N'
 * Higher (Ati-Taar): S'' R'' ...
 */
export function formatKfaToken(baseSwara: string, octaveOffset: number): string {
    if (octaveOffset < 0) {
        // Lower octave (Mandra): dot suffix
        const dots = '.'.repeat(Math.abs(octaveOffset));
        return `${baseSwara}${dots}`;
    } else if (octaveOffset === 1) {
        // Upper octave (Taar): prime suffix
        return `${baseSwara}'`;
    } else if (octaveOffset >= 2) {
        // Ati-Taar: double prime
        return `${baseSwara}''`;
    }
    // Middle octave (Madhya): no suffix
    return baseSwara;
}

/**
 * Returns user-facing Saptak classification and human-readable label.
 */
export function getSaptakFromOffset(octaveOffset: number): {
    saptak: OctaveSaptakType;
    saptakLabel: string;
} {
    if (octaveOffset < 0) {
        return { saptak: 'mandra', saptakLabel: 'Mandra Saptak (Lower)' };
    } else if (octaveOffset === 0) {
        return { saptak: 'madhya', saptakLabel: 'Madhya Saptak (Middle)' };
    } else if (octaveOffset === 1) {
        return { saptak: 'taar', saptakLabel: 'Taar Saptak (Upper)' };
    } else {
        return { saptak: 'ati_taar', saptakLabel: 'Ati-Taar Saptak (Higher)' };
    }
}

/**
 * Calculates complete Indian Swara information for any detected MIDI note relative to selected Sa.
 *
 * @param midiNote Nearest MIDI note number (e.g. 60 for C4, 62 for D4, 64 for E4)
 * @param selectedSa Student's selected root tonic (e.g. 'C', 'D', 'E')
 * @param westernNote Full Western note with octave (e.g. 'E4')
 * @param frequency Measured frequency in Hz
 * @param cents Pitch offset in cents (-50 to +50)
 */
export function calculateSwaraFromMidi(
    midiNote: number,
    selectedSa: RootNote,
    westernNote: string,
    frequency: number,
    cents: number
): SwaraNotationToken {
    const saPitchClass = getChromaticIndex(selectedSa);
    // Base Madhya Sa anchor at Octave 4 (MIDI 60 + saPitchClass)
    // C4=60, C#4=61, D4=62, D#4=63, E4=64, F4=65, F#4=66, G4=67, G#4=68, A4=69, A#4=70, B4=71
    const baseMadhyaSaMidi = 60 + saPitchClass;

    const delta = midiNote - baseMadhyaSaMidi;
    const octaveOffset = Math.floor(delta / 12);
    const semitoneOffset = ((delta % 12) + 12) % 12;

    const def = KFA_SWARA_DEFINITIONS[semitoneOffset];
    const formattedToken = formatKfaToken(def.baseSwara, octaveOffset);
    const { saptak } = getSaptakFromOffset(octaveOffset);

    return {
        baseSwara: def.baseSwara,
        formattedToken,
        name: def.name,
        devanagari: def.devanagari,
        saptak,
        semitoneOffset,
        octaveOffset,
        westernNote,
        frequency,
        cents,
        timestamp: Date.now()
    };
}
