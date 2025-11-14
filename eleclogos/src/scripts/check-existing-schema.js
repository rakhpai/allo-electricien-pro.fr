import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('CHECKING EXISTING SCHEMA');
console.log('═══════════════════════════════════════════════════════════\n');

async function checkSchema() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Checking for existing tables...\n');

  const tables = [
    'sites',
    'source_images',
    'image_variants',
    'image_usage',
    'image_generation_queue',
    'image_statistics'
  ];

  const existing = [];
  const missing = [];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      missing.push(table);
      console.log(`  ❌ ${table}: Does not exist`);
    } else {
      existing.push(table);
      console.log(`  ✓ ${table}: Exists`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Existing tables: ${existing.length}/6`);
  console.log(`Missing tables: ${missing.length}/6\n`);

  if (existing.length > 0) {
    console.log('Existing tables:');
    existing.forEach(t => console.log(`  • ${t}`));
    console.log('');
  }

  if (missing.length > 0) {
    console.log('Missing tables:');
    missing.forEach(t => console.log(`  • ${t}`));
    console.log('');
  }

  if (existing.length > 0 && existing.length < 6) {
    console.log('⚠️  Partial migration detected!\n');
    console.log('OPTIONS:\n');
    console.log('Option 1: Drop existing tables and re-run full migration');
    console.log('Option 2: Run migration with CREATE TABLE IF NOT EXISTS (already in SQL)\n');
    console.log('The migration SQL already uses "IF NOT EXISTS" so it should be safe to re-run.\n');
  }

  if (existing.length === 6) {
    console.log('✅ All tables exist! Migration complete.\n');
  }

  if (missing.length === 6) {
    console.log('ℹ️  No tables exist. Ready for fresh migration.\n');
  }
}

checkSchema().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
