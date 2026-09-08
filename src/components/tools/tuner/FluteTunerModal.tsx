'use client';

import React, { useEffect } from 'react';
import { 
    X, 
    Mic, 
    MicOff, 
    ShieldCheck, 
    AlertCircle, 
    Volume2, 
    Sparkles, 
    Music2 
} from 'lucide-react';
import { usePitchDetector } from '../../../hooks/usePitchDetector';
import TunerMeter from './TunerMeter';
import RootNoteSelector from './RootNoteSelector';
import TunerSettings from './TunerSettings';
import TunerHelp from './TunerHelp';

interface FluteTunerModalProps {
    onClose: () => void;
}

export default function FluteTunerModal({ onClose }: FluteTunerModalProps) {
    const {
        isListening,
        detectedNote,
        inputLevel,
        rawInputVolume,
        error,
        settings,
        start,
        stop,
        setSelectedSa,
        setA4Reference,
        setTunerMode
    } = usePitchDetector();

    // Ensure audio and mic stop immediately if modal is closed
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                stop();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, stop]);

    const isIndianMode = settings.tunerMode === 'indian';

    // Primary and secondary note display calculations
    let primaryDisplayTitle = '—';
    let secondaryDisplaySubtitle = 'Play your flute to tune';
    let saptakLabel = '';

    if (detectedNote) {
        if (isIndianMode && detectedNote.swara) {
            primaryDisplayTitle = detectedNote.swara.displayName;
            secondaryDisplaySubtitle = `${detectedNote.fullWesternNote} (${detectedNote.enharmonicName}${detectedNote.octave})`;
            saptakLabel = detectedNote.swara.saptakLabel;
        } else {
            primaryDisplayTitle = detectedNote.fullWesternNote;
            secondaryDisplaySubtitle = detectedNote.enharmonicName !== detectedNote.noteName 
                ? `${detectedNote.enharmonicName}${detectedNote.octave}`
                : `Octave ${detectedNote.octave}`;
        }
    } else if (isListening) {
        primaryDisplayTitle = isIndianMode ? 'SA / SUR' : 'NOTE';
        secondaryDisplaySubtitle = 'Listening for flute tone...';
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Modal Box */}
            <div className="relative w-full max-w-xl max-h-[95vh] flex flex-col bg-[#FAF6F0] rounded-3xl shadow-2xl border border-amber-900/10 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200/90 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#d46211] border border-orange-100 flex items-center justify-center shrink-0">
                            <Music2 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-black text-sm sm:text-base text-slate-800">
                                    Flute Tuner
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-[#a15912] uppercase tracking-wider">
                                    {isIndianMode ? 'Bansuri Sur' : 'Chromatic'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Real-time pitch & Sur detector for Bansuri students
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            stop();
                            onClose();
                        }}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0"
                        title="Close Tuner"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                    
                    {/* Error Banner */}
                    {error && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <strong className="font-bold block">Microphone Access Notice</strong>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Main Pitch Card */}
                    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs text-center relative overflow-hidden">
                        
                        {/* Background subtle radial glow when note is in tune */}
                        {detectedNote?.status === 'in_tune' && (
                            <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none animate-pulse" />
                        )}

                        {/* Top Meta info: Mode + Saptak */}
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1 px-1">
                            <span className="flex items-center gap-1 text-slate-500">
                                <Sparkles className="w-3.5 h-3.5 text-[#ecb613]" />
                                {isIndianMode ? `Sa = ${settings.selectedSa}` : `A4 = ${settings.a4Reference}Hz`}
                            </span>
                            {saptakLabel && (
                                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 text-[10px] font-extrabold">
                                    {saptakLabel}
                                </span>
                            )}
                        </div>

                        {/* Large Note / Swara Display */}
                        <div className="my-2 select-none">
                            <div className="font-black text-5xl sm:text-7xl tracking-tight text-slate-900 flex items-center justify-center gap-2">
                                <span>{primaryDisplayTitle}</span>
                                {isIndianMode && detectedNote?.swara && (
                                    <span className="text-2xl sm:text-3xl font-extrabold text-[#d46211] opacity-90">
                                        ({detectedNote.swara.devanagari})
                                    </span>
                                )}
                            </div>

                            <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">
                                {secondaryDisplaySubtitle}
                            </p>
                        </div>

                        {/* Visual Tuner Meter */}
                        <div className="mt-4 mb-3">
                            <TunerMeter
                                cents={detectedNote ? detectedNote.cents : null}
                                status={detectedNote ? detectedNote.status : null}
                                isActive={isListening}
                                inTuneTolerance={settings.inTuneToleranceCents}
                            />
                        </div>

                        {/* Numerical Metrics Bar */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                            <div className="bg-slate-50/70 rounded-xl p-2 border border-slate-100">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Frequency</span>
                                <span className="font-black text-xs sm:text-sm text-slate-800">
                                    {detectedNote ? `${detectedNote.frequency.toFixed(1)} Hz` : '—'}
                                </span>
                            </div>

                            <div className="bg-slate-50/70 rounded-xl p-2 border border-slate-100">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Pitch Offset</span>
                                <span className={`font-black text-xs sm:text-sm ${
                                    detectedNote 
                                        ? (detectedNote.status === 'in_tune' ? 'text-emerald-600' : 'text-slate-800')
                                        : 'text-slate-800'
                                }`}>
                                    {detectedNote 
                                        ? `${detectedNote.cents > 0 ? `+${detectedNote.cents}` : detectedNote.cents} cents` 
                                        : '—'}
                                </span>
                            </div>

                            <div className="bg-slate-50/70 rounded-xl p-2 border border-slate-100">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Sur Accuracy</span>
                                <span className={`font-black text-xs sm:text-sm ${
                                    detectedNote 
                                        ? (detectedNote.status === 'in_tune' ? 'text-emerald-600' : 'text-amber-700')
                                        : 'text-slate-400'
                                }`}>
                                    {detectedNote ? detectedNote.statusLabel : (isListening ? 'Listening' : 'Off')}
                                </span>
                            </div>
                        </div>

                        {/* Input Level Bar Indicator */}
                        {isListening && (
                            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500">
                                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Input Level:</span>
                                <div className="flex items-center gap-1">
                                    <span className={`w-2.5 h-2.5 rounded-full ${inputLevel !== 'silent' ? 'bg-amber-400' : 'bg-slate-200'}`} />
                                    <span className={`w-2.5 h-2.5 rounded-full ${inputLevel === 'medium' || inputLevel === 'strong' ? 'bg-amber-500' : 'bg-slate-200'}`} />
                                    <span className={`w-2.5 h-2.5 rounded-full ${inputLevel === 'strong' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                </div>
                                <span className="capitalize text-[10px] text-slate-400">
                                    ({inputLevel === 'silent' ? 'Awaiting Sound' : inputLevel})
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Microphone Controls Button */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {!isListening ? (
                            <button
                                type="button"
                                onClick={start}
                                className="w-full py-3.5 px-6 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-black text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <Mic className="w-5 h-5" />
                                Start Tuner
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={stop}
                                className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <MicOff className="w-5 h-5 text-rose-400" />
                                Stop Tuner
                            </button>
                        )}
                    </div>

                    {/* Root Note (Sa) Selector */}
                    {isIndianMode && (
                        <RootNoteSelector
                            selectedSa={settings.selectedSa}
                            onSelectSa={setSelectedSa}
                        />
                    )}

                    {/* Expandable Tuner Settings */}
                    <TunerSettings
                        tunerMode={settings.tunerMode}
                        onModeChange={setTunerMode}
                        a4Reference={settings.a4Reference}
                        onA4Change={setA4Reference}
                    />

                    {/* Beginner Guidance */}
                    <TunerHelp />

                    {/* Privacy Notice */}
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Audio stays on your device and is not recorded or uploaded.</span>
                    </div>

                </div>
            </div>
        </div>
    );
}
