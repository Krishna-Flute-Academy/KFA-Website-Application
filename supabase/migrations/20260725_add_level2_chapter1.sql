-- Level 2 / Chapter 1: Expanding Range and Rhythm Control

-- 1. Insert/Update Chapter
INSERT INTO public.course_chapters (id, module_id, title, description, chapter_number)
VALUES (
  'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
  'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Expanding Range and Rhythm Control',
  '<p><strong>Chapter Completion Goals:</strong></p><ul><li>Play the complete Middle Octave confidently.</li><li>Transition smoothly from Lower Pa to Upper Sa.</li><li>Perform advanced Alankars with accuracy.</li><li>Play in multiple rhythmic cycles (4/4, Keherwa, Dadra, and 3/4).</li><li>Understand and perform simple offbeat patterns.</li><li>Develop better finger coordination, rhythm, and musical expression.</li></ul>',
  1
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  chapter_number = EXCLUDED.chapter_number,
  updated_at = now();

-- 2. Insert/Update Lessons (Topics 1 - 5)
INSERT INTO public.course_lessons (id, chapter_id, title, description, lesson_number, material_type, is_introductory, is_very_important, bullet_points)
VALUES
(
  'c21e0100-1111-2222-3333-444444444444',
  'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
  'Full Scale Practice (Sa to Upper Sa)',
  '<h3>Overview</h3><p>In this topic, students strengthen their command over the complete Middle Octave (Madhya Saptak) by practicing the full scale in both ascending (Arohan) and descending (Avarohan) order. The focus is on producing a clear tone, maintaining steady rhythm, and developing smooth finger coordination.</p><h4>Practice</h4><p><strong>Ascending (Arohan)</strong></p><pre>Sa Re Ga Ma Pa Dha Ni Sa''</pre><p><strong>Descending (Avarohan)</strong></p><pre>Sa'' Ni Dha Pa Ma Ga Re Sa</pre>',
  1,
  'note',
  true,
  true,
  ARRAY[
    'Play the complete scale smoothly.',
    'Maintain a steady rhythm with a metronome.',
    'Produce clear and even notes.',
    'Develop smooth finger movement.',
    'Maintain consistent tone throughout the octave.'
  ]
),
(
  'c21e0200-1111-2222-3333-444444444444',
  'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
  'Base Pa to Upper Sa Practice',
  '<h3>Overview</h3><p>This exercise expands the student''s playing range by connecting the Lower Pa (P.) with the complete Middle Octave. It improves octave transition, finger control, and breath stability.</p><h4>Practice</h4><pre>P. Sa Re Ga

P. Sa Re Ga Ma

P. Sa Re Ga Ma Pa

P. Sa Re Ga Ma Pa Dha Ni Sa''</pre>',
  2,
  'note',
  false,
  true,
  ARRAY[
    'Play smoothly from Lower Pa to Upper Sa.',
    'Maintain balanced breath throughout.',
    'Produce clear notes across the range.',
    'Develop smooth octave transitions.',
    'Maintain steady rhythm.'
  ]
),
(
  'c21e0300-1111-2222-3333-444444444444',
  'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
  'Advanced Alankar Practice',
  '<h3>Overview</h3><p>These Alankars improve finger agility, note accuracy, coordination, and musical thinking. Students should begin slowly and gradually increase speed using a metronome.</p><h4>Practice Patterns</h4><p><strong>Pattern 1</strong></p><pre>Sa Re Ga Re
Re Ga Ma Ga
Ga Ma Pa Ma</pre><p><strong>Pattern 2</strong></p><pre>Sa Re Ga Ma
Re Ga Ma Pa
Ga Ma Pa Dha</pre><p><strong>Pattern 3 (Skipping Notes)</strong></p><pre>Sa Ga
Re Ma
Ga Pa</pre>',
  3,
  'note',
  false,
  false,
  ARRAY[
    'Practice all Alankars accurately.',
    'Maintain equal timing between notes.',
    'Develop finger agility.',
    'Improve note clarity.',
    'Increase speed only after achieving accuracy.'
  ]
),
(
  'c21e0400-1111-2222-3333-444444444444',
  'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
  'Rhythm Practice',
  '<h3>Overview</h3><p>Students learn to perform scales and Alankars in different rhythmic cycles. Practicing with a metronome or tabla improves timing, coordination, and rhythmic confidence.</p><h4>Practice Rhythms</h4><p><strong>4/4 Rhythm</strong></p><pre>1 2 3 4</pre><p><strong>Keherwa (8 Beats)</strong></p><pre>Dha Ge Na Ti | Na Ka Dhi Na</pre><p><strong>Dadra (6 Beats)</strong></p><pre>Dha Dhi Na | Dha Tu Na</pre><p><strong>3/4 Rhythm</strong></p><pre>1 2 3</pre>',
  4,
  'note',
  false,
  false,
  ARRAY[
    'Practice scales in different rhythms.',
    'Play Alankars with a metronome.',
    'Maintain accurate timing.',
    'Understand the feel of Keherwa and Dadra.',
    'Develop rhythmic consistency.'
  ]
),
(
  'c21e0500-1111-2222-3333-444444444444',
  'd48691c0-a49a-4b0c-a1a5-e56ba0386994',
  'Understanding Offbeat Playing',
  '<h3>Overview</h3><p>Students are introduced to Offbeat Playing, where a musical phrase begins on a beat other than the first beat of the cycle. This develops rhythmic awareness and improves coordination with tabla accompaniment.</p><h4>Practice</h4><p><strong>Start on Beat 2 (Beat 1 - Rest)</strong></p><pre>(Rest) Sa Re Ga Ma</pre><p>Practice the same phrase starting from:</p><ul><li>Beat 2</li><li>Beat 3</li><li>Beat 4</li></ul>',
  5,
  'note',
  false,
  false,
  ARRAY[
    'Understand the concept of offbeat playing.',
    'Start phrases on different beats.',
    'Maintain the rhythm while shifting the starting beat.',
    'Improve coordination with tabla.',
    'Develop rhythmic confidence and musical awareness.'
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
