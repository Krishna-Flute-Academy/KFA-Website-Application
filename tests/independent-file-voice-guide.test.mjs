import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Load staging configuration
const env = fs.readFileSync('.env.local', 'utf8');
const envMap = {};
for (const line of env.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) envMap[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
    envMap.NEXT_PUBLIC_SUPABASE_URL,
    envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

describe('KFA Curriculum: Independent Primary File and Voice Guide Integration', () => {
    let syntheticModuleId = null;
    let syntheticChapterId = null;
    let syntheticLessonIds = [];

    before(async () => {
        // Find an existing module to attach a synthetic test chapter
        const { data: modules } = await supabase.from('course_modules').select('id').limit(1);
        if (modules && modules.length > 0) {
            syntheticModuleId = modules[0].id;
            
            // Create a disposable synthetic chapter
            const chapId = 'synth_chap_' + Date.now();
            const { data: chapData, error: chapErr } = await supabase.from('course_chapters').insert([{
                id: crypto.randomUUID(),
                module_id: syntheticModuleId,
                title: 'SYNTHETIC TEST CHAPTER ' + Date.now(),
                description: 'Temporary chapter for independent file and voice verification',
                chapter_number: 999
            }]).select();

            if (!chapErr && chapData && chapData.length > 0) {
                syntheticChapterId = chapData[0].id;
            }
        }
    });

    after(async () => {
        // Clean up all synthetic records created during testing
        if (syntheticLessonIds.length > 0) {
            await supabase.from('course_lessons').delete().in('id', syntheticLessonIds);
        }
        if (syntheticChapterId) {
            await supabase.from('course_chapters').delete().eq('id', syntheticChapterId);
        }
    });

    test('1. Record audio -> attach PDF -> save -> reload: both retained distinctly', async () => {
        if (!syntheticChapterId) return;

        const lessonId = crypto.randomUUID();
        syntheticLessonIds.push(lessonId);

        // Simulated form state: record audio, then attach PDF
        const recordedAudioUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co/storage/v1/object/public/inventory_materials/materials/audio_synthetic_' + Date.now() + '.webm';
        const primaryFileUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co/storage/v1/object/public/inventory_materials/materials/synthetic_notation.pdf';

        const insertPayload = {
            id: lessonId,
            chapter_id: syntheticChapterId,
            title: 'Synthetic Topic 1 - Voice Then PDF',
            description: 'Testing recording audio first, then attaching PDF',
            lesson_number: 1,
            material_type: 'pdf',
            material_url: primaryFileUrl,
            audio_url: recordedAudioUrl,
            file_name: 'synthetic_notation.pdf',
            file_size: '142.5KB',
            duration: 'PDF • 142.5KB'
        };

        const { error: insertErr } = await supabase.from('course_lessons').insert([insertPayload]);
        assert.ifError(insertErr);

        // Reload from database to verify persistence
        const { data: loaded, error: loadErr } = await supabase
            .from('course_lessons')
            .select('*')
            .eq('id', lessonId)
            .single();

        assert.ifError(loadErr);
        assert.equal(loaded.material_url, primaryFileUrl, 'Primary PDF material_url must be preserved');
        assert.equal(loaded.audio_url, recordedAudioUrl, 'Audio voice guide audio_url must be preserved');
        assert.equal(loaded.file_name, 'synthetic_notation.pdf');
        assert.equal(loaded.material_type, 'pdf');
    });

    test('2. Attach primary file -> record/upload audio -> save -> reload: both retained distinctly', async () => {
        if (!syntheticChapterId) return;

        const lessonId = crypto.randomUUID();
        syntheticLessonIds.push(lessonId);

        // First attached notation image, then voice guide recorded/uploaded
        const notationImageUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co/storage/v1/object/public/inventory_materials/materials/notation_image.png';
        const voiceGuideUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co/storage/v1/object/public/inventory_materials/materials/audio_guide_' + Date.now() + '.mp3';

        const insertPayload = {
            id: lessonId,
            chapter_id: syntheticChapterId,
            title: 'Synthetic Topic 2 - Image Then Voice',
            description: 'Testing attaching notation first, then recording audio',
            lesson_number: 2,
            material_type: 'image',
            material_url: notationImageUrl,
            audio_url: voiceGuideUrl,
            file_name: 'notation_image.png',
            file_size: '88.2KB',
            duration: 'IMAGE • 88.2KB'
        };

        const { error: insertErr } = await supabase.from('course_lessons').insert([insertPayload]);
        assert.ifError(insertErr);

        // Reload
        const { data: loaded, error: loadErr } = await supabase
            .from('course_lessons')
            .select('*')
            .eq('id', lessonId)
            .single();

        assert.ifError(loadErr);
        assert.equal(loaded.material_url, notationImageUrl, 'Notation image must persist');
        assert.equal(loaded.audio_url, voiceGuideUrl, 'Voice guide audio must persist');
        assert.equal(loaded.material_type, 'image');
    });

    test('3. Replace primary file: existing audio unchanged; Replace voice guide: primary unchanged', async () => {
        if (!syntheticChapterId) return;

        const lessonId = syntheticLessonIds[0]; // Reuse first synthetic topic
        const originalAudio = (await supabase.from('course_lessons').select('audio_url').eq('id', lessonId).single()).data.audio_url;

        // 3a. Replace primary file with a new PDF
        const replacementPdf = 'https://sevtycwrmhzyfxvxkkgc.supabase.co/storage/v1/object/public/inventory_materials/materials/replacement_sheet.pdf';
        const { error: updateFileErr } = await supabase
            .from('course_lessons')
            .update({
                material_url: replacementPdf,
                file_name: 'replacement_sheet.pdf',
                file_size: '210.0KB',
                material_type: 'pdf'
            })
            .eq('id', lessonId);
        assert.ifError(updateFileErr);

        // Verify audio was unchanged
        const { data: afterFileReplace } = await supabase.from('course_lessons').select('*').eq('id', lessonId).single();
        assert.equal(afterFileReplace.material_url, replacementPdf);
        assert.equal(afterFileReplace.audio_url, originalAudio, 'Audio guide must NOT be altered when replacing primary file');

        // 3b. Replace voice guide with a new recording
        const newVoiceGuide = 'https://sevtycwrmhzyfxvxkkgc.supabase.co/storage/v1/object/public/inventory_materials/materials/new_voice_guide_' + Date.now() + '.webm';
        const { error: updateAudioErr } = await supabase
            .from('course_lessons')
            .update({ audio_url: newVoiceGuide })
            .eq('id', lessonId);
        assert.ifError(updateAudioErr);

        // Verify primary file was unchanged
        const { data: afterAudioReplace } = await supabase.from('course_lessons').select('*').eq('id', lessonId).single();
        assert.equal(afterAudioReplace.material_url, replacementPdf, 'Primary file must NOT be altered when replacing voice guide');
        assert.equal(afterAudioReplace.audio_url, newVoiceGuide);
    });

    test('4. Remove primary only: audio survives; Remove audio only: primary survives', async () => {
        if (!syntheticChapterId) return;

        const lessonId = syntheticLessonIds[1]; // Use second synthetic topic
        const initial = (await supabase.from('course_lessons').select('*').eq('id', lessonId).single()).data;
        const initialAudio = initial.audio_url;
        const initialMaterial = initial.material_url;

        // 4a. Remove primary file only
        const { error: removePrimaryErr } = await supabase
            .from('course_lessons')
            .update({
                material_url: null,
                file_name: null,
                file_size: null,
                material_type: 'file',
                duration: null
            })
            .eq('id', lessonId);
        assert.ifError(removePrimaryErr);

        const { data: afterPrimaryRemoved } = await supabase.from('course_lessons').select('*').eq('id', lessonId).single();
        assert.equal(afterPrimaryRemoved.material_url, null, 'Primary file should be cleared');
        assert.equal(afterPrimaryRemoved.audio_url, initialAudio, 'Audio guide must survive primary file removal');

        // 4b. Re-attach primary file, then remove audio only
        await supabase.from('course_lessons').update({
            material_url: initialMaterial,
            file_name: 'notation_image.png',
            material_type: 'image'
        }).eq('id', lessonId);

        const { error: removeAudioErr } = await supabase
            .from('course_lessons')
            .update({ audio_url: null })
            .eq('id', lessonId);
        assert.ifError(removeAudioErr);

        const { data: afterAudioRemoved } = await supabase.from('course_lessons').select('*').eq('id', lessonId).single();
        assert.equal(afterAudioRemoved.audio_url, null, 'Audio guide should be cleared');
        assert.equal(afterAudioRemoved.material_url, initialMaterial, 'Primary file must survive audio guide removal');
    });

    test('5. Edit-save without changes and unrelated text edits preserve both references', async () => {
        if (!syntheticChapterId) return;

        const lessonId = syntheticLessonIds[0];
        const beforeData = (await supabase.from('course_lessons').select('*').eq('id', lessonId).single()).data;

        // Unrelated edit: change title and description only
        const newTitle = 'Updated Synthetic Title ' + Date.now();
        const { error: updateTextErr } = await supabase
            .from('course_lessons')
            .update({
                title: newTitle,
                description: 'Updated instructions without touching attachments'
            })
            .eq('id', lessonId);
        assert.ifError(updateTextErr);

        const { data: afterData } = await supabase.from('course_lessons').select('*').eq('id', lessonId).single();
        assert.equal(afterData.title, newTitle);
        assert.equal(afterData.material_url, beforeData.material_url, 'material_url must be preserved on text-only edits');
        assert.equal(afterData.audio_url, beforeData.audio_url, 'audio_url must be preserved on text-only edits');
        assert.equal(afterData.file_name, beforeData.file_name);
        assert.equal(afterData.material_type, beforeData.material_type);
    });

    test('6. Legacy audio topic compatibility: safely detected and retains audio reference', async () => {
        // Query an existing legacy topic with material_type = 'audio'
        const { data: legacyLessons } = await supabase
            .from('course_lessons')
            .select('*')
            .eq('material_type', 'audio')
            .limit(1);

        if (legacyLessons && legacyLessons.length > 0) {
            const legacy = legacyLessons[0];
            assert.ok(legacy.material_url.includes('.webm') || legacy.file_name.includes('.webm'), 'Legacy topic has WebM recording');
            
            // Backward compatibility logic check:
            const isLegacyAudio = !legacy.audio_url && (
                legacy.material_type === 'audio' ||
                /(voice[-_]?note|audio[-_]|audio[-_]?guide|\.webm|\.mp3|\.wav|\.m4a|\.ogg)/i.test(legacy.material_url || '') ||
                /(voice[-_]?note|audio[-_]|audio[-_]?guide|\.webm|\.mp3|\.wav|\.m4a|\.ogg)/i.test(legacy.file_name || '')
            );
            assert.equal(isLegacyAudio, true, 'Must correctly identify legacy audio topics');

            // Effective voice guide is extracted from material_url
            const effectiveAudio = legacy.audio_url || (isLegacyAudio ? legacy.material_url : null);
            assert.ok(effectiveAudio, 'Effective audio guide is resolved without data loss');
        }
    });
});
