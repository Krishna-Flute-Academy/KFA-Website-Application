import { RootNote } from '../pitch/types';
import { SwaraNotationToken, SUR_NOTATION_CONFIG } from './types';
import { KFA_SWARA_DEFINITIONS, formatKfaToken } from './swaraMapping';

export interface NormalizedSur {
    raw: string;
    baseSwara: string;         // 'S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'
    canonicalName: string;     // 'Sa', 'Komal Re', 'Re', etc.
    displayName: string;       // 'SA', 'KOMAL RE', 'RE', etc.
    devanagari: string;        // 'सा', 'रे', etc.
    octaveOffset: number;      // -1 for Mandra (.), 0 for Madhya, 1 for Taar ('), 2 for Ati-Taar ('')
    octaveSpecified: boolean;  // whether input explicitly had an octave marker
    formattedToken: string;    // e.g. "S", "S'", "S.", "m", "M", "M'"
}

/**
 * Normalizes any Hindustani notation representation or alias into canonical KFA form.
 * Handles inputs like 'Sa', 'sa', 'S', 'Komal Re', 'r', 'Tivra Ma', 'M\'', 'S.', etc.
 */
export function normalizeSur(rawInput: string): NormalizedSur | null {
    if (!rawInput || typeof rawInput !== 'string') return null;

    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    // Detect and extract octave markers: dots (.) for Mandra, primes (') for Taar
    let octaveOffset = 0;
    let octaveSpecified = false;
    let cleaned = trimmed;

    // Trailing primes for Taar / Ati-Taar
    const primeMatch = cleaned.match(/'{1,3}$/);
    if (primeMatch) {
        octaveOffset = primeMatch[0].length;
        octaveSpecified = true;
        cleaned = cleaned.replace(/'{1,3}$/, '');
    }

    // Trailing dots for Mandra
    const dotMatch = cleaned.match(/\.{1,3}$/);
    if (dotMatch) {
        octaveOffset = -dotMatch[0].length;
        octaveSpecified = true;
        cleaned = cleaned.replace(/\.{1,3}$/, '');
    }

    // Leading dots or primes (e.g. .S or 'S)
    if (cleaned.startsWith('.')) {
        octaveOffset = -1;
        octaveSpecified = true;
        cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith("'")) {
        octaveOffset = 1;
        octaveSpecified = true;
        cleaned = cleaned.substring(1);
    }

    cleaned = cleaned.trim();

    // Map common aliases to baseSwara
    // 0: S, 1: r, 2: R, 3: g, 4: G, 5: m, 6: M, 7: P, 8: d, 9: D, 10: n, 11: N
    let targetSemitone = -1;

    // Normalize case-insensitive comparison for word names
    const lower = cleaned.toLowerCase().replace(/[-_]/g, ' ');

    if (lower === 'sa' || lower === 's' || cleaned === 'S') {
        targetSemitone = 0;
    } else if (lower === 'komal re' || lower === 'komal r' || lower === 'kre' || cleaned === 'r' || lower === 'r_') {
        targetSemitone = 1;
    } else if (lower === 'shuddha re' || lower === 're' || cleaned === 'R') {
        targetSemitone = 2;
    } else if (lower === 'komal ga' || lower === 'komal g' || lower === 'kga' || cleaned === 'g' || lower === 'g_') {
        targetSemitone = 3;
    } else if (lower === 'shuddha ga' || lower === 'ga' || cleaned === 'G') {
        targetSemitone = 4;
    } else if (lower === 'shuddha ma' || lower === 'ma' || cleaned === 'm') {
        targetSemitone = 5;
    } else if (lower === 'tivra ma' || lower === 'teevra ma' || lower === 'tma' || cleaned === 'M' || cleaned === "M'") {
        targetSemitone = 6;
    } else if (lower === 'pa' || lower === 'p' || cleaned === 'P') {
        targetSemitone = 7;
    } else if (lower === 'komal dha' || lower === 'komal d' || lower === 'kdha' || cleaned === 'd' || lower === 'd_') {
        targetSemitone = 8;
    } else if (lower === 'shuddha dha' || lower === 'dha' || cleaned === 'D') {
        targetSemitone = 9;
    } else if (lower === 'komal ni' || lower === 'komal n' || lower === 'kni' || cleaned === 'n' || lower === 'n_') {
        targetSemitone = 10;
    } else if (lower === 'shuddha ni' || lower === 'ni' || cleaned === 'N') {
        targetSemitone = 11;
    } else {
        // Direct match against single characters
        if (cleaned === 'S') targetSemitone = 0;
        else if (cleaned === 'r') targetSemitone = 1;
        else if (cleaned === 'R') targetSemitone = 2;
        else if (cleaned === 'g') targetSemitone = 3;
        else if (cleaned === 'G') targetSemitone = 4;
        else if (cleaned === 'm') targetSemitone = 5;
        else if (cleaned === 'M') targetSemitone = 6;
        else if (cleaned === 'P') targetSemitone = 7;
        else if (cleaned === 'd') targetSemitone = 8;
        else if (cleaned === 'D') targetSemitone = 9;
        else if (cleaned === 'n') targetSemitone = 10;
        else if (cleaned === 'N') targetSemitone = 11;
    }

    if (targetSemitone === -1) {
        return null;
    }

    const def = KFA_SWARA_DEFINITIONS[targetSemitone];
    const formattedToken = formatKfaToken(def.baseSwara, octaveOffset);

    return {
        raw: trimmed,
        baseSwara: def.baseSwara,
        canonicalName: def.name,
        displayName: def.displayName,
        devanagari: def.devanagari,
        octaveOffset,
        octaveSpecified,
        formattedToken
    };
}

export interface NoteMatchParams {
    detectedToken: SwaraNotationToken | null;
    expectedNote: string;
    toleranceCents?: number;
}

export interface NoteMatchResult {
    isMatch: boolean;
    isSwaraMatch: boolean;
    isOctaveMatch: boolean;
    isInTune: boolean;
    expectedNormalized: NormalizedSur | null;
    detectedSur: string;
    expectedSur: string;
    cents: number;
    reason?: string;
}

/**
 * Canonical matcher function: decides whether a detected note matches the expected Sur.
 * 
 * Rules:
 * 1. Base Swara must match (e.g. Sa matches Sa, Re matches Re).
 * 2. If octave is specified in the expected note (e.g. S' or S.), octave must match.
 * 3. Pitch cents deviation must be within tolerance (default ±30 cents; strictly < 40 cents so adjacent semitones can never match).
 */
export function isDetectedNoteCorrect(
    paramsOrToken: NoteMatchParams | SwaraNotationToken | null,
    expectedNoteArg?: string,
    toleranceCentsArg?: number
): NoteMatchResult {
    let detectedToken: SwaraNotationToken | null = null;
    let expectedNote = '';
    let toleranceCents = 30;

    if (paramsOrToken && typeof paramsOrToken === 'object' && 'expectedNote' in paramsOrToken) {
        const p = paramsOrToken as NoteMatchParams;
        detectedToken = p.detectedToken ?? null;
        expectedNote = p.expectedNote ?? '';
        toleranceCents = p.toleranceCents ?? 30;
    } else {
        detectedToken = paramsOrToken as SwaraNotationToken | null;
        expectedNote = expectedNoteArg ?? '';
        toleranceCents = toleranceCentsArg ?? 30;
    }

    const expectedNormalized = normalizeSur(expectedNote);

    if (!expectedNormalized) {
        return {
            isMatch: false,
            isSwaraMatch: false,
            isOctaveMatch: false,
            isInTune: false,
            expectedNormalized: null,
            detectedSur: detectedToken?.formattedToken || '—',
            expectedSur: expectedNote,
            cents: detectedToken?.cents || 0,
            reason: 'Invalid expected note'
        };
    }

    if (!detectedToken) {
        return {
            isMatch: false,
            isSwaraMatch: false,
            isOctaveMatch: false,
            isInTune: false,
            expectedNormalized,
            detectedSur: '—',
            expectedSur: expectedNormalized.formattedToken,
            cents: 0,
            reason: 'No note detected'
        };
    }

    const detectedSur = detectedToken.formattedToken;
    const expectedSur = expectedNormalized.formattedToken;
    const cents = detectedToken.cents;

    // 1. Base Swara identity check (case-sensitive on baseSwara: S, r, R, g, G, m, M, P, d, D, n, N)
    const isSwaraMatch = detectedToken.baseSwara === expectedNormalized.baseSwara;

    // 2. Octave match check (only enforced if expected note explicitly specifies octave)
    let isOctaveMatch = true;
    if (expectedNormalized.octaveSpecified) {
        isOctaveMatch = detectedToken.octaveOffset === expectedNormalized.octaveOffset;
    }

    // 3. Pitch cents tolerance check (strictly < 40 to never allow adjacent semitone)
    const effectiveTolerance = Math.min(Math.max(10, toleranceCents), 35);
    const isInTune = Math.abs(cents) <= effectiveTolerance;

    let reason: string | undefined;
    if (!isSwaraMatch) {
        reason = `Different Sur (played ${detectedToken.name || detectedToken.baseSwara}, expected ${expectedNormalized.canonicalName})`;
    } else if (!isOctaveMatch) {
        reason = 'Different octave (register)';
    } else if (!isInTune) {
        reason = `Out of tune (${cents > 0 ? '+' : ''}${cents} cents)`;
    }

    const isMatch = isSwaraMatch && isOctaveMatch && isInTune;

    return {
        isMatch,
        isSwaraMatch,
        isOctaveMatch,
        isInTune,
        expectedNormalized,
        detectedSur,
        expectedSur,
        cents,
        reason
    };
}

export interface ExerciseStepState {
    sequence: string[];
    currentIndex: number;
    isComplete: boolean;
    matchStartedAt: number | null;
    stabilityRequiredMs: number;
    isNoteLocked: boolean;
    lockedNote: string | null; // Same-note lock: remembers which baseSwara was just accepted
    peakRmsSinceAccept: number;
    feedback: {
        status: 'idle' | 'listening' | 'correct' | 'incorrect' | 'completed';
        message: string;
        detectedSur?: string;
        expectedSur?: string;
    };
}

/**
 * Initializes a clean exercise state for a given sequence of notation.
 * Uses timestamp-based stability duration (default: 100ms).
 */
export function createInitialExerciseState(
    sequence: readonly string[] | string[],
    stabilityRequiredMs: number = 100
): ExerciseStepState {
    const validSeq = Array.from(sequence).filter(s => !!normalizeSur(s));
    const firstExpected = validSeq[0] ? normalizeSur(validSeq[0])?.formattedToken || validSeq[0] : 'S';

    return {
        sequence: validSeq.length > 0 ? validSeq : ['S', 'R', 'G', 'm'],
        currentIndex: 0,
        isComplete: false,
        matchStartedAt: null,
        stabilityRequiredMs,
        isNoteLocked: false,
        lockedNote: null,
        peakRmsSinceAccept: 0,
        feedback: {
            status: 'idle',
            message: `Target note: ${firstExpected}. Play your flute to begin!`,
            expectedSur: firstExpected
        }
    };
}

/**
 * Pure state machine evaluator: processes a detector frame against current exercise state using timestamps.
 * Returns the next exercise state deterministically.
 */
export function evaluateExerciseStep(
    prevState: ExerciseStepState,
    detectedToken: SwaraNotationToken | null,
    nowMs: number = Date.now(),
    rms: number = 0.05,
    isSilentOrTolerance: boolean | number = false,
    toleranceCents: number = 30
): ExerciseStepState {
    let isSilent = false;
    let effectiveTolerance = toleranceCents;

    if (typeof isSilentOrTolerance === 'number') {
        effectiveTolerance = isSilentOrTolerance;
        isSilent = false;
    } else {
        isSilent = Boolean(isSilentOrTolerance);
    }

    // Already completed -> no further progression
    if (prevState.isComplete || prevState.currentIndex >= prevState.sequence.length) {
        return {
            ...prevState,
            isComplete: true,
            matchStartedAt: null,
            feedback: {
                status: 'completed',
                message: 'Exercise Complete'
            }
        };
    }

    const currentExpected = prevState.sequence[prevState.currentIndex];
    const expNorm = normalizeSur(currentExpected);
    const expDisplay = expNorm ? expNorm.formattedToken : currentExpected;

    // 1. Silence / Breath Gap / Below RMS Noise Gate
    const silentFrame = isSilent || !detectedToken || detectedToken.frequency <= 0 || rms < SUR_NOTATION_CONFIG.rmsGate;

    if (silentFrame) {
        // Silence naturally releases the anti-skipping lock, allowing repeated notes or next note
        return {
            ...prevState,
            matchStartedAt: null,
            isNoteLocked: false,
            lockedNote: null,
            peakRmsSinceAccept: 0,
            feedback: prevState.feedback.status === 'correct' 
                ? prevState.feedback 
                : {
                    status: 'listening',
                    message: `Listening for ${expDisplay}...`,
                    expectedSur: expDisplay
                }
        };
    }

    // 2. Sound is detected -> evaluate note match
    const match = isDetectedNoteCorrect({
        detectedToken,
        expectedNote: currentExpected,
        toleranceCents: effectiveTolerance
    });

    // 3. Incorrect Note Played -> DO NOT ADVANCE!
    if (!match.isMatch) {
        // Playing a different note releases any hold lock from a previous note
        const reasonMsg = match.reason ? ` (${match.reason})` : '';
        return {
            ...prevState,
            matchStartedAt: null,
            isNoteLocked: false,
            lockedNote: null,
            peakRmsSinceAccept: 0,
            feedback: {
                status: 'incorrect',
                message: `Detected ${match.detectedSur} — Expected ${expDisplay}${reasonMsg}`,
                detectedSur: match.detectedSur,
                expectedSur: expDisplay
            }
        };
    }

    // 4. Correct Note Played
    // Same-note hold lock: if the note currently played is the SAME baseSwara as the one just accepted,
    // require an articulation dip or silence before allowing it to advance again.
    if (prevState.isNoteLocked && prevState.lockedNote === detectedToken.baseSwara) {
        // Check if an articulation dip occurred (30% drop in volume from peak since accept)
        if (rms < prevState.peakRmsSinceAccept * 0.70) {
            // Articulation dip detected! Unlock for the repeated note
            return {
                ...prevState,
                isNoteLocked: false,
                lockedNote: null,
                matchStartedAt: nowMs,
                peakRmsSinceAccept: rms,
                feedback: {
                    status: 'listening',
                    message: `Holding ${expDisplay}...`,
                    expectedSur: expDisplay
                }
            };
        }

        // Otherwise, still holding the same note without articulation
        const newPeak = Math.max(prevState.peakRmsSinceAccept, rms);
        return {
            ...prevState,
            matchStartedAt: null,
            peakRmsSinceAccept: newPeak,
            feedback: {
                status: 'listening',
                message: `Articulate or take a breath before playing ${expDisplay}`,
                expectedSur: expDisplay
            }
        };
    }

    // If moving to a different note, clear the previous lock
    let activeMatchStart = prevState.matchStartedAt;
    if (prevState.isNoteLocked && prevState.lockedNote !== detectedToken.baseSwara) {
        activeMatchStart = nowMs;
    }

    // 5. Stable match progression via timestamp
    const matchStart = activeMatchStart ?? nowMs;
    const elapsedMs = nowMs - matchStart;

    if (elapsedMs < prevState.stabilityRequiredMs) {
        // Still stabilizing
        return {
            ...prevState,
            matchStartedAt: matchStart,
            isNoteLocked: false,
            lockedNote: null,
            feedback: {
                status: 'listening',
                message: `Holding ${expDisplay}...`,
                expectedSur: expDisplay
            }
        };
    }

    // Stability threshold met -> ADVANCE EXACTLY ONCE!
    const nextIndex = prevState.currentIndex + 1;
    const isNowComplete = nextIndex >= prevState.sequence.length;

    if (isNowComplete) {
        return {
            ...prevState,
            currentIndex: nextIndex,
            isComplete: true,
            matchStartedAt: null,
            isNoteLocked: true,
            lockedNote: detectedToken.baseSwara,
            peakRmsSinceAccept: rms,
            feedback: {
                status: 'completed',
                message: 'Exercise Complete'
            }
        };
    } else {
        const nextExpected = prevState.sequence[nextIndex];
        const nextNorm = normalizeSur(nextExpected);
        const nextDisplay = nextNorm ? nextNorm.formattedToken : nextExpected;

        return {
            ...prevState,
            currentIndex: nextIndex,
            isComplete: false,
            matchStartedAt: null,
            isNoteLocked: true, // Lock note until release or articulation
            lockedNote: detectedToken.baseSwara,
            peakRmsSinceAccept: rms,
            feedback: {
                status: 'correct',
                message: `Correct! Next: ${nextDisplay}`,
                detectedSur: match.detectedSur,
                expectedSur: nextDisplay
            }
        };
    }
}

/**
 * Standard exercise presets for Indian Flute students.
 * Conforms strictly to KFA Hindustani notation conventions.
 */
export const EXERCISE_PRESETS = [
    {
        id: 'basic_4',
        name: 'Basic 4 Notes',
        description: 'Practice the fundamental 4 notes: Sa, Re, Ga, Ma',
        sequence: ['S', 'R', 'G', 'm']
    },
    {
        id: 'saptak_scale',
        name: 'Full Saptak Scale',
        description: 'Complete Bilawal / Shuddha Swara octave: Sa to Taar Sa',
        sequence: ['S', 'R', 'G', 'm', 'P', 'D', 'N', "S'"]
    },
    {
        id: 'pyramid',
        name: 'Pyramid Riyaz',
        description: 'Ascending and descending agility pattern: S R G R S',
        sequence: ['S', 'R', 'G', 'R', 'S']
    },
    {
        id: 'repeated_notes',
        name: 'Articulated Repetitions',
        description: 'Practice tonguing and articulation with repeated notes: S S R R G G',
        sequence: ['S', 'S', 'R', 'R', 'G', 'G']
    },
    {
        id: 'mandra_register',
        name: 'Mandra to Madhya Register',
        description: 'Lower octave transition practice: P. D. N. S',
        sequence: ['P.', 'D.', 'N.', 'S']
    }
] as const;
