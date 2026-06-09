'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Square, X, Sliders, Music, HelpCircle } from 'lucide-react';

interface Taal {
    name: string;
    beats: number;
    desc: string;
    bols: string[];
    signs: string[]; // 'X' (Sam), '0' (Khali), '2', '3', '4' (Tali numbers)
}

const TAALS: Taal[] = [
    {
        name: 'Teental',
        beats: 16,
        desc: '16 Beats (4+4+4+4) - The most popular classical cycle',
        bols: ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'],
        signs: ['X', 'Tali', 'Tali', 'Tali', '2', 'Tali', 'Tali', 'Tali', '0', 'Khali', 'Khali', 'Khali', '3', 'Tali', 'Tali', 'Tali']
    },
    {
        name: 'Keharwa',
        beats: 8,
        desc: '8 Beats (4+4) - Popular fast/semi-classical cycle',
        bols: ['Dha', 'Ge', 'Na', 'Tin', 'Ta', 'Ka', 'Dhin', 'Na'],
        signs: ['X', 'Tali', 'Tali', 'Tali', '0', 'Khali', 'Khali', 'Khali']
    },
    {
        name: 'Dadra',
        beats: 6,
        desc: '6 Beats (3+3) - Fast light classical cycle',
        bols: ['Dha', 'Dhin', 'Na', 'Dha', 'Tin', 'Na'],
        signs: ['X', 'Tali', 'Tali', '0', 'Khali', 'Khali']
    },
    {
        name: 'Jhaptal',
        beats: 10,
        desc: '10 Beats (2+3+2+3) - Medium tempo classical cycle',
        bols: ['Dhin', 'Na', 'Dhin', 'Dhin', 'Na', 'Tin', 'Na', 'Dhin', 'Dhin', 'Na'],
        signs: ['X', 'Tali', '2', 'Tali', 'Tali', '0', 'Khali', '3', 'Tali', 'Tali']
    },
    {
        name: 'Ektaal',
        beats: 12,
        desc: '12 Beats (2+2+2+2+2+2) - Versatile classical cycle',
        bols: ['Dhin', 'Dhin', 'Dha', 'Ge', 'Tin', 'Tin', 'Ta', 'Ke', 'Dhin', 'Na', 'Dha', 'Ge'],
        signs: ['X', 'Tali', '0', 'Khali', '2', 'Tali', '0', 'Khali', '3', 'Tali', '4', 'Tali']
    },
    {
        name: 'Rupak',
        beats: 7,
        desc: '7 Beats (3+2+2) - Starts on Khali (0)',
        bols: ['Tin', 'Tin', 'Na', 'Dhin', 'Na', 'Dhin', 'Na'],
        signs: ['0', 'Khali', 'Khali', '2', 'Tali', '3', 'Tali']
    }
];

