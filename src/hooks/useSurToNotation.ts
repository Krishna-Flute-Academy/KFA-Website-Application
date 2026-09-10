'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RootNote } from '../lib/audio/pitch/types';
import { detectPitchYin, calculateRms } from '../lib/audio/pitch/yin';
import { frequencyToNote } from '../lib/audio/pitch/noteUtils';
import { 
    SUR_NOTATION_CONFIG, 
    SwaraNotationToken, 
    LivePitchState, 
    ListeningStatus 
} from '../lib/audio/notation/types';
import { calculateSwaraFromMidi, getSaptakFromOffset } from '../lib/audio/notation/swaraMapping';
import { PitchStabilizer } from '../lib/audio/notation/pitchStabilizer';

const STORAGE_KEY_SA = 'kfa_sur_to_notation_sa';
const DEFAULT_SA: RootNote = 'C';

export interface UseSurToNotationReturn {
    status: ListeningStatus;
    isListening: boolean;
    selectedSa: RootNote;
    livePitch: LivePitchState | null;
    notationText: string;
    tokens: SwaraNotationToken[];
    durationSeconds: number;
    error: string | null;
    start: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    clear: () => void;
    undoLastNote: () => void;
    setNotationText: (text: string) => void;
    setSelectedSa: (sa: RootNote) => void;
}

