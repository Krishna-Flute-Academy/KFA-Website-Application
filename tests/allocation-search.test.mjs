import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const {
    normalizeSearchText,
    getSearchTokens,
    matchesSearchTokens
} = await importTypeScriptModule('../src/lib/search-utils.ts');

test('1. normalizeSearchText handles null, undefined, numbers, and basic strings', () => {
    assert.equal(normalizeSearchText(null), '');
    assert.equal(normalizeSearchText(undefined), '');
    assert.equal(normalizeSearchText(123), '123');
    assert.equal(normalizeSearchText(' Hello World '), 'hello world');
});

test('2. normalizeSearchText strips diacritics and collapses repeated whitespace', () => {
    assert.equal(normalizeSearchText('  Rāg   Yaman  '), 'rag yaman');
    assert.equal(normalizeSearchText('Café   Concrète'), 'cafe concrete');
    assert.equal(normalizeSearchText('Naad\t\n  Brahma'), 'naad brahma');
});

test('3. getSearchTokens parses tokens properly', () => {
    assert.deepEqual(getSearchTokens(''), []);
    assert.deepEqual(getSearchTokens('   '), []);
    assert.deepEqual(getSearchTokens('Madhukara  Flute  Alankars'), ['madhukara', 'flute', 'alankars']);
});

test('4. matchesSearchTokens: exact search', () => {
    const fields = ['Beginner Flute Course', 'Basic techniques for flute'];
    assert.equal(matchesSearchTokens(fields, 'Beginner Flute Course'), true);
});

test('5. matchesSearchTokens: partial search', () => {
    const fields = ['Madhukara Flute Lessons', 'Foundation Chapter 1'];
    assert.equal(matchesSearchTokens(fields, 'madhu'), true);
    assert.equal(matchesSearchTokens(fields, 'chap'), true);
});

test('6. matchesSearchTokens: uppercase / lowercase tolerance', () => {
    const fields = ['Krishna Flute Academy', 'Indian Classical Bansuri'];
    assert.equal(matchesSearchTokens(fields, 'krishna'), true);
    assert.equal(matchesSearchTokens(fields, 'KRISHNA'), true);
    assert.equal(matchesSearchTokens(fields, 'bAnSuRi'), true);
});

test('7. matchesSearchTokens: leading, trailing, and repeated spaces', () => {
    const fields = ['Module 1: Basic Embouchure', 'Getting the first sound'];
    assert.equal(matchesSearchTokens(fields, '   Module   1   '), true);
    assert.equal(matchesSearchTokens(fields, '   first     sound   '), true);
});

test('8. matchesSearchTokens: multi-word search & words in different order', () => {
    const fields = ['Beginner Bansuri Level 1', 'Focus on posture and breath support'];
    // In order
    assert.equal(matchesSearchTokens(fields, 'Beginner Bansuri'), true);
    // Across multiple fields & reverse order
    assert.equal(matchesSearchTokens(fields, 'support beginner'), true);
    assert.equal(matchesSearchTokens(fields, 'posture 1 level'), true);
});

test('9. matchesSearchTokens: student name search', () => {
    const student = {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        status: 'unlocked'
    };
    const fields = [student.name, student.email, student.status];
    assert.equal(matchesSearchTokens(fields, 'Aarav'), true);
    assert.equal(matchesSearchTokens(fields, 'sharma aarav'), true);
});

test('10. matchesSearchTokens: student email search', () => {
    const student = {
        name: 'Pooja Patel',
        email: 'pooja.flute@gmail.com',
        status: 'completed'
    };
    const fields = [student.name, student.email, student.status];
    assert.equal(matchesSearchTokens(fields, 'pooja.flute@gmail.com'), true);
    assert.equal(matchesSearchTokens(fields, 'gmail pooja'), true);
});

test('11. matchesSearchTokens: allocation/pacing status search', () => {
    const student = {
        name: 'Rohan Verma',
        email: 'rohan@example.com',
        status: 'in_progress'
    };
    const fields = [student.name, student.email, student.status, student.status.replace('_', ' ')];
    assert.equal(matchesSearchTokens(fields, 'in progress'), true);
    assert.equal(matchesSearchTokens(fields, 'rohan progress'), true);
});

test('12. matchesSearchTokens: module, chapter, and lesson matching', () => {
    const moduleItem = { title: 'Raag Bhupali Intensive', description: 'Comprehensive guide to Pentatonic Scale' };
    const chapterItem = { title: 'Chapter 2: Aaroh & Avroh', description: 'Up and down scales' };
    const lessonItem = { title: 'Topic 3: Komal Swaras in Bhupali', description: 'Identifying differences', material_type: 'video' };

    // Module search
    assert.equal(matchesSearchTokens([moduleItem.title, moduleItem.description], 'bhupali pentatonic'), true);
    // Chapter search
    assert.equal(matchesSearchTokens([chapterItem.title, chapterItem.description], 'aaroh avroh'), true);
    // Lesson search
    assert.equal(matchesSearchTokens([lessonItem.title, lessonItem.description, lessonItem.material_type], 'komal video'), true);
});

test('13. matchesSearchTokens: description and category search', () => {
    const category = 'Foundations of Bansuri';
    const description = 'Deep dive into blowing techniques and lips positioning';
    const fields = ['Module 101', description, category];

    assert.equal(matchesSearchTokens(fields, 'foundations lips'), true);
    assert.equal(matchesSearchTokens(fields, 'blowing bansuri'), true);
});

test('14. matchesSearchTokens: no-result state', () => {
    const fields = ['Beginner Flute Course', 'Basic techniques for flute'];
    assert.equal(matchesSearchTokens(fields, 'Saxophone Jazz'), false);
    assert.equal(matchesSearchTokens(fields, 'Beginner Guitar'), false);
});

test('15. matchesSearchTokens: clearing search restores full match', () => {
    const fields = ['Any Module Title', 'Any Description'];
    assert.equal(matchesSearchTokens(fields, ''), true);
    assert.equal(matchesSearchTokens(fields, '   '), true);
    assert.equal(matchesSearchTokens(fields, null), true);
    assert.equal(matchesSearchTokens(fields, undefined), true);
});

test('16. Nested inventory match visibility logic', () => {
    // Simulating inventory hierarchy
    const mockModule = { id: 'm1', title: 'Carnatic Basics', description: 'South Indian flute techniques' };
    const mockChapter = { id: 'c1', module_id: 'm1', title: 'Varnams & Geethams', description: 'Introductory compositions' };
    const mockLesson = { id: 'l1', chapter_id: 'c1', title: 'Mohanam Varnam audio track', material_type: 'audio' };

    const query = 'mohanam audio';
    const tokens = getSearchTokens(query);
    assert.equal(tokens.length, 2);

    const lessonMatches = matchesSearchTokens([mockLesson.title, mockLesson.material_type], query);
    assert.equal(lessonMatches, true);

    const chapterHasMatchingLesson = lessonMatches;
    const moduleHasMatchingChapter = chapterHasMatchingLesson;

    // The module and chapter should auto-expand / be visible when nested lesson matches
    assert.equal(moduleHasMatchingChapter, true);
    assert.equal(chapterHasMatchingLesson, true);
});
