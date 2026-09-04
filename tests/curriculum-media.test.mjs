import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import ts from 'typescript';

async function importTypeScriptModule(path) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ES2022,
            target: ts.ScriptTarget.ES2022,
        },
    });

    const encodedModule = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
    return import(encodedModule);
}

const { getCurriculumMediaInfo, formatCurriculumSubtitle, extractVideoTimestamp, detectMaterialType } = await importTypeScriptModule('../src/lib/curriculum-media.ts');

describe('Material Type Detection (detectMaterialType)', () => {
    test('detects YouTube and Vimeo URLs as youtube', () => {
        assert.equal(detectMaterialType('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
        assert.equal(detectMaterialType('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
        assert.equal(detectMaterialType('https://vimeo.com/123456789'), 'youtube');
        assert.equal(detectMaterialType('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'youtube');
    });

    test('detects video file extensions as video', () => {
        assert.equal(detectMaterialType('https://storage.example.com/lesson.mp4'), 'video');
        assert.equal(detectMaterialType('https://storage.example.com/lesson.webm'), 'video');
        assert.equal(detectMaterialType('https://storage.example.com/lesson.ogv'), 'video');
        assert.equal(detectMaterialType('https://storage.example.com/lesson.mov'), 'video');
        assert.equal(detectMaterialType('https://storage.example.com/lesson.mkv?token=123'), 'video');
    });

    test('detects PDF files as pdf', () => {
        assert.equal(detectMaterialType('https://storage.example.com/sheet.pdf'), 'pdf');
        assert.equal(detectMaterialType('https://storage.example.com/notes.pdf?signed=abc'), 'pdf');
    });

    test('detects audio files as audio', () => {
        assert.equal(detectMaterialType('https://storage.example.com/sound.mp3'), 'audio');
        assert.equal(detectMaterialType('https://storage.example.com/sound.wav'), 'audio');
        assert.equal(detectMaterialType('https://storage.example.com/sound.m4a'), 'audio');
        assert.equal(detectMaterialType('https://storage.example.com/sound.ogg'), 'audio');
    });

    test('detects image files as image', () => {
        assert.equal(detectMaterialType('https://storage.example.com/diagram.png'), 'image');
        assert.equal(detectMaterialType('https://storage.example.com/diagram.jpg'), 'image');
        assert.equal(detectMaterialType('https://storage.example.com/diagram.svg'), 'image');
        assert.equal(detectMaterialType('https://storage.example.com/diagram.webp'), 'image');
    });

    test('never returns video solely because declared material_type is video', () => {
        // Normal webpage with declared 'video' must return 'link'
        assert.equal(detectMaterialType('https://krishnaflute.com/acoustics', 'video'), 'link');
        assert.equal(detectMaterialType('https://example.com/posture-guide', 'video'), 'link');
        assert.equal(detectMaterialType('https://wikipedia.org/wiki/Bansuri', 'video'), 'link');
    });

    test('returns none for null, empty, or undefined URLs', () => {
        assert.equal(detectMaterialType(null), 'none');
        assert.equal(detectMaterialType(''), 'none');
        assert.equal(detectMaterialType('   '), 'none');
        assert.equal(detectMaterialType(undefined), 'none');
        assert.equal(detectMaterialType('null'), 'none');
        assert.equal(detectMaterialType(null, 'video'), 'none');
    });

    test('Level 1 -> Chapter 1 -> Topic 4 "Correct Sitting & Body Posture" behavior', () => {
        // When topic has declared material_type: 'video' and a reference URL
        const postureUrl = 'https://krishnaflute.com/posture';
        const detectedWithUrl = detectMaterialType(postureUrl, 'video');
        assert.equal(detectedWithUrl, 'link', 'Must detect as link (Reference Link screen), never video');

        // When topic has no URL at all
        const detectedNoUrl = detectMaterialType(null, 'video');
        assert.equal(detectedNoUrl, 'none', 'Must detect as none (No material available)');
    });
});

describe('Curriculum Media Validation & Badges', () => {
    test('extractVideoTimestamp correctly parses timestamps and ignores invalid ones', () => {
        assert.equal(extractVideoTimestamp('VIDEO • 08:45'), '08:45');
        assert.equal(extractVideoTimestamp('08:45'), '08:45');
        assert.equal(extractVideoTimestamp('12:30'), '12:30');
        assert.equal(extractVideoTimestamp('1:05:20'), '1:05:20');
        assert.equal(extractVideoTimestamp('PDF • 1.5MB'), null);
        assert.equal(extractVideoTimestamp('5 mins'), null);
        assert.equal(extractVideoTimestamp('20 Mins'), null);
        assert.equal(extractVideoTimestamp(''), null);
        assert.equal(extractVideoTimestamp(null), null);
    });

    test('Lesson with NO media attachment (even if legacy video fields exist) shows NO video or duration badge', () => {
        const lesson = {
            id: 'c02e0400',
            title: 'Understanding Rhythm – 4/4',
            lesson_number: 4,
            material_type: 'video',
            duration: 'VIDEO • 08:45',
            difficulty: 'Easy',
            material_url: null,
            link_url: null
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, false);
        assert.equal(info.isVideo, false);
        assert.equal(info.videoDuration, null);
        assert.equal(info.badgeLabel, null);

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'Easy');
    });

    test('Lesson with PDF attachment displays PDF • Easy', () => {
        const lesson = {
            id: 'c01e0400',
            title: 'Flute Structure',
            lesson_number: 3,
            material_type: 'pdf',
            material_url: 'https://storage.example.com/materials/flute_structure.pdf',
            difficulty: 'Easy'
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, true);
        assert.equal(info.isPdf, true);
        assert.equal(info.isVideo, false);
        assert.equal(info.badgeLabel, 'PDF');

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'PDF • Easy');
    });

    test('Lesson with real video attachment and duration displays VIDEO • 08:45 • Easy', () => {
        const lesson = {
            id: 'c01e0500',
            title: 'Breath & Blowing Basics',
            lesson_number: 5,
            material_type: 'video',
            material_url: 'https://storage.example.com/materials/breath_basics.mp4',
            duration: 'VIDEO • 08:45',
            difficulty: 'Easy'
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, true);
        assert.equal(info.isVideo, true);
        assert.equal(info.videoDuration, '08:45');
        assert.equal(info.badgeLabel, 'VIDEO • 08:45');

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'VIDEO • 08:45 • Easy');
    });

    test('Lesson with real video attachment but no timestamp duration displays VIDEO • Easy', () => {
        const lesson = {
            id: 'c01e0501',
            title: 'Tone Production',
            lesson_number: 6,
            material_type: 'video',
            material_url: 'https://storage.example.com/materials/tone.mp4',
            duration: 'VIDEO • 15MB', // file size, not timestamp
            difficulty: 'Intermediate'
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, true);
        assert.equal(info.isVideo, true);
        assert.equal(info.videoDuration, null);
        assert.equal(info.badgeLabel, 'VIDEO');

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'VIDEO • Intermediate');
    });

    test('Lesson with YouTube link displays VIDEO • Easy', () => {
        const lesson = {
            id: 'c01e0502',
            title: 'Masterclass on Raga Yaman',
            lesson_number: 7,
            link_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            material_url: null,
            difficulty: 'Advanced'
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, true);
        assert.equal(info.isVideo, true);
        assert.equal(info.badgeLabel, 'VIDEO');

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'VIDEO • Advanced');
    });

    test('Lesson with Audio attachment displays AUDIO • Easy', () => {
        const lesson = {
            id: 'c01e0503',
            title: 'Tanpura Sound in C',
            lesson_number: 8,
            material_type: 'audio',
            material_url: 'https://storage.example.com/materials/tanpura.mp3',
            difficulty: 'Beginner'
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, true);
        assert.equal(info.isAudio, true);
        assert.equal(info.badgeLabel, 'AUDIO');

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'AUDIO • Beginner');
    });

    test('Lesson with non-media external web link displays no media badge', () => {
        const lesson = {
            id: 'c01e0504',
            title: 'Acoustics Article',
            lesson_number: 1,
            link_url: 'https://krishnaflute.com/acoustics',
            material_url: null,
            difficulty: 'Easy'
        };

        const info = getCurriculumMediaInfo(lesson);
        assert.equal(info.hasMedia, false);
        assert.equal(info.badgeLabel, null);

        const subtitle = formatCurriculumSubtitle(lesson);
        assert.equal(subtitle, 'Easy');
    });
});
