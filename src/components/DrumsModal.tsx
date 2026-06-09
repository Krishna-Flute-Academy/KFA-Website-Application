'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Square, X, Sliders, Trash2, HelpCircle } from 'lucide-react';

interface TimeSignature {
    name: string;
    beats: number;
    stepsPerBeat: number;
    totalSteps: number;
    groupSize: number;
    description: string;
}

const TIME_SIGNATURES: TimeSignature[] = [
    { name: '4/4', beats: 4, stepsPerBeat: 4, totalSteps: 16, groupSize: 4, description: 'Common time (Rock, Pop, Funk)' },
    { name: '3/4', beats: 3, stepsPerBeat: 4, totalSteps: 12, groupSize: 4, description: 'Waltz time (3 beats per measure)' },
    { name: '2/4', beats: 2, stepsPerBeat: 4, totalSteps: 8, groupSize: 4, description: 'March/Polka time (2 beats per measure)' },
    { name: '6/8', beats: 2, stepsPerBeat: 6, totalSteps: 12, groupSize: 6, description: 'Double triplet time (Swing, Latin)' },
    { name: '5/4', beats: 5, stepsPerBeat: 4, totalSteps: 20, groupSize: 4, description: 'Odd meter (Take Five, 5 beats)' },
    { name: '7/8', beats: 7, stepsPerBeat: 2, totalSteps: 14, groupSize: 2, description: 'Odd meter (7 beats, Indian classical style)' }
];

interface Preset {
    name: string;
    description: string;
    steps: number; 
    timeSigName: string;
    grid: boolean[][]; // [4][steps]
}

