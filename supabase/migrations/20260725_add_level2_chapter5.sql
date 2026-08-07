-- Level 2 / Chapter 5: Murki, Kan Swar & Meend

-- 1. Insert/Update Chapter
INSERT INTO public.course_chapters (id, module_id, title, description, chapter_number)
VALUES (
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'Murki, Kan Swar & Meend',
  '<p><strong>Chapter Completion Goals:</strong></p><ul><li>Understand the purpose of Murki, Kan Swar, and Meend.</li><li>Differentiate between the three ornamentation techniques.</li><li>Perform Murki with speed and precision.</li><li>Apply Kan Swar naturally in melodic phrases.</li><li>Execute short and long Meends smoothly.</li><li>Enhance simple melodies using classical ornamentation.</li><li>Play Raag Bhoopali phrases with greater musical expression.</li></ul>',
  5
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
  'c25e0100-1111-2222-3333-444444444444',
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'Introduction to Murki (मुरकी)',
  '<h3>Overview</h3><p>Murki is a fast ornamental technique in Hindustani Classical Music. It consists of a quick cluster of notes played around a main note, adding beauty, movement, and expression to a melody. Murki is lighter and faster than Gamak.</p><h4>Example</h4><p>If the main note is Ga: <strong>Re Ga Re Ga</strong></p><h4>Example Phrase</h4><p>Sa (Re Ga Re) Sa</p><h4>Playing Technique</h4><ul><li>Very quick finger movement.</li><li>Light and controlled blowing.</li><li>Notes should sound smooth and connected.</li></ul><h4>Common Usage</h4><ul><li>Light Classical Music</li><li>Bhajans</li><li>Bollywood Songs</li><li>Raag Expression</li></ul><h4>Common Raags</h4><p>Kafi, Khamaj, Pilu</p>',
  1,
  'note',
  true,
  true,
  ARRAY[
    'Understand the concept of Murki.',
    'Recognize Murki in musical phrases.',
    'Practice quick finger movement.',
    'Maintain connected notes while playing.',
    'Play Murki with light breath control.'
  ]
),
(
  'c25e0200-1111-2222-3333-444444444444',
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'Introduction to Kan Swar (कण स्वर)',
  '<h3>Overview</h3><p>Kan Swar is a grace note played immediately before the main note. The grace note is touched very briefly, adding elegance and emotional expression to the melody.</p><h4>Example</h4><p>Main Note: Ga: <strong>(Re) Ga</strong></p><h4>Example Phrase</h4><p>Sa (Re) Ga Ma</p><h4>Playing Technique</h4><ul><li>Touch the grace note very briefly.</li><li>Use quick finger movement.</li><li>Transition smoothly into the main note.</li><li>Keep the grace note subtle.</li></ul><h4>Benefits</h4><ul><li>Adds classical expression.</li><li>Creates smooth note transitions.</li><li>Enhances melodic beauty.</li></ul>',
  2,
  'note',
  false,
  true,
  ARRAY[
    'Understand the concept of Kan Swar.',
    'Play grace notes smoothly.',
    'Maintain proper finger control.',
    'Avoid emphasizing the grace note.',
    'Use Kan Swar naturally in phrases.'
  ]
),
(
  'c25e0300-1111-2222-3333-444444444444',
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'Introduction to Meend (मींड)',
  '<h3>Overview</h3><p>Meend is the smooth glide from one note to another without breaking the sound. It is one of the most expressive techniques in Bansuri and is widely used in Hindustani Classical Music.</p><h4>Example</h4><p>Instead of playing <strong>Sa Ga</strong>, play <strong>Sa ~~~ Ga</strong></p><h4>Practice</h4><p>Sa → Re → Ga</p><h4>Types of Meend</h4><ul><li><strong>Short Meend</strong>: Sa → Re</li><li><strong>Long Meend</strong>: Sa → Ga, Sa → Ma</li><li><strong>Descending Meend</strong>: Pa → Ga</li></ul><h4>Playing Technique</h4><ul><li>Lift the fingers gradually.</li><li>Maintain continuous airflow.</li><li>Avoid breaking the sound.</li><li>Keep the glide smooth and natural.</li></ul>',
  3,
  'note',
  false,
  true,
  ARRAY[
    'Understand the concept of Meend.',
    'Play short Meends smoothly.',
    'Play long Meends with continuous airflow.',
    'Maintain a connected tone throughout.',
    'Develop expressive note transitions.'
  ]
),
(
  'c25e0400-1111-2222-3333-444444444444',
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'Comparison of Murki, Kan Swar & Meend',
  '<h3>Overview</h3><p>This topic helps students understand the differences between the three most commonly used ornamentation techniques in Hindustani Classical Music.</p><table class="min-w-full border border-slate-300 dark:border-slate-700 rounded-lg"><thead><tr class="bg-slate-100 dark:bg-slate-800"><th class="p-2 border">Technique</th><th class="p-2 border">Meaning</th><th class="p-2 border">Speed</th><th class="p-2 border">Musical Effect</th></tr></thead><tbody><tr><td class="p-2 border font-semibold">Murki</td><td class="p-2 border">Quick cluster of notes</td><td class="p-2 border">Very Fast</td><td class="p-2 border">Decorative</td></tr><tr><td class="p-2 border font-semibold">Kan Swar</td><td class="p-2 border">Grace note</td><td class="p-2 border">Very Quick</td><td class="p-2 border">Subtle Ornament</td></tr><tr><td class="p-2 border font-semibold">Meend</td><td class="p-2 border">Smooth glide between notes</td><td class="p-2 border">Smooth</td><td class="p-2 border">Expressive</td></tr></tbody></table>',
  4,
  'note',
  false,
  false,
  ARRAY[
    'Differentiate between Murki, Kan Swar, and Meend.',
    'Recognize where each ornament is used.',
    'Understand the musical effect of each technique.',
    'Choose the appropriate ornament for a phrase.'
  ]
),
(
  'c25e0500-1111-2222-3333-444444444444',
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'Applying Ornamentation in Raag Bhoopali',
  '<h3>Overview</h3><p>Students learn how Murki, Kan Swar, and Meend can be applied to simple phrases in Raag Bhoopali to make the melody more expressive.</p><h4>Original Phrase</h4><p>Sa Re Ga Pa Dha</p><h4>Ornamentations</h4><ul><li><strong>Kan Swar</strong>: Sa (Re) Ga</li><li><strong>Murki</strong>: Ga Re Ga</li><li><strong>Meend</strong>: Ga ~~~ Pa</li></ul>',
  5,
  'note',
  false,
  false,
  ARRAY[
    'Apply Kan Swar correctly.',
    'Play Murki with speed and clarity.',
    'Perform Meend smoothly.',
    'Maintain rhythm while using ornamentation.',
    'Use ornamentation naturally in simple phrases.'
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
