require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

console.log('=== DIAGNOSE MISSING CITY_ID IN PAGES ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get domain ID for allo-electricien.pro
 */
async function getDomainId() {
  const { data, error } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Could not find domain: ${error.message}`);
  }

  return data.id;
}

/**
 * Query pages missing city_id
 */
async function getPagesWithoutCityId(domainId) {
  console.log('Querying pages without city_id...');

  let allPages = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('pages')
      .select('id, url, url_path, data')
      .eq('domain_id', domainId)
      .is('city_id', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    if (data && data.length > 0) {
      allPages = allPages.concat(data);
      console.log(`  Fetched ${data.length} pages (page ${page + 1})`);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allPages;
}

/**
 * Get all pages stats
 */
async function getPagesStats(domainId) {
  const { data: totalPages, error: totalError } = await supabase
    .from('pages')
    .select('id', { count: 'exact', head: true })
    .eq('domain_id', domainId);

  const { data: withCityId, error: withError } = await supabase
    .from('pages')
    .select('id', { count: 'exact', head: true })
    .eq('domain_id', domainId)
    .not('city_id', 'is', null);

  return {
    total: totalPages?.length || 0,
    withCityId: withCityId?.length || 0
  };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get domain ID
    console.log('Finding allo-electricien.pro domain...');
    const domainId = await getDomainId();
    console.log(`✓ Found domain: ${domainId}\n`);

    // Get stats
    const stats = await getPagesStats(domainId);
    console.log(`📊 Pages Statistics:`);
    console.log(`   Total pages: ${stats.total}`);
    console.log(`   Pages with city_id: ${stats.withCityId}`);
    console.log(`   Pages without city_id: ${stats.total - stats.withCityId}\n`);

    // Get pages without city_id
    const pagesWithoutCityId = await getPagesWithoutCityId(domainId);
    console.log(`\n✓ Found ${pagesWithoutCityId.length} pages without city_id\n`);

    // Extract relevant data
    const diagnosticData = pagesWithoutCityId.map(page => {
      const data = page.data || {};
      return {
        page_id: page.id,
        url: page.url,
        url_path: page.url_path,
        slug: data.slug,
        city_name: data.city_name,
        postal_code: data.zip_code,
        department: data.department,
        coordinates: {
          lat: data.latitude,
          lng: data.longitude
        }
      };
    });

    // Save to file
    const outputPath = 'missing-city-ids-diagnostic.json';
    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        generated_at: new Date().toISOString(),
        domain_id: domainId,
        total_pages: stats.total,
        pages_with_city_id: stats.withCityId,
        pages_without_city_id: pagesWithoutCityId.length,
        pages: diagnosticData
      }, null, 2)
    );

    console.log(`✓ Saved diagnostic data to: ${outputPath}`);

    // Show sample
    console.log(`\n📋 Sample of pages without city_id (first 10):`);
    diagnosticData.slice(0, 10).forEach((page, idx) => {
      console.log(`\n${idx + 1}. ${page.url}`);
      console.log(`   URL Path: ${page.url_path}`);
      console.log(`   Slug: ${page.slug}`);
      console.log(`   City: ${page.city_name}`);
      console.log(`   Postal: ${page.postal_code}`);
      console.log(`   Dept: ${page.department}`);
      console.log(`   Coords: ${page.coordinates.lat}, ${page.coordinates.lng}`);
    });

    console.log('\n✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
