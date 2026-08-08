'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { Upload, X, Check, Loader2 } from 'lucide-react';

interface ImageUploadWithCropProps {
    value: string;
    onChange: (url: string) => void;
    studentId?: string;
}

const CROP_SIZE = 250;

export default function ImageUploadWithCrop({ value, onChange, studentId }: ImageUploadWithCropProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Zoom and Pan States
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Image info
    const [imgSize, setImgSize] = useState({ width: 0, height: 0, dispW: 0, dispH: 0, initX: 0, initY: 0 });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Reset crop state on new image
    useEffect(() => {
        if (imageSrc) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }
    }, [imageSrc]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result as string);
                setIsModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;

        let dispW = CROP_SIZE;
        let dispH = CROP_SIZE;
        
        if (naturalW > naturalH) {
            dispH = CROP_SIZE;
            dispW = CROP_SIZE * (naturalW / naturalH);
        } else {
            dispW = CROP_SIZE;
            dispH = CROP_SIZE * (naturalH / naturalW);
        }

        const initX = (CROP_SIZE - dispW) / 2;
        const initY = (CROP_SIZE - dispH) / 2;

        setImgSize({
            width: naturalW,
            height: naturalH,
            dispW,
            dispH,
            initX,
            initY
        });
    };

    // Drag / Pan Handlers
    const startDrag = (clientX: number, clientY: number) => {
        setIsDragging(true);
        setDragStart({
            x: clientX - pan.x,
            y: clientY - pan.y
        });
    };

    const onDrag = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        setPan({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const endDrag = () => {
        setIsDragging(false);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        onDrag(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        onDrag(touch.clientX, touch.clientY);
    };

    const handleCropAndSave = async () => {
        if (!imageSrc || !imgSize.width) return;
        setUploading(true);

        try {
            // 1. Draw cropped image onto Canvas
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('Failed to create canvas context');

            // Set white background fallback
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 300, 300);

            const img = new Image();
            img.src = imageSrc;
            await new Promise((resolve) => {
                img.onload = resolve;
            });

            // Map standard crop size of 250px to output canvas of 300px
            const scale = 300 / CROP_SIZE;

            ctx.drawImage(
                img,
                (imgSize.initX + pan.x) * scale,
                (imgSize.initY + pan.y) * scale,
                imgSize.dispW * zoom * scale,
                imgSize.dispH * zoom * scale
            );

            // Convert to JPEG blob with 85% quality to reduce file size heavily
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
            });

            if (!blob) throw new Error('Failed to export crop image');

            // 2. Upload to Supabase Storage
            const fileId = studentId || Math.random().toString(36).substring(2, 9);
            const fileName = `student_profiles/${fileId}-${Date.now()}.jpg`;

            // Try to upload to student-profiles, or fallback to class_notes
            let uploadBucket = 'student-profiles';
            let { data: uploadData, error: uploadError } = await supabaseAuth.storage
                .from(uploadBucket)
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

            if (uploadError) {
                console.warn('student-profiles bucket failed, trying fallback to class_notes bucket:', uploadError.message);
                uploadBucket = 'class_notes';
                const fallbackRes = await supabaseAuth.storage
                    .from(uploadBucket)
                    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
                
                if (fallbackRes.error) throw fallbackRes.error;
                uploadData = fallbackRes.data;
            }

            // 3. Retrieve and set public URL
            const { data } = supabaseAuth.storage.from(uploadBucket).getPublicUrl(fileName);
            if (!data?.publicUrl) throw new Error('Failed to fetch public URL of uploaded image');

            onChange(data.publicUrl);
            setIsModalOpen(false);
            setImageSrc(null);
        } catch (error: any) {
            console.error('Error during image crop & upload:', error);
            alert(`Failed to save image: ${error.message || 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
            <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-sm shrink-0 flex items-center justify-center">
                {value ? (
                    <img src={value} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                    <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                )}
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        title="Remove Picture"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-1.5 items-center sm:items-start">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
                >
                    <Upload className="w-4 h-4 text-slate-500" />
                    {value ? 'Change Picture' : 'Upload Picture'}
                </button>
                <p className="text-[11px] text-slate-400">JPG, PNG allowed. Resized and cropped automatically.</p>
            </div>

            {/* Pan & Zoom Crop Modal */}
            {isModalOpen && imageSrc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col transform transition-all animate-scaleUp">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 text-lg">Crop Profile Picture</h3>
                            <button
                                type="button"
                                onClick={() => { setIsModalOpen(false); setImageSrc(null); }}
                                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Viewport Crop Workspace */}
                        <div className="flex-1 bg-slate-900 p-8 flex items-center justify-center relative overflow-hidden select-none">
                            <div 
                                ref={containerRef}
                                className="relative rounded-full border-2 border-white/80 shadow-lg cursor-grab active:cursor-grabbing overflow-hidden"
                                style={{ width: CROP_SIZE, height: CROP_SIZE }}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={endDrag}
                                onMouseLeave={endDrag}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={endDrag}
                            >
                                <img
                                    ref={imageRef}
                                    src={imageSrc}
                                    alt="To crop"
                                    onLoad={handleImageLoad}
                                    draggable={false}
                                    className="absolute max-w-none pointer-events-none select-none"
                                    style={{
                                        width: imgSize.dispW,
                                        height: imgSize.dispH,
                                        transform: `translate(${imgSize.initX + pan.x}px, ${imgSize.initY + pan.y}px) scale(${zoom})`,
                                        transformOrigin: '0 0'
                                    }}
                                />
                                {/* Circular overlay shadow mask */}
                                <div className="absolute inset-0 pointer-events-none rounded-full shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] border-2 border-white"></div>
                            </div>
                        </div>

                        {/* Controls Panel */}
                        <div className="p-6 space-y-5 border-t border-slate-100">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400 text-sm select-none">zoom_out</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="3.5"
                                    step="0.05"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="flex-1 accent-yellow-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                                />
                                <span className="material-symbols-outlined text-slate-400 text-sm select-none">zoom_in</span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setImageSrc(null); }}
                                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all active:scale-95"
                                    disabled={uploading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCropAndSave}
                                    className="flex items-center justify-center gap-2 bg-[#ecb613] hover:bg-[#d8a40f] text-slate-900 px-5 py-2 rounded-xl text-sm font-black transition-all active:scale-95 shadow-sm min-w-32"
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin text-slate-800" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 text-slate-900" />
                                            Apply Crop
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
