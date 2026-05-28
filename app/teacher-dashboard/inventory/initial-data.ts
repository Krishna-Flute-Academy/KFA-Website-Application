// Interfaces
export interface CourseModule {
    id: string;
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
export const INITIAL_MODULES: CourseModule[] = [
    {
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        title: 'Level 1',
        description: 'Foundation of music theory, notes, and basic rhythm patterns.',
        module_number: 1
    },
    {
        id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        title: 'Level 2',
        description: 'Introduction to scales, major chords, and simple compositions.',
        module_number: 2
    },
    {
        id: 'a3b4c5d6-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        title: 'Level 3',
        description: 'Complex rhythms, dynamic notations, and ear training exercises.',
        module_number: 3
    },
    {
        id: 'a4b5c6d7-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        title: 'Level 4',
        description: 'Professional performance techniques and harmonic analysis.',
        module_number: 4
    },
    // Specialized Modules
    {
        id: 'e2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        title: 'Swar Gyan Ear Training',
        description: 'Master Mandra Saptak ear recognition and vocal tuning guides. Essential for bamboo flute players.',
        module_number: 101
    },
    {
        id: 'f3c4d5e6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
        title: 'Composition 3/4',
        description: 'Classical Waltz meter subdivisions. Features custom skipping alankars and Base Pa compositions.',
        module_number: 102
    },
    {
        id: 'a7b89c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d',
        title: 'Composition 4/4',
        description: 'Standard 4-beat rhythm subdivisions. High-fidelity guides for metronome practices.',
        module_number: 103
    },
    {
        id: 'b8c90d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e',
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
    { id: 'f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 5 - Strong Note Control', description: '3 Essential topics • Breath control and tone stability', chapter_number: 5 },
    { id: 'a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', module_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 6 - Completing Middle Octave', description: '5 Essential topics • Alankars and first songs', chapter_number: 6 },
    
    // Level 2 Chapters
    { id: 'd48691c0-a49a-4b0c-a1a5-e56ba0386994', module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: 'Chapter 1 - Elementary Scales', description: '4 Essential topics • Scale structures', chapter_number: 1 },
    
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
        description: 'Using 4/4 rhythm with metronome.',
        lesson_number: 1,
        material_type: 'video',
        duration: 'VIDEO • 11:30',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'Practice patterns:',
            '1. 1234',
            '2. 1234 – 4321',
            '3. 21 pattern',
            '4. 123 pattern',
            'These improve:',
            '* finger control',
            '* rhythm',
            '* note clarity'
        ]
    },
    {
        id: 'c04e0200-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Pyramid Practice',
        description: 'Master smooth transitions between registers using the pyramid structure.',
        lesson_number: 2,
        material_type: 'pdf',
        file_size: '0.9MB',
        duration: 'PDF • 0.9MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: []
    },
    {
        id: 'c04e0300-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'More Alankar / Palta Practice',
        description: 'Practice these 12 patterns to build note clarity and speed.',
        lesson_number: 3,
        material_type: 'pdf',
        file_size: '1.6MB',
        duration: 'PDF • 1.6MB',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            'P.D.N.S SN.D.P. | D.N.SR RSN.D. | N.SRG GRSN. | SRGm mGRS | - Reverse ( mGRS SRGm )',
            'P.D.N.S RSN.D. | D.N.SR GRSN. | NSRG mGRS | - Reverse',
            'P.D.N. |D.N.S|N. S R| S R G | R G m | - ( It will be 3/4 rhythm)',
            'P.D.N.S | D.N.SR | N.SRG | SRGm | - Reverse',
            'P.D.N. P.D.N. P.D. | D.N.S D.N.S D.N. | N.SR N.SR N.S | SRG SRG SR | RGm RGm RG',
            'D.P N.D. SN. RS GR mG - Reverse ( Gm, RG, SR N.S, D.N., P.D.)',
            'P.N. D.S NR SG Rm ( SKIPPING ONE NOTE)',
            'N.D.P, SN.D., RSN., GRS, mGR, - Reverse',
            'P.D. P.D. P.D. P.D. | D.N. D.N. D.N. D.N. N.S N.S N.S N.S - CONTINUTE TO SUDHA MA',
            'P.D.N.S P.D.N.S P.D.N.S P.D.N.S | D.N.SR D.N.SR D.N.SR D.N.SR | N.SRG N.SRG N.SRG N.SRG | SRGm SRGm SRGm SRGm',
            'P.D. P.D. P.D.N. | D.N. D.N. D.N.S | N.S N.S N.SR | SR SR SRG | RG RG RGm',
            'SN.D.P.| RSN.D. |GRSN. |mGRS | - REVERSE'
        ]
    },
    {
        id: 'c04e0400-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Composition',
        description: 'First short musical composition combining rhythm intervals and pauses in lower octave.',
        lesson_number: 4,
        material_type: 'video',
        duration: 'VIDEO • 09:15',
        is_introductory: false,
        is_very_important: false,
        bullet_points: [
            '1. D.N.D. | S - - |'
        ]
    },
    {
        id: 'c04e0500-1111-2222-3333-444444444444',
        chapter_id: 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
        title: 'Songs',
        description: 'Learn to play three famous songs on the bamboo bansuri.',
        lesson_number: 5,
        material_type: 'video',
        duration: 'VIDEO • 15:45',
        is_introductory: false,
        is_very_important: true,
        bullet_points: [
            '1. Bella ciao',
            '2. DDLJ',
            '3. Achyutam Keshavam'
        ]
    }
];

