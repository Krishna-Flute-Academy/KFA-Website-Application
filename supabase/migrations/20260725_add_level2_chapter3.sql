-- Level 2 / Chapter 3: Introduction to Raag and Classical Structure

-- 1. Insert/Update Chapter
INSERT INTO public.course_chapters (id, module_id, title, description, chapter_number)
VALUES (
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Introduction to Raag and Classical Structure',
  '<p><strong>Chapter Completion Goals:</strong></p><ul><li>Understand the structure of Teentaal.</li><li>Play confidently in a 16-beat rhythm cycle.</li><li>Perform the Arohan and Avarohan of Raag Bhoopali.</li><li>Play characteristic Bhoopali phrases.</li><li>Perform a simple Bhoopali composition in Teentaal.</li><li>Understand and practice basic Merukhand.</li><li>Play a simple Alaap with expression and proper breath control.</li></ul>',
  3
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
  'c23e0100-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Understanding Teentaal',
  '<h3>Overview</h3><p>Teentaal is the most commonly used rhythm cycle in Hindustani Classical Music. In this topic, students learn its 16-beat structure, clap and wave pattern, and the basic tabla theka. They also practice scales and Alankars within Teentaal to develop rhythmic awareness.</p><h4>Teentaal Structure</h4><p><strong>16 Beats</strong></p><p>1 (Clap) | 5 (Clap) | 9 (Wave) | 13 (Clap)</p><h4>Basic Theka</h4><pre>Dha Dhin Dhin Dha\nDha Dhin Dhin Dha\nDha Tin Tin Ta\nTa Dhin Dhin Dha</pre><h4>Practice</h4><ul><li>Sa Re Ga Ma in Teentaal</li><li>Simple Alankars in Teentaal</li></ul>',
  1,
  'note',
  true,
  true,
  ARRAY[
    'Understand the structure of Teentaal.',
    'Identify Sam, Tali, and Khali.',
    'Recite the Teentaal theka correctly.',
    'Practice scales in Teentaal.',
    'Practice Alankars with a metronome or tabla.',
    'Develop rhythmic awareness.'
  ]
),
(
  'c23e0200-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Introduction to Raag Bhoopali',
  '<h3>Overview</h3><p>Students are introduced to Raag Bhoopali, one of the most popular beginner ragas in Hindustani Classical Music. They learn its note structure, ascending and descending scales, and the mood it creates.</p><h4>Notes Used</h4><p>Sa Re Ga Pa Dha Sa''</p><h4>Notes Omitted</h4><p>Ma and Ni</p><h4>Arohan (Ascending)</h4><pre>Sa Re Ga Pa Dha Sa''</pre><h4>Avarohan (Descending)</h4><pre>Sa'' Dha Pa Ga Re Sa</pre>',
  2,
  'note',
  false,
  true,
  ARRAY[
    'Understand the structure of Raag Bhoopali.',
    'Identify the notes used in the raga.',
    'Recognize the omitted notes.',
    'Play the Arohan correctly.',
    'Play the Avarohan correctly.',
    'Understand the mood and character of Bhoopali.'
  ]
),
(
  'c23e0300-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Bhoopali Note Movements',
  '<h3>Overview</h3><p>Students practice the characteristic note movements (Pakad and basic phrases) of Raag Bhoopali. These exercises develop smooth fingering and introduce the melodic identity of the raga.</p><h4>Practice</h4><pre>Sa Re Ga

Ga Pa Dha

Dha Pa Ga

Ga Re Sa</pre>',
  3,
  'note',
  false,
  false,
  ARRAY[
    'Practice each phrase smoothly.',
    'Maintain proper rhythm.',
    'Develop expressive note transitions.',
    'Produce a clear tone.',
    'Recognize the characteristic movement of Bhoopali.'
  ]
),
(
  'c23e0400-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Bhoopali Composition',
  '<h3>Overview</h3><p>Students learn a simple classical composition in Raag Bhoopali and practice it with Teentaal using a metronome or tabla.</p><h4>Composition</h4><pre>Sa Re Ga | Pa Dha Pa

Ga Re Sa | Re Ga Pa</pre>',
  4,
  'note',
  false,
  false,
  ARRAY[
    'Play the composition accurately.',
    'Maintain Teentaal throughout.',
    'Land correctly on Sam.',
    'Use smooth phrasing.',
    'Perform confidently with tabla or metronome.'
  ]
),
(
  'c23e0500-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Understanding Merukhand',
  '<h3>Overview</h3><p>Students are introduced to Merukhand, a classical practice method that rearranges note sequences to improve finger control, creativity, and improvisation skills.</p><h4>Purpose</h4><ul><li>Develop improvisation ability.</li><li>Strengthen note control.</li><li>Improve finger coordination.</li><li>Enhance musical creativity.</li></ul>',
  5,
  'note',
  false,
  false,
  ARRAY[
    'Understand the concept of Merukhand.',
    'Recognize different note combinations.',
    'Practice slowly with correct rhythm.',
    'Maintain note clarity.',
    'Develop improvisation skills.'
  ]
),
(
  'c23e0600-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Bhoopali Merukhand Practice',
  '<h3>Overview</h3><p>Students practice Merukhand patterns using the notes of Raag Bhoopali to improve flexibility, creativity, and rhythmic accuracy.</p><h4>Practice</h4><pre>Sa Re Ga Pa

Sa Ga Re Pa

Re Ga Pa Sa

Ga Pa Re Sa</pre>',
  6,
  'note',
  false,
  false,
  ARRAY[
    'Practice all Merukhand patterns accurately.',
    'Maintain equal timing between notes.',
    'Develop finger agility.',
    'Improve note clarity.',
    'Increase speed gradually using a metronome.'
  ]
),
(
  'c23e0700-1111-2222-3333-444444444444',
  'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  'Introduction to Alaap',
  '<h3>Overview</h3><p>Students learn the basics of Alaap, the slow and expressive introduction to a raga. The focus is on developing musical expression, breath control, and understanding the emotional mood of Raag Bhoopali.</p><h4>Practice</h4><pre>Sa... Re... Ga...

Ga... Pa... Dha...

Dha... Pa... Ga...

Re... Sa...</pre>',
  7,
  'note',
  false,
  false,
  ARRAY[
    'Understand the purpose of Alaap.',
    'Play slowly with expression.',
    'Maintain controlled breath.',
    'Connect notes smoothly.',
    'Reflect the mood of Raag Bhoopali.'
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
