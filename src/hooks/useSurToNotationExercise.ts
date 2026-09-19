'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RootNote } from '../lib/audio/pitch/types';
import { detectPitchYin, calculateRms } from '../lib/audio/pitch/yin';
import { frequencyToNote } from '../lib/audio/pitch/noteUtils';
import { 
    SUR_NOTATION_CONFIG, 
    LivePitchState, 
    ListeningStatus 
} from '../lib/audio/notation/types';
import { calculateSwaraFromMidi, getSaptakFromOffset } from '../lib/audio/notation/swaraMapping';
import { PitchStabilizer } from '../lib/audio/notation/pitchStabilizer';
import { 
    ExerciseStepState, 
    createInitialExerciseState, 
    evaluateExerciseStep,
    normalizeSur,
    EXERCISE_PRESETS
} from '../lib/audio/notation/exerciseValidation';

const STORAGE_KEY_SA = 'kfa_sur_to_notation_sa';
const DEFAULT_SA: RootNote = 'C';

export interface UseSurToNotationExerciseReturn {
    status: ListeningStatus;
    isListening: boolean;
    selectedSa: RootNote;
    sequence: string[];
    currentIndex: number;
    expectedNote: string;
    isComplete: boolean;
    feedback: ExerciseStepState['feedback'];
    livePitch: LivePitchState | null;
    error: string | null;
    start: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    restart: () => void;
    setSequence: (newSeq: string[]) => void;
    setSelectedSa: (sa: RootNote) => void;
}

