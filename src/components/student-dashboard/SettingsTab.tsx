'use client';

import React, { useState, useEffect } from 'react';
import { User, Phone, Upload, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface SettingsTabProps {
    profile: {
        id: string;
        name: string;
        email: string;
        phone?: string | null;
        profile_pic_url?: string | null;
        role?: string;
        level?: string;
    } | null;
    refreshData: () => Promise<void>;
}

export default function SettingsTab({ profile, refreshData }: SettingsTabProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Initialize form fields with profile data
    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setPhone(profile.phone || '');
        }
    }, [profile]);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;
        if (!name.trim()) {
            setMessage({ text: 'Name is required.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabaseAuth
                .from('users')
                .update({
                    name: name.trim(),
                    phone: phone.trim() || null
                })
                .eq('id', profile.id);

            if (error) throw error;

            await refreshData();
            setMessage({ text: 'Profile updated successfully!', type: 'success' });
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.id) return;

        // Validation
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (!allowedExtensions.includes(fileExt || '')) {
            setMessage({ text: 'Invalid file format. Please upload an image (JPG, PNG, WebP).', type: 'error' });
            return;
        }

        // Limit size to 5MB
        if (file.size > 5 * 1024 * 1024) {
            setMessage({ text: 'Image size should be less than 5MB.', type: 'error' });
            return;
        }

        setUploading(true);
        setUploadProgress(15);
        setMessage(null);

        try {
            const randomName = `${profile.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${randomName}`;

            setUploadProgress(50);
            const { error: uploadError } = await supabaseAuth.storage
                .from('gallery')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            setUploadProgress(80);
            const { data: { publicUrl } } = supabaseAuth.storage
                .from('gallery')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabaseAuth
                .from('users')
                .update({ profile_pic_url: publicUrl })
                .eq('id', profile.id);

            if (dbError) throw dbError;

            setUploadProgress(100);
            await refreshData();
            
            setTimeout(() => {
                setUploadProgress(null);
                setUploading(false);
                setMessage({ text: 'Profile photo uploaded successfully!', type: 'success' });
            }, 300);
        } catch (err: any) {
            console.error('Error uploading photo:', err);
            setUploadProgress(null);
            setUploading(false);
            setMessage({ text: err.message || 'Failed to upload photo.', type: 'error' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 text-left max-w-4xl mx-auto">
            {/* Header info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs relative overflow-hidden">
                <div className="absolute right-4 top-4 text-amber-500/10">
                    <Sparkles className="w-24 h-24 stroke-[1]" />
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-white text-lg mb-1 flex items-center gap-2">
                    Profile Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage your personal academy profile, contact details, and display picture
                </p>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-150 dark:border-emerald-900/50' 
                        : 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-150 dark:border-red-900/50'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-450 mt-0.5" />
                    ) : (
                        <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-450 mt-0.5" />
                    )}
                    <span className="text-xs font-bold leading-relaxed">{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
                {/* Photo Upload Column */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col items-center justify-between text-center gap-6">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-4">Profile Photo</span>
                        
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-3xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-inner transition-transform group-hover:scale-102">
                                {profile?.profile_pic_url ? (
                                    <img src={profile.profile_pic_url} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[#d46211] text-3xl font-black">{profile?.name?.charAt(0)}</span>
                                )}
                            </div>
                            {uploading && (
                                <div className="absolute inset-0 bg-slate-900/60 rounded-3xl flex flex-col items-center justify-center text-white backdrop-blur-3xs">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                                    {uploadProgress !== null && (
                                        <span className="text-[10px] font-extrabold mt-1.5">{uploadProgress}%</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full">
                        <label className="w-full min-h-[40px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-slate-800 dark:text-[#e9edef] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-200 dark:border-slate-800 shadow-2xs">
                            <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>Upload Photo</span>
                            <input 
                                type="file" 
                                onChange={handlePhotoUpload} 
                                accept="image/*" 
                                className="hidden" 
                                disabled={uploading}
                            />
                        </label>
                        <p className="text-[9.5px] text-slate-450 dark:text-[#8696a0] font-semibold mt-2.5 leading-relaxed">
                            Supports JPG, PNG or WebP. Max size 5MB.
                        </p>
                    </div>
                </div>

                {/* Form Inputs Column */}
                <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">Personal Details</span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label htmlFor="name-input" className="text-xs font-extrabold text-slate-600 dark:text-[#8696a0] uppercase tracking-wider block">Full Name</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#1f2c34] border border-slate-200/80 dark:border-slate-800 rounded-xl px-3.5 py-1.5 focus-within:border-[#ecb613] dark:focus-within:border-amber-500 transition-colors shadow-3xs">
                                <User className="w-4 h-4 text-slate-400 shrink-0" />
                                <input
                                    id="name-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#e9edef] placeholder:text-slate-450"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div className="space-y-2">
                            <label htmlFor="phone-input" className="text-xs font-extrabold text-slate-600 dark:text-[#8696a0] uppercase tracking-wider block">Phone Number</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#1f2c34] border border-slate-200/80 dark:border-slate-800 rounded-xl px-3.5 py-1.5 focus-within:border-[#ecb613] dark:focus-within:border-amber-500 transition-colors shadow-3xs">
                                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                                <input
                                    id="phone-input"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Enter your phone number"
                                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#e9edef] placeholder:text-slate-450"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        {/* Email (Read only) */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-extrabold text-slate-450 dark:text-[#8696a0] uppercase tracking-wider block">Email Address (Primary Account ID)</span>
                            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-[#e9edef] bg-slate-50 dark:bg-[#1f2c34] px-4 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 block select-all">
                                {profile?.email}
                            </span>
                        </div>

                        {/* Level / Status */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-extrabold text-slate-450 dark:text-[#8696a0] uppercase tracking-wider block">Level & Standing</span>
                            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-[#e9edef] bg-slate-50 dark:bg-[#1f2c34] px-4 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 block uppercase tracking-wider font-mono">
                                {profile?.level || 'Beginner'} — {profile?.role || 'student'}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading || uploading}
                            className="min-h-[44px] px-6 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 hover:scale-102 active:scale-98 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                    <span>Saving Profile...</span>
                                </>
                            ) : (
                                <span>Save Profile Details</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
