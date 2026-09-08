'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
    DetectedNote, 
    RootNote, 
    MicInputLevel, 
    TunerMode, 
    TunerSettingsState 
} from '../lib/audio/pitch/types';
import { detectPitchYin, calculateRms } from '../lib/audio/pitch/yin';
import { frequencyToNote } from '../lib/audio/pitch/noteUtils';
import { getSwaraFromNote } from '../lib/audio/pitch/swaraUtils';

export interface UsePitchDetectorOptions {
    initialSa?: RootNote;
    initialA4?: number;
    initialMode?: TunerMode;
}

export interface UsePitchDetectorReturn {
    isListening: boolean;
    detectedNote: DetectedNote | null;
    inputLevel: MicInputLevel;
    rawInputVolume: number; // 0 to 100
    error: string | null;
    settings: TunerSettingsState;
    start: () => Promise<void>;
    stop: () => void;
    setSelectedSa: (sa: RootNote) => void;
    setA4Reference: (a4: number) => void;
    setTunerMode: (mode: TunerMode) => void;
}

const DEFAULT_SA: RootNote = 'C';
const DEFAULT_A4 = 440;
const BUFFER_SIZE = 2048;
const MEDIAN_BUFFER_LEN = 5;

// Storage keys
const STORAGE_KEY_SA = 'kfa_flute_tuner_sa';
const STORAGE_KEY_A4 = 'kfa_flute_tuner_a4';
const STORAGE_KEY_MODE = 'kfa_flute_tuner_mode';

