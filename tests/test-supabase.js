
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = 'https://cmjyqvyzxthnjnuxbufz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtanlxdnl6eHRobmpudXhidWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjU0NTAsImV4cCI6MjA3NjY0MTQ1MH0.fnx-7y8wwc9vwnswtBfgukjn_s9S_-z3b0yS_LoCuPE';

console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey?.length);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    console.log('Fetching blog_posts...');
    const { data, error, count } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error fetching blog_posts:', error);
    } else {
        console.log('Success! Count:', count);
    }

    console.log('Fetching testimonials...');
    const { count: tCount, error: tError } = await supabase
        .from('testimonials')
        .select('*', { count: 'exact', head: true });

    if (tError) {
        console.error('Error fetching testimonials:', tError);
    } else {
        console.log('Success! Testimonials Count:', tCount);
    }
}

testFetch();
