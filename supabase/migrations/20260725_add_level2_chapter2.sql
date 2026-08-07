-- Level 2 / Chapter 2: Composition and Song Practice

-- 1. Insert/Update Chapter
INSERT INTO public.course_chapters (id, module_id, title, description, chapter_number)
VALUES (
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Composition and Song Practice',
  '<p><strong>Chapter Completion Goals:</strong></p><ul><li>Understand the structure of a musical composition.</li><li>Perform simple flute compositions confidently.</li><li>Connect notes into expressive musical phrases.</li><li>Play beginner Bollywood songs and Bhajans.</li><li>Apply different rhythm cycles while performing.</li><li>Use basic musical expression to enhance their playing.</li></ul>',
  2
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  chapter_number = EXCLUDED.chapter_number,
  updated_at = now();

-- 2. Insert/Update Lessons (Topics 1 - 7)
INSERT INTO public.course_lessons (id, chapter_id, title, description, lesson_number, material_type, is_introductory, is_very_important, bullet_points)
VALUES
(
  'c22e0100-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Introduction to Musical Composition',
  '<h3>Overview</h3><p>In this topic, students are introduced to the concept of a musical composition (Bandish/Dhun). They learn how individual notes combine to form musical phrases and how rhythm, breath control, and expression bring a melody to life.</p><h4>Concepts</h4><ul><li>What is a Composition (Bandish / Dhun)?</li><li>How notes form musical phrases.</li><li>Importance of rhythm and expression.</li></ul>',
  1,
  'note',
  true,
  true,
  ARRAY[
    'Understand the concept of a musical composition.',
    'Recognize musical phrases.',
    'Maintain smooth note transitions.',
    'Play with correct rhythm.',
    'Develop basic musical expression.'
  ]
),
(
  'c22e0200-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Basic Flute Compositions',
  '<h3>Overview</h3><p>Students learn simple flute compositions that strengthen note relationships, rhythm, and finger coordination while improving confidence in playing melodic phrases.</p><h4>Practice Patterns</h4><p><strong>Practice 1 – SPPS Composition</strong></p><pre>Sa Pa Pa Sa

Pa Pa Sa</pre><p><strong>Practice 2 – P.P.P. DPP Composition</strong></p><pre>P. P. P.

D P P</pre>',
  2,
  'note',
  false,
  true,
  ARRAY[
    'Play both compositions accurately.',
    'Maintain a steady rhythm.',
    'Develop the relationship between Sa and Pa.',
    'Improve Lower Octave control.',
    'Produce a clear and consistent tone.'
  ]
),
(
  'c22e0300-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Melody Development Exercises',
  '<h3>Overview</h3><p>These exercises help students connect notes into meaningful musical phrases while improving breath control, phrasing, and note continuity.</p><h4>Practice</h4><pre>Sa Re Ga Ma | Ga Re Sa
Ga Ma Pa Dha | Pa Ma Ga
Sa Ga Ma Pa | Dha Pa Ma</pre>',
  3,
  'note',
  false,
  false,
  ARRAY[
    'Play melodic phrases smoothly.',
    'Maintain proper breath control.',
    'Connect notes without breaks.',
    'Develop musical phrasing.',
    'Play with consistent rhythm.'
  ]
),
(
  'c22e0400-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Bollywood Song Practice',
  '<h3>Overview</h3><p>Students apply their technical skills by learning familiar Bollywood melodies. These songs improve melody recognition, rhythm, expression, and overall musical confidence.</p><h4>Songs</h4><ul><li>Titan Theme</li><li>Ye Dosti</li><li>Chookar Mere Man Ko</li><li>Aa Chal Ke Tujhe</li></ul>',
  4,
  'note',
  false,
  false,
  ARRAY[
    'Play each melody accurately.',
    'Maintain the correct rhythm.',
    'Use smooth note transitions.',
    'Develop musical expression.',
    'Perform songs confidently.'
  ]
),
(
  'c22e0500-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Bhajan Practice',
  '<h3>Overview</h3><p>Bhajans help students develop slow, expressive playing while improving breath control and emotional connection with the music.</p><h4>Bhajans</h4><ul><li>Achyutam Keshavam</li><li>Om Jai Jagdish Hare</li><li>Shri Krishna Govinda Hare Murari</li></ul>',
  5,
  'note',
  false,
  false,
  ARRAY[
    'Play bhajans with a steady tempo.',
    'Maintain smooth blowing.',
    'Use expressive phrasing.',
    'Produce a pleasant tone.',
    'Develop emotional expression.'
  ]
),
(
  'c22e0600-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Rhythm Application',
  '<h3>Overview</h3><p>Students learn to apply different rhythmic cycles while playing compositions and songs using a metronome or tabla accompaniment.</p><h4>Practice Rhythms</h4><p><strong>4/4 Rhythm</strong></p><pre>1 2 3 4</pre><p><strong>Keherwa (8 Beats)</strong></p><pre>Dha Ge Na Ti | Na Ka Dhi Na</pre><p><strong>Dadra (6 Beats)</strong></p><pre>Dha Dhi Na | Dha Tu Na</pre>',
  6,
  'note',
  false,
  false,
  ARRAY[
    'Practice songs in different rhythms.',
    'Maintain accurate timing.',
    'Play confidently with a metronome.',
    'Understand Keherwa and Dadra rhythm cycles.',
    'Develop rhythmic consistency.'
  ]
),
(
  'c22e0700-1111-2222-3333-444444444444',
  'f2a3b4c5-d6e7-8f9a-0b1c-2d3e4f5a6b7c',
  'Musical Expression Practice',
  '<h3>Overview</h3><p>This topic introduces the fundamentals of musical expression. Students learn how small changes in emphasis, pauses, and breath control can make a performance more expressive and engaging.</p><h4>Practice Concepts</h4><ul><li>Note emphasis</li><li>Musical pauses</li><li>Dynamic blowing</li><li>Phrase shaping</li></ul>',
  7,
  'note',
  false,
  false,
  ARRAY[
    'Understand basic musical expression.',
    'Apply note emphasis appropriately.',
    'Use pauses naturally between phrases.',
    'Control blowing dynamics.',
    'Play songs with feeling instead of mechanically.'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  lesson_number = EXCLUDED.lesson_number,
  material_type = EXCLUDED.material_type,
  is_introductory = EXCLUDED.is_introductory,
  is_very_important = EXCLUDED.is_very_important,
  bullet_points = EXCLUDED.bullet_points,
  updated_at = now();
