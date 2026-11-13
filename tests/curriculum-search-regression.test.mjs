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
    getSearchTokens,
    matchesSearchTokens
} = await importTypeScriptModule('../src/lib/search-utils.ts');

// Helper implementing the exact derivation logic from page.tsx
function filterCurriculum(sourceCurriculum, searchQuery) {
    if (!getSearchTokens(searchQuery).length) {
        return sourceCurriculum;
    }

    const filteredCategories = [];

    sourceCurriculum.forEach(cat => {
        const isCategoryMatch = matchesSearchTokens([cat.categoryName], searchQuery);
        const filteredModules = [];

        cat.modules.forEach(mod => {
            const isModuleMatch = matchesSearchTokens([mod.title, mod.description, cat.categoryName], searchQuery);
            const filteredChapters = [];

            mod.chapters.forEach(chap => {
                const isChapterMatch = matchesSearchTokens([
                    chap.title,
                    chap.description,
                    `ch${chap.chapter_number}`,
                    `chapter ${chap.chapter_number}`,
                    mod.title,
                    cat.categoryName
                ], searchQuery);

                const filteredLessons = [];

                chap.lessons.forEach(lesson => {
                    const isLessonMatch = matchesSearchTokens([
                        lesson.title,
                        lesson.description,
                        `topic ${lesson.lesson_number}`,
                        chap.title,
                        mod.title,
                        cat.categoryName
                    ], searchQuery);

                    if (isCategoryMatch || isModuleMatch || isChapterMatch || isLessonMatch) {
                        filteredLessons.push(lesson);
                    }
                });

                const isChapterVisible = filteredLessons.length > 0 || ((isCategoryMatch || isModuleMatch || isChapterMatch) && chap.isExplicit);

                if (isChapterVisible) {
                    filteredChapters.push({
                        ...chap,
                        lessons: filteredLessons
                    });
                }
            });

            const isModuleVisible = filteredChapters.length > 0 || ((isCategoryMatch || isModuleMatch) && mod.isExplicit);

            if (isModuleVisible) {
                filteredModules.push({
                    ...mod,
                    chapters: filteredChapters
                });
            }
        });

        if (filteredModules.length > 0) {
            filteredCategories.push({
                ...cat,
                modules: filteredModules
            });
        }
    });

    return filteredCategories;
}

// Helper implementing the view resolution logic from CurriculumTab.tsx
function resolveCurriculumViewState({
    relevantStudentsCount,
    hasAssignedCurriculum,
    visibleCurriculum,
    curriculumSearchQuery
}) {
    if (relevantStudentsCount === 0) {
        return 'NO_STUDENTS_ASSIGNED';
    }

    const showNoLearningPath = hasAssignedCurriculum !== undefined
        ? !hasAssignedCurriculum
        : (visibleCurriculum.length === 0 && !curriculumSearchQuery.trim());

    if (showNoLearningPath) {
        return 'NO_LEARNING_PATH_SET';
    }

    if (visibleCurriculum.length === 0) {
        return 'SEARCH_NO_RESULTS_MOUNTED';
    }

    return 'POPULATED_CURRICULUM_TREE';
}