const PRESETS: Preset[] = [
    {
        name: 'Rock Beat',
        description: 'Standard 4/4 rock and pop groove',
        steps: 16,
        timeSigName: '4/4',
        grid: [
            // Kick
            [true, false, false, false, false, false, false, false, true, false, true, false, false, false, false, false],
            // Snare
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            // Hi-hat
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            // Shaker
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Funk Groove',
        description: 'Syncopated funk beat with active shaker',
        steps: 16,
        timeSigName: '4/4',
        grid: [
            // Kick
            [true, false, false, false, false, false, true, false, true, false, false, true, false, false, false, false],
            // Snare
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true],
            // Hi-hat
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            // Shaker
            [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true],
        ]
    },
    {
        name: 'Jazz Swing',
        description: 'Traditional swing ride pattern (6/8 rhythm)',
        steps: 12,
        timeSigName: '6/8',
        grid: [
            // Kick
            [true, false, false, false, false, false, true, false, false, false, false, false],
            // Snare
            [false, false, false, false, false, false, false, false, false, false, true, false],
            // Hi-hat (swing ride)
            [true, false, true, true, false, true, true, false, true, true, false, true],
            // Shaker
            [false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Waltz (3/4)',
        description: 'Classical 3/4 waltz rhythm (12 steps)',
        steps: 12,
        timeSigName: '3/4',
        grid: [
            // Kick
            [true, false, false, false, false, false, false, false, false, false, false, false],
            // Snare
            [false, false, false, false, true, false, false, false, true, false, false, false],
            // Hi-hat
            [true, false, true, false, true, false, true, false, true, false, true, false],
            // Shaker
            [false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    },
    {
        name: 'Metronome Pop',
        description: 'Metronome click with accented downbeats',
        steps: 16,
        timeSigName: '4/4',
        grid: [
            // Kick
            [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            // Snare
            [false, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
            // Hi-hat
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            // Shaker
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ]
    }
];

const TRACK_NAMES = ['Kick Drum', 'Snare Drum', 'Hi-hat', 'Shaker'];

export default function DrumsModal({ onClose }: { onClose: () => void }) {
    const [selectedPresetName, setSelectedPresetName] = useState(PRESETS[0].name);
    const [selectedTimeSig, setSelectedTimeSig] = useState<TimeSignature>(TIME_SIGNATURES[0]);
    const [bpm, setBpm] = useState(105);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.65);
    const [currentStep, setCurrentStep] = useState(-1);
    
    // Grid stored as maximum of 24 steps to prevent out-of-bounds on signature change
    const [grid, setGrid] = useState<boolean[][]>(() => {
        const initialGrid = Array.from({ length: 4 }, () => Array(24).fill(false));
        const presetGrid = PRESETS[0].grid;
        for (let track = 0; track < 4; track++) {
            for (let step = 0; step < PRESETS[0].steps; step++) {
                initialGrid[track][step] = presetGrid[track][step] || false;
            }
        }
        return initialGrid;
    });
    
    const [activeStepsCount, setActiveStepsCount] = useState(PRESETS[0].steps);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stepRef = useRef(0);

    const isPlayingRef = useRef(isPlaying);
    const volumeRef = useRef(volume);
    const bpmRef = useRef(bpm);
    const gridRef = useRef(grid);
    const stepsCountRef = useRef(activeStepsCount);

    // Sync refs
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { volumeRef.current = volume; }, [volume]);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => { gridRef.current = grid; }, [grid]);
    useEffect(() => { stepsCountRef.current = activeStepsCount; }, [activeStepsCount]);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    // Helper to generate a short white noise buffer for snare, hats, and shaker
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

    // ── SYNTHESIS ENGINES ───────────────────────────────────────────────────

    // Play synthesized Kick Drum
    const playKick = useCallback((ctx: AudioContext, vol: number, now: number) => {
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

    // Play synthesized Snare Drum
    const playSnare = useCallback((ctx: AudioContext, vol: number, now: number) => {
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

    // Play synthesized Closed Hi-hat
    const playHihat = useCallback((ctx: AudioContext, vol: number, now: number) => {
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

    // Play synthesized Shaker
    const playShaker = useCallback((ctx: AudioContext, vol: number, now: number) => {
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

    // ── TICK SCHEDULER ───────────────────────────────────────────────────────
    
    const tick = useCallback(() => {
        if (!isPlayingRef.current) return;

        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const step = stepRef.current;
        const vol = volumeRef.current;
        const currentGrid = gridRef.current;
        const maxSteps = stepsCountRef.current;
        const now = ctx.currentTime;

        // Play active instruments for the current step
        if (currentGrid[0][step]) playKick(ctx, vol, now);
        if (currentGrid[1][step]) playSnare(ctx, vol, now);
        if (currentGrid[2][step]) playHihat(ctx, vol, now);
        if (currentGrid[3][step]) playShaker(ctx, vol, now);

        setCurrentStep(step);

        stepRef.current = (step + 1) % maxSteps;

        // Note spacing interval calculation based on BPM
        const interval = ((60 / bpmRef.current) / 4) * 1000;
        timerRef.current = setTimeout(tick, interval);

    }, [playKick, playSnare, playHihat, playShaker]);

    // Play/Stop listener
    useEffect(() => {
        if (isPlaying) {
            stepRef.current = 0;
            tick();
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            setCurrentStep(-1);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isPlaying, tick]);

    // Handle Preset loading
    const loadPreset = (preset: Preset) => {
        setSelectedPresetName(preset.name);
        
        // Find matching time signature structure
        const sig = TIME_SIGNATURES.find(s => s.name === preset.timeSigName) || TIME_SIGNATURES[0];
        setSelectedTimeSig(sig);
        setActiveStepsCount(sig.totalSteps);

        // Load preset values into a padded 24-step grid
        const newGrid = Array.from({ length: 4 }, () => Array(24).fill(false));
        for (let track = 0; track < 4; track++) {
            for (let step = 0; step < preset.steps; step++) {
                newGrid[track][step] = preset.grid[track][step] || false;
            }
        }
        setGrid(newGrid);
        
        stepRef.current = 0;
        if (isPlaying) {
            if (timerRef.current) clearTimeout(timerRef.current);
            tick();
        } else {
            setCurrentStep(-1);
        }
    };

    // Handle Time Signature manual change
    const handleTimeSigChange = (sig: TimeSignature) => {
        setSelectedTimeSig(sig);
        setActiveStepsCount(sig.totalSteps);
        setSelectedPresetName('Custom Beat');

        stepRef.current = 0;
        if (isPlaying) {
            if (timerRef.current) clearTimeout(timerRef.current);
            tick();
        } else {
            setCurrentStep(-1);
        }
    };

    // Toggle single node in the sequencer grid
    const handleToggleNode = (trackIdx: number, stepIdx: number) => {
        setGrid(prev => {
            const next = prev.map(row => [...row]);
            next[trackIdx][stepIdx] = !next[trackIdx][stepIdx];
            return next;
        });
        setSelectedPresetName('Custom Beat');
    };

    // Clear whole sequencer grid
    const handleClearGrid = () => {
        setGrid(Array.from({ length: 4 }, () => Array(24).fill(false)));
        setSelectedPresetName('Custom Beat');
    };

    const handleClose = () => {
        setIsPlaying(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg" onClick={e => e.target === e.currentTarget && handleClose()}>
            <div className="relative w-full max-w-4xl bg-gradient-to-br from-[#0c0f12] via-[#141b22] to-[#080b0d] rounded-3xl border border-[#d46211]/25 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-[#d46211]/10">
                    <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-[#d46211]/10 flex items-center justify-center text-[#d46211] border border-[#d46211]/20">
                            <span className="material-symbols-outlined">album</span>
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base md:text-lg tracking-tight">Drum Beats & Sequencer</h2>
                            <p className="text-[#d46211]/60 text-xs">Interactive step sequencer for rhythm practice and accompaniment</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
                    {/* Left Panel: Controls & Presets */}
                    <div className="lg:w-80 p-6 border-r border-[#d46211]/10 flex flex-col gap-6 text-left shrink-0">
                        {/* Presets */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3">Select Rhythm Preset</h3>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        onClick={() => loadPreset(preset)}
                                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                                            selectedPresetName === preset.name 
                                                ? 'bg-[#d46211]/10 border-[#d46211] text-white shadow-xs' 
                                                : 'border-white/5 text-white/50 hover:border-white/10 hover:text-white/80'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold text-xs text-[#d46211]">{preset.name}</p>
                                            <span className="text-[9px] font-extrabold bg-[#d46211]/10 px-2 py-0.5 rounded-full text-[#d46211]">
                                                {preset.timeSigName}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-white/40 mt-1 leading-normal">{preset.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Signature options */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3">Time Signature</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {TIME_SIGNATURES.map((sig) => (
                                    <button
                                        key={sig.name}
                                        onClick={() => handleTimeSigChange(sig)}
                                        className={`py-2 rounded-xl text-center font-bold text-[10px] md:text-xs transition-all border ${
                                            selectedTimeSig.name === sig.name 
                                                ? 'bg-[#d46211] border-[#d46211] text-white shadow-md shadow-orange-500/15' 
                                                : 'border-[#d46211]/25 text-[#d46211]/75 hover:border-[#d46211]/50 hover:text-[#d46211]'
                                        }`}
                                        title={sig.description}
                                    >
                                        {sig.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Adjusters (Sliders) */}
                        <div className="space-y-4">
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" /> Sequencer Controls
                            </h3>
                            
                            {/* BPM Slider */}
                            <div className="flex flex-col bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl text-left">
                                <div className="flex justify-between items-center text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5">
                                    <span>Tempo (BPM)</span>
                                    <span className="text-[#d46211] font-mono">{bpm} BPM</span>
                                </div>
                                <input 
                                    type="range"
                                    min="40"
                                    max="220"
                                    step="1"
                                    value={bpm}
                                    onChange={(e) => setBpm(parseInt(e.target.value))}
                                    className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                />
                            </div>

                            {/* Volume Slider */}
                            <div className="flex flex-col bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl text-left">
                                <div className="flex justify-between items-center text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5">
                                    <span>Master Volume</span>
                                    <span className="text-[#d46211] font-mono">{Math.round(volume * 100)}%</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1.0"
                                    step="0.05"
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Step Sequencer Grid */}
                    <div className="flex-1 p-6 flex flex-col justify-between gap-6 min-h-[350px]">
                        
                        {/* Step Grid Box */}
                        <div className="flex-1 flex flex-col justify-center bg-black/40 border border-white/5 rounded-3xl p-5 md:p-6 select-none overflow-x-auto">
                            
                            {/* Header steps count track with time sig visual grouping */}
                            <div className="flex items-center mb-3">
                                <div className="w-24 shrink-0"></div>
                                <div className="flex-1 flex gap-1 justify-between min-w-[280px]">
                                    {Array.from({ length: activeStepsCount }).map((_, stepIdx) => {
                                        const isGroupStart = stepIdx % selectedTimeSig.groupSize === 0 && stepIdx > 0;
                                        return (
                                            <React.Fragment key={stepIdx}>
                                                {isGroupStart && <div className="w-1.5 h-full shrink-0 border-l border-white/10"></div>}
                                                <div 
                                                    className={`text-[8px] font-black w-full text-center tracking-tight transition-colors ${
                                                        currentStep === stepIdx 
                                                            ? 'text-[#d46211]' 
                                                            : stepIdx % selectedTimeSig.stepsPerBeat === 0 
                                                                ? 'text-white/60' 
                                                                : 'text-white/20'
                                                    }`}
                                                >
                                                    {stepIdx + 1}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sequencer Grid Rows with time sig visual grouping */}
                            <div className="space-y-3">
                                {TRACK_NAMES.map((trackName, trackIdx) => (
                                    <div key={trackName} className="flex items-center">
                                        {/* Instrument label */}
                                        <div className="w-24 text-left pr-2 shrink-0">
                                            <span className="text-[10px] font-extrabold text-white/70 tracking-wide">{trackName}</span>
                                        </div>

                                        {/* Step Buttons */}
                                        <div className="flex-1 flex gap-1 justify-between min-w-[280px]">
                                            {Array.from({ length: activeStepsCount }).map((_, stepIdx) => {
                                                const isActive = grid[trackIdx][stepIdx];
                                                const isCurrent = currentStep === stepIdx;
                                                const isGroupStart = stepIdx % selectedTimeSig.groupSize === 0 && stepIdx > 0;
                                                return (
                                                    <React.Fragment key={stepIdx}>
                                                        {isGroupStart && <div className="w-1.5 h-full shrink-0 border-l border-white/10"></div>}
                                                        <button
                                                            onClick={() => handleToggleNode(trackIdx, stepIdx)}
                                                            className={`aspect-square w-full rounded-lg border transition-all relative ${
                                                                isActive
                                                                    ? 'bg-[#d46211] border-[#d46211] shadow-[0_0_8px_rgba(212,98,17,0.3)]'
                                                                    : 'bg-white/5 border-white/5 hover:border-white/10'
                                                            }`}
                                                        >
                                                            {/* Playhead running border indicator */}
                                                            {isCurrent && (
                                                                <div className="absolute inset-0 rounded-lg border border-amber-400 animate-pulse bg-white/10"></div>
                                                            )}
                                                        </button>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Running playhead progress bar with time sig visual grouping */}
                            <div className="flex items-center mt-4 pt-4 border-t border-white/5">
                                <div className="w-24 shrink-0"></div>
                                <div className="flex-1 flex gap-1 justify-between min-w-[280px]">
                                    {Array.from({ length: activeStepsCount }).map((_, stepIdx) => {
                                        const isGroupStart = stepIdx % selectedTimeSig.groupSize === 0 && stepIdx > 0;
                                        return (
                                            <React.Fragment key={stepIdx}>
                                                {isGroupStart && <div className="w-1.5 h-full shrink-0 border-l border-white/10"></div>}
                                                <div 
                                                    className={`h-1.5 rounded-full transition-all w-full ${
                                                        currentStep === stepIdx 
                                                            ? 'bg-[#d46211] shadow-[0_0_6px_rgba(212,98,17,0.5)]' 
                                                            : 'bg-white/5'
                                                    }`}
                                                />
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Control actions */}
                        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className={`h-12 px-10 rounded-2xl font-bold text-xs tracking-widest uppercase transition-all flex items-center gap-2 ${
                                        isPlaying 
                                            ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' 
                                            : 'bg-[#d46211] text-white shadow-lg shadow-orange-500/20 hover:bg-[#c05510] hover:scale-[1.02]'
                                    }`}
                                >
                                    {isPlaying ? (
                                        <>
                                            <Square className="w-3.5 h-3.5 fill-white" /> Stop Beats
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3.5 h-3.5 fill-white" /> Play Beats
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleClearGrid}
                                    className="h-12 px-5 rounded-2xl border border-white/5 hover:border-white/15 text-white/50 hover:text-white/80 transition-all flex items-center gap-1.5 text-xs font-bold"
                                    title="Reset grid to empty steps"
                                >
                                    <Trash2 className="w-4 h-4" /> Clear Grid
                                </button>
                            </div>

                            {/* Help tip */}
                            <div className="hidden sm:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl text-[10px] text-white/40 border border-white/5">
                                <HelpCircle className="w-4 h-4 text-[#d46211] shrink-0" />
                                <span>Tip: Click nodes on the grid to customise or compose your own drum rhythms!</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
