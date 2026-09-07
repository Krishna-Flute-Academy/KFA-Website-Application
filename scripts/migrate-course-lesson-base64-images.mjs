import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 1. Load environment configuration (.env.local or .env)
function loadEnv() {
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    const envPath = path.resolve(process.cwd(), '.env');
    const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : (fs.existsSync(envPath) ? envPath : null);
    
    if (targetPath) {
        const content = fs.readFileSync(targetPath, 'utf-8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        });
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to true (DRY RUN) for safety
const STORAGE_BUCKET = 'inventory_materials';

if (!supabaseUrl) {
    console.error('❌ Error: Missing Supabase URL in environment variables (NEXT_PUBLIC_AUTH_SUPABASE_URL).');
    process.exit(1);
}

// Enforce Service Role Key requirement for real execution
let activeKey;
if (DRY_RUN) {
    activeKey = supabaseServiceKey || supabaseAnonKey;
    if (!activeKey) {
        console.error('❌ Error: No Supabase API key available for discovery.');
        process.exit(1);
    }
} else {
    // REAL LIVE EXECUTION REQUIRES SERVICE ROLE KEY
    if (!supabaseServiceKey) {
        console.error('❌ CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is strictly required for live execution (DRY_RUN=false).');
        console.error('   Real administrative production migration must NOT fall back to anonymous credentials.');
        console.error('   Please provide SUPABASE_SERVICE_ROLE_KEY in your environment before running.');
        process.exit(1);
    }
    activeKey = supabaseServiceKey;
}

// Client initialized strictly for server-side administrative migration script
const supabase = createClient(supabaseUrl, activeKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

const MIME_TO_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff'
};

function sanitizeFileName(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
}

function parseBase64Images(lessonId, lessonTitle, html) {
    const matches = [];
    if (!html || !html.includes('data:image/')) return matches;

    // Matches <img ... src="data:image/[mime];base64,[data]" ...>
    const imgRegex = /<img\b([^>]*?)\bsrc=(["'])(data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+))\2([^>]*?)>/gi;

    let match;
    let imgIdx = 1;
    while ((match = imgRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const rawMime = `image/${match[4].toLowerCase()}`;
        const base64Data = match[5];
        const fileExt = MIME_TO_EXT[rawMime] || 'jpg';

        try {
            const buffer = Buffer.from(base64Data, 'base64');
            const byteSize = buffer.length;

            if (byteSize === 0) {
                console.warn(`  ⚠️  [${lessonTitle}] Empty image buffer decoded for img #${imgIdx}, skipping.`);
                continue;
            }

            // Calculate deterministic content SHA-256 hash
            const contentHash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 12);
            const targetStoragePath = `course-lessons/${lessonId}/migrated-${contentHash}-img${imgIdx}.${fileExt}`;
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${targetStoragePath}`;

            matches.push({
                fullTag,
                prefix: `data:image/${match[4]};base64,`,
                mimeType: rawMime,
                fileExt,
                contentHash,
                base64Data,
                buffer,
                byteSize,
                targetStoragePath,
                publicUrl
            });
            imgIdx++;
        } catch (e) {
            console.error(`  ❌ [${lessonTitle}] Failed to decode Base64 image #${imgIdx}:`, e.message);
        }
    }

    return matches;
}

async function runMigration() {
    console.log('================================================================');
    console.log(`🚀 KFA Course Lessons Base64 Image Migration (Phase 4B2)`);
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (Read-Only Simulation)' : '⚡ LIVE EXECUTION (Service Role Authenticated)'}`);
    console.log(`Supabase URL: ${supabaseUrl}`);
    console.log(`Storage Bucket: ${STORAGE_BUCKET}`);
    console.log(`Auth Mode: ${supabaseServiceKey ? '🔑 Service Role Key (Admin)' : '👤 Anon Key (Read-Only Discovery)'}`);
    console.log('================================================================\n');

    // 1. Fetch all course lessons
    console.log('📡 Fetching all course lessons from PostgreSQL...');
    const { data: allLessons, error: fetchErr } = await supabase
        .from('course_lessons')
        .select('id, lesson_number, title, description')
        .order('lesson_number', { ascending: true });

    if (fetchErr || !allLessons) {
        console.error('❌ Failed to fetch course lessons from Supabase:', fetchErr);
        process.exit(1);
    }

    console.log(`✅ Loaded ${allLessons.length} total course lessons from database.\n`);

    // 2. Discover lessons containing Base64 images
    const targetLessons = [];
    let totalImagesFound = 0;
    let totalBase64Bytes = 0;

    for (const lesson of allLessons) {
        if (!lesson.description || !lesson.description.includes('data:image')) {
            continue;
        }

        const images = parseBase64Images(lesson.id, lesson.title, lesson.description);
        if (images.length > 0) {
            const lessonBytes = images.reduce((sum, img) => sum + img.byteSize, 0);
            totalImagesFound += images.length;
            totalBase64Bytes += lessonBytes;

            targetLessons.push({
                id: lesson.id,
                lesson_number: lesson.lesson_number,
                title: lesson.title,
                originalDescription: lesson.description,
                originalChars: lesson.description.length,
                images
            });
        }
    }

    console.log('📊 DISCOVERY AUDIT SUMMARY:');
    console.log(`- Lessons Scanned: ${allLessons.length}`);
    console.log(`- Lessons with Base64 Images: ${targetLessons.length}`);
    console.log(`- Total Embedded Images: ${totalImagesFound}`);
    console.log(`- Total Base64 Image Payload: ${(totalBase64Bytes / (1024 * 1024)).toFixed(2)} MB (${totalBase64Bytes.toLocaleString()} bytes)\n`);

    if (targetLessons.length === 0) {
        console.log('🎉 No Base64 images found in any lesson descriptions. Database is clean!');
        return;
    }

    console.log('----------------------------------------------------------------');
    console.log('📋 AFFECTED LESSONS BREAKDOWN (DETERMINISTIC STORAGE PATHS):');
    console.log('----------------------------------------------------------------');
    targetLessons.forEach((l, idx) => {
        const totalKb = (l.images.reduce((s, i) => s + i.byteSize, 0) / 1024).toFixed(1);
        console.log(`[${idx + 1}/${targetLessons.length}] Topic #${l.lesson_number} "${l.title}" (ID: ${l.id})`);
        console.log(`    Images: ${l.images.length} | Description: ${(l.originalChars / 1024).toFixed(1)} KB | Base64: ${totalKb} KB`);
        l.images.forEach((img, iIdx) => {
            console.log(`      • Image ${iIdx + 1}: [${img.mimeType}] ${(img.byteSize / 1024).toFixed(1)} KB (hash: ${img.contentHash})`);
            console.log(`        Path: ${img.targetStoragePath}`);
        });
    });
    console.log('----------------------------------------------------------------\n');

    // 3. Dry Run Exit
    if (DRY_RUN) {
        console.log('ℹ️  DRY RUN COMPLETED.');
        console.log('✅ 0 storage files uploaded, 0 database rows updated.');
        console.log('To execute the live migration, run with:');
        console.log('SUPABASE_SERVICE_ROLE_KEY=your_key DRY_RUN=false node scripts/migrate-course-lesson-base64-images.mjs\n');
        return;
    }

    // 4. Live Execution: Create Recoverable Backup First
    console.log('📦 Step 1: Creating recoverable local backup before modifying database...');
    const backupDir = path.resolve(process.cwd(), 'migration-backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `course-lessons-base64-${timestamp}.json`);
    const backupData = targetLessons.map(l => ({
        id: l.id,
        lesson_number: l.lesson_number,
        title: l.title,
        originalDescription: l.originalDescription,
        imagesCount: l.images.length,
        totalBytes: l.images.reduce((s, i) => s + i.byteSize, 0)
    }));

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ Backup saved to: ${backupFilePath} (${backupData.length} lessons backed up)\n`);

    // 5. Migrate Lesson by Lesson
    console.log('⚡ Step 2: Beginning live image upload & lesson update...');
    let migratedLessonsCount = 0;
    let failedLessonsCount = 0;
    let uploadedImagesCount = 0;
    let reusedExistingImagesCount = 0;
    let bytesRemoved = 0;

    for (let i = 0; i < targetLessons.length; i++) {
        const lesson = targetLessons[i];
        console.log(`\n[${i + 1}/${targetLessons.length}] Processing "${lesson.title}"...`);

        let lessonUploadsSucceeded = true;
        const uploadResults = [];

        // Upload all images for this lesson
        for (let j = 0; j < lesson.images.length; j++) {
            const img = lesson.images[j];
            console.log(`  ⬆️  Checking/Uploading image ${j + 1}/${lesson.images.length} (${(img.byteSize / 1024).toFixed(1)} KB) -> ${img.targetStoragePath}...`);

            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(img.targetStoragePath, img.buffer, {
                    contentType: img.mimeType,
                    upsert: false
                });

            if (uploadErr) {
                // If the error indicates duplicate/already exists, safely reuse existing deterministic object
                if (uploadErr.message?.includes('already exists') || uploadErr.message?.includes('Duplicate') || uploadErr?.statusCode === '409' || uploadErr?.statusCode === 409) {
                    console.log(`  ℹ️  Object already exists deterministically in storage, reusing verified path.`);
                    reusedExistingImagesCount++;
                } else {
                    console.error(`  ❌ Storage upload failed for image ${j + 1}:`, uploadErr.message);
                    lessonUploadsSucceeded = false;
                    break;
                }
            } else {
                uploadedImagesCount++;
            }

            // Verify Storage object URL
            const { data: publicUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(img.targetStoragePath);

            if (!publicUrlData?.publicUrl) {
                console.error(`  ❌ Failed to get public URL for image ${j + 1}`);
                lessonUploadsSucceeded = false;
                break;
            }

            uploadResults.push({
                originalDataUrl: img.prefix + img.base64Data,
                publicUrl: publicUrlData.publicUrl
            });
        }

        if (!lessonUploadsSucceeded || uploadResults.length !== lesson.images.length) {
            console.error(`  ⚠️  Aborting database update for lesson "${lesson.title}" due to image upload failure. Row left unmodified.`);
            failedLessonsCount++;
            continue;
        }

        // Construct migrated HTML by replacing only the specific Base64 src values
        let updatedHtml = lesson.originalDescription;
        for (const item of uploadResults) {
            // Replace exact base64 data URL string with public storage URL
            updatedHtml = updatedHtml.split(item.originalDataUrl).join(item.publicUrl);
        }

        // Update database row for this specific lesson
        const { error: updateErr } = await supabase
            .from('course_lessons')
            .update({ description: updatedHtml })
            .eq('id', lesson.id);

        if (updateErr) {
            console.error(`  ❌ Failed to update database row for lesson "${lesson.title}":`, updateErr.message);
            failedLessonsCount++;
            continue;
        }

        // Post-update verification
        const { data: verifyRow, error: verifyErr } = await supabase
            .from('course_lessons')
            .select('id, description')
            .eq('id', lesson.id)
            .single();

        if (verifyErr || !verifyRow?.description) {
            console.error(`  ❌ Post-update verification fetch failed for lesson "${lesson.title}"`);
            failedLessonsCount++;
            continue;
        }

        const remainingBase64Count = (verifyRow.description.match(/data:image/g) || []).length;
        if (remainingBase64Count > 0) {
            console.warn(`  ⚠️  Post-update check: ${remainingBase64Count} data:image tags still present in "${lesson.title}"`);
        }

        const charsSaved = lesson.originalChars - verifyRow.description.length;
        bytesRemoved += charsSaved;
        migratedLessonsCount++;

        console.log(`  ✅ SUCCESS: Migrated "${lesson.title}" (${(lesson.originalChars / 1024).toFixed(1)} KB -> ${(verifyRow.description.length / 1024).toFixed(1)} KB, saved ${(charsSaved / 1024).toFixed(1)} KB)`);
    }

    console.log('\n================================================================');
    console.log('🏁 MIGRATION EXECUTION COMPLETE');
    console.log('================================================================');
    console.log(`- Lessons Scanned: ${allLessons.length}`);
    console.log(`- Lessons with Base64: ${targetLessons.length}`);
    console.log(`- Lessons Successfully Migrated: ${migratedLessonsCount}`);
    console.log(`- Lessons Failed: ${failedLessonsCount}`);
    console.log(`- Images Uploaded: ${uploadedImagesCount} (Reused deterministic: ${reusedExistingImagesCount})`);
    console.log(`- Total Payload Removed: ${(bytesRemoved / (1024 * 1024)).toFixed(2)} MB (${bytesRemoved.toLocaleString()} bytes)`);
    console.log('================================================================\n');
}

runMigration().catch(err => {
    console.error('Fatal migration script error:', err);
    process.exit(1);
});
