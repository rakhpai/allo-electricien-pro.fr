require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('=== INVESTIGATE PAGES TABLE CITY_ID FIELD ===\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function investigatePagesCityId() {
  console.log('📊 Checking pages table city_id field type and usage\n');

  // Get domain ID
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  console.log(`Domain ID: ${domain.id}\n`);

  // Get sample pages WITH city_id
  const { data: pagesWithCityId } = await supabase
    .from('pages')
    .select('id, url_path, city_id, data')
    .eq('domain_id', domain.id)
    .not('city_id', 'is', null)
    .limit(10);

  console.log('Sample pages WITH city_id:');
  pagesWithCityId.slice(0, 5).forEach(page => {
    console.log(`  ${page.url_path}`);
    console.log(`    city_id: ${page.city_id} (type: ${typeof page.city_id})`);
    console.log(`    city from data: ${page.data?.city_name || 'N/A'}`);
  });

  // Analyze city_id values
  const cityIds = pagesWithCityId.map(p => p.city_id).filter(id => id !== null);
  console.log(`\n  city_id range: ${Math.min(...cityIds)} to ${Math.max(...cityIds)}`);
  console.log(`  Unique city_id values: ${new Set(cityIds).size}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Cross-reference: Do these city_id values exist in geographic_locations?\n');

  // Get the geographic_locations entries for these city_ids
  const uniqueCityIds = [...new Set(cityIds)].slice(0, 5);

  for (const cityId of uniqueCityIds) {
    const { data: geoLoc, error } = await supabase
      .from('geographic_locations')
      .select('id, slug, name, city_id')
      .eq('city_id', cityId)
      .limit(1);

    if (error || !geoLoc || geoLoc.length === 0) {
      console.log(`  city_id ${cityId}: ❌ NOT FOUND in geographic_locations`);
    } else {
      console.log(`  city_id ${cityId}: ✓ ${geoLoc[0].name} (${geoLoc[0].slug})`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Check if geographic_target_id is used instead\n');

  const { data: pagesWithGeoTarget } = await supabase
    .from('pages')
    .select('id, url_path, city_id, geographic_target_id, data')
    .eq('domain_id', domain.id)
    .not('geographic_target_id', 'is', null)
    .limit(5);

  if (pagesWithGeoTarget && pagesWithGeoTarget.length > 0) {
    console.log('Pages WITH geographic_target_id:');
    pagesWithGeoTarget.forEach(page => {
      console.log(`  ${page.url_path}`);
      console.log(`    geographic_target_id: ${page.geographic_target_id}`);
      console.log(`    city_id: ${page.city_id || 'NULL'}`);
    });
  } else {
    console.log('❌ No pages found with geographic_target_id');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 ANALYSIS & RECOMMENDATIONS\n');

  // Count total city_id usage
  const { count: totalWithCityId } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id)
    .not('city_id', 'is', null);

  const { count: totalPages } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id);

  console.log(`Total pages: ${totalPages}`);
  console.log(`Pages with city_id: ${totalWithCityId}`);
  console.log(`Coverage: ${(totalWithCityId / totalPages * 100).toFixed(1)}%`);

  console.log('\n✅ Investigation complete!\n');
}

investigatePagesCityId().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
