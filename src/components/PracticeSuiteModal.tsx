'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Square, X, Sliders, Trash2, HelpCircle, Music, Compass, Minimize2, Maximize2 } from 'lucide-react';

// ── TANPURA CONSTANTS ───────────────────────────────────────────────────────
const SHRU_PITCHES = [
    { label: 'C (Kali 1)', freq: 261.63 },
    { label: 'C# (Kali 2)', freq: 277.18 },
    { label: 'D (Kali 3)', freq: 293.66 },
    { label: 'D# (Kali 4)', freq: 311.13 },
    { label: 'E (Kali 5)', freq: 329.63 },
    { label: 'F (Safed 4)', freq: 349.23 },
    { label: 'F# (Safed 5)', freq: 369.99 },
    { label: 'G (Safed 6)', freq: 392.00 },
    { label: 'G# (Safed 7)', freq: 415.30 },
    { label: 'A (Safed 1)', freq: 220.00 }, 
    { label: 'A# (Safed 2)', freq: 233.08 },
    { label: 'B (Safed 3)', freq: 246.94 },
];

const TUNING_MODES = [
    { id: 'Pa', label: 'Sa - Pa Drone', desc: 'Sa (Fundamental) + Pa (Perfect 5th)', mult: 1.5 },
    { id: 'Ma', label: 'Sa - Ma Drone', desc: 'Sa (Fundamental) + Ma (Perfect 4th)', mult: 1.3333 },
    { id: 'Ni', label: 'Sa - Ni Drone', desc: 'Sa (Fundamental) + Ni (Major 7th)', mult: 1.875 },
    { id: 'Sa', label: 'Sa - Sa Drone', desc: 'Sa (Fundamental) + Sa Octaves Only', mult: 2.0 }
];

interface ActiveTanpuraNode {
    osc1?: OscillatorNode;
    osc2?: OscillatorNode;
    source?: AudioBufferSourceNode;
    gainNode: GainNode;
}

// ── METRONOME CONSTANTS ─────────────────────────────────────────────────────
const METRONOME_PRESETS = [
    { name: 'Embouchure Long Tones', bpm: 40, beats: 4, icon: '𝄞', desc: 'Slow, sustained breath control' },
    { name: 'Scale Agility Ramp', bpm: 80, beats: 4, ramp: true, icon: '↗', desc: '80→140 BPM over 3 min' },
    { name: 'Articulation Check', bpm: 100, beats: 6, icon: '♩', desc: 'Complex beat patternsCheck' },
];

const METRONOME_SOUNDS = ['Woodblock', 'Tabla', 'Bell', 'Dholak', 'Flute Breath'];

// ── DRUMS CONSTANTS ─────────────────────────────────────────────────────────
interface GroupingOption {
    name: string;
    label: string;
    dividers: number[]; // step indices where vertical spacing is added BEFORE
}

interface TimeSignature {
    name: string;
    beats: number;
    stepsPerBeat: number;
    totalSteps: number;
    description: string;
    groupings: GroupingOption[];
}

const TIME_SIGNATURES: TimeSignature[] = [
    { 
        name: '4/4', 
        beats: 4, 
        stepsPerBeat: 4, 
        totalSteps: 16, 
        description: 'Common time (Rock, Pop, Funk)',
        groupings: [{ name: 'Standard', label: '4 + 4 + 4 + 4', dividers: [4, 8, 12] }]
    },
    { 
        name: '3/4', 
        beats: 3, 
        stepsPerBeat: 4, 
        totalSteps: 12, 
        description: 'Waltz time (3 beats per measure)',
        groupings: [{ name: 'Standard', label: '4 + 4 + 4', dividers: [4, 8] }]
    },
    { 
        name: '2/4', 
        beats: 2, 
        stepsPerBeat: 4, 
        totalSteps: 8, 
        description: 'March/Polka time (2 beats per measure)',
        groupings: [{ name: 'Standard', label: '4 + 4', dividers: [4] }]
    },
    { 
        name: '6/8', 
        beats: 2, 
        stepsPerBeat: 6, 
        totalSteps: 12, 
        description: 'Double triplet time (Swing, Latin)',
        groupings: [{ name: 'Standard', label: '6 + 6', dividers: [6] }]
    },
    { 
        name: '5/4', 
        beats: 5, 
        stepsPerBeat: 4, 
        totalSteps: 20, 
        description: 'Odd meter (Take Five, 5 beats)',
        groupings: [
            { name: '3+2', label: '3 + 2 Feel', dividers: [12] },
            { name: '2+3', label: '2 + 3 Feel', dividers: [8] }
        ]
    },
    { 
        name: '7/8', 
        beats: 7, 
        stepsPerBeat: 2, 
        totalSteps: 14, 
        description: 'Odd meter (7 beats, Indian classical style)',
        groupings: [
            { name: '3+2+2', label: '3 + 2 + 2 Feel (Rupak)', dividers: [6, 10] },
            { name: '2+2+3', label: '2 + 2 + 3 Feel', dividers: [4, 8] },
            { name: '2+3+2', label: '2 + 3 + 2 Feel', dividers: [4, 10] }
        ]
    }
];

interface DrumPreset {
    name: string;
    description: string;
    steps: number; 
    timeSigName: string;
    groupingName: string;
    grid: boolean[][]; // [4][steps]
}

