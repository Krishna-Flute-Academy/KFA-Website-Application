import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
}));
const supabase = createClient(env.NEXT_PUBLIC_AUTH_SUPABASE_URL, env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY);
const chapterId = '2dfa3c70-1072-42be-9c0a-423b63948161';
const topics = [
    ['c05e0100-1111-2222-3333-444444444444', 'Introduction to the Actual Pa', '<p>Students learn the <strong>Actual Pa (Madhya Saptak)</strong> and understand how it differs from the <strong>Lower Pa (Mandra Saptak)</strong>. The focus is on correct fingering, proper hole coverage, balanced blowing, and producing a stable, clear tone.</p><p><strong>Concepts:</strong></p><ul><li><strong>P. (Lower Pa)</strong> – Mandra Saptak</li><li><strong>Pa</strong> – Madhya Saptak</li></ul>', ['Understand the difference between Lower Pa and Actual Pa.','Learn the correct finger position for Actual Pa.','Cover all finger holes properly.','Maintain balanced blowing while playing Pa.','Produce a clear and stable Pa note.']],
    ['c05e0200-1111-2222-3333-444444444444', 'Long Note Practice on Pa', '<p>This exercise develops breath control, tone stability, and consistency by sustaining the Pa note for different durations.</p><p><strong>Practice:</strong></p><ul><li>Pa (Hold for 4 beats)</li><li>Pa (Hold for 8 beats)</li></ul>', ['Play Pa with a clear tone.','Hold Pa steadily for 4 beats.','Hold Pa steadily for 8 beats.','Maintain consistent breath pressure.','Avoid fluctuations in pitch and volume.']],
    ['c05e0300-1111-2222-3333-444444444444', 'Ma to Pa Transition', '<p>This is the first transition involving the Actual Pa. Students learn smooth finger movement while maintaining continuous airflow and tone quality.</p><p><strong>Practice:</strong></p><ul><li>Ma → Pa</li><li>Pa → Ma</li><li>Ma Pa Ma Pa</li><li>Ma Pa Ma Pa</li></ul>', ['Transition smoothly between Ma and Pa.','Lift only the required finger.','Avoid unnecessary finger movement.','Maintain continuous airflow.','Prevent sound breaks during transitions.']],
    ['c05e0400-1111-2222-3333-444444444444', 'Other Transitions to Pa', '<p>Students practice ascending and descending note sequences that include Pa. These exercises improve finger coordination, note accuracy, and melodic flow.</p><p><strong>Ascending:</strong></p><ul><li>Ga → Ma → Pa</li><li>Re → Ga → Ma → Pa</li><li>Sa → Re → Ga → Ma → Pa</li></ul><p><strong>Descending:</strong></p><ul><li>Pa → Ma → Ga → Re → Sa</li></ul>', ['Play ascending transitions smoothly.','Play descending transitions smoothly.','Maintain equal timing between notes.','Develop finger coordination.','Produce clear notes throughout the exercise.']],
    ['c05e0500-1111-2222-3333-444444444444', 'Simple Composition', '<p>Students apply the newly learned Pa note by playing a simple melodic composition with proper rhythm and expression.</p><p><strong>Composition:</strong> G M P | P M G</p><p><strong>Practice:</strong></p><ul><li>Ga Ma Pa | Pa Ma Ga</li><li>Ga Ma Pa | Ma Ga</li></ul>', ['Play the composition with correct notes.','Maintain steady rhythm.','Use proper breath control.','Play with smooth note transitions.','Perform confidently with a metronome.']],
    ['c05e0600-1111-2222-3333-444444444444', 'Rhythm Practice with Pa', '<p>These rhythm exercises strengthen timing, coordination, and fluency while incorporating the newly learned Pa note.</p><p><strong>Practice Patterns:</strong></p><ul><li>Pattern 1: Ga Ma Pa Pa</li><li>Pattern 2: Ga Ma Pa | Pa Ma Ga</li><li>Pattern 3: Sa Re Ga Ma | Ga Ma Pa</li></ul>', ['Practice all rhythm patterns with a metronome.','Maintain a steady 4/4 rhythm.','Play each note clearly.','Develop finger speed and coordination.','Increase tempo only after achieving accuracy.']]
].map(([id, title, description, bullet_points], index) => ({ id, chapter_id: chapterId, title, description, bullet_points, lesson_number: index + 1, material_type: 'note', is_introductory: index === 0, is_very_important: index < 3 }));

const { error: chapterError } = await supabase.from('course_chapters').update({ title: 'Actual Pa (Madhya Saptak)', description: '6 essential topics covering Actual Pa fingering, long notes, transitions, composition, and rhythm practice.', chapter_number: 5 }).eq('id', chapterId);
if (chapterError) throw chapterError;
const { error: topicsError } = await supabase.from('course_lessons').upsert(topics, { onConflict: 'id' });
if (topicsError) throw topicsError;
const { data, error } = await supabase.from('course_lessons').select('lesson_number,title').eq('chapter_id', chapterId).order('lesson_number');
if (error) throw error;
console.log(`Updated Chapter 5 with ${data.length} topics:`);
for (const topic of data) console.log(`${topic.lesson_number}. ${topic.title}`);
