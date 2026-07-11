const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not found.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, name, email, role');
        if (error) throw error;
        console.log(`Total users in DB: ${users.length}`);
        users.forEach(u => console.log(`- ${u.name} (Role: ${u.role}, Email: ${u.email}, ID: ${u.id})`));
    } catch (e) {
        console.error(e);
    }
}
listUsers();