// Sample classroom curriculum fixture (mirroring Friday Slot 2 baseline)
const sampleSourceCurriculum = [
    {
        categoryName: 'Foundation Courses',
        categoryOrder: 1,
        modules: [
            {
                id: 'mod-1',
                title: 'Level 1: Introduction to Flute',
                description: 'First steps in bansuri playing',
                module_number: 1,
                isExplicit: true,
                chapters: [
                    {
                        id: 'chap-1',
                        chapter_number: 1,
                        title: 'Getting Sound',
                        description: 'Embouchure and breathing',
                        isExplicit: true,
                        lessons: [
                            { id: 'les-1', lesson_number: 1, title: 'Holding the Flute', description: 'Finger placement' },
                            { id: 'les-2', lesson_number: 2, title: 'Producing the First Note', description: 'Lip position' }
                        ]
                    },
                    {
                        id: 'chap-2',
                        chapter_number: 2,
                        title: 'Basic Swaras',
                        description: 'Sa Re Ga Ma Pa Dha Ni',
                        isExplicit: true,
                        lessons: [
                            { id: 'les-3', lesson_number: 3, title: 'Playing Sa and Re', description: 'Lower hand keys' },
                            { id: 'les-4', lesson_number: 4, title: 'Playing Ga and Ma', description: 'Upper hand keys' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        categoryName: 'Raga Studies',
        categoryOrder: 2,
        modules: [
            {
                id: 'mod-2',
                title: 'Raag Yaman Deep Dive',
                description: 'Kalyan thaat evening raag',
                module_number: 2,
                isExplicit: true,
                chapters: [
                    {
                        id: 'chap-3',
                        chapter_number: 1,
                        title: 'Aroha & Avaroha',
                        description: 'Ascending and descending scale',
                        isExplicit: true,
                        lessons: [
                            { id: 'les-5', lesson_number: 1, title: 'Teevra Ma in Yaman', description: 'Sharp fourth note' }
                        ]
                    }
                ]
            }
        ]
    }
];

test('1. Baseline: empty search returns full source curriculum without mutation', () => {
    const visible = filterCurriculum(sampleSourceCurriculum, '');
    assert.equal(visible.length, 2);
    assert.equal(visible[0].modules.length, 1);
    assert.equal(visible[0].modules[0].chapters[0].lessons.length, 2);

    const state = resolveCurriculumViewState({
        relevantStudentsCount: 3,
        hasAssignedCurriculum: sampleSourceCurriculum.length > 0,
        visibleCurriculum: visible,
        curriculumSearchQuery: ''
    });
    assert.equal(state, 'POPULATED_CURRICULUM_TREE');
});

test('2. Defect reproduction: unmatched query (zzznomatchkfa1311) keeps controls mounted and shows search empty state', () => {
    const query = 'zzznomatchkfa1311';
    const visible = filterCurriculum(sampleSourceCurriculum, query);

    // Filtered result is empty
    assert.equal(visible.length, 0);

    // Source curriculum is NOT mutated or emptied
    assert.equal(sampleSourceCurriculum.length, 2);
    assert.equal(sampleSourceCurriculum[0].modules[0].chapters[0].lessons.length, 2);

    const hasAssignedCurriculum = sampleSourceCurriculum.length > 0;
    assert.equal(hasAssignedCurriculum, true);

    // CRITICAL: The view state must NOT be 'NO_LEARNING_PATH_SET'!
    // It must stay mounted and show SEARCH_NO_RESULTS_MOUNTED
    const state = resolveCurriculumViewState({
        relevantStudentsCount: 3,
        hasAssignedCurriculum,
        visibleCurriculum: visible,
        curriculumSearchQuery: query
    });
    assert.equal(state, 'SEARCH_NO_RESULTS_MOUNTED');
});

test('3. Recovery: clearing search query immediately restores all original curriculum without reload', () => {
    let query = 'zzznomatchkfa1311';
    let visible = filterCurriculum(sampleSourceCurriculum, query);
    assert.equal(visible.length, 0);

    // User clears search
    query = '';
    visible = filterCurriculum(sampleSourceCurriculum, query);

    assert.equal(visible.length, 2);
    assert.equal(visible[0].categoryName, 'Foundation Courses');
    assert.equal(visible[1].categoryName, 'Raga Studies');

    const state = resolveCurriculumViewState({
        relevantStudentsCount: 3,
        hasAssignedCurriculum: sampleSourceCurriculum.length > 0,
        visibleCurriculum: visible,
        curriculumSearchQuery: query
    });
    assert.equal(state, 'POPULATED_CURRICULUM_TREE');
});

test('4. Partial and token-based search filters correctly', () => {
    // Search by lesson title token
    const visibleByLesson = filterCurriculum(sampleSourceCurriculum, 'teevra');
    assert.equal(visibleByLesson.length, 1);
    assert.equal(visibleByLesson[0].categoryName, 'Raga Studies');
    assert.equal(visibleByLesson[0].modules[0].title, 'Raag Yaman Deep Dive');
    assert.equal(visibleByLesson[0].modules[0].chapters[0].lessons[0].title, 'Teevra Ma in Yaman');

    // Search by module title
    const visibleByModule = filterCurriculum(sampleSourceCurriculum, 'introduction');
    assert.equal(visibleByModule.length, 1);
    assert.equal(visibleByModule[0].categoryName, 'Foundation Courses');

    // Search by chapter number
    const visibleByChapter = filterCurriculum(sampleSourceCurriculum, 'ch2');
    assert.equal(visibleByChapter.length, 1);
    assert.equal(visibleByChapter[0].modules[0].chapters[0].chapter_number, 2);
});

test('5. Whitespace and case tolerance in search query', () => {
    const visible = filterCurriculum(sampleSourceCurriculum, '   YAMAN   DEEP   ');
    assert.equal(visible.length, 1);
    assert.equal(visible[0].categoryName, 'Raga Studies');
});

test('6. Genuinely absent curriculum correctly displays No Learning Path Set', () => {
    const emptySourceCurriculum = [];
    const hasAssignedCurriculum = emptySourceCurriculum.length > 0;
    assert.equal(hasAssignedCurriculum, false);

    const visible = filterCurriculum(emptySourceCurriculum, '');

    const state = resolveCurriculumViewState({
        relevantStudentsCount: 3,
        hasAssignedCurriculum,
        visibleCurriculum: visible,
        curriculumSearchQuery: ''
    });
    assert.equal(state, 'NO_LEARNING_PATH_SET');
});

test('7. No students assigned state takes precedence when student count is 0', () => {
    const state = resolveCurriculumViewState({
        relevantStudentsCount: 0,
        hasAssignedCurriculum: sampleSourceCurriculum.length > 0,
        visibleCurriculum: sampleSourceCurriculum,
        curriculumSearchQuery: ''
    });
    assert.equal(state, 'NO_STUDENTS_ASSIGNED');
});

test('8. Defensive fallback: even if hasAssignedCurriculum is undefined, non-empty search query never triggers No Learning Path Set', () => {
    const query = 'zzznomatchkfa1311';
    const visible = [];

    const state = resolveCurriculumViewState({
        relevantStudentsCount: 3,
        hasAssignedCurriculum: undefined, // fallback mode
        visibleCurriculum: visible,
        curriculumSearchQuery: query
    });

    assert.equal(state, 'SEARCH_NO_RESULTS_MOUNTED');
});
