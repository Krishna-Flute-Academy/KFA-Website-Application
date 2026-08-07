// Interfaces
export interface CourseCategory {
    id: string;
    name: string;
    category_order: number;
    created_at?: string;
}

export interface CourseModule {
    id: string;
    category_id?: string;
    title: string;
    description: string;
    module_number: number;
    created_at?: string;
}

export interface CourseChapter {
    id: string;
    module_id: string;
    title: string;
    description: string;
    chapter_number: number;
    created_at?: string;
}

export interface CourseLesson {
    id: string;
    chapter_id: string;
    title: string;
    description: string;
    lesson_number: number;
    material_type: string; // 'pdf' | 'video' | 'youtube_url' | 'audio' | 'note' | 'checklist' | 'article'
    material_url?: string;
    file_name?: string;
    file_size?: string;
    duration?: string;
    is_introductory?: boolean;
    is_very_important?: boolean;
    bullet_points?: string[];
    image_url?: string;
    link_url?: string;
    created_at?: string;
}

// Offline Initial Seed Data
export const INITIAL_CATEGORIES: CourseCategory[] = [
    { id: 'c1000000-0000-0000-0000-000000000001', name: 'Proficiency Levels', category_order: 1 },
    { id: 'c1000000-0000-0000-0000-000000000002', name: 'Specialized Modules', category_order: 2 },
    { id: 'c1000000-0000-0000-0000-000000000003', name: 'Compositions', category_order: 3 },
    { id: 'c1000000-0000-0000-0000-000000000004', name: 'Songs', category_order: 4 }
];

export const INITIAL_MODULES: CourseModule[] = [
    {
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        category_id: 'c1000000-0000-0000-0000-000000000001',
        title: 'Level 1',
        description: 'Foundation of music theory, notes, and basic rhythm patterns.',
        module_number: 1
    },
    {
        id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        category_id: 'c1000000-0000-0000-0000-000000000001',
        title: 'Level 2',
        description: 'Introduction to scales, major chords, and simple compositions.',
        module_number: 2
    },
    {
        id: 'a3b4c5d6-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        category_id: 'c1000000-0000-0000-0000-000000000001',
        title: 'Level 3',
        description: 'Complex rhythms, dynamic notations, and ear training exercises.',
        module_number: 3
    },
    {
        id: 'a4b5c6d7-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        category_id: 'c1000000-0000-0000-0000-000000000001',
        title: 'Level 4',
        description: 'Professional performance techniques and harmonic analysis.',
        module_number: 4
    },
    // Specialized Modules
    {
        id: 'e2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        category_id: 'c1000000-0000-0000-0000-000000000002',
        title: 'Swar Gyan Ear Training',
        description: 'Master Mandra Saptak ear recognition and vocal tuning guides. Essential for bamboo flute players.',
        module_number: 101
    },
    {
        id: 'f3c4d5e6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
        category_id: 'c1000000-0000-0000-0000-000000000003',
        title: 'Composition 3/4',
        description: 'Classical Waltz meter subdivisions. Features custom skipping alankars and Base Pa compositions.',
        module_number: 102
    },
    {
        id: 'a7b89c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d',
        category_id: 'c1000000-0000-0000-0000-000000000003',
        title: 'Composition 4/4',
        description: 'Standard 4-beat rhythm subdivisions. High-fidelity guides for metronome practices.',
        module_number: 103
    },
    {
        id: 'b8c90d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e',
        category_id: 'c1000000-0000-0000-0000-000000000004',
        title: 'Song Database',
        description: 'Browse classical tunes and movie collections like Bella Ciao, DDLJ, and Bhajan guide files.',
        module_number: 104
    }
];

