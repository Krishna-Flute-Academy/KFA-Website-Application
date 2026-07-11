const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listClassrooms() {
    try {
        const { data: rooms, error } = await supabase
            .from('classrooms')
            .select('id, name, type, status');
        if (error) throw error;
        console.log(`Total classrooms: ${rooms.length}`);
        rooms.forEach(r => console.log(`- Name: ${r.name}, ID: ${r.id}, Type: ${r.type}, Status: ${r.status}`));
    } catch (e) {
        console.error(e);
    }
}
listClassrooms();