const DRUM_PRESETS: DrumPreset[] = [
    {
        name: 'Rock Beat',
        description: 'Standard 4/4 rock and pop groove',
        steps: 16,
        timeSigName: '4/4',
        groupingName: 'Standard',
        grid: [
            [true, false, false, false, false, false, false, false, true, false, true, false, false, false, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Funk Groove',
        description: 'Syncopated funk beat with active shaker',
        steps: 16,
        timeSigName: '4/4',
        groupingName: 'Standard',
        grid: [
            [true, false, false, false, false, false, true, false, true, false, false, true, false, false, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true],
        ]
    },
    {
        name: 'Jazz Swing',
        description: 'Traditional swing ride pattern (6/8 rhythm)',
        steps: 12,
        timeSigName: '6/8',
        groupingName: 'Standard',
        grid: [
            [true, false, false, false, false, false, true, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, true, false],
            [true, false, true, true, false, true, true, false, true, true, false, true],
            [false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Waltz (3/4)',
        description: 'Classical 3/4 waltz rhythm (12 steps)',
        steps: 12,
        timeSigName: '3/4',
        groupingName: 'Standard',
        grid: [
            [true, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, true, false, false, false, true, false, false, false],
            [true, false, true, false, true, false, true, false, true, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Take Five (5/4)',
        description: 'Famous 5/4 jazz beat grouped as 3 + 2',
        steps: 20,
        timeSigName: '5/4',
        groupingName: '3+2',
        grid: [
            [true, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Rupak (7/8)',
        description: '7/8 classical groove grouped as 3 + 2 + 2',
        steps: 14,
        timeSigName: '7/8',
        groupingName: '3+2+2',
        grid: [
            [true, false, false, false, false, false, true, false, false, false, true, false, false, false],
            [false, false, false, false, false, false, false, false, true, false, false, false, true, false],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    }
];

const DRUM_TRACK_NAMES = ['Kick Drum', 'Snare Drum', 'Hi-hat', 'Shaker'];

// ── COMPONENT HELPER VIEWS ──────────────────────────────────────────────────
function Mandala({ angle, active }: { angle: number; active: boolean }) {
    const petals = 12;
    return (
        <svg viewBox="-120 -120 240 240" className="absolute inset-0 w-full h-full pointer-events-none">
            <g style={{ transform: `rotate(${angle}deg)`, transition: active ? 'transform 0.15s ease-out' : 'none', transformOrigin: 'center' }}>
                {Array.from({ length: petals }).map((_, i) => {
                    const a = (i / petals) * 360;
                    return (
                        <g key={i} style={{ transform: `rotate(${a}deg)`, transformOrigin: 'center' }}>
                            <ellipse cx="0" cy="-75" rx="6" ry="18" fill="none" stroke="#d46211" strokeWidth="1.2" opacity="0.7" />
                            <ellipse cx="0" cy="-52" rx="3" ry="9" fill="#d46211" opacity="0.25" />
                            <circle cx="0" cy="-95" r="2.5" fill="#d46211" opacity="0.6" />
                        </g>
                    );
                })}
                {[45, 62, 80, 100].map((r, i) => (
                    <circle key={i} cx="0" cy="0" r={r} fill="none" stroke="#d46211" strokeWidth="0.5" opacity={0.15 + i * 0.05} strokeDasharray={i % 2 === 0 ? '4 4' : 'none'} />
                ))}
            </g>
        </svg>
    );
}

function Ripple({ id }: { id: number }) {
    return (
        <span key={id} className="absolute inset-0 rounded-full border-2 border-[#d46211] animate-ping opacity-0"
            style={{ animationDuration: '0.8s', animationTimingFunction: 'ease-out' }} />
    );
}

export default function PracticeSuiteModal({ onClose, defaultTab = 'metronome' }: { onClose: () => void; defaultTab?: 'metronome' | 'tanpura' | 'drums' }) {
    // ── GENERAL STATES ──────────────────────────────────────────────────────
    const [activeTool, setActiveTool] = useState<'metronome' | 'tanpura' | 'drums'>(() => {
        if (defaultTab === 'drums') return 'drums';
        if (defaultTab === 'tanpura') return 'tanpura';
        return 'metronome';
    });
    const activeRhythmTab = activeTool === 'drums' ? 'drums' : 'metronome';
    const [isMinimized, setIsMinimized] = useState(false);
    const [bpm, setBpm] = useState(105);
    
    // Shared AudioContext
    const audioCtxRef = useRef<AudioContext | null>(null);
    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    // ── TANPURA STATES ──────────────────────────────────────────────────────
    const [selectedPitch, setSelectedPitch] = useState(SHRU_PITCHES[1]); // Default C#
    const [selectedTuningMode, setSelectedTuningMode] = useState(TUNING_MODES[0]);
    const [isTanpuraPlaying, setIsTanpuraPlaying] = useState(false);
    const [tanpuraVolume, setTanpuraVolume] = useState(0.5);
    const activeTanpuraNodesRef = useRef<ActiveTanpuraNode[]>([]);
    const tanpuraBufferRef = useRef<AudioBuffer | null>(null);

    // Pre-load Tanpura Audio (decode without creating a persistent AudioContext)
    useEffect(() => {
        const loadTanpura = async () => {
            try {
                const response = await fetch('/sounds/tanpura/Tanpura_c.mp3');
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('text/html')) {
                        console.error('Tanpura file not found — server returned HTML instead of audio.');
                        return;
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    // Use a temporary offline context just for decoding — no autoplay issues
                    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    tanpuraBufferRef.current = await tempCtx.decodeAudioData(arrayBuffer);
                    await tempCtx.close(); // Immediately close — we only needed it for decoding
                    console.log('✅ Tanpura audio decoded and ready.');
                } else {
                    console.error('❌ Failed to fetch Tanpura file. HTTP Status:', response.status);
                }
            } catch (e) {
                console.error('❌ Error decoding Tanpura audio:', e);
            }
        };
        loadTanpura();
    }, []);
    
    const tanpuraVolumeRef = useRef(tanpuraVolume);
    useEffect(() => { tanpuraVolumeRef.current = tanpuraVolume; }, [tanpuraVolume]);

    // ── METRONOME STATES ────────────────────────────────────────────────────
    const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
    const [metronomeVolume, setMetronomeVolume] = useState(0.65);
    const [metronomeBeats, setMetronomeBeats] = useState(4);
    const [currentMetronomeBeat, setCurrentMetronomeBeat] = useState(-1);
    const [metronomeSubdivisions, setMetronomeSubdivisions] = useState<number[]>([1, 1, 1, 1]);
    const [metronomeRipples, setMetronomeRipples] = useState<number[]>([]);
    const [tapTimes, setTapTimes] = useState<number[]>([]);
    const [selectedMetronomeSound, setSelectedMetronomeSound] = useState('Woodblock');
    const [isMetronomeRampMode, setIsMetronomeRampMode] = useState(false);
    const [mandalaAngle, setMandalaAngle] = useState(0);

    const metronomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const metronomeBeatRef = useRef(0);
    const metronomeBpmRef = useRef(bpm);
    const metronomeVolumeRef = useRef(metronomeVolume);
    const metronomeSoundRef = useRef(selectedMetronomeSound);
    const metronomeBeatsRef = useRef(metronomeBeats);
    const metronomeRampStartRef = useRef<{ bpm: number; time: number } | null>(null);
    const metronomeIsDragging = useRef(false);
    const metronomeLastY = useRef(0);

    // Sync metronome refs
    useEffect(() => { metronomeBpmRef.current = bpm; }, [bpm]);
    useEffect(() => { metronomeVolumeRef.current = metronomeVolume; }, [metronomeVolume]);
    useEffect(() => { metronomeSoundRef.current = selectedMetronomeSound; }, [selectedMetronomeSound]);
    useEffect(() => { metronomeBeatsRef.current = metronomeBeats; }, [metronomeBeats]);

    // ── DRUMS STATES ────────────────────────────────────────────────────────
    const [isDrumsPlaying, setIsDrumsPlaying] = useState(false);
    const [drumsVolume, setDrumsVolume] = useState(0.6);
    const [currentDrumsStep, setCurrentDrumsStep] = useState(-1);
    const [selectedDrumsTimeSig, setSelectedDrumsTimeSig] = useState<TimeSignature>(TIME_SIGNATURES[0]);
    const [selectedDrumsGrouping, setSelectedDrumsGrouping] = useState<GroupingOption>(TIME_SIGNATURES[0].groupings[0]);
    const [selectedDrumsPresetName, setSelectedDrumsPresetName] = useState(DRUM_PRESETS[0].name);
    
    const [drumsGrid, setDrumsGrid] = useState<boolean[][]>(() => {
        const initialGrid = Array.from({ length: 4 }, () => Array(24).fill(false));
        const presetGrid = DRUM_PRESETS[0].grid;
        for (let track = 0; track < 4; track++) {
            for (let step = 0; step < DRUM_PRESETS[0].steps; step++) {
                initialGrid[track][step] = presetGrid[track][step] || false;
            }
        }
        return initialGrid;
    });
    const [drumsActiveStepsCount, setDrumsActiveStepsCount] = useState(DRUM_PRESETS[0].steps);

    const drumsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const drumsStepRef = useRef(0);
    const drumsBpmRef = useRef(bpm);
    const drumsVolumeRef = useRef(drumsVolume);
    const drumsGridRef = useRef(drumsGrid);
    const drumsStepsCountRef = useRef(drumsActiveStepsCount);
    const isDrumsPlayingRef = useRef(isDrumsPlaying);

    // Sync drums refs
    useEffect(() => { drumsBpmRef.current = bpm; }, [bpm]);
    useEffect(() => { drumsVolumeRef.current = drumsVolume; }, [drumsVolume]);
    useEffect(() => { drumsGridRef.current = drumsGrid; }, [drumsGrid]);
    useEffect(() => { drumsStepsCountRef.current = drumsActiveStepsCount; }, [drumsActiveStepsCount]);
    useEffect(() => { isDrumsPlayingRef.current = isDrumsPlaying; }, [isDrumsPlaying]);

    // ── SHARED AUDIO UTILS ──────────────────────────────────────────────────
    const createNoiseBuffer = (ctx: AudioContext, duration: number): AudioBuffer => {
        const sampleRate = ctx.sampleRate;
        const bufferSize = Math.max(sampleRate * duration, 1);
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    };

    const playNoise = (
        ctx: AudioContext, 
        filterType: BiquadFilterType, 
        filterFreq: number, 
        Q: number, 
        vol: number, 
        duration: number, 
        now: number
    ) => {
        try {
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = createNoiseBuffer(ctx, duration);

            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = filterType;
            noiseFilter.frequency.value = filterFreq;
            noiseFilter.Q.value = Q;

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0, now);
            noiseGain.gain.linearRampToValueAtTime(vol, now + 0.002);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            noiseSource.start(now);
            noiseSource.stop(now + duration + 0.05);
        } catch (_) {}
    };

    // ── TANPURA AUDIO ENGINES ───────────────────────────────────────────────
    
    const startTanpuraNode = useCallback((ctx: AudioContext, freq: number, mixVolume: number): ActiveTanpuraNode => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'triangle';
        osc1.frequency.value = freq;

        osc2.type = 'sawtooth';
        osc2.frequency.value = freq + 0.35; // detune chorus

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.22;

        filter.type = 'lowpass';
        filter.frequency.value = freq * 3.5;

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(tanpuraVolumeRef.current * mixVolume * 0.22, ctx.currentTime + 0.25);

        osc1.connect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();

        return { osc1, osc2, gainNode };
    }, []);

    // ── CROSSFADE LOOP ENGINE ────────────────────────────────────────────────
    // Instead of source.loop (causes click at boundary), we schedule overlapping
    // copies of the buffer with gain envelopes that cross-fade seamlessly.
    const droneActiveRef = useRef(false);
    const droneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const droneNodesRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode }[]>([]);

    const stopTanpuraNodes = useCallback(() => {
        droneActiveRef.current = false;
        if (droneTimerRef.current) { clearTimeout(droneTimerRef.current); droneTimerRef.current = null; }
        const ctx = audioCtxRef.current;
        droneNodesRef.current.forEach(({ src, gain }) => {
            try {
                if (ctx) {
                    gain.gain.cancelScheduledValues(ctx.currentTime);
                    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
                }
                setTimeout(() => { try { src.stop(); } catch (_) {} }, 900);
            } catch (_) {}
        });
        droneNodesRef.current = [];
        activeTanpuraNodesRef.current = []; // keep compat with synth fallback
    }, []);

    // Schedule one buffer chunk starting at `startTime`, then queue the next.
    const scheduleDroneChunk = useCallback((
        ctx: AudioContext,
        buffer: AudioBuffer,
        pitchRatio: number,
        volume: number,
        startTime: number
    ) => {
        if (!droneActiveRef.current) return;

        const CROSSFADE = Math.min(3.0, buffer.duration * 0.12); // 12% or 3 s max
        const dur = buffer.duration / pitchRatio; // real-time duration after pitch shift

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = pitchRatio;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + CROSSFADE);   // fade in
        gain.gain.setValueAtTime(volume, startTime + dur - CROSSFADE);      // hold
        gain.gain.linearRampToValueAtTime(0, startTime + dur);              // fade out

        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(startTime);
        src.stop(startTime + dur + 0.05);

        droneNodesRef.current.push({ src, gain });
        // Keep the list small — remove entries that have already stopped
        if (droneNodesRef.current.length > 6) droneNodesRef.current.shift();

        // Schedule the NEXT chunk so it starts exactly CROSSFADE seconds before this one ends
        const nextStart = startTime + dur - CROSSFADE;
        const msUntilSchedule = Math.max(0, (nextStart - ctx.currentTime - 0.3) * 1000);

        droneTimerRef.current = setTimeout(() => {
            scheduleDroneChunk(ctx, buffer, pitchRatio, volume, nextStart);
        }, msUntilSchedule);
    }, []);

    // pitchOverride lets us pass the NEW pitch directly from a click handler,
    // bypassing the React stale-closure problem with selectedPitch state.
    const startTanpura = useCallback(async (pitchOverride?: typeof SHRU_PITCHES[0]) => {
        try {
            const ctx = getCtx();
            if (ctx.state !== 'running') await ctx.resume();

            const pitch = pitchOverride ?? selectedPitch;

            if (tanpuraBufferRef.current) {
                droneActiveRef.current = true;
                const pitchRatio = pitch.freq / 261.63;
                const volume = tanpuraVolumeRef.current * 0.85;
                scheduleDroneChunk(ctx, tanpuraBufferRef.current, pitchRatio, volume, ctx.currentTime);
                console.log('▶ Tanpura crossfade loop | key:', pitch.label, '| ratio:', pitchRatio.toFixed(3));
            } else {
                console.warn('⚠ No audio buffer — falling back to synthesizer');
                const baseFreq = pitch.freq;
                const mode = selectedTuningMode;
                const frequencies = [baseFreq * 0.5, baseFreq, baseFreq * mode.mult, baseFreq * 2.0];
                const mixVolumes = [1.0, 0.8, 0.75, 0.45];
                const nodes = frequencies.map((freq, idx) => startTanpuraNode(ctx, freq, mixVolumes[idx]));
                activeTanpuraNodesRef.current = nodes;
            }
        } catch (err) {
            console.error('Failed to start Tanpura:', err);
        }
    }, [selectedPitch, selectedTuningMode, startTanpuraNode, scheduleDroneChunk]);

    // Handle Tanpura Volume Real-Time Adjustments
    useEffect(() => {
        const ctx = audioCtxRef.current;
        if (!ctx || activeTanpuraNodesRef.current.length === 0) return;
        
        if (tanpuraBufferRef.current) {
             const node = activeTanpuraNodesRef.current[0];
             if (node && node.gainNode) {
                 node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, ctx.currentTime);
                 node.gainNode.gain.linearRampToValueAtTime(tanpuraVolume * 0.8, ctx.currentTime + 0.1);
             }
        } else {
             const mixVolumes = [1.0, 0.8, 0.75, 0.45];
             activeTanpuraNodesRef.current.forEach((node, idx) => {
                 try {
                     const targetGain = tanpuraVolume * mixVolumes[idx] * 0.22;
                     node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, ctx.currentTime);
                     node.gainNode.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.1);
                 } catch (_) {}
             });
        }
    }, [tanpuraVolume]);

    // NOTE: Tanpura is now controlled DIRECTLY from button clicks, not via useEffect.
    // This avoids React cleanup-cycle races that were silencing the audio.


    // ── METRONOME AUDIO ENGINES ─────────────────────────────────────────────

    const playMetronomeTick = useCallback((down: boolean) => {
        try {
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            const freqMap: Record<string, [number, number]> = {
                Woodblock: [880, 660], Tabla: [220, 165], Bell: [1200, 900],
                Dholak: [180, 140], 'Flute Breath': [600, 450],
            };
            const [hf, lf] = freqMap[metronomeSoundRef.current] || [880, 660];
            osc.frequency.value = down ? hf : lf;
            osc.type = metronomeSoundRef.current === 'Bell' ? 'sine' : 'triangle';
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime((down ? 0.35 : 0.18) * metronomeVolumeRef.current, ctx.currentTime + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch (_) {}
    }, []);

    const metronomeTick = useCallback(() => {
        const beat = metronomeBeatRef.current;
        const total = metronomeBeatsRef.current;
        playMetronomeTick(beat === 0);
        setCurrentMetronomeBeat(beat);
        setMandalaAngle(prev => prev + 360 / total);
        setMetronomeRipples(prev => [...prev.slice(-2), Date.now()]);
        metronomeBeatRef.current = (beat + 1) % total;

        let nextBpm = metronomeBpmRef.current;
        if (isMetronomeRampMode && metronomeRampStartRef.current) {
            const elapsed = (Date.now() - metronomeRampStartRef.current.time) / 1000;
            nextBpm = Math.min(140, metronomeRampStartRef.current.bpm + (elapsed / 180) * 60);
            setBpm(Math.round(nextBpm));
        }
        metronomeTimerRef.current = setTimeout(metronomeTick, (60 / nextBpm) * 1000);
    }, [playMetronomeTick, isMetronomeRampMode]);

    // Handle Metronome Play state changes
    useEffect(() => {
        if (isMetronomePlaying) {
            // Stop Drums if playing
            setIsDrumsPlaying(false);

            metronomeBeatRef.current = 0;
            if (isMetronomeRampMode) metronomeRampStartRef.current = { bpm, time: Date.now() };
            metronomeTick();
        } else {
            if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current);
            setCurrentMetronomeBeat(-1);
        }
        return () => { if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current); };
    }, [isMetronomePlaying, metronomeTick]); // eslint-disable-line


    // ── DRUMS AUDIO ENGINES ─────────────────────────────────────────────────

    const playDrumKick = useCallback((ctx: AudioContext, vol: number, now: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.14);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol * 0.95, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    }, []);

    const playDrumSnare = useCallback((ctx: AudioContext, vol: number, now: number) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(vol * 0.35, now + 0.005);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx, 0.18);

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1100;
        noiseFilter.Q.value = 1.8;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(vol * 0.65, now + 0.008);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
        noiseSource.start(now);
        noiseSource.stop(now + 0.22);
    }, []);

    const playDrumHihat = useCallback((ctx: AudioContext, vol: number, now: number) => {
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx, 0.06);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8500;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol * 0.42, now + 0.002);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        noiseSource.start(now);
        noiseSource.stop(now + 0.07);
    }, []);

    const playDrumShaker = useCallback((ctx: AudioContext, vol: number, now: number) => {
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer(ctx, 0.08);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 5500;
        filter.Q.value = 2.2;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol * 0.35, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        noiseSource.start(now);
        noiseSource.stop(now + 0.09);
    }, []);

    const drumsTick = useCallback(() => {
        if (!isDrumsPlayingRef.current) return;

        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const step = drumsStepRef.current;
        const vol = drumsVolumeRef.current;
        const currentGrid = drumsGridRef.current;
        const maxSteps = drumsStepsCountRef.current;
        const now = ctx.currentTime;

        if (currentGrid[0][step]) playDrumKick(ctx, vol, now);
        if (currentGrid[1][step]) playDrumSnare(ctx, vol, now);
        if (currentGrid[2][step]) playDrumHihat(ctx, vol, now);
        if (currentGrid[3][step]) playDrumShaker(ctx, vol, now);

        setCurrentDrumsStep(step);

        drumsStepRef.current = (step + 1) % maxSteps;

        const interval = ((60 / drumsBpmRef.current) / 4) * 1000;
        drumsTimerRef.current = setTimeout(drumsTick, interval);
    }, [playDrumKick, playDrumSnare, playDrumHihat, playDrumShaker]);

    // Handle Drums Play state changes
    useEffect(() => {
        if (isDrumsPlaying) {
            // Stop Metronome if playing
            setIsMetronomePlaying(false);

            drumsStepRef.current = 0;
            drumsTick();
        } else {
            if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
            setCurrentDrumsStep(-1);
        }
        return () => { if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current); };
    }, [isDrumsPlaying, drumsTick]); // eslint-disable-line


    // ── INTERACTIONS ────────────────────────────────────────────────────────
    
    // Tap Tempo
    const handleTapTempo = () => {
        const now = Date.now();
        const taps = [...tapTimes.slice(-7), now];
        setTapTimes(taps);
        if (taps.length > 1) {
            const avg = taps.slice(1).reduce((s, t, i) => s + t - taps[i], 0) / (taps.length - 1);
            setBpm(Math.max(20, Math.min(240, Math.round(60000 / avg))));
        }
    };

    // Rotary Knob drag for BPM (Metronome)
    const onKnobDown = (e: React.MouseEvent | React.TouchEvent) => {
        metronomeIsDragging.current = true;
        metronomeLastY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    };
    
    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!metronomeIsDragging.current) return;
        const y = e.clientY;
        const delta = metronomeLastY.current - y;
        metronomeLastY.current = y;
        setBpm(p => Math.max(20, Math.min(240, p + delta)));
    }, []);

    const onMouseUp = useCallback(() => { metronomeIsDragging.current = false; }, []);

    useEffect(() => {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
    }, [onMouseMove, onMouseUp]);

    // Preset loading (Metronome)
    const loadMetronomePreset = (p: typeof METRONOME_PRESETS[0]) => {
        setBpm(p.bpm); 
        setMetronomeBeats(p.beats);
        setMetronomeSubdivisions(Array(p.beats).fill(1));
        setIsMetronomeRampMode(!!p.ramp);
        setIsMetronomePlaying(false);
    };

    // Preset loading (Drums)
    const loadDrumsPreset = (preset: DrumPreset) => {
        setSelectedDrumsPresetName(preset.name);
        
        const sig = TIME_SIGNATURES.find(s => s.name === preset.timeSigName) || TIME_SIGNATURES[0];
        setSelectedDrumsTimeSig(sig);
        setDrumsActiveStepsCount(sig.totalSteps);

        const grouping = sig.groupings.find(g => g.name === preset.groupingName) || sig.groupings[0];
        setSelectedDrumsGrouping(grouping);

        const newGrid = Array.from({ length: 4 }, () => Array(24).fill(false));
        for (let track = 0; track < 4; track++) {
            for (let step = 0; step < preset.steps; step++) {
                newGrid[track][step] = preset.grid[track][step] || false;
            }
        }
        setDrumsGrid(newGrid);
        
        drumsStepRef.current = 0;
        if (isDrumsPlaying) {
            if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
            drumsTick();
        } else {
            setCurrentDrumsStep(-1);
        }
    };

    // Time Sig selection (Drums)
    const handleDrumsTimeSigChange = (sig: TimeSignature) => {
        setSelectedDrumsTimeSig(sig);
        setSelectedDrumsGrouping(sig.groupings[0]);
        setDrumsActiveStepsCount(sig.totalSteps);
        setSelectedDrumsPresetName('Custom Beat');

        drumsStepRef.current = 0;
        if (isDrumsPlaying) {
            if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
            drumsTick();
        } else {
            setCurrentDrumsStep(-1);
        }
    };

    // Grid toggle single node (Drums)
    const handleToggleDrumsNode = (trackIdx: number, stepIdx: number) => {
        setDrumsGrid(prev => {
            const next = prev.map(row => [...row]);
            next[trackIdx][stepIdx] = !next[trackIdx][stepIdx];
            return next;
        });
        setSelectedDrumsPresetName('Custom Beat');
    };

    const handleClearGrid = () => {
        setDrumsGrid(Array.from({ length: 4 }, () => Array(24).fill(false)));
        setSelectedDrumsPresetName('Custom Beat');
    };

    // Close Handler
    const handleClose = () => {
        setIsTanpuraPlaying(false);
        setIsMetronomePlaying(false);
        setIsDrumsPlaying(false);
        stopTanpuraNodes();
        if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current);
        if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
        onClose();
    };

    const knobDeg = ((bpm - 20) / 220) * 270 - 135;

    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-[100] w-[360px] bg-gradient-to-br from-[#0c0f12] via-[#141b22] to-[#080b0d] rounded-2xl border border-[#d46211]/30 shadow-2xl p-5 flex flex-col gap-4 text-white text-left font-sans select-none" style={{ fontFamily: 'Lexend, sans-serif' }}>
                
                {/* Minimized Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#d46211]/10">
                    <div className="flex items-center gap-2">
                        <Compass className="w-5 h-5 text-[#d46211]" />
                        <span className="font-extrabold text-sm tracking-tight">
                            {activeTool === 'tanpura' ? 'KFA Tanpura' : activeTool === 'metronome' ? 'KFA Metronome' : 'KFA Drum Beats'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsMinimized(false)} 
                            title="Expand to Fullscreen"
                            className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:border-white/20 transition-all"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleClose} 
                            title="Close"
                            className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:border-[#d46211]/50 transition-all hover:bg-red-500/10 hover:text-red-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 1. Tanpura Section */}
                {activeTool === 'tanpura' && (
                    <div className="flex flex-col gap-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-[#d46211] uppercase tracking-wider flex items-center gap-1.5">
                                <Music className="w-4 h-4" /> Tanpura
                            </span>
                            <span className="text-xs font-bold text-white/55 bg-white/5 border border-white/5 px-2 py-0.5 rounded-md uppercase tracking-wider">{selectedPitch.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsTanpuraPlaying(!isTanpuraPlaying)}
                                className={`h-10 px-4 rounded-lg font-bold text-xs tracking-wide uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                                    isTanpuraPlaying 
                                        ? 'bg-[#d46211]/15 border border-[#d46211]/30 text-[#d46211] hover:bg-[#d46211]/25' 
                                        : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {isTanpuraPlaying ? (
                                    <><Square className="w-3.5 h-3.5 fill-[#d46211]" /> Stop</>
                                ) : (
                                    <><Play className="w-3.5 h-3.5 fill-white/70" /> Play</>
                                )}
                            </button>
                            
                            <div className="flex-1 flex flex-col gap-1">
                                <span className="text-xs text-white/70 font-semibold truncate leading-none">{selectedTuningMode.label}</span>
                                <div className="flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-white/40" />
                                    <input 
                                        type="range" min="0" max="1.0" step="0.05" value={tanpuraVolume}
                                        onChange={(e) => setTanpuraVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Metronome Section */}
                {activeTool === 'metronome' && (
                    <div className="flex flex-col gap-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#d46211] uppercase tracking-wider flex items-center gap-1.5">
                                <Volume2 className="w-4 h-4" /> Metronome
                            </span>
                            <span className="text-xs font-bold text-white/55 bg-white/5 border border-white/5 px-2 py-0.5 rounded-md uppercase tracking-wider">{bpm} BPM</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => {
                                    getCtx().resume();
                                    setIsMetronomePlaying(!isMetronomePlaying);
                                }}
                                className={`h-10 px-4 rounded-lg font-bold text-xs tracking-wide uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                                    isMetronomePlaying 
                                        ? 'bg-[#d46211]/15 border border-[#d46211]/30 text-[#d46211] hover:bg-[#d46211]/25' 
                                        : 'bg-[#d46211] text-white hover:bg-[#c05510]'
                                }`}
                            >
                                {isMetronomePlaying ? (
                                    <><Square className="w-3.5 h-3.5 fill-[#d46211]" /> Stop</>
                                ) : (
                                    <><Play className="w-3.5 h-3.5 fill-white" /> Play</>
                                )}
                            </button>
                            
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <button onClick={() => setBpm(b => Math.max(20, Math.min(240, b - 1)))} className="w-6 h-6 rounded-full border border-white/15 text-white/60 hover:bg-white/5 flex items-center justify-center font-bold text-xs">-</button>
                                    <span className="text-xs font-mono text-white/80 font-bold">{bpm} BPM</span>
                                    <button onClick={() => setBpm(b => Math.max(20, Math.min(240, b + 1)))} className="w-6 h-6 rounded-full border border-white/15 text-white/60 hover:bg-white/5 flex items-center justify-center font-bold text-xs">+</button>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Volume2 className="w-4 h-4 text-white/40" />
                                    <input 
                                        type="range" min="0" max="1.0" step="0.05" value={metronomeVolume}
                                        onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Drum Beats Section */}
                {activeTool === 'drums' && (
                    <div className="flex flex-col gap-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#d46211] uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm font-bold">album</span> Drums
                            </span>
                            <span className="text-xs font-bold text-white/55 bg-white/5 border border-white/5 px-2 py-0.5 rounded-md uppercase tracking-wider">{selectedDrumsPresetName}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsDrumsPlaying(!isDrumsPlaying)}
                                className={`h-10 px-4 rounded-lg font-bold text-xs tracking-wide uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                                    isDrumsPlaying 
                                        ? 'bg-[#d46211]/15 border border-[#d46211]/30 text-[#d46211] hover:bg-[#d46211]/25' 
                                        : 'bg-[#d46211] text-white hover:bg-[#c05510]'
                                }`}
                            >
                                {isDrumsPlaying ? (
                                    <><Square className="w-3.5 h-3.5 fill-[#d46211]" /> Stop</>
                                ) : (
                                    <><Play className="w-3.5 h-3.5 fill-white" /> Play</>
                                )}
                            </button>
                            
                            <div className="flex-1 flex flex-col gap-1">
                                <span className="text-xs text-white/70 font-semibold truncate leading-none">{selectedDrumsTimeSig.name} Time Sig</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <Volume2 className="w-4 h-4 text-white/40" />
                                    <input 
                                        type="range" min="0" max="1.0" step="0.05" value={drumsVolume}
                                        onChange={(e) => setDrumsVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg" onClick={e => e.target === e.currentTarget && handleClose()}>
            <div className={`relative w-full bg-gradient-to-br from-[#0c0f12] via-[#141b22] to-[#080b0d] rounded-3xl border border-[#d46211]/25 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
                activeTool === 'tanpura' ? 'max-w-md h-auto my-auto' : activeTool === 'metronome' ? 'max-w-2xl h-auto my-auto' : 'max-w-5xl h-auto my-auto'
            }`}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-5 pb-4 border-b border-[#d46211]/10 bg-slate-900/40">
                    <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-[#d46211] border border-[#d46211]/20">
                            {activeTool === 'tanpura' ? (
                                <Music className="w-5 h-5" />
                            ) : activeTool === 'metronome' ? (
                                <Volume2 className="w-5 h-5" />
                            ) : (
                                <span className="material-symbols-outlined text-xl font-bold">album</span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-white font-black text-sm md:text-base tracking-tight">
                                {activeTool === 'tanpura' ? 'Tanpura Drone' : activeTool === 'metronome' ? 'Practice Metronome' : 'Drum Beats Sequencer'}
                            </h2>
                            <p className="text-[#d46211]/60 text-xs md:text-sm">
                                {activeTool === 'tanpura' 
                                    ? 'Indian classical tuning & shruti drone' 
                                    : activeTool === 'metronome' 
                                        ? 'Keep perfect time with speed adjustments' 
                                        : 'Interactive step sequencer for flute play-along grooves'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsMinimized(true)} 
                            title="Minimize to floating window" 
                            className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleClose} 
                            title="Close" 
                            className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Dashboard body layout */}
                <div className="flex-1 flex flex-col overflow-hidden bg-black/10">
                    {/* ──── VIEW 1: TANPURA DRONE ──── */}
                    {activeTool === 'tanpura' && (
                        <div className="w-full bg-black/30 p-6 flex flex-col justify-between overflow-y-auto text-left max-h-[80vh]">
                            <div className="space-y-5">
                                {/* Scale/Key Select */}
                                <div>
                                    <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-wider block mb-2">Scale / Key (Shruti)</span>
                                    <div className="grid grid-cols-4 gap-1">
                                        {SHRU_PITCHES.map((pitch) => (
                                            <button
                                                key={pitch.label}
                                                onClick={async () => {
                                                    setSelectedPitch(pitch);
                                                    // Always start/restart drone on pitch click
                                                    stopTanpuraNodes();
                                                    setIsTanpuraPlaying(true);
                                                    await startTanpura(pitch); // pass pitch directly — avoids stale state
                                                }}
                                                className={`py-1.5 rounded-lg text-center font-bold text-xs transition-all border ${
                                                    selectedPitch.label === pitch.label 
                                                        ? 'bg-[#d46211] border-[#d46211] text-white' 
                                                        : 'border-[#d46211]/15 text-[#d46211]/60 hover:border-[#d46211]/30 hover:text-white'
                                                }`}
                                            >
                                                {pitch.label.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tuning Mode Select */}
                                <div>
                                    <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-wider block mb-2">Tuning Mode</span>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {TUNING_MODES.map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setSelectedTuningMode(mode)}
                                                className={`text-left p-2 rounded-xl border transition-all ${
                                                    selectedTuningMode.id === mode.id 
                                                        ? 'bg-[#d46211]/10 border-[#d46211] text-white' 
                                                        : 'border-white/5 text-white/40 hover:border-white/10 hover:text-white/70'
                                                }`}
                                            >
                                                <p className="font-extrabold text-xs text-[#d46211]">{mode.label.split(' ')[2]} Drone</p>
                                                <p className="text-[10px] text-white/40 mt-0.5 truncate">{mode.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 4 Plucking Strings visualizer */}
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-around items-stretch h-32 relative overflow-hidden shadow-inner my-2">
                                    {[0, 1, 2, 3].map((idx) => {
                                        const stringLabel = idx === 0 ? selectedTuningMode.id : idx === 3 ? 'Sa' : 'Sa';
                                        return (
                                            <div key={idx} className="flex flex-col items-center justify-between relative w-8">
                                                <span className={`text-[10px] font-black transition-colors ${isTanpuraPlaying ? 'text-[#d46211] animate-pulse' : 'text-white/20'}`}>
                                                    {stringLabel}
                                                </span>
                                                <div className="relative flex-1 flex items-center justify-center w-full my-2">
                                                    <div className={`w-[1.5px] h-full transition-all duration-300 ${
                                                        isTanpuraPlaying ? 'bg-[#d46211] shadow-[0_0_8px_rgba(212,98,17,0.8)] animate-pulse' : 'bg-white/5'
                                                    }`} />
                                                </div>
                                                <div className={`w-2 h-2 rounded-full border transition-all ${isTanpuraPlaying ? 'bg-[#d46211] border-orange-400' : 'bg-black border-white/10'}`} />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Volume controls */}
                                <div className="flex flex-col bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl">
                                    <div className="flex justify-between items-center text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                                        <span>Tanpura Volume</span>
                                        <span className="text-[#d46211] font-mono">{Math.round(tanpuraVolume * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1.0" step="0.05" value={tanpuraVolume}
                                        onChange={(e) => setTanpuraVolume(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                    />
                                </div>
                            </div>

                            {/* Play control bottom */}
                            <div className="pt-4 border-t border-white/5 mt-4">
                                <button
                                    onClick={async () => {
                                        if (isTanpuraPlaying) {
                                            stopTanpuraNodes();
                                            setIsTanpuraPlaying(false);
                                        } else {
                                            setIsTanpuraPlaying(true);
                                            await startTanpura();
                                        }
                                    }}
                                    className={`w-full h-12 rounded-xl font-extrabold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
                                        isTanpuraPlaying 
                                            ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' 
                                            : 'bg-[#d46211] text-white shadow-md shadow-orange-500/20 hover:bg-[#c05510]'
                                    }`}
                                >
                                    {isTanpuraPlaying ? (
                                        <><Square className="w-3.5 h-3.5 fill-white" /> Stop Drone</>
                                    ) : (
                                        <><Play className="w-3.5 h-3.5 fill-white" /> Play Drone</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ──── VIEW 2: METRONOME ──── */}
                    {activeTool === 'metronome' && (
                        <div className="w-full p-6 flex flex-col justify-between gap-6 overflow-y-auto max-h-[85vh]">
                            <div className="flex-1 flex flex-col lg:flex-row gap-6 animate-in fade-in duration-200">
                                
                                {/* Left Sub-panel: Tap and Measure */}
                                <div className="lg:w-56 flex flex-col gap-5 text-left shrink-0">
                                    {/* Measure Beats */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-wider block mb-2">Beats Per Measure</span>
                                        <div className="flex flex-wrap gap-1">
                                            {[2,3,4,5,6,7,8].map(n => (
                                                <button key={n} onClick={() => { setMetronomeBeats(n); setMetronomeSubdivisions(Array(n).fill(1)); }}
                                                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${metronomeBeats === n ? 'bg-[#d46211] text-white' : 'border border-[#d46211]/25 text-[#d46211]/60 hover:border-[#d46211]/50'}`}>
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sound profile */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-wider block mb-2">Metronome Sound</span>
                                        <div className="flex flex-wrap gap-1">
                                            {METRONOME_SOUNDS.map(s => (
                                                <button key={s} onClick={() => setSelectedMetronomeSound(s)}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${selectedMetronomeSound === s ? 'bg-[#d46211] text-white' : 'border border-[#d46211]/25 text-[#d46211]/50 hover:text-[#d46211]'}`}>
                                                     {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tap Tempo */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-wider block mb-2">Tap Tempo</span>
                                        <button onClick={handleTapTempo}
                                            className="w-full h-14 rounded-xl border border-[#d46211]/30 bg-gradient-to-b from-[#2a1a08] to-[#1a0e04] text-[#d46211] font-black text-sm tracking-widest hover:border-[#d46211] hover:shadow-lg hover:shadow-[#d46211]/15 active:scale-95 transition-all">
                                            TAP TEMPO
                                        </button>
                                    </div>

                                    {/* Presets */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-wider block mb-2">Quick Presets</span>
                                        <div className="space-y-1">
                                            {METRONOME_PRESETS.map(p => (
                                                <button key={p.name} onClick={() => loadMetronomePreset(p)}
                                                    className="w-full text-left px-3 py-1.5 border border-white/5 bg-white/5 rounded-xl hover:border-[#d46211]/30 hover:text-white transition-all text-[11px] text-white/50">
                                                    <span className="font-extrabold text-[#d46211] mr-1">{p.name}</span>({p.bpm} BPM)
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Sub-panel: Dial Visualizer */}
                                <div className="flex-1 flex flex-col items-center justify-center gap-5">
                                    <div className="relative w-12 h-12 flex items-center justify-center">
                                        {metronomeRipples.map(r => <Ripple key={r} id={r} />)}
                                        <div className="w-3.5 h-3.5 rounded-full bg-[#d46211]/45 border border-[#d46211]/60 shrink-0" />
                                    </div>

                                    {/* Dial */}
                                    <div className="relative flex items-center justify-center" style={{ width: 230, height: 230 }}>
                                        <div className={`absolute inset-0 transition-opacity duration-300 ${isMetronomePlaying ? 'opacity-100' : 'opacity-40'}`}>
                                            <Mandala angle={mandalaAngle} active={isMetronomePlaying} />
                                        </div>

                                        <div className={`absolute rounded-full border transition-all duration-300 ${isMetronomePlaying ? 'border-[#d46211]/50 shadow-xl' : 'border-[#d46211]/15'}`}
                                            style={{ width: 170, height: 170, boxShadow: isMetronomePlaying ? '0 0 30px rgba(212,98,17,0.18)' : 'none' }} />

                                        <div onMouseDown={onKnobDown}
                                            className="relative cursor-ns-resize select-none flex items-center justify-center rounded-full"
                                            style={{
                                                width: 140, height: 140, zIndex: 10,
                                                background: 'conic-gradient(from 0deg, #2a1a08, #3d2510, #2a1a08, #1a0e04, #2a1a08)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.4)',
                                                border: '2px solid rgba(212,98,17,0.3)',
                                            }}>
                                            <div className="absolute" style={{ width: 6, height: 6, top: 10, left: '50%', marginLeft: -3, transformOrigin: '3px 60px', transform: `rotate(${knobDeg}deg)` }}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#d46211] shadow-lg shadow-[#d46211]/60" />
                                            </div>

                                            <div className="text-center z-10">
                                                <div className="text-white font-black leading-none" style={{ fontSize: 36, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 15px rgba(212,98,17,0.4)' }}>
                                                    {bpm}
                                                </div>
                                                <div className="text-[#d46211]/60 text-[10px] font-black tracking-widest uppercase mt-0.5">BPM</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BPM controls */}
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setBpm(p => Math.max(20, p - 1))} className="w-8 h-8 rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all text-lg">−</button>
                                        <div className="text-white/40 text-xs font-bold tracking-widest">DRAG DIAL OR TAP +/-</div>
                                        <button onClick={() => setBpm(p => Math.min(240, p + 1))} className="w-8 h-8 rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all text-lg">+</button>
                                    </div>

                                    {/* BPM Volume controller */}
                                    <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl w-full max-w-sm">
                                        <Volume2 className="w-4 h-4 text-[#d46211]" />
                                        <div className="flex-1 flex flex-col text-left">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">
                                                <span>Metronome Volume</span>
                                                <span className="text-[#d46211] font-mono">{Math.round(metronomeVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="1.0" step="0.05" value={metronomeVolume}
                                                onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metronome Control Play control at bottom */}
                            <div className="pt-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-4">
                                <button onClick={() => setIsMetronomePlaying(!isMetronomePlaying)}
                                    className={`h-12 px-10 rounded-xl font-bold text-sm tracking-wider uppercase transition-all flex items-center gap-2 ${isMetronomePlaying ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' : 'bg-[#d46211] text-white shadow-md shadow-orange-500/20 hover:bg-[#c05510]'}`}>
                                    {isMetronomePlaying ? <><Square className="w-3.5 h-3.5 fill-white" /> Stop Metronome</> : <><Play className="w-3.5 h-3.5 fill-white" /> Play Metronome</>}
                                </button>

                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl text-xs text-white/40 border border-white/5 text-left">
                                    <HelpCircle className="w-4 h-4 text-[#d46211] shrink-0" />
                                    <span>Tip: Practicing with a metronome develops rhythmic accuracy and timing consistency.</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──── VIEW 3: DRUM SEQUENCER ──── */}
                    {activeTool === 'drums' && (
                        <div className="w-full p-6 flex flex-col gap-6 overflow-y-auto max-h-[85vh]">
                            <div className="flex-1 flex flex-col gap-5 animate-in fade-in duration-200 text-left">
                                {/* Top Preset & Signature Bar */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-white/5">
                                    {/* Presets */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-widest block mb-1.5">Preset Groove</span>
                                        <div className="flex flex-wrap gap-1">
                                            {DRUM_PRESETS.map(p => (
                                                <button key={p.name} onClick={() => loadDrumsPreset(p)}
                                                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${selectedDrumsPresetName === p.name ? 'bg-[#d46211] text-white' : 'border border-[#d46211]/20 text-[#d46211]/50 hover:text-[#d46211]'}`}>
                                                    {p.name.split(' ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Time Signatures */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-widest block mb-1.5">Time Signature</span>
                                        <div className="grid grid-cols-6 gap-1">
                                            {TIME_SIGNATURES.map(sig => (
                                                <button key={sig.name} onClick={() => handleDrumsTimeSigChange(sig)}
                                                    className={`py-1 rounded-md text-center font-bold text-xs transition-all border ${selectedDrumsTimeSig.name === sig.name ? 'bg-[#d46211] border-[#d46211] text-white' : 'border-white/5 text-white/40 hover:text-white'}`}>
                                                    {sig.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Grouping feel */}
                                    <div>
                                        <span className="text-[#d46211]/70 text-xs font-black uppercase tracking-widest block mb-1.5">Grouping Feel</span>
                                        <div className="flex gap-1.5">
                                            {selectedDrumsTimeSig.groupings.map(group => (
                                                <button key={group.name} onClick={() => setSelectedDrumsGrouping(group)}
                                                    className={`flex-1 py-1 rounded-md text-center font-bold text-xs border transition-all ${selectedDrumsGrouping.name === group.name ? 'bg-[#d46211]/10 border-[#d46211] text-white' : 'border-white/5 text-white/30 hover:text-white/50'}`}>
                                                    {group.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Step Grid Box */}
                                <div className="flex-1 flex flex-col justify-center bg-black/40 border border-white/5 rounded-2xl p-4 select-none overflow-x-auto">
                                    {/* Step Numbers */}
                                    <div className="flex items-center mb-2.5">
                                        <div className="w-20 shrink-0"></div>
                                        <div className="flex-1 flex gap-1 justify-between min-w-[280px]">
                                            {Array.from({ length: drumsActiveStepsCount }).map((_, stepIdx) => {
                                                const isGroupStart = selectedDrumsGrouping.dividers.includes(stepIdx);
                                                return (
                                                    <React.Fragment key={stepIdx}>
                                                        {isGroupStart && <div className="w-2 h-full shrink-0 border-l border-white/20"></div>}
                                                        <div className={`text-[10px] font-black w-full text-center transition-colors ${
                                                            currentDrumsStep === stepIdx ? 'text-[#d46211]' : stepIdx % selectedDrumsTimeSig.stepsPerBeat === 0 ? 'text-white/60' : 'text-white/20'
                                                        }`}>
                                                            {stepIdx + 1}
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Grid Rows */}
                                    <div className="space-y-2.5">
                                        {DRUM_TRACK_NAMES.map((trackName, trackIdx) => (
                                            <div key={trackName} className="flex items-center">
                                                <div className="w-20 text-left pr-2 shrink-0">
                                                    <span className="text-xs font-bold text-white/55">{trackName}</span>
                                                </div>
                                                <div className="flex-1 flex gap-1 justify-between min-w-[280px]">
                                                    {Array.from({ length: drumsActiveStepsCount }).map((_, stepIdx) => {
                                                        const isActive = drumsGrid[trackIdx][stepIdx];
                                                        const isCurrent = currentDrumsStep === stepIdx;
                                                        const isGroupStart = selectedDrumsGrouping.dividers.includes(stepIdx);
                                                        return (
                                                            <React.Fragment key={stepIdx}>
                                                                {isGroupStart && <div className="w-2 h-full shrink-0 border-l border-white/20"></div>}
                                                                <button onClick={() => handleToggleDrumsNode(trackIdx, stepIdx)}
                                                                    className={`aspect-square w-full rounded-md border transition-all relative ${isActive ? 'bg-[#d46211] border-[#d46211] shadow-[0_0_6px_rgba(212,98,17,0.35)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                                                    {isCurrent && <div className="absolute inset-0 rounded-md border border-amber-400 animate-pulse bg-white/10" />}
                                                                </button>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Progress playhead bar */}
                                    <div className="flex items-center mt-3 pt-3 border-t border-white/5">
                                        <div className="w-20 shrink-0"></div>
                                        <div className="flex-1 flex gap-1 justify-between min-w-[280px]">
                                            {Array.from({ length: drumsActiveStepsCount }).map((_, stepIdx) => {
                                                const isGroupStart = selectedDrumsGrouping.dividers.includes(stepIdx);
                                                return (
                                                    <React.Fragment key={stepIdx}>
                                                        {isGroupStart && <div className="w-2 h-full shrink-0 border-l border-white/20"></div>}
                                                        <div className={`h-1 rounded-full transition-all w-full ${currentDrumsStep === stepIdx ? 'bg-[#d46211]' : 'bg-white/5'}`} />
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Drum Controls (Volume & Clear) */}
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl flex-1 max-w-sm">
                                        <Volume2 className="w-4 h-4 text-[#d46211]" />
                                        <div className="flex-1 flex flex-col text-left">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">
                                                <span>Drums Volume</span>
                                                <span className="text-[#d46211] font-mono">{Math.round(drumsVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="1.0" step="0.05" value={drumsVolume}
                                                onChange={(e) => setDrumsVolume(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                            />
                                        </div>
                                    </div>

                                    <button onClick={handleClearGrid}
                                        className="h-10 px-4 rounded-xl border border-white/5 hover:border-white/15 text-white/50 hover:text-white/80 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" /> Clear Grid
                                    </button>
                                </div>
                            </div>

                            {/* Drums Play Control at bottom */}
                            <div className="pt-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-4">
                                <button onClick={() => setIsDrumsPlaying(!isDrumsPlaying)}
                                    className={`h-12 px-10 rounded-xl font-bold text-sm tracking-wider uppercase transition-all flex items-center gap-2 ${isDrumsPlaying ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' : 'bg-[#d46211] text-white shadow-md shadow-orange-500/20 hover:bg-[#c05510]'}`}>
                                    {isDrumsPlaying ? <><Square className="w-3.5 h-3.5 fill-white" /> Stop Beats</> : <><Play className="w-3.5 h-3.5 fill-white" /> Play Beats</>}
                                </button>

                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl text-xs text-white/40 border border-white/5 text-left">
                                    <HelpCircle className="w-4 h-4 text-[#d46211] shrink-0" />
                                    <span>Tip: Double tap grid cells to make beats or select a preset groove.</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
