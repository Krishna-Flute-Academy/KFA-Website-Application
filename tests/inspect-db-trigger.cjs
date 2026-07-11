const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTrigger() {
    try {
        console.log("Fetching function definition for transfer_student_history_on_class_shift...");
        
        try {
            const { data, error } = await supabase.rpc('execute_sql_temp_debug', { 
                query_text: "select prosrc from pg_proc where proname = 'transfer_student_history_on_class_shift'" 
            });

            if (error) {
                console.log("Could not query pg_proc directly via RPC:", error.message || error);
            } else {
                console.log("Function source code:");
                console.log(data);
            }
        } catch (e) {
            console.log("RPC execution failed:", e.message || e);
        }
    } catch (e) {
        console.error(e);
    }
}

inspectTrigger();