export function useSurToNotationExercise(
    initialSequence: readonly string[] | string[] = EXERCISE_PRESETS[0].sequence,
    initialSa?: RootNote
): UseSurToNotationExerciseReturn {
    // ── Persistent Tonic Sa ───────────────────────────────────────────────────
    const [selectedSa, setSelectedSaState] = useState<RootNote>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_SA);
            if (saved) return saved as RootNote;
        }
        return initialSa || DEFAULT_SA;
    });

    const [status, setStatus] = useState<ListeningStatus>('idle');
    const [livePitch, setLivePitch] = useState<LivePitchState | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ── Core Exercise State ───────────────────────────────────────────────────
    const [exerciseState, setExerciseState] = useState<ExerciseStepState>(() => 
        createInitialExerciseState(initialSequence)
    );

    // ── Mutable Refs for Real-Time Audio Loop (Zero Stale Closures) ───────────
    const statusRef = useRef<ListeningStatus>('idle');
    useEffect(() => { statusRef.current = status; }, [status]);

    const saRef = useRef<RootNote>(selectedSa);
    useEffect(() => { saRef.current = selectedSa; }, [selectedSa]);

    const exerciseStateRef = useRef<ExerciseStepState>(exerciseState);
    useEffect(() => { exerciseStateRef.current = exerciseState; }, [exerciseState]);

    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const stabilizerRef = useRef<PitchStabilizer>(new PitchStabilizer());
    const lastUiUpdateMsRef = useRef<number>(0);
    const minFrameIntervalMs = 1000 / SUR_NOTATION_CONFIG.liveUiFps;

    // ── Change Sa ─────────────────────────────────────────────────────────────
    const setSelectedSa = useCallback((sa: RootNote) => {
        setSelectedSaState(sa);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_SA, sa);
        }
    }, []);

    // ── Change Sequence ───────────────────────────────────────────────────────
    const setSequence = useCallback((newSeq: string[]) => {
        const newState = createInitialExerciseState(newSeq);
        exerciseStateRef.current = newState;
        setExerciseState(newState);
    }, []);

    // ── Real-Time Audio Processing Loop ───────────────────────────────────────
    const updateLoop = useCallback(() => {
        if (statusRef.current !== 'listening') return;

        const analyser = analyserRef.current;
        const ctx = audioContextRef.current;
        if (!analyser || !ctx) return;

        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        const now = Date.now();
        const rms = calculateRms(buffer);
        const volumePct = Math.min(100, Math.round(rms * 400));

        // Pitch detection via YIN
        const yinResult = detectPitchYin(buffer, ctx.sampleRate, {
            threshold: 0.12,
            minFreq: 65,
            maxFreq: 2200,
            minRms: SUR_NOTATION_CONFIG.rmsGate
        });

        const rawFreq = yinResult?.frequency || 0;
        const clarity = yinResult?.clarity || 0;
        const isSilent = rms < SUR_NOTATION_CONFIG.rmsGate || rawFreq <= 0 || clarity < SUR_NOTATION_CONFIG.minClarity;

        // Process through pitch stabilizer for live candidate token
        const { candidateToken, smoothedFrequency } = 
            stabilizerRef.current.processFrame(rawFreq, rms, clarity, saRef.current, now);

        // Feed into canonical exercise state machine evaluator
        const currentState = exerciseStateRef.current;
        const nextState = evaluateExerciseStep(
            currentState,
            candidateToken,
            now,
            rms,
            isSilent,
            30 // ±30 cents canonical tolerance
        );

        // Synchronous ref update guarantees zero race conditions across rapid frame callbacks
        exerciseStateRef.current = nextState;

        // Update React state when visible progression or feedback changes
        if (
            nextState.currentIndex !== currentState.currentIndex ||
            nextState.isComplete !== currentState.isComplete ||
            nextState.feedback.status !== currentState.feedback.status ||
            nextState.feedback.message !== currentState.feedback.message ||
            nextState.isNoteLocked !== currentState.isNoteLocked
        ) {
            setExerciseState(nextState);
        }

        // Real-time live pitch visual update
        if (now - lastUiUpdateMsRef.current >= minFrameIntervalMs) {
            lastUiUpdateMsRef.current = now;

            if (candidateToken && smoothedFrequency > 0 && !isSilent) {
                const baseNote = frequencyToNote(smoothedFrequency, 440, 5);
                const { saptakLabel } = getSaptakFromOffset(candidateToken.octaveOffset);

                setLivePitch({
                    swara: candidateToken.baseSwara,
                    formattedSwara: candidateToken.formattedToken,
                    devanagari: candidateToken.devanagari,
                    swaraName: candidateToken.name,
                    saptakLabel,
                    westernNote: candidateToken.westernNote,
                    frequency: smoothedFrequency,
                    cents: candidateToken.cents,
                    tuningStatus: baseNote ? baseNote.status : 'in_tune',
                    confidence: nextState.feedback.status === 'correct' ? 'stable' : 'detecting',
                    inputVolume: volumePct
                });
            } else {
                setLivePitch(prev => prev ? {
                    ...prev,
                    confidence: 'silence',
                    inputVolume: volumePct
                } : null);
            }
        }

        rafIdRef.current = requestAnimationFrame(updateLoop);
    }, [minFrameIntervalMs]);

    // ── Teardown & Stop ───────────────────────────────────────────────────────
    const stopMicrophone = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {
                    console.warn('Failed to stop track:', e);
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
        stabilizerRef.current.reset();
        setStatus('idle');
        setLivePitch(null);
    }, []);

    // ── Pause ─────────────────────────────────────────────────────────────────
    const pause = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
            audioContextRef.current.suspend();
        }
        setStatus('paused');
    }, []);

    // ── Stop (Public) ─────────────────────────────────────────────────────────
    const stop = useCallback(() => {
        stopMicrophone();
    }, [stopMicrophone]);

    // ── Restart Exercise ──────────────────────────────────────────────────────
    const restart = useCallback(() => {
        const freshState = createInitialExerciseState(exerciseStateRef.current.sequence);
        exerciseStateRef.current = freshState;
        setExerciseState(freshState);
    }, []);

    // ── Start / Resume ────────────────────────────────────────────────────────
    const start = useCallback(async () => {
        setError(null);

        // If audio context is paused/suspended, resume immediately
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            setStatus('listening');
            rafIdRef.current = requestAnimationFrame(updateLoop);
            return;
        }

        // Clean up any lingering resources
        stopMicrophone();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false, // Critical: preserving pure flute harmonics
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            await audioCtx.resume();

            const source = audioCtx.createMediaStreamSource(stream);

            // Biquad High-Pass: cuts desk rumbles / breath thumps
            const highPass = audioCtx.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.value = SUR_NOTATION_CONFIG.highPassHz;

            // Biquad Low-Pass: cuts high-frequency hissing
            const lowPass = audioCtx.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.value = SUR_NOTATION_CONFIG.lowPassHz;

            // Analyser node
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = SUR_NOTATION_CONFIG.bufferSize;
            analyser.smoothingTimeConstant = 0.1;

            source.connect(highPass);
            highPass.connect(lowPass);
            lowPass.connect(analyser);

            streamRef.current = stream;
            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;

            setStatus('listening');
            rafIdRef.current = requestAnimationFrame(updateLoop);
        } catch (err: unknown) {
            const errorObj = err as { name?: string; message?: string };
            console.error('Error starting microphone for Sur to Notation Exercise:', err);
            if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
                setError('Microphone permission was denied. Please allow microphone access to practice.');
            } else {
                setError(`Microphone error: ${errorObj.message || 'Could not access audio device'}`);
            }
            setStatus('idle');
        }
    }, [updateLoop, stopMicrophone]);

    // Current expected note formatted display
    const rawExpected = exerciseState.sequence[exerciseState.currentIndex] || '';
    const normExpected = normalizeSur(rawExpected);
    const expectedNoteDisplay = normExpected ? normExpected.formattedToken : rawExpected;

    return {
        status,
        isListening: status === 'listening',
        selectedSa,
        sequence: exerciseState.sequence,
        currentIndex: exerciseState.currentIndex,
        expectedNote: expectedNoteDisplay,
        isComplete: exerciseState.isComplete,
        feedback: exerciseState.feedback,
        livePitch,
        error,
        start,
        pause,
        stop,
        restart,
        setSequence,
        setSelectedSa
    };
}
