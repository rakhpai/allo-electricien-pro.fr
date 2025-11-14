import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('PROPER TABLE INVESTIGATION');
console.log('═══════════════════════════════════════════════════════════\n');

async function investigateTables() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  console.log('Connection details:');
  console.log(`  URL: ${SUPABASE_URL}`);
  console.log(`  Using: Service Role Key (admin access)\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const tables = [
    'sites',
    'source_images',
    'image_variants',
    'image_usage',
    'image_generation_queue',
    'image_statistics'
  ];

  console.log('Checking each table with detailed error reporting...\n');

  for (const table of tables) {
    console.log(`━━━ Checking: ${table} ━━━`);

    // Try to select from table
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.log(`  Status: ❌ ERROR`);
      console.log(`  Error Code: ${error.code}`);
      console.log(`  Error Message: ${error.message}`);
      console.log(`  Details: ${error.details}`);
      console.log(`  Hint: ${error.hint}`);
    } else {
      console.log(`  Status: ✅ EXISTS`);
      console.log(`  Record count: ${count}`);
      if (data && data.length > 0) {
        console.log(`  Sample data: ${JSON.stringify(data[0], null, 2)}`);
      } else {
        console.log(`  Table is empty (0 records)`);
      }
    }
    console.log('');
  }

  // Also try to check the sites table specifically since user confirmed it exists
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SPECIFIC CHECK: sites table');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: sitesData, error: sitesError } = await supabase
    .from('sites')
    .select('id, domain, name, active')
    .limit(5);

  if (sitesError) {
    console.log(`❌ Error accessing sites table:`);
    console.log(`   Code: ${sitesError.code}`);
    console.log(`   Message: ${sitesError.message}`);
    console.log(`   Details: ${sitesError.details || 'none'}`);
  } else {
    console.log(`✅ Successfully accessed sites table`);
    console.log(`   Records found: ${sitesData.length}`);
    if (sitesData.length > 0) {
      console.log('\n   Data:');
      sitesData.forEach(site => {
        console.log(`     • ${site.domain} - ${site.name} (active: ${site.active})`);
      });
    }
  }
  console.log('');
}

investigateTables().catch(error => {
  console.error('\n❌ Investigation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
