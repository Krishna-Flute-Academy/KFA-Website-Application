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

const METRONOME_SOUNDS = ['Woodblock', 'Bell'];

// ── TABLA TAAL CONSTANTS ────────────────────────────────────────────────────
type BolStroke = 'dha' | 'dhin' | 'na' | 'ta' | 'ka' | 'ge' | 'tin' | 'silence';
type MatraAccent = 'sam' | 'tali' | 'khali';

interface TaalMatra {
    position: number;
    bol: string;
    stroke: BolStroke;
    accent: MatraAccent;
    vibhag: number;
}

interface TaalDef {
    id: string;
    name: string;
    nameHindi: string;
    totalMatras: number;
    vibhags: number[];
    defaultBpm: { vilambit: number; madhya: number; drut: number };
    description: string;
    matras: TaalMatra[];
}

const TABLA_TAALS: TaalDef[] = [
    {
        id: 'teen_taal',
        name: 'Teen Taal',
        nameHindi: 'तीन ताल',
        totalMatras: 16,
        vibhags: [4, 4, 4, 4],
        defaultBpm: { vilambit: 40, madhya: 90, drut: 160 },
        description: '16 matras • Most popular taal in Hindustani music',
        matras: [
            { position: 1,  bol: 'Dha',  stroke: 'dha',  accent: 'sam',   vibhag: 1 },
            { position: 2,  bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 1 },
            { position: 3,  bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 1 },
            { position: 4,  bol: 'Dha',  stroke: 'dha',  accent: 'tali',  vibhag: 1 },
            { position: 5,  bol: 'Dha',  stroke: 'dha',  accent: 'tali',  vibhag: 2 },
            { position: 6,  bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 2 },
            { position: 7,  bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 2 },
            { position: 8,  bol: 'Dha',  stroke: 'dha',  accent: 'tali',  vibhag: 2 },
            { position: 9,  bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 3 },
            { position: 10, bol: 'Tin',  stroke: 'tin',  accent: 'khali', vibhag: 3 },
            { position: 11, bol: 'Tin',  stroke: 'tin',  accent: 'khali', vibhag: 3 },
            { position: 12, bol: 'Ta',   stroke: 'ta',   accent: 'khali', vibhag: 3 },
            { position: 13, bol: 'Dha',  stroke: 'dha',  accent: 'tali',  vibhag: 4 },
            { position: 14, bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 4 },
            { position: 15, bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 4 },
            { position: 16, bol: 'Dha',  stroke: 'dha',  accent: 'tali',  vibhag: 4 },
        ]
    },
    {
        id: 'keherwa',
        name: 'Keherwa',
        nameHindi: 'कहरवा',
        totalMatras: 8,
        vibhags: [4, 4],
        defaultBpm: { vilambit: 60, madhya: 110, drut: 180 },
        description: '8 matras • Popular in folk, bhajan & semi-classical',
        matras: [
            { position: 1, bol: 'Dha',  stroke: 'dha',  accent: 'sam',   vibhag: 1 },
            { position: 2, bol: 'Ge',   stroke: 'ge',   accent: 'tali',  vibhag: 1 },
            { position: 3, bol: 'Na',   stroke: 'na',   accent: 'tali',  vibhag: 1 },
            { position: 4, bol: 'Ti',   stroke: 'tin',  accent: 'tali',  vibhag: 1 },
            { position: 5, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 2 },
            { position: 6, bol: 'Ka',   stroke: 'ka',   accent: 'khali', vibhag: 2 },
            { position: 7, bol: 'Dhin', stroke: 'dhin', accent: 'khali', vibhag: 2 },
            { position: 8, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 2 },
        ]
    },
    {
        id: 'dadra',
        name: 'Dadra',
        nameHindi: 'दादरा',
        totalMatras: 6,
        vibhags: [3, 3],
        defaultBpm: { vilambit: 50, madhya: 90, drut: 150 },
        description: '6 matras • Light & lyrical, used in thumri & dadra',
        matras: [
            { position: 1, bol: 'Dha',  stroke: 'dha',  accent: 'sam',   vibhag: 1 },
            { position: 2, bol: 'Dhin', stroke: 'dhin', accent: 'tali',  vibhag: 1 },
            { position: 3, bol: 'Na',   stroke: 'na',   accent: 'tali',  vibhag: 1 },
            { position: 4, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 2 },
            { position: 5, bol: 'Dhin', stroke: 'dhin', accent: 'khali', vibhag: 2 },
            { position: 6, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 2 },
        ]
    },
    {
        id: 'bhajni',
        name: 'Bhajni Theka',
        nameHindi: 'भजनी ठेका',
        totalMatras: 8,
        vibhags: [4, 4],
        defaultBpm: { vilambit: 55, madhya: 100, drut: 160 },
        description: '8 matras • Spiritual & devotional; used in bhajans',
        matras: [
            { position: 1, bol: 'Dha',  stroke: 'dha',  accent: 'sam',   vibhag: 1 },
            { position: 2, bol: 'Dha',  stroke: 'dha',  accent: 'tali',  vibhag: 1 },
            { position: 3, bol: 'Na',   stroke: 'na',   accent: 'tali',  vibhag: 1 },
            { position: 4, bol: 'Na',   stroke: 'na',   accent: 'tali',  vibhag: 1 },
            { position: 5, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 2 },
            { position: 6, bol: 'Ka',   stroke: 'ka',   accent: 'khali', vibhag: 2 },
            { position: 7, bol: 'Dha',  stroke: 'dha',  accent: 'khali', vibhag: 2 },
            { position: 8, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 2 },
        ]
    },
    {
        id: 'rupak',
        name: 'Rupak',
        nameHindi: 'रूपक',
        totalMatras: 7,
        vibhags: [3, 2, 2],
        defaultBpm: { vilambit: 45, madhya: 80, drut: 140 },
        description: '7 matras • Unique — starts on Khali. Used in classical ragas',
        matras: [
            { position: 1, bol: 'Tin',  stroke: 'tin',  accent: 'khali', vibhag: 1 },
            { position: 2, bol: 'Tin',  stroke: 'tin',  accent: 'khali', vibhag: 1 },
            { position: 3, bol: 'Na',   stroke: 'na',   accent: 'khali', vibhag: 1 },
            { position: 4, bol: 'Dhi',  stroke: 'dhin', accent: 'tali',  vibhag: 2 },
            { position: 5, bol: 'Na',   stroke: 'na',   accent: 'tali',  vibhag: 2 },
            { position: 6, bol: 'Dhi',  stroke: 'dhin', accent: 'tali',  vibhag: 3 },
            { position: 7, bol: 'Na',   stroke: 'na',   accent: 'tali',  vibhag: 3 },
        ]
    },
];

