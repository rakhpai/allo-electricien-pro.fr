import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('DATABASE MIGRATION - IMAGE SYSTEM SCHEMA');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Execute SQL migration file
 */
async function runMigration() {
  // Validate environment variables
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || !SUPABASE_URL.includes('supabase.co')) {
    console.error('❌ SUPABASE_URL not configured in .env file');
    console.error('\nPlease update /home/proalloelectrici/hugosource/eleclogos/.env with:');
    console.error('SUPABASE_URL=https://eedbqzgrcqenopeyjwjj.supabase.co\n');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_')) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured in .env file');
    console.error('\nPlease update /home/proalloelectrici/hugosource/eleclogos/.env');
    console.error('Get your service role key from:');
    console.error('https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/settings/api\n');
    process.exit(1);
  }

  console.log('✓ Environment variables validated');
  console.log(`  Supabase URL: ${SUPABASE_URL}\n`);

  // Initialize Supabase client with service role key (admin access)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('✓ Supabase client initialized\n');

  // Read migration SQL file
  const migrationPath = path.resolve(__dirname, '../migrations/supabase-migration-image-system.sql');

  console.log('📄 Reading migration file...');
  console.log(`  Path: ${migrationPath}\n`);

  let migrationSQL;
  try {
    migrationSQL = await fs.readFile(migrationPath, 'utf8');
    console.log(`✓ Migration file loaded (${migrationSQL.length} characters)\n`);
  } catch (error) {
    console.error('❌ Failed to read migration file:', error.message);
    process.exit(1);
  }

  // Split SQL into individual statements
  // This is a simplified approach - complex migrations may need better parsing
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
  console.log('⚠️  NOTE: This will execute SQL via Supabase RPC');
  console.log('    For complex migrations, consider using the Supabase SQL Editor\n');

  // Execute migration
  console.log('🚀 Executing migration...\n');

  // For Supabase, we need to use the RPC or execute via API
  // The best approach is to use the SQL editor in dashboard
  // But we can also try using the REST API directly

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('MANUAL MIGRATION REQUIRED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Supabase does not support executing raw SQL via the JavaScript client.');
  console.log('Please execute the migration manually using one of these methods:\n');

  console.log('METHOD 1: Supabase SQL Editor (Recommended)');
  console.log('──────────────────────────────────────────────────────────');
  console.log('1. Go to: https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/editor');
  console.log('2. Click "New Query"');
  console.log('3. Copy the contents of:');
  console.log(`   ${migrationPath}`);
  console.log('4. Paste into the SQL editor');
  console.log('5. Click "Run" or press Ctrl+Enter\n');

  console.log('METHOD 2: psql Command Line');
  console.log('──────────────────────────────────────────────────────────');
  console.log('1. Get your database connection string from:');
  console.log('   https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/settings/database');
  console.log('2. Run:');
  console.log(`   psql "YOUR_CONNECTION_STRING" < ${migrationPath}\n`);

  console.log('METHOD 3: Copy SQL to Clipboard (macOS/Linux)');
  console.log('──────────────────────────────────────────────────────────');
  console.log(`cat ${migrationPath} | pbcopy  # macOS`);
  console.log(`cat ${migrationPath} | xclip -selection clipboard  # Linux\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('MIGRATION OVERVIEW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('The migration will create:');
  console.log('  • sites table (multi-tenancy for domains)');
  console.log('  • source_images table (master image repository)');
  console.log('  • image_variants table (processed images with watermarks)');
  console.log('  • image_usage table (track which pages use which images)');
  console.log('  • image_generation_queue table (on-demand generation)');
  console.log('  • image_statistics table (performance & usage analytics)');
  console.log('  • All necessary indexes, RLS policies, and triggers');
  console.log('  • Default site configuration for allo-electricien.pro\n');

  console.log('After running the migration, verify by running:');
  console.log('  node src/scripts/verify-migration.js\n');
}

// Run migration
runMigration().catch(error => {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
