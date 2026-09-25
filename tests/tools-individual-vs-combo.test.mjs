import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('PracticeSuiteModal: exposes isComboMode prop and defaults appropriately', () => {
    const modalPath = path.join(projectRoot, 'src/components/PracticeSuiteModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    // Props check
    assert.match(modalContent, /isComboMode\?: boolean/);
    assert.match(modalContent, /const isCombo = isComboMode !== undefined \? isComboMode : defaultTab === 'combosetup';/);

    // Audio exclusivity check
    assert.match(modalContent, /if \(!isCombo\) \{[\s\S]*?setIsMetronomePlaying\(false\);[\s\S]*?setIsDrumsPlaying\(false\);/);
    assert.match(modalContent, /if \(!isCombo\) \{[\s\S]*?setIsDrumsPlaying\(false\);[\s\S]*?stopTanpuraNodes\(\);[\s\S]*?setIsTanpuraPlaying\(false\);/);

    // Tab navigation guarded by isCombo
    assert.match(modalContent, /\{isCombo && \([\s\S]*?Combo Mixer[\s\S]*?\{tab\.label\}[\s\S]*?\)\}/);

    // Minimized quick switcher guarded by isCombo
    assert.match(modalContent, /Quick Tab Switcher[\s\S]*?\{isCombo && \([\s\S]*?tab\.id[\s\S]*?\)\}/);
});

test('LibraryTab: cleanly separates Individual Practice Tools from Combo Section', () => {
    const libraryPath = path.join(projectRoot, 'src/components/student-dashboard/LibraryTab.tsx');
    const libraryContent = fs.readFileSync(libraryPath, 'utf8');

    // Individual tools section
    assert.match(libraryContent, /Individual Practice Tools/);
    assert.match(libraryContent, /Flute Tuner/);
    assert.match(libraryContent, /Flute to Notes \(Sur to Notation\)/);
    assert.match(libraryContent, /Tanpura Drone/);
    assert.match(libraryContent, /Practice Metronome/);
    assert.match(libraryContent, /Drum Beats Sequencer/);

    // Dedicated Combo Section
    assert.match(libraryContent, /Combo Riyaz Section • Merged Accompaniment/);
    assert.match(libraryContent, /Combo Session Mixer/);
    assert.doesNotMatch(libraryContent, /Combo Session Mixer \(Tanpura \+ Metronome \+ Drums\)/);
    assert.match(libraryContent, /setPracticeSuiteTab\('combosetup'\)/);
});

test('OverviewTab: individual tools in grid and dedicated combo session mixer card', () => {
    const overviewPath = path.join(projectRoot, 'src/components/student-dashboard/OverviewTab.tsx');
    const overviewContent = fs.readFileSync(overviewPath, 'utf8');

    assert.match(overviewContent, /Individual Tools/);
    assert.match(overviewContent, /Flute Tuner/);
    assert.match(overviewContent, /Flute to Notes/);
    assert.match(overviewContent, /Tanpura Drone/);
    assert.match(overviewContent, /Practice Metronome/);
    assert.match(overviewContent, /Drum Beats/);

    assert.match(overviewContent, /Combo Session Mixer/);
    assert.match(overviewContent, /Merged Tanpura \+ Metronome \+ Drums in sync/);
});

test('StudentDashboardContainer & ClientPracticeToolsPage: pass isComboMode accurately', () => {
    const sdcPath = path.join(projectRoot, 'src/components/student-dashboard/StudentDashboardContainer.tsx');
    const sdcContent = fs.readFileSync(sdcPath, 'utf8');
    assert.match(sdcContent, /isComboMode=\{practiceSuiteTab === 'combosetup'\}/);

    const ptPath = path.join(projectRoot, 'app/practice-tools/ClientPracticeToolsPage.tsx');
    const ptContent = fs.readFileSync(ptPath, 'utf8');
    assert.match(ptContent, /isComboMode=\{practiceSuiteTab === 'combosetup'\}/);
    assert.match(ptContent, /Combo Riyaz Section • Merged Accompaniment/);
});
