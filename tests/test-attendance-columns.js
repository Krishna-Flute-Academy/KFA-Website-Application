import { createClient } from '@supabase/supabase-js';
import https from 'https';

const supabaseUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldnR5Y3dybWh6eWZ4dnhra2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTI1OTgsImV4cCI6MjA4ODYyODU5OH0.2Xogmd7xqfXg2AUP9PTWisTtAn2SXsAJUWWYWYB-XNs';

const options = {
  hostname: 'sevtycwrmhzyfxvxkkgc.supabase.co',
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      const definitions = spec.definitions || spec.components?.schemas;
      if (definitions && definitions.attendance) {
        console.log('Attendance columns:', Object.keys(definitions.attendance.properties));
      } else {
        console.log('Attendance table not found in OpenAPI spec.');
        // fallback query
        testFetch();
      }
    } catch(e) {
      console.log('Error parsing spec:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    const { data, error } = await supabase.from('attendance').select('*').limit(1);
    if (error) {
        console.error('Error fetching attendance:', error);
    } else {
        console.log('Attendance data:', data);
    }
}
