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
const chapterId = 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b';

// 1. Read lessons from app/teacher-dashboard/inventory/initial-data.ts
const seedSource = fs.readFileSync('app/teacher-dashboard/inventory/initial-data.ts', 'utf8');
const lessonsStart = seedSource.indexOf('export const INITIAL_LESSONS');
const lessonsLiteral = seedSource.slice(lessonsStart, seedSource.lastIndexOf('];') + 1)
  .replace(/^export const INITIAL_LESSONS:\s*CourseLesson\[\]\s*=\s*/, '');
const INITIAL_LESSONS = Function(`"use strict"; return (${lessonsLiteral})`)();

// 2. Define Chapter 5 Goals and details
const chapterData = {
  id: chapterId,
  module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', // Level 2
  title: 'Chapter 5 - Murki, Kan Swar & Meend',
  description: `<p><strong>Chapter Completion Goals:</strong></p><ul><li>Understand the purpose of Murki, Kan Swar, and Meend.</li><li>Differentiate between the three ornamentation techniques.</li><li>Perform Murki with speed and precision.</li><li>Apply Kan Swar naturally in melodic phrases.</li><li>Execute short and long Meends smoothly.</li><li>Enhance simple melodies using classical ornamentation.</li><li>Play Raag Bhoopali phrases with greater musical expression.</li></ul>`,
  chapter_number: 5
};

console.log('Upserting Chapter 5...');
const { error: chapterError } = await supabase
  .from('course_chapters')
  .upsert(chapterData, { onConflict: 'id' });

if (chapterError) {
  console.error('Error upserting chapter:', chapterError);
  process.exit(1);
}

// 3. Filter and Upsert Lessons/Topics
const topics = INITIAL_LESSONS.filter(topic => topic.chapter_id === chapterId);
console.log(`Found ${topics.length} topics for Chapter 5 in initial-data.ts. Upserting...`);

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

console.log(`\nSuccessfully updated database for Level 2 Chapter 5 with ${data.length} topics:`);
for (const topic of data) {
  console.log(`${topic.lesson_number}. ${topic.title}`);
}
