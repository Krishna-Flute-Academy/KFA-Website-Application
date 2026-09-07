'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { supabase } from '../../../src/lib/supabase';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { sendClassroomNotification } from '../../../src/lib/notifications';
import { htmlToPlainText, sanitizeHtml } from '../../../src/lib/text-utils';
import { 
    Loader2, Search, Megaphone, Sparkles, CreditCard, Users, 
    Presentation, Bell, HelpCircle, Send, FileText, Clock, 
    Calendar, Check, Copy, Mic, Plus, Info, X, ChevronRight, Globe, Eye,
    FolderPlus, Edit, MessageSquare, ArrowLeft, Trash2, CheckCheck,
    BookOpen, Youtube, RefreshCw, Link2, Image as ImageIcon,
    Play, ExternalLink, Folder, Archive, Pause
} from 'lucide-react';
import RichTextEditor from '../../../src/components/common/RichTextEditor';
import AutoLinkText from '../../../src/components/common/AutoLinkText';

interface Broadcast {
    id: string;
    channel: string;
    recipients: Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }>;
    subject: string;
    content: string;
    created_at: string;
}

interface FeaturedUpdate {
    id: string;
    creator_id: string;
    title: string;
    description: string | null;
    url: string;
    thumbnail_url: string | null;
    content_type: string;
    cta_label: string;
    recipients: Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }>;
    status: 'draft' | 'active' | 'paused' | 'archived';
    start_date: string | null;
    end_date: string | null;
    notify_reset_at?: string | null;
    created_at: string;
    updated_at: string;
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
        content: 'Hi there, this is a gentle reminder that your tuition fee invoice for this month is ready for processing. Please check your billing dashboard to submit your fee payment.'
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
    const paramStudentId = searchParams.get('studentId') || searchParams.get('chat');
    const paramStudentName = searchParams.get('studentName');
    const lastProcessedStudentIdRef = useRef<string | null>(null);

    // ── Global states ──────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
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
    const [defaultTemplates, setDefaultTemplates] = useState<Record<string, { subject: string, content: string }>>({
        announcements: {
            subject: 'Academy Announcement: [Topic] 📢',
            content: 'Hello students, here is an important announcement regarding our upcoming sessions: [Details]'
        },
        classroom: {
            subject: 'Classroom Update: [Class Name] 👥',
            content: 'Hello classroom students, please note the following update for our class: [Details]'
        },
        custom_groups: {
            subject: 'Group Update: [Group Name] 🌟',
            content: 'Hi team, here is a special update for our group: [Details]'
        },
        new_joiners: {
            subject: 'Welcome to Krishna Flute Academy! 🎶',
            content: 'Welcome! We are thrilled to have you join our flute family. Let\'s begin this wonderful musical journey together!'
        },
        fee_management: {
            subject: 'Tuition Fee Invoice Ready 💳',
            content: 'Hi there, this is a gentle reminder that your tuition fee invoice for this month is ready. Please check your billing dashboard to make a payment.'
        }
    });
    const [dbSetupErrorTemplates, setDbSetupErrorTemplates] = useState(false);
    const [broadcastReads, setBroadcastReads] = useState<any[]>([]);
    const [dbSetupErrorReads, setDbSetupErrorReads] = useState(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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
    
    // Authorization safeguard: teachers cannot access kfa_updates
    useEffect(() => {
        if (teacherProfile && teacherProfile.role !== 'admin' && activeChannel === 'kfa_updates') {
            setActiveChannel('chatbox');
        }
    }, [teacherProfile, activeChannel]);
    
    // System Notification Settings (Blog, YouTube, and Featured Updates pause/enable)
    const [systemNotifSettings, setSystemNotifSettings] = useState<{ 
        blog_enabled: boolean; 
        video_enabled: boolean; 
        featured_updates_enabled: boolean; 
    }>({
        blog_enabled: true,
        video_enabled: true,
        featured_updates_enabled: false // Safe default: OFF initially
    });
    const [isUpdatingNotifSettings, setIsUpdatingNotifSettings] = useState(false);

    useEffect(() => {
        const loadNotifSettings = async () => {
            try {
                const { data } = await supabaseAuth
                    .from('message_templates')
                    .select('id, content')
                    .eq('name', 'system_notification_settings')
                    .maybeSingle();
                if (data?.content) {
                    const parsed = JSON.parse(data.content);
                    setSystemNotifSettings({
                        blog_enabled: parsed.blog_enabled !== false,
                        video_enabled: parsed.video_enabled !== false,
                        featured_updates_enabled: parsed.featured_updates_enabled === true // Safe default: false
                    });
                }
            } catch (e) {
                console.warn('Could not load system notification settings:', e);
            }
        };
        loadNotifSettings();
    }, []);

    const handleToggleSystemNotification = async (channelType: 'blog' | 'video' | 'featured_updates') => {
        if (!teacherProfile?.id) return;
        setIsUpdatingNotifSettings(true);
        try {
            const key = channelType === 'blog' 
                ? 'blog_enabled' 
                : channelType === 'video' 
                    ? 'video_enabled' 
                    : 'featured_updates_enabled';
            
            const nextSettings = {
                ...systemNotifSettings,
                [key]: !systemNotifSettings[key]
            };

            setSystemNotifSettings(nextSettings);

            const { data: existing } = await supabaseAuth
                .from('message_templates')
                .select('id')
                .eq('name', 'system_notification_settings')
                .maybeSingle();

            const payload = {
                teacher_id: teacherProfile.id,
                name: 'system_notification_settings',
                subject: 'System Automated Notification Settings',
                content: JSON.stringify(nextSettings)
            };

            if (existing?.id) {
                await supabaseAuth
                    .from('message_templates')
                    .update({
                        content: payload.content,
                        subject: payload.subject
                    })
                    .eq('id', existing.id);
            } else {
                await supabaseAuth
                    .from('message_templates')
                    .insert(payload);
            }

            const isNowEnabled = nextSettings[key];
            const stateText = isNowEnabled ? 'Enabled' : 'Paused';
            const featureName = channelType === 'blog' 
                ? 'Blog auto-notifications' 
                : channelType === 'video' 
                    ? 'YouTube auto-notifications' 
                    : 'Floating "What\'s New at KFA" feature';
            showToast(`${featureName} ${stateText.toLowerCase()}!`, 'success');
        } catch (e: any) {
            console.error('Failed to update system notification settings:', e);
            showToast('Failed to update notification settings.', 'error');
        } finally {
            setIsUpdatingNotifSettings(false);
        }
    };
    
    // Compose Form
    const [selectedRecipients, setSelectedRecipients] = useState<Array<{ id: string; name: string; type: 'class' | 'student' | 'global' | 'custom' }>>([]);
    const [kfaUpdateSubTab, setKfaUpdateSubTab] = useState<'blog' | 'video'>('blog');
    const [recipientCustomUrls, setRecipientCustomUrls] = useState<Record<string, string>>({});

    // Auto-fetched reference records
    const [autoFetchedBlogUrl, setAutoFetchedBlogUrl] = useState('');
    const [autoFetchedBlogImage, setAutoFetchedBlogImage] = useState('');
    const [autoFetchedVideoUrl, setAutoFetchedVideoUrl] = useState('');
    const [autoFetchedVideoImage, setAutoFetchedVideoImage] = useState('');

    useEffect(() => {
        if (paramStudentId && lastProcessedStudentIdRef.current !== paramStudentId) {
            setActiveChannel('chatbox');
            setActiveChatStudentId(paramStudentId);
            if (paramStudentName) {
                setSelectedRecipients([
                    {
                        id: paramStudentId,
                        name: decodeURIComponent(paramStudentName),
                        type: 'student'
                    }
                ]);
            }
            lastProcessedStudentIdRef.current = paramStudentId;
        }
    }, [paramStudentId, paramStudentName]);

    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [targetImage, setTargetImage] = useState('');
    const [fetchingAutoData, setFetchingAutoData] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const fetchLatestBlogData = useCallback(async () => {
        setFetchingAutoData(true);
        try {
            let post: any = null;
            const res1 = await supabase
                .from('blog_posts')
                .select('id, title, slug, excerpt, content, featured_image')
                .eq('published', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (res1.data) post = res1.data;

            if (!post) {
                const res2 = await supabaseAuth
                    .from('blog_posts')
                    .select('id, title, slug, excerpt, content, featured_image')
                    .eq('published', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (res2.data) post = res2.data;
            }

            if (post) {
                let img = (post.featured_image || '').trim();
                if (!img && post.content) {
                    const match = post.content.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (match && match[1]) img = match[1];
                }
                const bUrl = post.slug ? `/blog/${post.slug}` : `/blog`;
                setAutoFetchedBlogUrl(bUrl);
                setAutoFetchedBlogImage(img);
                setSubject(`New Blog: ${post.title}`);
                setContent(post.excerpt || `Check out our latest blog post: ${post.title}`);
                setTargetUrl(bUrl);
                setTargetImage(img);
                showToast('Auto-populated latest Blog Post cover image & data!', 'info');
                return;
            }

            const defaultBlogUrl = '/blog';
            setAutoFetchedBlogUrl(defaultBlogUrl);
            setAutoFetchedBlogImage('');
            setSubject('New Academy Blog Article 📰');
            setContent('Check out our latest blog article on flute techniques and academy news!');
            setTargetUrl(defaultBlogUrl);
            setTargetImage('');
            showToast('No published blog post found. Pre-filled template values.', 'info');
        } catch (err) {
            console.warn('Failed to fetch latest blog post:', err);
            const defaultBlogUrl = '/blog';
            setAutoFetchedBlogUrl(defaultBlogUrl);
            setAutoFetchedBlogImage('');
            setSubject('New Academy Blog Article 📰');
            setContent('Check out our latest blog article on flute techniques and academy news!');
            setTargetUrl(defaultBlogUrl);
            setTargetImage('');
            showToast('Could not fetch blog posts. Set default template values.', 'info');
        } finally {
            setFetchingAutoData(false);
        }
    }, [showToast]);

    const fetchLatestVideoData = useCallback(async () => {
        setFetchingAutoData(true);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch('/api/latest-youtube-video', { signal: controller.signal }).catch(() => null);
            clearTimeout(timeoutId);

            if (res && res.ok) {
                const video = await res.json().catch(() => null);
                if (video?.videoId) {
                    const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                    const vUrl = video.url || `https://www.youtube.com/watch?v=${video.videoId}`;
                    setAutoFetchedVideoUrl(vUrl);
                    setAutoFetchedVideoImage(thumb);
                    setSubject(`New Video: ${video.title}`);
                    setContent(video.description || `Watch our latest YouTube release: ${video.title}`);
                    setTargetUrl(vUrl);
                    setTargetImage(thumb);
                    showToast('Auto-populated latest YouTube Video thumbnail & data!', 'info');
                    return;
                }
            }

            const defaultVidUrl = 'https://www.youtube.com';
            const defaultVidThumb = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';
            setAutoFetchedVideoUrl(defaultVidUrl);
            setAutoFetchedVideoImage(defaultVidThumb);
            setSubject('New Flute Video Release 🎥');
            setContent('Check out our latest flute lesson and performance video on YouTube!');
            setTargetUrl(defaultVidUrl);
            setTargetImage(defaultVidThumb);
            showToast('YouTube feed unavailable. Pre-filled template values.', 'info');
        } catch (err) {
            console.warn('Failed to fetch latest video:', err);
            const defaultVidUrl = 'https://www.youtube.com';
            const defaultVidThumb = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';
            setAutoFetchedVideoUrl(defaultVidUrl);
            setAutoFetchedVideoImage(defaultVidThumb);
            setSubject('New Flute Video Release 🎥');
            setContent('Check out our latest flute lesson and performance video on YouTube!');
            setTargetUrl(defaultVidUrl);
            setTargetImage(defaultVidThumb);
            showToast('Could not fetch YouTube feed. Set default values.', 'info');
        } finally {
            setFetchingAutoData(false);
        }
    }, [showToast]);

    const extractYouTubeVideoId = (url: string): string | null => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handleTargetUrlChange = async (newUrl: string) => {
        setTargetUrl(newUrl);
        if (!newUrl.trim()) return;

        // 1. Check for YouTube link
        const videoId = extractYouTubeVideoId(newUrl);
        if (videoId) {
            const hqThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            setTargetImage(hqThumbnail);

            try {
                const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(newUrl)}&format=json`).catch(() => null);
                if (oembedRes && oembedRes.ok) {
                    const oembedData = await oembedRes.json().catch(() => null);
                    if (oembedData?.title) {
                        setSubject(`New Video: ${oembedData.title}`);
                    }
                    if (oembedData?.thumbnail_url) {
                        setTargetImage(oembedData.thumbnail_url);
                    }
                }
            } catch {}
            showToast('Auto-populated YouTube video thumbnail & title!', 'info');
            return;
        }

        // 2. Check for Blog link
        let blogSlug = '';
        if (newUrl.includes('/blog/')) {
            blogSlug = newUrl.split('/blog/')[1]?.split('?')[0]?.split('#')[0] || '';
        } else if (!newUrl.startsWith('http') && !newUrl.startsWith('/')) {
            blogSlug = newUrl.trim();
        }

        if (blogSlug) {
            try {
                let post: any = null;
                const res1 = await supabase
                    .from('blog_posts')
                    .select('title, excerpt, content, featured_image')
                    .eq('slug', blogSlug)
                    .maybeSingle();
                if (res1.data) post = res1.data;

                if (!post) {
                    const res2 = await supabaseAuth
                        .from('blog_posts')
                        .select('title, excerpt, content, featured_image')
                        .eq('slug', blogSlug)
                        .maybeSingle();
                    if (res2.data) post = res2.data;
                }

                if (post) {
                    let img = (post.featured_image || '').trim();
                    if (!img && post.content) {
                        const match = post.content.match(/<img[^>]+src=["']([^"']+)["']/i);
                        if (match && match[1]) img = match[1];
                    }
                    if (img) setTargetImage(img);
                    if (post.title) setSubject(`New Blog: ${post.title}`);
                    if (post.excerpt) setContent(post.excerpt);
                    showToast('Auto-populated Blog post cover image & details!', 'info');
                }
            } catch {}
        }
    };

    // Auto-populate inputs based on selected channel and template
    useEffect(() => {
        if (activeChannel === 'kfa_updates' || activeChannel === 'blog' || activeChannel === 'video') {
            if (activeChannel === 'kfa_updates') {
                if (kfaUpdateSubTab === 'blog') {
                    fetchLatestBlogData();
                } else {
                    fetchLatestVideoData();
                }
            } else if (activeChannel === 'blog') {
                fetchLatestBlogData();
            } else if (activeChannel === 'video') {
                fetchLatestVideoData();
            }
        } else if (activeChannel && activeChannel !== 'chatbox') {
            const template = defaultTemplates[activeChannel];
            if (template) {
                setSubject(template.subject);
                setContent(template.content);
            } else {
                setSubject('');
                setContent('');
            }
            setTargetUrl('');
            setTargetImage('');
        }
    }, [activeChannel, kfaUpdateSubTab, defaultTemplates, fetchLatestBlogData, fetchLatestVideoData]);

    const handleSaveDefaultTemplate = async () => {
        if (!teacherProfile?.id || !activeChannel || activeChannel === 'chatbox') return;
        setIsSavingTemplate(true);
        try {
            const newTpl = {
                subject: subject.trim(),
                content: content.trim()
            };

            // Update local state and localStorage
            setDefaultTemplates(prev => {
                const updated = {
                    ...prev,
                    [activeChannel]: newTpl
                };
                localStorage.setItem('kfa_channel_templates', JSON.stringify(updated));
                return updated;
            });

            if (!dbSetupErrorTemplates) {
                // Check if template exists for teacher and channel name
                const { data: existing } = await supabaseAuth
                    .from('message_templates')
                    .select('id')
                    .eq('teacher_id', teacherProfile.id)
                    .eq('name', activeChannel)
                    .maybeSingle();

                if (existing?.id) {
                    await supabaseAuth
                        .from('message_templates')
                        .update({
                            subject: newTpl.subject,
                            content: newTpl.content
                        })
                        .eq('id', existing.id);
                } else {
                    await supabaseAuth
                        .from('message_templates')
                        .insert({
                            teacher_id: teacherProfile.id,
                            name: activeChannel,
                            subject: newTpl.subject,
                            content: newTpl.content
                        });
                }
            }
            showToast('Channel template saved successfully!', 'success');
        } catch (err) {
            console.error('Failed to save channel template:', err);
            showToast('Failed to save channel template.', 'error');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleSaveChatTemplate = async (templateName: string) => {
        if (!templateName.trim() || !chatInput.trim() || !teacherProfile?.id) return;
        setIsSavingChatTemplate(true);
        try {
            const payload = {
                teacher_id: teacherProfile.id,
                name: templateName.trim(),
                subject: '',
                content: chatInput.trim()
            };

            let savedItem;
            if (!dbSetupErrorTemplates) {
                const { data, error } = await supabaseAuth
                    .from('message_templates')
                    .insert([payload])
                    .select();
                if (error) throw error;
                if (data && data[0]) {
                    savedItem = data[0];
                }
            }
            
            if (!savedItem) {
                savedItem = {
                    id: 'local-' + Date.now(),
                    ...payload
                };
                const localSaved = JSON.parse(localStorage.getItem('kfa_custom_chat_templates') || '[]');
                localSaved.push(savedItem);
                localStorage.setItem('kfa_custom_chat_templates', JSON.stringify(localSaved));
            }

            setChatTemplates(prev => [...prev, savedItem]);
            showToast('Chat template saved successfully!', 'success');
            setChatTemplateName('');
            setShowSaveTemplateForm(false);
        } catch (err) {
            console.error('Failed to save chat template:', err);
            showToast('Failed to save template.', 'error');
        } finally {
            setIsSavingChatTemplate(false);
        }
    };

    const handleDeleteChatTemplate = async (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (!dbSetupErrorTemplates && !templateId.startsWith('local-')) {
                const { error } = await supabaseAuth
                    .from('message_templates')
                    .delete()
                    .eq('id', templateId);
                if (error) throw error;
            }
            
            const localSaved = JSON.parse(localStorage.getItem('kfa_custom_chat_templates') || '[]');
            const updated = localSaved.filter((t: any) => t.id !== templateId);
            localStorage.setItem('kfa_custom_chat_templates', JSON.stringify(updated));

            setChatTemplates(prev => prev.filter(t => t.id !== templateId));
            showToast('Chat template deleted successfully.', 'info');
        } catch (err) {
            console.error('Failed to delete chat template:', err);
            showToast('Failed to delete template.', 'error');
        }
    };



    // Recipients Modal Selection
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'class' | 'student' | 'group'>('class');
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [tempSelectedTargets, setTempSelectedTargets] = useState<string[]>([]); // list of target IDs
    const [recipientModalContext, setRecipientModalContext] = useState<'broadcast' | 'featured_update'>('broadcast');

    // KFA Updates: Automatic Sources vs Featured Updates sub-navigation
    const [kfaUpdatesSection, setKfaUpdatesSection] = useState<'featured' | 'automatic'>('featured');
    const [featuredUpdates, setFeaturedUpdates] = useState<FeaturedUpdate[]>([]);
    const [isLoadingFeaturedUpdates, setIsLoadingFeaturedUpdates] = useState(false);
    const [featuredFilter, setFeaturedFilter] = useState<'all' | 'active' | 'scheduled' | 'draft' | 'paused' | 'archived'>('all');
    const [featuredSearch, setFeaturedSearch] = useState('');

    // Featured Update Form / Modal States
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [editingUpdate, setEditingUpdate] = useState<FeaturedUpdate | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formThumbnail, setFormThumbnail] = useState('');
    const [formContentType, setFormContentType] = useState('youtube');
    const [formCtaLabel, setFormCtaLabel] = useState('Watch Video');
    const [formRecipients, setFormRecipients] = useState<Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }>>([
        { id: 'global', name: 'All Students (Global)', type: 'global' }
    ]);
    const [formStatus, setFormStatus] = useState<'draft' | 'active' | 'paused'>('active');
    const [formIsScheduled, setFormIsScheduled] = useState(false);
    const [formStartDate, setFormStartDate] = useState('');
    const [formEndDate, setFormEndDate] = useState('');
    const [formNotifyAgain, setFormNotifyAgain] = useState(false);
    const [isSavingFeaturedUpdate, setIsSavingFeaturedUpdate] = useState(false);

    // Fetch Featured Updates
    const fetchFeaturedUpdates = useCallback(async () => {
        setIsLoadingFeaturedUpdates(true);
        try {
            const { data, error } = await supabaseAuth
                .from('featured_updates')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.warn('[FeaturedUpdates] Error querying:', error.message);
            } else {
                setFeaturedUpdates(data || []);
            }
        } catch (e) {
            console.warn('[FeaturedUpdates] Exception:', e);
        } finally {
            setIsLoadingFeaturedUpdates(false);
        }
    }, []);

    useEffect(() => {
        if (activeChannel === 'kfa_updates') {
            fetchFeaturedUpdates();
        }
    }, [activeChannel, fetchFeaturedUpdates]);

    // Smart URL helper on typing / pasting URL
    const handleFormUrlChange = (newUrl: string) => {
        setFormUrl(newUrl);
        const lower = newUrl.toLowerCase();

        if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
            setFormContentType('youtube');
            setFormCtaLabel('Watch Video');
            let ytId = '';
            if (lower.includes('youtu.be/')) {
                ytId = newUrl.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0] || '';
            } else if (lower.includes('watch?v=')) {
                ytId = newUrl.split('watch?v=')[1]?.split('&')[0] || '';
            } else if (lower.includes('/shorts/')) {
                ytId = newUrl.split('/shorts/')[1]?.split('?')[0] || '';
            }
            if (ytId && (!formThumbnail || formThumbnail.includes('youtube.com') || formThumbnail.includes('ytimg.com'))) {
                setFormThumbnail(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
            }
        } else if (lower.includes('/blog') || lower.includes('blog.')) {
            setFormContentType('blog');
            setFormCtaLabel('Read Article');
        } else if (lower.includes('drive.google.com') || lower.endsWith('.pdf')) {
            setFormContentType('resource');
            setFormCtaLabel('Open Resource');
        } else if (lower.includes('forms.google.com') || lower.includes('event')) {
            setFormContentType('event');
            setFormCtaLabel('Register Now');
        } else if (lower.includes('tutorial') || lower.includes('lesson')) {
            setFormContentType('tutorial');
            setFormCtaLabel('View Lesson');
        }
    };

    const openCreateFeaturedUpdateModal = () => {
        setEditingUpdate(null);
        setFormTitle('');
        setFormDescription('');
        setFormUrl('');
        setFormThumbnail('');
        setFormContentType('youtube');
        setFormCtaLabel('Watch Video');
        setFormRecipients([{ id: 'global', name: 'All Students (Global)', type: 'global' }]);
        setFormStatus('active');
        setFormIsScheduled(false);
        setFormStartDate('');
        setFormEndDate('');
        setFormNotifyAgain(false);
        setIsUpdateModalOpen(true);
    };

    const openEditFeaturedUpdateModal = (item: FeaturedUpdate) => {
        setEditingUpdate(item);
        setFormTitle(item.title || '');
        setFormDescription(item.description || '');
        setFormUrl(item.url || '');
        setFormThumbnail(item.thumbnail_url || '');
        setFormContentType(item.content_type || 'other');
        setFormCtaLabel(item.cta_label || 'Learn More');
        setFormRecipients(item.recipients && item.recipients.length > 0 ? item.recipients : [{ id: 'global', name: 'All Students (Global)', type: 'global' }]);
        setFormStatus(item.status as any || 'active');
        setFormIsScheduled(!!(item.start_date || item.end_date));
        setFormStartDate(item.start_date ? new Date(item.start_date).toISOString().slice(0, 16) : '');
        setFormEndDate(item.end_date ? new Date(item.end_date).toISOString().slice(0, 16) : '');
        setFormNotifyAgain(false);
        setIsUpdateModalOpen(true);
    };

    const handleSaveFeaturedUpdate = async () => {
        if (!formTitle.trim()) {
            showToast('Please enter a title for the featured update.', 'error');
            return;
        }
        if (!formUrl.trim()) {
            showToast('Please enter a destination URL.', 'error');
            return;
        }
        if (!teacherProfile?.id) return;

        setIsSavingFeaturedUpdate(true);
        try {
            const payload: any = {
                creator_id: teacherProfile.id,
                title: formTitle.trim(),
                description: formDescription.trim() || null,
                url: formUrl.trim(),
                thumbnail_url: formThumbnail.trim() || null,
                content_type: formContentType || 'other',
                cta_label: formCtaLabel.trim() || 'Learn More',
                recipients: formRecipients.length > 0 ? formRecipients : [{ id: 'global', name: 'All Students (Global)', type: 'global' }],
                status: formStatus,
                start_date: formIsScheduled && formStartDate ? new Date(formStartDate).toISOString() : null,
                end_date: formIsScheduled && formEndDate ? new Date(formEndDate).toISOString() : null,
                updated_at: new Date().toISOString()
            };

            if (editingUpdate && formNotifyAgain) {
                payload.notify_reset_at = new Date().toISOString();
            }

            if (editingUpdate) {
                const { error } = await supabaseAuth
                    .from('featured_updates')
                    .update(payload)
                    .eq('id', editingUpdate.id);
                if (error) throw error;
                showToast('Featured update updated successfully!', 'success');
            } else {
                const { error } = await supabaseAuth
                    .from('featured_updates')
                    .insert(payload);
                if (error) throw error;
                showToast('Featured update created successfully!', 'success');
            }

            setIsUpdateModalOpen(false);
            fetchFeaturedUpdates();
        } catch (err: any) {
            console.error('Failed to save featured update:', err);
            showToast(`Save failed: ${err.message || 'Unknown error'}`, 'error');
        } finally {
            setIsSavingFeaturedUpdate(false);
        }
    };

    const handleToggleFeaturedUpdateStatus = async (item: FeaturedUpdate) => {
        const nextStatus = item.status === 'active' ? 'paused' : 'active';
        try {
            const { error } = await supabaseAuth
                .from('featured_updates')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('id', item.id);
            if (error) throw error;
            showToast(`Update ${nextStatus === 'active' ? 'resumed' : 'paused'}!`, 'info');
            fetchFeaturedUpdates();
        } catch (err: any) {
            showToast(`Failed to update status: ${err.message}`, 'error');
        }
    };

    const handleArchiveFeaturedUpdate = async (item: FeaturedUpdate) => {
        try {
            const { error } = await supabaseAuth
                .from('featured_updates')
                .update({ status: 'archived', updated_at: new Date().toISOString() })
                .eq('id', item.id);
            if (error) throw error;
            showToast('Update moved to archive.', 'info');
            fetchFeaturedUpdates();
        } catch (err: any) {
            showToast(`Failed to archive: ${err.message}`, 'error');
        }
    };

    const handleDeleteFeaturedUpdate = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this featured update?')) return;
        try {
            const { error } = await supabaseAuth
                .from('featured_updates')
                .delete()
                .eq('id', id);
            if (error) throw error;
            showToast('Featured update deleted.', 'info');
            fetchFeaturedUpdates();
        } catch (err: any) {
            showToast(`Failed to delete: ${err.message}`, 'error');
        }
    };

    // Filtered Featured Updates List
    const filteredFeaturedUpdates = useMemo(() => {
        const now = new Date();
        return featuredUpdates.filter(u => {
            if (featuredSearch.trim()) {
                const q = featuredSearch.toLowerCase().trim();
                const matches = u.title.toLowerCase().includes(q) || 
                                (u.description && u.description.toLowerCase().includes(q)) || 
                                u.url.toLowerCase().includes(q);
                if (!matches) return false;
            }
            if (featuredFilter === 'active') {
                const isScheduledFuture = u.start_date && new Date(u.start_date) > now;
                const isExpired = u.end_date && new Date(u.end_date) < now;
                return u.status === 'active' && !isScheduledFuture && !isExpired;
            }
            if (featuredFilter === 'scheduled') {
                return u.status === 'active' && u.start_date && new Date(u.start_date) > now;
            }
            if (featuredFilter === 'draft') {
                return u.status === 'draft';
            }
            if (featuredFilter === 'paused') {
                return u.status === 'paused';
            }
            if (featuredFilter === 'archived') {
                return u.status === 'archived';
            }
            return u.status !== 'archived';
        });
    }, [featuredUpdates, featuredFilter, featuredSearch]);

    // Logs Search
    const [searchQuery, setSearchQuery] = useState('');

    // Direct Messaging States for Student Chatbox
    const [directMessages, setDirectMessages] = useState<any[]>([]);
    const [activeChatStudentId, setActiveChatStudentId] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [sendingDirectMsg, setSendingDirectMsg] = useState(false);
    const [messageType, setMessageType] = useState<'broadcast' | 'normal'>('broadcast');
    const [chatTemplates, setChatTemplates] = useState<any[]>([]);
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    const [isSavingChatTemplate, setIsSavingChatTemplate] = useState(false);
    const [chatTemplateName, setChatTemplateName] = useState('');
    const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
    const [studentSearchQuery, setStudentSearchQuery] = useState('');

    const activeChatStudentIdRef = useRef(activeChatStudentId);
    useEffect(() => {
        activeChatStudentIdRef.current = activeChatStudentId;
    }, [activeChatStudentId]);

    const markMessagesAsRead = async (studentId: string) => {
        if (!teacherProfile?.id || !studentId) return;
        try {
            const unreadIds = directMessages
                .filter(m => (m.sender_id === studentId || m.sender_id?.trim().toLowerCase() === studentId?.trim().toLowerCase()) && m.status !== 'read')
                .map(m => m.id);

            setDirectMessages(prev => prev.map(m => 
                (m.sender_id === studentId || m.sender_id?.trim().toLowerCase() === studentId?.trim().toLowerCase())
                    ? { ...m, status: 'read' }
                    : m
            ));

            if (typeof window !== 'undefined' && unreadIds.length > 0) {
                try {
                    const stored = localStorage.getItem('kfa_read_message_ids');
                    const existing: string[] = stored ? JSON.parse(stored) : [];
                    const updated = Array.from(new Set([...existing, ...unreadIds]));
                    localStorage.setItem('kfa_read_message_ids', JSON.stringify(updated));
                } catch (e) {
                    console.error(e);
                }
            }

            if (unreadIds.length > 0) {
                const { error: idErr } = await supabaseAuth
                    .from('messages')
                    .update({ status: 'read' })
                    .in('id', unreadIds);
                if (idErr) console.warn('Failed to update messages by ID:', idErr);
            }

            await supabaseAuth
                .from('messages')
                .update({ status: 'read' })
                .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`)
                .neq('status', 'read');

            await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', teacherProfile.id)
                .eq('type', 'messages')
                .eq('is_read', false);

        } catch (err) {
            console.error('Failed to mark messages as read:', err);
        }
    };

    const markAllMessagesAsRead = async () => {
        if (!teacherProfile?.id) return;
        try {
            const allUnreadIds = directMessages
                .filter(m => m.status !== 'read')
                .map(m => m.id);

            setDirectMessages(prev => prev.map(m => ({ ...m, status: 'read' })));

            if (typeof window !== 'undefined' && allUnreadIds.length > 0) {
                try {
                    const stored = localStorage.getItem('kfa_read_message_ids');
                    const existing: string[] = stored ? JSON.parse(stored) : [];
                    const updated = Array.from(new Set([...existing, ...allUnreadIds]));
                    localStorage.setItem('kfa_read_message_ids', JSON.stringify(updated));
                } catch (e) {
                    console.error(e);
                }
            }

            if (allUnreadIds.length > 0) {
                await supabaseAuth
                    .from('messages')
                    .update({ status: 'read' })
                    .in('id', allUnreadIds);
            }

            await supabaseAuth
                .from('messages')
                .update({ status: 'read' })
                .neq('status', 'read');

            await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', teacherProfile.id)
                .eq('type', 'messages')
                .eq('is_read', false);

        } catch (err) {
            console.error('Failed to mark all messages as read:', err);
        }
    };

    const teacherChatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (activeChannel === 'chatbox' && activeChatStudentId) {
            teacherChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [directMessages, activeChatStudentId, activeChannel]);

    useEffect(() => {
        if (activeChannel === 'chatbox') {
            if (activeChatStudentId) {
                markMessagesAsRead(activeChatStudentId);
            } else if (chatContacts.length > 0) {
                const firstUnread = chatContacts.find(c => (c.unreadCount || 0) > 0);
                const targetStudent = firstUnread || chatContacts[0];
                if (targetStudent?.id) {
                    setActiveChatStudentId(targetStudent.id);
                    markMessagesAsRead(targetStudent.id);
                }
            }
        }
    }, [activeChatStudentId, activeChannel, directMessages.length]);
    // SWR Cache Saver for Messages
    useEffect(() => {
        if (students.length === 0 && directMessages.length === 0) return;
        const timer = setTimeout(() => {
            try {
                const cacheData = { students, classrooms, broadcasts, directMessages, teacherProfile };
                localStorage.setItem('kfa_messages_cache', JSON.stringify(cacheData));
            } catch (e) { console.error('Messages cache save error:', e); }
        }, 300);
        return () => clearTimeout(timer);
    }, [students, classrooms, broadcasts, directMessages, teacherProfile]);

    useEffect(() => {
        let hasCachedData = false;
        try {
            const cached = localStorage.getItem('kfa_messages_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.students) setStudents(data.students);
                if (data.classrooms) setClassrooms(data.classrooms);
                if (data.broadcasts) setBroadcasts(data.broadcasts);
                if (data.directMessages) setDirectMessages(data.directMessages);
                if (data.teacherProfile) setTeacherProfile(data.teacherProfile);
                setLoading(false);
                setDbChecking(false);
                hasCachedData = true;
            }
        } catch (e) { console.error('Messages cache load error:', e); }

        const checkAuthAndLoad = async () => {
            if (!hasCachedData) setLoading(true);
            try {
                // 1. Authenticate Teacher
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                // Clear unread messages notifications for this user
                await supabaseAuth
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', session.user.id)
                    .eq('type', 'messages')
                    .eq('is_read', false);

                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, phone, role, profile_pic_url')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });

                if (!profile) return;

                const isAdmin = profile.role === 'admin';
                if (!isAdmin) {
                    setActiveChannel('chatbox');
                }

                // 2. Pre-fetch Classrooms and Students for recipients modal
                let roomsQuery = supabaseAuth
                    .from('classrooms')
                    .select('id, name');
                if (!isAdmin) {
                    roomsQuery = roomsQuery.eq('teacher_id', profile.id);
                }
                const { data: rooms } = await roomsQuery;
                setClassrooms(rooms || []);

                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                const { data: activeSessions } = await supabaseAuth
                    .from('user_sessions')
                    .select('user_id')
                    .is('logout_at', null)
                    .gt('last_activity_at', fiveMinutesAgo);
                const onlineUserIds = new Set<string>(activeSessions?.map(sess => sess.user_id) || []);

                let uniqueStudents: any[] = [];
                if (isAdmin) {
                    const { data: studentList } = await supabaseAuth
                        .from('users')
                        .select('id, name, profile_pic_url')
                        .or('role.eq.student,role.eq.pending,role.eq.mentor');
                    uniqueStudents = (studentList || []).map((s: any) => ({
                        id: s.id,
                        name: s.name || 'Unknown',
                        profile_pic_url: s.profile_pic_url || null,
                        is_online: onlineUserIds.has(s.id)
                    }));
                } else {
                    const { data: studentList } = await supabaseAuth
                        .from('users')
                        .select('id, name, profile_pic_url')
                        .or('role.eq.student,role.eq.pending,role.eq.mentor')
                        .eq('teacher_id', profile.id);
                    uniqueStudents = (studentList || []).map((s: any) => ({
                        id: s.id,
                        name: s.name || 'Unknown',
                        profile_pic_url: s.profile_pic_url || null,
                        is_online: onlineUserIds.has(s.id)
                    }));
                }
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

                // 3.5. Fetch Broadcast Reads Table
                try {
                    const { data: readsData, error: readsError } = await supabaseAuth
                        .from('broadcast_reads')
                        .select('broadcast_id, read_at, user_id, users(id, name)');
                    if (readsError) {
                        console.warn('[Messages] Broadcast reads table check failed:', readsError.message);
                        if (readsError.code === '42P01' || readsError.code === 'PGRST205' || readsError.message?.includes('schema cache') || readsError.message?.includes('does not exist')) {
                            setDbSetupErrorReads(true);
                        }
                        setBroadcastReads([]);
                    } else {
                        setBroadcastReads(readsData || []);
                        setDbSetupErrorReads(false);
                    }
                } catch (pe) {
                    console.warn('[Messages] Exception querying broadcast reads:', pe);
                    setBroadcastReads([]);
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
                    const localTemp = localStorage.getItem('kfa_channel_templates');
                    if (localTemp) {
                        try {
                            setDefaultTemplates(prev => ({
                                ...prev,
                                ...JSON.parse(localTemp)
                            }));
                        } catch (e) {
                            console.error(e);
                        }
                    }

                    let tplQuery = supabaseAuth
                        .from('message_templates')
                        .select('*');
                    if (!isAdmin) {
                        tplQuery = tplQuery.eq('teacher_id', profile.id);
                    }
                    const { data: tplData, error: tplError } = await tplQuery;

                    if (tplError) {
                        console.warn('[Messages] Message templates table query failed:', tplError.message);
                        if (tplError.code === '42P01' || tplError.code === 'PGRST205' || tplError.message?.includes('schema cache') || tplError.message?.includes('does not exist')) {
                            setDbSetupErrorTemplates(true);
                            // Fallback custom templates
                            const localCustom = localStorage.getItem('kfa_custom_chat_templates');
                            if (localCustom) {
                                try {
                                    setChatTemplates(JSON.parse(localCustom));
                                } catch (e) {
                                    console.error(e);
                                }
                            }
                        }
                    } else {
                        if (tplData && tplData.length > 0) {
                            // Filter custom chat templates
                            const customTpls = tplData.filter((t: any) => 
                                !['announcements', 'classroom', 'custom_groups', 'new_joiners', 'fee_management', 'chatbox'].includes(t.name)
                            );
                            setChatTemplates(customTpls);

                            setDefaultTemplates(prev => {
                                const loaded = { ...prev };
                                tplData.forEach((t: any) => {
                                    if (t.name) {
                                        loaded[t.name] = {
                                            subject: t.subject || '',
                                            content: t.content || ''
                                        };
                                    }
                                });
                                return loaded;
                            });
                        }
                        setDbSetupErrorTemplates(false);
                    }
                } catch (te) {
                    console.warn('[Messages] Exception querying templates:', te);
                }

                // 6. Fetch Direct Messages
                try {
                    let msgQuery = supabaseAuth
                        .from('messages')
                        .select('*')
                        .order('created_at', { ascending: true });

                    if (!isAdmin) {
                        msgQuery = msgQuery.or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
                    }

                    const { data: dbDirectMessages } = await msgQuery;
                    const allowedStudentIds = new Set(uniqueStudents.map(s => s.id));

                    let readMsgIds = new Set<string>();
                    if (typeof window !== 'undefined') {
                        try {
                            const stored = localStorage.getItem('kfa_read_message_ids');
                            if (stored) {
                                readMsgIds = new Set(JSON.parse(stored));
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }

                    const rawMessages = (dbDirectMessages || []).filter(m => 
                        isAdmin || 
                        allowedStudentIds.has(m.sender_id) || 
                        allowedStudentIds.has(m.receiver_id)
                    ).map(m => (readMsgIds.has(m.id) ? { ...m, status: 'read' } : m));
                    setDirectMessages(rawMessages);

                    // Mark incoming messages as delivered when loaded
                    const undeliveredMessages = rawMessages.filter(m => m.receiver_id === profile.id && (!m.status || m.status === 'sent'));
                    if (undeliveredMessages.length > 0) {
                        supabaseAuth
                            .from('messages')
                            .update({ status: 'delivered' })
                            .in('id', undeliveredMessages.map(m => m.id))
                            .then(() => {
                                setDirectMessages(prev => prev.map(m => 
                                    (m.receiver_id === profile.id && (!m.status || m.status === 'sent')) ? { ...m, status: 'delivered' } : m
                                ));
                            });
                    }
                } catch (dme) {
                    console.warn('Failed to load direct messages:', dme);
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

    // Real-time listener for direct messages
    useEffect(() => {
        if (!teacherProfile?.id) return;
        const channel = supabaseAuth.channel('public:teacher-messages-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new as any;
                    if (newMsg) {
                        setDirectMessages(prev => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });

                        // Handle auto read/delivery receipt status update
                        if (newMsg.receiver_id === teacherProfile.id) {
                            const currentChatStudentId = activeChatStudentIdRef.current;
                            const isChattingWithSender = currentChatStudentId === newMsg.sender_id;
                            const targetStatus = isChattingWithSender ? 'read' : 'delivered';
                            
                            supabaseAuth
                                .from('messages')
                                .update({ status: targetStatus })
                                .eq('id', newMsg.id)
                                .then(({ error }) => {
                                    if (!error) {
                                        setDirectMessages(prev => prev.map(m => 
                                            m.id === newMsg.id ? { ...m, status: targetStatus } : m
                                        ));
                                    }
                                });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages' },
                (payload) => {
                    const updatedMsg = payload.new as any;
                    if (updatedMsg) {
                        setDirectMessages(prev => prev.map(m => 
                            m.id === updatedMsg.id ? { ...m, status: updatedMsg.status } : m
                        ));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'broadcast_reads' },
                async (payload) => {
                    const newRead = payload.new as any;
                    if (newRead) {
                        try {
                            const { data: userData } = await supabaseAuth
                                .from('users')
                                .select('id, name')
                                .eq('id', newRead.user_id)
                                .single();
                            if (userData) {
                                setBroadcastReads(prev => {
                                    if (prev.some(r => r.broadcast_id === newRead.broadcast_id && r.user_id === newRead.user_id)) return prev;
                                    return [...prev, {
                                        broadcast_id: newRead.broadcast_id,
                                        read_at: newRead.read_at,
                                        user_id: newRead.user_id,
                                        users: userData
                                    }];
                                });
                            }
                        } catch (e) {
                            console.error('Failed to fetch user for realtime read receipt:', e);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'broadcasts' },
                (payload) => {
                    if (payload.eventType === 'DELETE' && payload.old) {
                        const oldId = (payload.old as any).id;
                        setBroadcasts(prev => prev.filter(b => b.id !== oldId));
                    } else if (payload.eventType === 'INSERT' && payload.new) {
                        const newB = payload.new as any;
                        setBroadcasts(prev => {
                            if (prev.some(b => b.id === newB.id)) return prev;
                            return [newB, ...prev];
                        });
                    }
                }
            )
            .subscribe();
        return () => {
            supabaseAuth.removeChannel(channel);
        };
    }, [teacherProfile?.id]);

    const reEvaluateOnlineStatus = async () => {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: activeSessions } = await supabaseAuth
                .from('user_sessions')
                .select('user_id')
                .is('logout_at', null)
                .gt('last_activity_at', fiveMinutesAgo);
            
            const onlineUserIds = new Set<string>(activeSessions?.map(sess => sess.user_id) || []);
            
            setStudents(prev => prev.map(s => ({
                ...s,
                is_online: onlineUserIds.has(s.id)
            })));
        } catch (e) {
            console.error('Error re-evaluating online status in messages:', e);
        }
    };

    useEffect(() => {
        if (!teacherProfile?.id) return;
        
        reEvaluateOnlineStatus();

        const sessionsChannel = supabaseAuth
            .channel('realtime-sessions-messages-directory')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_sessions' },
                () => {
                    reEvaluateOnlineStatus();
                }
            )
            .subscribe();

        const timer = setInterval(reEvaluateOnlineStatus, 30000);

        return () => {
            supabaseAuth.removeChannel(sessionsChannel);
            clearInterval(timer);
        };
    }, [teacherProfile?.id]);

    // Logout Helper
    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/login?type=teacher');
    };

    const resolveTargetStudentIds = async (recipients: any[]) => {
        const studentIds = new Set<string>();
        const classIds: string[] = [];
        
        for (const r of recipients) {
            if (r.type === 'student') {
                studentIds.add(r.id);
            } else if (r.type === 'class') {
                classIds.push(r.id);
            } else if (r.type === 'global') {
                students.forEach(s => studentIds.add(s.id));
            }
        }
        
        if (classIds.length > 0) {
            const { data: assoc } = await supabaseAuth
                .from('classroom_students')
                .select('student_id')
                .in('classroom_id', classIds);
            (assoc || []).forEach((row: any) => studentIds.add(row.student_id));
        }
        
        return Array.from(studentIds);
    };

    // Pre-index direct messages by partner ID for O(1) instant contact list mapping
    const directMessagesMap = useMemo(() => {
        const map: Record<string, any[]> = {};
        directMessages.forEach(m => {
            const partnerId = m.sender_id === teacherProfile?.id ? m.receiver_id : m.sender_id;
            if (partnerId) {
                if (!map[partnerId]) map[partnerId] = [];
                map[partnerId].push(m);
            }
        });
        return map;
    }, [directMessages, teacherProfile?.id]);

    const chatContacts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const localQuery = studentSearchQuery.trim().toLowerCase();
        const list = students.map(student => {
            const threadMsgs = directMessagesMap[student.id] || [];
            const unreadCount = threadMsgs.filter(m => 
                m.sender_id === student.id && 
                m.status !== 'read'
            ).length;
            const lastMsg = threadMsgs.length > 0 ? threadMsgs[threadMsgs.length - 1] : null;
            return {
                ...student,
                lastMessage: lastMsg ? lastMsg.message_text : 'No messages yet',
                lastMessageAt: lastMsg ? new Date(lastMsg.created_at) : null,
                threadMessages: threadMsgs,
                unreadCount
            };
        });

        let filtered = list;
        if (query) {
            filtered = filtered.filter(contact => 
                contact.name.toLowerCase().includes(query) ||
                contact.lastMessage.toLowerCase().includes(query) ||
                contact.threadMessages.some((m: any) => m.message_text.toLowerCase().includes(query))
            );
        }
        if (localQuery) {
            filtered = filtered.filter(contact => 
                contact.name.toLowerCase().includes(localQuery)
            );
        }

        return filtered.sort((a, b) => {
            // First priority: contacts with unread messages sort to top
            if (a.unreadCount !== b.unreadCount) {
                return b.unreadCount - a.unreadCount;
            }
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
        });
    }, [students, directMessages, teacherProfile?.id, searchQuery, studentSearchQuery]);

    const totalUnreadChatboxMessages = useMemo(() => {
        return chatContacts.reduce((sum, contact) => sum + (contact.unreadCount || 0), 0);
    }, [chatContacts]);

    // ── Save Broadcast Handler ─────────────────────────────────────────────────
    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile || isSending) return;

        if (selectedRecipients.length === 0) {
            showToast('Please select at least one recipient first!', 'error');
            return;
        }
        if (messageType === 'broadcast' && !subject.trim()) {
            showToast('Please specify a broadcast subject!', 'error');
            return;
        }
        if (!content.trim()) {
            showToast('Please compose your message!', 'error');
            return;
        }

        setIsSending(true);

        if (messageType === 'normal') {
            try {
                const targetStudentIds = await resolveTargetStudentIds(selectedRecipients);
                if (targetStudentIds.length === 0) {
                    showToast('Could not find any enrolled students in the selected recipients.', 'error');
                    setIsSending(false);
                    return;
                }

                const rows = targetStudentIds.map(sid => ({
                    sender_id: teacherProfile.id,
                    receiver_id: sid,
                    message_text: content.trim(),
                    status: 'sent',
                    created_at: new Date().toISOString()
                }));

                const { data: insertedData, error: mError } = await supabaseAuth
                    .from('messages')
                    .insert(rows)
                    .select('*');

                if (mError) throw mError;

                if (insertedData) {
                    setDirectMessages(prev => {
                        const filtered = insertedData.filter(newM => !prev.some(m => m.id === newM.id));
                        return [...prev, ...filtered];
                    });

                    // Insert notifications for each target student
                    const notificationRows = targetStudentIds.map(sid => ({
                        user_id: sid,
                        title: `New Message: ${teacherProfile.name}`,
                        message: htmlToPlainText(content),
                        type: 'messages',
                        is_read: false
                    }));
                    await supabaseAuth.from('notifications').insert(notificationRows);
                }

                showToast(`Message successfully sent to ${targetStudentIds.length} student(s) chatbox!`, 'success');

                // Clear Composer Form
                setSubject('');
                setContent('');
                setSelectedRecipients([]);
                setAttachedAudioNote(null);
            } catch (err: any) {
                console.error('Failed to send normal message:', err);
                showToast('Failed to send normal messages. Try again.', 'error');
            } finally {
                setIsSending(false);
            }
            return;
        }

        const hasGlobal = selectedRecipients.some(r => r.type === 'global');
        const classRecipients = selectedRecipients.filter(r => r.type === 'class');
        const hasMultipleClasses = classRecipients.length > 1;
        const isKfaUpdate = activeChannel === 'kfa_updates' || activeChannel === 'blog' || activeChannel === 'video';
        const effectiveUpdateType = activeChannel === 'kfa_updates' ? kfaUpdateSubTab : (activeChannel === 'video' ? 'video' : 'blog');
        const resolvedChannel = isKfaUpdate
            ? (effectiveUpdateType === 'video' ? 'video' : 'blog')
            : (hasGlobal || hasMultipleClasses) ? 'announcements' : activeChannel;

        const defaultTargetUrl = isKfaUpdate 
            ? (targetUrl.trim() || (effectiveUpdateType === 'blog' ? autoFetchedBlogUrl : autoFetchedVideoUrl))
            : targetUrl.trim();
        const defaultImageUrl = isKfaUpdate
            ? (targetImage.trim() || (effectiveUpdateType === 'blog' ? autoFetchedBlogImage : autoFetchedVideoImage))
            : targetImage.trim();

        const payloadRecipients = [
            ...selectedRecipients.map(r => ({
                ...r,
                ...(recipientCustomUrls[r.id]?.trim() ? { custom_url: recipientCustomUrls[r.id].trim() } : {})
            })),
            ...(defaultTargetUrl || defaultImageUrl || isKfaUpdate
                ? [{ 
                    _meta: true, 
                    type: isKfaUpdate ? effectiveUpdateType : activeChannel, 
                    target_url: defaultTargetUrl, 
                    image_url: defaultImageUrl 
                }]
                : [])
        ];

        const newBroadcast: any = {
            teacher_id: teacherProfile.id,
            channel: resolvedChannel,
            recipients: payloadRecipients,
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
                setRecipientCustomUrls({});
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
                }

                // Clear Composer Form
                setSubject('');
                setContent('');
                setSelectedRecipients([]);
                setRecipientCustomUrls({});
                setAttachedAudioNote(null);
            }
        } catch (err: any) {
            console.error('Exception during broadcast save:', err);
            showToast('An unexpected issue occurred while sending.', 'error');
        } finally {
            setIsSending(false);
        }
    };

    // ── Delete Broadcast Handler ──────────────────────────────────────────────
    const handleDeleteBroadcast = async (broadcastId: string, subject: string, content: string) => {
        const confirmed = window.confirm('Are you sure you want to delete this announcement? It will be removed from all Admin, Teacher, and Student dashboards.');
        if (!confirmed) return;

        try {
            // 1. Delete from broadcasts table
            const { error: deleteBError } = await supabaseAuth
                .from('broadcasts')
                .delete()
                .eq('id', broadcastId);

            if (deleteBError) {
                console.error('Error deleting broadcast row:', deleteBError);
            }

            // 2. Delete associated broadcast_reads
            await supabaseAuth
                .from('broadcast_reads')
                .delete()
                .eq('broadcast_id', broadcastId);

            // 3. Delete matching notifications for target students
            await supabaseAuth
                .from('notifications')
                .delete()
                .eq('title', subject.trim())
                .eq('message', content.trim());

            // 4. Update local state & localStorage fallback
            setBroadcasts(prev => {
                const updated = prev.filter(b => b.id !== broadcastId);
                localStorage.setItem('kfa_local_broadcasts', JSON.stringify(updated));
                return updated;
            });

            showToast('Announcement deleted successfully across all dashboards.', 'success');
        } catch (err: any) {
            console.error('Failed to delete broadcast:', err);
            showToast(`Failed to delete announcement: ${err.message || 'Error occurred'}`, 'error');
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

    const handleDeleteCustomGroup = async (groupId: string, groupName: string) => {
        if (!window.confirm(`Are you sure you want to delete the custom group "${groupName}"?`)) {
            return;
        }

        try {
            if (!dbSetupErrorGroups && !groupId.startsWith('local-group-')) {
                const { error } = await supabaseAuth
                    .from('custom_recipient_groups')
                    .delete()
                    .eq('id', groupId);

                if (error) {
                    console.error('Error deleting custom group from DB:', error);
                    showToast('Failed to delete group from database.', 'error');
                    return;
                }
            }

            const updated = customGroups.filter(g => g.id !== groupId);
            setCustomGroups(updated);
            localStorage.setItem('kfa_local_custom_groups', JSON.stringify(updated));
            showToast(`Group "${groupName}" deleted successfully!`, 'success');
        } catch (err) {
            console.error('Error deleting custom group:', err);
            showToast('Failed to delete group.', 'error');
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

    // ── Recipients Selection Modal Controls ────────────────────────────────────
    const openRecipientsModal = () => {
        // Hydrate initial checked targets
        setTempSelectedTargets(selectedRecipients.map(r => r.id));
        setModalSearchQuery('');
        
        if (activeChannel === 'classroom' || activeChannel === 'announcements') {
            setModalTab('class');
        }
        
        setIsModalOpen(true);
    };

    const toggleTargetSelection = (id: string) => {
        setTempSelectedTargets(prev => {
            if (prev.includes(id)) {
                return prev.filter(t => t !== id);
            }

            // 1. Classroom Broadcast: only allow a single classroom selection
            if (activeChannel === 'classroom') {
                const isClass = classrooms.some(c => c.id === id);
                if (isClass) {
                    return [id];
                }
            }

            // 2. Announcements: 'global' (All Students) overrides any selected classes
            if (activeChannel === 'announcements') {
                if (id === 'global') {
                    return ['global'];
                } else {
                    return [...prev.filter(t => t !== 'global'), id];
                }
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
                    } else {
                        const grpMatch = customGroups.find(g => g.id === id);
                        if (grpMatch) {
                            newSelection.push({ id: grpMatch.id, name: grpMatch.name, type: 'custom' });
                        }
                    }
                }
            }
        });

        if (recipientModalContext === 'featured_update') {
            setFormRecipients(newSelection.length > 0 ? newSelection : [{ id: 'global', name: 'All Students (Global)', type: 'global' }]);
        } else {
            setSelectedRecipients(newSelection);
        }
        setIsModalOpen(false);
    };

    const removeRecipientChip = (id: string) => {
        setSelectedRecipients(prev => prev.filter(r => r.id !== id));
    };

    // ── Search & Filter Broadcast Logs ─────────────────────────────────────────
    const filteredBroadcasts = useMemo(() => {
        let list = broadcasts.filter(b => {
            if (activeChannel === 'kfa_updates') {
                return b.channel === 'kfa_updates' || b.channel === 'blog' || b.channel === 'video';
            }
            return b.channel === activeChannel;
        });

        const query = searchQuery.toLowerCase().trim();
        if (!query) return list;

        return list.filter(b => {
            const matchesSubject = b.subject.toLowerCase().includes(query);
            const matchesContent = b.content.toLowerCase().includes(query);
            const matchesRecipient = b.recipients.some(r => r.name.toLowerCase().includes(query));
            return matchesSubject || matchesContent || matchesRecipient;
        });
    }, [broadcasts, activeChannel, searchQuery]);

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
        } else if (modalTab === 'group') {
            return customGroups.filter(g => g.name.toLowerCase().includes(query));
        } else {
            return students.filter(s => s.name.toLowerCase().includes(query));
        }
    }, [classrooms, students, customGroups, modalTab, modalSearchQuery]);

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
                        avatarUrl={teacherProfile?.profile_pic_url}
                        userName={teacherProfile?.name}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        placeholder="Search messages, students, or broadcasts..."
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    {/* Sub-body workspace flow */}
                    <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-8 bg-[#f8f8f6] dark:bg-[#1a1608]/50">
                    
                    {/* Database Setup Banner Warning */}
                    {/* Database Setup Banner Warning */}
                    {(dbSetupError || dbSetupErrorGroups || dbSetupErrorTemplates || dbSetupErrorReads) && (
                        <div className="bg-rose-50 border border-rose-200/80 p-5 rounded-2xl flex flex-col gap-4 shadow-sm select-text">
                            <div className="flex gap-3">
                                <Info className="text-rose-500 w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-extrabold text-rose-900">
                                        {dbSetupError && dbSetupErrorGroups && dbSetupErrorTemplates && dbSetupErrorReads ? 'Supabase Message, Template & Reads Tables Not Found' : 
                                         (dbSetupError ? 'Broadcasts Table Not Found. ' : '') + 
                                         (dbSetupErrorGroups ? 'Custom Recipient Groups Table Not Found. ' : '') + 
                                         (dbSetupErrorTemplates ? 'Message Templates Table Not Found. ' : '') +
                                         (dbSetupErrorReads ? 'Broadcast Reads Table Not Found.' : '')}
                                    </h4>
                                    <p className="text-xs text-rose-700 font-medium leading-relaxed mt-1">
                                        To enable permanent backend storage for your messaging and tracking features, open your Supabase SQL Editor and run the script below.
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
{dbSetupErrorReads && `CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_broadcast_user_read UNIQUE (broadcast_id, user_id)
);
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read broadcast_reads" ON public.broadcast_reads;
CREATE POLICY "Allow authenticated users to read broadcast_reads" ON public.broadcast_reads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to insert their own broadcast_reads" ON public.broadcast_reads;
CREATE POLICY "Allow authenticated users to insert their own broadcast_reads" ON public.broadcast_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
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
                                            sql += `CREATE TABLE IF NOT EXISTS public.message_templates (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  name TEXT NOT NULL,\n  subject TEXT NOT NULL,\n  content TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow all message_templates" ON public.message_templates;\nCREATE POLICY "Allow all message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);\n\n`;
                                        }
                                        if (dbSetupErrorReads) {
                                            sql += `CREATE TABLE IF NOT EXISTS public.broadcast_reads (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,\n  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,\n  read_at TIMESTAMPTZ DEFAULT now() NOT NULL,\n  CONSTRAINT unique_broadcast_user_read UNIQUE (broadcast_id, user_id)\n);\nALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Allow authenticated users to read broadcast_reads" ON public.broadcast_reads;\nCREATE POLICY "Allow authenticated users to read broadcast_reads" ON public.broadcast_reads FOR SELECT TO authenticated USING (true);\nDROP POLICY IF EXISTS "Allow authenticated users to insert their own broadcast_reads" ON public.broadcast_reads;\nCREATE POLICY "Allow authenticated users to insert their own broadcast_reads" ON public.broadcast_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);\n\n`;
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
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800 space-y-6">
                                {/* Group 1: Messages */}
                                <div>
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Messages</span>
                                    <div className="space-y-2 mt-3">
                                        {[
                                            { id: 'announcements', label: 'Announcements', desc: 'Global Broadcast', icon: Megaphone, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
                                            { id: 'classroom', label: 'Classroom Broadcast', desc: 'Section-wise targets', icon: Presentation, color: 'text-blue-500 bg-blue-50' },
                                            { id: 'custom_groups', label: 'Custom Groups', desc: 'Performers, Beginners...', icon: Users, color: 'text-indigo-500 bg-indigo-50' },
                                            { id: 'new_joiners', label: 'New Joiners', desc: 'Automated workflows', icon: Sparkles, color: 'text-emerald-500 bg-emerald-50' },
                                            { id: 'fee_management', label: 'Fee Management', desc: 'Reminders & Receipts', icon: CreditCard, color: 'text-rose-500 bg-rose-50' },
                                            { id: 'chatbox', label: 'Student Chatbox', desc: 'Normal/Direct Messages', icon: MessageSquare, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20' },
                                        ].filter(channel => teacherProfile?.role === 'admin' || channel.id === 'chatbox').map((channel) => {
                                            const isSelected = activeChannel === channel.id;
                                            const hasUnread = channel.id === 'chatbox' && totalUnreadChatboxMessages > 0;
                                            return (
                                                <button 
                                                    key={channel.id}
                                                    onClick={() => {
                                                        setActiveChannel(channel.id);
                                                        setSelectedRecipients([]);
                                                    }}
                                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border text-left cursor-pointer ${
                                                        isSelected 
                                                            ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-stone-150' 
                                                            : hasUnread 
                                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-xs ring-1 ring-emerald-400/40'
                                                                : 'bg-white border-transparent hover:bg-slate-50/50 dark:bg-slate-950/20'
                                                    }`}
                                                >
                                                    <div className={`p-2.5 rounded-lg shrink-0 relative ${channel.color}`}>
                                                        <channel.icon className="w-5 h-5" />
                                                        {hasUnread && (
                                                            <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-ping" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h5 className={`text-sm ${hasUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-250'}`}>
                                                                {channel.label}
                                                            </h5>
                                                        </div>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{channel.desc}</p>
                                                    </div>
                                                    {hasUnread && (
                                                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs shrink-0 animate-pulse">
                                                            {totalUnreadChatboxMessages} New
                                                        </span>
                                                    )}
                                                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-1 shrink-0" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Group 2: KFA Updates (ADMIN ONLY) */}
                                {teacherProfile?.role === 'admin' && (
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5" />
                                                <span>KFA Updates</span>
                                            </span>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                                                Admin Only
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {[
                                                { 
                                                    id: 'kfa_updates', 
                                                    label: 'KFA Updates', 
                                                    desc: 'Automatic Sources & Featured Updates', 
                                                    icon: Globe, 
                                                    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' 
                                                },
                                            ].map((channel) => {
                                                const isSelected = activeChannel === channel.id;
                                                return (
                                                    <button 
                                                        key={channel.id}
                                                        onClick={() => {
                                                            setActiveChannel(channel.id);
                                                            setSelectedRecipients([]);
                                                        }}
                                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border text-left cursor-pointer ${
                                                            isSelected 
                                                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm ring-1 ring-amber-400/40' 
                                                                : 'bg-white border-transparent hover:bg-slate-50/50 dark:bg-slate-950/20'
                                                        }`}
                                                    >
                                                        <div className={`p-2.5 rounded-lg shrink-0 relative ${channel.color}`}>
                                                            <channel.icon className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-250">
                                                                    {channel.label}
                                                                </h5>
                                                            </div>
                                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{channel.desc}</p>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-1 shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
                                                <div 
                                                    key={grp.id}
                                                    className="w-full flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-[#0e5f59]/5 border border-slate-200 dark:border-slate-700 hover:border-[#0e5f59]/30 rounded-xl text-left transition-all group/item"
                                                >
                                                    <div 
                                                        onClick={() => {
                                                            setSelectedRecipients(grp.recipients);
                                                            showToast(`Loaded group "${grp.name}"!`, 'info');
                                                        }}
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                    >
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover/item:text-[#0e5f59] transition-colors block">
                                                            {grp.name}
                                                        </span>
                                                        {grp.description && (
                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5 block">
                                                                {grp.description}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {grp.recipients.map((rec: any, idx: number) => (
                                                                <span key={idx} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-bold text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
                                                                    {rec.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteCustomGroup(grp.id, grp.name);
                                                        }}
                                                        title="Delete Group"
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0 ml-2 cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
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
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                {activeChannel === 'chatbox' ? 'Student Chatbox' : 'Messaging Workspace'}
                            </span>
                            
                            {activeChannel === 'chatbox' ? (
                                /* CHATBOX WORKSPACE */
                                <div className="flex bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[600px] text-left">
                                    {/* Sub-Left Panel: Chat Contacts */}
                                    <div className={`w-full md:w-80 border-r border-slate-100 dark:border-slate-800 flex flex-col h-full shrink-0 ${activeChatStudentId ? 'hidden md:flex' : 'flex'}`}>
                                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Students</h4>
                                                {totalUnreadChatboxMessages > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={markAllMessagesAsRead}
                                                        className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                                                    >
                                                        Mark all read
                                                    </button>
                                                )}
                                            </div>
                                            {/* Local Student Search */}
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={studentSearchQuery}
                                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                                    placeholder="Search student by name..."
                                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-slate-100"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-850 custom-scrollbar">
                                            {chatContacts.map(contact => {
                                                const isActive = activeChatStudentId === contact.id;
                                                const hasUnread = (contact.unreadCount || 0) > 0;
                                                return (
                                                    <button
                                                        key={contact.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveChatStudentId(contact.id);
                                                            markMessagesAsRead(contact.id);
                                                            setChatInput('');
                                                            setShowTemplateMenu(false);
                                                            setShowSaveTemplateForm(false);
                                                        }}
                                                        className={`w-full px-5 py-4 flex gap-3 items-center transition-all text-left cursor-pointer relative border-l-4 ${
                                                            isActive
                                                                ? 'bg-teal-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-extrabold border-l-teal-600'
                                                                : hasUnread
                                                                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-slate-900 dark:text-white border-l-emerald-500 font-bold'
                                                                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-slate-700 dark:text-slate-300 border-l-transparent'
                                                        }`}
                                                    >
                                                        {/* Avatar Circle */}
                                                        <div className="relative shrink-0 select-none">
                                                            {contact.profile_pic_url ? (
                                                                <img 
                                                                    src={contact.profile_pic_url} 
                                                                    alt={contact.name} 
                                                                    className="w-8 h-8 rounded-full object-cover" 
                                                                    loading="lazy" 
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                                                                    {contact.name?.charAt(0) || 'S'}
                                                                </div>
                                                            )}
                                                            {hasUnread && (
                                                                <span className="absolute -top-0.5 -right-0.5 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-bounce" />
                                                            )}
                                                            {contact.is_online && (
                                                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1 flex flex-col">
                                                            <div className="flex justify-between items-baseline gap-1">
                                                                <span className={`text-xs truncate ${hasUnread ? 'font-black text-slate-900 dark:text-white' : 'font-extrabold'}`}>
                                                                    {contact.name}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {contact.lastMessageAt && (
                                                                        <span className={`text-[9px] ${hasUnread ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-400 font-medium'}`}>
                                                                            {contact.lastMessageAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    )}
                                                                    {hasUnread && (
                                                                        <span className="bg-emerald-500 text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-xs">
                                                                            {contact.unreadCount}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] truncate block mt-0.5 ${hasUnread ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'}`}>
                                                                {contact.lastMessage}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {chatContacts.length === 0 && (
                                                <p className="p-4 text-xs italic text-slate-400 text-center font-medium">No students found.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sub-Right Panel: Message Thread */}
                                    <div className={`flex-1 flex flex-col h-full bg-slate-50/20 dark:bg-slate-950/10 ${activeChatStudentId ? 'flex' : 'hidden md:flex'}`}>
                                        {activeChatStudentId ? (
                                            <>
                                                {/* Chat Header */}
                                                <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                                                    <div className="flex items-center gap-3">
                                                        {/* Back button for mobile */}
                                                        <button 
                                                            onClick={() => {
                                                                setActiveChatStudentId(null);
                                                                setShowTemplateMenu(false);
                                                                setShowSaveTemplateForm(false);
                                                            }}
                                                            className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                                                            type="button"
                                                            title="Back to students list"
                                                        >
                                                            <ArrowLeft className="w-4 h-4" />
                                                        </button>
                                                        
                                                        {/* Avatar and Name */}
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="relative shrink-0 select-none">
                                                                {students.find(s => s.id === activeChatStudentId)?.profile_pic_url ? (
                                                                    <img 
                                                                        src={students.find(s => s.id === activeChatStudentId)?.profile_pic_url} 
                                                                        alt={students.find(s => s.id === activeChatStudentId)?.name} 
                                                                        className="w-8 h-8 rounded-full object-cover" 
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-850 dark:text-teal-300 flex items-center justify-center font-bold text-xs select-none">
                                                                        {students.find(s => s.id === activeChatStudentId)?.name?.charAt(0) || 'S'}
                                                                    </div>
                                                                )}
                                                                {students.find(s => s.id === activeChatStudentId)?.is_online && (
                                                                    <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-extrabold text-xs text-slate-800 dark:text-white leading-tight">
                                                                    {students.find(s => s.id === activeChatStudentId)?.name}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Student</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Chat Search Status Banner */}
                                                {searchQuery.trim() && (
                                                    <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-955/20 border border-amber-200/50 rounded-2xl flex justify-between items-center text-xs font-bold text-amber-800 dark:text-amber-300">
                                                        <span>
                                                            🔍 Showing messages containing "{searchQuery}"
                                                        </span>
                                                        <button 
                                                            onClick={() => setSearchQuery('')}
                                                            className="text-amber-600 hover:underline hover:text-amber-700"
                                                            type="button"
                                                        >
                                                            Clear Search
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Messages Scroll Area */}
                                                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-left flex flex-col">
                                                    {directMessages
                                                        .filter(m => {
                                                            const belongsToThread = 
                                                                (m.sender_id === activeChatStudentId && m.receiver_id === teacherProfile?.id) ||
                                                                (m.sender_id === teacherProfile?.id && m.receiver_id === activeChatStudentId);
                                                            if (!belongsToThread) return false;
                                                            
                                                            const query = searchQuery.trim().toLowerCase();
                                                            if (!query) return true;
                                                            return m.message_text.toLowerCase().includes(query);
                                                        })
                                                        .map(msg => {
                                                            const isMe = msg.sender_id === teacherProfile?.id;
                                                            return (
                                                                <div
                                                                    key={msg.id}
                                                                    className={`max-w-[85%] md:max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                                                                        isMe
                                                                            ? 'bg-[#0e5f59] text-white self-end rounded-tr-none'
                                                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 self-start rounded-tl-none border border-slate-100 dark:border-slate-750'
                                                                    }`}
                                                                >
                                                                    <p className="whitespace-pre-wrap select-text font-medium">
                                                                        <AutoLinkText text={msg.message_text} preserveNewlines />
                                                                    </p>
                                                                    <div className="flex justify-end items-center gap-1 mt-1">
                                                                        <span className={`text-[8px] ${isMe ? 'text-teal-100/60' : 'text-slate-455'}`}>
                                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                        {isMe && (
                                                                            msg.status === 'read' ? (
                                                                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                                                            ) : msg.status === 'delivered' ? (
                                                                                <CheckCheck className="w-3.5 h-3.5 text-[#8696a0] shrink-0" />
                                                                            ) : (
                                                                                <Check className="w-3.5 h-3.5 text-[#8696a0] shrink-0" />
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    <div ref={teacherChatEndRef} />
                                                </div>

                                                {/* Chat Templates Popover Menu & Form */}
                                                <div className="relative bg-white dark:bg-slate-900">
                                                    {showTemplateMenu && (
                                                        <div className="absolute bottom-full left-4 mb-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 flex flex-col max-h-72 overflow-hidden animate-in slide-in-from-bottom-2 duration-150">
                                                            {showSaveTemplateForm ? (
                                                                /* Save Template Form */
                                                                <div className="p-4 flex flex-col gap-3 text-left">
                                                                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Save Current Message as Template</span>
                                                                    <input 
                                                                        type="text"
                                                                        value={chatTemplateName}
                                                                        onChange={(e) => setChatTemplateName(e.target.value)}
                                                                        placeholder="Template name (e.g. Lesson Followup)"
                                                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-955 text-slate-855 dark:text-white"
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-2 justify-end">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setShowSaveTemplateForm(false);
                                                                                setChatTemplateName('');
                                                                            }}
                                                                            className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            disabled={isSavingChatTemplate || !chatTemplateName.trim()}
                                                                            onClick={() => handleSaveChatTemplate(chatTemplateName)}
                                                                            className="px-3 py-1.5 bg-[#0e5f59] hover:bg-[#0b4e49] text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                                                        >
                                                                            {isSavingChatTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* List Templates */
                                                                <>
                                                                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-50 dark:bg-slate-800">
                                                                        <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider">Chat Templates</span>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!chatInput.trim()}
                                                                            onClick={() => setShowSaveTemplateForm(true)}
                                                                            className="text-[10px] text-[#0e5f59] hover:underline font-extrabold disabled:opacity-40 disabled:no-underline cursor-pointer"
                                                                        >
                                                                            + Save Current
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-850 custom-scrollbar text-left">
                                                                        {chatTemplates.map((t) => (
                                                                            <div
                                                                                key={t.id}
                                                                                onClick={() => {
                                                                                    setChatInput(t.content);
                                                                                    setShowTemplateMenu(false);
                                                                                }}
                                                                                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer flex justify-between items-start gap-3 transition-colors"
                                                                            >
                                                                                <div className="min-w-0 flex-1">
                                                                                    <span className="text-xs font-bold text-slate-855 dark:text-slate-200 block truncate">{t.name}</span>
                                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5 font-medium">{t.content}</span>
                                                                                </div>
                                                                                <button 
                                                                                    type="button"
                                                                                    onClick={(e) => handleDeleteChatTemplate(t.id, e)}
                                                                                    className="text-slate-400 hover:text-red-500 p-1 shrink-0 transition-colors cursor-pointer"
                                                                                    title="Delete template"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                        {chatTemplates.length === 0 && (
                                                                            <p className="p-4 text-xs italic text-slate-400 text-center font-medium">No templates saved yet. Type a message and click here to save it!</p>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Input Form */}
                                                <form
                                                    onSubmit={async (e) => {
                                                        e.preventDefault();
                                                        if (!chatInput.trim() || !teacherProfile?.id || !activeChatStudentId) return;
                                                        setSendingDirectMsg(true);
                                                        try {
                                                            const payload = {
                                                                sender_id: teacherProfile.id,
                                                                receiver_id: activeChatStudentId,
                                                                message_text: chatInput.trim(),
                                                                status: 'sent',
                                                                created_at: new Date().toISOString()
                                                            };
                                                            const { data, error } = await supabaseAuth
                                                                .from('messages')
                                                                .insert([payload])
                                                                .select();
                                                            if (error) throw error;
                                                            if (data) {
                                                                setDirectMessages(prev => prev.some(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
                                                                setChatInput('');

                                                                // Insert notification for the student
                                                                await supabaseAuth.from('notifications').insert({
                                                                    user_id: activeChatStudentId,
                                                                    title: `New Message: ${teacherProfile.name}`,
                                                                    message: payload.message_text,
                                                                    type: 'messages',
                                                                    is_read: false
                                                                });
                                                            }
                                                        } catch (err) {
                                                            console.error('Failed to send reply:', err);
                                                            alert('Failed to send reply.');
                                                        } finally {
                                                            setSendingDirectMsg(false);
                                                        }
                                                    }}
                                                    className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-center flex-shrink-0"
                                                >
                                                    {/* Template Selector Trigger */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setShowTemplateMenu(!showTemplateMenu);
                                                            setShowSaveTemplateForm(false);
                                                            setChatTemplateName('');
                                                        }}
                                                        className={`p-2.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                                                            showTemplateMenu
                                                                ? 'border-teal-500 bg-teal-50 text-teal-650 dark:bg-teal-950/20'
                                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-450 hover:bg-slate-50'
                                                        }`}
                                                        title="Message templates"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>

                                                    <input
                                                        type="text"
                                                        value={chatInput}
                                                        onChange={(e) => setChatInput(e.target.value)}
                                                        placeholder="Type a reply..."
                                                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 dark:text-slate-100"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={sendingDirectMsg || !chatInput.trim()}
                                                        className="px-4 py-2.5 bg-[#0e5f59] hover:bg-[#0b4e49] text-white font-bold rounded-xl text-xs flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                                                    >
                                                        {sendingDirectMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    </button>
                                                </form>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-slate-50/20 dark:bg-slate-955/10">
                                                <MessageSquare className="w-8 h-8 text-[#ecb613] mb-2 animate-pulse" />
                                                <p className="text-xs font-bold">Select a student from the left panel to open chat conversation.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeChannel === 'kfa_updates' ? (
                                /* KFA UPDATES MANAGEMENT PORTAL (ADMIN ONLY) */
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs flex flex-col gap-6 text-left">
                                    {/* Top Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                                <Sparkles className="w-4.5 h-4.5" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">KFA Updates Portal</h2>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Admin-only control center for Automatic Sources and Featured Updates
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sub-Section Toggle Buttons */}
                                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 select-none shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setKfaUpdatesSection('featured')}
                                                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                                    kfaUpdatesSection === 'featured'
                                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                <span>Featured Updates</span>
                                                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                                    {featuredUpdates.filter(u => u.status !== 'archived').length}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setKfaUpdatesSection('automatic')}
                                                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                                    kfaUpdatesSection === 'automatic'
                                                        ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs border border-slate-200 dark:border-slate-700'
                                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <Globe className="w-3.5 h-3.5 text-teal-500" />
                                                <span>Automatic Sources</span>
                                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                                                    systemNotifSettings.blog_enabled && systemNotifSettings.video_enabled
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                }`}>
                                                    {systemNotifSettings.blog_enabled && systemNotifSettings.video_enabled ? 'Active' : 'Paused'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* SECTION 1: FEATURED UPDATES (What's New at KFA) */}
                                    {kfaUpdatesSection === 'featured' && (
                                        <div className="space-y-6">
                                            {/* Master Floating Feature Control Banner */}
                                            <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                                systemNotifSettings.featured_updates_enabled
                                                    ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800'
                                                    : 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800'
                                            }`}>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-xs font-black text-slate-900 dark:text-white">
                                                            Floating &quot;What&apos;s New at KFA&quot; Widget:
                                                        </h3>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            systemNotifSettings.featured_updates_enabled
                                                                ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                                                                : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                                                        }`}>
                                                            {systemNotifSettings.featured_updates_enabled ? '● Active' : '⏸ Paused (Off)'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                        {systemNotifSettings.featured_updates_enabled
                                                            ? 'The floating widget is enabled. Targeted students will see active featured updates floating on their dashboards.'
                                                            : 'The floating widget is paused. No popup will appear for any student regardless of individual update status.'}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={isUpdatingNotifSettings}
                                                    onClick={() => handleToggleSystemNotification('featured_updates')}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 ${
                                                        systemNotifSettings.featured_updates_enabled
                                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                    }`}
                                                >
                                                    {isUpdatingNotifSettings ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : systemNotifSettings.featured_updates_enabled ? (
                                                        <>
                                                            <Pause className="w-3.5 h-3.5" />
                                                            <span>Pause Floating Feature</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-3.5 h-3.5" />
                                                            <span>Enable Floating Feature</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Filter and Action Bar */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                {/* Filter Pills */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {(['all', 'active', 'scheduled', 'draft', 'paused', 'archived'] as const).map(tab => (
                                                        <button
                                                            key={tab}
                                                            type="button"
                                                            onClick={() => setFeaturedFilter(tab)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                                                                featuredFilter === tab
                                                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            {tab}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Search & Create Button */}
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-full sm:w-56">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                        <input
                                                            type="text"
                                                            value={featuredSearch}
                                                            onChange={e => setFeaturedSearch(e.target.value)}
                                                            placeholder="Search updates..."
                                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={openCreateFeaturedUpdateModal}
                                                        className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md active:translate-y-[1px] transition-all cursor-pointer shrink-0"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span>Create Featured Update</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Featured Updates Cards Grid */}
                                            {isLoadingFeaturedUpdates ? (
                                                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                                                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                                                    <p className="text-xs font-bold">Loading featured updates...</p>
                                                </div>
                                            ) : filteredFeaturedUpdates.length === 0 ? (
                                                <div className="p-12 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                                                    <Sparkles className="w-10 h-10 text-amber-400 mx-auto" />
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Featured Updates Found</h4>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            {featuredSearch.trim() || featuredFilter !== 'all'
                                                                ? 'No updates match the active search or filter.'
                                                                : 'Create your first promoted link to appear in the floating widget!'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={openCreateFeaturedUpdateModal}
                                                        className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                                                    >
                                                        + Create Featured Update
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {filteredFeaturedUpdates.map(update => {
                                                        const now = new Date();
                                                        const isFuture = update.start_date && new Date(update.start_date) > now;
                                                        const isPast = update.end_date && new Date(update.end_date) < now;
                                                        const displayStatus = update.status === 'archived'
                                                            ? 'Archived'
                                                            : update.status === 'draft'
                                                                ? 'Draft'
                                                                : update.status === 'paused'
                                                                    ? 'Paused'
                                                                    : isFuture
                                                                        ? 'Scheduled'
                                                                        : isPast
                                                                            ? 'Expired'
                                                                            : 'Active';

                                                        return (
                                                            <div
                                                                key={update.id}
                                                                className="p-4 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 text-left"
                                                            >
                                                                <div className="space-y-2.5">
                                                                    {/* Top Row: Type & Status Badges */}
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                            {update.content_type || 'Other'}
                                                                        </span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                                            displayStatus === 'Active'
                                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                                : displayStatus === 'Scheduled'
                                                                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                                                                    : displayStatus === 'Paused'
                                                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                                        }`}>
                                                                            {displayStatus}
                                                                        </span>
                                                                    </div>

                                                                    {/* Thumbnail & Title */}
                                                                    <div className="flex items-start gap-3">
                                                                        {update.thumbnail_url ? (
                                                                            <img
                                                                                src={update.thumbnail_url}
                                                                                alt={update.title}
                                                                                className="w-16 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-16 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 shrink-0">
                                                                                <Sparkles className="w-5 h-5" />
                                                                            </div>
                                                                        )}
                                                                        <div className="min-w-0 flex-1">
                                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                                                                {update.title}
                                                                            </h4>
                                                                            {update.description && (
                                                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                                                                    {update.description}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Target Link & CTA Preview */}
                                                                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-mono">
                                                                        <a
                                                                            href={update.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="text-amber-600 dark:text-amber-400 hover:underline truncate flex items-center gap-1"
                                                                        >
                                                                            <span className="truncate">{update.url}</span>
                                                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                                                        </a>
                                                                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-sans text-[10px] font-bold rounded shrink-0">
                                                                            CTA: {update.cta_label || 'Learn More'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Target Recipients Chips */}
                                                                    <div className="flex flex-wrap gap-1 items-center">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">To:</span>
                                                                        {update.recipients && update.recipients.length > 0 ? (
                                                                            update.recipients.map((rec: any, idx: number) => (
                                                                                <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                                    {rec.name || rec.id}
                                                                                </span>
                                                                            ))
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                                                                                All Students (Global)
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Schedule info if set */}
                                                                    {(update.start_date || update.end_date) && (
                                                                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>
                                                                                {update.start_date ? `From: ${new Date(update.start_date).toLocaleDateString()}` : 'Immediate'}
                                                                                {update.end_date ? ` - To: ${new Date(update.end_date).toLocaleDateString()}` : ''}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Action buttons */}
                                                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEditFeaturedUpdateModal(update)}
                                                                        className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleFeaturedUpdateStatus(update)}
                                                                        className="px-2.5 py-1 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                                                                    >
                                                                        {update.status === 'active' ? 'Pause' : 'Resume'}
                                                                    </button>
                                                                    {update.status !== 'archived' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleArchiveFeaturedUpdate(update)}
                                                                            className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                                        >
                                                                            Archive
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteFeaturedUpdate(update.id)}
                                                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer ml-1"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SECTION 2: AUTOMATIC SOURCES (News & Updates) */}
                                    {kfaUpdatesSection === 'automatic' && (
                                        <div className="space-y-6 text-left">
                                            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
                                                <div className="flex items-start gap-2.5">
                                                    <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="text-xs font-black text-teal-900 dark:text-teal-200">
                                                            Automatic News & Updates Feeds
                                                        </h4>
                                                        <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-0.5 leading-relaxed">
                                                            Content configured here feeds automatically into the <strong>Student Dashboard → News & Updates</strong> card. These items do not appear in the floating &quot;What&apos;s New at KFA&quot; popup.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Blog Auto-Fetch */}
                                                <div className="p-5 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-xs space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                                                                <BookOpen className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Academy Blog Articles</h4>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            systemNotifSettings.blog_enabled
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                        }`}>
                                                            {systemNotifSettings.blog_enabled ? '● Active' : '⏸ Paused'}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                        Automatically pulls the latest published article from your Academy blog and highlights it for all students.
                                                    </p>

                                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Latest Detected Post:</span>
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block font-mono">
                                                            {autoFetchedBlogUrl || '/blog'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-3 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={fetchLatestBlogData}
                                                            disabled={fetchingAutoData}
                                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                        >
                                                            <RefreshCw className={`w-3.5 h-3.5 ${fetchingAutoData ? 'animate-spin' : ''}`} />
                                                            <span>Refresh Latest</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={isUpdatingNotifSettings}
                                                            onClick={() => handleToggleSystemNotification('blog')}
                                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                                                                systemNotifSettings.blog_enabled
                                                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 border border-amber-300'
                                                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                            }`}
                                                        >
                                                            {isUpdatingNotifSettings ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : systemNotifSettings.blog_enabled ? (
                                                                '⏸ Pause Blog Feed'
                                                            ) : (
                                                                '▶ Resume Blog Feed'
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* YouTube Auto-Fetch */}
                                                <div className="p-5 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-xs space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
                                                                <Youtube className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">YouTube Tutorials</h4>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            systemNotifSettings.video_enabled
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                        }`}>
                                                            {systemNotifSettings.video_enabled ? '● Active' : '⏸ Paused'}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                        Automatically checks your YouTube channel feed and displays the latest released tutorial in the student dashboard.
                                                    </p>

                                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Latest Detected Video:</span>
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block font-mono">
                                                            {autoFetchedVideoUrl || 'https://www.youtube.com/@krishnafluteacademy'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-3 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={fetchLatestVideoData}
                                                            disabled={fetchingAutoData}
                                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                        >
                                                            <RefreshCw className={`w-3.5 h-3.5 ${fetchingAutoData ? 'animate-spin' : ''}`} />
                                                            <span>Refresh Latest</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={isUpdatingNotifSettings}
                                                            onClick={() => handleToggleSystemNotification('video')}
                                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                                                                systemNotifSettings.video_enabled
                                                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 border border-amber-300'
                                                                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                                            }`}
                                                        >
                                                            {isUpdatingNotifSettings ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : systemNotifSettings.video_enabled ? (
                                                                '⏸ Pause Video Feed'
                                                            ) : (
                                                                '▶ Resume Video Feed'
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Main Composer Form */
                                <form onSubmit={handleSendBroadcast} className="bg-white p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs flex flex-col gap-6 text-left">
                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Compose Notification</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Targeted messages & push notification panel</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button"
                                            onClick={handleSaveDefaultTemplate}
                                            disabled={isSavingTemplate || !subject.trim() || !content.trim()}
                                            className="px-4 py-2 hover:bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        >
                                            {isSavingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                                            Save as Channel Template
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
                                    {/* Left inputs column: recipients */}
                                    <div className="col-span-12 md:col-span-4 flex flex-col gap-5 border-r border-slate-100/80 dark:border-slate-800/80 pr-4">
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
                                    </div>

                                    {/* Right inputs column: subject & body content editor */}
                                    <div className="col-span-12 md:col-span-8 flex flex-col gap-4">
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








                                        {messageType === 'broadcast' && (
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
                                        )}

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Message Content</label>
                                            <RichTextEditor 
                                                value={content}
                                                onChange={setContent}
                                                placeholder={messageType === 'broadcast' ? "Write your rich broadcast message here..." : "Write your normal replyable chat message here..."}
                                                minHeight="200px"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        )}
                        </div>
                    </div>

                    {/* Bottom Recent Broadcasts log section */}
                    {activeChannel !== 'chatbox' && activeChannel !== 'kfa_updates' && (
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
                                        <div key={bc.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row gap-6 justify-between items-start animate-in fade-in-50 duration-200">
                                            <div className="flex-1 min-w-0 space-y-2 text-left">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0e5f59] bg-[#0e5f59]/10 dark:bg-[#0e5f59]/25 dark:text-teal-400 px-2.5 py-0.5 rounded-full">
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
                                                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{bc.subject}</h4>
                                                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl overflow-x-auto select-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(bc.content) }} />
                                                {(bc as any).audio_attachment && (
                                                    <div className="flex items-center gap-2 mt-3 select-none">
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const audio = new Audio((bc as any).audio_attachment);
                                                                audio.play();
                                                                showToast('Playing attached flute note...', 'info');
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-[#ecb613]/10 hover:text-[#ecb613] text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-full border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                                        >
                                                            <Mic className="w-3.5 h-3.5 text-[#ecb613]" />
                                                            Play Attached Flute Note
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Read Receipts */}
                                                {!dbSetupErrorReads && (
                                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                                            <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span>Read By ({broadcastReads.filter((r: any) => r.broadcast_id === bc.id).length})</span>
                                                        </div>
                                                        {broadcastReads.filter((r: any) => r.broadcast_id === bc.id).length === 0 ? (
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No students have read this announcement yet.</p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {broadcastReads.filter((r: any) => r.broadcast_id === bc.id).map((r: any) => (
                                                                    <span key={r.users?.id || r.user_id} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900/40 text-[9px] font-bold rounded-full">
                                                                        <Check className="w-2.5 h-2.5" />
                                                                        {r.users?.name || 'Unknown Student'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full md:w-64 lg:w-72 shrink-0 flex flex-col gap-3 justify-between text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                                                <div className="space-y-1.5">
                                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                                                        Sent To ({bc.recipients?.length || 0})
                                                    </span>
                                                    <div className="flex flex-wrap md:justify-end gap-1.5 max-h-28 overflow-y-auto custom-scrollbar p-0.5">
                                                        {bc.recipients?.map((rec: any, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[9px] font-bold rounded-md truncate max-w-[150px]">
                                                                {rec.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 items-start md:items-end">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                                        <span>Active</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadForResend(bc)}
                                                        className="mt-1 text-[10px] font-extrabold text-[#ecb613] hover:text-[#d49f0e] transition-colors flex items-center gap-1 hover:underline cursor-pointer"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                        Edit & Resend
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteBroadcast(bc.id, bc.subject, bc.content)}
                                                        className="mt-1.5 text-[10px] font-extrabold text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors flex items-center gap-1 hover:underline cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Delete Announcement
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
                    )}
                </div>
            </main>
        </div>

            {/* Create / Edit Featured Update Modal */}
            {isUpdateModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                    {editingUpdate ? 'Edit Featured Update' : 'Create Featured Update'}
                                </h3>
                                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                    Promote any URL to the floating &quot;What&apos;s New at KFA&quot; widget
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsUpdateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto text-left">
                            {/* Title */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Update Title *
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="e.g. Masterclass Registration / New Bansuri Riyaz Video"
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>

                            {/* Destination URL */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Destination URL *
                                </label>
                                <input
                                    type="text"
                                    value={formUrl}
                                    onChange={e => handleFormUrlChange(e.target.value)}
                                    placeholder="https://... (YouTube, Blog, Google Drive, Forms, etc.)"
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                                />
                                <p className="text-[10px] text-slate-400">
                                    Pasting a YouTube, Blog, or Drive URL will auto-suggest type and button label.
                                </p>
                            </div>

                            {/* Content Type & CTA Label */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Content Type
                                    </label>
                                    <select
                                        value={formContentType}
                                        onChange={e => setFormContentType(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    >
                                        <option value="youtube">YouTube Video</option>
                                        <option value="blog">Academy Blog</option>
                                        <option value="tutorial">Tutorial Lesson</option>
                                        <option value="event">Academy Event / Workshop</option>
                                        <option value="resource">Learning Resource / PDF</option>
                                        <option value="announcement">Important Notice</option>
                                        <option value="external">External Link</option>
                                        <option value="other">Other Link</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        CTA Button Label
                                    </label>
                                    <input
                                        type="text"
                                        value={formCtaLabel}
                                        onChange={e => setFormCtaLabel(e.target.value)}
                                        placeholder="e.g. Watch Video, Register Now, Open Resource"
                                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Description / Summary (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Short teaser or guidance text for students..."
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>

                            {/* Thumbnail URL */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Thumbnail URL (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formThumbnail}
                                    onChange={e => setFormThumbnail(e.target.value)}
                                    placeholder="https://.../image.jpg (auto-extracted for YouTube)"
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                                />
                            </div>

                            {/* Target Recipients */}
                            <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-750">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                        Target Recipients ({formRecipients.length})
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRecipientModalContext('featured_update');
                                            setTempSelectedTargets(formRecipients.map(r => r.id));
                                            setIsModalOpen(true);
                                        }}
                                        className="px-3 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 text-amber-900 dark:text-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    >
                                        + Select Audience
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {formRecipients.map(r => (
                                        <span
                                            key={r.id}
                                            className="px-2.5 py-1 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                                        >
                                            <span>{r.name}</span>
                                            {formRecipients.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormRecipients(prev => prev.filter(x => x.id !== r.id))}
                                                    className="hover:text-rose-600 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Scheduling Toggle */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-3">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formIsScheduled}
                                        onChange={e => setFormIsScheduled(e.target.checked)}
                                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Schedule Publication Window (Optional)
                                    </span>
                                </label>

                                {formIsScheduled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in-50 duration-150">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Start Date & Time</span>
                                            <input
                                                type="datetime-local"
                                                value={formStartDate}
                                                onChange={e => setFormStartDate(e.target.value)}
                                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">End Date & Time</span>
                                            <input
                                                type="datetime-local"
                                                value={formEndDate}
                                                onChange={e => setFormEndDate(e.target.value)}
                                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status Selector */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Initial Status
                                </label>
                                <div className="flex items-center gap-2">
                                    {(['active', 'draft', 'paused'] as const).map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setFormStatus(st)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-black capitalize transition-all cursor-pointer ${
                                                formStatus === st
                                                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notify Students Again Checkbox (Edit Mode Only) */}
                            {editingUpdate && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60">
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={formNotifyAgain}
                                            onChange={e => setFormNotifyAgain(e.target.checked)}
                                            className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                                Notify students again about this update
                                            </span>
                                            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                                Resets read/dismiss status for this update so the floating widget automatically pops open as &quot;NEW&quot; for targeted students.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsUpdateModalOpen(false)}
                                className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSavingFeaturedUpdate || !formTitle.trim() || !formUrl.trim()}
                                onClick={handleSaveFeaturedUpdate}
                                className="px-5 py-2.5 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-950 text-xs font-black rounded-xl transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                            >
                                {isSavingFeaturedUpdate ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : editingUpdate ? (
                                    'Update Featured Link'
                                ) : (
                                    'Publish Featured Update'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            {/* Target Class vs Student vs Custom Group Toggle */}
                            {(recipientModalContext === 'featured_update' || (activeChannel !== 'classroom' && activeChannel !== 'announcements')) ? (
                                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1 select-none">
                                    <button 
                                        onClick={() => setModalTab('class')}
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                            modalTab === 'class' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
                                        }`}
                                    >
                                        Classrooms
                                    </button>
                                    <button 
                                        onClick={() => setModalTab('student')}
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                            modalTab === 'student' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
                                        }`}
                                    >
                                        Students
                                    </button>
                                    <button 
                                        onClick={() => setModalTab('group')}
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg tracking-wide transition-all ${
                                            modalTab === 'group' ? 'bg-white text-[#0e5f59] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'
                                        }`}
                                    >
                                        Custom Groups
                                    </button>
                                </div>
                            ) : (
                                <div className={`p-3 rounded-xl border text-xs font-bold select-none ${
                                    activeChannel === 'classroom' 
                                        ? 'bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-400' 
                                        : 'bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-955/20 dark:border-amber-900 dark:text-amber-400'
                                }`}>
                                    {activeChannel === 'classroom' 
                                        ? '👥 Classroom Broadcast: Target a single classroom' 
                                        : '📢 Announcement: Target All Students (Global) or multiple classrooms'}
                                </div>
                            )}

                            {/* Inner Search Box */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#ecb613] font-medium text-slate-800 dark:text-slate-100" 
                                    placeholder={`Filter ${modalTab === 'class' ? 'classrooms' : modalTab === 'group' ? 'custom groups' : 'students'}...`}
                                    type="text" 
                                    value={modalSearchQuery}
                                    onChange={(e) => setModalSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* List items with checkboxes */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-60">
                            {/* Special global targeting option when Class tab is open */}
                            {modalTab === 'class' && activeChannel !== 'classroom' && !modalSearchQuery && (
                                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:bg-slate-800/80 rounded-xl cursor-pointer border border-transparent hover:border-slate-200 dark:border-slate-700 transition-all">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSelectedTargets.includes('global')}
                                        onChange={() => toggleTargetSelection('global')}
                                        className="rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 focus:ring-1"
                                    />
                                    <div className="min-w-0 select-none">
                                        <h6 className="text-sm font-bold text-slate-800 dark:text-slate-250">All Students (Global)</h6>
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Global audience target</p>
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
                                                {modalTab === 'class' ? 'Classroom Group' : modalTab === 'group' ? 'Custom Group' : 'Individual Student'}
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
