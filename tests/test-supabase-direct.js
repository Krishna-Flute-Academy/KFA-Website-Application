
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cmjyqvyzxthnjnuxbufz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtanlxdnl6eHRobmpudXhidWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjU0NTAsImV4cCI6MjA3NjY0MTQ1MH0.fnx-7y8wwc9vwnswtBfgukjn_s9S_-z3b0yS_LoCuPE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = ['blog_posts', 'testimonials', 'gallery_items', 'events', 'inquiries'];

async function testFetch() {
    for (const table of tables) {
        try {
            console.log(`Checking table: ${table}...`);
            const { error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.error(`  Error for ${table}:`, error.code, error.message);
            } else {
                console.log(`  Success! ${table} count:`, count);
            }
        } catch (e) {
            console.error(`  Exception for ${table}:`, e.message);
        }
    }

    console.log('\nChecking buckets...');
    try {
        const { data: buckets, error: bError } = await supabase.storage.listBuckets();
        if (bError) {
            console.error('  Error listing buckets:', bError.message);
        } else {
            console.log('  Buckets found:', buckets.map(b => b.name).join(', '));
        }
    } catch (e) {
        console.error('  Exception listing buckets:', e.message);
    }
}

testFetch();
