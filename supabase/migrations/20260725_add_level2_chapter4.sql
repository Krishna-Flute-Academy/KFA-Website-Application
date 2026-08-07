-- Level 2 / Chapter 4: Raag Bilawal

-- 1. Insert/Update Chapter
INSERT INTO public.course_chapters (id, module_id, title, description, chapter_number)
VALUES (
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Raag Bilawal',
  '<p><strong>Chapter Completion Goals:</strong></p><ul><li>Understand the structure of Raag Bilawal.</li><li>Perform the Arohan and Avarohan confidently.</li><li>Recognize and play the characteristic Pakad.</li><li>Perform Bilawal Alankars with clarity.</li><li>Play a simple Bilawal composition in rhythm.</li><li>Practice a basic Alaap with expression.</li><li>Apply Merukhand techniques for better finger control and creativity.</li><li>Perform a simple song based on the Bilawal scale.</li></ul>',
  4
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
  'c24e0100-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Introduction to Raag Bilawal',
  '<h3>Overview</h3><p>Students are introduced to Raag Bilawal, one of the fundamental ragas in Hindustani Classical Music. All seven notes in this raga are Shuddha Swaras, making it equivalent to the natural major scale in Western music.</p><h4>Thaat</h4><p>Bilawal</p><h4>Notes Used</h4><p>Sa Re Ga Ma Pa Dha Ni Sa''</p><h4>Arohan (Ascending)</h4><pre>Sa Re Ga Ma Pa Dha Ni Sa''</pre><h4>Avarohan (Descending)</h4><pre>Sa'' Ni Dha Pa Ma Ga Re Sa</pre>',
  1,
  'note',
  true,
  true,
  ARRAY[
    'Understand the structure of Raag Bilawal.',
    'Identify the Bilawal Thaat.',
    'Recognize all Shuddha Swaras.',
    'Play the Arohan correctly.',
    'Play the Avarohan correctly.',
    'Understand why Bilawal is considered the foundation scale of Hindustani music.'
  ]
),
(
  'c24e0200-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Bilawal Note Movements (Pakad)',
  '<h3>Overview</h3><p>Students learn the characteristic note movements (Pakad) of Raag Bilawal. These phrases help develop the melodic identity of the raga and improve musical phrasing.</p><h4>Practice</h4><pre>Ga Re Ga

Ma Ga Re Sa

Pa Dha Ni Dha Pa

Ga Ma Pa | Dha Pa Ma Ga</pre>',
  2,
  'note',
  false,
  true,
  ARRAY[
    'Practice each Pakad smoothly.',
    'Maintain proper rhythm.',
    'Develop smooth note transitions.',
    'Recognize the characteristic phrases of Bilawal.',
    'Play with a clear and pleasant tone.'
  ]
),
(
  'c24e0300-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Bilawal Alankar Practice',
  '<h3>Overview</h3><p>Students practice Alankars based on the Bilawal scale to improve finger coordination, speed control, and note clarity.</p><h4>Practice</h4><p><strong>Ascending</strong></p><pre>Sa Re Ga Ma\nRe Ga Ma Pa\nGa Ma Pa Dha</pre><p><strong>Descending</strong></p><pre>Sa Ni Dha Pa\nNi Dha Pa Ma\nDha Pa Ma Ga</pre>',
  3,
  'note',
  false,
  false,
  ARRAY[
    'Practice all Alankars accurately.',
    'Maintain equal timing between notes.',
    'Develop finger coordination.',
    'Improve note clarity.',
    'Increase speed gradually with a metronome.'
  ]
),
(
  'c24e0400-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Bilawal Composition',
  '<h3>Overview</h3><p>Students learn a simple composition in Teentaal or Keherwa while focusing on rhythm, phrasing, and musical expression.</p><h4>Composition</h4><pre>Sa Re Ga Ma | Ga Re Sa

Ga Ma Pa Dha | Pa Ma Ga</pre>',
  4,
  'note',
  false,
  false,
  ARRAY[
    'Play the composition accurately.',
    'Maintain correct rhythm.',
    'Land correctly on Sam.',
    'Use smooth note transitions.',
    'Perform confidently with a metronome or tabla.'
  ]
),
(
  'c24e0500-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Alaap Practice',
  '<h3>Overview</h3><p>Students begin developing a slow and expressive Alaap in Raag Bilawal. The emphasis is on breath control, note connection, and expressing the mood of the raga.</p><h4>Practice</h4><pre>Sa... Re... Ga...\n\nGa... Ma... Pa...\n\nPa... Dha... Ni...\n\nNi... Dha... Pa...</pre>',
  5,
  'note',
  false,
  false,
  ARRAY[
    'Understand the purpose of Alaap.',
    'Play slowly with controlled breath.',
    'Connect notes smoothly.',
    'Develop musical expression.',
    'Reflect the character of Raag Bilawal.'
  ]
),
(
  'c24e0600-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Merukhand Practice',
  '<h3>Overview</h3><p>Students practice Merukhand patterns using the Bilawal scale. These exercises strengthen finger coordination, improve note control, and introduce basic improvisation techniques.</p><h4>Practice</h4><pre>Sa Re Ga Ma

Sa Ga Re Ma

Re Ga Ma Sa

Ga Ma Re Sa</pre>',
  6,
  'note',
  false,
  false,
  ARRAY[
    'Understand the concept of Merukhand.',
    'Practice each pattern accurately.',
    'Maintain steady rhythm.',
    'Develop finger agility.',
    'Improve creativity and improvisation.'
  ]
),
(
  'c24e0700-1111-2222-3333-444444444444',
  'b7c8d9e0-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
  'Song Application',
  '<h3>Overview</h3><p>Students apply the Bilawal scale by learning a simple melody or song based on the raga. This helps bridge the gap between technical exercises and practical musical performance.</p><h4>Practice</h4><p>Choose a simple melody based on Raag Bilawal and practice it with a metronome or tabla.</p>',
  7,
  'note',
  false,
  false,
  ARRAY[
    'Play the melody with correct notes.',
    'Maintain steady rhythm.',
    'Apply Bilawal note movements naturally.',
    'Use smooth phrasing and expression.',
    'Perform confidently from beginning to end.'
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
