'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Music, Volume2, Play, Square, X, Sliders, Info } from 'lucide-react';

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
    { label: 'A (Safed 1)', freq: 220.00 }, // lower octave G#/A base
    { label: 'A# (Safed 2)', freq: 233.08 },
    { label: 'B (Safed 3)', freq: 246.94 },
];

const TUNING_MODES = [
    { id: 'Pa', label: 'Pa - Sa - Sa - Sa (Standard)', desc: 'Perfect 5th (standard tuning for most Ragas)', mult: 0.75 },
    { id: 'Ma', label: 'Ma - Sa - Sa - Sa (Madhyam)', desc: 'Perfect 4th (for Ragas without Pa, like Malkauns)', mult: 0.6667 },
    { id: 'Ni', label: 'Ni - Sa - Sa - Sa (Nishad)', desc: 'Major 7th (for Ragas like Yaman, Puriya, Marwa)', mult: 0.9375 },
    { id: 'Sa', label: 'Sa - Sa - Sa - Sa (Kharaj)', desc: 'Lower Octave Sa (for deep meditative drone)', mult: 0.5 }
];

export default function TanpuraModal({ onClose }: { onClose: () => void }) {
    const [selectedPitch, setSelectedPitch] = useState(SHRU_PITCHES[0]);
    const [selectedMode, setSelectedMode] = useState(TUNING_MODES[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [pluckSpeed, setPluckSpeed] = useState(1.0); // Pluck interval in seconds
    const [activeString, setActiveString] = useState<number | null>(null);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const currentPluckRef = useRef(0);
    const isPlayingRef = useRef(isPlaying);
    const volumeRef = useRef(volume);
    const speedRef = useRef(pluckSpeed);
    const pitchRef = useRef(selectedPitch);
    const modeRef = useRef(selectedMode);

    // Sync refs
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { volumeRef.current = volume; }, [volume]);
    useEffect(() => { speedRef.current = pluckSpeed; }, [pluckSpeed]);
    useEffect(() => { pitchRef.current = selectedPitch; }, [selectedPitch]);
    useEffect(() => { modeRef.current = selectedMode; }, [selectedMode]);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    // Synthesize a rich pluck with overtones
    const triggerStringPluck = useCallback((stringIndex: number, freq: number) => {
        try {
            const ctx = getCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const now = ctx.currentTime;
            const duration = 4.5; // string ring time

            // Harmonic multipliers & gains to synthesize jawari (buzzing bridge)
            // Tanpura strings are rich in 2nd, 3rd, 4th, 5th, and 6th harmonics
            const harmonics = [
                { mult: 1, gain: 0.5 },
                { mult: 2, gain: 0.25 },
                { mult: 3, gain: 0.15 },
                { mult: 4, gain: 0.08 },
                { mult: 5, gain: 0.04 },
                { mult: 6, gain: 0.02 }
            ];

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0, now);
            masterGain.gain.linearRampToValueAtTime(volumeRef.current * 0.4, now + 0.05); // quick pluck attack
            masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration); // long string decay

            masterGain.connect(ctx.destination);

            harmonics.forEach(({ mult, gain }) => {
                const osc = ctx.createOscillator();
                const nodeGain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                // Sawtooth gives all integer harmonics, perfect for brassy buzzing sound
                osc.type = 'sawtooth';
                osc.frequency.value = freq * mult;

                // LFO (vibrato) to simulate human pluck string tension variation
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 5.5 + Math.random(); // rate
                lfoGain.gain.value = (freq * mult) * 0.005; // depth
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(now);
                lfo.stop(now + duration);

                // Sweeping bandpass/lowpass filter to simulate string pluck tone decay
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime((freq * mult) * 4, now);
                filter.frequency.exponentialRampToValueAtTime((freq * mult) * 1.2, now + 2.0);

                nodeGain.gain.value = gain;

                osc.connect(filter);
                filter.connect(nodeGain);
                nodeGain.connect(masterGain);

                osc.start(now);
                osc.stop(now + duration);
            });

            // Pluck transient noise (simulates fingernail/plectrum pluck)
            const noise = ctx.createBufferSource();
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noise.buffer = noiseBuffer;
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = 1000;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(volumeRef.current * 0.12, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);

        } catch (err) {
            console.error('Web Audio pluck trigger failed:', err);
        }
    }, []);

    // Tanpura loop scheduler
    const scheduleNextPluck = useCallback(() => {
        if (!isPlayingRef.current) return;

        const stringIndex = currentPluckRef.current;
        const baseFreq = pitchRef.current.freq;
        const mode = modeRef.current;

        let pluckFreq = baseFreq;

        if (stringIndex === 0) {
            // String 1: Pa (0.75), Ma (0.6667), Ni (0.9375), Sa (0.5)
            pluckFreq = baseFreq * mode.mult;
        } else if (stringIndex === 1 || stringIndex === 2) {
            // String 2 & 3: Sa (middle octave)
            pluckFreq = baseFreq;
        } else if (stringIndex === 3) {
            // String 4: Sa (lower octave)
            pluckFreq = baseFreq * 0.5;
        }

        // Trigger synth pluck
        triggerStringPluck(stringIndex, pluckFreq);
        setActiveString(stringIndex);

        // Highlight pluck visual then fade
        setTimeout(() => {
            setActiveString(null);
        }, 300);

        // Advanced to next string (0, 1, 2, 3)
        // Standard loop: String 1 -> String 2 -> String 3 -> String 4 -> Pause -> Repeat
        // We schedule next pluck after pluckSpeed seconds
        currentPluckRef.current = (stringIndex + 1) % 4;

        // Pluck 4 is followed by a slightly longer pause to emulate traditional cycle (Sa-Pa-Sa-Sa loop)
        const delay = stringIndex === 3 ? speedRef.current * 2.0 : speedRef.current;
        timerRef.current = setTimeout(scheduleNextPluck, delay * 1000);

    }, [triggerStringPluck]);

    // Play/Stop toggle
    useEffect(() => {
        if (isPlaying) {
            currentPluckRef.current = 0;
            scheduleNextPluck();
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            setActiveString(null);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isPlaying, scheduleNextPluck]);

    // Handle closing modal
    const handleClose = () => {
        setIsPlaying(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-lg" onClick={e => e.target === e.currentTarget && handleClose()}>
            <div className="relative w-full max-w-4xl bg-gradient-to-br from-[#120b04] via-[#1e1008] to-[#0d0704] rounded-3xl border border-[#d46211]/25 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-[#d46211]/10">
                    <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-[#d46211]/10 flex items-center justify-center text-[#d46211] border border-[#d46211]/20">
                            <Music className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base md:text-lg tracking-tight">Electronic Tanpura Drone</h2>
                            <p className="text-[#d46211]/60 text-xs">Meditative Shruti box & pluck synthesizer</p>
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
                    {/* Left Panel: Pitch and Tuning Selectors */}
                    <div className="lg:w-72 p-6 border-r border-[#d46211]/10 flex flex-col gap-6 text-left">
                        {/* Scale / Shruti Select */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" /> Scale / Shruti (Key)
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {SHRU_PITCHES.map((pitch) => (
                                    <button
                                        key={pitch.label}
                                        onClick={() => {
                                            setSelectedPitch(pitch);
                                            // Trigger momentary pluck preview if playing
                                            if (isPlaying) currentPluckRef.current = 0;
                                        }}
                                        className={`px-2 py-2 rounded-xl text-center font-bold text-[10px] md:text-xs transition-all border ${
                                            selectedPitch.label === pitch.label 
                                                ? 'bg-[#d46211] border-[#d46211] text-white shadow-md shadow-orange-500/15' 
                                                : 'border-[#d46211]/25 text-[#d46211]/75 hover:border-[#d46211]/50 hover:text-[#d46211]'
                                        }`}
                                    >
                                        {pitch.label.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tuning Presets */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3">Tuning Mode</h3>
                            <div className="space-y-2">
                                {TUNING_MODES.map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => {
                                            setSelectedMode(mode);
                                            if (isPlaying) currentPluckRef.current = 0;
                                        }}
                                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                                            selectedMode.id === mode.id 
                                                ? 'bg-[#d46211]/10 border-[#d46211] text-white' 
                                                : 'border-[#d46211]/10 text-white/50 hover:border-[#d46211]/30 hover:text-white/80'
                                        }`}
                                    >
                                        <p className="font-bold text-xs text-[#d46211]">{mode.label.split(' ')[0]}</p>
                                        <p className="text-[10px] text-white/40 mt-0.5 leading-normal">{mode.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Strings, Visualizer, & Controls */}
                    <div className="flex-1 p-8 flex flex-col items-center justify-between gap-8">
                        {/* 4 Plucked Strings Visualization */}
                        <div className="w-full max-w-md bg-[#d46211]/5 border border-[#d46211]/10 rounded-3xl p-6 flex justify-around items-stretch h-64 relative overflow-hidden shadow-inner">
                            {/* Ambient glowing backdrop */}
                            <div className="absolute inset-0 bg-radial-gradient from-orange-500/5 to-transparent pointer-events-none"></div>

                            {[0, 1, 2, 3].map((idx) => {
                                const active = activeString === idx;
                                const stringLabel = idx === 0 ? selectedMode.id : idx === 3 ? 'Sa (Base)' : 'Sa';
                                return (
                                    <div key={idx} className="flex flex-col items-center justify-between py-2 relative w-16">
                                        {/* Label top */}
                                        <span className={`text-[10px] font-extrabold uppercase tracking-wide transition-colors ${
                                            active ? 'text-amber-400' : 'text-white/40'
                                        }`}>
                                            {stringLabel}
                                        </span>

                                        {/* Pluck string line */}
                                        <div className="relative flex-1 flex items-center justify-center w-full my-4">
                                            {/* Vibrating String Line */}
                                            <div 
                                                className={`w-[2px] h-full transition-all duration-75 ${
                                                    active 
                                                        ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] scale-x-150 animate-pulse' 
                                                        : 'bg-gradient-to-b from-[#d46211]/10 via-[#d46211]/40 to-[#d46211]/10'
                                                }`}
                                                style={{
                                                    transform: active ? 'skewX(1deg) scaleX(1.8)' : 'none',
                                                }}
                                            />
                                            {/* Visual ripple pluck circle */}
                                            {active && (
                                                <div className="absolute w-8 h-8 rounded-full border border-amber-400 animate-ping opacity-75"></div>
                                            )}
                                        </div>

                                        {/* Peg/Key bottom */}
                                        <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                            active 
                                                ? 'bg-[#d46211] border-amber-400 scale-110 shadow-md shadow-orange-500/40' 
                                                : 'bg-[#120b04] border-[#d46211]/40'
                                        }`} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Adjusters (Sliders) */}
                        <div className="w-full max-w-md space-y-5">
                            {/* Volume Slider */}
                            <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-4 py-3 rounded-2xl">
                                <Volume2 className="w-4 h-4 text-[#d46211] shrink-0" />
                                <div className="flex-1 flex flex-col text-left">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5">
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

                            {/* Pluck Speed Slider */}
                            <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-4 py-3 rounded-2xl">
                                <Sliders className="w-4 h-4 text-[#d46211] shrink-0" />
                                <div className="flex-1 flex flex-col text-left">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5">
                                        <span>Pluck Speed</span>
                                        <span className="text-[#d46211] font-mono">{(pluckSpeed).toFixed(1)}s / string</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="0.6"
                                        max="1.8"
                                        step="0.1"
                                        value={pluckSpeed}
                                        onChange={(e) => setPluckSpeed(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Playing Buttons */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`h-14 px-12 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${
                                    isPlaying 
                                        ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' 
                                        : 'bg-[#d46211] text-white shadow-lg shadow-orange-500/20 hover:bg-[#c05510] hover:scale-[1.02]'
                                }`}
                            >
                                {isPlaying ? (
                                    <>
                                        <Square className="w-4 h-4 fill-white" /> Stop
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-white" /> Play Tanpura
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