export function useSurToNotation(initialSa?: RootNote): UseSurToNotationReturn {
    // ── Persistent & Core State ───────────────────────────────────────────────
    const [selectedSa, setSelectedSaState] = useState<RootNote>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_SA);
            if (saved) return saved as RootNote;
        }
        return initialSa || DEFAULT_SA;
    });

    const [status, setStatus] = useState<ListeningStatus>('idle');
    const [livePitch, setLivePitch] = useState<LivePitchState | null>(null);
    const [notationText, setNotationText] = useState<string>('');
    const [tokens, setTokens] = useState<SwaraNotationToken[]>([]);
    const [durationSeconds, setDurationSeconds] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    // ── Refs for real-time audio loop ─────────────────────────────────────────
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const statusRef = useRef<ListeningStatus>('idle');
    useEffect(() => { statusRef.current = status; }, [status]);

    const saRef = useRef<RootNote>(selectedSa);
    useEffect(() => { saRef.current = selectedSa; }, [selectedSa]);

    const stabilizerRef = useRef<PitchStabilizer>(new PitchStabilizer());
    const lastUiUpdateMsRef = useRef<number>(0);
    const minFrameIntervalMs = 1000 / SUR_NOTATION_CONFIG.liveUiFps;

    // ── Session Timer ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'listening') return;
        const timerId = setInterval(() => {
            setDurationSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timerId);
    }, [status]);

    // ── Change Sa ─────────────────────────────────────────────────────────────
    const setSelectedSa = useCallback((sa: RootNote) => {
        setSelectedSaState(sa);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_SA, sa);
        }
        // Update live note display with new tonic if currently active
        setLivePitch(prev => {
            if (!prev) return null;
            const baseNote = frequencyToNote(prev.frequency, 440, 5);
            if (!baseNote) return prev;
            const updated = calculateSwaraFromMidi(
                baseNote.midiNote,
                sa,
                baseNote.fullWesternNote,
                prev.frequency,
                baseNote.cents
            );
            const { saptakLabel } = getSaptakFromOffset(updated.octaveOffset);
            return {
                ...prev,
                swara: updated.baseSwara,
                formattedSwara: updated.formattedToken,
                devanagari: updated.devanagari,
                swaraName: updated.name,
                saptakLabel
            };
        });
    }, []);

    // ── Audio Processing Loop ─────────────────────────────────────────────────
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

        // Detect pitch using YIN
        const yinResult = detectPitchYin(buffer, ctx.sampleRate, {
            threshold: 0.12,
            minFreq: 65,
            maxFreq: 2200,
            minRms: SUR_NOTATION_CONFIG.rmsGate
        });

        const rawFreq = yinResult?.frequency || 0;
        const clarity = yinResult?.clarity || 0;

        // Process through pitch stabilizer
        const { emittedToken, candidateToken, isStable, smoothedFrequency } = 
            stabilizerRef.current.processFrame(rawFreq, rms, clarity, saRef.current, now);

        // When a note event is finalized, append to notation immediately!
        if (emittedToken) {
            setTokens(prev => [...prev, emittedToken]);
            setNotationText(prev => {
                const trimmed = prev.trim();
                return trimmed ? `${trimmed} ${emittedToken.formattedToken}` : emittedToken.formattedToken;
            });
        }

        // Live UI pitch display updates
        if (now - lastUiUpdateMsRef.current >= minFrameIntervalMs || emittedToken) {
            lastUiUpdateMsRef.current = now;

            if (candidateToken && smoothedFrequency > 0 && rms >= SUR_NOTATION_CONFIG.rmsGate) {
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
                    confidence: isStable ? 'stable' : 'detecting',
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
    }, []);

    // ── Pause ─────────────────────────────────────────────────────────────────
    const pause = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        setStatus('paused');
        setLivePitch(null);
    }, []);

    // ── Stop ──────────────────────────────────────────────────────────────────
    const stop = useCallback(() => {
        stopMicrophone();
        setStatus('idle');
        setLivePitch(null);
    }, [stopMicrophone]);

    // ── Clear Notation ────────────────────────────────────────────────────────
    const clear = useCallback(() => {
        setNotationText('');
        setTokens([]);
        stabilizerRef.current.reset();
    }, []);

    // ── Undo Last Note ────────────────────────────────────────────────────────
    const undoLastNote = useCallback(() => {
        setTokens(prev => {
            if (prev.length === 0) return prev;
            const updated = prev.slice(0, prev.length - 1);
            setNotationText(updated.map(t => t.formattedToken).join(' '));
            return updated;
        });
    }, []);

    // ── Start Listening ───────────────────────────────────────────────────────
    const start = useCallback(async () => {
        setError(null);

        // If paused and AudioContext is still active, resume loop
        if (statusRef.current === 'paused' && audioContextRef.current && streamRef.current) {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            setStatus('listening');
            rafIdRef.current = requestAnimationFrame(updateLoop);
            return;
        }

        // Clean any existing connection
        stopMicrophone();

        if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setError('Microphone access is not supported on this browser. Please try Chrome, Safari, or Edge.');
            return;
        }

        try {
            // Audio constraints for acoustic flute capture
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
            } catch (rawErr) {
                // Fallback to standard audio constraints for older mobile browsers
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            streamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const source = ctx.createMediaStreamSource(stream);

            // 1. High-Pass Filter (80 Hz)
            const highPass = ctx.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.value = SUR_NOTATION_CONFIG.highPassHz;

            // 2. Low-Pass Filter (2400 Hz)
            const lowPass = ctx.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.value = SUR_NOTATION_CONFIG.lowPassHz;

            // 3. Analyser Node
            const analyser = ctx.createAnalyser();
            analyser.fftSize = SUR_NOTATION_CONFIG.bufferSize;
            analyser.smoothingTimeConstant = 0.0;
            analyserRef.current = analyser;

            // Graph: Source -> HighPass -> LowPass -> Analyser
            source.connect(highPass);
            highPass.connect(lowPass);
            lowPass.connect(analyser);

            stabilizerRef.current.reset();
            setStatus('listening');

            rafIdRef.current = requestAnimationFrame(updateLoop);
        } catch (err: any) {
            console.error('Error starting microphone for Sur to Notation:', err);
            stopMicrophone();
            setStatus('idle');
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Microphone permission was denied. Please allow microphone access in your browser settings to use Sur to Notation.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('No microphone found on your device. Please connect a microphone and try again.');
            } else {
                setError(err.message || 'Unable to access microphone. Please verify device permissions.');
            }
        }
    }, [stopMicrophone, updateLoop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopMicrophone();
        };
    }, [stopMicrophone]);

    return {
        status,
        isListening: status === 'listening',
        selectedSa,
        livePitch,
        notationText,
        tokens,
        durationSeconds,
        error,
        start,
        pause,
        stop,
        clear,
        undoLastNote,
        setNotationText,
        setSelectedSa
    };
}
