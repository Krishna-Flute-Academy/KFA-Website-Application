const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  console.log("Fetching assignments...");
  const { data: assignments, error: err1 } = await supabase.from('assignments').select('*');
  if (err1) {
    console.error("Error fetching assignments:", err1);
  } else {
    console.log(`Found ${assignments.length} assignments.`);
    if (assignments.length > 0) {
      console.log("Sample assignment:", assignments[0]);
    }
  }

  console.log("\nFetching assignment_students...");
  const { data: mappings, error: err2 } = await supabase.from('assignment_students').select('*');
  if (err2) {
    console.error("Error fetching assignment_students:", err2);
  } else {
    console.log(`Found ${mappings.length} mappings.`);
    if (mappings.length > 0) {
      console.log("Sample mapping:", mappings[0]);
    }
  }
}

checkTasks();
