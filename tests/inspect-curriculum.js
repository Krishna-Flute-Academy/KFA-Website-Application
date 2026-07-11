import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Auth Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Fetching allocations...');
    const { data: allocations, error: allocError } = await supabase
        .from('classroom_inventory_allocation')
        .select('*')
        .limit(5);

    if (allocError) {
        console.error('Allocations error:', allocError);
    } else {
        console.log('Allocations:', allocations);
    }

    console.log('Fetching progress...');
    const { data: progress, error: progError } = await supabase
        .from('student_topic_progress')
        .select('*')
        .limit(5);

    if (progError) {
        console.error('Progress error:', progError);
    } else {
        console.log('Progress:', progress);
    }
}

inspect();