const TABLA_LAYA = [
    { id: 'vilambit', label: 'Vilambit', labelHindi: 'विलंबित', desc: 'Slow' },
    { id: 'madhya',   label: 'Madhya',   labelHindi: 'मध्य',    desc: 'Medium' },
    { id: 'drut',     label: 'Drut',     labelHindi: 'द्रुत',   desc: 'Fast' },
] as const;

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
    },
    {
        name: 'March (2/4)',
        description: 'Standard 2/4 march/polka groove',
        steps: 8,
        timeSigName: '2/4',
        groupingName: 'Standard',
        grid: [
            [true, false, false, false, true, false, false, false],
            [false, false, true, false, false, false, true, false],
            [true, false, true, false, true, false, true, false],
            [false, false, false, false, false, false, false, false],
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

export default function PracticeSuiteModal({ onClose, defaultTab = 'metronome' }: { onClose: () => void; defaultTab?: 'metronome' | 'tanpura' | 'drums' | 'combosetup' }) {
    // ── GENERAL STATES ──────────────────────────────────────────────────────
    const [activeTool, setActiveTool] = useState<'metronome' | 'tanpura' | 'drums' | 'combosetup'>(() => {
        if (defaultTab === 'combosetup') return 'combosetup';
        if (defaultTab === 'drums') return 'drums';
        if (defaultTab === 'tanpura') return 'tanpura';
        return 'metronome';
    });
    const activeRhythmTab = activeTool === 'drums' ? 'drums' : 'metronome';
    const [isMinimized, setIsMinimized] = useState(false);
    const [bpm, setBpm] = useState(105);

    // Drag Position State for Minimized Practice Suite Window
    const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('practice_suite_widget_pos');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {}
            }
        }
        return null;
    });

    const isModalDraggingRef = useRef(false);
    const modalDragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });
    const currentModalPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const modalRafIdRef = useRef<number | null>(null);
    const minModalRef = useRef<HTMLDivElement>(null);

    const handleModalDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        let currentX = modalPos?.x;
        let currentY = modalPos?.y;

        if (currentX === undefined || currentY === undefined || modalPos === null) {
            if (minModalRef.current) {
                const rect = minModalRef.current.getBoundingClientRect();
                currentX = rect.left;
                currentY = rect.top;
            } else {
                currentX = window.innerWidth - 340;
                currentY = window.innerHeight - 200;
            }
        }

        isModalDraggingRef.current = true;
        modalDragStartRef.current = {
            mouseX: clientX,
            mouseY: clientY,
            initialX: currentX,
            initialY: currentY
        };
        currentModalPosRef.current = { x: currentX, y: currentY };

        if (minModalRef.current) {
            minModalRef.current.style.transition = 'none';
            minModalRef.current.style.left = `${currentX}px`;
            minModalRef.current.style.top = `${currentY}px`;
            minModalRef.current.style.right = 'auto';
            minModalRef.current.style.bottom = 'auto';
        }

        const handleDragMove = (moveEvt: MouseEvent | TouchEvent) => {
            if (!isModalDraggingRef.current) return;
            if (moveEvt.cancelable) moveEvt.preventDefault();

            const moveX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
            const moveY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

            const deltaX = moveX - modalDragStartRef.current.mouseX;
            const deltaY = moveY - modalDragStartRef.current.mouseY;

            let newX = modalDragStartRef.current.initialX + deltaX;
            let newY = modalDragStartRef.current.initialY + deltaY;

            const modalWidth = minModalRef.current?.offsetWidth || 310;
            const modalHeight = minModalRef.current?.offsetHeight || 160;

            const maxX = window.innerWidth - modalWidth - 10;
            const maxY = window.innerHeight - modalHeight - 10;

            newX = Math.max(10, Math.min(newX, maxX));
            newY = Math.max(10, Math.min(newY, maxY));

            currentModalPosRef.current = { x: newX, y: newY };

            if (modalRafIdRef.current === null) {
                modalRafIdRef.current = requestAnimationFrame(() => {
                    modalRafIdRef.current = null;
                    if (minModalRef.current && isModalDraggingRef.current) {
                        minModalRef.current.style.left = `${currentModalPosRef.current.x}px`;
                        minModalRef.current.style.top = `${currentModalPosRef.current.y}px`;
                    }
                });
            }
        };

        const handleDragEnd = () => {
            if (!isModalDraggingRef.current) return;
            isModalDraggingRef.current = false;
            if (modalRafIdRef.current !== null) {
                cancelAnimationFrame(modalRafIdRef.current);
                modalRafIdRef.current = null;
            }
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);

            if (minModalRef.current) {
                minModalRef.current.style.transition = '';
            }

            const finalPos = currentModalPosRef.current;
            setModalPos(finalPos);
            if (typeof window !== 'undefined') {
                localStorage.setItem('practice_suite_widget_pos', JSON.stringify(finalPos));
            }
        };

        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
    };
    
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
    // Store raw bytes from the network — decoding happens lazily on first user tap
    // so it always runs inside an active AudioContext (required by mobile browsers).
    const tanpuraRawRef = useRef<ArrayBuffer | null>(null);
    const tanpuraBufferRef = useRef<AudioBuffer | null>(null); // decoded cache

    // Fetch the file bytes on mount (no AudioContext needed for this)
    useEffect(() => {
        fetch('/sounds/tanpura/Tanpura_c.mp3')
            .then(async (res) => {
                if (!res.ok) { console.error('❌ Tanpura fetch failed:', res.status); return; }
                const ct = res.headers.get('content-type') ?? '';
                if (ct.includes('text/html')) { console.error('❌ Tanpura file not found (got HTML).'); return; }
                tanpuraRawRef.current = await res.arrayBuffer();
                console.log('✅ Tanpura bytes fetched — will decode on first tap.');
            })
            .catch(e => console.error('❌ Tanpura fetch error:', e));
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
    const metronomeLastX = useRef(0);
    const knobRef = useRef<HTMLDivElement>(null);
    const isMetronomePlayingRef = useRef(isMetronomePlaying);

    // Sync metronome refs
    useEffect(() => { metronomeBpmRef.current = bpm; }, [bpm]);
    useEffect(() => { metronomeVolumeRef.current = metronomeVolume; }, [metronomeVolume]);
    useEffect(() => { metronomeSoundRef.current = selectedMetronomeSound; }, [selectedMetronomeSound]);
    useEffect(() => { metronomeBeatsRef.current = metronomeBeats; }, [metronomeBeats]);
    useEffect(() => { isMetronomePlayingRef.current = isMetronomePlaying; }, [isMetronomePlaying]);

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
    const drumsStepsPerBeatRef = useRef(selectedDrumsTimeSig.stepsPerBeat);
    const metronomeLastTickTimeRef = useRef<number>(0);
    const drumsLastTickTimeRef = useRef<number>(0);

    // Sync drums refs
    useEffect(() => { drumsBpmRef.current = bpm; }, [bpm]);
    useEffect(() => { drumsVolumeRef.current = drumsVolume; }, [drumsVolume]);
    useEffect(() => { drumsGridRef.current = drumsGrid; }, [drumsGrid]);
    useEffect(() => { drumsStepsCountRef.current = drumsActiveStepsCount; }, [drumsActiveStepsCount]);
    useEffect(() => { isDrumsPlayingRef.current = isDrumsPlaying; }, [isDrumsPlaying]);
    useEffect(() => { drumsStepsPerBeatRef.current = selectedDrumsTimeSig.stepsPerBeat; }, [selectedDrumsTimeSig]);

    // ── TABLA STATES ─────────────────────────────────────────────────────────
    const [isTablaPlaying, setIsTablaPlaying] = useState(false);
    const [tablaVolume, setTablaVolume] = useState(0.7);
    const [selectedTaal, setSelectedTaal] = useState<TaalDef>(TABLA_TAALS[0]);
    const [selectedLaya, setSelectedLaya] = useState<'vilambit' | 'madhya' | 'drut'>('madhya');
    const [currentTaalMatra, setCurrentTaalMatra] = useState(-1);
    const [taalBpm, setTaalBpm] = useState(TABLA_TAALS[0].defaultBpm.madhya);
    const [tablaScale, setTablaScale] = useState(SHRU_PITCHES[1]); // Default C#

    const tablaSchedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tablaNextBeatTimeRef = useRef(0);
    const tablaMatraIndexRef = useRef(0);
    const tablaIsPlayingRef = useRef(false);
    const tablaVolumeRef = useRef(tablaVolume);
    const taalBpmRef = useRef(taalBpm);
    const selectedTaalRef = useRef(selectedTaal);
    const tablaScaleRef = useRef(tablaScale);

    useEffect(() => { tablaVolumeRef.current = tablaVolume; }, [tablaVolume]);
    useEffect(() => { taalBpmRef.current = taalBpm; }, [taalBpm]);
    useEffect(() => { selectedTaalRef.current = selectedTaal; }, [selectedTaal]);
    useEffect(() => { tablaScaleRef.current = tablaScale; }, [tablaScale]);
    useEffect(() => { tablaIsPlayingRef.current = isTablaPlaying; }, [isTablaPlaying]);

    // ── TABLA AUDIO ENGINE ───────────────────────────────────────────────────
    // Synthesized strokes using Web Audio API — pitch shifted by tablaScale (same pattern as tanpura).
    const playTablaStroke = useCallback((
        ctx: AudioContext,
        stroke: BolStroke,
        accent: MatraAccent,
        vol: number,
        when: number,
        pitchRatio: number
    ) => {
        try {
            // Accent volume multipliers: Sam is loudest, Khali is lightest
            const accentMult = accent === 'sam' ? 1.0 : accent === 'tali' ? 0.72 : 0.38;
            const v = vol * accentMult;
            // Base frequency for tabla dayan tuned to C# and shifted by pitchRatio
            const baseFreq = 277.18 * pitchRatio; // C# as reference, scaled by shruti

            if (stroke === 'silence') return;

            if (stroke === 'dha' || stroke === 'dhin') {
                // Bayan (left bass drum) — low thump
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq * 0.28, when);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.14, when + 0.22);
                g.gain.setValueAtTime(0, when);
                g.gain.linearRampToValueAtTime(v * 0.9, when + 0.006);
                g.gain.exponentialRampToValueAtTime(0.001, when + (stroke === 'dhin' ? 0.38 : 0.22));
                osc.connect(g); g.connect(ctx.destination);
                osc.start(when); osc.stop(when + 0.45);

                // Dayan (right melodic ping) — higher pitched resonance
                const osc2 = ctx.createOscillator();
                const g2 = ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(baseFreq, when);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, when + 0.08);
                g2.gain.setValueAtTime(0, when);
                g2.gain.linearRampToValueAtTime(v * 0.55, when + 0.004);
                g2.gain.exponentialRampToValueAtTime(0.001, when + (stroke === 'dhin' ? 0.5 : 0.18));
                osc2.connect(g2); g2.connect(ctx.destination);
                osc2.start(when); osc2.stop(when + 0.6);
            }

            if (stroke === 'na' || stroke === 'ta') {
                // Dayan only — muted / rim stroke
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(baseFreq * 1.18, when);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, when + 0.06);
                g.gain.setValueAtTime(0, when);
                g.gain.linearRampToValueAtTime(v * 0.45, when + 0.003);
                g.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(when); osc.stop(when + 0.15);
            }

            if (stroke === 'ka' || stroke === 'ge') {
                // Bayan only — open or muted palm
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq * 0.32, when);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.18, when + 0.12);
                g.gain.setValueAtTime(0, when);
                g.gain.linearRampToValueAtTime(v * 0.65, when + 0.005);
                g.gain.exponentialRampToValueAtTime(0.001, when + (stroke === 'ge' ? 0.28 : 0.12));
                osc.connect(g); g.connect(ctx.destination);
                osc.start(when); osc.stop(when + 0.35);
            }

            if (stroke === 'tin') {
                // Tin — higher pitched dayan, crisp
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(baseFreq * 1.35, when);
                osc.frequency.exponentialRampToValueAtTime(baseFreq, when + 0.05);
                g.gain.setValueAtTime(0, when);
                g.gain.linearRampToValueAtTime(v * 0.38, when + 0.003);
                g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(when); osc.stop(when + 0.18);
            }
        } catch (_) {}
    }, []);

    // Lookahead Scheduler — fires every 25ms, schedules beats 100ms ahead using AudioContext time
    const TABLA_LOOKAHEAD_MS = 25;
    const TABLA_SCHEDULE_AHEAD = 0.1;

    const tablaScheduler = useCallback(() => {
        if (!tablaIsPlayingRef.current) return;
        const ctx = getCtx();
        const taal = selectedTaalRef.current;
        const secondsPerMatra = 60.0 / taalBpmRef.current;
        const pitchRatio = tablaScaleRef.current.freq / 277.18;

        while (tablaNextBeatTimeRef.current < ctx.currentTime + TABLA_SCHEDULE_AHEAD) {
            const matraIdx = tablaMatraIndexRef.current;
            const matra = taal.matras[matraIdx];
            playTablaStroke(ctx, matra.stroke, matra.accent, tablaVolumeRef.current, tablaNextBeatTimeRef.current, pitchRatio);
            // Update UI indicator — schedule setCurrentTaalMatra to fire at approximately the right visual time
            const visualDelay = Math.max(0, (tablaNextBeatTimeRef.current - ctx.currentTime) * 1000);
            const capturedIdx = matraIdx;
            setTimeout(() => { if (tablaIsPlayingRef.current) setCurrentTaalMatra(capturedIdx); }, visualDelay);
            tablaNextBeatTimeRef.current += secondsPerMatra;
            tablaMatraIndexRef.current = (matraIdx + 1) % taal.totalMatras;
        }
        tablaSchedulerRef.current = setTimeout(tablaScheduler, TABLA_LOOKAHEAD_MS);
    }, [playTablaStroke]);

    // Handle Tabla Play state changes
    useEffect(() => {
        if (isTablaPlaying) {
            const ctx = getCtx();
            if (ctx.state !== 'running') ctx.resume();
            tablaMatraIndexRef.current = 0;
            tablaNextBeatTimeRef.current = ctx.currentTime + 0.05;
            tablaIsPlayingRef.current = true;
            tablaScheduler();
        } else {
            tablaIsPlayingRef.current = false;
            if (tablaSchedulerRef.current) clearTimeout(tablaSchedulerRef.current);
            setCurrentTaalMatra(-1);
        }
        return () => { if (tablaSchedulerRef.current) clearTimeout(tablaSchedulerRef.current); };
    }, [isTablaPlaying, tablaScheduler]);

    // Restart scheduler when taal or laya changes while playing
    const restartTablaIfPlaying = useCallback(() => {
        if (!tablaIsPlayingRef.current) return;
        if (tablaSchedulerRef.current) clearTimeout(tablaSchedulerRef.current);
        const ctx = getCtx();
        tablaMatraIndexRef.current = 0;
        tablaNextBeatTimeRef.current = ctx.currentTime + 0.05;
        tablaScheduler();
    }, [tablaScheduler]);

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
            const freshVolume = tanpuraVolumeRef.current * 0.85;
            scheduleDroneChunk(ctx, buffer, pitchRatio, freshVolume, nextStart);
        }, msUntilSchedule);
    }, []);

    // pitchOverride lets us pass the NEW pitch directly from a click handler,
    // bypassing the React stale-closure problem with selectedPitch state.
    const startTanpura = useCallback(async (pitchOverride?: typeof SHRU_PITCHES[0]) => {
        try {
            const ctx = getCtx();
            // Resume FIRST — this is the user-gesture unlock that mobile requires
            if (ctx.state !== 'running') await ctx.resume();

            const pitch = pitchOverride ?? selectedPitch;

            // Decode lazily here, inside the running ctx — works on ALL mobile browsers
            if (!tanpuraBufferRef.current && tanpuraRawRef.current) {
                try {
                    // clone the buffer before decoding — decodeAudioData consumes (detaches) it
                    const clone = tanpuraRawRef.current.slice(0);
                    tanpuraBufferRef.current = await ctx.decodeAudioData(clone);
                    console.log('✅ Tanpura decoded on first tap.');
                } catch (e) {
                    console.error('❌ Decode failed:', e);
                }
            }

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
        if (!ctx) return;
        
        const targetVol = tanpuraVolume * 0.85;
        
        // 1. Adjust buffer drone nodes if playing
        if (droneNodesRef.current && droneNodesRef.current.length > 0) {
            droneNodesRef.current.forEach(node => {
                try {
                    node.gain.gain.setValueAtTime(node.gain.gain.value, ctx.currentTime);
                    node.gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 0.1);
                } catch (_) {}
            });
        }
        
        // 2. Adjust synthesizer fallback nodes if playing
        if (activeTanpuraNodesRef.current && activeTanpuraNodesRef.current.length > 0) {
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
                Woodblock: [880, 660], Bell: [1200, 900],
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
        metronomeLastTickTimeRef.current = Date.now();
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
            if (activeTool !== 'combosetup') {
                setIsDrumsPlaying(false);
            }

            metronomeBeatRef.current = 0;
            if (isMetronomeRampMode) metronomeRampStartRef.current = { bpm, time: Date.now() };
            
            if (activeTool === 'combosetup' && isDrumsPlayingRef.current) {
                // Perfect Downbeat Sync: reset drums and schedule both simultaneously
                if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
                drumsStepRef.current = 0;
                drumsTick();
            }
            
            metronomeTick();
        } else {
            if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current);
            setCurrentMetronomeBeat(-1);
        }
        return () => { if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current); };
    }, [isMetronomePlaying, metronomeTick, activeTool]); // eslint-disable-line


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
        drumsLastTickTimeRef.current = Date.now();

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

        const interval = ((60 / drumsBpmRef.current) / drumsStepsPerBeatRef.current) * 1000;
        drumsTimerRef.current = setTimeout(drumsTick, interval);
    }, [playDrumKick, playDrumSnare, playDrumHihat, playDrumShaker]);

    // Handle Drums Play state changes
    useEffect(() => {
        if (isDrumsPlaying) {
            if (activeTool !== 'combosetup') {
                setIsMetronomePlaying(false);
            }

            drumsStepRef.current = 0;
            
            if (activeTool === 'combosetup' && isMetronomePlayingRef.current) {
                // Perfect Downbeat Sync: reset metronome and schedule both simultaneously
                if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current);
                metronomeBeatRef.current = 0;
                metronomeTick();
            }
            
            drumsTick();
        } else {
            if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
            setCurrentDrumsStep(-1);
        }
        return () => { if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current); };
    }, [isDrumsPlaying, drumsTick, activeTool]); // eslint-disable-line


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

    // Rotary Knob drag for BPM (Metronome - Mobile & Desktop Touch Enabled)
    const onKnobDown = (e: React.MouseEvent | React.TouchEvent) => {
        metronomeIsDragging.current = true;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        metronomeLastY.current = clientY;
        metronomeLastX.current = clientX;
    };
    
    const onKnobMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!metronomeIsDragging.current) return;
        if ('touches' in e && e.cancelable) {
            e.preventDefault();
        }
        
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

        if (knobRef.current) {
            const rect = knobRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const prevAngle = Math.atan2(metronomeLastY.current - centerY, metronomeLastX.current - centerX);
            const newAngle = Math.atan2(clientY - centerY, clientX - centerX);
            let angleDelta = (newAngle - prevAngle) * (180 / Math.PI);
            
            if (angleDelta > 180) angleDelta -= 360;
            if (angleDelta < -180) angleDelta += 360;

            const verticalDelta = (metronomeLastY.current - clientY) * 0.75;
            const bpmChange = Math.abs(angleDelta) > 1 ? Math.round(angleDelta * 0.4) : Math.round(verticalDelta);

            if (bpmChange !== 0) {
                setBpm(p => Math.max(20, Math.min(240, p + bpmChange)));
                metronomeLastY.current = clientY;
                metronomeLastX.current = clientX;
            }
        } else {
            const delta = Math.round((metronomeLastY.current - clientY) * 0.75);
            if (delta !== 0) {
                setBpm(p => Math.max(20, Math.min(240, p + delta)));
                metronomeLastY.current = clientY;
            }
        }
    }, []);

    const onKnobUp = useCallback(() => { 
        metronomeIsDragging.current = false; 
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', onKnobMove);
        window.addEventListener('mouseup', onKnobUp);
        window.addEventListener('touchmove', onKnobMove, { passive: false });
        window.addEventListener('touchend', onKnobUp);
        return () => { 
            window.removeEventListener('mousemove', onKnobMove); 
            window.removeEventListener('mouseup', onKnobUp); 
            window.removeEventListener('touchmove', onKnobMove);
            window.removeEventListener('touchend', onKnobUp);
        };
    }, [onKnobMove, onKnobUp]);

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
        const matchingPreset = DRUM_PRESETS.find(p => p.timeSigName === sig.name);
        if (matchingPreset) {
            loadDrumsPreset(matchingPreset);
        } else {
            setSelectedDrumsTimeSig(sig);
            setSelectedDrumsGrouping(sig.groupings[0]);
            setDrumsActiveStepsCount(sig.totalSteps);
            setSelectedDrumsPresetName('Custom Beat');
            setDrumsGrid(Array.from({ length: 4 }, () => Array(24).fill(false)));

            drumsStepRef.current = 0;
            if (isDrumsPlaying) {
                if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
                drumsTick();
            } else {
                setCurrentDrumsStep(-1);
            }
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
        setIsTablaPlaying(false);
        tablaIsPlayingRef.current = false;
        stopTanpuraNodes();
        if (metronomeTimerRef.current) clearTimeout(metronomeTimerRef.current);
        if (drumsTimerRef.current) clearTimeout(drumsTimerRef.current);
        if (tablaSchedulerRef.current) clearTimeout(tablaSchedulerRef.current);
        onClose();
    };

    const knobDeg = ((bpm - 20) / 220) * 270 - 135;

    // Sync defaultTab changes to activeTool & auto-unminimize when user clicks a tool from UI
    useEffect(() => {
        if (defaultTab) {
            setActiveTool(defaultTab);
            setIsMinimized(false);
        }
    }, [defaultTab]);

    if (isMinimized) {
        return (
            <div
                ref={minModalRef}
                onMouseDown={handleModalDragStart}
                onTouchStart={handleModalDragStart}
                className={`${modalPos ? 'fixed z-[100]' : 'fixed bottom-5 right-5 z-[100]'} w-[310px] sm:w-[320px] max-w-[calc(100vw-2rem)] bg-gradient-to-br from-[#0c0f12] via-[#141b22] to-[#080b0d] rounded-2xl border border-[#d46211]/40 shadow-2xl p-2.5 sm:p-3 flex flex-col gap-2 text-white text-left font-sans select-none backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300 cursor-grab active:cursor-grabbing`}
                style={{ fontFamily: 'Lexend, sans-serif', ...(modalPos ? { left: `${modalPos.x}px`, top: `${modalPos.y}px`, right: 'auto', bottom: 'auto' } : {}) }}
            >
                {/* Minimized Header & Tool Quick Switcher */}
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-white/40 text-sm cursor-grab shrink-0">drag_indicator</span>
                        <div className="w-2 h-2 rounded-full bg-[#d46211] animate-pulse shrink-0" />
                        <span className="font-extrabold text-[10px] tracking-tight text-amber-500 uppercase font-mono truncate">
                            {activeTool === 'tanpura' ? 'KFA Tanpura' : activeTool === 'metronome' ? 'KFA Metronome' : activeTool === 'drums' ? 'KFA Drums' : 'KFA Combo'}
                        </span>
                    </div>

                    {/* Quick Tab Switcher */}
                    <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
                        {([
                            { id: 'metronome', label: 'Metronome', icon: '♩' },
                            { id: 'tanpura',   label: 'Tanpura',   icon: '♪' },
                            { id: 'drums',     label: 'Drums',     icon: '⬡' },
                            { id: 'combosetup',label: 'Combo',     icon: '⊞' },
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTool(tab.id)}
                                title={tab.label}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    activeTool === tab.id
                                        ? 'bg-[#d46211] text-white shadow-xs'
                                        : 'text-white/40 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {tab.icon}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button 
                            onClick={() => setIsMinimized(false)} 
                            title="Expand to Full View"
                            className="p-1 rounded-md border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer"
                        >
                            <Maximize2 className="w-3 h-3" />
                        </button>
                        <button 
                            onClick={handleClose} 
                            title="Stop Audio & Close"
                            className="p-1 rounded-md border border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-[#d46211]/50 transition-all hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* 1. Tanpura Section */}
                {activeTool === 'tanpura' && (
                    <div className="flex flex-col gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="font-extrabold text-[#d46211] uppercase tracking-wider flex items-center gap-1">
                                <Music className="w-3 h-3" /> {selectedPitch.label}
                            </span>
                            <span className="font-bold text-white/60 truncate max-w-[120px]">{selectedTuningMode.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                            <button 
                                onClick={() => setIsTanpuraPlaying(!isTanpuraPlaying)}
                                className={`h-7 px-3 rounded-md font-extrabold text-[11px] tracking-wide uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                    isTanpuraPlaying 
                                        ? 'bg-[#d46211]/20 border border-[#d46211]/40 text-[#d46211] hover:bg-[#d46211]/30' 
                                        : 'bg-[#d46211] text-white hover:bg-[#c05510]'
                                }`}
                            >
                                {isTanpuraPlaying ? (
                                    <><Square className="w-2.5 h-2.5 fill-[#d46211]" /> Stop</>
                                ) : (
                                    <><Play className="w-2.5 h-2.5 fill-white" /> Play</>
                                )}
                            </button>
                            
                            <div className="flex-1 flex items-center gap-1.5">
                                <Volume2 className="w-3 h-3 text-white/40 shrink-0" />
                                <input 
                                    type="range" min="0" max="1.0" step="0.05" value={tanpuraVolume}
                                    onChange={(e) => setTanpuraVolume(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Metronome Section */}
                {activeTool === 'metronome' && (
                    <div className="flex flex-col gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="font-extrabold text-[#d46211] uppercase tracking-wider flex items-center gap-1">
                                <Volume2 className="w-3 h-3" /> BEAT {metronomeBeats}/4
                            </span>
                            <span className="font-bold text-white/80 font-mono bg-white/10 px-1.5 py-0.5 rounded">{bpm} BPM</span>
                        </div>

                        {/* Beat Visualizer Indicators */}
                        <div className="flex items-center gap-1 justify-center py-0.5">
                            {Array.from({ length: metronomeBeats }).map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`h-1.5 flex-1 rounded-full transition-all duration-100 ${
                                        currentMetronomeBeat === i 
                                            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' 
                                            : 'bg-white/15'
                                    }`} 
                                />
                            ))}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => {
                                    getCtx().resume();
                                    setIsMetronomePlaying(!isMetronomePlaying);
                                }}
                                className={`h-8 px-3 rounded-md font-extrabold text-[11px] tracking-wide uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                    isMetronomePlaying 
                                        ? 'bg-[#d46211]/20 border border-[#d46211]/40 text-[#d46211] hover:bg-[#d46211]/30' 
                                        : 'bg-[#d46211] text-white hover:bg-[#c05510]'
                                }`}
                            >
                                {isMetronomePlaying ? (
                                    <><Square className="w-2.5 h-2.5 fill-[#d46211]" /> Stop</>
                                ) : (
                                    <><Play className="w-2.5 h-2.5 fill-white" /> Play</>
                                )}
                            </button>
                            
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-0.5">
                                    <button onClick={() => setBpm(b => Math.max(20, b - 5))} className="px-1 py-0.5 rounded border border-white/10 text-white/50 hover:bg-white/10 text-[9px] font-mono font-bold cursor-pointer">-5</button>
                                    <button onClick={() => setBpm(b => Math.max(20, b - 1))} className="w-5 h-5 rounded-full border border-white/15 text-white/70 hover:bg-white/10 flex items-center justify-center font-bold text-[11px] cursor-pointer">-</button>
                                    <span className="text-[11px] font-mono text-white font-black">{bpm}</span>
                                    <button onClick={() => setBpm(b => Math.min(240, b + 1))} className="w-5 h-5 rounded-full border border-white/15 text-white/70 hover:bg-white/10 flex items-center justify-center font-bold text-[11px] cursor-pointer">+</button>
                                    <button onClick={() => setBpm(b => Math.min(240, b + 5))} className="px-1 py-0.5 rounded border border-white/10 text-white/50 hover:bg-white/10 text-[9px] font-mono font-bold cursor-pointer">+5</button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Volume2 className="w-3 h-3 text-white/40 shrink-0" />
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
                    <div className="flex flex-col gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="font-extrabold text-[#d46211] uppercase tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs font-bold">album</span> Drums
                            </span>
                            <span className="font-bold text-white/60 truncate max-w-[130px]">{selectedDrumsPresetName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsDrumsPlaying(!isDrumsPlaying)}
                                className={`h-8 px-3 rounded-md font-extrabold text-[11px] tracking-wide uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                    isDrumsPlaying 
                                        ? 'bg-[#d46211]/20 border border-[#d46211]/40 text-[#d46211] hover:bg-[#d46211]/30' 
                                        : 'bg-[#d46211] text-white hover:bg-[#c05510]'
                                }`}
                            >
                                {isDrumsPlaying ? (
                                    <><Square className="w-2.5 h-2.5 fill-[#d46211]" /> Stop</>
                                ) : (
                                    <><Play className="w-2.5 h-2.5 fill-white" /> Play</>
                                )}
                            </button>
                            
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-0.5">
                                    <button onClick={() => setBpm(b => Math.max(20, b - 5))} className="px-1 py-0.5 rounded border border-white/10 text-white/50 hover:bg-white/10 text-[9px] font-mono font-bold cursor-pointer">-5</button>
                                    <button onClick={() => setBpm(b => Math.max(20, b - 1))} className="w-5 h-5 rounded-full border border-white/15 text-white/70 hover:bg-white/10 flex items-center justify-center font-bold text-[11px] cursor-pointer">-</button>
                                    <span className="text-[11px] font-mono text-white font-black">{bpm} BPM</span>
                                    <button onClick={() => setBpm(b => Math.min(240, b + 1))} className="w-5 h-5 rounded-full border border-white/15 text-white/70 hover:bg-white/10 flex items-center justify-center font-bold text-[11px] cursor-pointer">+</button>
                                    <button onClick={() => setBpm(b => Math.min(240, b + 5))} className="px-1 py-0.5 rounded border border-white/10 text-white/50 hover:bg-white/10 text-[9px] font-mono font-bold cursor-pointer">+5</button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Volume2 className="w-3 h-3 text-white/40 shrink-0" />
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

                {/* 4. Combo Setup Section */}
                {activeTool === 'combosetup' && (
                    <div className="flex flex-col gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="font-extrabold text-[#d46211] uppercase tracking-wider flex items-center gap-1">
                                ⊞ Combo Mixer
                            </span>
                            <span className={`px-2 py-0.5 rounded ${isDrumsPlaying ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/30'}`}>Drums</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5">
                            <button onClick={() => setBpm(b => Math.max(20, b - 5))} className="px-1.5 py-0.5 rounded border border-white/10 text-white/50 hover:bg-white/10 text-[9px] font-mono font-bold">-5</button>
                            <button onClick={() => setBpm(b => Math.max(20, b - 1))} className="w-6 h-6 rounded-full border border-white/15 text-white/70 hover:bg-white/10 flex items-center justify-center font-bold text-xs">-</button>
                            <span className="text-xs font-mono text-white font-black">{bpm} BPM</span>
                            <button onClick={() => setBpm(b => Math.min(240, b + 1))} className="w-6 h-6 rounded-full border border-white/15 text-white/70 hover:bg-white/10 flex items-center justify-center font-bold text-xs">+</button>
                            <button onClick={() => setBpm(b => Math.min(240, b + 5))} className="px-1.5 py-0.5 rounded border border-white/10 text-white/50 hover:bg-white/10 text-[9px] font-mono font-bold">+5</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg" onClick={e => e.target === e.currentTarget && setIsMinimized(true)}>
            <div className={`relative w-full bg-gradient-to-br from-[#0c0f12] via-[#141b22] to-[#080b0d] rounded-3xl border border-[#d46211]/25 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
                activeTool === 'tanpura' ? 'max-w-md h-auto my-auto' : activeTool === 'metronome' ? 'max-w-2xl h-auto my-auto' : activeTool === 'drums' ? 'max-w-5xl h-auto my-auto' : 'max-w-4xl h-auto my-auto'
            }`}>
                
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-8 pt-5 pb-4 border-b border-[#d46211]/10 bg-slate-900/40">
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
                            <h2 className="text-white font-black text-sm md:text-base tracking-tight animate-in fade-in duration-300">
                                {activeTool === 'tanpura' ? 'Tanpura Drone' : activeTool === 'metronome' ? 'Practice Metronome' : activeTool === 'drums' ? 'Drum Beats Sequencer' : 'Combo Session Mixer'}
                            </h2>
                            <p className="text-[#d46211]/60 text-xs md:text-sm animate-in fade-in duration-300">
                                {activeTool === 'tanpura' 
                                    ? 'Indian classical tuning & shruti drone' 
                                    : activeTool === 'metronome' 
                                        ? 'Keep perfect time with speed adjustments' 
                                        : activeTool === 'drums'
                                            ? 'Interactive step sequencer for flute play-along grooves'
                                            : 'Club and control multiple practice tools simultaneously'}
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
                            onClick={() => {
                                if (isMetronomePlaying || isTanpuraPlaying || isDrumsPlaying) {
                                    setIsMinimized(true);
                                } else {
                                    handleClose();
                                }
                            }} 
                            title={isMetronomePlaying || isTanpuraPlaying || isDrumsPlaying ? "Minimize to background (audio playing)" : "Close"} 
                            className="p-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── TAB NAV ── */}
                <div className="flex items-center gap-1 px-6 pt-4 border-b border-white/5 bg-black/20">
                    {([
                        { id: 'tanpura',   label: 'Tanpura',   icon: '♪' },
                        { id: 'metronome', label: 'Metronome', icon: '♩' },
                        { id: 'drums',     label: 'Drum Beats',icon: '⬡' },
                        { id: 'combosetup',label: 'Combo',     icon: '⊞' },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTool(tab.id)}
                            className={`px-3 py-2 text-[11px] font-extrabold tracking-wide rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 ${
                                activeTool === tab.id
                                    ? 'text-[#d46211] border-[#d46211] bg-[#d46211]/5'
                                    : 'text-white/35 border-transparent hover:text-white/60 hover:border-white/20'
                            }`}
                        >
                            <span className="text-sm">{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
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

                                            <div 
                                                ref={knobRef}
                                                onMouseDown={onKnobDown}
                                                onTouchStart={onKnobDown}
                                                className="relative cursor-ns-resize touch-none select-none flex items-center justify-center rounded-full"
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
                                        <div className="flex-1 flex gap-1 justify-start">
                                            {Array.from({ length: drumsActiveStepsCount }).map((_, stepIdx) => {
                                                const isGroupStart = selectedDrumsGrouping.dividers.includes(stepIdx);
                                                return (
                                                    <React.Fragment key={stepIdx}>
                                                        {isGroupStart && <div className="w-2 h-full shrink-0 border-l border-white/20"></div>}
                                                        <div className={`text-[10px] font-black w-6 sm:w-7 md:w-8 shrink-0 text-center transition-colors ${
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
                                                <div className="flex-1 flex gap-1 justify-start">
                                                    {Array.from({ length: drumsActiveStepsCount }).map((_, stepIdx) => {
                                                        const isActive = drumsGrid[trackIdx][stepIdx];
                                                        const isCurrent = currentDrumsStep === stepIdx;
                                                        const isGroupStart = selectedDrumsGrouping.dividers.includes(stepIdx);
                                                        return (
                                                            <React.Fragment key={stepIdx}>
                                                                {isGroupStart && <div className="w-2 h-full shrink-0 border-l border-white/20"></div>}
                                                                <button onClick={() => handleToggleDrumsNode(trackIdx, stepIdx)}
                                                                    className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 shrink-0 rounded-md border transition-all relative ${isActive ? 'bg-[#d46211] border-[#d46211] shadow-[0_0_6px_rgba(212,98,17,0.35)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
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
                                        <div className="flex-1 flex gap-1 justify-start">
                                            {Array.from({ length: drumsActiveStepsCount }).map((_, stepIdx) => {
                                                const isGroupStart = selectedDrumsGrouping.dividers.includes(stepIdx);
                                                return (
                                                    <React.Fragment key={stepIdx}>
                                                        {isGroupStart && <div className="w-2 h-full shrink-0 border-l border-white/20"></div>}
                                                        <div className={`h-1 rounded-full transition-all w-6 sm:w-7 md:w-8 shrink-0 ${currentDrumsStep === stepIdx ? 'bg-[#d46211]' : 'bg-white/5'}`} />
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Drum Controls (Volume, Tempo & Clear) */}
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-4 flex-1">
                                        {/* Drums Volume */}
                                        <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl flex-1 min-w-[200px] max-w-sm">
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

                                        {/* Drums Tempo / BPM */}
                                        <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl flex-1 min-w-[200px] max-w-sm">
                                            <Sliders className="w-4 h-4 text-[#d46211]" />
                                            <div className="flex-1 flex flex-col text-left">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">
                                                    <span>Tempo</span>
                                                    <span className="text-[#d46211] font-mono">{bpm} BPM</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setBpm(p => Math.max(20, p - 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all text-sm">−</button>
                                                    <input 
                                                        type="range" min="20" max="240" step="1" value={bpm}
                                                        onChange={(e) => setBpm(parseInt(e.target.value))}
                                                        className="flex-1 h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                                    />
                                                    <button onClick={() => setBpm(p => Math.min(240, p + 1))} className="w-6 h-6 flex items-center justify-center rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all text-sm">+</button>
                                                </div>
                                            </div>
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

                    {/* ──── VIEW 4: NEW SETUP (COMBO MIXER) ──── */}
                    {activeTool === 'combosetup' && (
                        <div className="w-full p-6 flex flex-col gap-6 overflow-y-auto max-h-[85vh] text-left">
                            {/* Master Control Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
                                <div>
                                    <h3 className="text-white font-extrabold text-lg tracking-tight">Master Console</h3>
                                    <p className="text-white/40 text-xs mt-0.5">Control the main tempo and sync of your session.</p>
                                </div>
                                {/* BPM controls */}
                                <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl">
                                    <div className="text-left">
                                        <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mb-1">Session Tempo</div>
                                        <div className="text-[#d46211] font-mono font-black text-sm">{bpm} BPM</div>
                                    </div>
                                    <div className="h-6 border-l border-white/10" />
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setBpm(p => Math.max(20, p - 1))} className="w-7 h-7 rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all flex items-center justify-center">−</button>
                                        <input 
                                            type="range" min="20" max="240" step="1" value={bpm}
                                            onChange={(e) => setBpm(parseInt(e.target.value))}
                                            className="w-32 h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                        />
                                        <button onClick={() => setBpm(p => Math.min(240, p + 1))} className="w-7 h-7 rounded-full border border-[#d46211]/30 text-[#d46211] font-bold hover:bg-[#d46211]/10 transition-all flex items-center justify-center">+</button>
                                    </div>
                                    <button onClick={handleTapTempo}
                                        className="h-7 px-3 rounded-lg border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider">
                                        Tap
                                    </button>
                                </div>
                            </div>

                            {/* 3 Columns Panel */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Column 1: Tanpura */}
                                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Music className="w-4 h-4 text-[#d46211]" />
                                            <span className="font-extrabold text-sm text-white">Tanpura Drone</span>
                                        </div>
                                        <span className={`w-2 h-2 rounded-full ${isTanpuraPlaying ? 'bg-green-500 shadow-md shadow-green-500/50' : 'bg-white/15'}`} />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1.5">Scale / Key (Shruti)</label>
                                        <select 
                                            value={selectedPitch.label}
                                            onChange={async (e) => {
                                                const p = SHRU_PITCHES.find(x => x.label === e.target.value);
                                                if (p) {
                                                    setSelectedPitch(p);
                                                    stopTanpuraNodes();
                                                    if (isTanpuraPlaying) {
                                                        await startTanpura(p);
                                                    }
                                                }
                                            }}
                                            className="w-full bg-black/45 border border-white/10 hover:border-[#d46211]/30 text-white text-xs font-bold rounded-xl p-2.5 outline-none cursor-pointer transition-all"
                                        >
                                            {SHRU_PITCHES.map(p => (
                                                <option key={p.label} value={p.label} className="bg-[#141b22] text-white font-bold">{p.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1.5">Tuning Mode</label>
                                        <select 
                                            value={selectedTuningMode.id}
                                            onChange={(e) => {
                                                const m = TUNING_MODES.find(x => x.id === e.target.value);
                                                if (m) setSelectedTuningMode(m);
                                            }}
                                            className="w-full bg-black/45 border border-white/10 hover:border-[#d46211]/30 text-white text-xs font-bold rounded-xl p-2.5 outline-none cursor-pointer transition-all"
                                        >
                                            {TUNING_MODES.map(m => (
                                                <option key={m.id} value={m.id} className="bg-[#141b22] text-white font-bold">{m.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1 mt-1">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                            <span>Volume</span>
                                            <span className="text-[#d46211] font-mono">{Math.round(tanpuraVolume * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" min="0" max="1.0" step="0.05" value={tanpuraVolume}
                                            onChange={(e) => setTanpuraVolume(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                        />
                                    </div>

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
                                        className={`w-full h-10 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 mt-auto ${isTanpuraPlaying ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' : 'bg-[#d46211] text-white shadow-md shadow-orange-500/20 hover:bg-[#c05510]'}`}>
                                        {isTanpuraPlaying ? <><Square className="w-3 h-3 fill-white" /> Stop Drone</> : <><Play className="w-3 h-3 fill-white" /> Play Drone</>}
                                    </button>
                                </div>

                                {/* Column 2: Metronome */}
                                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="w-4 h-4 text-[#d46211]" />
                                            <span className="font-extrabold text-sm text-white">Metronome</span>
                                        </div>
                                        <span className={`w-2 h-2 rounded-full ${isMetronomePlaying ? 'bg-green-500 shadow-md shadow-green-500/50' : 'bg-white/15'}`} />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1.5">Sound Style</label>
                                        <select 
                                            value={selectedMetronomeSound}
                                            onChange={(e) => setSelectedMetronomeSound(e.target.value)}
                                            className="w-full bg-black/45 border border-white/10 hover:border-[#d46211]/30 text-white text-xs font-bold rounded-xl p-2.5 outline-none cursor-pointer transition-all"
                                        >
                                            {METRONOME_SOUNDS.map(s => (
                                                <option key={s} value={s} className="bg-[#141b22] text-white font-bold">{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1.5">Time Signature</label>
                                        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-white/70 py-2.5 bg-black/35 rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Beats</p>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => setMetronomeBeats(p => Math.max(1, p - 1))} className="text-[#d46211] font-black text-sm px-1.5 hover:bg-white/5 rounded">-</button>
                                                    <span className="font-mono text-white">{metronomeBeats}</span>
                                                    <button onClick={() => setMetronomeBeats(p => Math.min(16, p + 1))} className="text-[#d46211] font-black text-sm px-1.5 hover:bg-white/5 rounded">+</button>
                                                </div>
                                            </div>
                                            <div className="border-l border-white/5">
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Subdiv</p>
                                                <span className="font-mono text-white/60">Quarter</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                            <span>Volume</span>
                                            <span className="text-[#d46211] font-mono">{Math.round(metronomeVolume * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" min="0" max="1.0" step="0.05" value={metronomeVolume}
                                            onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                        />
                                    </div>

                                    <button 
                                        onClick={() => {
                                            getCtx().resume();
                                            setIsMetronomePlaying(!isMetronomePlaying);
                                        }}
                                        className={`w-full h-10 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 mt-auto ${isMetronomePlaying ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' : 'bg-[#d46211] text-white shadow-md shadow-orange-500/20 hover:bg-[#c05510]'}`}>
                                        {isMetronomePlaying ? <><Square className="w-3 h-3 fill-white" /> Stop Metronome</> : <><Play className="w-3 h-3 fill-white" /> Play Metronome</>}
                                    </button>
                                </div>

                                {/* Column 3: Drums */}
                                <div className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base font-bold text-[#d46211]">album</span>
                                            <span className="font-extrabold text-sm text-white">Drum Beats</span>
                                        </div>
                                        <span className={`w-2 h-2 rounded-full ${isDrumsPlaying ? 'bg-green-500 shadow-md shadow-green-500/50' : 'bg-white/15'}`} />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1.5">Preset Groove</label>
                                        <select 
                                            value={selectedDrumsPresetName}
                                            onChange={(e) => {
                                                const p = DRUM_PRESETS.find(x => x.name === e.target.value);
                                                if (p) loadDrumsPreset(p);
                                            }}
                                            className="w-full bg-black/45 border border-white/10 hover:border-[#d46211]/30 text-white text-xs font-bold rounded-xl p-2.5 outline-none cursor-pointer transition-all"
                                        >
                                            {DRUM_PRESETS.map(p => (
                                                <option key={p.name} value={p.name} className="bg-[#141b22] text-white font-bold">{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1.5">Time Signature & Feel</label>
                                        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-white/70 py-2.5 bg-black/35 rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Signature</p>
                                                <span className="font-mono text-white">{selectedDrumsTimeSig.name}</span>
                                            </div>
                                            <div className="border-l border-white/5">
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Feel</p>
                                                <span className="font-mono text-white/60 truncate block px-1">{selectedDrumsGrouping.label}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                            <span>Volume</span>
                                            <span className="text-[#d46211] font-mono">{Math.round(drumsVolume * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" min="0" max="1.0" step="0.05" value={drumsVolume}
                                            onChange={(e) => setDrumsVolume(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/10 accent-[#d46211] rounded-lg cursor-pointer outline-none"
                                        />
                                    </div>

                                    <button 
                                        onClick={() => setIsDrumsPlaying(!isDrumsPlaying)}
                                        className={`w-full h-10 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 mt-auto ${isDrumsPlaying ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15' : 'bg-[#d46211] text-white shadow-md shadow-orange-500/20 hover:bg-[#c05510]'}`}>
                                        {isDrumsPlaying ? <><Square className="w-3 h-3 fill-white" /> Stop Beats</> : <><Play className="w-3 h-3 fill-white" /> Play Beats</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
