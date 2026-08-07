import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_AUTH_SUPABASE_URL, env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY);
const chapterId = 'd48691c0-a49a-4b0c-a1a5-e56ba0386994';

// 1. Read lessons from app/teacher-dashboard/inventory/initial-data.ts
const seedSource = fs.readFileSync('app/teacher-dashboard/inventory/initial-data.ts', 'utf8');
const lessonsStart = seedSource.indexOf('export const INITIAL_LESSONS');
const lessonsLiteral = seedSource.slice(lessonsStart, seedSource.lastIndexOf('];') + 1)
  .replace(/^export const INITIAL_LESSONS:\s*CourseLesson\[\]\s*=\s*/, '');
const INITIAL_LESSONS = Function(`"use strict"; return (${lessonsLiteral})`)();

// 2. Define Chapter 1 Goals and details
const chapterData = {
  id: chapterId,
  module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', // Level 2
  title: 'Chapter 1 - Expanding Range and Rhythm Control',
  description: `<p><strong>Chapter Completion Goals:</strong></p><ul><li>Play the complete Middle Octave confidently.</li><li>Transition smoothly from Lower Pa to Upper Sa.</li><li>Perform advanced Alankars with accuracy.</li><li>Play in multiple rhythmic cycles (4/4, Keherwa, Dadra, and 3/4).</li><li>Understand and perform simple offbeat patterns.</li><li>Develop better finger coordination, rhythm, and musical expression.</li></ul>`,
  chapter_number: 1
};

console.log('Upserting Chapter 1...');
const { error: chapterError } = await supabase
  .from('course_chapters')
  .upsert(chapterData, { onConflict: 'id' });

if (chapterError) {
  console.error('Error upserting chapter:', chapterError);
  process.exit(1);
}

// 3. Filter and Upsert Lessons/Topics
const topics = INITIAL_LESSONS.filter(topic => topic.chapter_id === chapterId);
console.log(`Found ${topics.length} topics for Chapter 1 in initial-data.ts. Upserting...`);

const { error: topicsError } = await supabase
  .from('course_lessons')
  .upsert(topics, { onConflict: 'id' });

if (topicsError) {
  console.error('Error upserting topics:', topicsError);
  process.exit(1);
}

// 4. Verify the database state
const { data, error } = await supabase
  .from('course_lessons')
  .select('lesson_number,title')
  .eq('chapter_id', chapterId)
  .order('lesson_number');

if (error) {
  console.error('Verification error:', error);
  process.exit(1);
}

console.log(`\nSuccessfully updated database for Level 2 Chapter 1 with ${data.length} topics:`);
for (const topic of data) {
  console.log(`${topic.lesson_number}. ${topic.title}`);
}
