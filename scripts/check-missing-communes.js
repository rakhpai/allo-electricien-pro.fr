require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function findMissingCommunes() {
  console.log('=== FIND MISSING COMMUNES ===\n');

  // Load generated profiles
  const profilesData = JSON.parse(fs.readFileSync('./data/electricien_profiles.json', 'utf8'));
  const profileSlugs = new Set(Object.keys(profilesData.by_city));

  console.log(`Profiles data has ${profileSlugs.size} unique city slugs\n`);

  // Get domain ID
  const { data: domains } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .limit(1);

  const domainId = domains[0].id;

  // Fetch all pages
  let pages = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData } = await supabase
      .from('pages')
      .select('url_path, data, page_type')
      .eq('domain_id', domainId)
      .eq('page_type', 'city')
      .range(offset, offset + limit - 1);

    if (pageData && pageData.length > 0) {
      pages = pages.concat(pageData);
      hasMore = pageData.length === limit;
      offset += limit;
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${pages.length} city pages from Supabase\n`);

  // Find missing
  const missing = [];
  const missingData = [];

  pages.forEach(page => {
    const slug = page.url_path.replace(/^\//, '').replace(/\/$/, '');

    if (!profileSlugs.has(slug)) {
      const hasLat = !!page.data?.latitude;
      const hasLng = !!page.data?.longitude;
      const hasCityName = !!page.data?.city_name;

      missing.push(slug);
      missingData.push({
        slug,
        city_name: page.data?.city_name || 'N/A',
        has_lat: hasLat,
        has_lng: hasLng,
        has_city_name: hasCityName,
        missing_reason: !hasLat || !hasLng || !hasCityName ? 'Missing GPS or city name' : 'Unknown'
      });
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`MISSING COMMUNES: ${missing.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (missing.length > 0) {
    missingData.forEach((m, i) => {
      console.log(`${i + 1}. ${m.slug}`);
      console.log(`   City: ${m.city_name}`);
      console.log(`   Has GPS: lat=${m.has_lat}, lng=${m.has_lng}`);
      console.log(`   Has city name: ${m.has_city_name}`);
      console.log(`   Reason: ${m.missing_reason}\n`);
    });
  } else {
    console.log('✓ All communes have profiles!\n');
  }

  // Summary
  console.log('SUMMARY:');
  console.log(`  Total pages in Supabase:     ${pages.length}`);
  console.log(`  Pages with profiles:         ${profileSlugs.size}`);
  console.log(`  Missing profiles:            ${missing.length}`);
  console.log(`  Coverage:                    ${(profileSlugs.size / pages.length * 100).toFixed(2)}%`);
}

findMissingCommunes().catch(console.error);