const TABLA_PITCHES = [
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

export default function TablaModal({ onClose }: { onClose: () => void }) {
    const [selectedTaal, setSelectedTaal] = useState<Taal>(TAALS[0]);
    const [selectedPitch, setSelectedPitch] = useState(TABLA_PITCHES[2]); // Default D
    const [bpm, setBpm] = useState(100);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.6);
    const [currentBeat, setCurrentBeat] = useState(-1);
    
    // Drum play triggers for visual animations
    const [playDayan, setPlayDayan] = useState(false);
    const [playBayan, setPlayBayan] = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const beatRef = useRef(0);
    
    const isPlayingRef = useRef(isPlaying);
    const volumeRef = useRef(volume);
    const bpmRef = useRef(bpm);
    const taalRef = useRef(selectedTaal);
    const pitchRef = useRef(selectedPitch);

    // Sync refs
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { volumeRef.current = volume; }, [volume]);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => { taalRef.current = selectedTaal; }, [selectedTaal]);
    useEffect(() => { pitchRef.current = selectedPitch; }, [selectedPitch]);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    // ── TREBLE STROKES (Dayan) ────────────────────────────────────────────────
    // Tin / Na: Metallic ringing stroke
    const playTrebleRing = useCallback((ctx: AudioContext, freq: number, duration: number, isStrong: boolean) => {
        const now = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.value = freq;

        // Harmonic resonance at 1.5x (perfect 5th) gives treble ringing texture
        osc2.type = 'sine';
        osc2.frequency.value = freq * 1.5;

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.25;

        filter.type = 'lowpass';
        filter.frequency.value = freq * 4.5;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volumeRef.current * (isStrong ? 0.45 : 0.25), now + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.connect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + duration + 0.1);
        osc2.start(now);
        osc2.stop(now + duration + 0.1);
        
        // Trigger right drum visual
        setPlayDayan(true);
        setTimeout(() => setPlayDayan(false), 120);
    }, []);

    // Ta: Closed flat stroke
    const playTrebleFlat = useCallback((ctx: AudioContext, freq: number, duration: number) => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        filter.type = 'bandpass';
        filter.frequency.value = freq * 1.8;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volumeRef.current * 0.3, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.05);

        setPlayDayan(true);
        setTimeout(() => setPlayDayan(false), 120);
    }, []);

    // ── BASS STROKES (Bayan) ──────────────────────────────────────────────────
    // Ge: Resonant sliding bass
    const playBassSlide = useCallback((ctx: AudioContext, baseFreq: number, duration: number) => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        // Pitch sweep / sliding slide representing Bayan hand pressure
        const startFreq = baseFreq * 0.32; // e.g., 90Hz
        const endFreq = baseFreq * 0.44;   // e.g., 125Hz
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16);

        filter.type = 'lowpass';
        filter.frequency.value = baseFreq * 1.5;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volumeRef.current * 0.55, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.1);

        setPlayBayan(true);
        setTimeout(() => setPlayBayan(false), 120);
    }, []);

    // Ke / Ka: Short flat bass stroke
    const playBassFlat = useCallback((ctx: AudioContext, baseFreq: number, duration: number) => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = baseFreq * 0.35; // e.g., ~100Hz

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volumeRef.current * 0.45, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.05);

        setPlayBayan(true);
        setTimeout(() => setPlayBayan(false), 120);
    }, []);

    // ── SYLLABLES SCHEDULER ───────────────────────────────────────────────────
    const playBolStroke = useCallback((bol: string) => {
        try {
            const ctx = getCtx();
            if (ctx.state === 'suspended') ctx.resume();

            const freq = pitchRef.current.freq;

            switch (bol) {
                case 'Dha': // Combined (Ta + Ge)
                    playTrebleRing(ctx, freq, 0.28, true);
                    playBassSlide(ctx, freq, 0.38);
                    break;
                case 'Dhin': // Combined (Tin + Ge)
                    playTrebleRing(ctx, freq, 0.4, false);
                    playBassSlide(ctx, freq, 0.4);
                    break;
                case 'Tin': // Treble Ring
                    playTrebleRing(ctx, freq, 0.45, false);
                    break;
                case 'Ta': // Treble Flat
                    playTrebleFlat(ctx, freq, 0.12);
                    break;
                case 'Na': // Treble Edge/Ring
                    playTrebleRing(ctx, freq, 0.25, true);
                    break;
                case 'Ge': // Bass Slide
                    playBassSlide(ctx, freq, 0.35);
                    break;
                case 'Ke': // Bass Flat
                case 'Ka': // Bass Flat
                    playBassFlat(ctx, freq, 0.08);
                    break;
                default:
                    // Rest / Silence
                    break;
            }
        } catch (err) {
            console.error('Failed to play Tabla stroke:', err);
        }
    }, [playTrebleRing, playTrebleFlat, playBassSlide, playBassFlat]);

    // Tabla Metronome loop tick scheduler
    const tick = useCallback(() => {
        if (!isPlayingRef.current) return;

        const beat = beatRef.current;
        const taal = taalRef.current;
        const currentBol = taal.bols[beat];

        // Play sound stroke
        playBolStroke(currentBol);
        setCurrentBeat(beat);

        // Advance beat
        beatRef.current = (beat + 1) % taal.beats;

        const interval = (60 / bpmRef.current) * 1000;
        timerRef.current = setTimeout(tick, interval);

    }, [playBolStroke]);

    // Play state monitor
    useEffect(() => {
        if (isPlaying) {
            beatRef.current = 0;
            tick();
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            setCurrentBeat(-1);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isPlaying, tick]);

    // Reset beat index when switching Taals
    useEffect(() => {
        beatRef.current = 0;
        if (isPlaying) {
            if (timerRef.current) clearTimeout(timerRef.current);
            tick();
        } else {
            setCurrentBeat(-1);
        }
    }, [selectedTaal, tick, isPlaying]);

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
                            <span className="material-symbols-outlined">toll</span>
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-base md:text-lg tracking-tight">Indian Tabla Metronome</h2>
                            <p className="text-[#d46211]/60 text-xs">Acoustic Tabla drum synthesiser & Bols training</p>
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
                    {/* Left Panel: Taal & Scale Selectors */}
                    <div className="lg:w-80 p-6 border-r border-[#d46211]/10 flex flex-col gap-6 text-left shrink-0">
                        {/* Indian Taals list */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3">Select Taal</h3>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                                {TAALS.map((t) => (
                                    <button
                                        key={t.name}
                                        onClick={() => setSelectedTaal(t)}
                                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                                            selectedTaal.name === t.name 
                                                ? 'bg-[#d46211]/10 border-[#d46211] text-white shadow-xs' 
                                                : 'border-white/5 text-white/50 hover:border-white/10 hover:text-white/80'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <p className="font-bold text-xs text-[#d46211]">{t.name}</p>
                                            <span className="text-[9px] font-extrabold bg-[#d46211]/10 px-2 py-0.5 rounded-full text-[#d46211]">{t.beats} Beats</span>
                                        </div>
                                        <p className="text-[9px] text-white/40 mt-1 leading-normal">{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tuning Scale Pitch Select */}
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" /> Tabla Tuning (Pitch)
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {TABLA_PITCHES.map((pitch) => (
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
                    </div>

                    {/* Right Panel: Display screen & Drum simulation */}
                    <div className="flex-1 p-8 flex flex-col items-center justify-between gap-6 min-h-[350px]">
                        {/* Taal Beat Circle/Timeline Display Screen */}
                        <div className="w-full bg-black/40 border border-white/5 rounded-3xl p-5 flex flex-col items-center justify-center text-center relative">
                            {/* Current Bol & division */}
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Beat {currentBeat + 1} of {selectedTaal.beats}</span>
                            <h1 className="text-3xl md:text-4xl font-black text-white mt-1.5 tracking-wide leading-none min-h-[40px]">
                                {currentBeat >= 0 ? selectedTaal.bols[currentBeat] : 'Ready'}
                            </h1>
                            
                            {/* Division Sign: Sam (X), Khali (0), or Tali (number) */}
                            {currentBeat >= 0 && (
                                <span className={`absolute top-4 right-5 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border ${
                                    selectedTaal.signs[currentBeat] === '0' || selectedTaal.signs[currentBeat] === 'Khali'
                                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                        : 'bg-amber-500/10 border-orange-500/20 text-amber-500'
                                }`}>
                                    {selectedTaal.signs[currentBeat] === '0' || selectedTaal.signs[currentBeat] === 'Khali' ? '0' : selectedTaal.signs[currentBeat] === 'X' ? 'X' : selectedTaal.signs[currentBeat]}
                                </span>
                            )}

                            {/* Beats indicator bar */}
                            <div className="flex flex-wrap justify-center gap-1.5 mt-5 w-full">
                                {selectedTaal.bols.map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`h-2.5 rounded-full transition-all ${
                                            currentBeat === i 
                                                ? 'w-6 bg-amber-500 shadow-md shadow-orange-500/30' 
                                                : 'w-2.5 bg-white/10'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Interactive Tabla Drums Visual */}
                        <div className="flex items-center gap-10 my-4 select-none">
                            {/* Bayan (Left Bass Drum) */}
                            <div className="flex flex-col items-center gap-3">
                                <div 
                                    className={`w-32 h-32 rounded-full border bg-radial-gradient from-slate-600 via-slate-800 to-slate-950 flex items-center justify-center relative transition-all duration-75 shadow-lg ${
                                        playBayan 
                                            ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-105 skew-y-1' 
                                            : 'border-[#d46211]/20 shadow-black/80'
                                    }`}
                                    style={{
                                        boxShadow: playBayan ? '0 0 25px rgba(212,98,17,0.3), inset 0 4px 15px rgba(255,255,255,0.08)' : 'inset 0 4px 15px rgba(255,255,255,0.04)'
                                    }}
                                >
                                    {/* Black Syahi center patch */}
                                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                                        <div className="w-12 h-12 rounded-full bg-black"></div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-widest">Bayan (Bass)</span>
                            </div>

                            {/* Dayan (Right Treble Drum) */}
                            <div className="flex flex-col items-center gap-3">
                                <div 
                                    className={`w-28 h-28 rounded-full border bg-radial-gradient from-amber-700/80 via-amber-950 to-stone-950 flex items-center justify-center relative transition-all duration-75 shadow-lg ${
                                        playDayan 
                                            ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] scale-105 -skew-y-1' 
                                            : 'border-[#d46211]/20 shadow-black/80'
                                    }`}
                                    style={{
                                        boxShadow: playDayan ? '0 0 25px rgba(212,98,17,0.3), inset 0 4px 15px rgba(255,255,255,0.08)' : 'inset 0 4px 15px rgba(255,255,255,0.04)'
                                    }}
                                >
                                    {/* Black Syahi center patch */}
                                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner">
                                        <div className="w-9 h-9 rounded-full bg-black"></div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-widest">Dayan (Treble)</span>
                            </div>
                        </div>

                        {/* Adjusters (Sliders) */}
                        <div className="w-full max-w-md space-y-4">
                            {/* BPM Slider */}
                            <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl">
                                <Sliders className="w-4 h-4 text-[#d46211] shrink-0" />
                                <div className="flex-1 flex flex-col text-left">
                                    <div className="flex justify-between items-center text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">
                                        <span>Tempo (BPM)</span>
                                        <span className="text-[#d46211] font-mono">{bpm} BPM</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="40"
                                        max="220"
                                        step="2"
                                        value={bpm}
                                        onChange={(e) => setBpm(parseInt(e.target.value))}
                                        className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                    />
                                </div>
                            </div>

                            {/* Volume Slider */}
                            <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl">
                                <Volume2 className="w-4 h-4 text-[#d46211] shrink-0" />
                                <div className="flex-1 flex flex-col text-left">
                                    <div className="flex justify-between items-center text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">
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

                        {/* Controls Buttons */}
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
                                        <Square className="w-4 h-4 fill-white" /> Stop Tabla
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-white" /> Play Tabla
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
