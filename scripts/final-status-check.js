require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('=== FINAL STATUS CHECK - CITY LINKAGES ===\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkFinalStatus() {
  // Get domain ID
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  console.log(`Domain: allo-electricien.pro (${domain.id})\n`);

  // Total pages
  const { count: totalPages } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id);

  // Pages with city_id
  const { count: withCityId } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id)
    .not('city_id', 'is', null);

  // Pages with geographic_target_id
  const { count: withGeoTarget } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id)
    .not('geographic_target_id', 'is', null);

  // Pages with either city_id OR geographic_target_id
  // Using set theory: |A ∪ B| = |A| + |B| - |A ∩ B|
  const { count: withBoth } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id)
    .not('city_id', 'is', null)
    .not('geographic_target_id', 'is', null);

  const withEither = withCityId + withGeoTarget - withBoth;

  // Pages with NEITHER
  const { data: noLinkage } = await supabase
    .from('pages')
    .select('id, url_path, data')
    .eq('domain_id', domain.id)
    .is('city_id', null)
    .is('geographic_target_id', null);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FINAL COVERAGE STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`📊 Total Pages: ${totalPages}`);
  console.log(`\n✅ Pages WITH Geographic Linkage: ${withEither} (${(withEither/totalPages*100).toFixed(1)}%)`);
  console.log(`   - With city_id (INTEGER): ${withCityId}`);
  console.log(`   - With geographic_target_id (UUID): ${withGeoTarget}`);
  console.log(`   - With both: ${withBoth}`);
  console.log(`\n❌ Pages WITHOUT Geographic Linkage: ${noLinkage.length} (${(noLinkage.length/totalPages*100).toFixed(1)}%)`);

  if (noLinkage.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`REMAINING ${noLinkage.length} PAGES WITHOUT LINKAGE`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    noLinkage.forEach((page, idx) => {
      const data = page.data || {};
      console.log(`${idx + 1}. ${page.url_path}`);
      console.log(`   City: ${data.city_name || 'N/A'}`);
      console.log(`   Postal: ${data.zip_code || 'N/A'}`);
      console.log(`   Type: ${data.page_type || 'N/A'}`);
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Initial state (Nov 9):`);
  console.log(`  Pages with city_id: 1,095 (80.1%)`);
  console.log(`  Pages without city_id: 272 (19.9%)\n`);

  console.log(`After first update (153 city_id):`);
  console.log(`  Pages with city_id: 1,248 (91.3%)`);
  console.log(`  Pages without city_id: 119 (8.7%)\n`);

  console.log(`Current state (after geographic_target_id):`);
  console.log(`  Pages with linkage: ${withEither} (${(withEither/totalPages*100).toFixed(1)}%)`);
  console.log(`  Pages without linkage: ${noLinkage.length} (${(noLinkage.length/totalPages*100).toFixed(1)}%)\n`);

  const initialCoverage = (1095 / totalPages) * 100;
  const finalCoverage = (withEither / totalPages) * 100;
  const improvement = finalCoverage - initialCoverage;

  console.log(`Total improvement:`);
  console.log(`  From ${initialCoverage.toFixed(1)}% to ${finalCoverage.toFixed(1)}% (+${improvement.toFixed(1)}%)`);
  console.log(`  Populated ${withEither - 1095} additional pages (from 1,095 to ${withEither})\n`);

  console.log('✅ Final status check complete!\n');
}

checkFinalStatus().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
