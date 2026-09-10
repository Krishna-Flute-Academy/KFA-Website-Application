import { RootNote, TuningStatus } from '../pitch/types';

/**
 * Centralized configuration for Sur to Notation transcription engine.
 * Tunable values for real flute acoustics and performance.
 */
export const SUR_NOTATION_CONFIG = {
    /** Minimum RMS amplitude threshold to accept audio (tuned for flute breath & microphones) */
    rmsGate: 0.008,
    /** Minimum continuous stable duration in milliseconds before a pitch is confirmed (fast ~50ms for instant feel) */
    stableDurationMs: 50,
    /** Minimum consecutive frames of matching note needed before confirming */
    minConsecutiveFrames: 2,
    /** Minimum silence/drop duration in milliseconds to recognize note release / articulation gap */
    releaseDurationMs: 45,
    /** Rolling median buffer length to eliminate transient acoustic flutter */
    medianWindowSize: 3,
    /** Ratio of current RMS to peak RMS below which an articulation onset trigger is primed (25% dip) */
    retriggerDropRatio: 0.75,
    /** Live UI updates per second for instantaneous feedback */
    liveUiFps: 30,
    /** Cents tolerance boundary (±50 cents = 1 semitone) */
    centsTolerance: 50,
    /** AudioContext FFT buffer size */
    bufferSize: 2048,
    /** High-pass filter cut-off frequency in Hz (cuts mic thumps, desk vibrations, AC hum) */
    highPassHz: 80,
    /** Low-pass filter cut-off frequency in Hz (cuts breath hiss and extreme high harmonics) */
    lowPassHz: 2400,
    /** Minimum YIN clarity score to consider note valid (tuned for breathy flute tone) */
    minClarity: 0.35,
} as const;

export type OctaveSaptakType = 'mandra' | 'madhya' | 'taar' | 'ati_taar';

export interface SwaraNotationToken {
    /** Raw Swara letter without octave marker (e.g. "S", "r", "R", "g", "G", "m", "M", "P", "d", "D", "n", "N") */
    baseSwara: string;
    /** Formatted KFA notation string with octave marker (e.g. "S.", "S", "S'", "M", "M'") */
    formattedToken: string;
    /** Full Swara name (e.g. "Shuddha Re", "Tivra Ma") */
    name: string;
    /** Devanagari representation (e.g. "सा", "॑म") */
    devanagari: string;
    /** Saptak classification relative to selected Sa */
    saptak: OctaveSaptakType;
    /** Semitone distance from selected Sa (0 to 11) */
    semitoneOffset: number;
    /** Relative octave offset from Madhya Sa (-1 = mandra, 0 = madhya, 1 = taar, 2+ = ati_taar) */
    octaveOffset: number;
    /** Western note with octave (e.g. "E4", "G#4") */
    westernNote: string;
    /** Frequency in Hz at detection */
    frequency: number;
    /** Cents offset from target semitone (-50 to +50) */
    cents: number;
    /** Timestamp when note was committed */
    timestamp: number;
}

export interface LivePitchState {
    /** Base Swara letter (e.g. "G", "M", "S") */
    swara: string;
    /** Formatted Swara with octave marker (e.g. "G", "M'", "S.") */
    formattedSwara: string;
    /** Devanagari script (e.g. "ग", "सा") */
    devanagari: string;
    /** Full name (e.g. "Ga", "Tivra Ma") */
    swaraName: string;
    /** Saptak label (e.g. "Madhya Saptak", "Taar Saptak", "Mandra Saptak") */
    saptakLabel: string;
    /** Western note with octave (e.g. "E4") */
    westernNote: string;
    /** Frequency in Hz (e.g. 329.6) */
    frequency: number;
    /** Pitch deviation in cents (-50 to +50) */
    cents: number;
    /** Categorized tuning status ('in_tune', 'slightly_flat', etc.) */
    tuningStatus: TuningStatus;
    /** Stability state ('stable' | 'detecting' | 'silence') */
    confidence: 'stable' | 'detecting' | 'silence';
    /** RMS input volume level percentage (0 to 100) */
    inputVolume: number;
}

export type ListeningStatus = 'idle' | 'listening' | 'paused';
