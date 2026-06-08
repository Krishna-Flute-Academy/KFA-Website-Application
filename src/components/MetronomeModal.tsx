'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [
    { name: 'Embouchure Long Tones', bpm: 40, beats: 4, icon: '𝄞', desc: 'Slow, sustained breath control' },
    { name: 'Scale Agility Ramp', bpm: 80, beats: 4, ramp: true, icon: '↗', desc: '80→140 BPM over 3 min' },
    { name: 'Articulation Check', bpm: 100, beats: 6, icon: '♩', desc: 'Complex beat patterns' },
];

const SOUNDS = ['Woodblock', 'Tabla', 'Bell', 'Dholak', 'Flute Breath'];

// Mandala SVG
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

// Ripple component
function Ripple({ id }: { id: number }) {
    return (
        <span key={id} className="absolute inset-0 rounded-full border-2 border-[#d46211] animate-ping opacity-0"
            style={{ animationDuration: '0.8s', animationTimingFunction: 'ease-out' }} />
    );
}

export default function MetronomeModal({ onClose }: { onClose: () => void }) {
    const [bpm, setBpm] = useState(120);
    const [isPlaying, setIsPlaying] = useState(false);
    const [beats, setBeats] = useState(4);
    const [currentBeat, setCurrentBeat] = useState(-1);
    const [subdivisions, setSubdivisions] = useState<number[]>([1, 1, 1, 1]);
    const [ripples, setRipples] = useState<number[]>([]);
    const [tapTimes, setTapTimes] = useState<number[]>([]);
    const [selectedSound, setSelectedSound] = useState('Woodblock');
    const [showTala, setShowTala] = useState(false);
    const [isRampMode, setIsRampMode] = useState(false);
    const [mandalaAngle, setMandalaAngle] = useState(0);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const beatRef = useRef(0);
    const bpmRef = useRef(bpm);
    const isDragging = useRef(false);
    const lastY = useRef(0);
    const rampStartRef = useRef<{ bpm: number; time: number } | null>(null);

    useEffect(() => { bpmRef.current = bpm; }, [bpm]);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    const playTick = useCallback((down: boolean) => {
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
            const [hf, lf] = freqMap[selectedSound] || [880, 660];
            osc.frequency.value = down ? hf : lf;
            osc.type = selectedSound === 'Bell' ? 'sine' : 'triangle';
            gain.gain.setValueAtTime(down ? 0.35 : 0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch (_) {}
    }, [selectedSound]);

    const tick = useCallback(() => {
        const beat = beatRef.current;
        playTick(beat === 0);
        setCurrentBeat(beat);
        setMandalaAngle(prev => prev + 360 / beats);
        setRipples(prev => [...prev.slice(-2), Date.now()]);
        beatRef.current = (beat + 1) % beats;

        let nextBpm = bpmRef.current;
        if (isRampMode && rampStartRef.current) {
            const elapsed = (Date.now() - rampStartRef.current.time) / 1000;
            nextBpm = Math.min(140, rampStartRef.current.bpm + (elapsed / 180) * 60);
            setBpm(Math.round(nextBpm));
        }
        timerRef.current = setTimeout(tick, (60 / nextBpm) * 1000);
    }, [beats, playTick, isRampMode]);

    useEffect(() => {
        if (isPlaying) {
            beatRef.current = 0;
            if (isRampMode) rampStartRef.current = { bpm, time: Date.now() };
            tick();
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            setCurrentBeat(-1);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isPlaying]); // eslint-disable-line

    // Rotary knob drag
    const onKnobDown = (e: React.MouseEvent | React.TouchEvent) => {
        isDragging.current = true;
        lastY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    };
    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;
        const y = e.clientY;
        const delta = lastY.current - y;
        lastY.current = y;
        setBpm(p => Math.max(20, Math.min(240, p + delta)));
    }, []);
    const onMouseUp = useCallback(() => { isDragging.current = false; }, []);
    useEffect(() => {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
    }, [onMouseMove, onMouseUp]);

    // Tap tempo
    const handleTap = () => {
        const now = Date.now();
        const taps = [...tapTimes.slice(-7), now];
        setTapTimes(taps);
        if (taps.length > 1) {
            const avg = taps.slice(1).reduce((s, t, i) => s + t - taps[i], 0) / (taps.length - 1);
            setBpm(Math.max(20, Math.min(240, Math.round(60000 / avg))));
        }
    };

    const loadPreset = (p: typeof PRESETS[0]) => {
        setBpm(p.bpm); setBeats(p.beats);
        setSubdivisions(Array(p.beats).fill(1));
        setIsRampMode(!!p.ramp);
        setIsPlaying(false);
    };

    const toggleSub = (i: number) => {
        setSubdivisions(prev => prev.map((v, idx) => idx === i ? (v === 1 ? 2 : 1) : v));
    };

    const knobDeg = ((bpm - 20) / 220) * 270 - 135;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-lg" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="relative w-full max-w-4xl bg-gradient-to-br from-[#120b04] via-[#1e1008] to-[#0d0704] rounded-3xl border border-[#d46211]/25 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-[#d46211]/10">
                    <div className="flex items-center gap-3">
                        <span className="text-[#d46211] text-2xl">𝄞</span>
                        <div>
                            <h2 className="text-white font-bold text-lg tracking-tight">Practice Metronome</h2>
                            <p className="text-[#d46211]/60 text-xs">Ethereal Ripple & Mandala</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowTala(v => !v)} className="p-2 rounded-xl border border-[#d46211]/20 text-[#d46211]/60 hover:text-[#d46211] hover:border-[#d46211]/40 transition-all" title="Tala Sound Settings">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        </button>
                        <button onClick={onClose} className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Tala Drawer */}
                {showTala && (
                    <div className="px-8 py-4 bg-[#d46211]/5 border-b border-[#d46211]/10 flex flex-wrap gap-2 items-center">
                        <span className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mr-2">Sound Profile:</span>
                        {SOUNDS.map(s => (
                            <button key={s} onClick={() => setSelectedSound(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSound === s ? 'bg-[#d46211] text-white' : 'border border-[#d46211]/30 text-[#d46211]/70 hover:border-[#d46211] hover:text-[#d46211]'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto">
                    {/* Left: Beat Grid + Tap Tempo */}
                    <div className="lg:w-64 p-6 border-r border-[#d46211]/10 flex flex-col gap-6">
                        <div>
                            <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-4">Measure Setup</h3>
                            <div className="flex items-center gap-2 mb-4">
                                {[2,3,4,5,6,7,8].map(n => (
                                    <button key={n} onClick={() => { setBeats(n); setSubdivisions(Array(n).fill(1)); }}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${beats === n ? 'bg-[#d46211] text-white' : 'border border-[#d46211]/20 text-[#d46211]/50 hover:border-[#d46211]/50'}`}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="text-white/30 text-xs mb-3">Tap dots to add subdivisions</p>
                            <div className="flex flex-wrap gap-2">
                                {subdivisions.slice(0, beats).map((sub, i) => (
                                    <button key={i} onClick={() => toggleSub(i)}
                                        className={`relative flex items-center justify-center transition-all rounded-full ${currentBeat === i ? 'scale-125' : 'scale-100'}`}
                                        style={{ width: 36, height: 36 }}>
                                        <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${currentBeat === i ? 'border-[#d46211] bg-[#d46211] text-white shadow-lg shadow-[#d46211]/40' : 'border-[#d46211]/30 text-[#d46211]/50'}`}>
                                            {sub === 2 ? '♪♪' : '♩'}
                                        </span>
                                        {i === 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#d46211]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tap Tempo */}
                        <div className="mt-auto">
                            <p className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest mb-3">Tap Tempo</p>
                            <button onClick={handleTap}
                                className="w-full h-16 rounded-2xl border-2 border-[#d46211]/30 bg-gradient-to-b from-[#2a1a08] to-[#1a0e04] text-[#d46211] font-bold text-sm tracking-wide hover:border-[#d46211] hover:shadow-lg hover:shadow-[#d46211]/20 active:scale-95 transition-all"
                                style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(212,98,17,0.1)' }}>
                                TAP
                            </button>
                        </div>
                    </div>

                    {/* Center: Dial + Mandala + Ripple */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                        {/* Ripple pool */}
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            {ripples.map(r => <Ripple key={r} id={r} />)}
                            <div className="w-4 h-4 rounded-full bg-[#d46211]/40 border border-[#d46211]/60 flex-shrink-0" />
                        </div>

                        {/* Central Dial + Mandala */}
                        <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
                            {/* Mandala */}
                            <div className={`absolute inset-0 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-40'}`}>
                                <Mandala angle={mandalaAngle} active={isPlaying} />
                            </div>

                            {/* Outer glow ring */}
                            <div className={`absolute rounded-full border transition-all duration-300 ${isPlaying ? 'border-[#d46211]/50 shadow-xl' : 'border-[#d46211]/15'}`}
                                style={{ width: 220, height: 220, boxShadow: isPlaying ? '0 0 40px rgba(212,98,17,0.2)' : 'none' }} />

                            {/* Rotary Knob */}
                            <div ref={useRef<HTMLDivElement>(null) as any}
                                onMouseDown={onKnobDown}
                                className="relative cursor-ns-resize select-none flex items-center justify-center rounded-full"
                                style={{
                                    width: 180, height: 180, zIndex: 10,
                                    background: 'conic-gradient(from 0deg, #2a1a08, #3d2510, #2a1a08, #1a0e04, #2a1a08)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.4)',
                                    border: '2px solid rgba(212,98,17,0.3)',
                                    borderRadius: '50%',
                                }}>
                                {/* Swirl texture overlay */}
                                <div className="absolute inset-0 rounded-full opacity-20"
                                    style={{ background: `repeating-conic-gradient(rgba(212,98,17,0.15) 0deg, transparent 2deg, transparent 18deg, rgba(212,98,17,0.08) 20deg)` }} />

                                {/* Indicator dot */}
                                <div className="absolute" style={{ width: 8, height: 8, top: 14, left: '50%', marginLeft: -4, transformOrigin: '4px 76px', transform: `rotate(${knobDeg}deg)` }}>
                                    <div className="w-2 h-2 rounded-full bg-[#d46211] shadow-lg shadow-[#d46211]/60" />
                                </div>

                                {/* BPM display */}
                                <div className="text-center z-10">
                                    <div className="text-white font-bold leading-none" style={{ fontSize: 52, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 20px rgba(212,98,17,0.5)' }}>
                                        {bpm}
                                    </div>
                                    <div className="text-[#d46211]/60 text-xs font-bold tracking-widest uppercase mt-1">BPM</div>
                                </div>
                            </div>
                        </div>

                        {/* BPM fine controls */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => setBpm(p => Math.max(20, p - 1))} className="w-10 h-10 rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all text-xl">−</button>
                            <div className="text-white/40 text-xs font-bold tracking-widest">DRAG KNOB OR TAP</div>
                            <button onClick={() => setBpm(p => Math.min(240, p + 1))} className="w-10 h-10 rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all text-xl">+</button>
                        </div>

                        {/* Play/Stop */}
                        <button onClick={() => setIsPlaying(p => !p)}
                            className={`h-14 px-12 rounded-2xl font-bold text-base tracking-wide transition-all ${isPlaying ? 'bg-white/10 border-2 border-white/20 text-white hover:bg-white/15' : 'bg-[#d46211] text-white shadow-xl shadow-[#d46211]/30 hover:bg-[#c05510] hover:scale-[1.02]'}`}>
                            {isPlaying ? '⏹ Stop' : '▶ Start'}
                        </button>

                        {/* Ramp mode toggle */}
                        <div className="flex items-center gap-3">
                            <span className="text-white/40 text-xs">Static BPM</span>
                            <button onClick={() => setIsRampMode(v => !v)}
                                className={`relative w-10 h-5 rounded-full transition-all ${isRampMode ? 'bg-[#d46211]' : 'bg-white/10'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${isRampMode ? 'left-5' : 'left-0.5'}`} />
                            </button>
                            <span className="text-white/40 text-xs">Ramp Mode</span>
                        </div>
                    </div>

                    {/* Right: Practice Presets */}
                    <div className="lg:w-64 p-6 border-l border-[#d46211]/10 flex flex-col gap-4">
                        <h3 className="text-[#d46211]/70 text-xs font-bold uppercase tracking-widest">Practice Path</h3>
                        {PRESETS.map(p => (
                            <button key={p.name} onClick={() => loadPreset(p)}
                                className="text-left p-4 rounded-2xl border border-[#d46211]/15 bg-gradient-to-b from-[#2a1a08]/60 to-[#1a0e04]/60 hover:border-[#d46211]/40 hover:shadow-lg hover:shadow-[#d46211]/10 transition-all group"
                                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl mt-0.5 flex-shrink-0">{p.icon}</span>
                                    <div>
                                        <p className="text-[#d46211] font-bold text-sm group-hover:text-[#e07830] transition-colors">{p.name}</p>
                                        <p className="text-white/30 text-xs mt-1 leading-relaxed">{p.desc}</p>
                                        <p className="text-[#d46211]/50 text-xs mt-2 font-bold">{p.bpm} BPM · {p.beats}/4</p>
                                    </div>
                                </div>
                            </button>
                        ))}

                        <div className="mt-auto p-4 rounded-xl bg-[#d46211]/5 border border-[#d46211]/10">
                            <p className="text-[#d46211]/60 text-xs font-bold uppercase tracking-widest mb-2">Current</p>
                            <p className="text-white font-bold">{bpm} BPM</p>
                            <p className="text-white/40 text-xs">{beats}/4 time · {selectedSound}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
