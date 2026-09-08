/**
 * Core Types for Pitch Detection & Flute Tuner
 */

export type TunerMode = 'indian' | 'chromatic';

export type RootNote = 
    | 'C' 
    | 'C#' 
    | 'D' 
    | 'D#' 
    | 'E' 
    | 'F' 
    | 'F#' 
    | 'G' 
    | 'G#' 
    | 'A' 
    | 'A#' 
    | 'B';

export type TuningStatus = 
    | 'too_flat'       // < -15 cents
    | 'slightly_flat'   // -15 to -5 cents
    | 'in_tune'         // -5 to +5 cents
    | 'slightly_sharp'  // +5 to +15 cents
    | 'too_sharp';      // > +15 cents

export type OctaveSaptak = 'mandra' | 'madhya' | 'taar' | 'ati_taar' | 'unknown';

export interface SwaraInfo {
    /** Short code e.g. "S", "r", "R", "g", "G", "m", "M'", "P", "d", "D", "n", "N" */
    shortCode: string;
    /** Standard name e.g. "Sa", "Komal Re", "Shuddha Re", "Tivra Ma", etc. */
    name: string;
    /** Romanized uppercase standard e.g. "SA", "KOMAL RE", "PA" */
    displayName: string;
    /** Devanagari script e.g. "सा", "॒रे", "रे", "॒ग", "ग", "म", "॑म", "प", "॒ध", "ध", "॒नि", "नि" */
    devanagari: string;
    /** Saptak/Octave classification relative to Madhya Sa */
    saptak: OctaveSaptak;
    /** Saptak label e.g. "Mandra (Lower)", "Madhya (Middle)", "Taar (Upper)" */
    saptakLabel: string;
    /** Semitone distance from selected Sa (0 to 11) */
    semitoneOffset: number;
}

export interface DetectedNote {
    /** Frequency in Hz (e.g. 440.0) */
    frequency: number;
    /** Western note name without octave e.g. "A", "C#", "Bb" */
    noteName: string;
    /** Western note with sharp representation e.g. "C#" */
    sharpName: string;
    /** Western note with flat representation e.g. "Db" */
    flatName: string;
    /** Display string with enharmonic note name e.g. "C#/Db" or "A" */
    enharmonicName: string;
    /** MIDI note number (e.g. 69 for A4) */
    midiNote: number;
    /** Octave number (e.g. 4 for A4) */
    octave: number;
    /** Full Western note with octave e.g. "G4", "C#5" */
    fullWesternNote: string;
    /** Deviation in cents from closest note (-50 to +50) */
    cents: number;
    /** Categorized tuning status */
    status: TuningStatus;
    /** Human-readable status label e.g. "In Tune", "Slightly Flat" */
    statusLabel: string;
    /** Indian Swara information mapped relative to selected Sa */
    swara: SwaraInfo | null;
    /** YIN pitch detection confidence / clarity score (0 to 1) */
    clarity: number;
}

export type MicInputLevel = 'silent' | 'low' | 'medium' | 'strong';

export interface TunerSettingsState {
    a4Reference: number;         // default 440, range 430 - 450
    tunerMode: TunerMode;        // 'indian' | 'chromatic'
    selectedSa: RootNote;        // default 'C'
    inTuneToleranceCents: number; // default 5 (±5 cents)
}
