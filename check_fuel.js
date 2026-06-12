const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://buhizhfdczthwkytdjwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aGl6aGZkY3p0aHdreXRkandqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTA1OTcsImV4cCI6MjA5NjY2NjU5N30.c5q-qpPOSaLGi4J-wM205Rc-HUELzijkYrbg4X9YJkw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('fuel_logs').select('*');
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}
run();
