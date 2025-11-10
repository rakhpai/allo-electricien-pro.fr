require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('=== UPDATE PARIS POSTAL CODES IN SUPABASE ===\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Mapping of incorrect to correct postal codes
const postalCodeFixes = {
  '75101': '75001',
  '75102': '75002',
  '75103': '75003',
  '75104': '75004',
  '75105': '75005',
  '75106': '75006',
  '75107': '75007',
  '75108': '75008',
  '75109': '75009',
  '75110': '75010',
  '75112': '75012',
  '75113': '75013',
  '75114': '75014',
  '75115': '75015',
  '75116': '75016',
  '75117': '75017',
  '75118': '75018',
  '75119': '75019',
  '75120': '75020'
};

async function updateParisPostalCodes() {
  // Get domain ID
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  console.log(`Domain: allo-electricien.pro (${domain.id})\n`);

  // Get all Paris pages with incorrect postal codes
  const { data: parisPages, error } = await supabase
    .from('pages')
    .select('id, url_path, data')
    .eq('domain_id', domain.id)
    .ilike('url_path', '/paris-%');

  if (error) {
    console.error('❌ Error fetching Paris pages:', error.message);
    return;
  }

  console.log(`Found ${parisPages.length} Paris pages\n`);

  const results = {
    updated: [],
    noChange: [],
    errors: []
  };

  // Process each page
  for (const page of parisPages) {
    const zipCode = page.data?.zip_code;

    // Check if this postal code needs fixing
    if (zipCode && postalCodeFixes[zipCode]) {
      const correctPostalCode = postalCodeFixes[zipCode];

      console.log(`Updating ${page.url_path}`);
      console.log(`  ${zipCode} → ${correctPostalCode}`);

      // Update the data JSONB field
      const updatedData = {
        ...page.data,
        zip_code: correctPostalCode
      };

      const { error: updateError } = await supabase
        .from('pages')
        .update({ data: updatedData })
        .eq('id', page.id);

      if (updateError) {
        console.log(`  ❌ Error: ${updateError.message}`);
        results.errors.push({ url: page.url_path, error: updateError.message });
      } else {
        console.log(`  ✓ Updated`);
        results.updated.push(page.url_path);
      }
    } else if (zipCode && Object.values(postalCodeFixes).includes(zipCode)) {
      console.log(`${page.url_path}: Already correct (${zipCode})`);
      results.noChange.push(page.url_path);
    } else {
      console.log(`${page.url_path}: No fix needed (${zipCode || 'null'})`);
      results.noChange.push(page.url_path);
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`✅ Updated: ${results.updated.length} pages`);
  console.log(`ℹ️  No change needed: ${results.noChange.length} pages`);
  if (results.errors.length > 0) {
    console.log(`❌ Errors: ${results.errors.length} pages`);
    results.errors.forEach(e => console.log(`   - ${e.url}: ${e.error}`));
  }

  console.log('\n✅ Supabase update complete!\n');

  return results;
}

updateParisPostalCodes().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
