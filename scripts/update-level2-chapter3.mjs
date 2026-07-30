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
const chapterId = 'e5b6c7d8-f9a0-1b2c-3d4e-5f6a7b8c9d0e';

// 1. Read lessons from app/teacher-dashboard/inventory/initial-data.ts
const seedSource = fs.readFileSync('app/teacher-dashboard/inventory/initial-data.ts', 'utf8');
const lessonsStart = seedSource.indexOf('export const INITIAL_LESSONS');
const lessonsLiteral = seedSource.slice(lessonsStart, seedSource.lastIndexOf('];') + 1)
  .replace(/^export const INITIAL_LESSONS:\s*CourseLesson\[\]\s*=\s*/, '');
const INITIAL_LESSONS = Function(`"use strict"; return (${lessonsLiteral})`)();

// 2. Define Chapter 3 Goals and details
const chapterData = {
  id: chapterId,
  module_id: 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', // Level 2
  title: 'Chapter 3 - Introduction to Raag and Classical Structure',
  description: `<p><strong>Chapter Completion Goals:</strong></p><ul><li>Understand the structure of Teentaal.</li><li>Play confidently in a 16-beat rhythm cycle.</li><li>Perform the Arohan and Avarohan of Raag Bhoopali.</li><li>Play characteristic Bhoopali phrases.</li><li>Perform a simple Bhoopali composition in Teentaal.</li><li>Understand and practice basic Merukhand.</li><li>Play a simple Alaap with expression and proper breath control.</li></ul>`,
  chapter_number: 3
};

console.log('Upserting Chapter 3...');
const { error: chapterError } = await supabase
  .from('course_chapters')
  .upsert(chapterData, { onConflict: 'id' });

if (chapterError) {
  console.error('Error upserting chapter:', chapterError);
  process.exit(1);
}

// 3. Filter and Upsert Lessons/Topics
const topics = INITIAL_LESSONS.filter(topic => topic.chapter_id === chapterId);
console.log(`Found ${topics.length} topics for Chapter 3 in initial-data.ts. Upserting...`);

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

console.log(`\nSuccessfully updated database for Level 2 Chapter 3 with ${data.length} topics:`);
for (const topic of data) {
  console.log(`${topic.lesson_number}. ${topic.title}`);
}
