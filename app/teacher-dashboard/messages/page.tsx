'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { sendClassroomNotification } from '../../../src/lib/notifications';
import { 
    Loader2, Search, Megaphone, Sparkles, CreditCard, Users, 
    Presentation, Bell, HelpCircle, Send, FileText, Clock, 
    Calendar, Check, Copy, Mic, Plus, Info, X, ChevronRight, Globe,
    FolderPlus, Edit
} from 'lucide-react';

interface Broadcast {
    id: string;
    channel: string;
    recipients: Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }>;
    subject: string;
    content: string;
    created_at: string;
}

const QUICK_TEMPLATES = [
    {
        id: 'welcome',
        name: 'Welcome Kit',
        icon: FileText,
        subject: 'Welcome to Krishna Flute Academy! 🎶',
        content: 'Welcome to KFA! We are thrilled to have you join our flute family. We have unlocked your first dynamic module: Fingering Basics. Let\'s begin this wonderful musical journey together!'
    },
    {
        id: 'fee',
        name: 'Monthly Fee Reminder',
        icon: Clock,
        subject: 'Tuition Fee Invoice Ready 💳',
        content: 'Hi there, this is a gentle reminder that your tuition fee invoice for this month is ready for processing. Please check your billing dashboard to make a payment and avoid class disruptions.'
    },
    {
        id: 'cancel',
        name: 'Class Cancellation',
        icon: Calendar,
        subject: 'Reschedule Notice: Saturday Flute Masterclass ⚠️',
        content: 'Important update: Please note that our scheduled Saturday morning flute classes have been rescheduled to Sunday at the same time due to instructor travel. We apologize for the inconvenience!'
    }
];

const INITIAL_MOCK_BROADCASTS: Broadcast[] = [
    {
        id: 'mock-1',
        channel: 'announcements',
        recipients: [{ id: 'all', name: 'All Students (Global)', type: 'global' }],
        subject: 'New Raag Bhairav Study Material',
        content: 'Hi students, I have uploaded a new interactive play-along video and reference sheet music for Raag Bhairav under the Inventory Library. Please practice the basic Aaroh and Avroh transitions this week!',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
    },
    {
        id: 'mock-2',
        channel: 'classroom',
        recipients: [{ id: 'class-1', name: 'All Beginners (A1)', type: 'class' }],
        subject: 'Alankars Mastery Homework Assignment',
        content: 'Hello Section A1, your new checklist for Alankars Mastery is active. Please log in to your portal, practice the double-note movements, and mark your topic task as complete before our next live session!',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() // 3 days ago
    },
    {
        id: 'mock-3',
        channel: 'new_joiners',
        recipients: [{ id: 'newbies', name: 'New Joiners (May)', type: 'custom' }],
        subject: 'Breath Control Basics & Warm-up Routine',
        content: 'A warm welcome to our newest flute joiners! Please watch the Breath Control II guided video in your portal as your starting sequence. Consistency is key!',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString() // 6 days ago
    }
];

function MessagesDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paramStudentId = searchParams.get('studentId');
    const paramStudentName = searchParams.get('studentName');
    const lastProcessedStudentIdRef = useRef<string | null>(null);

    // ── Global states ──────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [dbSetupError, setDbSetupError] = useState(false);
    const [dbChecking, setDbChecking] = useState(true);
    const [sqlCopied, setSqlCopied] = useState(false);

    // Live Database Lists (Roster & Classrooms)
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);

    // Custom Recipient Groups states
    const [customGroups, setCustomGroups] = useState<any[]>([]);
    const [dbSetupErrorGroups, setDbSetupErrorGroups] = useState(false);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [sqlGroupsCopied, setSqlGroupsCopied] = useState(false);

    // Message Templates states
    const [customTemplates, setCustomTemplates] = useState<any[]>([]);
    const [dbSetupErrorTemplates, setDbSetupErrorTemplates] = useState(false);
    const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateSearchQuery, setTemplateSearchQuery] = useState('');

    const filteredTemplates = useMemo(() => {
        const query = templateSearchQuery.toLowerCase().trim();
        if (!query) return customTemplates;
        return customTemplates.filter(t => 
            t.name.toLowerCase().includes(query) || 
            t.subject.toLowerCase().includes(query) || 
            t.content.toLowerCase().includes(query)
        );
    }, [customTemplates, templateSearchQuery]);

    // Toast Notifications states
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Audio Recorder states
    const [audioRecorderOpen, setAudioRecorderOpen] = useState(false);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [attachedAudioNote, setAttachedAudioNote] = useState<string | null>(null);
    
    // Synthesizer Fallback States
    const [isMicUnavailable, setIsMicUnavailable] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string>('d5');
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [micPermissionDenied, setMicPermissionDenied] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Convert Blob to persistent Base64 Data URL
    const convertBlobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Synthesize organic flute note using browser Web Audio API
    const synthesizeFluteSound = async (preset: string): Promise<{ blob: Blob; url: string }> => {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
            throw new Error('Web Audio API not supported');
        }

        const ctx = new AudioContext();
        let dest: MediaStreamAudioDestinationNode;
        try {
            dest = ctx.createMediaStreamDestination();
        } catch (e) {
            throw new Error('MediaStreamDestination not supported');
        }

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(dest.stream);
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve, reject) => {
            recorder.onstop = () => {
                const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                ctx.close();
                resolve({ blob: audioBlob, url });
            };

            recorder.onerror = (e) => reject(e);
            recorder.start();

            const now = ctx.currentTime;

            if (preset === 'd5') {
                playFluteTone(ctx, dest, 587.33, now, 1.5);
            } else if (preset === 'a5') {
                playFluteTone(ctx, dest, 880.00, now, 1.5);
            } else if (preset === 'kfa') {
                const notes = [587.33, 698.46, 880.00, 1174.66];
                const offsets = [0, 0.35, 0.7, 1.05];
                notes.forEach((freq, i) => {
                    playFluteTone(ctx, dest, freq, now + offsets[i], 0.6);
                });
            }

            const totalDuration = preset === 'kfa' ? 1.85 * 1000 : 1.7 * 1000;
            setTimeout(() => {
                try {
                    recorder.stop();
                } catch (err) {
                    reject(err);
                }
            }, totalDuration);
        });
    };

    const playFluteTone = (
        ctx: AudioContext, 
        dest: MediaStreamAudioDestinationNode, 
        freq: number, 
        startTime: number, 
        duration: number
    ) => {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        lfo.frequency.value = 5.8;
        lfoGain.gain.value = 6;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        filter.type = 'lowpass';
        filter.frequency.value = freq * 1.8;

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const attack = 0.12;
        const decay = 0.15;
        const sustain = 0.75;
        const release = 0.22;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + attack);
        gainNode.gain.setValueAtTime(0.25, startTime + attack);
        gainNode.gain.linearRampToValueAtTime(0.25 * sustain, startTime + attack + decay);
        gainNode.gain.setValueAtTime(0.25 * sustain, startTime + duration - release);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(dest);
        gainNode.connect(ctx.destination);

        lfo.start(startTime);
        osc.start(startTime);

        lfo.stop(startTime + duration);
        osc.stop(startTime + duration);
    };

    const handleSynthesizeFlute = async () => {
        setIsSynthesizing(true);
        showToast('Synthesizing flute note...', 'info');
        try {
            const { blob } = await synthesizeFluteSound(selectedPreset);
            const base64Url = await convertBlobToBase64(blob);
            setRecordedBlob(blob);
            setAudioUrl(base64Url);
            showToast('Flute note synthesized successfully!', 'success');
        } catch (err: any) {
            console.error('Synthesis failed:', err);
            showToast('Web Audio synthesis not supported in this browser.', 'error');
        } finally {
            setIsSynthesizing(false);
        }
    };

    // Start recording audio using default device drivers (computers/laptops/mobiles)
    const startRecording = async () => {
        try {
            setMicPermissionDenied(false);
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('navigator.mediaDevices is not supported');
            }
            
            // Standard media constraints to pick the default active audio drive with high-fidelity filtering
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            audioChunksRef.current = [];
            
            // Determine optimal MIME type supported by the computer/laptop/mobile OS audio driver
            let mimeType = 'audio/webm';
            let options = {};
            if (typeof MediaRecorder !== 'undefined') {
                if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                    options = { mimeType };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4'; // Standard iOS Safari drive format
                    options = { mimeType };
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    mimeType = 'audio/ogg';
                    options = { mimeType };
                } else if (MediaRecorder.isTypeSupported('audio/wav')) {
                    mimeType = 'audio/wav';
                    options = { mimeType };
                }
            }
            
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                try {
                    const base64Url = await convertBlobToBase64(audioBlob);
                    setRecordedBlob(audioBlob);
                    setAudioUrl(base64Url);
                    showToast('Audio recording captured successfully!', 'success');
                } catch (base64Err) {
                    console.error('Base64 conversion failed:', base64Err);
                    const tempUrl = URL.createObjectURL(audioBlob);
                    setRecordedBlob(audioBlob);
                    setAudioUrl(tempUrl);
                    showToast('Audio recording captured (local playback URL)!', 'info');
                }
            };
            
            mediaRecorder.start();
            setIsRecordingAudio(true);
            setRecordingTime(0);
            
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
            
            showToast('Recording via default audio drive...', 'info');
        } catch (err: any) {
            console.error('Error starting audio recorder:', err);
            setIsMicUnavailable(true);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('allow')) {
                setMicPermissionDenied(true);
                showToast('Microphone access denied! See address bar settings.', 'error');
            } else {
                showToast('Microphone unavailable. Loading synthesizer fallback...', 'info');
            }
        }
    };

    // Stop recording audio
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecordingAudio) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecordingAudio(false);
            
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    // Toggle playback of the recorded preview
    const togglePlayback = () => {
        if (!audioUrl) return;
        
        if (isPlayingAudio && audioRef.current) {
            audioRef.current.pause();
            setIsPlayingAudio(false);
            return;
        }

        // Always recreate Audio for robust playback of Base64 or standard URLs
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => {
            setIsPlayingAudio(false);
        };
        
        audioRef.current.play()
            .then(() => {
                setIsPlayingAudio(true);
            })
            .catch(playErr => {
                console.error('Audio playback failed:', playErr);
                showToast('Unable to play audio in this browser.', 'error');
                setIsPlayingAudio(false);
            });
    };

    // Discard current audio note
    const discardAudioNote = () => {
        stopRecording();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setAudioUrl(null);
        setRecordedBlob(null);
        setIsPlayingAudio(false);
        setAttachedAudioNote(null);
        setRecordingTime(0);
        showToast('Audio note discarded.', 'info');
    };

    // Attach current audio note to compose form
    const attachAudioNote = () => {
        if (!audioUrl) return;
        setAttachedAudioNote(audioUrl);
        showToast('Flute voice note attached to notification!', 'success');
    };

    // ── Broadcast states ───────────────────────────────────────────────────────
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [activeChannel, setActiveChannel] = useState<string>('announcements'); // announcements, classroom, custom_groups, new_joiners, fee_management
    
    // Compose Form
    const [selectedRecipients, setSelectedRecipients] = useState<Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }>>([]);

    useEffect(() => {
        if (paramStudentId && paramStudentName && lastProcessedStudentIdRef.current !== paramStudentId) {
            setSelectedRecipients([
                {
                    id: paramStudentId,
                    name: decodeURIComponent(paramStudentName),
                    type: 'student'
                }
            ]);
            lastProcessedStudentIdRef.current = paramStudentId;
        }
    }, [paramStudentId, paramStudentName]);

    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Recipients Modal Selection
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'class' | 'student'>('class');
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [tempSelectedTargets, setTempSelectedTargets] = useState<string[]>([]); // list of target IDs

    // Logs Search
    const [searchQuery, setSearchQuery] = useState('');

    // ── Auth & Data Loading ────────────────────────────────────────────────────
    useEffect(() => {
        const checkAuthAndLoad = async () => {
            setLoading(true);
            try {
                // 1. Authenticate Teacher
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, role')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });

                if (!profile) return;

                const isAdmin = profile.role === 'admin';

                // 2. Pre-fetch Classrooms and Students for recipients modal
                let roomsQuery = supabaseAuth
                    .from('classrooms')
                    .select('id, name');
                if (!isAdmin) {
                    roomsQuery = roomsQuery.eq('teacher_id', profile.id);
                }
                const { data: rooms } = await roomsQuery;
                setClassrooms(rooms || []);

                let studentsQuery = supabaseAuth
                    .from('users')
                    .select('id, name')
                    .eq('role', 'student');
                if (!isAdmin) {
                    studentsQuery = studentsQuery.eq('teacher_id', profile.id);
                }
                const { data: studentList } = await studentsQuery;
                const uniqueStudents = (studentList || []).map((s: any) => ({
                    id: s.id,
                    name: s.name || 'Unknown'
                }));
                setStudents(uniqueStudents);

                // 3. Test/Query Broadcasts Table
                try {
                    let broadcastQuery = supabaseAuth
                        .from('broadcasts')
                        .select('*');
                    if (!isAdmin) {
                        broadcastQuery = broadcastQuery.eq('teacher_id', profile.id);
                    }
                    const { data: dbBroadcasts, error: bError } = await broadcastQuery.order('created_at', { ascending: false });

                    if (bError) {
                        console.warn('[Messages] Broadcasts table check failed:', bError.message);
                        if (bError.code === '42P01' || bError.code === 'PGRST205' || bError.message?.includes('schema cache') || bError.message?.includes('does not exist')) {
                            setDbSetupError(true);
                        }
                        // Load from cache or fallback
                        const local = localStorage.getItem('kfa_local_broadcasts');
                        setBroadcasts(local ? JSON.parse(local) : INITIAL_MOCK_BROADCASTS);
                    } else {
                        setBroadcasts(dbBroadcasts || []);
                        setDbSetupError(false);
                    }
                } catch (pe) {
                    console.warn('[Messages] Exception querying broadcasts:', pe);
                    const local = localStorage.getItem('kfa_local_broadcasts');
                    setBroadcasts(local ? JSON.parse(local) : INITIAL_MOCK_BROADCASTS);
                }

                // 4. Test/Query Custom Recipient Groups Table
                try {
                    let grpQuery = supabaseAuth
                        .from('custom_recipient_groups')
                        .select('*');
                    if (!isAdmin) {
                        grpQuery = grpQuery.eq('teacher_id', profile.id);
                    }
                    const { data: grpData, error: grpError } = await grpQuery.order('created_at', { ascending: false });

                    if (grpError) {
                        console.warn('[Messages] Custom recipient groups table check failed:', grpError.message);
                        if (grpError.code === '42P01' || grpError.code === 'PGRST205' || grpError.message?.includes('schema cache') || grpError.message?.includes('does not exist')) {
                            setDbSetupErrorGroups(true);
                        }
                        const local = localStorage.getItem('kfa_local_custom_groups');
                        setCustomGroups(local ? JSON.parse(local) : [
                            { id: 'mock-group-1', name: 'Saturday Flute Performers', description: 'Advanced weekly workshop flute players', recipients: [{ id: 'class-1', name: 'All Beginners (A1)', type: 'class' }] }
                        ]);
                    } else {
                        setCustomGroups(grpData || []);
                        setDbSetupErrorGroups(false);
                    }
                } catch (ge) {
                    console.warn('[Messages] Exception querying custom groups:', ge);
                    const local = localStorage.getItem('kfa_local_custom_groups');
                    setCustomGroups(local ? JSON.parse(local) : [
                        { id: 'mock-group-1', name: 'Saturday Flute Performers', description: 'Advanced weekly workshop flute players', recipients: [{ id: 'class-1', name: 'All Beginners (A1)', type: 'class' }] }
                    ]);
                }

                // 5. Test/Query Message Templates Table
                try {
                    let tplQuery = supabaseAuth
                        .from('message_templates')
                        .select('*');
                    if (!isAdmin) {
                        tplQuery = tplQuery.eq('teacher_id', profile.id);
                    }
                    const { data: tplData, error: tplError } = await tplQuery.order('created_at', { ascending: false });

                    if (tplError) {
                        console.warn('[Messages] Message templates table check failed:', tplError.message);
                        if (tplError.code === '42P01' || tplError.code === 'PGRST205' || tplError.message?.includes('schema cache') || tplError.message?.includes('does not exist')) {
                            setDbSetupErrorTemplates(true);
                        }
                        const local = localStorage.getItem('kfa_local_templates');
                        if (local) {
                            setCustomTemplates(JSON.parse(local));
                        } else {
                            // Seed local storage with system defaults
                            const seedLocal = QUICK_TEMPLATES.map(t => ({
                                id: `local-tpl-${t.id}`,
                                name: t.name,
                                subject: t.subject,
                                content: t.content,
                                created_at: new Date().toISOString()
                            }));
                            setCustomTemplates(seedLocal);
                            localStorage.setItem('kfa_local_templates', JSON.stringify(seedLocal));
                        }
                    } else {
                        if (!tplData || tplData.length === 0) {
                            // Seed database with system defaults
                            const seedData = QUICK_TEMPLATES.map(t => ({
                                teacher_id: profile.id,
                                name: t.name,
                                subject: t.subject,
                                content: t.content
                            }));
                            const { data: insertedData, error: insertError } = await supabaseAuth
                                .from('message_templates')
                                .insert(seedData)
                                .select('*');
                            
                            if (!insertError && insertedData) {
                                setCustomTemplates(insertedData);
                            } else {
                                const fallbackLocal = QUICK_TEMPLATES.map(t => ({
                                    id: `local-tpl-${t.id}`,
                                    name: t.name,
                                    subject: t.subject,
                                    content: t.content,
                                    created_at: new Date().toISOString()
                                }));
                                setCustomTemplates(fallbackLocal);
                            }
                        } else {
                            setCustomTemplates(tplData);
                        }
                        setDbSetupErrorTemplates(false);
                    }
                } catch (te) {
                    console.warn('[Messages] Exception querying templates:', te);
                    const local = localStorage.getItem('kfa_local_templates');
                    if (local) {
                        setCustomTemplates(JSON.parse(local));
                    } else {
                        const fallbackLocal = QUICK_TEMPLATES.map(t => ({
                            id: `local-tpl-${t.id}`,
                            name: t.name,
                            subject: t.subject,
                            content: t.content,
                            created_at: new Date().toISOString()
                        }));
                        setCustomTemplates(fallbackLocal);
                        localStorage.setItem('kfa_local_templates', JSON.stringify(fallbackLocal));
                    }
                }

            } catch (err) {
                console.error('Error during initial portal load:', err);
            } finally {
                setLoading(false);
                setDbChecking(false);
            }
        };

        checkAuthAndLoad();
    }, [router]);

    // Logout Helper
    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/login?type=teacher');
    };

    // ── Save Broadcast Handler ─────────────────────────────────────────────────
    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile || isSending) return;

        if (selectedRecipients.length === 0) {
            showToast('Please select at least one recipient first!', 'error');
            return;
        }
        if (!subject.trim()) {
            showToast('Please specify a broadcast subject!', 'error');
            return;
        }
        if (!content.trim()) {
            showToast('Please compose your broadcast message!', 'error');
            return;
        }

        setIsSending(true);

        const newBroadcast: any = {
            teacher_id: teacherProfile.id,
            channel: activeChannel,
            recipients: selectedRecipients,
            subject: subject.trim(),
            content: content.trim(),
            created_at: new Date().toISOString()
        };

        if (attachedAudioNote) {
            newBroadcast.audio_attachment = attachedAudioNote;
        }

        try {
            if (dbSetupError) {
                // local fallback save
                const localList = [
                    { id: `local-${Date.now()}`, ...newBroadcast },
                    ...broadcasts
                ];
                setBroadcasts(localList);
                localStorage.setItem('kfa_local_broadcasts', JSON.stringify(localList));
                showToast('Notification saved locally!', 'success');
                
                // Clear Composer Form
                setSubject('');
                setContent('');
                setSelectedRecipients([]);
                setAttachedAudioNote(null);
            } else {
                // Supabase insert
                const { data, error } = await supabaseAuth
                    .from('broadcasts')
                    .insert(newBroadcast)
                    .select('*');

                if (error) {
                    console.error('Database write error:', error);
                    showToast(`Failed to save to database. Saved locally instead.`, 'error');
                    const localList = [
                        { id: `local-${Date.now()}`, ...newBroadcast },
                        ...broadcasts
                    ];
                    setBroadcasts(localList);
                    localStorage.setItem('kfa_local_broadcasts', JSON.stringify(localList));
                } else {
                    setBroadcasts(prev => [data[0], ...prev]);
                    showToast('Notification sent & saved successfully!', 'success');
                    
                    sendClassroomNotification({
                        teacherId: teacherProfile.id,
                        recipients: selectedRecipients,
                        title: subject.trim(),
                        message: content.trim()
                    }).catch(err => console.error('Failed to send notifications for message broadcast:', err));
                }

                // Clear Composer Form
                setSubject('');
                setContent('');
                setSelectedRecipients([]);
                setAttachedAudioNote(null);
            }
        } catch (err: any) {
            console.error('Exception during broadcast save:', err);
            showToast('An unexpected issue occurred while sending.', 'error');
        } finally {
            setIsSending(false);
        }
    };

    // ── Save Custom Group Handler ──────────────────────────────────────────────
    const handleSaveCustomGroup = async (name: string, description: string, recipients: any[]) => {
        if (!teacherProfile || !name.trim()) return;
        setIsSavingGroup(true);

        const newGroup = {
            teacher_id: teacherProfile.id,
            name: name.trim(),
            description: description.trim(),
            recipients: recipients,
            created_at: new Date().toISOString()
        };

        try {
            if (dbSetupErrorGroups) {
                const updatedList = [
                    { id: `local-group-${Date.now()}`, ...newGroup },
                    ...customGroups
                ];
                setCustomGroups(updatedList);
                localStorage.setItem('kfa_local_custom_groups', JSON.stringify(updatedList));
                showToast('Group saved locally!', 'success');
            } else {
                const { data, error } = await supabaseAuth
                    .from('custom_recipient_groups')
                    .insert(newGroup)
                    .select('*');

                if (error) {
                    console.error('Error saving custom group to database:', error);
                    showToast('Failed to save to database. Saved locally.', 'error');
                    const updatedList = [
                        { id: `local-group-${Date.now()}`, ...newGroup },
                        ...customGroups
                    ];
                    setCustomGroups(updatedList);
                    localStorage.setItem('kfa_local_custom_groups', JSON.stringify(updatedList));
                } else {
                    setCustomGroups(prev => [data[0], ...prev]);
                    showToast('Custom Group saved successfully!', 'success');
                }
            }

            // Reset modal inputs
            setNewGroupName('');
            setNewGroupDesc('');
            setIsCreateGroupModalOpen(false);
        } catch (err: any) {
            console.error('Exception saving custom group:', err);
            showToast('An unexpected error occurred.', 'error');
        } finally {
            setIsSavingGroup(false);
        }
    };

    const handleCopyGroupsSQL = () => {
        const sql = `CREATE TABLE IF NOT EXISTS public.custom_recipient_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.custom_recipient_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all custom_recipient_groups" ON public.custom_recipient_groups;
CREATE POLICY "Allow all custom_recipient_groups" ON public.custom_recipient_groups FOR ALL USING (true) WITH CHECK (true);`;
        
        navigator.clipboard.writeText(sql);
        setSqlGroupsCopied(true);
        setTimeout(() => setSqlGroupsCopied(false), 3000);
    };

    const handleApplyCustomTemplate = (tpl: any) => {
        setSubject(tpl.subject);
        setContent(tpl.content);
        showToast(`Applied template "${tpl.name}"!`, 'success');
    };

    const handleLoadForResend = (bc: Broadcast) => {
        setSubject(bc.subject);
        setContent(bc.content);
        setActiveChannel(bc.channel);
        setSelectedRecipients(bc.recipients);
        
        // Scroll smoothly to composer form
        const composerElement = document.querySelector('form');
        if (composerElement) {
            composerElement.scrollIntoView({ behavior: 'smooth' });
        }
        showToast('Previous message loaded into the composer!', 'info');
    };

    const handleSaveTemplate = async (name: string) => {
        if (!teacherProfile || !name.trim()) return;
        setIsSavingTemplate(true);

        const newTemplate = {
            teacher_id: teacherProfile.id,
            name: name.trim(),
            subject: subject.trim(),
            content: content.trim(),
            created_at: new Date().toISOString()
        };

        try {
            if (dbSetupErrorTemplates) {
                const updatedList = [
                    { id: `local-tpl-${Date.now()}`, ...newTemplate },
                    ...customTemplates
                ];
                setCustomTemplates(updatedList);
                localStorage.setItem('kfa_local_templates', JSON.stringify(updatedList));
                showToast('Template saved locally!', 'success');
            } else {
                const { data, error } = await supabaseAuth
                    .from('message_templates')
                    .insert(newTemplate)
                    .select('*');

                if (error) {
                    console.error('Error saving template to database:', error);
                    showToast('Failed to save to database. Saved locally.', 'error');
                    const updatedList = [
                        { id: `local-tpl-${Date.now()}`, ...newTemplate },
                        ...customTemplates
                    ];
                    setCustomTemplates(updatedList);
                    localStorage.setItem('kfa_local_templates', JSON.stringify(updatedList));
                } else {
                    setCustomTemplates(prev => [data[0], ...prev]);
                    showToast('Template saved successfully!', 'success');
                }
            }

            setNewTemplateName('');
            setIsCreateTemplateModalOpen(false);
        } catch (err: any) {
            console.error('Exception saving template:', err);
            showToast('An unexpected error occurred.', 'error');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            if (dbSetupErrorTemplates || id.startsWith('local-')) {
                const updatedList = customTemplates.filter(t => t.id !== id);
                setCustomTemplates(updatedList);
                localStorage.setItem('kfa_local_templates', JSON.stringify(updatedList));
                showToast('Template deleted locally!', 'success');
            } else {
                const { error } = await supabaseAuth
                    .from('message_templates')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.error('Error deleting template:', error);
                    showToast(`Database deletion failed.`, 'error');
                } else {
                    setCustomTemplates(prev => prev.filter(t => t.id !== id));
                    showToast('Template deleted successfully!', 'success');
                }
            }
        } catch (err: any) {
            console.error('Exception deleting template:', err);
            showToast('An unexpected error occurred.', 'error');
        }
    };

    // ── Recipients Selection Modal Controls ────────────────────────────────────
    const openRecipientsModal = () => {
        // Hydrate initial checked targets
        setTempSelectedTargets(selectedRecipients.map(r => r.id));
        setModalSearchQuery('');
        setIsModalOpen(true);
    };

    const toggleTargetSelection = (id: string) => {
        setTempSelectedTargets(prev => {
            if (prev.includes(id)) {
                return prev.filter(t => t !== id);
            }
            return [...prev, id];
        });
    };

    const applySelectedRecipients = () => {
        const newSelection: Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }> = [];

        tempSelectedTargets.forEach(id => {
            if (id === 'global') {
                newSelection.push({ id: 'global', name: 'All Students (Global)', type: 'global' });
            } else {
                const roomMatch = classrooms.find(r => r.id === id);
                if (roomMatch) {
                    newSelection.push({ id: roomMatch.id, name: roomMatch.name, type: 'class' });
                } else {
                    const studentMatch = students.find(s => s.id === id);
                    if (studentMatch) {
                        newSelection.push({ id: studentMatch.id, name: studentMatch.name, type: 'student' });
                    }
                }
            }
        });

        setSelectedRecipients(newSelection);
        setIsModalOpen(false);
    };

    const removeRecipientChip = (id: string) => {
        setSelectedRecipients(prev => prev.filter(r => r.id !== id));
    };

    // ── Search & Filter Broadcast Logs ─────────────────────────────────────────
    const filteredBroadcasts = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return broadcasts;

        return broadcasts.filter(b => {
            const matchesSubject = b.subject.toLowerCase().includes(query);
            const matchesContent = b.content.toLowerCase().includes(query);
            const matchesRecipient = b.recipients.some(r => r.name.toLowerCase().includes(query));
            return matchesSubject || matchesContent || matchesRecipient;
        });
    }, [broadcasts, searchQuery]);

    // ── Copy SQL Code Block Helper ──────────────────────────────────────────────
    const handleCopySQL = () => {
        const sql = `CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'announcements',
  recipients JSONB NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_attachment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all broadcasts" ON public.broadcasts;
CREATE POLICY "Allow all broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);`;
        
        navigator.clipboard.writeText(sql);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 3000);
    };

    // Filter recipients for the Modal dialog listing based on active search
    const filteredModalItems = useMemo(() => {
        const query = modalSearchQuery.toLowerCase().trim();
        if (modalTab === 'class') {
            return classrooms.filter(c => c.name.toLowerCase().includes(query));
        } else {
            return students.filter(s => s.name.toLowerCase().includes(query));
        }
    }, [classrooms, students, modalTab, modalSearchQuery]);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#1a1608]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Loading Messages Workspace...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#1a1608] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex min-h-screen">
                {/* Sidebar Navigation */}
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                {/* Main Application Window */}
                <main className="flex-1 flex flex-col h-screen overflow-hidden">
                    <TeacherHeader 
                        title="Messages & Broadcasts" 
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        placeholder="Search messages, students, or broadcasts..."
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    {/* Sub-body workspace flow */}
                    <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-8 bg-[#f8f8f6] dark:bg-[#1a1608]/50">
                    
                    {/* Database Setup Banner Warning */}
                    {(dbSetupError || dbSetupErrorGroups || dbSetupErrorTemplates) && (
                        <div className="bg-rose-50 border border-rose-200/80 p-5 rounded-2xl flex flex-col gap-4 shadow-sm select-text">
                            <div className="flex gap-3">
                                <Info className="text-rose-500 w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-extrabold text-rose-900">
                                        {dbSetupError && dbSetupErrorGroups && dbSetupErrorTemplates ? 'Supabase Message & Template Tables Not Found' : 
                                         (dbSetupError ? 'Broadcasts Table Not Found. ' : '') + 
                                         (dbSetupErrorGroups ? 'Custom Recipient Groups Table Not Found. ' : '') + 
                                         (dbSetupErrorTemplates ? 'Message Templates Table Not Found.' : '')}
                                    </h4>
                                    <p className="text-xs text-rose-700 font-medium leading-relaxed mt-1">
                                        To enable permanent backend storage for your messaging and template features, open your Supabase SQL Editor and run the script below.
                                    </p>
                                </div>
                            </div>
                            <div className="relative">
                                <pre className="text-[10px] font-mono bg-rose-950/5 text-rose-800 p-4 rounded-xl max-h-32 overflow-y-auto border border-rose-200/60 leading-relaxed">
{dbSetupError && `CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'announcements',
  recipients JSONB NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_attachment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);
`}
{dbSetupErrorGroups && `CREATE TABLE IF NOT EXISTS public.custom_recipient_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.custom_recipient_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all custom_recipient_groups" ON public.custom_recipient_groups FOR ALL USING (true) WITH CHECK (true);
`}
{dbSetupErrorTemplates && `CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);
`}
                                </pre>
                                <button 
                                    onClick={() => {
                                        let sql = '';
                                        if (dbSetupError) {
                                            sql += `CREATE TABLE IF NOT EXISTS public.broadcasts (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  channel TEXT NOT NULL DEFAULT 'announcements',\n  recipients JSONB NOT NULL DEFAULT '[]',\n  subject TEXT NOT NULL,\n  content TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow all broadcasts" ON public.broadcasts;\nCREATE POLICY "Allow all broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);\n\n`;
                                        }
                                        if (dbSetupErrorGroups) {
                                            sql += `CREATE TABLE IF NOT EXISTS public.custom_recipient_groups (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  name TEXT NOT NULL,\n  description TEXT,\n  recipients JSONB NOT NULL DEFAULT '[]',\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nALTER TABLE public.custom_recipient_groups ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow all custom_recipient_groups" ON public.custom_recipient_groups;\nCREATE POLICY "Allow all custom_recipient_groups" ON public.custom_recipient_groups FOR ALL USING (true) WITH CHECK (true);\n\n`;
                                        }
                                        if (dbSetupErrorTemplates) {
                                            sql += `CREATE TABLE IF NOT EXISTS public.message_templates (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  name TEXT NOT NULL,\n  subject TEXT NOT NULL,\n  content TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow all message_templates" ON public.message_templates;\nCREATE POLICY "Allow all message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);`;
                                        }
                                        navigator.clipboard.writeText(sql);
                                        setSqlGroupsCopied(true);
                                        setTimeout(() => setSqlGroupsCopied(false), 3050);
                                    }}
                                    className="absolute right-3 top-3 px-3 py-1.5 bg-rose-900/10 hover:bg-rose-900/20 text-rose-800 text-[10px] font-bold rounded-lg border border-rose-300 transition-all flex items-center gap-1.5"
                                >
                                    {sqlGroupsCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    {sqlGroupsCopied ? 'Copy SQL' : 'Copy SQL'}
                                </button>
                            </div>
                            <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest">
                                💡 App is safely running in local fallback mode. Groups, templates, and broadcasts will be preserved temporarily in localStorage.
                            </p>
                        </div>
                    )}

                    {/* Left & Right messaging portal division */}
                    <div className="grid grid-cols-12 gap-8 items-start shrink-0">
                        {/* Channel selector panel (Col-span 4) */}
                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800">
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Message Channels</span>
                                <div className="space-y-2 mt-4">
                                    {[
                                        { id: 'announcements', label: 'Announcements', desc: 'Global Broadcast', icon: Megaphone, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
                                        { id: 'classroom', label: 'Classroom Broadcast', desc: 'Section-wise targets', icon: Presentation, color: 'text-blue-500 bg-blue-50' },
                                        { id: 'custom_groups', label: 'Custom Groups', desc: 'Performers, Beginners...', icon: Users, color: 'text-indigo-500 bg-indigo-50' },
                                        { id: 'new_joiners', label: 'New Joiners', desc: 'Automated workflows', icon: Sparkles, color: 'text-emerald-500 bg-emerald-50' },
                                        { id: 'fee_management', label: 'Fee Management', desc: 'Reminders & Receipts', icon: CreditCard, color: 'text-rose-500 bg-rose-50' },
                                    ].map((channel) => {
                                        const isSelected = activeChannel === channel.id;
                                        return (
                                            <button 
                                                key={channel.id}
                                                onClick={() => {
                                                    setActiveChannel(channel.id);
                                                    setSelectedRecipients([]);
                                                }}
                                                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border text-left ${
                                                    isSelected 
                                                        ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-stone-150' 
                                                        : 'bg-white border-transparent hover:bg-slate-50/50 dark:bg-slate-950/20'
                                                }`}
                                            >
                                                <div className={`p-2.5 rounded-lg shrink-0 ${channel.color}`}>
                                                    <channel.icon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-250">{channel.label}</h5>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{channel.desc}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-auto shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Saved Custom Groups Card */}
                            {activeChannel === 'custom_groups' && (
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col gap-3">
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                                        <span className="text-[10px] font-extrabold text-[#0e5f59] uppercase tracking-widest">Saved Custom Groups</span>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setNewGroupName('');
                                                setNewGroupDesc('');
                                                setIsCreateGroupModalOpen(true);
                                            }}
                                            className="text-[10px] text-[#0e5f59] hover:underline font-extrabold flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" /> Create Group
                                        </button>
                                    </div>

                                    {customGroups.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center py-4">No custom groups created yet.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-56 overflow-y-auto">
                                            {customGroups.map((grp) => (
                                                <button 
                                                    key={grp.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRecipients(grp.recipients);
                                                        showToast(`Loaded group "${grp.name}"!`, 'info');
                                                    }}
                                                    className="w-full flex flex-col p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-[#0e5f59]/5 border border-slate-200 dark:border-slate-700 hover:border-[#0e5f59]/30 rounded-xl text-left transition-all group"
                                                >
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-[#0e5f59] transition-colors">{grp.name}</span>
                                                    {grp.description && (
                                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">{grp.description}</span>
                                                    )}
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {grp.recipients.map((rec: any, idx: number) => (
                                                            <span key={idx} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-bold text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
                                                                {rec.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Insight card */}
                            <div className="bg-[#eef2f6]/60 border border-blue-100 p-5 rounded-2xl shadow-2xs select-none">
                                <h6 className="text-[10px] font-extrabold text-[#0e5f59] uppercase tracking-widest">Weekly Insight</h6>
                                <p className="text-xs font-semibold leading-relaxed text-slate-600 mt-2">
                                    Engagement is up 24% this week. Keep sending classroom updates! Daily play-along clicks have reached an all-time high of 420 lessons!
                                </p>
                            </div>
                        </div>

                        {/* Broadcast composer workspace (Col-span 8) */}
                        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Messaging Workspace</span>
                            
                            {/* Main Composer Form */}
                            <form onSubmit={handleSendBroadcast} className="bg-white p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs flex flex-col gap-6">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Compose Notification</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Targeted messages & push notification panel</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button" 
                                            className="px-4 py-2 hover:bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full transition-all"
                                        >
                                            View Analytics
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setNewTemplateName('');
                                                setIsCreateTemplateModalOpen(true);
                                            }}
                                            disabled={!subject.trim() || !content.trim()}
                                            className="px-4 py-2 hover:bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        >
                                            <FolderPlus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                            Save as Template
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isSending}
                                            className="px-5 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 text-xs font-bold rounded-full transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:bg-stone-300 disabled:text-slate-500 dark:text-slate-400 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            Send Notification
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6 items-start">
                                    {/* Left inputs column: recipients & templates */}
                                    <div className="col-span-12 md:col-span-5 flex flex-col gap-5 border-r border-slate-100/80 dark:border-slate-800/80 pr-4">
                                        {/* Recipients list block */}
                                        <div className="space-y-2.5">
                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recipients</span>
                                            
                                            {/* Pills view */}
                                            <div className="flex flex-wrap gap-2">
                                                {selectedRecipients.map((rec) => (
                                                    <span 
                                                        key={rec.id} 
                                                        className="px-2.5 py-1 bg-amber-50 text-[#b45309] text-[10px] font-bold rounded-full border border-amber-200/80 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                                                    >
                                                        {rec.name}
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeRecipientChip(rec.id)}
                                                            className="hover:bg-amber-200/40 p-0.5 rounded-full"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={openRecipientsModal}
                                                    className="px-3 py-1 bg-white hover:bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-[#0e5f59] text-[10px] font-bold rounded-full transition-all flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add Classes/Tags
                                                </button>

                                                {selectedRecipients.length > 0 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setNewGroupName('');
                                                            setNewGroupDesc('');
                                                            setIsCreateGroupModalOpen(true);
                                                        }}
                                                        className="px-3 py-1 bg-white hover:bg-[#0e5f59]/5 border border-slate-200 dark:border-slate-700 text-[#0e5f59] text-[10px] font-bold rounded-full transition-all flex items-center gap-1"
                                                    >
                                                        <FolderPlus className="w-3.5 h-3.5" />
                                                        Save Selection as Group
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Templates block */}
                                        <div className="space-y-3 pt-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Message Templates</span>
                                                {customTemplates.length > 0 && (
                                                    <span className="text-[9px] font-bold text-[#ecb613] bg-[#ecb613]/10 px-2 py-0.5 rounded-full">
                                                        {filteredTemplates.length} of {customTemplates.length}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Template Search Input */}
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3.5 h-3.5" />
                                                <input 
                                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-[#ecb613] font-semibold text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:text-slate-600"
                                                    placeholder="Search templates..."
                                                    type="text"
                                                    value={templateSearchQuery}
                                                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            {filteredTemplates.length === 0 ? (
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                    No templates found matching "{templateSearchQuery}"
                                                </p>
                                            ) : (
                                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                    {filteredTemplates.map((tpl) => (
                                                        <div key={tpl.id} className="flex items-center gap-2">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleApplyCustomTemplate(tpl)}
                                                                className="flex-1 flex items-center gap-3 p-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-700 transition-all text-left group"
                                                            >
                                                                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 group-hover:bg-[#ecb613]/10 rounded-lg text-slate-600 dark:text-slate-400 group-hover:text-[#ecb613] transition-colors shrink-0">
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{tpl.name}</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTemplate(tpl.id)}
                                                                className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors shrink-0"
                                                                title="Delete Template"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right inputs column: subject & body content editor */}
                                    <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                                        {attachedAudioNote && (
                                            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-3 rounded-xl animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-amber-850 dark:text-amber-300">
                                                    <Mic className="w-4 h-4 text-amber-600 animate-pulse" />
                                                    <span>🎙️ Flute Voice Note Attached Preview</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={togglePlayback}
                                                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-all"
                                                    >
                                                        {isPlayingAudio ? 'Pause' : 'Listen'}
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={discardAudioNote}
                                                        className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                                                        title="Remove attachment"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Broadcast Subject</label>
                                            <input 
                                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] font-semibold text-slate-800 dark:text-slate-200 bg-white placeholder:text-slate-300 dark:text-slate-600"
                                                placeholder="e.g. Important Update: New Practice Schedule" 
                                                type="text" 
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Message Content</label>
                                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col bg-white dark:bg-slate-900">
                                                {/* Mock Editor Toolbar */}
                                                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex gap-4 text-slate-400 dark:text-slate-500 text-xs select-none">
                                                    <span className="font-bold cursor-pointer hover:text-slate-800 dark:text-slate-200">B</span>
                                                    <span className="italic cursor-pointer hover:text-slate-800 dark:text-slate-200 font-serif">I</span>
                                                    <span className="cursor-pointer hover:text-slate-800 dark:text-slate-200">List</span>
                                                    <span className="cursor-pointer hover:text-slate-800 dark:text-slate-200">Link</span>
                                                    <span className="cursor-pointer hover:text-slate-800 dark:text-slate-200">Img</span>
                                                </div>
                                                <textarea 
                                                    className="p-4 text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:text-slate-500 resize-none h-44 outline-none border-none bg-white" 
                                                    placeholder="Write your message here. You can use @name to personalize..."
                                                    value={content}
                                                    onChange={(e) => setContent(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Bottom Recent Broadcasts log section */}
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/80 pb-3">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Recent Broadcasts</h3>
                            <button 
                                onClick={() => showToast('Viewing complete message logs history...', 'info')}
                                className="text-amber-600 hover:text-amber-700 text-xs font-bold transition-colors"
                            >
                                View All History
                            </button>
                        </div>

                        <div className="grid grid-cols-12 gap-8 items-start select-text">
                            {/* Broadcast logs list (Col-span 8) */}
                            <div className="col-span-12 lg:col-span-8 flex flex-col gap-3">
                                {filteredBroadcasts.length === 0 ? (
                                    <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                                        <Info className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No broadcasts found matching "{searchQuery}"</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Try refining your search terms or send a new broadcast!</p>
                                    </div>
                                ) : (
                                    filteredBroadcasts.map((bc) => (
                                        <div key={bc.id} className="bg-white p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row gap-6 justify-between items-start animate-in fade-in-50 duration-200">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0e5f59] bg-[#0e5f59]/10 px-2.5 py-0.5 rounded-full">
                                                        {bc.channel.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                                        {new Date(bc.created_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{bc.subject}</h4>
                                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">{bc.content}</p>
                                                {(bc as any).audio_attachment && (
                                                    <div className="flex items-center gap-2 mt-3 select-none">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const audio = new Audio((bc as any).audio_attachment);
                                                                audio.play();
                                                                showToast('Playing attached flute note...', 'info');
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800/40 dark:bg-slate-800 hover:bg-[#ecb613]/10 hover:text-[#ecb613] text-slate-600 dark:text-slate-400 dark:text-slate-300 text-[10px] font-bold rounded-full border border-slate-200 dark:border-slate-700 dark:border-slate-700 transition-all"
                                                        >
                                                            <Mic className="w-3.5 h-3.5 text-[#ecb613]" />
                                                            Play Attached Flute Note
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="shrink-0 flex flex-col gap-3 min-w-44 text-right justify-between md:h-full">
                                                <div className="space-y-1">
                                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">Sent To</span>
                                                    <div className="flex flex-wrap md:justify-end gap-1.5">
                                                        {bc.recipients.map((rec, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[9px] font-bold rounded">
                                                                {rec.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 items-end">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                                        <span>Active</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadForResend(bc)}
                                                        className="mt-1 text-[10px] font-extrabold text-[#ecb613] hover:text-[#d49f0e] transition-colors flex items-center gap-1 hover:underline"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                        Edit & Resend
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Floating mic tip card on the right (Col-span 4) */}
                            {audioRecorderOpen ? (
                                <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs flex flex-col gap-4 select-none animate-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-[#ecb613]">Interactive Recorder</span>
                                        <button 
                                            type="button"
                                            onClick={() => setAudioRecorderOpen(false)}
                                            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    
                                    <div className="flex items-center justify-center py-4 flex-col gap-3">
                                        {isRecordingAudio ? (
                                            <>
                                                <div className="flex items-center gap-1 h-8">
                                                    <span className="w-1.5 bg-red-500 rounded-full animate-bounce h-4 duration-300"></span>
                                                    <span className="w-1.5 bg-red-500 rounded-full animate-bounce h-6 duration-200 delay-75"></span>
                                                    <span className="w-1.5 bg-red-500 rounded-full animate-bounce h-8 duration-300 delay-150"></span>
                                                    <span className="w-1.5 bg-red-500 rounded-full animate-bounce h-5 duration-200 delay-100"></span>
                                                    <span className="w-1.5 bg-red-500 rounded-full animate-bounce h-3 duration-300 delay-75"></span>
                                                </div>
                                                <span className="text-xs font-bold text-red-500 animate-pulse">
                                                    Recording: {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={stopRecording}
                                                    className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg transition-all shadow-sm"
                                                >
                                                    Stop Recording
                                                </button>
                                            </>
                                        ) : audioUrl ? (
                                            <>
                                                <div className="flex items-center gap-3 justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={togglePlayback}
                                                        className="p-3 bg-[#ecb613] text-slate-900 rounded-full hover:scale-105 transition-all shadow-sm flex items-center justify-center"
                                                        title={isPlayingAudio ? 'Pause' : 'Play'}
                                                     >
                                                        <Mic className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                                                    </button>
                                                    <div className="text-left">
                                                        <h6 className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100">Recording Finished</h6>
                                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Size: ~{(recordedBlob?.size ? (recordedBlob.size / 1024).toFixed(1) : 0)} KB</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-2 w-full justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={attachAudioNote}
                                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-xs"
                                                    >
                                                        Attach Note
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={discardAudioNote}
                                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-stone-200 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-lg transition-all shadow-xs"
                                                    >
                                                        Discard
                                                    </button>
                                                </div>
                                            </>
                                        ) : isMicUnavailable ? (
                                            <>
                                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-[#ecb613] rounded-full shrink-0 shadow-xs border border-amber-200/30 animate-bounce">
                                                    <Sparkles className="w-8 h-8 text-[#ecb613]" />
                                                </div>
                                                <div className="text-center space-y-1 w-full animate-in fade-in duration-300">
                                                    <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100">Synthesizer Fallback</h6>
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 max-w-[200px] mx-auto">
                                                        Microphone unavailable. Dynamically generate high-fidelity simulated flute notes!
                                                    </p>
                                                    
                                                    {micPermissionDenied && (
                                                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-left flex flex-col gap-1.5 animate-in slide-in-from-top duration-300 select-none">
                                                            <div className="flex gap-1.5 items-center">
                                                                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                                <span className="text-[9.5px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider">How to Fix Mic Access:</span>
                                                            </div>
                                                            <ol className="list-decimal pl-4 text-[9px] text-slate-600 dark:text-slate-300 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                                                                <li>Click the <strong>padlock/camera icon</strong> in your browser's URL bar (top of screen).</li>
                                                                <li>Change <strong>Microphone</strong> permission from <em>Block</em> to <strong>Allow</strong>.</li>
                                                                <li>Click <strong>Retry Mic</strong> below to re-verify hardware settings.</li>
                                                            </ol>
                                                        </div>
                                                    )}

                                                    <div className="mt-3 text-left w-full space-y-1.5 px-2">
                                                        <label className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Select Tone / Melody</label>
                                                        <select
                                                            value={selectedPreset}
                                                            onChange={(e) => setSelectedPreset(e.target.value)}
                                                            className="w-full text-xs font-bold px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg outline-none bg-slate-50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-[#ecb613] select-none"
                                                        >
                                                            <option value="d5">D5 Pure Flute Note (Warm & Clear)</option>
                                                            <option value="a5">A5 High Flute Note (Bright & Airy)</option>
                                                            <option value="kfa">KFA Signature Flute Arpeggio (Ascending Scale)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex gap-2 w-full px-2 mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleSynthesizeFlute}
                                                        disabled={isSynthesizing}
                                                        className="flex-1 px-4 py-1.5 bg-[#ecb613] hover:bg-[#d49f0e] disabled:bg-stone-200 disabled:text-slate-400 dark:text-slate-500 text-slate-900 text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                                                    >
                                                        {isSynthesizing ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>Synthesizing...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-3.5 h-3.5" />
                                                                <span>Generate Note</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsMicUnavailable(false);
                                                            startRecording();
                                                        }}
                                                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg transition-all"
                                                    >
                                                        Retry Mic
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-[#ecb613] rounded-full shrink-0 shadow-xs border border-amber-200/30">
                                                    <Mic className="w-8 h-8" />
                                                </div>
                                                <div className="text-center space-y-1">
                                                    <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100">Microphone Ready</h6>
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 max-w-[200px] mx-auto">Press button to record a live flute sample and attach it</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={startRecording}
                                                    className="px-4 py-1.5 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 text-xs font-bold rounded-lg transition-all shadow-xs"
                                                >
                                                    Start Recording
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMicUnavailable(true)}
                                                    className="mt-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 hover:text-[#ecb613] transition-colors"
                                                >
                                                    Or switch to virtual synthesizer fallback &rarr;
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xs flex items-center gap-4 select-none animate-in fade-in duration-200">
                                    <div className="p-3 bg-amber-800 text-white rounded-full shrink-0 shadow-sm animate-pulse">
                                        <Mic className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700">Live Tip</span>
                                        <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">Record Flute Notes</h5>
                                        <p className="text-[10px] font-bold leading-relaxed text-slate-500 dark:text-slate-400 mt-1">
                                            Teachers can record and broadcast dynamic flute audio samples directly to inspire student practice checklists!
                                        </p>
                                        <button 
                                            type="button"
                                            onClick={() => setAudioRecorderOpen(true)}
                                            className="mt-2 text-[10px] font-extrabold text-[#ecb613] hover:text-[#d49f0e] hover:underline flex items-center gap-0.5"
                                        >
                                            Try recorder now &rarr;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>

            {/* Interactive Overlay Target Selector Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[500px]">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Select Recipients</h3>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Pick targeted classrooms or individual students</p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search and Tab selectors */}
                        <div className="px-6 py-4 flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800">
                            {/* Target Class vs Student Toggle */}
                            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1 select-none">
                                <button 
                                    onClick={() => setModalTab('class')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                        modalTab === 'class' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
                                    }`}
                                >
                                    Classrooms
                                </button>
                                <button 
                                    onClick={() => setModalTab('student')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                        modalTab === 'student' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
                                    }`}
                                >
                                    Students
                                </button>
                            </div>

                            {/* Inner Search Box */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#ecb613] font-medium text-slate-800 dark:text-slate-100" 
                                    placeholder={`Filter ${modalTab === 'class' ? 'classrooms' : 'students'}...`}
                                    type="text" 
                                    value={modalSearchQuery}
                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* List items with checkboxes */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-60">
                            {/* Special global targeting option when Class tab is open */}
                            {modalTab === 'class' && !modalSearchQuery && (
                                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:bg-slate-800/80 rounded-xl cursor-pointer border border-transparent hover:border-slate-200 dark:border-slate-700 transition-all">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSelectedTargets.includes('global')}
                                        onChange={() => toggleTargetSelection('global')}
                                        className="rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 focus:ring-1"
                                    />
                                    <div className="min-w-0 select-none">
                                        <h6 className="text-sm font-bold text-slate-800 dark:text-slate-250">All Students (Global)</h6>
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Global Broadcast target</p>
                                    </div>
                                </label>
                            )}

                            {filteredModalItems.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">No matching results found.</p>
                            ) : (
                                filteredModalItems.map((item) => (
                                    <label key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:bg-slate-800/80 rounded-xl cursor-pointer border border-transparent hover:border-slate-200 dark:border-slate-700 transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={tempSelectedTargets.includes(item.id)}
                                            onChange={() => toggleTargetSelection(item.id)}
                                            className="rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 focus:ring-1"
                                        />
                                        <div className="min-w-0 select-none">
                                            <h6 className="text-sm font-bold text-slate-800 dark:text-slate-250 truncate">{item.name}</h6>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                                {modalTab === 'class' ? 'Classroom Group' : 'Individual Student'}
                                            </p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        {/* Modal Footer actions */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 hover:bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={applySelectedRecipients}
                                className="px-5 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 text-xs font-bold rounded-xl transition-all shadow-md active:translate-y-[1px]"
                            >
                                Apply Targets
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Create Custom Group Modal */}
            {isCreateGroupModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[500px]">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Create Custom Group</h3>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Save targeted lists for instant future broadcasts</p>
                            </div>
                            <button 
                                onClick={() => setIsCreateGroupModalOpen(false)}
                                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Fields */}
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Group Name</label>
                                <input 
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] font-semibold text-slate-800 dark:text-slate-200 bg-white placeholder:text-slate-300 dark:text-slate-600"
                                    placeholder="e.g. Advanced Flautists, Saturday Performers" 
                                    type="text" 
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Group Description (Optional)</label>
                                <input 
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] font-semibold text-slate-800 dark:text-slate-200 bg-white placeholder:text-slate-300 dark:text-slate-600"
                                    placeholder="e.g. Students in the weekend morning masterclass" 
                                    type="text" 
                                    value={newGroupDesc}
                                    onChange={(e) => setNewGroupDesc(e.target.value)}
                                />
                            </div>

                            {/* Recipients preview summary */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Selected Members ({selectedRecipients.length})</label>
                                {selectedRecipients.length === 0 ? (
                                    <div className="p-3.5 bg-amber-50/50 rounded-xl border border-dashed border-amber-200 text-center">
                                        <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">
                                            No members selected. Close this dialog, choose targeted classes/students in the composer first, and click "Save Selection as Group"!
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                                        {selectedRecipients.map((rec) => (
                                            <span key={rec.id} className="px-2 py-0.5 bg-white border border-slate-200 dark:border-slate-700 text-[9px] font-bold text-slate-600 dark:text-slate-400 rounded">
                                                {rec.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer actions */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setIsCreateGroupModalOpen(false)}
                                className="px-4 py-2 hover:bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleSaveCustomGroup(newGroupName, newGroupDesc, selectedRecipients)}
                                disabled={selectedRecipients.length === 0 || !newGroupName.trim() || isSavingGroup}
                                className="px-5 py-2 bg-[#0e5f59] hover:bg-[#0c4e49] text-white text-xs font-bold rounded-full transition-all shadow-xs disabled:bg-stone-300 disabled:cursor-not-allowed"
                            >
                                {isSavingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Custom Template Modal */}
            {isCreateTemplateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[500px]">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Save Message as Template</h3>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Give your composed message a reusable template name</p>
                            </div>
                            <button 
                                onClick={() => setIsCreateTemplateModalOpen(false)}
                                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Fields */}
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Template Name</label>
                                <input 
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#0e5f59] font-semibold text-slate-800 dark:text-slate-200 bg-white placeholder:text-slate-300 dark:text-slate-600"
                                    placeholder="e.g. Student Progress Update, Saturday Reschedule" 
                                    type="text" 
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                />
                            </div>

                            {/* Template Preview */}
                            <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#0e5f59]">Template Content Preview</span>
                                <div className="space-y-1">
                                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">Subject: {subject}</h5>
                                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {content}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer actions */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setIsCreateTemplateModalOpen(false)}
                                className="px-4 py-2 hover:bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleSaveTemplate(newTemplateName)}
                                disabled={!newTemplateName.trim() || isSavingTemplate}
                                className="px-5 py-2 bg-[#0e5f59] hover:bg-[#0c4e49] text-white text-xs font-bold rounded-full transition-all shadow-xs disabled:bg-stone-300 disabled:cursor-not-allowed"
                            >
                                {isSavingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Custom Toast Notification */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 dark:border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm select-text">
                    {toast.type === 'success' ? (
                        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : toast.type === 'error' ? (
                        <Info className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                        <Info className="w-5 h-5 text-blue-500 shrink-0" />
                    )}
                    <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
                </div>
            )}
        </div>
    );
}

export default function MessagesDashboardPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-full flex items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
            </div>
        }>
            <MessagesDashboardContent />
        </Suspense>
    );
}
