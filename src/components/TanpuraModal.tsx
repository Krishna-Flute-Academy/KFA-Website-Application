'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music, Volume2, Play, Square, X, Sliders } from 'lucide-react';

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
    { id: 'Pa', label: 'Sa - Pa Drone', desc: 'Sa (Fundamental) + Pa (Perfect 5th) + Sa Octaves', mult: 1.5 },
    { id: 'Ma', label: 'Sa - Ma Drone', desc: 'Sa (Fundamental) + Ma (Perfect 4th) + Sa Octaves', mult: 1.3333 },
    { id: 'Ni', label: 'Sa - Ni Drone', desc: 'Sa (Fundamental) + Ni (Major 7th) + Sa Octaves', mult: 1.875 },
    { id: 'Sa', label: 'Sa - Sa Drone', desc: 'Sa (Fundamental) + Sa Octaves Only', mult: 2.0 }
];

interface ActiveNode {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    gainNode: GainNode;
}

export default function TanpuraModal({ onClose }: { onClose: () => void }) {
    const [selectedPitch, setSelectedPitch] = useState(SHRU_PITCHES[0]);
    const [selectedMode, setSelectedMode] = useState(TUNING_MODES[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const activeNodesRef = useRef<ActiveNode[]>([]);
    
    const volumeRef = useRef(volume);
    useEffect(() => { volumeRef.current = volume; }, [volume]);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    // Synthesize a continuous harmonium/reed tone voice
    const startDroneNode = useCallback((ctx: AudioContext, freq: number, mixVolume: number): ActiveNode => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Warm fundamental: triangle wave
        osc1.type = 'triangle';
        osc1.frequency.value = freq;

        // Reed/Harmonium buzz: sawtooth wave detuned slightly to add chorus/warmth
        osc2.type = 'sawtooth';
        osc2.frequency.value = freq + 0.35; // slightly detuned

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.22; // keep reed sawtooth low to avoid harshness

        // Lowpass filter to make it sound warm and cut out harsh buzzing highs
        filter.type = 'lowpass';
        filter.frequency.value = freq * 3.5;

        // Initial gain set to 0, then fade in
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volumeRef.current * mixVolume * 0.22, ctx.currentTime + 0.25); // smooth fade-in

        // Connections
        osc1.connect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();

        return { osc1, osc2, gainNode };
    }, []);

    // Stop all active synthesizers
    const stopAllNodes = useCallback(() => {
        const ctx = audioCtxRef.current;
        activeNodesRef.current.forEach((node) => {
            try {
                if (ctx) {
                    node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, ctx.currentTime);
                    node.gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); // smooth fade-out
                }
                setTimeout(() => {
                    try {
                        node.osc1.stop();
                        node.osc2.stop();
                    } catch (_) {}
                }, 400);
            } catch (_) {}
        });
        activeNodesRef.current = [];
    }, []);

    // Start all 4 drone notes together
    const startDrone = useCallback(() => {
        try {
            const ctx = getCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const baseFreq = selectedPitch.freq;
            const mode = selectedMode;

            // 4 Notes mix:
            // 1. Low Sa (base octave): freq * 0.5 (Mix Volume: 1.0)
            // 2. Middle Sa (fundamental): freq (Mix Volume: 0.8)
            // 3. Pa/Ma/Ni (tuning note): freq * multiplier (Mix Volume: 0.75)
            // 4. High Sa (octave): freq * 2.0 (Mix Volume: 0.45)
            const frequencies = [
                baseFreq * 0.5,
                baseFreq,
                baseFreq * mode.mult,
                baseFreq * 2.0
            ];
            const mixVolumes = [1.0, 0.8, 0.75, 0.45];

            const nodes = frequencies.map((freq, idx) => 
                startDroneNode(ctx, freq, mixVolumes[idx])
            );

            activeNodesRef.current = nodes;
        } catch (err) {
            console.error('Failed to start Tanpura drone:', err);
        }
    }, [selectedPitch, selectedMode, startDroneNode]);

    // Handle play state changes
    useEffect(() => {
        if (isPlaying) {
            startDrone();
        } else {
            stopAllNodes();
        }
        return () => {
            stopAllNodes();
        };
    }, [isPlaying, startDrone, stopAllNodes]);

    // Update volume in real-time
    useEffect(() => {
        const ctx = audioCtxRef.current;
        if (!ctx || activeNodesRef.current.length === 0) return;

        const mixVolumes = [1.0, 0.8, 0.75, 0.45];
        activeNodesRef.current.forEach((node, idx) => {
            try {
                const targetGain = volume * mixVolumes[idx] * 0.22;
                node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, ctx.currentTime);
                node.gainNode.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.1);
            } catch (_) {}
        });
    }, [volume]);

    // Seamless pitch transition if changed while playing
    useEffect(() => {
        if (isPlaying) {
            stopAllNodes();
            startDrone();
        }
    }, [selectedPitch, selectedMode, isPlaying, startDrone, stopAllNodes]);

    // Handle closing modal
    const handleClose = () => {
        setIsPlaying(false);
        stopAllNodes();
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
                            <p className="text-[#d46211]/60 text-xs">Continuous Shruti Box drone synthesizer</p>
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
                    <div className="lg:w-72 p-6 border-r border-[#d46211]/10 flex flex-col gap-6 text-left shrink-0">
                        {/* Scale / Shruti Select */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" /> Scale / Shruti (Key)
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {SHRU_PITCHES.map((pitch) => (
                                    <button
                                        key={pitch.label}
                                        onClick={() => setSelectedPitch(pitch)}
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
                                        onClick={() => setSelectedMode(mode)}
                                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                                            selectedMode.id === mode.id 
                                                ? 'bg-[#d46211]/10 border-[#d46211] text-white' 
                                                : 'border-[#d46211]/10 text-white/50 hover:border-[#d46211]/30 hover:text-white/80'
                                        }`}
                                    >
                                        <p className="font-bold text-xs text-[#d46211]">{mode.label}</p>
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
                                const stringLabel = idx === 0 ? selectedMode.id : idx === 3 ? 'Sa (Base)' : 'Sa';
                                return (
                                    <div key={idx} className="flex flex-col items-center justify-between py-2 relative w-16">
                                        {/* Label top */}
                                        <span className={`text-[10px] font-extrabold uppercase tracking-wide transition-colors ${
                                            isPlaying ? 'text-amber-400 animate-pulse' : 'text-white/40'
                                        }`}>
                                            {stringLabel}
                                        </span>

                                        {/* Pluck string line */}
                                        <div className="relative flex-1 flex items-center justify-center w-full my-4">
                                            {/* Vibrating String Line */}
                                            <div 
                                                className={`w-[2.5px] h-full transition-all duration-300 ${
                                                    isPlaying 
                                                        ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse' 
                                                        : 'bg-gradient-to-b from-[#d46211]/10 via-[#d46211]/40 to-[#d46211]/10'
                                                }`}
                                            />
                                        </div>

                                        {/* Peg/Key bottom */}
                                        <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                                            isPlaying 
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
                                        <Square className="w-4 h-4 fill-white" /> Stop Drone
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-white" /> Play Drone
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