export const INITIAL_CHAPTERS: CourseChapter[] = [
    // Level 1 Chapters
    { 
        id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
        module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 
        title: 'Chapter 1 - Introduction to Flute', 
        description: 'What is the Flute?\n• Introduction to the Indian bamboo flute\n• Importance of flute in Indian music\n• Role of the flute in Hindustani Classical Music', 
        chapter_number: 1 
    },
    { 
        id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
        module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 
        title: 'Chapter 2 - Producing the First Sound', 
        description: 'First Blow – Producing the Sound\n• Understanding how to blow into the flute\n• Lip position (embouchure)\n• Producing the first clear sound', 
        chapter_number: 2 
    },
    { 
        id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', 
        module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 
        title: 'Chapter 3 - Completing the Lower Octave', 
        description: 'Completing the Lower Octave\n• Learning N. D. P.\n• Understanding dot notation & flute octaves\n• Finger position & long note practice\n• Dha-Ni transition & Base Pa practice', 
        chapter_number: 3 
    },
    { 
        id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 
        module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 
        title: 'Chapter 4 - Actual Pa', 
        description: 'Actual Pa & Advanced Lower Registers\n• 4/4 Rhythm Practice Patterns\n• Octave Transition Pyramid Practice\n• 12 More Alankar & Palta compositions\n• 3/4 Rhythm & D.N.D | S - - Composition\n• Bella Ciao, DDLJ, and Achyutam Keshavam songs', 
        chapter_number: 4 
    },
    { id: '2dfa3c70-1072-42be-9c0a-423b63948161', module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Actual Pa (Madhya Saptak)', description: '6 essential topics covering Actual Pa fingering, long notes, transitions, composition, and rhythm practice.', chapter_number: 5 },
    { id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Completing the Middle Octave', description: '7 essential topics covering Dha, Ni, Upper Sa, the complete Madhya Saptak, Alankars, and song practice.', chapter_number: 6 },
    
    // Level 2 Chapters
    { id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994', module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 1 - Expanding Range and Rhythm Control', description: '5 Essential topics • Developing middle octave control, rhythm cycles, and offbeat playing', chapter_number: 1 },
    { id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c', module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 2 - Composition and Song Practice', description: '7 Essential topics • Compositions, melodies, songs, bhajans, and musical expression', chapter_number: 2 },
    { id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e', module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 3 - Introduction to Raag and Classical Structure', description: '7 Essential topics • Teentaal, Raag Bhoopali, note movements, Merukhand, and Alaap', chapter_number: 3 },
    { id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e', module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 4 - Raag Bilawal', description: '7 Essential topics • Raag Bilawal structure, Pakad, Alankars, composition, Alaap, Merukhand, and song application', chapter_number: 4 },
    { id: 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b', module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 5 - Murki, Kan Swar & Meend', description: '5 Essential topics • Understanding and applying classical ornamentation techniques', chapter_number: 5 },
    
    // Level 3 Chapters
    { id: 'c07864a0-3550-40be-9608-cee5d0880d57', module_id: 'a3b4c5d6-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 1 - Intermediate Rhythms', description: '6 Essential topics • Triple meter structures', chapter_number: 1 },
    
    // Level 4 Chapters
    { id: '518108c0-363a-4160-b329-f64af9f1ca19', module_id: 'a4b5c6d7-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 1 - Advanced Improvisation', description: '5 Essential topics • Rhythmic subdivisions', chapter_number: 1 },

    // Specialized Module Default Chapters
    { id: 'e3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e', module_id: 'e2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', title: 'Chapter 1 - Mandra Saptak Ear Tuning', description: 'Ear training details\n• Pitch recognition practice\n• Mandra Saptak note frequencies', chapter_number: 1 },
    { id: 'f4c5d6e7-a8b9-0c1d-2e3f-4a5b6c7d8e9f', module_id: 'f3c4d5e6-a7b8-9c0d-1e2f-3a4b5c6d7e8f', title: 'Chapter 1 - Waltz meter (3/4)', description: '3/4 composition overview\n• Waltzing note transitions', chapter_number: 1 },
    { id: 'a8b90c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d', module_id: 'a7b89c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d', title: 'Chapter 1 - TeenTaal meter (4/4)', description: '4/4 rhythm structure\n• Traditional TeenTaal counts', chapter_number: 1 },
    { id: 'b9c0d1e2-3f4a-5b6c-7d8e-9f0a1b2c3d4e', module_id: 'b8c90d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e', title: 'Chapter 1 - Flute Songbook', description: 'Song collections overview\n• Tujhe Dekha Toh tutorial', chapter_number: 1 }
];


export const INITIAL_LESSONS: CourseLesson[] = [
    // Chapter 1 Lessons
    {
        id: 'c01e0200-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Understanding the Hindustani Classical Flute',
        description: 'Structure of the bamboo flute, blowing hole and finger holes, and how sound is produced.',
        lesson_number: 1,
        material_type: 'pdf',
        file_size: '0.9MB',
        duration: 'PDF • 0.9MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Structure of the bamboo flute',
            'Blowing hole and finger holes',
            'How sound is produced'
        ],
        link_url: 'https://krishnaflute.com/acoustics'
    },
    {
        id: 'c01e0300-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Types of Flutes',
        description: 'Small flute (higher pitch), medium flute, bass / long flute, pitch examples (C, D, E, F, G etc.), and which flute beginners should start with.',
        lesson_number: 2,
        material_type: 'video',
        duration: 'VIDEO • 12:45',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Small flute (higher pitch)',
            'Medium flute',
            'Bass / long flute',
            'Pitch examples (C, D, E, F, G etc.)',
            'Which flute beginners should start with'
        ]
    },
    {
        id: 'c01e0400-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Flute Structure',
        description: 'Number of holes (6 hole / 7 hole flute), blow hole, finger holes, cork position, and why thread is tied on flute.',
        lesson_number: 3,
        material_type: 'pdf',
        file_size: '1.5MB',
        duration: 'PDF • 1.5MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Number of holes (6 hole / 7 hole flute)',
            'Blow hole',
            'Finger holes',
            'Cork position',
            'Why thread is tied on flute'
        ]
    },
    {
        id: 'c01e0500-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Correct Sitting & Body Posture',
        description: 'Sitting position, back posture, hand position, how to hold the flute properly, and yoga for flute.',
        lesson_number: 4,
        material_type: 'video',
        duration: 'VIDEO • 08:20',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Sitting position',
            'Back posture',
            'Hand position',
            'How to hold the flute properly',
            'Yoga for flute'
        ]
    },
    {
        id: 'c01e0600-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Breath & Blowing Basics',
        description: 'How to blow air, breath control basics, and common mistakes beginners make.',
        lesson_number: 5,
        material_type: 'video',
        duration: 'VIDEO • 15:10',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'How to blow air',
            'Breath control basics',
            'Common mistakes beginners make'
        ]
    },
    {
        id: 'c01e0700-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Practice Guidelines',
        description: 'Best time to practice, how long beginners should practice, and daily practice routine.',
        lesson_number: 6,
        material_type: 'pdf',
        file_size: '0.8MB',
        duration: 'PDF • 0.8MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Best time to practice',
            'How long beginners should practice',
            'Daily practice routine'
        ],
        link_url: 'https://krishnaflute.com/routine'
    },
    {
        id: 'c01e0800-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Flute Care & Maintenance',
        description: 'How to clean the flute, protection from moisture, and storage tips.',
        lesson_number: 7,
        material_type: 'pdf',
        file_size: '0.6MB',
        duration: 'PDF • 0.6MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'How to clean the flute',
            'Protection from moisture',
            'Storage tips'
        ]
    },
    {
        id: 'c01e0900-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Do’s and Don’ts',
        description: 'Correct handling, avoiding pressure on holes, and avoid touching inner surface.',
        lesson_number: 8,
        material_type: 'pdf',
        file_size: '0.5MB',
        duration: 'PDF • 0.5MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Correct handling',
            'Avoiding pressure on holes',
            'Avoid touching inner surface'
        ]
    },
    {
        id: 'c01e1000-1111-2222-3333-444444444444',
        chapter_id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        title: 'Food and Practice',
        description: 'Playing on empty stomach vs after food, and recommended gap after eating.',
        lesson_number: 9,
        material_type: 'pdf',
        file_size: '0.4MB',
        duration: 'PDF • 0.4MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Playing on empty stomach vs after food',
            'Recommended gap after eating'
        ]
    },

    // Chapter 2 Lessons
    {
        id: 'c02e0100-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'First Blow – Producing the Sound',
        description: 'Understanding how to blow into the flute, lip position (embouchure), and producing the first clear sound.',
        lesson_number: 1,
        material_type: 'video',
        duration: 'VIDEO • 10:15',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understanding how to blow into the flute',
            'Lip position (embouchure)',
            'Producing the first clear sound'
        ]
    },
    {
        id: 'c02e0200-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'First Note – Tivra Ma',
        description: 'All holes open, producing a stable sound, and holding the note for longer duration.',
        lesson_number: 2,
        material_type: 'pdf',
        file_size: '0.8MB',
        duration: 'PDF • 0.8MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'All holes open',
            'Producing a stable sound',
            'Holding the note for longer duration'
        ]
    },
    {
        id: 'c02e0300-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'Learning the First Four Notes',
        description: 'Tivra Ma (all holes open), Ga (close bottom hole), Re (close two holes), and Sa (close three holes). Practice slowly to develop finger control.',
        lesson_number: 3,
        material_type: 'pdf',
        file_size: '1.1MB',
        duration: 'PDF • 1.1MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Tivra Ma – all holes open',
            'Ga – close the bottom hole',
            'Re – close two holes',
            'Sa – close three holes'
        ]
    },
    {
        id: 'c02e0400-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'Understanding Rhythm – 4/4',
        description: 'Introduction to 4/4 rhythm (Teentaal counting style for beginners), using a metronome, and counting: 1 – 2 – 3 – 4.',
        lesson_number: 4,
        material_type: 'video',
        duration: 'VIDEO • 08:45',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Introduction to 4/4 rhythm (Teentaal style)',
            'Using a metronome',
            'Counting: 1 – 2 – 3 – 4'
        ]
    },
    {
        id: 'c02e0500-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'Note Repetition Exercise',
        description: 'Practice each note (Ma, Ga, Re, Sa) with a metronome at 8, 4, 2, and 1 beats each. Sequence: Ma Ma Ma Ma, Ga Ga Ga Ga, Re Re Re Re, Sa Sa Sa Sa. Builds breath control and timing.',
        lesson_number: 5,
        material_type: 'pdf',
        file_size: '0.7MB',
        duration: 'PDF • 0.7MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice 8, 4, 2, and 1 beats each',
            'Sequence: Ma Ma Ma Ma, Ga Ga Ga Ga...',
            'Builds breath control and timing'
        ]
    },
    {
        id: 'c02e0600-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'Ascending and Descending Practice',
        description: 'Practice note movements: Sa Re Ga Ma, Ma Ga Re Sa to develop finger coordination.',
        lesson_number: 6,
        material_type: 'video',
        duration: 'VIDEO • 06:30',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Ascending: Sa Re Ga Ma',
            'Descending: Ma Ga Re Sa',
            'Develops finger coordination'
        ]
    },
    {
        id: 'c02e0700-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'Long Note Practice',
        description: 'Students should hold each note for 4–6 beats to improve breath control, tone quality, and stability of sound.',
        lesson_number: 7,
        material_type: 'video',
        duration: 'VIDEO • 12:00',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Hold each note for 4-6 beats',
            'Improves breath control & tone quality',
            'Builds stability of sound'
        ]
    },
    {
        id: 'c02e0800-1111-2222-3333-444444444444',
        chapter_id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
        title: 'Simple Compositions & Pyramid',
        description: 'Play small musical phrases (Sa Re Ga Re Sa, Sa Re Ga Ma, Ma Ga Re Sa) and master the note pyramid (S, SRS, SRGRS, SRGMGRS) to improve note transitions.',
        lesson_number: 8,
        material_type: 'pdf',
        file_size: '0.9MB',
        duration: 'PDF • 0.9MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Patterns: Sa Re Ga Re Sa, Sa Re Ga Ma...',
            'Pyramid: S, SRS, SRGRS, SRGMGRS',
            'Improves note transition & understanding'
        ]
    },

    // Chapter 3 Lessons
    {
        id: 'c03e0100-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Learning the Lower Notes',
        description: 'Students now learn the remaining notes of the lower octave: N. (Lower Ni), D. (Lower Dha), P. (Lower Pa).',
        lesson_number: 1,
        material_type: 'pdf',
        file_size: '0.8MB',
        duration: 'PDF • 0.8MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Learning N. (Lower Ni)',
            'Learning D. (Lower Dha)',
            'Learning P. (Lower Pa)',
            'Practice sequence: N. D. P. & P. D. N.'
        ]
    },
    {
        id: 'c03e0200-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Why the Dot ( . ) is Used',
        description: 'Understanding how octaves (Mandra, Madhya, Taar Saptak) are written and recognized in flute music notation.',
        lesson_number: 2,
        material_type: 'pdf',
        file_size: '0.5MB',
        duration: 'PDF • 0.5MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Dot below (N. D. P.) -> Lower octave (Mandra Saptak)',
            'No marking (Sa Re Ga) -> Middle octave (Madhya Saptak)',
            'Dot/Apostrophe above (S\' R\' G\') -> Upper octave (Taar Saptak)',
            'The dot indicates octave shifts clearly'
        ]
    },
    {
        id: 'c03e0300-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Understanding the Flute Octaves',
        description: 'Deep dive explanation of the three major octaves in bansuri playing: Mandra, Madhya, and Taar Saptak register details.',
        lesson_number: 3,
        material_type: 'video',
        duration: 'VIDEO • 08:30',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Mandra Saptak (Lower octave)',
            'Madhya Saptak (Middle octave)',
            'Taar Saptak (Higher octave)',
            'Register focus for beginning flute students'
        ]
    },
    {
        id: 'c03e0400-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Finger Position for Lower Notes',
        description: 'Critical hole coverage details and hand positions to play Dha and Ni properly without air leaks.',
        lesson_number: 4,
        material_type: 'video',
        duration: 'VIDEO • 11:15',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Achieving full, airtight hole coverage',
            'Keeping fingers relaxed and curved',
            'Avoiding micro-leakage on Dha and Ni'
        ]
    },
    {
        id: 'c03e0500-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Long Note Practice',
        description: 'Breathing stamina and pitch stabilization practice in the lower register on notes N., D., and P.',
        lesson_number: 5,
        material_type: 'video',
        duration: 'VIDEO • 14:00',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Hold notes for 4-8 beats with metronome',
            'Building breath stamina & tone density',
            'Stabilizing pitch in lower registers'
        ]
    },
    {
        id: 'c03e0600-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Simple Phrases for Dha and Ni',
        description: 'Easy transitional exercises to gain flexibility shifting between lower octave and middle octave.',
        lesson_number: 6,
        material_type: 'pdf',
        file_size: '0.7MB',
        duration: 'PDF • 0.7MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Exercise 1: N. Sa Re Sa',
            'Exercise 2: D. N. Sa',
            'Exercise 3: Sa N. D.',
            'Exercise 4: Sa N. D. | D. N. Sa'
        ]
    },
    {
        id: 'c03e0700-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Learning Base Pa',
        description: 'Introducing the lowest reference note on the flute, Lower Pa (P.), with breathing and scale jumping intervals.',
        lesson_number: 7,
        material_type: 'video',
        duration: 'VIDEO • 10:45',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Reference blowing style for Base Pa',
            'Interval jumps: P. Sa & Sa P.',
            'Scale segments: P. D. N.'
        ]
    },
    {
        id: 'c03e0800-1111-2222-3333-444444444444',
        chapter_id: 'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a',
        title: 'Rhythm and Composition Practice',
        description: 'Introduction to playing 4/4 and 3/4 rhythm compositions with a metronome using the lower notes.',
        lesson_number: 8,
        material_type: 'pdf',
        file_size: '1.1MB',
        duration: 'PDF • 1.1MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understanding 4/4 and 3/4 time signatures',
            'Composition: D.N.S | SN.D. | D.N.S',
            'Combining rhythm with octave register shifts'
        ]
    },

    // Chapter 4 Lessons
    {
        id: 'c04e0100-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Rhythm Practice Patterns',
        description: '<p>This topic introduces students to rhythm-based practice using a 4/4 time signature and a metronome. These exercises improve timing, finger coordination, breath control, and note clarity while building a strong rhythmic foundation.</p><p><strong>Practice Patterns:</strong></p><ul class="list-disc pl-5 space-y-1"><li>1234</li><li>1234 – 4321</li><li>21 Pattern</li><li>123 Pattern</li></ul>',
        lesson_number: 1,
        material_type: 'video',
        duration: 'VIDEO • 11:30',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the importance of practicing with a metronome.',
            'Practice all rhythm patterns in 4/4 time.',
            'Maintain steady tempo throughout the exercise.',
            'Develop finger coordination and note clarity.',
            'Play each pattern without breaking the rhythm.',
            'Increase speed only after achieving accuracy.'
        ]
    },
    {
        id: 'c04e0200-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Pyramid Practice',
        description: '<p>The Pyramid exercise gradually increases and decreases the number of notes played in a sequence. It develops finger agility, memory, breath control, and smooth note transitions.</p><p><strong>Practice:</strong></p><div class="font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl inline-block my-1 font-semibold leading-relaxed">S<br/>S R S<br/>S R G R S<br/>S R G M G R S</div>',
        lesson_number: 2,
        material_type: 'pdf',
        file_size: '0.9MB',
        duration: 'PDF • 0.9MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the concept of Pyramid Practice.',
            'Play each level smoothly without hesitation.',
            'Maintain even rhythm and tone quality.',
            'Develop finger speed with clean transitions.',
            'Practice ascending and descending patterns accurately.'
        ]
    },
    {
        id: 'c04e0300-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Advanced Alankar / Palta Practice (Part 1)',
        description: '<p>This topic introduces longer Alankars and Paltas to improve finger movement, note accuracy, and fluency across the flute.</p><p><strong>Practice Patterns:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>P.D.N.S SN.D.P. | D.N.SR RSN.D. | N.SRG GRSN. | SRGm mGRS | Reverse (mGRS SRGm)</li><li>P.D.N.S RSN.D. | D.N.SR GRSN. | N.SRG mGRS | Reverse</li><li>P.D.N. | D.N.S | N.S R | S R G | R G m | (3/4 Rhythm)</li></ul>',
        lesson_number: 3,
        material_type: 'pdf',
        file_size: '1.6MB',
        duration: 'PDF • 1.6MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice each Palta slowly with correct fingering.',
            'Maintain equal note duration.',
            'Play reverse patterns accurately.',
            'Develop smooth finger transitions.',
            'Use a metronome throughout practice.'
        ]
    },
    {
        id: 'c04e0400-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Advanced Alankar / Palta Practice (Part 2)',
        description: '<p>These exercises strengthen pattern recognition, rhythmic accuracy, and fluency in playing continuous note combinations.</p><p><strong>Practice Patterns:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>P.D.N.S | D.N.SR | N.SRG | SRGm | Reverse</li><li>P.D.N. P.D.N. P.D. | D.N.S D.N.S D.N. | N.SR N.SR N.S | SRG SRG SR | RGm RGm RG</li><li>D.P N.D. SN. RS GR mG | Reverse (Gm, RG, SR, N.S, D.N., P.D.)</li></ul>',
        lesson_number: 4,
        material_type: 'pdf',
        file_size: '1.2MB',
        duration: 'PDF • 1.2MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play continuous patterns without stopping.',
            'Maintain rhythm throughout the exercise.',
            'Improve finger independence.',
            'Practice reverse exercises confidently.',
            'Develop consistent breath support.'
        ]
    },
    {
        id: 'c04e0500-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Advanced Alankar / Palta Practice (Part 3)',
        description: '<p>These exercises introduce skipping notes and repetitive rhythmic patterns to increase finger flexibility and improve melodic understanding.</p><p><strong>Practice Patterns:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>P.N. D.S NR SG Rm (Skipping One Note)</li><li>N.D.P | SN.D | RSN | GRS | mGR | Reverse</li><li>P.D. P.D. P.D. P.D. | D.N. D.N. D.N. D.N. | N.S N.S N.S N.S (Continue to Shuddha Ma)</li></ul>',
        lesson_number: 5,
        material_type: 'pdf',
        file_size: '1.2MB',
        duration: 'PDF • 1.2MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice skip-note exercises accurately.',
            'Maintain finger precision during larger jumps.',
            'Play repetitive exercises evenly.',
            'Develop confidence in note positioning.',
            'Improve hand coordination.'
        ]
    },
    {
        id: 'c04e0600-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Advanced Alankar / Palta Practice (Part 4)',
        description: '<p>This topic focuses on continuous higher-speed patterns and repetitive note groups to improve endurance and finger speed.</p><p><strong>Practice Patterns:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>P.D.N.S ×4 | D.N.SR ×4 | N.SRG ×4 | SRGm ×4</li><li>P.D. P.D. P.D.N. | D.N. D.N. D.N.S | N.S N.S N.SR | SR SR SRG | RG RG RGm</li><li>SN.D.P | RSN.D | GRSN | mGRS | Reverse</li></ul>',
        lesson_number: 6,
        material_type: 'pdf',
        file_size: '1.3MB',
        duration: 'PDF • 1.3MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Maintain steady tempo during long exercises.',
            'Develop endurance for continuous playing.',
            'Play repeated note groups evenly.',
            'Maintain clear tone at higher speed.',
            'Perform reverse exercises confidently.'
        ]
    },
    {
        id: 'c04e0700-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Beginner Composition',
        description: '<p>Students learn a simple composition using the techniques developed in previous exercises. The focus is on expression, timing, and smooth note transitions.</p><p><strong>Composition:</strong></p><div class="font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl inline-block my-1 font-semibold leading-relaxed">D.N.D. | S — — |</div>',
        lesson_number: 7,
        material_type: 'video',
        duration: 'VIDEO • 09:15',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play the composition with correct rhythm.',
            'Maintain smooth note transitions.',
            'Use proper breath control.',
            'Play with a clear and pleasant tone.',
            'Perform the composition confidently.'
        ]
    },
    {
        id: 'c04e0800-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Beginner Songs',
        description: '<p>Students apply their rhythm, fingering, and breath control skills by learning simple and familiar melodies.</p><p><strong>Songs:</strong></p><ul class="list-disc pl-5 space-y-1"><li>Bella Ciao</li><li>Dilwale Dulhania Le Janege (DDLJ Theme)</li><li>Achyutam Keshavam</li></ul>',
        lesson_number: 8,
        material_type: 'video',
        duration: 'VIDEO • 15:45',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Play each song with correct notes.',
            'Maintain steady rhythm throughout the song.',
            'Use proper breath control.',
            'Play with expression and musicality.',
            'Perform the complete song confidently without major mistakes.'
        ]
    },
    // Level 1, Chapter 5 — Actual Pa (Madhya Saptak)
    {
        id: 'c05e0100-1111-2222-3333-444444444444',
        chapter_id: '2dfa3c70-1072-42be-9c0a-423b63948161',
        title: 'Introduction to the Actual Pa',
        description: '<p>Students learn the <strong>Actual Pa (Madhya Saptak)</strong> and understand how it differs from the <strong>Lower Pa (Mandra Saptak)</strong>. The focus is on correct fingering, proper hole coverage, balanced blowing, and producing a stable, clear tone.</p><p><strong>Concepts:</strong></p><ul class="list-disc pl-5 space-y-1"><li><strong>P. (Lower Pa)</strong> – Mandra Saptak</li><li><strong>Pa</strong> – Madhya Saptak</li></ul>',
        lesson_number: 1,
        material_type: 'note',
        is_introductory: true,
        is_very_important: true,
        bullet_points: ['Understand the difference between Lower Pa and Actual Pa.', 'Learn the correct finger position for Actual Pa.', 'Cover all finger holes properly.', 'Maintain balanced blowing while playing Pa.', 'Produce a clear and stable Pa note.']
    },
    {
        id: 'c05e0200-1111-2222-3333-444444444444',
        chapter_id: '2dfa3c70-1072-42be-9c0a-423b63948161',
        title: 'Long Note Practice on Pa',
        description: '<p>This exercise develops breath control, tone stability, and consistency by sustaining the Pa note for different durations.</p><p><strong>Practice:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>Pa (Hold for 4 beats)</li><li>Pa (Hold for 8 beats)</li></ul>',
        lesson_number: 2,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: ['Play Pa with a clear tone.', 'Hold Pa steadily for 4 beats.', 'Hold Pa steadily for 8 beats.', 'Maintain consistent breath pressure.', 'Avoid fluctuations in pitch and volume.']
    },
    {
        id: 'c05e0300-1111-2222-3333-444444444444',
        chapter_id: '2dfa3c70-1072-42be-9c0a-423b63948161',
        title: 'Ma to Pa Transition',
        description: '<p>This is the first transition involving the Actual Pa. Students learn smooth finger movement while maintaining continuous airflow and tone quality.</p><p><strong>Practice:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>Ma → Pa</li><li>Pa → Ma</li><li>Ma Pa Ma Pa</li><li>Ma Pa Ma Pa</li></ul>',
        lesson_number: 3,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: ['Transition smoothly between Ma and Pa.', 'Lift only the required finger.', 'Avoid unnecessary finger movement.', 'Maintain continuous airflow.', 'Prevent sound breaks during transitions.']
    },
    {
        id: 'c05e0400-1111-2222-3333-444444444444',
        chapter_id: '2dfa3c70-1072-42be-9c0a-423b63948161',
        title: 'Other Transitions to Pa',
        description: '<p>Students practice ascending and descending note sequences that include Pa. These exercises improve finger coordination, note accuracy, and melodic flow.</p><p><strong>Ascending:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>Ga → Ma → Pa</li><li>Re → Ga → Ma → Pa</li><li>Sa → Re → Ga → Ma → Pa</li></ul><p><strong>Descending:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>Pa → Ma → Ga → Re → Sa</li></ul>',
        lesson_number: 4,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: ['Play ascending transitions smoothly.', 'Play descending transitions smoothly.', 'Maintain equal timing between notes.', 'Develop finger coordination.', 'Produce clear notes throughout the exercise.']
    },
    {
        id: 'c05e0500-1111-2222-3333-444444444444',
        chapter_id: '2dfa3c70-1072-42be-9c0a-423b63948161',
        title: 'Simple Composition',
        description: '<p>Students apply the newly learned Pa note by playing a simple melodic composition with proper rhythm and expression.</p><p><strong>Composition:</strong></p><div class="font-mono">G M P | P M G</div><p><strong>Practice:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>Ga Ma Pa | Pa Ma Ga</li><li>Ga Ma Pa | Ma Ga</li></ul>',
        lesson_number: 5,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: ['Play the composition with correct notes.', 'Maintain steady rhythm.', 'Use proper breath control.', 'Play with smooth note transitions.', 'Perform confidently with a metronome.']
    },
    {
        id: 'c05e0600-1111-2222-3333-444444444444',
        chapter_id: '2dfa3c70-1072-42be-9c0a-423b63948161',
        title: 'Rhythm Practice with Pa',
        description: '<p>These rhythm exercises strengthen timing, coordination, and fluency while incorporating the newly learned Pa note.</p><p><strong>Practice Patterns:</strong></p><ul class="list-disc pl-5 space-y-1 font-mono"><li>Pattern 1: Ga Ma Pa Pa</li><li>Pattern 2: Ga Ma Pa | Pa Ma Ga</li><li>Pattern 3: Sa Re Ga Ma | Ga Ma Pa</li></ul>',
        lesson_number: 6,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: ['Practice all rhythm patterns with a metronome.', 'Maintain a steady 4/4 rhythm.', 'Play each note clearly.', 'Develop finger speed and coordination.', 'Increase tempo only after achieving accuracy.']
    },
    // Level 1, Chapter 6 — Completing the Middle Octave
    {
        id: 'c06e0100-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d',
        title: 'Introduction to Completing the Middle Octave',
        description: `<h3>Overview</h3><p>In this topic, students complete the <strong>Madhya Saptak (Middle Octave)</strong> by learning the remaining three notes: <strong>Dha, Ni, and Upper Sa (Sa')</strong>. These notes complete the full octave and prepare students for more advanced Alankars and songs.</p><h4>Concepts</h4><p><strong>Students already know:</strong></p><ul><li>Sa</li><li>Re</li><li>Ga</li><li>Ma</li><li>Pa</li></ul><p><strong>New notes to learn:</strong></p><ul><li>Dha</li><li>Ni</li><li>Sa' (Upper Sa)</li></ul>`,
        lesson_number: 1, material_type: 'note', is_introductory: true, is_very_important: true,
        bullet_points: ['Understand the concept of the Middle Octave.', 'Identify Dha, Ni, and Upper Sa.', 'Understand the difference between Lower, Middle, and Upper Octaves.', 'Recognize the complete Madhya Saptak.']
    },
    {
        id: 'c06e0200-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', title: 'Learning Dha',
        description: `<h3>Overview</h3><p>Students learn the correct fingering and blowing technique for Dha while producing a clear and stable sound.</p><h4>Practice</h4><pre>Dha Dha Dha Dha

Pa Dha Pa Dha</pre>`,
        lesson_number: 2, material_type: 'note', is_introductory: false, is_very_important: true,
        bullet_points: ['Learn the correct finger position for Dha.', 'Cover all required holes properly.', 'Maintain balanced blowing.', 'Produce a clear Dha note.', 'Transition smoothly between Pa and Dha.']
    },
    {
        id: 'c06e0300-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', title: 'Learning Ni',
        description: `<h3>Overview</h3><p>Students learn the Ni note with correct fingering and controlled airflow while avoiding air leakage.</p><h4>Practice</h4><pre>Ni Ni Ni Ni

Dha Ni Dha Ni</pre>`,
        lesson_number: 3, material_type: 'note', is_introductory: false, is_very_important: true,
        bullet_points: ['Learn the correct finger position for Ni.', 'Avoid air leakage while playing.', 'Maintain a stable tone.', 'Transition smoothly between Dha and Ni.', 'Play Ni with consistent breath control.']
    },
    {
        id: 'c06e0400-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', title: `Learning Upper Sa (Sa')`,
        description: `<h3>Overview</h3><p>Students learn to play the Upper Sa using slightly stronger yet controlled blowing while maintaining good tone quality.</p><h4>Practice</h4><pre>Ni Sa' Ni Sa'</pre>`,
        lesson_number: 4, material_type: 'note', is_introductory: false, is_very_important: true,
        bullet_points: ['Learn the correct fingering for Upper Sa.', 'Use controlled breath pressure.', 'Avoid overblowing.', 'Produce a clear and stable Upper Sa.', 'Transition smoothly between Ni and Upper Sa.']
    },
    {
        id: 'c06e0500-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', title: 'Full Middle Octave Practice',
        description: `<h3>Overview</h3><p>Students now practice the complete Middle Octave in both ascending (Arohan) and descending (Avarohan) order with a steady rhythm.</p><h4>Practice</h4><p><strong>Ascending (Arohan)</strong></p><pre>Sa Re Ga Ma Pa Dha Ni Sa'</pre><p><strong>Descending (Avarohan)</strong></p><pre>Sa' Ni Dha Pa Ma Ga Re Sa</pre>`,
        lesson_number: 5, material_type: 'note', is_introductory: false, is_very_important: true,
        bullet_points: ['Play the complete ascending scale.', 'Play the complete descending scale.', 'Maintain even rhythm throughout.', 'Use a metronome while practicing.', 'Produce clear notes across the entire octave.']
    },
    {
        id: 'c06e0600-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', title: 'Alankar Practice',
        description: `<h3>Overview</h3><p>These Alankars strengthen finger coordination, note clarity, rhythm, and fluency across the complete Middle Octave.</p><h4>Practice Patterns</h4><pre>1. P.D.N.S SN.D.P. | D.N.SR RSN.D. | N.SRG GRSN. | SRGm mGRS | RGmP PmGR | GmPD DPmG | mPDN NDPm | PDNS' S'NDP</pre><pre>2. P.D.N.S RSN.D. | D.N.SR GRSN. | N.SRG mGRS | SRGm PmGR | RGmP DPmG | GmPD NDPm | mPDN S'NDP
   S'NDP mPDN | NDPm GmPD | DPmG RGmP | PmGR SRGm | mGRS N.SRG | GRSN. D.N.SR | RSN.D. P.D.N.S</pre><pre>3. P.D.N. | D.N.S | N.S R | S R G | R G m | G m P | m P D | P D N | D N S'</pre><pre>4. P.D.N.S | D.N.SR | N.SRG | SRGm | RGmP | GmPD | mPDN | PDNS' | S'NDP | NDPm | DPmG | PmGR | mGRS | GRSN. | RSN.D. | SN.D.P.</pre><pre>5. D.P | N.D. | SN. | RS | GR | mG | Pm | DP | ND | S'N |
   NS' | DN | PD | mP | Gm | RG | SR | N.S | D.N. | P.D.</pre><pre>6. P.N. | D.S | NR | SG | Rm | GP | mD | PN | DS' |
   S'D | NP | Dm | PG | mR | GS | RN | SD. | N.P.</pre><pre>7. N.D.P | SN.D. | RSN. | GRS | mGR | PmG | DPm | NDP | S'ND</pre><pre>8. SN.D.P. | RSN.D. | GRSN. | mGRS | PmGR | DPmG | NDPm | S'NDP |
   PDNS' | mPDN | GmPD | RGmP | SRGm | N.SRG | D.N.SR | P.D.N.S</pre><pre>9. S'R'G' S'R'G' S'R' | S'R'G'm' G'R'S' |
   NS'R' NS'R' NS' | NSR'G' R'S'N</pre><pre>10. P. | P.D.P. | P.D.N.P. | P.D.N.SP. | P.D.N.SRP. | Continue the same pattern...</pre><pre>11. SRGmP | RGmPD | GmPDN | mPDNS' |
    S'NDPm | NDPmG | DPmGR | PmGRS</pre><pre>12. S _ _ _ | SN. D.P. _ _ | R _ _ _ | RS N.D. _ _</pre>`,
        lesson_number: 6, material_type: 'note', is_introductory: false, is_very_important: true,
        bullet_points: ['Practice all Alankars slowly.', 'Maintain equal timing between notes.', 'Play both ascending and descending patterns accurately.', 'Use a metronome throughout practice.', 'Develop finger coordination and note clarity.', 'Increase speed only after achieving accuracy.']
    },
    {
        id: 'c06e0700-1111-2222-3333-444444444444', chapter_id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', title: 'Song Practice',
        description: `<h3>Overview</h3><p>Students apply the complete Middle Octave by learning simple songs and musical phrases. This helps connect technical practice with musical expression.</p><h4>Practice</h4><pre>Sa Re Ga Ma | Ga Re Sa

Ga Ma Pa Dha | Pa Ma Ga</pre>`,
        lesson_number: 7, material_type: 'note', is_introductory: false, is_very_important: false,
        bullet_points: ['Play simple melodies using the complete octave.', 'Maintain correct rhythm.', 'Use proper breath control.', 'Play with smooth note transitions.', 'Perform songs confidently with a metronome.']
    },
    // Level 2, Chapter 1 - Expanding Range and Rhythm Control
    {
        id: 'c21e0100-1111-2222-3333-444444444444',
        chapter_id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
        title: 'Full Scale Practice (Sa to Upper Sa)',
        description: `<h3>Overview</h3><p>In this topic, students strengthen their command over the complete Middle Octave (Madhya Saptak) by practicing the full scale in both ascending (Arohan) and descending (Avarohan) order. The focus is on producing a clear tone, maintaining steady rhythm, and developing smooth finger coordination.</p><h4>Practice</h4><p><strong>Ascending (Arohan)</strong></p><pre>Sa Re Ga Ma Pa Dha Ni Sa'</pre><p><strong>Descending (Avarohan)</strong></p><pre>Sa' Ni Dha Pa Ma Ga Re Sa</pre>`,
        lesson_number: 1,
        material_type: 'note',
        is_introductory: true,
        is_very_important: true,
        bullet_points: [
            'Play the complete scale smoothly.',
            'Maintain a steady rhythm with a metronome.',
            'Produce clear and even notes.',
            'Develop smooth finger movement.',
            'Maintain consistent tone throughout the octave.'
        ]
    },
    {
        id: 'c21e0200-1111-2222-3333-444444444444',
        chapter_id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
        title: 'Base Pa to Upper Sa Practice',
        description: `<h3>Overview</h3><p>This exercise expands the student's playing range by connecting the Lower Pa (P.) with the complete Middle Octave. It improves octave transition, finger control, and breath stability.</p><h4>Practice</h4><pre>P. Sa Re Ga

P. Sa Re Ga Ma

P. Sa Re Ga Ma Pa

P. Sa Re Ga Ma Pa Dha Ni Sa'</pre>`,
        lesson_number: 2,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Play smoothly from Lower Pa to Upper Sa.',
            'Maintain balanced breath throughout.',
            'Produce clear notes across the range.',
            'Develop smooth octave transitions.',
            'Maintain steady rhythm.'
        ]
    },
    {
        id: 'c21e0300-1111-2222-3333-444444444444',
        chapter_id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
        title: 'Advanced Alankar Practice',
        description: `<h3>Overview</h3><p>These Alankars improve finger agility, note accuracy, coordination, and musical thinking. Students should begin slowly and gradually increase speed using a metronome.</p><h4>Practice Patterns</h4><p><strong>Pattern 1</strong></p><pre>Sa Re Ga Re
Re Ga Ma Ga
Ga Ma Pa Ma</pre><p><strong>Pattern 2</strong></p><pre>Sa Re Ga Ma
Re Ga Ma Pa
Ga Ma Pa Dha</pre><p><strong>Pattern 3 (Skipping Notes)</strong></p><pre>Sa Ga
Re Ma
Ga Pa</pre>`,
        lesson_number: 3,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice all Alankars accurately.',
            'Maintain equal timing between notes.',
            'Develop finger agility.',
            'Improve note clarity.',
            'Increase speed only after achieving accuracy.'
        ]
    },
    {
        id: 'c21e0400-1111-2222-3333-444444444444',
        chapter_id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
        title: 'Rhythm Practice',
        description: `<h3>Overview</h3><p>Students learn to perform scales and Alankars in different rhythmic cycles. Practicing with a metronome or tabla improves timing, coordination, and rhythmic confidence.</p><h4>Practice Rhythms</h4><p><strong>4/4 Rhythm</strong></p><pre>1 2 3 4</pre><p><strong>Keherwa (8 Beats)</strong></p><pre>Dha Ge Na Ti | Na Ka Dhi Na</pre><p><strong>Dadra (6 Beats)</strong></p><pre>Dha Dhi Na | Dha Tu Na</pre><p><strong>3/4 Rhythm</strong></p><pre>1 2 3</pre>`,
        lesson_number: 4,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice scales in different rhythms.',
            'Play Alankars with a metronome.',
            'Maintain accurate timing.',
            'Understand the feel of Keherwa and Dadra.',
            'Develop rhythmic consistency.'
        ]
    },
    {
        id: 'c21e0500-1111-2222-3333-444444444444',
        chapter_id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
        title: 'Understanding Offbeat Playing',
        description: `<h3>Overview</h3><p>Students are introduced to Offbeat Playing, where a musical phrase begins on a beat other than the first beat of the cycle. This develops rhythmic awareness and improves coordination with tabla accompaniment.</p><h4>Practice</h4><p><strong>Start on Beat 2 (Beat 1 - Rest)</strong></p><pre>(Rest) Sa Re Ga Ma</pre><p>Practice the same phrase starting from:</p><ul><li>Beat 2</li><li>Beat 3</li><li>Beat 4</li></ul>`,
        lesson_number: 5,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the concept of offbeat playing.',
            'Start phrases on different beats.',
            'Maintain the rhythm while shifting the starting beat.',
            'Improve coordination with tabla.',
            'Develop rhythmic confidence and musical awareness.'
        ]
    },
    // Level 2, Chapter 2 - Composition and Song Practice
    {
        id: 'c22e0100-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Introduction to Musical Composition',
        description: `<h3>Overview</h3><p>In this topic, students are introduced to the concept of a musical composition (Bandish/Dhun). They learn how individual notes combine to form musical phrases and how rhythm, breath control, and expression bring a melody to life.</p><h4>Concepts</h4><ul><li>What is a Composition (Bandish / Dhun)?</li><li>How notes form musical phrases.</li><li>Importance of rhythm and expression.</li></ul>`,
        lesson_number: 1,
        material_type: 'note',
        is_introductory: true,
        is_very_important: true,
        bullet_points: [
            'Understand the concept of a musical composition.',
            'Recognize musical phrases.',
            'Maintain smooth note transitions.',
            'Play with correct rhythm.',
            'Develop basic musical expression.'
        ]
    },
    {
        id: 'c22e0200-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Basic Flute Compositions',
        description: `<h3>Overview</h3><p>Students learn simple flute compositions that strengthen note relationships, rhythm, and finger coordination while improving confidence in playing melodic phrases.</p><h4>Practice Patterns</h4><p><strong>Practice 1 – SPPS Composition</strong></p><pre>Sa Pa Pa Sa

Pa Pa Sa</pre><p><strong>Practice 2 – P.P.P. DPP Composition</strong></p><pre>P. P. P.

D P P</pre>`,
        lesson_number: 2,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Play both compositions accurately.',
            'Maintain a steady rhythm.',
            'Develop the relationship between Sa and Pa.',
            'Improve Lower Octave control.',
            'Produce a clear and consistent tone.'
        ]
    },
    {
        id: 'c22e0300-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Melody Development Exercises',
        description: `<h3>Overview</h3><p>These exercises help students connect notes into meaningful musical phrases while improving breath control, phrasing, and note continuity.</p><h4>Practice</h4><pre>Sa Re Ga Ma | Ga Re Sa
Ga Ma Pa Dha | Pa Ma Ga
Sa Ga Ma Pa | Dha Pa Ma</pre>`,
        lesson_number: 3,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play melodic phrases smoothly.',
            'Maintain proper breath control.',
            'Connect notes without breaks.',
            'Develop musical phrasing.',
            'Play with consistent rhythm.'
        ]
    },
    {
        id: 'c22e0400-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Bollywood Song Practice',
        description: `<h3>Overview</h3><p>Students apply their technical skills by learning familiar Bollywood melodies. These songs improve melody recognition, rhythm, expression, and overall musical confidence.</p><h4>Songs</h4><ul><li>Titan Theme</li><li>Ye Dosti</li><li>Chookar Mere Man Ko</li><li>Aa Chal Ke Tujhe</li></ul>`,
        lesson_number: 4,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play each melody accurately.',
            'Maintain the correct rhythm.',
            'Use smooth note transitions.',
            'Develop musical expression.',
            'Perform songs confidently.'
        ]
    },
    {
        id: 'c22e0500-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Bhajan Practice',
        description: `<h3>Overview</h3><p>Bhajans help students develop slow, expressive playing while improving breath control and emotional connection with the music.</p><h4>Bhajans</h4><ul><li>Achyutam Keshavam</li><li>Om Jai Jagdish Hare</li><li>Shri Krishna Govinda Hare Murari</li></ul>`,
        lesson_number: 5,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play bhajans with a steady tempo.',
            'Maintain smooth blowing.',
            'Use expressive phrasing.',
            'Produce a pleasant tone.',
            'Develop emotional expression.'
        ]
    },
    {
        id: 'c22e0600-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Rhythm Application',
        description: `<h3>Overview</h3><p>Students learn to apply different rhythmic cycles while playing compositions and songs using a metronome or tabla accompaniment.</p><h4>Practice Rhythms</h4><p><strong>4/4 Rhythm</strong></p><pre>1 2 3 4</pre><p><strong>Keherwa (8 Beats)</strong></p><pre>Dha Ge Na Ti | Na Ka Dhi Na</pre><p><strong>Dadra (6 Beats)</strong></p><pre>Dha Dhi Na | Dha Tu Na</pre>`,
        lesson_number: 6,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice songs in different rhythms.',
            'Maintain accurate timing.',
            'Play confidently with a metronome.',
            'Understand Keherwa and Dadra rhythm cycles.',
            'Develop rhythmic consistency.'
        ]
    },
    {
        id: 'c22e0700-1111-2222-3333-444444444444',
        chapter_id: 'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
        title: 'Musical Expression Practice',
        description: `<h3>Overview</h3><p>This topic introduces the fundamentals of musical expression. Students learn how small changes in emphasis, pauses, and breath control can make a performance more expressive and engaging.</p><h4>Practice Concepts</h4><ul><li>Note emphasis</li><li>Musical pauses</li><li>Dynamic blowing</li><li>Phrase shaping</li></ul>`,
        lesson_number: 7,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand basic musical expression.',
            'Apply note emphasis appropriately.',
            'Use pauses naturally between phrases.',
            'Control blowing dynamics.',
            'Play songs with feeling instead of mechanically.'
        ]
    },
    // Level 2, Chapter 3 - Introduction to Raag and Classical Structure
    {
        id: 'c23e0100-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Understanding Teentaal',
        description: `<h3>Overview</h3><p>Teentaal is the most commonly used rhythm cycle in Hindustani Classical Music. In this topic, students learn its 16-beat structure, clap and wave pattern, and the basic tabla theka. They also practice scales and Alankars within Teentaal to develop rhythmic awareness.</p><h4>Teentaal Structure</h4><p><strong>16 Beats</strong></p><p>1 (Clap) | 5 (Clap) | 9 (Wave) | 13 (Clap)</p><h4>Basic Theka</h4><pre>Dha Dhin Dhin Dha\nDha Dhin Dhin Dha\nDha Tin Tin Ta\nTa Dhin Dhin Dha</pre><h4>Practice</h4><ul><li>Sa Re Ga Ma in Teentaal</li><li>Simple Alankars in Teentaal</li></ul>`,
        lesson_number: 1,
        material_type: 'note',
        is_introductory: true,
        is_very_important: true,
        bullet_points: [
            'Understand the structure of Teentaal.',
            'Identify Sam, Tali, and Khali.',
            'Recite the Teentaal theka correctly.',
            'Practice scales in Teentaal.',
            'Practice Alankars with a metronome or tabla.',
            'Develop rhythmic awareness.'
        ]
    },
    {
        id: 'c23e0200-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Introduction to Raag Bhoopali',
        description: `<h3>Overview</h3><p>Students are introduced to Raag Bhoopali, one of the most popular beginner ragas in Hindustani Classical Music. They learn its note structure, ascending and descending scales, and the mood it creates.</p><h4>Notes Used</h4><p>Sa Re Ga Pa Dha Sa'</p><h4>Notes Omitted</h4><p>Ma and Ni</p><h4>Arohan (Ascending)</h4><pre>Sa Re Ga Pa Dha Sa'</pre><h4>Avarohan (Descending)</h4><pre>Sa' Dha Pa Ga Re Sa</pre>`,
        lesson_number: 2,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Understand the structure of Raag Bhoopali.',
            'Identify the notes used in the raga.',
            'Recognize the omitted notes.',
            'Play the Arohan correctly.',
            'Play the Avarohan correctly.',
            'Understand the mood and character of Bhoopali.'
        ]
    },
    {
        id: 'c23e0300-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Bhoopali Note Movements',
        description: `<h3>Overview</h3><p>Students practice the characteristic note movements (Pakad and basic phrases) of Raag Bhoopali. These exercises develop smooth fingering and introduce the melodic identity of the raga.</p><h4>Practice</h4><pre>Sa Re Ga\n\nGa Pa Dha\n\nDha Pa Ga\n\nGa Re Sa</pre>`,
        lesson_number: 3,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice each phrase smoothly.',
            'Maintain proper rhythm.',
            'Develop expressive note transitions.',
            'Produce a clear tone.',
            'Recognize the characteristic movement of Bhoopali.'
        ]
    },
    {
        id: 'c23e0400-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Bhoopali Composition',
        description: `<h3>Overview</h3><p>Students learn a simple classical composition in Raag Bhoopali and practice it with Teentaal using a metronome or tabla.</p><h4>Composition</h4><pre>Sa Re Ga | Pa Dha Pa\n\nGa Re Sa | Re Ga Pa</pre>`,
        lesson_number: 4,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play the composition accurately.',
            'Maintain Teentaal throughout.',
            'Land correctly on Sam.',
            'Use smooth phrasing.',
            'Perform confidently with tabla or metronome.'
        ]
    },
    {
        id: 'c23e0500-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Understanding Merukhand',
        description: `<h3>Overview</h3><p>Students are introduced to Merukhand, a classical practice method that rearranges note sequences to improve finger control, creativity, and improvisation skills.</p><h4>Purpose</h4><ul><li>Develop improvisation ability.</li><li>Strengthen note control.</li><li>Improve finger coordination.</li><li>Enhance musical creativity.</li></ul>`,
        lesson_number: 5,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the concept of Merukhand.',
            'Recognize different note combinations.',
            'Practice slowly with correct rhythm.',
            'Maintain note clarity.',
            'Develop improvisation skills.'
        ]
    },
    {
        id: 'c23e0600-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Bhoopali Merukhand Practice',
        description: `<h3>Overview</h3><p>Students practice Merukhand patterns using the notes of Raag Bhoopali to improve flexibility, creativity, and rhythmic accuracy.</p><h4>Practice</h4><pre>Sa Re Ga Pa\n\nSa Ga Re Pa\n\nRe Ga Pa Sa\n\nGa Pa Re Sa</pre>`,
        lesson_number: 6,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice all Merukhand patterns accurately.',
            'Maintain equal timing between notes.',
            'Develop finger agility.',
            'Improve note clarity.',
            'Increase speed gradually using a metronome.'
        ]
    },
    {
        id: 'c23e0700-1111-2222-3333-444444444444',
        chapter_id: 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
        title: 'Introduction to Alaap',
        description: `<h3>Overview</h3><p>Students learn the basics of Alaap, the slow and expressive introduction to a raga. The focus is on developing musical expression, breath control, and understanding the emotional mood of Raag Bhoopali.</p><h4>Practice</h4><pre>Sa... Re... Ga...\n\nGa... Pa... Dha...\n\nDha... Pa... Ga...\n\nRe... Sa...</pre>`,
        lesson_number: 7,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the purpose of Alaap.',
            'Play slowly with expression.',
            'Maintain controlled breath.',
            'Connect notes smoothly.',
            'Reflect the mood of Raag Bhoopali.'
        ]
    },
    // Level 2, Chapter 4 - Raag Bilawal
    {
        id: 'c24e0100-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Introduction to Raag Bilawal',
        description: `<h3>Overview</h3><p>Students are introduced to Raag Bilawal, one of the fundamental ragas in Hindustani Classical Music. All seven notes in this raga are Shuddha Swaras, making it equivalent to the natural major scale in Western music.</p><h4>Thaat</h4><p>Bilawal</p><h4>Notes Used</h4><p>Sa Re Ga Ma Pa Dha Ni Sa'</p><h4>Arohan (Ascending)</h4><pre>Sa Re Ga Ma Pa Dha Ni Sa'</pre><h4>Avarohan (Descending)</h4><pre>Sa' Ni Dha Pa Ma Ga Re Sa</pre>`,
        lesson_number: 1,
        material_type: 'note',
        is_introductory: true,
        is_very_important: true,
        bullet_points: [
            'Understand the structure of Raag Bilawal.',
            'Identify the Bilawal Thaat.',
            'Recognize all Shuddha Swaras.',
            'Play the Arohan correctly.',
            'Play the Avarohan correctly.',
            'Understand why Bilawal is considered the foundation scale of Hindustani music.'
        ]
    },
    {
        id: 'c24e0200-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Bilawal Note Movements (Pakad)',
        description: `<h3>Overview</h3><p>Students learn the characteristic note movements (Pakad) of Raag Bilawal. These phrases help develop the melodic identity of the raga and improve musical phrasing.</p><h4>Practice</h4><pre>Ga Re Ga\n\nMa Ga Re Sa\n\nPa Dha Ni Dha Pa\n\nGa Ma Pa | Dha Pa Ma Ga</pre>`,
        lesson_number: 2,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Practice each Pakad smoothly.',
            'Maintain proper rhythm.',
            'Develop smooth note transitions.',
            'Recognize the characteristic phrases of Bilawal.',
            'Play with a clear and pleasant tone.'
        ]
    },
    {
        id: 'c24e0300-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Bilawal Alankar Practice',
        description: `<h3>Overview</h3><p>Students practice Alankars based on the Bilawal scale to improve finger coordination, speed control, and note clarity.</p><h4>Practice</h4><p><strong>Ascending</strong></p><pre>Sa Re Ga Ma\nRe Ga Ma Pa\nGa Ma Pa Dha</pre><p><strong>Descending</strong></p><pre>Sa Ni Dha Pa\nNi Dha Pa Ma\nDha Pa Ma Ga</pre>`,
        lesson_number: 3,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice all Alankars accurately.',
            'Maintain equal timing between notes.',
            'Develop finger coordination.',
            'Improve note clarity.',
            'Increase speed gradually with a metronome.'
        ]
    },
    {
        id: 'c24e0400-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Bilawal Composition',
        description: `<h3>Overview</h3><p>Students learn a simple composition in Teentaal or Keherwa while focusing on rhythm, phrasing, and musical expression.</p><h4>Composition</h4><pre>Sa Re Ga Ma | Ga Re Sa\n\nGa Ma Pa Dha | Pa Ma Ga</pre>`,
        lesson_number: 4,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play the composition accurately.',
            'Maintain correct rhythm.',
            'Land correctly on Sam.',
            'Use smooth note transitions.',
            'Perform confidently with a metronome or tabla.'
        ]
    },
    {
        id: 'c24e0500-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Alaap Practice',
        description: `<h3>Overview</h3><p>Students begin developing a slow and expressive Alaap in Raag Bilawal. The emphasis is on breath control, note connection, and expressing the mood of the raga.</p><h4>Practice</h4><pre>Sa... Re... Ga...\n\nGa... Ma... Pa...\n\nPa... Dha... Ni...\n\nNi... Dha... Pa...</pre>`,
        lesson_number: 5,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the purpose of Alaap.',
            'Play slowly with controlled breath.',
            'Connect notes smoothly.',
            'Develop musical expression.',
            'Reflect the character of Raag Bilawal.'
        ]
    },
    {
        id: 'c24e0600-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Merukhand Practice',
        description: `<h3>Overview</h3><p>Students practice Merukhand patterns using the Bilawal scale. These exercises strengthen finger coordination, improve note control, and introduce basic improvisation techniques.</p><h4>Practice</h4><pre>Sa Re Ga Ma\n\nSa Ga Re Ma\n\nRe Ga Ma Sa\n\nGa Ma Re Sa</pre>`,
        lesson_number: 6,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Understand the concept of Merukhand.',
            'Practice each pattern accurately.',
            'Maintain steady rhythm.',
            'Develop finger agility.',
            'Improve creativity and improvisation.'
        ]
    },
    {
        id: 'c24e0700-1111-2222-3333-444444444444',
        chapter_id: 'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        title: 'Song Application',
        description: `<h3>Overview</h3><p>Students apply the Bilawal scale by learning a simple melody or song based on the raga. This helps bridge the gap between technical exercises and practical musical performance.</p><h4>Practice</h4><p>Choose a simple melody based on Raag Bilawal and practice it with a metronome or tabla.</p>`,
        lesson_number: 7,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Play the melody with correct notes.',
            'Maintain steady rhythm.',
            'Apply Bilawal note movements naturally.',
            'Use smooth phrasing and expression.',
            'Perform confidently from beginning to end.'
        ]
    },
    // Level 2, Chapter 5 - Murki, Kan Swar & Meend
    {
        id: 'c25e0100-1111-2222-3333-444444444444',
        chapter_id: 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
        title: 'Introduction to Murki (मुरकी)',
        description: `<h3>Overview</h3><p>Murki is a fast ornamental technique in Hindustani Classical Music. It consists of a quick cluster of notes played around a main note, adding beauty, movement, and expression to a melody. Murki is lighter and faster than Gamak.</p><h4>Example</h4><p>If the main note is Ga: <strong>Re Ga Re Ga</strong></p><h4>Example Phrase</h4><p>Sa (Re Ga Re) Sa</p><h4>Playing Technique</h4><ul><li>Very quick finger movement.</li><li>Light and controlled blowing.</li><li>Notes should sound smooth and connected.</li></ul><h4>Common Usage</h4><ul><li>Light Classical Music</li><li>Bhajans</li><li>Bollywood Songs</li><li>Raag Expression</li></ul><h4>Common Raags</h4><p>Kafi, Khamaj, Pilu</p>`,
        lesson_number: 1,
        material_type: 'note',
        is_introductory: true,
        is_very_important: true,
        bullet_points: [
            'Understand the concept of Murki.',
            'Recognize Murki in musical phrases.',
            'Practice quick finger movement.',
            'Maintain connected notes while playing.',
            'Play Murki with light breath control.'
        ]
    },
    {
        id: 'c25e0200-1111-2222-3333-444444444444',
        chapter_id: 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
        title: 'Introduction to Kan Swar (कण स्वर)',
        description: `<h3>Overview</h3><p>Kan Swar is a grace note played immediately before the main note. The grace note is touched very briefly, adding elegance and emotional expression to the melody.</p><h4>Example</h4><p>Main Note: Ga: <strong>(Re) Ga</strong></p><h4>Example Phrase</h4><p>Sa (Re) Ga Ma</p><h4>Playing Technique</h4><ul><li>Touch the grace note very briefly.</li><li>Use quick finger movement.</li><li>Transition smoothly into the main note.</li><li>Keep the grace note subtle.</li></ul><h4>Benefits</h4><ul><li>Adds classical expression.</li><li>Creates smooth note transitions.</li><li>Enhances melodic beauty.</li></ul>`,
        lesson_number: 2,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Understand the concept of Kan Swar.',
            'Play grace notes smoothly.',
            'Maintain proper finger control.',
            'Avoid emphasizing the grace note.',
            'Use Kan Swar naturally in phrases.'
        ]
    },
    {
        id: 'c25e0300-1111-2222-3333-444444444444',
        chapter_id: 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
        title: 'Introduction to Meend (मींड)',
        description: `<h3>Overview</h3><p>Meend is the smooth glide from one note to another without breaking the sound. It is one of the most expressive techniques in Bansuri and is widely used in Hindustani Classical Music.</p><h4>Example</h4><p>Instead of playing <strong>Sa Ga</strong>, play <strong>Sa ~~~ Ga</strong></p><h4>Practice</h4><p>Sa → Re → Ga</p><h4>Types of Meend</h4><ul><li><strong>Short Meend</strong>: Sa → Re</li><li><strong>Long Meend</strong>: Sa → Ga, Sa → Ma</li><li><strong>Descending Meend</strong>: Pa → Ga</li></ul><h4>Playing Technique</h4><ul><li>Lift the fingers gradually.</li><li>Maintain continuous airflow.</li><li>Avoid breaking the sound.</li><li>Keep the glide smooth and natural.</li></ul>`,
        lesson_number: 3,
        material_type: 'note',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            'Understand the concept of Meend.',
            'Play short Meends smoothly.',
            'Play long Meends with continuous airflow.',
            'Maintain a connected tone throughout.',
            'Develop expressive note transitions.'
        ]
    },
    {
        id: 'c25e0400-1111-2222-3333-444444444444',
        chapter_id: 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
        title: 'Comparison of Murki, Kan Swar & Meend',
        description: `<h3>Overview</h3><p>This topic helps students understand the differences between the three most commonly used ornamentation techniques in Hindustani Classical Music.</p><table class="min-w-full border border-slate-300 dark:border-slate-700 rounded-lg"><thead><tr class="bg-slate-100 dark:bg-slate-800"><th class="p-2 border">Technique</th><th class="p-2 border">Meaning</th><th class="p-2 border">Speed</th><th class="p-2 border">Musical Effect</th></tr></thead><tbody><tr><td class="p-2 border font-semibold">Murki</td><td class="p-2 border">Quick cluster of notes</td><td class="p-2 border">Very Fast</td><td class="p-2 border">Decorative</td></tr><tr><td class="p-2 border font-semibold">Kan Swar</td><td class="p-2 border">Grace note</td><td class="p-2 border">Very Quick</td><td class="p-2 border">Subtle Ornament</td></tr><tr><td class="p-2 border font-semibold">Meend</td><td class="p-2 border">Smooth glide between notes</td><td class="p-2 border">Smooth</td><td class="p-2 border">Expressive</td></tr></tbody></table>`,
        lesson_number: 4,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Differentiate between Murki, Kan Swar, and Meend.',
            'Recognize where each ornament is used.',
            'Understand the musical effect of each technique.',
            'Choose the appropriate ornament for a phrase.'
        ]
    },
    {
        id: 'c25e0500-1111-2222-3333-444444444444',
        chapter_id: 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
        title: 'Applying Ornamentation in Raag Bhoopali',
        description: `<h3>Overview</h3><p>Students learn how Murki, Kan Swar, and Meend can be applied to simple phrases in Raag Bhoopali to make the melody more expressive.</p><h4>Original Phrase</h4><p>Sa Re Ga Pa Dha</p><h4>Ornamentations</h4><ul><li><strong>Kan Swar</strong>: Sa (Re) Ga</li><li><strong>Murki</strong>: Ga Re Ga</li><li><strong>Meend</strong>: Ga ~~~ Pa</li></ul>`,
        lesson_number: 5,
        material_type: 'note',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Apply Kan Swar correctly.',
            'Play Murki with speed and clarity.',
            'Perform Meend smoothly.',
            'Maintain rhythm while using ornamentation.',
            'Use ornamentation naturally in simple phrases.'
        ]
    }
];
