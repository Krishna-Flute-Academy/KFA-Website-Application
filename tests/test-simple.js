
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cmjyqvyzxthnjnuxbufz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtanlxdnl6eHRobmpudXhidWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjU0NTAsImV4cCI6MjA3NjY0MTQ1MH0.fnx-7y8wwc9vwnswtBfgukjn_s9S_-z3b0yS_LoCuPE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    console.log('Fetching blog_posts...');
    const { data, error } = await supabase
        .from('blog_posts')
        .select('title')
        .limit(1);

    if (error) {
        console.log('Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Success:', data);
    }
}

testFetch();
