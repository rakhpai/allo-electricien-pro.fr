import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Duplicate Paris subdomains to remove (old format)
const OLD_PARIS_URLS = [
  'paris-1',
  'paris-11',
  'paris-13',
  'paris-14',
  'paris-15',
  'paris-6'
];

/**
 * Main function
 */
async function main() {
  console.log('🧹 CLEANUP DUPLICATE WEBSITES');
  console.log('='.repeat(80));
  console.log('Removing old Paris URLs that failed to update (already have canonical versions)');
  console.log('='.repeat(80));
  console.log();

  // Find duplicate old Paris websites
  const { data: websites, error: fetchError } = await supabase
    .from('websites')
    .select('id, subdomain, city, zip')
    .eq('domain', 'allo-electricien.pro')
    .in('subdomain', OLD_PARIS_URLS);

  if (fetchError) {
    console.error('❌ Error fetching websites:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${websites.length} duplicate websites to remove\n`);

  if (websites.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  const results = {
    deleted: 0,
    failed: 0,
    total: websites.length,
    errors: []
  };

  for (let i = 0; i < websites.length; i++) {
    const website = websites[i];

    console.log(`[${i + 1}/${results.total}] Deleting ${website.subdomain}`);
    console.log(`  City: ${website.city}, Zip: ${website.zip}, ID: ${website.id}`);

    try {
      const { error } = await supabase
        .from('websites')
        .delete()
        .eq('id', website.id);

      if (error) {
        throw new Error(error.message);
      }

      console.log(`  ✅ Deleted`);
      results.deleted++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ id: website.id, subdomain: website.subdomain, error: error.message });
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total duplicates: ${results.total}`);
  console.log(`✅ Deleted: ${results.deleted}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(80));

  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach(err => {
      console.log(`  - ${err.subdomain} (ID: ${err.id}): ${err.error}`);
    });
  }

  console.log('\n✅ Cleanup complete!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