export function usePitchDetector(options: UsePitchDetectorOptions = {}): UsePitchDetectorReturn {
    // ── Persistent Settings ───────────────────────────────────────────────────
    const [selectedSa, setSelectedSaState] = useState<RootNote>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_SA);
            if (saved) return saved as RootNote;
        }
        return options.initialSa || DEFAULT_SA;
    });

    const [a4Reference, setA4ReferenceState] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_A4);
            if (saved) {
                const parsed = parseFloat(saved);
                if (!isNaN(parsed) && parsed >= 430 && parsed <= 450) return parsed;
            }
        }
        return options.initialA4 || DEFAULT_A4;
    });

    const [tunerMode, setTunerModeState] = useState<TunerMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_MODE);
            if (saved === 'chromatic' || saved === 'indian') return saved;
        }
        return options.initialMode || 'indian';
    });

    // ── Runtime Detection States ──────────────────────────────────────────────
    const [isListening, setIsListening] = useState(false);
    const [detectedNote, setDetectedNote] = useState<DetectedNote | null>(null);
    const [inputLevel, setInputLevel] = useState<MicInputLevel>('silent');
    const [rawInputVolume, setRawInputVolume] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    // Refs for real-time audio loop access
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const saRef = useRef(selectedSa);
    useEffect(() => { saRef.current = selectedSa; }, [selectedSa]);

    const a4Ref = useRef(a4Reference);
    useEffect(() => { a4Ref.current = a4Reference; }, [a4Reference]);

    // Stability & smoothing buffers
    const frequencyHistoryRef = useRef<number[]>([]);
    const lastValidNoteRef = useRef<DetectedNote | null>(null);
    const silenceFramesRef = useRef(0);

    const setSelectedSa = useCallback((sa: RootNote) => {
        setSelectedSaState(sa);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_SA, sa);
        }
        // Update current detected note swara immediately if playing
        setDetectedNote(prev => {
            if (!prev) return null;
            const updatedSwara = getSwaraFromNote(prev.noteName, prev.octave, sa);
            return { ...prev, swara: updatedSwara };
        });
    }, []);

    const setA4Reference = useCallback((a4: number) => {
        const clamped = Math.max(430, Math.min(450, a4));
        setA4ReferenceState(clamped);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_A4, String(clamped));
        }
    }, []);

    const setTunerMode = useCallback((mode: TunerMode) => {
        setTunerModeState(mode);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_MODE, mode);
        }
    }, []);

    /**
     * Median filter to eliminate transient acoustic glitches
     */
    const getMedianFrequency = (history: number[]): number => {
        if (history.length === 0) return 0;
        const sorted = [...history].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    };

    /**
     * Main pitch detection loop running on requestAnimationFrame
     */
    const updatePitch = useCallback(() => {
        const analyser = analyserRef.current;
        const ctx = audioContextRef.current;
        if (!analyser || !ctx) return;

        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        // 1. RMS Input Level Gate
        const rms = calculateRms(buffer);
        const volumePct = Math.min(100, Math.round(rms * 400));
        setRawInputVolume(volumePct);

        if (rms < 0.012) {
            setInputLevel('silent');
            silenceFramesRef.current += 1;

            // Allow short breathing pause (~15 frames / ~250ms) before clearing note display
            if (silenceFramesRef.current > 15) {
                frequencyHistoryRef.current = [];
                setDetectedNote(null);
                lastValidNoteRef.current = null;
            }
            rafIdRef.current = requestAnimationFrame(updatePitch);
            return;
        }

        silenceFramesRef.current = 0;
        if (rms < 0.05) {
            setInputLevel('low');
        } else if (rms < 0.16) {
            setInputLevel('medium');
        } else {
            setInputLevel('strong');
        }

        // 2. YIN Pitch Detection
        const yinResult = detectPitchYin(buffer, ctx.sampleRate, {
            threshold: 0.12,
            minFreq: 70,
            maxFreq: 2200,
            minRms: 0.012
        });

        if (yinResult && yinResult.frequency > 0) {
            const history = frequencyHistoryRef.current;
            history.push(yinResult.frequency);
            if (history.length > MEDIAN_BUFFER_LEN) {
                history.shift();
            }

            const smoothedFreq = getMedianFrequency(history);
            const currentA4 = a4Ref.current;
            const currentSa = saRef.current;

            const baseNote = frequencyToNote(smoothedFreq, currentA4, 5);
            if (baseNote) {
                const swara = getSwaraFromNote(baseNote.noteName, baseNote.octave, currentSa);
                const completeNote: DetectedNote = {
                    ...baseNote,
                    swara,
                    clarity: yinResult.clarity
                };

                lastValidNoteRef.current = completeNote;
                setDetectedNote(completeNote);
            }
        }

        rafIdRef.current = requestAnimationFrame(updatePitch);
    }, []);

    /**
     * Stops the microphone and cleans up all audio nodes.
     */
    const stop = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {
                    console.warn('Failed to stop media track:', e);
                }
            });
            streamRef.current = null;
        }

        if (audioContextRef.current) {
            try {
                if (audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close();
                }
            } catch (e) {
                console.warn('Failed to close AudioContext:', e);
            }
            audioContextRef.current = null;
        }

        analyserRef.current = null;
        frequencyHistoryRef.current = [];
        lastValidNoteRef.current = null;
        silenceFramesRef.current = 0;
        setIsListening(false);
        setInputLevel('silent');
        setRawInputVolume(0);
        setDetectedNote(null);
    }, []);

    /**
     * Starts the microphone and begins real-time pitch detection.
     * Must be called from a user gesture (e.g. button click).
     */
    const start = useCallback(async () => {
        stop();
        setError(null);

        // Check browser support
        if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setError('Microphone access is not supported on this browser. Please try Chrome, Safari, or Edge.');
            return;
        }

        try {
            // Audio constraints for monophonic acoustic flute capture
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    }
                });
            } catch (initialErr) {
                // Fallback to standard audio constraints if raw mode is rejected
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            streamRef.current = stream;

            // Initialize AudioContext
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const source = ctx.createMediaStreamSource(stream);

            // 1. High-Pass Filter at 80 Hz (cuts mic desk thumps, AC hum, sub-bass)
            const highPass = ctx.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.value = 80;

            // 2. Low-Pass Filter at 2400 Hz (attenuates high breath noise and hiss)
            const lowPass = ctx.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.value = 2400;

            // 3. Analyser Node
            const analyser = ctx.createAnalyser();
            analyser.fftSize = BUFFER_SIZE;
            analyser.smoothingTimeConstant = 0.0; // Raw time domain samples for YIN
            analyserRef.current = analyser;

            // Connect graph: Source -> HighPass -> LowPass -> Analyser
            source.connect(highPass);
            highPass.connect(lowPass);
            lowPass.connect(analyser);

            setIsListening(true);
            frequencyHistoryRef.current = [];
            silenceFramesRef.current = 0;

            // Begin RAF loop
            rafIdRef.current = requestAnimationFrame(updatePitch);
        } catch (err: any) {
            console.error('Error starting tuner microphone:', err);
            stop();
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Microphone access is required to use the tuner. Please allow microphone permission in your browser settings.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('No microphone found on this device. Please connect a microphone and try again.');
            } else {
                setError(err.message || 'Failed to start microphone. Please check browser permissions.');
            }
        }
    }, [stop, updatePitch]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    return {
        isListening,
        detectedNote,
        inputLevel,
        rawInputVolume,
        error,
        settings: {
            a4Reference,
            tunerMode,
            selectedSa,
            inTuneToleranceCents: 5
        },
        start,
        stop,
        setSelectedSa,
        setA4Reference,
        setTunerMode
    };
}
