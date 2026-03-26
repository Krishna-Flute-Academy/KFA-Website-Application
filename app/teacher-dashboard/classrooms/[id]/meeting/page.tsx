'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import { Loader2, ArrowLeft, Maximize2, Minimize2, LogOut } from 'lucide-react';
import TeacherSidebar from '../../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../../src/components/TeacherHeader';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function MeetingPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;
    const jitsiContainerRef = useRef<HTMLDivElement>(null);
    const [api, setApi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroomName, setClassroomName] = useState('');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                // Fetch Teacher Profile
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                // Fetch Classroom Name
                const { data: classroom } = await supabaseAuth
                    .from('classrooms')
                    .select('name')
                    .eq('id', classroomId)
                    .single();
                
                if (classroom) {
                    setClassroomName(classroom.name);
                }

            } catch (err) {
                console.error('Error fetching meeting details:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [classroomId, router]);

    useEffect(() => {
        if (!loading && teacherProfile && jitsiContainerRef.current && !api) {
            // Load Jitsi script
            const script = document.createElement('script');
            script.src = 'https://meet.jit.si/external_api.js';
            script.async = true;
            script.onload = () => {
                const domain = 'meet.jit.si';
                const options = {
                    roomName: `KFA_Academy_Class_${classroomId}`,
                    width: '100%',
                    height: '100%',
                    parentNode: jitsiContainerRef.current,
                    userInfo: {
                        email: teacherProfile.email,
                        displayName: `${teacherProfile.name} (Teacher)`
                    },
                    configOverwrite: {
                        startWithAudioMuted: false,
                        startWithVideoMuted: false,
                        prejoinPageEnabled: false,
                        disableModeratorIndicator: false,
                        enableWelcomePage: false,
                        enableClosePage: false
                    },
                    interfaceConfigOverwrite: {
                        TOOLBAR_BUTTONS: [
                            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                            'security'
                        ],
                    }
                };
                const newApi = new window.JitsiMeetExternalAPI(domain, options);
                setApi(newApi);

                newApi.addEventListeners({
                    readyToClose: () => {
                        router.push('/teacher-dashboard');
                    }
                });
            };
            document.body.appendChild(script);

            return () => {
                if (api) {
                   api.dispose();
                }
                document.body.removeChild(script);
            };
        }
    }, [loading, teacherProfile, classroomId, api, router]);

    const handleLogout = async () => {
        if (api) api.dispose();
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Initializing Virtual Classroom...</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden text-white font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0 relative">
                <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-sm font-bold tracking-tight text-white">{classroomName || 'Virtual Classroom'}</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Live Session</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                if (api) api.dispose();
                                router.push('/teacher-dashboard');
                            }}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                        >
                            <LogOut size={14} /> End Session
                        </button>
                    </div>
                </header>

                <div className="flex-1 relative bg-black">
                   <div ref={jitsiContainerRef} className="absolute inset-0 w-full h-full" />
                </div>
            </main>
        </div>
    );
}
