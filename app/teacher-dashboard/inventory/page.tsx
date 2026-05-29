'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { 
    Loader2, 
    ChevronRight, 
    ChevronDown, 
    Plus, 
    Edit2, 
    Trash2, 
    Play, 
    FileText, 
    Video, 
    Music, 
    Link2, 
    Image as ImageIcon, 
    ExternalLink, 
    X, 
    Save, 
    UploadCloud, 
    Globe, 
    Sparkles, 
    PlusCircle,
    CheckSquare,
    BookOpen,
    HelpCircle,
    Keyboard,
    Users,
    Award,
    Trophy,
    Calendar,
    ArrowLeft,
    ArrowRight,
    CloudLightning,
    CloudRain,
    RefreshCw,
    Database,
    Zap,
    Download,
    UserCheck,
    ClipboardList,
    CheckCircle
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { 
    CourseModule, 
    CourseChapter, 
    CourseLesson,
    INITIAL_MODULES,
    INITIAL_CHAPTERS,
    INITIAL_LESSONS
} from './initial-data';

export default function InventoryLibrary() {
    const router = useRouter();
    
    // Auth & Status States
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Core Data States
    const [modules, setModules] = useState<CourseModule[]>([]);
    const [chapters, setChapters] = useState<CourseChapter[]>([]);
    const [lessons, setLessons] = useState<CourseLesson[]>([]);
    
    // Navigation & Selected States
    const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
    const [selectedModuleId, setSelectedModuleId] = useState<string>('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    
    // DB Mode Status
    const [isUsingFallback, setIsUsingFallback] = useState(false);
    
    // Sync Backup Widget States
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedText, setLastSyncedText] = useState('Synced just now');
    
    // Modals & Form States
    const [activeModal, setActiveModal] = useState<'chapter' | 'lesson' | 'module' | 'category' | null>(null);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    
    // Form Inputs
    const [moduleForm, setModuleForm] = useState({ title: '', category: '', description: '', module_number: 1 });
    const [categoryForm, setCategoryForm] = useState({ oldName: '', newName: '' });
    const [chapterForm, setChapterForm] = useState({ title: '', description: '', chapter_number: 1, module_id: '' });
    const [lessonForm, setLessonForm] = useState({
        title: '', 
        description: '', 
        lesson_number: 1, 
        material_type: 'file', // 'file' | 'image' | 'pdf' | 'audio' | 'video'
        material_url: '', 
        file_name: '', 
        file_size: '', 
        duration: '',
        link_url: '',
        chapter_id: '',
        bullet_points_text: ''
    });

    
    // File Upload Progress State
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    
    // Media Play Preview overlay state
    const [mediaPreview, setMediaPreview] = useState<{ type: string; url: string; title: string } | null>(null);

    // Topic Preview Modal State
    const [selectedLessonPreview, setSelectedLessonPreview] = useState<CourseLesson | null>(null);

    // ── Assign to Students Modal States ───────────────────────────────────────
    const [assignModal, setAssignModal] = useState<{ refType: 'module' | 'chapter' | 'lesson'; refId: string; refTitle: string } | null>(null);
    const [assignClassrooms, setAssignClassrooms] = useState<{ id: string; name: string; student_count: number }[]>([]);
    const [assignClassroomsLoading, setAssignClassroomsLoading] = useState(false);
    const [assignSelectedClassroomId, setAssignSelectedClassroomId] = useState('');
    const [assignClassroomStudents, setAssignClassroomStudents] = useState<{ student_id: string; name: string }[]>([]);
    const [assignStudentsLoading, setAssignStudentsLoading] = useState(false);
    const [assignForm, setAssignForm] = useState<{ targetType: 'all' | 'individual'; studentIds: Set<string>; dueDate: string; note: string }>({
        targetType: 'all', studentIds: new Set(), dueDate: '', note: ''
    });
    const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
    const [assignSuccess, setAssignSuccess] = useState(false);

    // Initial Fetch & Auth Verify
    useEffect(() => {
        const fetchAuthAndData = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);
                
                // Load Curriculum details dynamically from live Supabase tables
                await loadDatabaseData();
            } catch (err) {
                console.error('Failed to query database. Enabling offline local storage fallback mode:', err);
                enableLocalFallback();
            } finally {
                setLoading(false);
            }
        };
        fetchAuthAndData();
    }, [router]);

    // Query active Supabase tables dynamically
    const loadDatabaseData = async () => {
        const { data: dbModules, error: modErr } = await supabaseAuth
            .from('course_modules')
            .select('*')
            .order('module_number', { ascending: true });
        
        if (modErr) {
            throw new Error('Supabase tables course_modules query failed.');
        }

        const { data: dbChapters } = await supabaseAuth
            .from('course_chapters')
            .select('*')
            .order('chapter_number', { ascending: true });
            
        const { data: dbLessons } = await supabaseAuth
            .from('course_lessons')
            .select('*')
            .order('lesson_number', { ascending: true });

        if (dbModules && dbModules.length > 0) {
            setModules(dbModules);
            setChapters(dbChapters || []);
            setLessons(dbLessons || []);
            
            // Auto expand the first chapter of active module by default
            if (dbChapters && dbChapters.length > 0) {
                const firstChap = dbChapters.find(c => c.module_id === selectedModuleId);
                if (firstChap) {
                    setExpandedChapters({ [firstChap.id]: true });
                }
            }
            setIsUsingFallback(false);
        } else {
            // Tables are empty, auto-seed database from INITIAL constants
            await seedSupabaseTables();
        }
    };

    // Database Auto-seeding
    const seedSupabaseTables = async () => {
        try {
            await supabaseAuth.from('course_modules').insert(INITIAL_MODULES);
            await supabaseAuth.from('course_chapters').insert(INITIAL_CHAPTERS);
            await supabaseAuth.from('course_lessons').insert(INITIAL_LESSONS);
            
            // Reload seedings
            const { data: dbModules } = await supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true });
            const { data: dbChapters } = await supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true });
            const { data: dbLessons } = await supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true });
            
            if (dbModules) setModules(dbModules);
            if (dbChapters) setChapters(dbChapters || []);
            if (dbLessons) setLessons(dbLessons || []);
            
            if (dbChapters && dbChapters.length > 0) {
                const firstChap = dbChapters.find(c => c.module_id === selectedModuleId);
                if (firstChap) {
                    setExpandedChapters({ [firstChap.id]: true });
                }
            }
            setIsUsingFallback(false);
        } catch (err) {
            console.error('Seeding database tables failed:', err);
            enableLocalFallback();
        }
    };

    // Offline interactive mode fallback using localStorage
    const enableLocalFallback = () => {
        setIsUsingFallback(true);
        const localMods = localStorage.getItem('kfa_modules');
        const localChaps = localStorage.getItem('kfa_chapters');
        const localLess = localStorage.getItem('kfa_lessons');

        let parsedLess: CourseLesson[] = [];
        try {
            parsedLess = localLess ? JSON.parse(localLess) : [];
        } catch (e) {
            parsedLess = [];
        }

        // Force reload/migration to the comprehensive custom structure if legacy seed is detected
        const hasLegacySeed = !localChaps || !localChaps.includes('Introduction to the Indian bamboo flute') || !localLess || parsedLess.length !== 30;
        
        if (localMods && localChaps && localLess && !hasLegacySeed) {
            setModules(JSON.parse(localMods));
            setChapters(JSON.parse(localChaps));
            setLessons(parsedLess);
            
            const firstChap = JSON.parse(localChaps).find((c: any) => c.module_id === selectedModuleId);
            if (firstChap) {
                setExpandedChapters({ [firstChap.id]: true });
            }
        } else {
            setModules(INITIAL_MODULES);
            setChapters(INITIAL_CHAPTERS);
            setLessons(INITIAL_LESSONS);
            
            localStorage.setItem('kfa_modules', JSON.stringify(INITIAL_MODULES));
            localStorage.setItem('kfa_chapters', JSON.stringify(INITIAL_CHAPTERS));
            localStorage.setItem('kfa_lessons', JSON.stringify(INITIAL_LESSONS));
            
            const firstChap = INITIAL_CHAPTERS.find(c => c.module_id === selectedModuleId);
            if (firstChap) {
                setExpandedChapters({ [firstChap.id]: true });
            }
        }
    };

    // Offline Local storage saver
    const persistLocalData = (newMods: CourseModule[], newChaps: CourseChapter[], newLess: CourseLesson[]) => {
        setModules(newMods);
        setChapters(newChaps);
        setLessons(newLess);
        localStorage.setItem('kfa_modules', JSON.stringify(newMods));
        localStorage.setItem('kfa_chapters', JSON.stringify(newChaps));
        localStorage.setItem('kfa_lessons', JSON.stringify(newLess));
    };

    // Log Out
    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // Filter helpers
    const getChapterLessons = (chapterId: string) => {
        return lessons
            .filter(l => l.chapter_id === chapterId)
            .sort((a, b) => a.lesson_number - b.lesson_number);
    };

    const getModuleChapters = (moduleId: string) => {
        return chapters
            .filter(c => c.module_id === moduleId)
            .sort((a, b) => a.chapter_number - b.chapter_number);
    };

    const getMaterialIcon = (type: string, hasUrl: boolean = true) => {
        if (!hasUrl) {
            return <FileText className="size-5 text-slate-400 shrink-0" />;
        }
        switch (type?.toLowerCase()) {
            case 'pdf': 
                return <FileText className="size-5 text-red-500 shrink-0" />;
            case 'video': 
                return <Video className="size-5 text-amber-500 shrink-0" />;
            case 'audio': 
                return <Music className="size-5 text-blue-500 shrink-0" />;
            case 'image': 
                return <ImageIcon className="size-5 text-emerald-500 shrink-0" />;
            default: 
                return <FileText className="size-5 text-slate-500 shrink-0" />;
        }
    };

    // Handle Module Switch from Levels Cards
    const handleSelectModule = (moduleId: string) => {
        setSelectedModuleId(moduleId);
        const moduleChaps = getModuleChapters(moduleId);
        
        // Auto-expand the first chapter accordion by default
        const newExpanded: Record<string, boolean> = {};
        if (moduleChaps.length > 0) {
            newExpanded[moduleChaps[0].id] = true;
        }
        setExpandedChapters(newExpanded);
        setCurrentView('dashboard');
    };

    // Toggle Chapter Accordion
    const toggleChapterExpand = (chapterId: string) => {
        setExpandedChapters(prev => ({
            ...prev,
            [chapterId]: !prev[chapterId]
        }));
    };

    // Open Chapter Edit Modal (populates correctly on edit click)
    const openChapterModal = (chapter?: CourseChapter, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        if (chapter) {
            setEditingItem(chapter);
            setChapterForm({
                title: chapter.title,
                description: chapter.description || '',
                chapter_number: chapter.chapter_number,
                module_id: chapter.module_id
            });
        } else {
            setEditingItem(null);
            const numChaps = getModuleChapters(selectedModuleId).length;
            setChapterForm({
                title: '',
                description: '',
                chapter_number: numChaps + 1,
                module_id: selectedModuleId
            });
        }
        setActiveModal('chapter');
    };

    // Save Chapter updates/creates to database or fallback
    const saveChapter = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chapterForm.title || !chapterForm.module_id) return;

        setLoading(true);
        if (isUsingFallback) {
            let updatedChaps = [...chapters];
            if (editingItem) {
                updatedChaps = updatedChaps.map(c => c.id === editingItem.id ? { ...c, ...chapterForm } : c);
            } else {
                const newChap: CourseChapter = {
                    id: 'chap_' + Math.random().toString(36).substring(7),
                    ...chapterForm
                };
                updatedChaps.push(newChap);
                setExpandedChapters(prev => ({ ...prev, [newChap.id]: true }));
            }
            persistLocalData(modules, updatedChaps, lessons);
            setLoading(false);
            setActiveModal(null);
        } else {
            try {
                if (editingItem) {
                    await supabaseAuth
                        .from('course_chapters')
                        .update({
                            title: chapterForm.title,
                            description: chapterForm.description,
                            chapter_number: chapterForm.chapter_number,
                            module_id: chapterForm.module_id
                        })
                        .eq('id', editingItem.id);
                } else {
                    const newId = crypto.randomUUID();
                    await supabaseAuth
                        .from('course_chapters')
                        .insert([{
                            id: newId,
                            title: chapterForm.title,
                            description: chapterForm.description,
                            chapter_number: chapterForm.chapter_number,
                            module_id: chapterForm.module_id
                        }]);
                    setExpandedChapters(prev => ({ ...prev, [newId]: true }));
                }
                await loadDatabaseData();
                setActiveModal(null);
            } catch (err) {
                console.error(err);
                alert('Database update failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Delete Chapter
    const deleteChapter = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this chapter? All its learning materials will be deleted.')) return;

        setLoading(true);
        if (isUsingFallback) {
            const updatedChaps = chapters.filter(c => c.id !== id);
            const updatedLessons = lessons.filter(l => l.chapter_id !== id);
            persistLocalData(modules, updatedChaps, updatedLessons);
            setLoading(false);
        } else {
            try {
                await supabaseAuth.from('course_chapters').delete().eq('id', id);
                await loadDatabaseData();
            } catch (err) {
                console.error(err);
                alert('Delete failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    const parseModuleCategory = (mod: CourseModule) => {
        if (!mod.description) {
            return {
                category: mod.module_number < 100 ? 'Proficiency Levels' : 'Specialized Modules',
                description: ''
            };
        }
        const match = mod.description.match(/^\[(.*?)\]\s*([\s\S]*)$/);
        if (match) {
            return {
                category: match[1].trim(),
                description: match[2].trim()
            };
        }
        return {
            category: mod.module_number < 100 ? 'Proficiency Levels' : 'Specialized Modules',
            description: mod.description
        };
    };

    // Open Module Modal
    const openModuleModal = (module?: CourseModule, initialCategory?: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (module) {
            setEditingItem(module);
            const parsed = parseModuleCategory(module);
            setModuleForm({
                title: module.title,
                category: parsed.category,
                description: parsed.description,
                module_number: module.module_number
            });
        } else {
            setEditingItem(null);
            setModuleForm({
                title: '',
                category: initialCategory || 'Specialized Modules',
                description: '',
                module_number: modules.length > 0 ? Math.max(...modules.map(m => m.module_number)) + 1 : 1
            });
        }
        setActiveModal('module');
    };

    // Save Module details
    const saveModule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!moduleForm.title || !moduleForm.category) return;

        setLoading(true);
        const prefixedDescription = `[${moduleForm.category.trim()}] ${moduleForm.description.trim()}`;

        if (isUsingFallback) {
            let updatedMods = [...modules];
            if (editingItem) {
                updatedMods = updatedMods.map(m => m.id === editingItem.id ? { 
                    ...m, 
                    title: moduleForm.title, 
                    description: prefixedDescription,
                    module_number: Number(moduleForm.module_number)
                } : m);
            } else {
                const newMod: CourseModule = {
                    id: crypto.randomUUID(),
                    title: moduleForm.title,
                    description: prefixedDescription,
                    module_number: Number(moduleForm.module_number)
                };
                updatedMods.push(newMod);
            }
            persistLocalData(updatedMods, chapters, lessons);
            setLoading(false);
            setActiveModal(null);
        } else {
            try {
                if (editingItem) {
                    await supabaseAuth
                        .from('course_modules')
                        .update({
                            title: moduleForm.title,
                            description: prefixedDescription,
                            module_number: Number(moduleForm.module_number)
                        })
                        .eq('id', editingItem.id);
                } else {
                    await supabaseAuth
                        .from('course_modules')
                        .insert([{
                            id: crypto.randomUUID(),
                            title: moduleForm.title,
                            description: prefixedDescription,
                            module_number: Number(moduleForm.module_number)
                        }]);
                }
                await loadDatabaseData();
                setActiveModal(null);
            } catch (err) {
                console.error(err);
                alert('Database update failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Delete Module and all its nested chapters and lessons
    const deleteModule = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this level/module? All its chapters and learning materials will be permanently deleted.')) return;

        setLoading(true);
        if (isUsingFallback) {
            const updatedMods = modules.filter(m => m.id !== id);
            const deletedChaps = chapters.filter(c => c.module_id === id);
            const deletedChapIds = deletedChaps.map(c => c.id);
            const updatedChaps = chapters.filter(c => c.module_id !== id);
            const updatedLessons = lessons.filter(l => !deletedChapIds.includes(l.chapter_id));
            
            persistLocalData(updatedMods, updatedChaps, updatedLessons);
            setLoading(false);
        } else {
            try {
                const { data: dbChaps } = await supabaseAuth.from('course_chapters').select('id').eq('module_id', id);
                const chapIds = dbChaps?.map(c => c.id) || [];
                
                if (chapIds.length > 0) {
                    await supabaseAuth.from('course_lessons').delete().in('chapter_id', chapIds);
                    await supabaseAuth.from('course_chapters').delete().eq('module_id', id);
                }
                await supabaseAuth.from('course_modules').delete().eq('id', id);
                await loadDatabaseData();
            } catch (err) {
                console.error(err);
                alert('Delete failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Open Category Rename Modal
    const openCategoryRenameModal = (categoryName: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setCategoryForm({
            oldName: categoryName,
            newName: categoryName
        });
        setActiveModal('category');
    };

    // Save Category Rename
    const saveCategoryRename = async (e: React.FormEvent) => {
        e.preventDefault();
        const oldName = categoryForm.oldName.trim();
        const newName = categoryForm.newName.trim();
        if (!newName || oldName === newName) {
            setActiveModal(null);
            return;
        }

        setLoading(true);
        const affectedModules = modules.filter(m => {
            const parsed = parseModuleCategory(m);
            return parsed.category === oldName;
        });

        if (isUsingFallback) {
            const updatedMods = modules.map(m => {
                const parsed = parseModuleCategory(m);
                if (parsed.category === oldName) {
                    return {
                        ...m,
                        description: `[${newName}] ${parsed.description}`
                    };
                }
                return m;
            });
            persistLocalData(updatedMods, chapters, lessons);
            setLoading(false);
            setActiveModal(null);
        } else {
            try {
                for (const mod of affectedModules) {
                    const parsed = parseModuleCategory(mod);
                    await supabaseAuth
                        .from('course_modules')
                        .update({
                            description: `[${newName}] ${parsed.description}`
                        })
                        .eq('id', mod.id);
                }
                await loadDatabaseData();
                setActiveModal(null);
            } catch (err) {
                console.error(err);
                alert('Category rename failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Open Lesson Card Edit Modal (populates correctly on card edit click)
    const openLessonModal = (chapterId: string, lesson?: CourseLesson, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        if (lesson) {
            setEditingItem(lesson);
            setLessonForm({
                title: lesson.title,
                description: lesson.description || '',
                lesson_number: lesson.lesson_number,
                material_type: lesson.material_type || 'file',
                material_url: lesson.material_url || '',
                file_name: lesson.file_name || '',
                file_size: lesson.file_size || '',
                duration: lesson.duration || '',
                link_url: lesson.link_url || '',
                chapter_id: lesson.chapter_id,
                bullet_points_text: (lesson.bullet_points || []).join('\n')
            });
        } else {
            setEditingItem(null);
            const numLessons = getChapterLessons(chapterId).length;
            setLessonForm({
                title: '',
                description: '',
                lesson_number: numLessons + 1,
                material_type: 'file',
                material_url: '',
                file_name: '',
                file_size: '',
                duration: '',
                link_url: '',
                chapter_id: chapterId,
                bullet_points_text: ''
            });
        }
        setActiveModal('lesson');
    };

    // Simplified Attachment File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
        const friendlySize = `${sizeInMb}MB`;

        // MIME Mapping rule
        let mappedType = 'file';
        if (file.type.startsWith('audio/')) {
            mappedType = 'audio';
        } else if (file.type.startsWith('video/')) {
            mappedType = 'video';
        } else if (file.type.includes('pdf') || file.name.endsWith('.pdf')) {
            mappedType = 'pdf';
        } else if (file.type.startsWith('image/')) {
            mappedType = 'image';
        }

        setUploadProgress(20);

        if (isUsingFallback) {
            // Simulated upload for local fallbacks
            const interval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev === null) return null;
                    if (prev >= 100) {
                        clearInterval(interval);
                        setTimeout(() => {
                            setUploadProgress(null);
                            const objectUrl = URL.createObjectURL(file);
                            setLessonForm(prevForm => ({
                                ...prevForm,
                                material_type: mappedType,
                                material_url: objectUrl,
                                file_name: file.name,
                                file_size: friendlySize,
                                duration: mappedType.toUpperCase() + ' • ' + friendlySize
                            }));
                        }, 400);
                        return 100;
                    }
                    return prev + 25;
                });
            }, 100);
        } else {
            // Live Upload to Supabase bucket 'inventory_materials'
            try {
                const fileExt = file.name.split('.').pop();
                const randomName = `${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${fileExt}`;
                const filePath = `materials/${randomName}`;

                setUploadProgress(50);
                
                const { error: uploadError } = await supabaseAuth.storage
                    .from('inventory_materials')
                    .upload(filePath, file);

                if (uploadError) {
                    throw uploadError;
                }

                setUploadProgress(85);

                const { data: { publicUrl } } = supabaseAuth.storage
                    .from('inventory_materials')
                    .getPublicUrl(filePath);

                setUploadProgress(100);
                setTimeout(() => {
                    setUploadProgress(null);
                    setLessonForm(prev => ({
                        ...prev,
                        material_type: mappedType,
                        material_url: publicUrl,
                        file_name: file.name,
                        file_size: friendlySize,
                        duration: mappedType.toUpperCase() + ' • ' + friendlySize
                    }));
                }, 400);
            } catch (err: any) {
                console.error(err);
                // Graceful fallback to Object URL if bucket or credentials fails
                setTimeout(() => {
                    setUploadProgress(null);
                    const objectUrl = URL.createObjectURL(file);
                    setLessonForm(prev => ({
                        ...prev,
                        material_type: mappedType,
                        material_url: objectUrl,
                        file_name: file.name,
                        file_size: friendlySize,
                        duration: mappedType.toUpperCase() + ' • ' + friendlySize
                    }));
                }, 300);
            }
        }
    };

    // Save Lesson card details
    const saveLesson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lessonForm.title || !lessonForm.chapter_id) return;

        setLoading(true);
        const parsedBulletPoints = lessonForm.bullet_points_text
            ? lessonForm.bullet_points_text.split('\n').map(l => l.trim()).filter(Boolean)
            : [];

        if (isUsingFallback) {
            let updatedLess = [...lessons];
            if (editingItem) {
                updatedLess = updatedLess.map(l => l.id === editingItem.id ? { 
                    ...l, 
                    title: lessonForm.title,
                    description: lessonForm.description,
                    lesson_number: lessonForm.lesson_number,
                    material_type: lessonForm.material_type,
                    material_url: lessonForm.material_url,
                    file_name: lessonForm.file_name,
                    file_size: lessonForm.file_size,
                    duration: lessonForm.duration,
                    link_url: lessonForm.link_url,
                    chapter_id: lessonForm.chapter_id,
                    bullet_points: parsedBulletPoints 
                } : l);
            } else {
                const newLesson: CourseLesson = {
                    id: 'less_' + Math.random().toString(36).substring(7),
                    title: lessonForm.title,
                    description: lessonForm.description,
                    lesson_number: lessonForm.lesson_number,
                    material_type: lessonForm.material_type,
                    material_url: lessonForm.material_url,
                    file_name: lessonForm.file_name,
                    file_size: lessonForm.file_size,
                    duration: lessonForm.duration,
                    link_url: lessonForm.link_url,
                    chapter_id: lessonForm.chapter_id,
                    bullet_points: parsedBulletPoints
                };
                updatedLess.push(newLesson);
            }
            persistLocalData(modules, chapters, updatedLess);
            setLoading(false);
            setActiveModal(null);
        } else {
            try {
                if (editingItem) {
                    await supabaseAuth
                        .from('course_lessons')
                        .update({
                            title: lessonForm.title,
                            description: lessonForm.description,
                            lesson_number: lessonForm.lesson_number,
                            material_type: lessonForm.material_type,
                            material_url: lessonForm.material_url,
                            file_name: lessonForm.file_name,
                            file_size: lessonForm.file_size,
                            duration: lessonForm.duration,
                            link_url: lessonForm.link_url,
                            chapter_id: lessonForm.chapter_id,
                            bullet_points: parsedBulletPoints
                        })
                        .eq('id', editingItem.id);
                } else {
                    await supabaseAuth
                        .from('course_lessons')
                        .insert([{
                            id: crypto.randomUUID(),
                            title: lessonForm.title,
                            description: lessonForm.description,
                            lesson_number: lessonForm.lesson_number,
                            material_type: lessonForm.material_type,
                            material_url: lessonForm.material_url,
                            file_name: lessonForm.file_name,
                            file_size: lessonForm.file_size,
                            duration: lessonForm.duration,
                            link_url: lessonForm.link_url,
                            chapter_id: lessonForm.chapter_id,
                            bullet_points: parsedBulletPoints
                        }]);
                }
                await loadDatabaseData();
                setActiveModal(null);
            } catch (err) {
                console.error(err);
                alert('Database update failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Delete Lesson
    const deleteLesson = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this lesson material?')) return;

        setLoading(true);
        if (isUsingFallback) {
            const updatedLess = lessons.filter(l => l.id !== id);
            persistLocalData(modules, chapters, updatedLess);
            setLoading(false);
        } else {
            try {
                await supabaseAuth.from('course_lessons').delete().eq('id', id);
                await loadDatabaseData();
            } catch (err) {
                console.error(err);
                alert('Delete failed.');
            } finally {
                setLoading(false);
            }
        }
    };

    // Trigger Play/View attachment previewer overlay
    const handlePlayPreview = (lesson: CourseLesson, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lesson.material_url) {
            alert('No attachment uploaded for this lesson.');
            return;
        }
        setMediaPreview({
            type: lesson.material_type || 'file',
            url: lesson.material_url,
            title: lesson.title
        });
    };

    // Trigger Simulated Cloud Backup Synchronization
    const triggerBackupSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            setLastSyncedText('Synced just now');
        }, 1500);
    };

    // ── Assign to Students Feature ────────────────────────────────────────────
    // Load teacher's classrooms for the assign modal picker
    const loadAssignClassrooms = async () => {
        if (!teacherProfile) return;
        setAssignClassroomsLoading(true);
        try {
            const { data } = await supabaseAuth
                .from('classrooms')
                .select('id, name')
                .eq('teacher_id', teacherProfile.id);
            const withCounts = await Promise.all((data || []).map(async (room) => {
                const { count } = await supabaseAuth
                    .from('classroom_students')
                    .select('*', { count: 'exact', head: true })
                    .eq('classroom_id', room.id);
                return { ...room, student_count: count || 0 };
            }));
            setAssignClassrooms(withCounts);
            // Auto-select first classroom and pre-load its students
            if (withCounts.length > 0) {
                setAssignSelectedClassroomId(withCounts[0].id);
                await loadAssignClassroomStudents(withCounts[0].id);
            }
        } catch (err) {
            console.error('Failed to load classrooms for assign:', err);
        } finally {
            setAssignClassroomsLoading(false);
        }
    };

    // Load enrolled students of a specific classroom
    const loadAssignClassroomStudents = async (classroomId: string) => {
        setAssignStudentsLoading(true);
        try {
            const { data } = await supabaseAuth
                .from('classroom_students')
                .select('student_id, users!student_id(name)')
                .eq('classroom_id', classroomId);
            setAssignClassroomStudents(
                (data || []).map((r: any) => ({
                    student_id: r.student_id,
                    name: r.users?.name || 'Unknown'
                }))
            );
        } catch (err) {
            console.error('Failed to load students for assign:', err);
        } finally {
            setAssignStudentsLoading(false);
        }
    };

    // Open the Assign modal pre-filled for a Level, Chapter, or Topic
    const openAssignModal = async (refType: 'module' | 'chapter' | 'lesson', refId: string, refTitle: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAssignModal({ refType, refId, refTitle });
        setAssignForm({ targetType: 'all', studentIds: new Set(), dueDate: '', note: '' });
        setAssignSelectedClassroomId('');
        setAssignClassroomStudents([]);
        setAssignClassrooms([]);
        setAssignSuccess(false);
        await loadAssignClassrooms();
    };

    // Handle classroom switch inside assign modal
    const handleAssignClassroomChange = async (classroomId: string) => {
        setAssignSelectedClassroomId(classroomId);
        setAssignForm(prev => ({ ...prev, studentIds: new Set() }));
        await loadAssignClassroomStudents(classroomId);
    };

    // Submit the assignment to Supabase (assignments + assignment_students)
    const submitAssignment = async () => {
        if (!assignModal || !assignSelectedClassroomId || !teacherProfile) return;
        if (assignForm.targetType === 'individual' && assignForm.studentIds.size === 0) return;
        setIsSubmittingAssignment(true);
        try {
            const { data: newAsg, error } = await supabaseAuth
                .from('assignments')
                .insert([{
                    classroom_id: assignSelectedClassroomId,
                    teacher_id: teacherProfile.id,
                    title: assignModal.refTitle,
                    description: assignForm.note.trim() || null,
                    due_date: assignForm.dueDate || null,
                    target_type: assignForm.targetType,
                    inventory_ref_type: assignModal.refType,
                    inventory_ref_id: assignModal.refId,
                    inventory_ref_title: assignModal.refTitle,
                }])
                .select()
                .single();

            if (error) throw error;

            // Insert assignment_students rows for all or selected students
            const studentIds = assignForm.targetType === 'all'
                ? assignClassroomStudents.map(s => s.student_id)
                : Array.from(assignForm.studentIds);

            if (studentIds.length > 0) {
                const { error: asError } = await supabaseAuth
                    .from('assignment_students')
                    .insert(studentIds.map(sid => ({
                        assignment_id: newAsg.id,
                        student_id: sid,
                        status: 'pending',
                    })));
                if (asError) console.warn('Could not insert assignment_students:', asError.message);
            }

            setAssignSuccess(true);
            setTimeout(() => {
                setAssignModal(null);
                setAssignSuccess(false);
            }, 2200);
        } catch (err: any) {
            console.error('Failed to submit assignment:', err);
            alert(`Assignment failed: ${err.message || 'Unknown error. Make sure the SQL migration has been applied in Supabase.'}`);
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    // Computed Info
    const activeModule = modules.find(m => m.id === selectedModuleId);
    const activeModuleParsed = activeModule ? parseModuleCategory(activeModule) : null;
    const activeHeadline = activeModule ? activeModule.title : '';
    const activeBadgeText = (() => {
        if (!activeModuleParsed || !activeModule) return 'ACTIVE CURRICULUM';
        let catText = activeModuleParsed.category;
        if (catText === 'Proficiency Levels') {
            catText = 'ACTIVE CURRICULUM';
        }
        
        let levelText = '';
        if (activeModule.module_number === 1) levelText = 'BEGINNER';
        else if (activeModule.module_number === 2) levelText = 'ELEMENTARY';
        else if (activeModule.module_number === 3) levelText = 'INTERMEDIATE';
        else if (activeModule.module_number === 4) levelText = 'ADVANCED';
        
        if (levelText) {
            return `${catText.toUpperCase()} • ${levelText}`;
        }
        return catText.toUpperCase();
    })();
    const moduleChapters = getModuleChapters(selectedModuleId);

    // Filters based on header search query
    const filteredModules = modules.filter(m => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
    });

    // Group modules dynamically by category prefix in the description
    const groupedModules: Record<string, CourseModule[]> = {};
    filteredModules.forEach(mod => {
        const parsed = parseModuleCategory(mod);
        const category = parsed.category;
        if (!groupedModules[category]) {
            groupedModules[category] = [];
        }
        groupedModules[category].push(mod);
    });

    // Sort categories: "Proficiency Levels" first, "Specialized Modules" second, then others alphabetically
    const sortedCategories = Object.keys(groupedModules).sort((a, b) => {
        if (a === 'Proficiency Levels') return -1;
        if (b === 'Proficiency Levels') return 1;
        if (a === 'Specialized Modules') return -1;
        if (b === 'Specialized Modules') return 1;
        return a.localeCompare(b);
    });

    const getLevelBadge = (levelNum: number, category: string) => {
        if (category !== 'Proficiency Levels') {
            return <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-[10px] text-amber-600 font-extrabold tracking-wide uppercase">{category}</span>;
        }
        switch (levelNum) {
            case 1: return <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-[10px] text-emerald-600 font-extrabold tracking-wide uppercase">Beginner</span>;
            case 2: return <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-[10px] text-amber-600 font-extrabold tracking-wide uppercase">Elementary</span>;
            case 3: return <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/25 rounded-full text-[10px] text-blue-600 font-extrabold tracking-wide uppercase">Intermediate</span>;
            case 4: return <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/25 rounded-full text-[10px] text-purple-600 font-extrabold tracking-wide uppercase">Advanced</span>;
            default: return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-wide uppercase">Level {levelNum}</span>;
        }
    };

    const getLevelIcon = (levelNum: number) => {
        switch (levelNum) {
            case 1: return <Keyboard className="size-5 text-[#d97706]" />;
            case 2: return <Music className="size-5 text-[#d97706]" />;
            case 3: return <Users className="size-5 text-[#d97706]" />;
            case 4: return <Award className="size-5 text-[#d97706]" />;
            default: return <BookOpen className="size-5 text-[#d97706]" />;
        }
    };

    return (
        <div className="flex h-screen bg-[#f8f8f6] dark:bg-[#14120c] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />
            
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <TeacherHeader 
                    title="Curriculum & Inventory Manager" 
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />

                {/* Connection Status Subtitle Bar */}
                <div className="px-8 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-400 select-none shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isUsingFallback ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                        <span>{isUsingFallback ? 'OFFLINE INTERACTIVE MODE (LOCAL FALLBACK)' : 'CONNECTED TO SUPABASE CLOUD DATABASE'}</span>
                    </div>
                    <div>
                        <span>LEVELS: 04 • CHAPTERS: {chapters.length} • MATERIALS: {lessons.length}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-3" />
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest animate-pulse">Loading Academy Curriculum...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                        
                        {/* ==================== VIEW A: LANDING SCREEN ==================== */}
                        {currentView === 'landing' && (
                            <div className="space-y-8 animate-fadeIn">
                                
                                {/* Landing Premium Header Banner */}
                                <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white relative overflow-hidden shadow-md border border-slate-800">
                                    <div className="absolute right-0 top-0 opacity-10 select-none pointer-events-none">
                                        <Sparkles className="w-72 h-72 text-amber-500 animate-pulse" />
                                    </div>
                                    <div className="max-w-2xl relative z-10 space-y-2 text-left">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-xs text-amber-400 font-extrabold tracking-wide uppercase leading-none">
                                            <Sparkles className="size-3.5" />
                                            <span>Curriculum Academy</span>
                                        </div>
                                        <h1 className="text-2xl md:text-3.5xl font-black tracking-tight leading-none bg-gradient-to-r from-white via-slate-100 to-amber-400 bg-clip-text text-transparent">
                                            Music Curriculum Library
                                        </h1>
                                        <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed max-w-xl">
                                            Select a Proficiency Level to inspect topics, play guide audios, or edit checklist requirements.
                                        </p>
                                    </div>
                                </div>
                                
                                {/* DYNAMIC HEADLINE CATEGORIES GRID */}
                                {sortedCategories.map((category) => (
                                    <div key={category} className="space-y-4 text-left">
                                        <div className="flex items-center justify-between select-none border-b border-slate-200 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-4 bg-[#ecb613] rounded-full" />
                                                <h2 className="font-extrabold text-xs md:text-sm tracking-wider uppercase text-slate-700 dark:text-slate-300">{category}</h2>
                                                <button
                                                    onClick={(e) => openCategoryRenameModal(category, e)}
                                                    className="p-1 text-slate-400 hover:text-[#ecb613] rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all ml-1"
                                                    title="Rename Headline"
                                                >
                                                    <Edit2 className="size-3.5" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => openModuleModal(undefined, category)}
                                                className="inline-flex items-center gap-1 text-[10px] font-black text-[#ecb613] hover:text-amber-600 dark:hover:text-amber-400 uppercase tracking-widest leading-none border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 px-3 py-1.5 rounded-full transition-all"
                                            >
                                                <Plus className="size-3" />
                                                <span>Add Level / Module</span>
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {groupedModules[category].map((mod, idx) => {
                                                const parsed = parseModuleCategory(mod);
                                                const chapsInMod = getModuleChapters(mod.id);
                                                const totalResources = chapsInMod.reduce((sum, c) => sum + getChapterLessons(c.id).length, 0);
                                                const displayIdx = category === 'Proficiency Levels' ? mod.module_number : idx + 1;

                                                return (
                                                    <div
                                                        key={mod.id}
                                                        onClick={() => handleSelectModule(mod.id)}
                                                        className="group relative rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 cursor-pointer shadow-xs hover:shadow-lg hover:border-amber-400 dark:hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between min-h-[220px] overflow-hidden select-none text-left"
                                                    >
                                                        {/* Giant semi-transparent floating background number behind card */}
                                                        <div className="absolute right-4 bottom-2 text-7xl md:text-8xl font-black text-slate-100 dark:text-slate-800/20 pointer-events-none transition-transform duration-500 group-hover:scale-125 group-hover:text-amber-500/10 font-mono">
                                                            {displayIdx}
                                                        </div>

                                                        {/* Top action buttons (Assign, Edit and Delete) */}
                                                        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={(e) => openAssignModal('module', mod.id, mod.title, e)}
                                                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-500 text-slate-800 dark:text-white hover:text-white rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                                                                title="Assign Level to Students"
                                                            >
                                                                <UserCheck className="size-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => openModuleModal(mod, category, e)}
                                                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-[#ecb613] text-slate-800 dark:text-white hover:text-slate-950 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                                                                title="Edit Module"
                                                            >
                                                                <Edit2 className="size-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => deleteModule(mod.id, e)}
                                                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 text-slate-800 dark:text-white hover:text-slate-950 rounded-lg transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                                                                title="Delete Module"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        </div>

                                                        {/* Level card top row */}
                                                        <div className="relative z-10 space-y-3">
                                                            <div className="flex justify-between items-start">
                                                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10 shrink-0">
                                                                    {getLevelIcon(mod.module_number)}
                                                                </div>
                                                                {getLevelBadge(mod.module_number, category)}
                                                            </div>
                                                            
                                                            <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight group-hover:text-[#ecb613] transition-colors font-sans">
                                                                {mod.title}
                                                            </h3>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm line-clamp-3">
                                                                {parsed.description}
                                                            </p>
                                                        </div>

                                                        {/* Level card bottom stats */}
                                                        <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/60 pt-4 flex items-center gap-4 text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                                                            <div>
                                                                <span className="text-slate-900 dark:text-white font-black text-xs mr-0.5">{chapsInMod.length}</span>
                                                                Chapters
                                                            </div>
                                                            <div className="w-px h-3 bg-slate-200 dark:bg-slate-800" />
                                                            <div>
                                                                <span className="text-slate-900 dark:text-white font-black text-xs mr-0.5">{totalResources}</span>
                                                                Resources
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ==================== VIEW B: CURRICULUM WORKSPACE SCREEN ==================== */}
                        {currentView === 'dashboard' && (
                            <div className="flex flex-col xl:flex-row gap-8 items-start animate-fadeIn">
                                
                                {/* Left/Middle 2/3 Column: Chapter Collapsible accordions stack & Module Header info */}
                                <div className="flex-1 w-full space-y-6">
                                    
                                    {/* Breadcrumb Navigation button */}
                                    <div className="flex items-center select-none">
                                        <button
                                            onClick={() => setCurrentView('landing')}
                                            className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-white transition-all uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 rounded-full shadow-xs"
                                        >
                                            <ArrowLeft className="size-3.5 stroke-[2.5]" />
                                            <span>Back to Modules</span>
                                        </button>
                                    </div>

                                    {/* High-fidelity Premium Green, White, and Red Header Card matching the brand tip queue */}
                                    {activeModule && (
                                        <div className="rounded-3xl p-6 md:p-8 bg-[#0d5257] border border-[#0b4347] relative overflow-hidden shadow-lg select-none text-left">
                                            {/* Decorative floating icon */}
                                            <div className="absolute right-4 top-4 opacity-[0.06] select-none pointer-events-none">
                                                <Database className="w-64 h-64 text-white animate-pulse" />
                                            </div>
                                            <div className="max-w-2xl relative z-10 space-y-3">
                                                <div className="flex justify-between items-center gap-4 select-none">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ef4444] rounded-full text-[9px] text-white font-black tracking-widest uppercase leading-none shadow-sm">
                                                        <Sparkles className="size-3" />
                                                        <span>{activeBadgeText}</span>
                                                    </div>
                                                </div>
                                                <h1 className="text-2xl md:text-3.5xl font-black tracking-tight leading-none text-white font-sans drop-shadow-sm">
                                                    {activeHeadline}
                                                </h1>
                                                <p className="text-xs md:text-sm text-teal-50/90 font-medium leading-relaxed max-w-xl">
                                                    {activeModuleParsed?.description}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section bar with quick Add Chapter button */}
                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 select-none">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-[#ecb613] rounded-full" />
                                            <h2 className="font-extrabold text-xs tracking-wider uppercase text-slate-700 dark:text-slate-350">Collapsible Chapter curriculum</h2>
                                        </div>
                                        <button 
                                            onClick={() => openChapterModal()}
                                            className="inline-flex items-center gap-1.5 text-[10px] font-black bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 px-4 py-2.5 rounded-full transition-all uppercase tracking-wider active:scale-95 shadow-md shadow-[#ecb613]/10"
                                        >
                                            <Plus className="size-3.5 stroke-[2.5]" />
                                            <span>Add New Chapter</span>
                                        </button>
                                    </div>

                                    {/* Collapsible Accordion Chapter stack */}
                                    <div className="space-y-4">
                                        {moduleChapters.length === 0 ? (
                                            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl text-slate-400">
                                                <Sparkles className="size-10 text-amber-500 stroke-[1.2] mx-auto mb-2 opacity-50" />
                                                <p className="text-xs font-semibold">No chapters found for this Level.</p>
                                            </div>
                                        ) : (
                                            moduleChapters.map(chap => {
                                                const expanded = !!expandedChapters[chap.id];
                                                const chapLessons = getChapterLessons(chap.id);
                                                
                                                return (
                                                    <div 
                                                        key={chap.id}
                                                        className="rounded-3xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:border-slate-350 dark:hover:border-slate-750 transition-all duration-300"
                                                    >
                                                        {/* Chapter Accordion Header bar */}
                                                        <div 
                                                            onClick={() => toggleChapterExpand(chap.id)}
                                                            className="px-6 py-5 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-950/30 flex items-center justify-between gap-4 cursor-pointer select-none transition-all"
                                                        >
                                                            <div className="flex items-center gap-4 text-left">
                                                                <div className="w-10 h-10 rounded-xl bg-[#ecb613]/10 border border-[#ecb613]/25 flex items-center justify-center shrink-0">
                                                                    <span className="font-extrabold text-xs font-mono text-[#d97706] dark:text-[#ecb613]">Ch{chap.chapter_number}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none font-mono mb-1.5 block">
                                                                        {chapLessons.length} {chapLessons.length === 1 ? 'TOPIC' : 'TOPICS'} AVAILABLE
                                                                    </span>
                                                                    <h3 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white leading-tight">
                                                                        {chap.title}
                                                                    </h3>
                                                                </div>
                                                            </div>

                                                            {/* Chapter Actions and chevron */}
                                                            <div className="flex items-center gap-4 shrink-0">
                                                                <div className="flex items-center gap-1">
                                                                    <button 
                                                                        onClick={(e) => openAssignModal('chapter', chap.id, chap.title, e)}
                                                                        className="p-2 hover:bg-blue-500/10 rounded-lg text-slate-400 hover:text-blue-500 transition-all"
                                                                        title="Assign Chapter to Students"
                                                                    >
                                                                        <UserCheck className="size-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => openChapterModal(chap, e)}
                                                                        className="p-2 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-[#ecb613] transition-all"
                                                                        title="Edit Chapter Introduction"
                                                                    >
                                                                        <Edit2 className="size-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); deleteChapter(chap.id, e); }}
                                                                        className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                                                                        title="Delete Chapter"
                                                                    >
                                                                        <Trash2 className="size-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="text-slate-400">
                                                                    {expanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Chapter Accordion Expanded Content body */}
                                                        {expanded && (
                                                            <div className="p-6 border-t border-slate-100 dark:border-slate-800/80 space-y-6">
                                                                
                                                                {/* Chapter heads-up introduction summary */}
                                                                {chap.description && (
                                                                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed text-left space-y-2">
                                                                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest leading-none font-mono mb-2">
                                                                            Chapter Heads Up / Introduction Overview
                                                                        </div>
                                                                        {chap.description.split('\n').map((line, idx) => (
                                                                            <div key={idx} className={line.startsWith('•') || line.startsWith('*') ? 'pl-4 py-0.5 relative' : 'font-extrabold text-slate-800 dark:text-slate-200 mb-1'}>
                                                                                {(line.startsWith('•') || line.startsWith('*')) && <span className="absolute left-1 text-amber-500">•</span>}
                                                                                {line.replace(/^(\*|•)\s*/, '')}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Action bar inside chapter to add new topics instantly */}
                                                                <div className="flex items-center justify-between select-none">
                                                                    <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                                                                        TOPICS LIST ({chapLessons.length})
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => openLessonModal(chap.id, undefined, e)}
                                                                        className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-[#ecb613] hover:bg-amber-500 text-slate-950 px-3 py-1.5 rounded-full transition-all uppercase tracking-wider active:scale-95 shadow-sm"
                                                                    >
                                                                        <PlusCircle className="size-3.5" />
                                                                        <span>Add Material Card</span>
                                                                    </button>
                                                                </div>

                                                                {/* Chapter topics simple cards rendering */}
                                                                {chapLessons.length === 0 ? (
                                                                    <div className="py-8 text-center text-slate-400 border border-slate-100 dark:border-slate-800 rounded-2xl">
                                                                        <HelpCircle className="size-8 stroke-[1.2] mx-auto mb-2 opacity-50" />
                                                                        <p className="text-xs font-semibold">No materials created yet for this chapter.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-left">
                                                                        {chapLessons.map(lesson => {
                                                                            const isLinkClickable = !!lesson.link_url;
                                                                            const hasAttachment = !!lesson.material_url;
                                                                            
                                                                            return (
                                                                                <div 
                                                                                    key={lesson.id}
                                                                                    onClick={() => setSelectedLessonPreview(lesson)}
                                                                                    className="rounded-2xl p-5 border flex flex-col justify-between h-44 relative bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-850 hover:border-amber-400/60 dark:hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer"
                                                                                >
                                                                                    {/* Card Upper Title & actions */}
                                                                                    <div className="space-y-1.5">
                                                                                        <div className="flex items-center justify-between gap-4 select-none">
                                                                                            <div className="flex items-center gap-2">
                                                                                                {getMaterialIcon(lesson.material_type, hasAttachment)}
                                                                                                <span className="text-[10px] font-extrabold text-[#d97706] dark:text-amber-400 uppercase tracking-widest font-mono">
                                                                                                    Topic {lesson.lesson_number}
                                                                                                </span>
                                                                                            </div>
                                                                                            
                                                                                            <div className="flex items-center gap-1 shrink-0 relative z-20">
                                                                                                <button 
                                                                                                    onClick={(e) => openAssignModal('lesson', lesson.id, lesson.title, e)}
                                                                                                    className="p-1.5 hover:bg-blue-500/10 rounded-lg text-slate-400 hover:text-blue-500 transition-all"
                                                                                                    title="Assign Topic to Students"
                                                                                                >
                                                                                                    <UserCheck className="size-3.5" />
                                                                                                </button>
                                                                                                <button 
                                                                                                    onClick={(e) => openLessonModal(chap.id, lesson, e)}
                                                                                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-500 transition-all font-semibold"
                                                                                                    title="Edit Topic Details"
                                                                                                >
                                                                                                    <Edit2 className="size-3.5" />
                                                                                                </button>
                                                                                                <button 
                                                                                                    onClick={(e) => { e.stopPropagation(); deleteLesson(lesson.id, e); }}
                                                                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                                                                                                    title="Delete Topic"
                                                                                                >
                                                                                                    <Trash2 className="size-3.5" />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                        
                                                                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug line-clamp-1">
                                                                                            {lesson.title}
                                                                                        </h4>
                                                                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 font-medium leading-normal">
                                                                                            {lesson.description}
                                                                                        </p>
                                                                                    </div>

                                                                                    {/* Card Bottom detail line & link */}
                                                                                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 select-none">
                                                                                        <div className="text-[10px] font-bold font-mono text-slate-400">
                                                                                            {hasAttachment 
                                                                                                ? (lesson.duration || 'FILE ATTACHMENT') 
                                                                                                : (lesson.link_url ? 'LINK REFERENCE' : 'TOPIC REFERENCE')}
                                                                                        </div>
                                                                                        
                                                                                        {isLinkClickable && (
                                                                                            <a
                                                                                                href={lesson.link_url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                onClick={(e) => e.stopPropagation()}
                                                                                                className="inline-flex items-center gap-1 text-[10px] font-black text-amber-500 hover:text-amber-600 bg-amber-500/10 px-2.5 py-1.5 rounded-full tracking-wider uppercase transition-all relative z-10"
                                                                                                title="Open external link"
                                                                                            >
                                                                                                <span>Link</span>
                                                                                                <ExternalLink className="size-2.5" />
                                                                                            </a>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                            </div>
                                                        )}

                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                </div>

                                {/* Right 1/3 Column: 3 High-fidelity visual Quick Access widgets */}
                                <div className="w-full xl:w-[340px] shrink-0 space-y-6 select-none">
                                    
                                    {/* Chapter metrics bar header */}
                                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                        <Zap className="size-4 text-[#ecb613]" />
                                        <h3 className="font-extrabold text-[10px] tracking-widest uppercase text-slate-400">Quick Access Tools</h3>
                                    </div>

                                    {/* WIDGET A: STUDENT PROGRESS TRACKER (Animated SVG circular progress wheel) */}
                                    <div className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-left relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider leading-none">Simulated Progress</span>
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight mt-2">Active Class Completion</h4>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 my-3">
                                            {/* Beautiful Circular Progress Wheel */}
                                            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                                                <svg className="w-20 h-20 transform -rotate-90">
                                                    <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="6" fill="transparent" />
                                                    <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-[#ecb613]" strokeWidth="6" fill="transparent"
                                                            strokeDasharray={2 * Math.PI * 32}
                                                            strokeDashoffset={2 * Math.PI * 32 * (1 - 0.78)} />
                                                </svg>
                                                <div className="absolute font-black text-sm text-slate-900 dark:text-white leading-none font-mono">78%</div>
                                            </div>
                                            <div className="text-left space-y-1">
                                                <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">Completion Rate</div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-medium">
                                                    Students have mastered 24 out of 30 sequential curriculum requirements.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono">
                                            <span>ACTIVE STUDENTS: 14</span>
                                            <span className="text-[#ecb613]">VIEW CLASS</span>
                                        </div>
                                    </div>

                                    {/* WIDGET B: RESOURCE BACKUP SINKER */}
                                    <div className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-left relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full uppercase tracking-wider leading-none">Cloud Backup Status</span>
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight mt-2">Supabase Sync Engine</h4>
                                        </div>

                                        <div className="my-2 space-y-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/10 shrink-0">
                                                    <RefreshCw className={`size-4 text-blue-500 ${isSyncing ? 'animate-spin' : ''}`} />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 font-mono leading-none">{lastSyncedText}</div>
                                                    <div className="text-[9px] font-semibold text-slate-400 mt-0.5">30 Active curriculum nodes active</div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={triggerBackupSync}
                                                disabled={isSyncing}
                                                className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-extrabold rounded-xl border border-slate-200 dark:border-slate-750 transition-all active:scale-98 flex items-center justify-center gap-2 text-xs leading-none"
                                            >
                                                {isSyncing ? (
                                                    <>
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                        <span>Syncing Storage...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="size-3.5" />
                                                        <span>Sync to Cloud Database</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono leading-none">
                                            <span>DB SIZE: 1.2MB</span>
                                            <span className="text-emerald-500 uppercase font-black tracking-wide leading-none">SECURE</span>
                                        </div>
                                    </div>

                                    {/* WIDGET C: QUICK STATS */}
                                    <div className="rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-left relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-full uppercase tracking-wider leading-none">Numerical Summaries</span>
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight mt-2">Active Level stats</h4>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 my-2 text-left">
                                            <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-850">
                                                <div className="text-lg font-black font-mono leading-none">{String(modules.length).padStart(2, '0')}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Levels</div>
                                            </div>
                                            <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-850">
                                                <div className="text-lg font-black font-mono leading-none">{String(chapters.length).padStart(2, '0')}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Chapters</div>
                                            </div>
                                            <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-850">
                                                <div className="text-lg font-black font-mono leading-none">{String(lessons.length).padStart(2, '0')}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Topics</div>
                                            </div>
                                            <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-850">
                                                <div className="text-lg font-black font-mono text-emerald-500 leading-none">Active</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status</div>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 flex items-center justify-between text-[10px] font-bold text-slate-400 font-mono leading-none">
                                            <span>TEACHER: MAESTRO</span>
                                            <span className="text-[#ecb613] uppercase font-black tracking-wide leading-none">ADMIN</span>
                                        </div>
                                    </div>

                                </div>

                            </div>
                        )}

                    </div>
                )}

                {/* ==================== MODAL OVERLAYS ==================== */}

                {/* 0. MODULE EDIT / ADD MODAL */}
                {activeModal === 'module' && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-scaleIn text-slate-900 dark:text-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-base font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none font-sans">
                                    {editingItem ? 'Edit Level / Module' : 'Create Level / Module'}
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all">
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={saveModule} className="space-y-4 text-left">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-mono">
                                        Level / Module Title
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold"
                                        placeholder="e.g. Level 5 - Professional Master"
                                        value={moduleForm.title}
                                        onChange={e => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-mono">
                                        Headline / Category Name
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold mb-1.5"
                                        placeholder="e.g. Proficiency Levels, Specialized Modules, Composition Modules"
                                        value={moduleForm.category}
                                        onChange={e => setModuleForm(prev => ({ ...prev, category: e.target.value }))}
                                    />
                                    {/* Quick Select Tags */}
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {Object.keys(groupedModules).map(catName => (
                                            <button
                                                key={catName}
                                                type="button"
                                                onClick={() => setModuleForm(prev => ({ ...prev, category: catName }))}
                                                className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
                                                    moduleForm.category === catName
                                                        ? 'bg-amber-500/15 border-amber-500 text-[#d97706]'
                                                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                {catName}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-mono">
                                        Module Description
                                    </label>
                                    <textarea 
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-medium leading-relaxed"
                                        placeholder="Brief foundation summary or composition focus details..."
                                        value={moduleForm.description}
                                        onChange={e => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-mono">
                                        Order Rank Number (module_number)
                                    </label>
                                    <input 
                                        type="number" 
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold"
                                        placeholder="e.g. 5 or 105"
                                        value={moduleForm.module_number}
                                        onChange={e => setModuleForm(prev => ({ ...prev, module_number: Number(e.target.value) }))}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-98 text-xs tracking-wider uppercase leading-none"
                                >
                                    {editingItem ? 'Save Updates' : 'Add Module'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 0.1 CATEGORY RENAME MODAL */}
                {activeModal === 'category' && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scaleIn text-slate-900 dark:text-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-base font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none font-sans">
                                    Rename Headline Category
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all">
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={saveCategoryRename} className="space-y-4 text-left">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none font-mono">
                                        Headline Title Name
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold"
                                        placeholder="e.g. Proficiency Levels"
                                        value={categoryForm.newName}
                                        onChange={e => setCategoryForm(prev => ({ ...prev, newName: e.target.value }))}
                                    />
                                    <p className="text-[10px] font-medium text-slate-450 leading-relaxed dark:text-slate-400 mt-1">
                                        * Note: This will rename the headline grouping for all levels and modules currently placed under <span className="font-bold text-[#d97706]">"{categoryForm.oldName}"</span>.
                                    </p>
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-98 text-xs tracking-wider uppercase leading-none font-sans"
                                >
                                    Rename Headline
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 1. CHAPTER EDIT MODAL */}
                {activeModal === 'chapter' && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-scaleIn text-slate-900 dark:text-slate-100 space-y-4">
                            <div className="flex justify-between items-center select-none">
                                <h3 className="text-base font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
                                    {editingItem ? 'Edit Chapter Heads Up' : 'Add New Chapter'}
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all">
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={saveChapter} className="space-y-4 text-left">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        Chapter Title / Headline
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold"
                                        placeholder="e.g. Chapter 1 - Introduction to Flute"
                                        value={chapterForm.title}
                                        onChange={e => setChapterForm(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        Chapter Heads Up / Introduction Bullets
                                    </label>
                                    <textarea 
                                        rows={6}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-medium leading-relaxed"
                                        placeholder="What is the Flute?&#10;• Introduction to the Indian bamboo flute&#10;• Importance of flute in Indian music"
                                        value={chapterForm.description}
                                        onChange={e => setChapterForm(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-98 text-xs tracking-wider uppercase leading-none"
                                >
                                    {editingItem ? 'Save Updates' : 'Add Chapter'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 2. SIMPLE TOPIC LESSON CARD EDIT MODAL (Headline, Description, Attachment upload, Link) */}
                {activeModal === 'lesson' && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-scaleIn text-slate-900 dark:text-slate-100 space-y-4">
                            <div className="flex justify-between items-center select-none">
                                <h3 className="text-base font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
                                    {editingItem ? 'Edit Topic Material' : 'Add Topic Material'}
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all">
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            <form onSubmit={saveLesson} className="space-y-4 text-left">
                                
                                {/* Field 1: Headline */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        1. Headline (Title)
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold"
                                        placeholder="e.g. Rhythm Practice Patterns"
                                        value={lessonForm.title}
                                        onChange={e => setLessonForm(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>

                                {/* Field 2: Description */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        2. Description
                                    </label>
                                    <textarea 
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-medium leading-relaxed"
                                        placeholder="Using 4/4 rhythm with metronome."
                                        value={lessonForm.description}
                                        onChange={e => setLessonForm(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                {/* Field 3: Attachment Uploader (File, Image, PDF, Audio, or Video) */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        3. Attachment Upload (PDF, Audio, Video, Image, File)
                                    </label>
                                    
                                    <div className="flex items-center gap-3">
                                        <label className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-slate-350 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-950/20 transition-all select-none">
                                            <UploadCloud className="size-6 text-slate-400 mb-1" />
                                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Select Attachment File</span>
                                            <input 
                                                type="file" 
                                                className="hidden"
                                                accept=".pdf,audio/*,video/*,image/*"
                                                onChange={handleFileUpload}
                                            />
                                        </label>
                                    </div>

                                    {uploadProgress !== null && (
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-[#ecb613] h-1.5 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                        </div>
                                    )}

                                    {lessonForm.material_url && (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 text-[10px] font-bold font-mono text-slate-400 select-all">
                                            <span className="truncate pr-4 leading-none">{lessonForm.file_name || lessonForm.material_url}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setLessonForm(prev => ({ ...prev, material_url: '', file_name: '', file_size: '', duration: '', material_type: 'file' }))}
                                                className="p-1 hover:bg-red-500/10 rounded-lg text-red-500 transition-all shrink-0"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Field 4: Clickable Link */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        4. Clickable Link (URL)
                                    </label>
                                    <div className="relative">
                                        <Globe className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input 
                                            type="url" 
                                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold"
                                            placeholder="https://example.com/practice-routine"
                                            value={lessonForm.link_url}
                                            onChange={e => setLessonForm(prev => ({ ...prev, link_url: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Field 5: Learning Checklist */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                        5. Learning Checklist Requirements (One per line)
                                    </label>
                                    <textarea 
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-medium leading-relaxed font-sans"
                                        placeholder="e.g.&#10;Structure of the bamboo flute&#10;Blowing hole and finger holes&#10;How sound is produced"
                                        value={lessonForm.bullet_points_text}
                                        onChange={e => setLessonForm(prev => ({ ...prev, bullet_points_text: e.target.value }))}
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-98 text-xs tracking-wider uppercase leading-none"
                                >
                                    {editingItem ? 'Save Updates' : 'Add Material'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 3. INTERACTIVE MEDIA PREVIEWER OVERLAY */}
                {mediaPreview && (
                    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl text-white space-y-4 animate-scaleIn">
                            <div className="flex justify-between items-center select-none">
                                <h4 className="font-extrabold text-sm tracking-wide truncate pr-4 uppercase text-amber-500 font-mono">
                                    Previewing: {mediaPreview.title}
                                </h4>
                                <button 
                                    onClick={() => setMediaPreview(null)} 
                                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                            
                            {/* Interactive Media Frame */}
                            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                                {mediaPreview.type === 'video' ? (
                                    <video src={mediaPreview.url} controls className="w-full h-full object-contain" autoPlay />
                                ) : mediaPreview.type === 'audio' ? (
                                    <div className="w-full p-8 flex flex-col items-center justify-center gap-4 bg-slate-950/40 h-full">
                                        <Music className="size-16 text-amber-500 animate-pulse" />
                                        <audio src={mediaPreview.url} controls className="w-full max-w-md" autoPlay />
                                    </div>
                                ) : mediaPreview.type === 'pdf' ? (
                                    <embed src={mediaPreview.url} type="application/pdf" className="w-full h-full" />
                                ) : mediaPreview.type === 'image' ? (
                                    <img src={mediaPreview.url} alt={mediaPreview.title} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center p-8 space-y-4">
                                        <FileText className="size-16 text-slate-600 mx-auto" />
                                        <p className="text-xs text-slate-400 max-w-sm">No interactive simulation available for generic files. Open details below:</p>
                                        <a 
                                            href={mediaPreview.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-full text-xs transition-all uppercase tracking-wider"
                                        >
                                            <span>Open File Attachment</span>
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. PREMIUM TOPIC CARD DETAILED POPUP MODAL */}
                {selectedLessonPreview && (
                    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-6 text-left animate-scaleIn select-none max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-600 dark:text-amber-400 font-extrabold tracking-wide uppercase leading-none">
                                        {getMaterialIcon(selectedLessonPreview.material_type, !!selectedLessonPreview.material_url)}
                                        <span>Topic {selectedLessonPreview.lesson_number} {selectedLessonPreview.material_url ? `• ${selectedLessonPreview.material_type?.toUpperCase()}` : ''}</span>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight font-sans">
                                        {selectedLessonPreview.title}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => setSelectedLessonPreview(null)} 
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            {/* Description Section */}
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none font-mono">Overview & Description</h4>
                                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                    {selectedLessonPreview.description}
                                </p>
                            </div>

                            {/* Bullet Points Requirements (Checklist/Key details) */}
                            {selectedLessonPreview.bullet_points && selectedLessonPreview.bullet_points.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none font-mono">Learning checklist requirements</h4>
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-850/60 space-y-2.5">
                                        {selectedLessonPreview.bullet_points.map((point, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-semibold leading-normal">
                                                <span className="w-4 h-4 rounded bg-amber-500/10 border border-amber-500/20 text-[#d97706] flex items-center justify-center shrink-0 mt-0.5">
                                                    ✓
                                                </span>
                                                <span>{point}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Attachment Details pill / row */}
                            {selectedLessonPreview.material_url && (
                                <div className="flex flex-wrap items-center gap-3 select-none text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider">
                                    {selectedLessonPreview.duration && (
                                        <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300">
                                            {selectedLessonPreview.duration}
                                        </span>
                                    )}
                                    {selectedLessonPreview.file_name && (
                                        <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                                            📁 {selectedLessonPreview.file_name}
                                        </span>
                                    )}
                                    {selectedLessonPreview.file_size && (
                                        <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300">
                                            💾 {selectedLessonPreview.file_size}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {selectedLessonPreview.material_url && (
                                    <button 
                                        onClick={(e) => {
                                            setSelectedLessonPreview(null);
                                            handlePlayPreview(selectedLessonPreview, e);
                                        }}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 hover:text-white font-black rounded-2xl shadow-md transition-all active:scale-98 text-xs tracking-wider uppercase leading-none inline-flex items-center justify-center gap-1.5"
                                    >
                                        <Play className="size-4 fill-current" />
                                        <span>View Attachment</span>
                                    </button>
                                )}
                                
                                {selectedLessonPreview.link_url && (
                                    <a 
                                        href={selectedLessonPreview.link_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-[#d97706] font-black rounded-2xl border border-amber-500/20 shadow-xs transition-all active:scale-98 text-xs tracking-wider uppercase leading-none inline-flex items-center justify-center gap-1.5"
                                    >
                                        <ExternalLink className="size-4" />
                                        <span>Open Link</span>
                                    </a>
                                )}
                                
                                <button 
                                    onClick={(e) => {
                                        setSelectedLessonPreview(null);
                                        openLessonModal(selectedLessonPreview.chapter_id, selectedLessonPreview, e);
                                    }}
                                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-[#ecb613] hover:text-slate-950 text-slate-800 dark:text-slate-200 font-black rounded-2xl shadow-xs border border-slate-250 dark:border-slate-700 transition-all active:scale-98 text-xs tracking-wider uppercase leading-none inline-flex items-center justify-center gap-1.5"
                                >
                                    <Edit2 className="size-4" />
                                    <span>Edit Details</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== ASSIGN TO STUDENTS SLIDE-OVER PANEL ==================== */}
                {assignModal && (
                    <div
                        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-stretch justify-end"
                        onClick={() => setAssignModal(null)}
                    >
                        <div
                            className="bg-white dark:bg-slate-900 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-none p-6 w-full sm:max-w-[420px] shadow-2xl text-slate-900 dark:text-slate-100 flex flex-col gap-5 max-h-[94vh] sm:max-h-screen sm:h-screen overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Panel Header */}
                            <div className="flex justify-between items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                                <div className="space-y-1.5">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase leading-none ${
                                        assignModal.refType === 'module'
                                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                            : assignModal.refType === 'chapter'
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    }`}>
                                        <ClipboardList className="size-3" />
                                        <span>
                                            {assignModal.refType === 'module' ? 'Assign Level'
                                                : assignModal.refType === 'chapter' ? 'Assign Chapter'
                                                : 'Assign Topic'}
                                        </span>
                                    </span>
                                    <h3 className="font-black text-base text-slate-900 dark:text-white leading-snug max-w-[300px]">
                                        {assignModal.refTitle}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setAssignModal(null)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all shrink-0"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            {assignSuccess ? (
                                /* ── Success State ── */
                                <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center py-8">
                                    <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center">
                                        <CheckCircle className="size-12 text-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-black text-xl text-slate-900 dark:text-white">Assigned!</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                                            Content is now visible in the{' '}
                                            <span className="font-bold text-amber-500">Assignments tab</span>{' '}
                                            of the selected classroom.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* ── Step 1: Classroom Picker ── */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                            1. Select Classroom
                                        </label>
                                        {assignClassroomsLoading ? (
                                            <div className="flex items-center gap-2 py-3">
                                                <Loader2 className="size-4 animate-spin text-amber-500" />
                                                <span className="text-xs text-slate-400">Loading classrooms...</span>
                                            </div>
                                        ) : assignClassrooms.length === 0 ? (
                                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                                <Users className="size-8 mx-auto text-slate-300 dark:text-slate-600" />
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No classrooms found.</p>
                                                <p className="text-[10px] text-slate-400">Create a classroom first to assign content.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {assignClassrooms.map(room => (
                                                    <button
                                                        key={room.id}
                                                        type="button"
                                                        onClick={() => handleAssignClassroomChange(room.id)}
                                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all text-left ${
                                                            assignSelectedClassroomId === room.id
                                                                ? 'bg-amber-500/10 border-amber-500/50'
                                                                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 hover:border-amber-400/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                                assignSelectedClassroomId === room.id ? 'bg-amber-500/20' : 'bg-slate-100 dark:bg-slate-800'
                                                            }`}>
                                                                <Users className="size-4 text-amber-500" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">{room.name}</p>
                                                                <p className="text-[10px] text-slate-400 mt-1 font-mono">{room.student_count} students enrolled</p>
                                                            </div>
                                                        </div>
                                                        {assignSelectedClassroomId === room.id && (
                                                            <CheckCircle className="size-5 text-amber-500 shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {assignSelectedClassroomId && (
                                        <>
                                            {/* ── Step 2: Target Selector ── */}
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                    2. Assign To
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAssignForm(prev => ({ ...prev, targetType: 'all', studentIds: new Set() }))}
                                                        className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all ${
                                                            assignForm.targetType === 'all'
                                                                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400'
                                                                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-700 hover:border-amber-400/50 text-slate-500 dark:text-slate-400'
                                                        }`}
                                                    >
                                                        <Users className="size-6" />
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-wide leading-none">Entire Class</p>
                                                            <p className="text-[9px] text-slate-400 mt-1">All students</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAssignForm(prev => ({ ...prev, targetType: 'individual' }))}
                                                        className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all ${
                                                            assignForm.targetType === 'individual'
                                                                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400'
                                                                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-700 hover:border-amber-400/50 text-slate-500 dark:text-slate-400'
                                                        }`}
                                                    >
                                                        <UserCheck className="size-6" />
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-black uppercase tracking-wide leading-none">Individual</p>
                                                            <p className="text-[9px] text-slate-400 mt-1">Pick students</p>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* ── Individual Student Picker ── */}
                                            {assignForm.targetType === 'individual' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                            Select Students
                                                        </label>
                                                        {assignForm.studentIds.size > 0 && (
                                                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 leading-none">
                                                                {assignForm.studentIds.size} selected
                                                            </span>
                                                        )}
                                                    </div>
                                                    {assignStudentsLoading ? (
                                                        <div className="flex items-center gap-2 py-3">
                                                            <Loader2 className="size-4 animate-spin text-amber-500" />
                                                            <span className="text-xs text-slate-400">Loading students...</span>
                                                        </div>
                                                    ) : assignClassroomStudents.length === 0 ? (
                                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">No students enrolled in this classroom.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                                            {assignClassroomStudents.map(student => {
                                                                const isSelected = assignForm.studentIds.has(student.student_id);
                                                                return (
                                                                    <button
                                                                        key={student.student_id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newIds = new Set(assignForm.studentIds);
                                                                            if (isSelected) newIds.delete(student.student_id);
                                                                            else newIds.add(student.student_id);
                                                                            setAssignForm(prev => ({ ...prev, studentIds: newIds }));
                                                                        }}
                                                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                                                                            isSelected
                                                                                ? 'bg-amber-500/10 border-amber-500/40'
                                                                                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 hover:border-amber-400/40'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[11px] font-black shrink-0 select-none">
                                                                                {student.name.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <span className="text-xs font-semibold text-slate-900 dark:text-white">{student.name}</span>
                                                                        </div>
                                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                                                            isSelected
                                                                                ? 'bg-amber-500 border-amber-500'
                                                                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                                                        }`}>
                                                                            {isSelected && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── Step 3: Due Date ── */}
                                            <div className="space-y-1.5">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                    3. Due Date{' '}
                                                    <span className="text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">— optional</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-semibold text-slate-700 dark:text-slate-200"
                                                    value={assignForm.dueDate}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    onChange={e => setAssignForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                                />
                                            </div>

                                            {/* ── Step 4: Instructions ── */}
                                            <div className="space-y-1.5">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                    4. Instructions{' '}
                                                    <span className="text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">— optional</span>
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#ecb613] outline-none text-xs font-medium leading-relaxed resize-none text-slate-700 dark:text-slate-200"
                                                    placeholder="e.g. Practice this before next class. Focus on breath control..."
                                                    value={assignForm.note}
                                                    onChange={e => setAssignForm(prev => ({ ...prev, note: e.target.value }))}
                                                />
                                            </div>

                                            {/* ── Submit Button ── */}
                                            <button
                                                onClick={submitAssignment}
                                                disabled={isSubmittingAssignment || (assignForm.targetType === 'individual' && assignForm.studentIds.size === 0)}
                                                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] text-xs tracking-wider uppercase leading-none inline-flex items-center justify-center gap-2 mt-1"
                                            >
                                                {isSubmittingAssignment ? (
                                                    <>
                                                        <Loader2 className="size-4 animate-spin" />
                                                        <span>Assigning...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserCheck className="size-4" />
                                                        <span>
                                                            {assignForm.targetType === 'all'
                                                                ? 'Assign to Entire Classroom'
                                                                : `Assign to ${assignForm.studentIds.size} Student${assignForm.studentIds.size !== 1 ? 's' : ''}`}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
