import { RootNote } from '../pitch/types';
import { frequencyToNote } from '../pitch/noteUtils';
import { SUR_NOTATION_CONFIG, SwaraNotationToken } from './types';
import { calculateSwaraFromMidi } from './swaraMapping';

export interface StabilizerCandidate {
    midiNote: number;
    frequency: number;
    cents: number;
    westernNote: string;
    firstSeenMs: number;
    lastSeenMs: number;
    consecutiveFrames: number;
    peakRms: number;
    isCommitted: boolean;
    dipDetected: boolean;
}

/**
 * Real-time Pitch Stabilizer and Low-Latency Note Transcriber.
 *
 * Designed for immediate responsiveness:
 * 1. Rolling 3-frame median filter: eliminates single-frame acoustic glitches without adding perceptual delay.
 * 2. Rapid confirmation: emits note after ~50ms (or 2 consecutive matching frames).
 * 3. Continuous hold rule: holding a single pitch emits exactly ONE token.
 * 4. Articulation / repeated notes: re-triggers repeated notes (e.g. S S S)
 *    when an acoustic volume dip (>25% drop) or brief silence gap (>=45ms) occurs.
 * 5. Instant note transitions: shifting from one pitch to another writes the new Swara immediately.
 */
export class PitchStabilizer {
    private frequencyBuffer: number[] = [];
    private currentCandidate: StabilizerCandidate | null = null;
    private lastSoundTimeMs: number = 0;
    private lastCommittedToken: SwaraNotationToken | null = null;

    /**
     * Resets all history, buffers, and active candidates.
     */
    public reset(): void {
        this.frequencyBuffer = [];
        this.currentCandidate = null;
        this.lastSoundTimeMs = 0;
        this.lastCommittedToken = null;
    }

    /**
     * Calculates rolling median of recently observed frequencies.
     */
    private getMedianFrequency(val: number): number {
        this.frequencyBuffer.push(val);
        if (this.frequencyBuffer.length > SUR_NOTATION_CONFIG.medianWindowSize) {
            this.frequencyBuffer.shift();
        }
        if (this.frequencyBuffer.length === 0) return 0;
        const sorted = [...this.frequencyBuffer].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    /**
     * Evaluates one audio frame.
     *
     * @returns A SwaraNotationToken as soon as note is verified (typically within ~50ms).
     */
    public processFrame(
        rawFrequency: number,
        rms: number,
        clarity: number,
        selectedSa: RootNote,
        nowMs: number = Date.now()
    ): {
        emittedToken: SwaraNotationToken | null;
        candidateToken: SwaraNotationToken | null;
        isStable: boolean;
        smoothedFrequency: number;
    } {
        // 1. RMS Silence & Breath Noise Gate
        const isSilent = rms < SUR_NOTATION_CONFIG.rmsGate || rawFrequency <= 0 || clarity < SUR_NOTATION_CONFIG.minClarity;
        
        if (isSilent) {
            const silenceElapsed = nowMs - this.lastSoundTimeMs;
            if (this.lastSoundTimeMs > 0 && silenceElapsed >= SUR_NOTATION_CONFIG.releaseDurationMs) {
                // Sufficient pause between notes -> clear active candidate so next attack writes immediately
                this.currentCandidate = null;
                this.frequencyBuffer = [];
            }
            return {
                emittedToken: null,
                candidateToken: null,
                isStable: false,
                smoothedFrequency: 0
            };
        }

        this.lastSoundTimeMs = nowMs;

        // 2. Fast Median Smoothing
        const smoothedFreq = this.getMedianFrequency(rawFrequency);
        if (smoothedFreq <= 0) {
            return {
                emittedToken: null,
                candidateToken: null,
                isStable: false,
                smoothedFrequency: 0
            };
        }

        // 3. Determine Western Note & MIDI
        const baseNote = frequencyToNote(smoothedFreq, 440, 5);
        if (!baseNote) {
            return {
                emittedToken: null,
                candidateToken: null,
                isStable: false,
                smoothedFrequency: smoothedFreq
            };
        }

        const token = calculateSwaraFromMidi(
            baseNote.midiNote,
            selectedSa,
            baseNote.fullWesternNote,
            smoothedFreq,
            baseNote.cents
        );

        let emittedToken: SwaraNotationToken | null = null;
        const candidate = this.currentCandidate;

        // 4. Candidate Tracking & Immediate Emission
        if (!candidate || candidate.midiNote !== baseNote.midiNote) {
            // A new pitch has begun! Start tracking immediately.
            this.currentCandidate = {
                midiNote: baseNote.midiNote,
                frequency: smoothedFreq,
                cents: baseNote.cents,
                westernNote: baseNote.fullWesternNote,
                firstSeenMs: nowMs,
                lastSeenMs: nowMs,
                consecutiveFrames: 1,
                peakRms: rms,
                isCommitted: false,
                dipDetected: false
            };
        } else {
            // Same pitch continuing
            candidate.lastSeenMs = nowMs;
            candidate.frequency = smoothedFreq;
            candidate.cents = baseNote.cents;
            candidate.westernNote = baseNote.fullWesternNote;
            candidate.consecutiveFrames += 1;

            if (rms > candidate.peakRms) {
                candidate.peakRms = rms;
            }

            // Check for articulation onset dip (repeated note detection while sustaining same pitch)
            if (candidate.isCommitted) {
                if (rms < candidate.peakRms * SUR_NOTATION_CONFIG.retriggerDropRatio) {
                    candidate.dipDetected = true;
                } else if (candidate.dipDetected && rms >= SUR_NOTATION_CONFIG.rmsGate * 1.5) {
                    // Attack detected after volume dip -> prime immediate re-trigger for repeated note
                    candidate.firstSeenMs = nowMs;
                    candidate.isCommitted = false;
                    candidate.dipDetected = false;
                    candidate.consecutiveFrames = 1;
                    candidate.peakRms = rms;
                }
            }

            // Fast emission: check if consecutive frame or duration threshold is satisfied
            const elapsed = nowMs - candidate.firstSeenMs;
            const meetsFrames = candidate.consecutiveFrames >= SUR_NOTATION_CONFIG.minConsecutiveFrames;
            const meetsDuration = elapsed >= SUR_NOTATION_CONFIG.stableDurationMs;

            if (!candidate.isCommitted && (meetsFrames || meetsDuration)) {
                candidate.isCommitted = true;
                this.lastCommittedToken = token;
                emittedToken = token;
            }
        }

        const isStable = !!(this.currentCandidate && this.currentCandidate.isCommitted);

        return {
            emittedToken,
            candidateToken: token,
            isStable,
            smoothedFrequency: smoothedFreq
        };
    }

    public getLastCommittedToken(): SwaraNotationToken | null {
        return this.lastCommittedToken;
    }
}
