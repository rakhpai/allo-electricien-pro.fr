import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Map old Paris subdomains to canonical versions
const PARIS_MAPPING = {
  'paris-1': 'paris-1er',
  'paris-2': 'paris-2e',
  'paris-3': 'paris-3e',
  'paris-4': 'paris-4e',
  'paris-5': 'paris-5e',
  'paris-6': 'paris-6e',
  'paris-7': 'paris-7e',
  'paris-8': 'paris-8e',
  'paris-9': 'paris-9e',
  'paris-10': 'paris-10e',
  'paris-11': 'paris-11e',
  'paris-12': 'paris-12e',
  'paris-13': 'paris-13e',
  'paris-14': 'paris-14e',
  'paris-15': 'paris-15e',
  'paris-16': 'paris-16e',
  'paris-17': 'paris-17e',
  'paris-18': 'paris-18e',
  'paris-19': 'paris-19e',
  'paris-20': 'paris-20e'
};

/**
 * Update a single website record
 */
async function updateWebsite(id, oldSubdomain, newSubdomain) {
  const { error } = await supabase
    .from('websites')
    .update({
      subdomain: newSubdomain,
      full_domain: `${newSubdomain}.allo-electricien.pro`
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update website ${id}: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 UPDATE WEBSITES TABLE - PARIS URLS');
  console.log('='.repeat(80));
  console.log('Converting Paris URLs to canonical format');
  console.log('='.repeat(80));
  console.log();

  // Find all allo-electricien.pro Paris websites with old URLs
  const { data: websites, error: fetchError } = await supabase
    .from('websites')
    .select('id, subdomain, city, zip')
    .eq('domain', 'allo-electricien.pro')
    .in('subdomain', Object.keys(PARIS_MAPPING));

  if (fetchError) {
    console.error('❌ Error fetching websites:', fetchError.message);
    process.exit(1);
  }

  console.log(`Found ${websites.length} Paris websites to update\n`);

  if (websites.length === 0) {
    console.log('✅ All Paris URLs are already in canonical format!');
    return;
  }

  const results = {
    updated: 0,
    failed: 0,
    total: websites.length,
    errors: []
  };

  for (let i = 0; i < websites.length; i++) {
    const website = websites[i];
    const oldSubdomain = website.subdomain;
    const newSubdomain = PARIS_MAPPING[oldSubdomain];

    console.log(`[${i + 1}/${results.total}] ${oldSubdomain} → ${newSubdomain}`);
    console.log(`  City: ${website.city}, Zip: ${website.zip}`);

    try {
      await updateWebsite(website.id, oldSubdomain, newSubdomain);
      console.log(`  ✅ Updated website ${website.id}`);
      results.updated++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ id: website.id, subdomain: oldSubdomain, error: error.message });
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total websites: ${results.total}`);
  console.log(`✅ Updated: ${results.updated}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(80));

  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach(err => {
      console.log(`  - ${err.subdomain} (ID: ${err.id}): ${err.error}`);
    });
  }

  // Save results
  const resultsPath = path.join(__dirname, '..', 'websites-paris-update-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    ...results,
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log(`\n📄 Results saved to: ${resultsPath}`);
  console.log('\n✅ Update complete!');
  console.log('\nNext steps:');
  console.log('  1. Run: node scripts/generate-data.js');
  console.log('  2. Run: node scripts/fetch-sitemap-data.js');
  console.log('  3. Rebuild Hugo and deploy');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
