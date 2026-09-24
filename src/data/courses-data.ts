export interface ProgressionStage {
    stage: string;
    title: string;
    description: string;
}

export interface FAQItem {
    question: string;
    answer: string;
}

export interface CourseData {
    slug: string;
    title: string;
    badge: string;
    h1: string;
    heroSubtitle: string;
    opening: string;
    localAndOnlineNote: string;
    targetAudience: string[];
    whatYouWillLearn: { title: string; description: string }[];
    progressionStages: ProgressionStage[];
    expectedOutcomes: string[];
    faqs: FAQItem[];
    whatsappMessage: string;
    seoTitle: string;
    metaDescription: string;
    heroImage: string;
    cardColor: string;
    accentColor: string;
    inquiryCourseValue: string;
}

export const COURSES_DATA: Record<string, CourseData> = {
    'beginner-bansuri': {
        slug: 'beginner-bansuri',
        title: 'Beginner Bansuri Course',
        badge: 'Level 1 • Foundation',
        h1: 'Beginner Bansuri Classes',
        heroSubtitle: 'Start your journey with Indian Classical Flute through clear, structured, step-by-step guidance.',
        opening: `Want to learn Bansuri but don't know where to begin?

The Beginner Bansuri Course at Krishna Flute Academy is designed for students starting from the very beginning. You do not need previous knowledge of Indian classical music or experience playing the flute.

The focus is on developing the right foundation—sound, breath, Swaras, rhythm, coordination and musical confidence—through structured guidance.`,
        localAndOnlineNote: 'Learn Bansuri with structured guidance from Krishna Flute Academy in Bangalore (Bengaluru), with online learning options for students beyond the city.',
        targetAudience: [
            'Complete beginners with zero prior music experience or flute background',
            'Self-taught learners who want structured guidance to correct their embouchure and finger positioning',
            'Adults fulfilling a lifelong aspiration to learn Hindustani Classical Music',
            'Students seeking a disciplined, patient, teacher-led approach from the first sound'
        ],
        whatYouWillLearn: [
            {
                title: 'Clear Sound Production',
                description: 'Master lip placement, air angle, and blowing mechanics to produce a clean, resonant flute tone consistently.'
            },
            {
                title: 'Ergonomic Posture',
                description: 'Learn healthy holding postures and relaxed finger placement to play comfortably without physical tension.'
            },
            {
                title: 'Swara & Note Awareness',
                description: 'Understand the foundational pure notes (Shuddha Swaras) across natural playing registers.'
            },
            {
                title: 'Rhythm & Beat Basics',
                description: 'Develop steady timing, beat counting, and coordination between breath and finger movements.'
            },
            {
                title: 'Foundation Exercises',
                description: 'Practice structured patterns and finger movement exercises to build dexterity and tone stability.'
            },
            {
                title: 'Simple Melodies',
                description: 'Bring notes together into your first classical phrases, devotional melodies, and simple songs.'
            }
        ],
        progressionStages: [
            {
                stage: 'Stage 1',
                title: 'Sound Generation & Tone Stability',
                description: 'Focusing on lip positioning (embouchure), natural breath flow, and producing a round, clear first tone without strain or breathiness.'
            },
            {
                stage: 'Stage 2',
                title: 'Swara Mastery & Finger Placement',
                description: 'Gradually learning the finger positions for natural notes, building muscle memory, and ensuring accurate, airtight hole coverage.'
            },
            {
                stage: 'Stage 3',
                title: 'Breath Continuity & Rhythm Introduction',
                description: 'Developing sustained breath control, smooth transitions between notes, and practicing steady tempo with simple rhythm cycles.'
            },
            {
                stage: 'Stage 4',
                title: 'Melodic Fluency & Simple Compositions',
                description: 'Synthesizing finger movement, breath, and rhythm to play foundational melodic patterns, devotional phrases, and beginner songs with ease.'
            }
        ],
        expectedOutcomes: [
            'Produce a clear, stable, and resonant sound without breathiness or physical strain',
            'Hold the flute with relaxed, ergonomic hand and body posture',
            'Accurately play the foundational natural notes in ascent and descent',
            'Maintain steady tempo and rhythm using simple metronome counting',
            'Play simple devotional melodies and classical exercises with confidence'
        ],
        faqs: [
            {
                question: 'Do I need previous musical experience to learn Bansuri?',
                answer: 'No previous musical background is required. The Beginner course starts from the absolute fundamentals—how to hold the flute, how to blow air, and how to produce your very first sound.'
            },
            {
                question: 'Which Bansuri should a beginner buy?',
                answer: 'Most beginners start with a medium-sized flute, typically in the key of C Natural (Medium) or G Natural (Bass), depending on hand size and finger comfort. We encourage prospective students to speak with us before purchasing so we can recommend the ideal flute for your ergonomics.'
            },
            {
                question: 'Can I learn Bansuri online?',
                answer: 'Yes. Krishna Flute Academy teaches students across India and internationally through live online sessions, complete with personalized video feedback, posture correction, and structured Riyaz guidelines.'
            },
            {
                question: 'How do I know whether the Beginner course is right for me?',
                answer: 'If you have never played the flute, struggle to get a consistent clear sound, or cannot smoothly play the basic notes, the Beginner course is the right starting point.'
            },
            {
                question: 'I have learned from YouTube before. Where should I start?',
                answer: 'Many self-taught learners develop habits like partial finger sealing or improper blowing angles. We can review your playing in a quick discussion to determine whether you should begin with the foundational level or start at Intermediate.'
            },
            {
                question: 'How can I enquire about Bansuri classes?',
                answer: 'You can submit the enquiry form below or reach out directly on WhatsApp. We will discuss your background, schedule preferences, and help you get started.'
            }
        ],
        whatsappMessage: 'Hello Krishna Flute Academy, I am interested in learning Bansuri. I was reading about the Beginner Bansuri Course and would like to discuss whether this is the right level for me.',
        seoTitle: 'Beginner Bansuri Classes | Learn Indian Flute | Krishna Flute Academy',
        metaDescription: 'Learn Bansuri from the basics with structured guidance at Krishna Flute Academy. Develop sound, breath, Swaras, rhythm and confidence. Enquire about beginner Bansuri classes.',
        heroImage: '/hero-image-1.jpg',
        cardColor: 'from-blue-600 to-blue-800',
        accentColor: 'blue',
        inquiryCourseValue: 'Beginner Course'
    },

    'intermediate-bansuri': {
        slug: 'intermediate-bansuri',
        title: 'Intermediate Bansuri Course',
        badge: 'Level 2 • Technique & Expression',
        h1: 'Intermediate Bansuri Classes',
        heroSubtitle: 'Develop clean technique, expressive ornamentation, and an authentic understanding of Raga and Taal.',
        opening: `If you can already play basic Swaras and simple melodies but feel that your playing needs better control, expression and musical understanding, the Intermediate Bansuri Course can help you take the next step.

The course focuses on developing technique, tone, expressive Bansuri playing and a deeper introduction to Raga and Taal.`,
        localAndOnlineNote: 'Learn Bansuri with structured guidance from Krishna Flute Academy in Bangalore (Bengaluru), with interactive online learning options for students worldwide.',
        targetAudience: [
            'Students who can produce a stable tone and play basic notes fluently',
            'Self-taught players seeking to transition from casual playing into genuine classical flute musicianship',
            'Flutists wanting to master core classical ornamentation: Meend (glides), Kan Swar (grace notes), and Murki',
            'Learners ready to explore traditional Ragas, rhythm cycles (Taal), and melodic phrasing'
        ],
        whatYouWillLearn: [
            {
                title: 'Classical Ornamentation',
                description: 'Master Kan Swar (grace notes), Murki (rapid decorative turns), and Meend (smooth vocal glides).'
            },
            {
                title: 'Expanded Playing Range',
                description: 'Connect lower register notes seamlessly all the way to upper octave registers with uniform tone.'
            },
            {
                title: 'Altered Swara Awareness',
                description: 'Learn half-hole fingering techniques and subtle pitch shading for Komal and Tivra notes.'
            },
            {
                title: 'Introduction to Ragas',
                description: 'Study foundational ragas, understanding ascending, descending, and characteristic melodic movements.'
            },
            {
                title: 'Taal & Rhythm Frameworks',
                description: 'Play within traditional rhythmic frameworks including Teentaal, Keherwa, and Dadra.'
            },
            {
                title: 'Musical Phrasing',
                description: 'Infuse feeling, breath dynamics, and intentional pauses into light classical compositions and traditional melodies.'
            }
        ],
        progressionStages: [
            {
                stage: 'Stage 1',
                title: 'Octave Extension & Pitch Control',
                description: 'Expanding your playing range across the lower and upper registers with consistent tonal richness, smooth transitions, and dynamic breath control.'
            },
            {
                stage: 'Stage 2',
                title: 'Expressive Ornamentation Techniques',
                description: 'Learning subtle micro-techniques such as Meend (smooth vocal glides), Kan Swar (grace notes), and Murki (graceful embellishments) that give the flute its vocal character.'
            },
            {
                stage: 'Stage 3',
                title: 'Introduction to Ragas & Traditional Taal',
                description: 'Understanding the aesthetic mood, rules, ascending/descending structures, and rhythm cycles that form the backbone of Indian classical music.'
            },
            {
                stage: 'Stage 4',
                title: 'Musical Phrasing & Repertoire',
                description: 'Connecting classical phrasing with expressive nuance, mastering traditional compositions, and playing with emotional depth and artistic confidence.'
            }
        ],
        expectedOutcomes: [
            'Seamlessly navigate between lower, middle, and upper octave registers with stable intonation',
            'Apply Meend, Murki, and Kan Swar naturally to bring out the vocal quality of the Bansuri',
            'Perform traditional classical compositions with proper rhythm accompaniment',
            'Understand the fundamental grammar and characteristic phrases of foundational classical ragas',
            'Demonstrate greater breath endurance, dynamic expression, and phrasing clarity'
        ],
        faqs: [
            {
                question: 'What prerequisites are expected for the Intermediate course?',
                answer: 'You should be able to produce a clear, sustained sound and play basic middle octave notes fluently. If you are unsure whether your technique is ready, we provide a quick level assessment before you join.'
            },
            {
                question: 'Will I learn classical Hindustani Ragas at this level?',
                answer: 'Yes. The Intermediate course introduces traditional Hindustani Classical Ragas, focusing on scale structures, characteristic melodic phrases, and traditional compositions (Bandishes).'
            },
            {
                question: 'Which flute keys are used in the Intermediate course?',
                answer: 'Students typically use an E Bass, F Natural, or C Natural medium flute, depending on their hand size and classical repertoire requirements.'
            },
            {
                question: 'Can I learn expressive techniques like Meend and Murki?',
                answer: 'Yes, expressive ornamentation—including Meend (smooth glides), Kan Swar (touch notes), and Murki (rapid decorative turns)—is a primary focus of the Intermediate level.'
            },
            {
                question: 'How do I know whether to join Beginner or Intermediate?',
                answer: 'If you can already blow a clean sound and play basic scales smoothly, Intermediate is likely your natural fit. Connect with us on WhatsApp for a quick level assessment.'
            }
        ],
        whatsappMessage: 'Hello Krishna Flute Academy, I currently play Bansuri and am looking to develop my technique and raga understanding. I would like to discuss whether the Intermediate Bansuri Course is right for me.',
        seoTitle: 'Intermediate Bansuri Classes | Indian Classical Flute | Krishna Flute Academy',
        metaDescription: 'Develop your Bansuri technique, classical ornamentation (Meend, Murki), Raga and Taal with structured guidance at Krishna Flute Academy. Enquire now.',
        heroImage: '/hero-image-2.jpg',
        cardColor: 'from-amber-600 to-amber-700',
        accentColor: 'amber',
        inquiryCourseValue: 'Intermediate Course'
    },

    'advanced-bansuri': {
        slug: 'advanced-bansuri',
        title: 'Advanced Bansuri Course',
        badge: 'Level 3 • Mastery & Performance',
        h1: 'Advanced Bansuri Classes',
        heroSubtitle: 'Deepen your mastery of Raga, spontaneous improvisation, intricate Layakari, and performance artistry.',
        opening: `For flute players with a sound technical foundation who want to deepen their understanding of Indian Classical Music, explore complex Ragas, and develop independence as an improviser.

The Advanced Bansuri Course guides students through in-depth Raga exploration, intricate rhythmic variations, and recital presentation.`,
        localAndOnlineNote: 'Master-level guidance from Guru Krishna Gopal Bhaumik in Bangalore (Bengaluru) and live online for advanced practitioners worldwide.',
        targetAudience: [
            'Intermediate flutists with solid command over middle and upper registers',
            'Musicians seeking authentic Gayaki Ang (vocal style) flute expression under direct guru guidance',
            'Performers preparing for stage concerts, recordings, or advanced classical music examinations',
            'Practitioners wanting to master Alaap-Jod-Jhala, complex Layakari, and spontaneous Taans'
        ],
        whatYouWillLearn: [
            {
                title: 'In-Depth Raga Delineation',
                description: 'Explore aesthetic nuances, microtonal inflections, and the emotional essence of morning, evening, and night ragas.'
            },
            {
                title: 'Gayaki Ang Style',
                description: 'Emulate vocal intricacies, intricate Gamaks, and prolonged vocal meends that define the Maihar and classical traditions.'
            },
            {
                title: 'Alaap, Jod & Jhala',
                description: 'Master unmetered melodic development, meditative alaap phrasing, and rhythmic accelerations.'
            },
            {
                title: 'Layakari & Complex Rhythm',
                description: 'Execute rhythmic subdivisions (Thaah, Dugun, Chaugun), Tihais, and offbeat cross-rhythms with confidence.'
            },
            {
                title: 'Spontaneous Improvisation',
                description: 'Develop melodic autonomy to improvise original Taans and Badhat within strict raga discipline.'
            },
            {
                title: 'Recital Architecture',
                description: 'Structure complete classical performances, from meditative opening phrases to high-energy climaxes.'
            }
        ],
        progressionStages: [
            {
                stage: 'Stage 1',
                title: 'Raga Architecture & Aesthetic Depth',
                description: 'Delving into classical ragas, microtonal nuances (Shrutis), and exploring characteristic melodic movements with artistic depth.'
            },
            {
                stage: 'Stage 2',
                title: 'Spontaneous Improvisation (Alaap & Jod)',
                description: 'Mastering unmetered melodic development, gradual tempo expansion, and building an authentic, meditative raga atmosphere.'
            },
            {
                stage: 'Stage 3',
                title: 'Rhythmic Complexity & Layakari',
                description: 'Cultivating advanced rhythmic control, cross-rhythmic subdivisions, intricate taans, and precise interplay with percussion.'
            },
            {
                stage: 'Stage 4',
                title: 'Artistic Identity & Recital Readiness',
                description: 'Developing full performance endurance, personal musical expression, and preparing complete concert-style presentations.'
            }
        ],
        expectedOutcomes: [
            'Present full classical Raga recitals with Alaap, Jod, Vilambit, and Drut Bandishes',
            'Improvise spontaneously with authentic aesthetic fidelity to the chosen Raga',
            'Navigate complex rhythmic calculations (Layakari and Tihais) accurately on tempo',
            'Demonstrate the refined vocal (Gayaki) style with profound tonal control and dynamic expression',
            'Perform publicly with artistic confidence, poise, and stage maturity'
        ],
        faqs: [
            {
                question: 'What is the eligibility for the Advanced Bansuri Course?',
                answer: 'Students should have completed intermediate training or demonstrate equivalent mastery of raga basics, clear upper-octave tone, and comfort with rhythm cycles like Teentaal. An audition/assessment is conducted before admission.'
            },
            {
                question: 'Does this course cover Gayaki Ang (vocal style) playing?',
                answer: 'Yes. Guru Krishna Gopal Bhaumik specializes in the traditional vocal style, guiding students on how to breathe life and soulful vocal inflections into the bamboo flute.'
            },
            {
                question: 'What flutes are required for Advanced training?',
                answer: 'Advanced students typically practice on professional E Bass (approx 30 inches) or C Bass flutes, crafted specifically for concert resonance and precise microtonal tuning.'
            },
            {
                question: 'How do I request an audition or level evaluation?',
                answer: 'You can submit a short audio or video recording or schedule a discussion with the academy. We will review your background and provide direct recommendations.'
            }
        ],
        whatsappMessage: 'Hello Krishna Flute Academy, I am an experienced Bansuri player interested in advanced classical training and raga exploration with Guru Krishna Gopal Bhaumik. I would like to arrange an assessment.',
        seoTitle: 'Advanced Bansuri Classes | Classical Flute Mastery | Krishna Flute Academy',
        metaDescription: 'Master classical Raga improvisation, Alaap, Layakari, and performance artistry with Guru Krishna Gopal Bhaumik at Krishna Flute Academy. Enquire now.',
        heroImage: '/hero-image-3.jpg',
        cardColor: 'from-indigo-700 to-slate-900',
        accentColor: 'indigo',
        inquiryCourseValue: 'Advanced Course'
    },

    'kids-bansuri': {
        slug: 'kids-bansuri',
        title: 'Bansuri for Kids',
        badge: 'Young Learners • Ages 6–14',
        h1: 'Bansuri Classes for Kids',
        heroSubtitle: 'An encouraging, patient introduction to music through the joyful sound of the Indian Flute.',
        opening: `Introducing children to music early develops concentration, listening ability, respiratory health and cultural appreciation.

The Bansuri Program for Kids at Krishna Flute Academy is designed specifically for young learners aged 6 to 14, using a gentle, encouraging and engaging teaching approach.`,
        localAndOnlineNote: 'In-person classes in Bangalore (Bengaluru) and interactive online lessons for young learners across India and abroad.',
        targetAudience: [
            'Children aged 6 to 14 exploring music for the first time',
            'Kids with natural curiosity about blowing instruments or traditional Indian music',
            'Parents seeking screen-free, meditative, and focus-enhancing creative hobbies for their children',
            'Young learners who thrive in a patient, positive, and supportive teacher-guided environment'
        ],
        whatYouWillLearn: [
            {
                title: 'Natural Sound & Breath',
                description: 'Fun, gentle blowing exercises that make sound production enjoyable without forceful blowing.'
            },
            {
                title: 'Easy Finger Placement',
                description: 'Holding smaller, lightweight flutes comfortably with relaxed fingers tailored to child hand sizes.'
            },
            {
                title: 'Swara Recognition & Singing',
                description: 'Associating Swaras with musical sounds through singing and flute play, training the musical ear.'
            },
            {
                title: 'Rhythm & Clapping Games',
                description: 'Developing timing, coordination, and rhythm through interactive beat counting and musical games.'
            },
            {
                title: 'Simple Melodies & Songs',
                description: 'Learning children\'s rhymes, simple devotional tunes, and easy classical patterns.'
            },
            {
                title: 'Focus & Musical Confidence',
                description: 'Building patience, regular practice habits, and the joy of sharing music with friends and family.'
            }
        ],
        progressionStages: [
            {
                stage: 'Stage 1',
                title: 'Playful Discovery & Sound Exploration',
                description: 'Helping young children feel comfortable with the instrument, exploring sounds naturally, and developing correct blowing without tension.'
            },
            {
                stage: 'Stage 2',
                title: 'Listening & Rhythm Games',
                description: 'Engaging ear-training activities that connect musical beats to clapping, simple rhymes, and joyful rhythmic patterns.'
            },
            {
                stage: 'Stage 3',
                title: 'First Notes & Melodic Steps',
                description: 'Learning easy finger positions step-by-step through fun visual cues and playing simple, recognizable tunes.'
            },
            {
                stage: 'Stage 4',
                title: 'Creative Confidence & Joyful Expression',
                description: 'Encouraging self-expression, performing for family, and building a lifelong love and appreciation for Indian music.'
            }
        ],
        expectedOutcomes: [
            'Produce a clear, gentle sound on a child-friendly Bansuri comfortably',
            'Recognize and play foundational Swaras with correct finger placement',
            'Demonstrate improved auditory listening, rhythm, and beat coordination',
            'Play simple traditional songs, nursery tunes, and basic classical exercises',
            'Develop concentration, screen-free discipline, and genuine enthusiasm for music'
        ],
        faqs: [
            {
                question: 'At what age can a child start learning Bansuri?',
                answer: 'Children can comfortably start from age 6 or 7, once they can blow air steadily and their fingers can comfortably reach the holes of a small, lightweight child-sized flute.'
            },
            {
                question: 'Are smaller flutes available for small children\'s hands?',
                answer: 'Yes. We recommend smaller, high-pitched flutes (such as G Medium or A Medium) that have closely spaced holes, allowing young children to play without stretching their fingers.'
            },
            {
                question: 'How are lessons made engaging for kids?',
                answer: 'Lessons are paced gently with a mix of ear-training, singing, rhythm clapping games, and short practice routines so children stay curious, motivated, and happy.'
            },
            {
                question: 'Can children learn Bansuri online effectively?',
                answer: 'Yes. Our online kids classes are highly interactive. Parents often observe how quickly young children adapt to video lessons with teacher-guided encouragement.'
            },
            {
                question: 'How should parents prepare before the first class?',
                answer: 'Connect with us on WhatsApp or phone. We will advise you on the exact flute size suitable for your child\'s age and hand dimensions before classes begin.'
            }
        ],
        whatsappMessage: 'Hello Krishna Flute Academy, I am interested in Bansuri classes for my child. I would like to learn more about the Kids Program and discuss appropriate flute sizing.',
        seoTitle: 'Bansuri Classes for Kids | Indian Flute for Children | Krishna Flute Academy',
        metaDescription: 'Encouraging and patient Bansuri lessons for kids aged 6–14 at Krishna Flute Academy. Learn in Bangalore or online. Enquire today.',
        heroImage: '/hero-image-kids.jpg',
        cardColor: 'from-emerald-600 to-teal-800',
        accentColor: 'emerald',
        inquiryCourseValue: 'Kids Program'
    }
};
