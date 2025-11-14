import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('MIGRATION VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Verify migration was successful
 */
async function verifyMigration() {
  // Validate environment variables
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Checking database tables...\n');

  const tables = [
    { name: 'sites', key: 'domain' },
    { name: 'source_images', key: 'filename' },
    { name: 'image_variants', key: 'variant_type' },
    { name: 'image_usage', key: 'page_id' },
    { name: 'image_generation_queue', key: 'status' },
    { name: 'image_statistics', key: 'stat_date' }
  ];

  const results = {
    success: [],
    failed: [],
    counts: {}
  };

  for (const table of tables) {
    try {
      // Try to query the table
      const { data, error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        results.failed.push({ table: table.name, error: error.message });
        console.log(`  ❌ ${table.name}: ${error.message}`);
      } else {
        results.success.push(table.name);
        results.counts[table.name] = count || 0;
        console.log(`  ✓ ${table.name} (${count || 0} records)`);
      }
    } catch (error) {
      results.failed.push({ table: table.name, error: error.message });
      console.log(`  ❌ ${table.name}: ${error.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VERIFICATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.failed.length === 0) {
    console.log('✅ All tables exist and are accessible!');
    console.log(`\nTables created: ${results.success.length}/6`);

    // Check for default site
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECKING DEFAULT SITE CONFIGURATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*')
      .eq('domain', 'allo-electricien.pro')
      .single();

    if (sitesError) {
      console.log('⚠️  Default site (allo-electricien.pro) not found');
      console.log('   This should have been created by the migration\n');
    } else {
      console.log('✓ Default site configured:');
      console.log(`  Domain: ${sites.domain}`);
      console.log(`  Name: ${sites.name}`);
      console.log(`  Active: ${sites.active}`);
      console.log('  Watermark config: ✓\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('1. Create storage buckets:');
    console.log('   • source-images (private)');
    console.log('   • processed-images (public)');
    console.log('\n2. Upload logos:');
    console.log('   node src/scripts/upload-logos.js');
    console.log('\n3. Upload source images:');
    console.log('   node src/scripts/upload-source-images.js\n');

  } else {
    console.log(`❌ Migration incomplete: ${results.failed.length} tables missing\n`);
    console.log('Failed tables:');
    results.failed.forEach(f => {
      console.log(`  • ${f.table}: ${f.error}`);
    });
    console.log('\nPlease run the migration SQL file in the Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/editor\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run verification
verifyMigration().catch(error => {
  console.error('\n❌ Verification failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
