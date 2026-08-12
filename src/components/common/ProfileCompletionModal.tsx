'use client';

import React, { useState, useEffect } from 'react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { User, Phone, Camera, Check, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface ProfileCompletionModalProps {
    isOpen: boolean;
    userId: string;
    initialName?: string;
    initialPhone?: string;
    initialPic?: string;
    onComplete: (updatedProfile: { name: string; phone: string; profile_pic_url: string }) => void;
}

export default function ProfileCompletionModal({
    isOpen,
    userId,
    initialName = '',
    initialPhone = '',
    initialPic = '',
    onComplete
}: ProfileCompletionModalProps) {
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState(initialPhone);
    const [profilePic, setProfilePic] = useState(initialPic);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (initialName) setName(initialName);
        if (initialPhone) setPhone(initialPhone);
        if (initialPic) setProfilePic(initialPic);
    }, [initialName, initialPhone, initialPic]);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        if (!file.type.startsWith('image/')) {
            setErrorMsg('Please select a valid image file (JPG, PNG, WebP).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setErrorMsg('Profile photo must be smaller than 5 MB.');
            return;
        }

        setUploading(true);
        setErrorMsg(null);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `student-profile-${userId}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload to gallery storage bucket
            const { error: uploadError } = await supabaseAuth.storage
                .from('gallery')
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (uploadError) {
                // Fallback to Base64 data URL if storage bucket fails
                const reader = new FileReader();
                reader.onloadend = () => {
                    setProfilePic(reader.result as string);
                    setUploading(false);
                };
                reader.readAsDataURL(file);
                return;
            }

            const { data: { publicUrl } } = supabaseAuth.storage
                .from('gallery')
                .getPublicUrl(filePath);

            setProfilePic(publicUrl);
        } catch (err: any) {
            console.warn('File upload fallback to Base64:', err);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePic(reader.result as string);
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } finally {
            setUploading(false);
        }
    };

    const validateAndSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        const cleanName = name.trim();
        const cleanPhone = phone.trim();
        const digitsOnly = cleanPhone.replace(/\D/g, '');

        if (!cleanName || cleanName.length < 2 || cleanName.toLowerCase() === 'new student') {
            setErrorMsg('Please enter your full and correct official name.');
            return;
        }

        if (!cleanPhone || digitsOnly.length < 10) {
            setErrorMsg('Please enter a valid 10-digit mobile phone number.');
            return;
        }

        if (!profilePic) {
            setErrorMsg('Please upload a profile photo or select your Google picture.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabaseAuth
                .from('users')
                .update({
                    name: cleanName,
                    phone: cleanPhone,
                    profile_pic_url: profilePic
                })
                .eq('id', userId);

            if (error) throw error;

            onComplete({
                name: cleanName,
                phone: cleanPhone,
                profile_pic_url: profilePic
            });
        } catch (err: any) {
            console.error('Failed to save completed profile:', err);
            setErrorMsg(err.message || 'Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-left relative overflow-hidden">
                {/* Header Badge */}
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a15912] dark:text-[#ecb613] bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 px-3 py-1.5 rounded-full w-fit mb-4">
                    <ShieldCheck className="w-4 h-4" />
                    Mandatory Student Onboarding
                </div>

                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-snug">
                    Complete Your Student Profile
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6 leading-relaxed">
                    To access Krishna Flute Academy classes and portal features, please provide your contact phone number, profile photo, and full official name.
                </p>

                {errorMsg && (
                    <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <form onSubmit={validateAndSave} className="space-y-4">
                    {/* Photo Picker */}
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <div className="relative group cursor-pointer">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#a15912] bg-slate-200 dark:bg-slate-700 flex items-center justify-center shadow-md">
                                {profilePic ? (
                                    <img src={profilePic} alt="Profile preview" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-10 h-10 text-slate-400" />
                                )}
                            </div>
                            <label htmlFor="modal-photo-input" className="absolute bottom-0 right-0 p-1.5 bg-[#a15912] hover:bg-[#8a4b0f] text-white rounded-full cursor-pointer shadow-md transition-all">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            </label>
                            <input
                                id="modal-photo-input"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                                disabled={uploading || saving}
                            />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-2">
                            {profilePic ? 'Change Profile Photo' : 'Upload Profile Photo *'}
                        </span>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Full & Correct Official Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Rahul Sharma"
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#a15912] text-slate-900 dark:text-white"
                                required
                            />
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Mobile Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="e.g. +91 98765 43210"
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#a15912] text-slate-900 dark:text-white"
                                required
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={saving || uploading}
                        className="w-full h-11 bg-[#a15912] hover:bg-[#8a4b0f] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#a15912]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving Profile...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Save & Continue to Portal</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
