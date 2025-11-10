require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== EXPORT COMPETITOR ELECTRICIANS FROM SUPABASE ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const MAX_DISTANCE_KM = 10;
const COMPETITORS_PER_CITY = 3;
const MIN_RATING = 3.5;
const MIN_REVIEWS = 3;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

if (TEST_MODE) {
  console.log('🧪 TEST MODE - Limited processing\n');
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Format phone for display: "0176213061" -> "01 76 21 30 61"
 */
function formatPhoneDisplay(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\s/g, '').replace(/^0/, '0');
  return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
}

/**
 * Load all commune pages from Supabase pages table
 */
async function loadCommunesFromPages() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: LOAD COMMUNES FROM PAGES TABLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get domain ID for allo-electricien.pro
  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .limit(1);

  if (domainsError || !domains || domains.length === 0) {
    console.error('❌ Could not find allo-electricien.pro domain');
    throw new Error('Domain not found');
  }

  const domainId = domains[0].id;
  console.log(`✓ Found domain allo-electricien.pro (ID: ${domainId})`);

  // Fetch all city pages with pagination
  let pages = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;
  let batchNum = 1;

  while (hasMore) {
    const { data: pageData, error: pagesError } = await supabase
      .from('pages')
      .select('url_path, data, page_type')
      .eq('domain_id', domainId)
      .eq('page_type', 'city')
      .range(offset, offset + limit - 1);

    if (pagesError) {
      console.error('❌ Error fetching pages:', pagesError.message);
      throw pagesError;
    }

    if (pageData && pageData.length > 0) {
      pages = pages.concat(pageData);
      console.log(`  Batch ${batchNum}: Fetched ${pageData.length} pages (total: ${pages.length})`);
      hasMore = pageData.length === limit;
      offset += limit;
      batchNum++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✓ Loaded ${pages.length} city pages from pages table`);

  // Transform to commune format with GPS coordinates
  const communes = [];
  let skipped = 0;

  pages.forEach(page => {
    // Extract slug from url_path (remove leading/trailing slashes)
    const citySlug = page.url_path.replace(/^\//, '').replace(/\/$/, '');

    // Extract data from JSONB field
    const latitude = page.data?.latitude;
    const longitude = page.data?.longitude;
    const city_name = page.data?.city_name;
    const zip_code = page.data?.zip_code;
    const department = page.data?.department;

    // Skip if missing critical data
    if (!latitude || !longitude || !city_name) {
      skipped++;
      return;
    }

    communes.push({
      citySlug: citySlug,
      city: city_name,
      coordinates: {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude)
      },
      department: department || (zip_code ? String(zip_code).substring(0, 2) : null),
      zipCode: zip_code
    });
  });

  console.log(`✓ Processed ${communes.length} communes with valid GPS coordinates`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} pages with missing GPS data`);
  }

  // If TEST_MODE, limit to 50 communes for faster testing
  if (TEST_MODE && communes.length > 50) {
    console.log(`🧪 TEST MODE: Limiting to first 50 communes (from ${communes.length} total)`);
    return communes.slice(0, 50);
  }

  console.log('');
  return communes;
}

/**
 * Fetch competitor electricians from business_listings table
 */
async function loadCompetitors() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: FETCH COMPETITOR ELECTRICIANS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Quality filters applied:');
  console.log(`  - business_type = 'electrician'`);
  console.log(`  - verified = true`);
  console.log(`  - rating >= ${MIN_RATING}`);
  console.log(`  - review_count >= ${MIN_REVIEWS}`);
  console.log(`  - geographic_location_id IS NOT NULL`);
  console.log(`  - latitude and longitude present\n`);

  let competitors = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;
  let batchNum = 1;

  while (hasMore) {
    const { data, error } = await supabase
      .from('business_listings')
      .select('id, name, phone, website, full_address, city, postal_code, latitude, longitude, rating, review_count, verified, business_status, place_id')
      .eq('business_type', 'electrician')
      .eq('verified', true)
      .gte('rating', MIN_RATING)
      .gte('review_count', MIN_REVIEWS)
      .not('geographic_location_id', 'is', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching competitors:', error.message);
      throw error;
    }

    if (data && data.length > 0) {
      competitors = competitors.concat(data);
      console.log(`  Batch ${batchNum}: Fetched ${data.length} competitors (total: ${competitors.length})`);
      hasMore = data.length === limit;
      offset += limit;
      batchNum++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✓ Loaded ${competitors.length} competitor electricians matching quality filters\n`);
  return competitors;
}

/**
 * Transform competitor for output
 */
function transformCompetitor(competitor, distance) {
  return {
    id: competitor.id,
    name: competitor.name,
    phone: competitor.phone,
    phone_display: formatPhoneDisplay(competitor.phone),
    website: competitor.website,
    full_address: competitor.full_address,
    city: competitor.city,
    postal_code: competitor.postal_code,
    rating: competitor.rating,
    review_count: competitor.review_count,
    distance_km: parseFloat(distance.toFixed(2)),
    verified: competitor.verified,
    business_status: competitor.business_status,
    place_id: competitor.place_id
  };
}

/**
 * Main export function
 */
async function exportCompetitors() {
  const stats = {
    total_competitors: 0,
    communes_mapped: 0,
    total_assignments: 0,
    communes_with_no_competitors: 0,
    average_competitors_per_commune: 0
  };

  try {
    // Step 1: Load all communes from pages table
    const communes = await loadCommunesFromPages();

    // Step 2: Load competitor electricians
    const competitors = await loadCompetitors();
    stats.total_competitors = competitors.length;

    // Step 3: Build proximity-based mapping
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: BUILD PROXIMITY MAPPING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Processing ${communes.length} communes...`);
    console.log(`Max distance: ${MAX_DISTANCE_KM}km`);
    console.log(`Competitors per commune: ${COMPETITORS_PER_CITY}\n`);

    const byCity = {};
    let processedCount = 0;

    communes.forEach((commune) => {
      const cityCoords = { lat: commune.coordinates.lat, lng: commune.coordinates.lng };

      // Calculate distance to ALL competitors
      const competitorsWithDistance = competitors
        .map(competitor => {
          const distance = calculateDistance(
            cityCoords.lat, cityCoords.lng,
            parseFloat(competitor.latitude),
            parseFloat(competitor.longitude)
          );
          return { competitor, distance };
        })
        .filter(c => c.distance <= MAX_DISTANCE_KM) // Within max distance
        .sort((a, b) => {
          // Sort by distance first, then by rating
          if (Math.abs(a.distance - b.distance) < 0.5) {
            return b.competitor.rating - a.competitor.rating;
          }
          return a.distance - b.distance;
        });

      // Take top N closest
      const selectedCompetitors = competitorsWithDistance
        .slice(0, COMPETITORS_PER_CITY)
        .map(c => transformCompetitor(c.competitor, c.distance));

      if (selectedCompetitors.length > 0) {
        byCity[commune.citySlug] = selectedCompetitors;
        stats.total_assignments += selectedCompetitors.length;
        stats.communes_mapped++;
      } else {
        stats.communes_with_no_competitors++;
      }

      // Handle Paris arrondissement slug variations (both paris-6 and paris-6e)
      if (commune.citySlug.match(/^paris-\d+e$/)) {
        const withoutE = commune.citySlug.replace(/e$/, '');
        byCity[withoutE] = byCity[commune.citySlug];
      } else if (commune.citySlug.match(/^paris-\d+$/)) {
        byCity[commune.citySlug + 'e'] = byCity[commune.citySlug];
      }

      processedCount++;

      // Progress indicator every 100 communes
      if (processedCount % 100 === 0) {
        console.log(`  Progress: ${processedCount}/${communes.length} communes (${(processedCount/communes.length*100).toFixed(1)}%)`);
      }
    });

    if (stats.communes_mapped > 0) {
      stats.average_competitors_per_commune = (stats.total_assignments / stats.communes_mapped).toFixed(2);
    }

    console.log(`\n✓ Mapped competitors for ${stats.communes_mapped} communes`);
    console.log(`  Total assignments: ${stats.total_assignments}`);
    console.log(`  Average per commune: ${stats.average_competitors_per_commune}`);
    console.log(`  Communes with no competitors: ${stats.communes_with_no_competitors}\n`);

    // Step 4: Create output structure
    const output = {
      generated_at: new Date().toISOString(),
      total_competitors: stats.total_competitors,
      communes_with_competitors: stats.communes_mapped,
      quality_filters: {
        min_rating: MIN_RATING,
        min_reviews: MIN_REVIEWS,
        max_distance_km: MAX_DISTANCE_KM,
        verified_only: true
      },
      by_city: byCity
    };

    // Step 5: Validation report
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VALIDATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const byCityKeys = Object.keys(byCity);
    const parisWithECount = byCityKeys.filter(k => k.match(/^paris-\d+e$/)).length;
    const uniqueCommuneCount = byCityKeys.length - parisWithECount;

    const coveragePercent = (uniqueCommuneCount / communes.length * 100).toFixed(2);

    console.log(`Total communes processed:      ${communes.length}`);
    console.log(`Communes with competitors:     ${uniqueCommuneCount}`);
    console.log(`Coverage:                      ${coveragePercent}%`);
    console.log(`Total competitors assigned:    ${stats.total_assignments}`);
    console.log(`Average per commune:           ${stats.average_competitors_per_commune}`);
    console.log(`Communes with no competitors:  ${stats.communes_with_no_competitors}`);

    // Step 6: Write to file
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: WRITE TO FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const outputPath = path.join(__dirname, '..', 'data', 'competitor_electricians.json');

    if (DRY_RUN) {
      console.log('📝 DRY RUN - Would write to:', outputPath);
      console.log(`   Sample data for first city: ${Object.keys(byCity)[0]}`);
      if (Object.keys(byCity).length > 0) {
        console.log(JSON.stringify(byCity[Object.keys(byCity)[0]], null, 2));
      }
    } else {
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
      console.log(`✓ Successfully wrote to: ${outputPath}`);

      const fileStats = fs.statSync(outputPath);
      const fileSizeKB = (fileStats.size / 1024).toFixed(2);
      console.log(`  File size: ${fileSizeKB} KB`);
    }

    // Step 7: Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EXPORT COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Statistics:');
    console.log(`  Total competitors:        ${stats.total_competitors}`);
    console.log(`  Communes mapped:          ${stats.communes_mapped}`);
    console.log(`  Total assignments:        ${stats.total_assignments}`);
    console.log(`  Average per commune:      ${stats.average_competitors_per_commune}`);
    console.log('');

    // Sample data preview
    console.log('Sample Data Preview:');
    const sampleCities = Object.keys(byCity).slice(0, 3);
    sampleCities.forEach(citySlug => {
      console.log(`  ${citySlug}: ${byCity[citySlug].length} competitors`);
      if (byCity[citySlug].length > 0) {
        const first = byCity[citySlug][0];
        console.log(`    └─ ${first.name} (${first.distance_km}km, ⭐${first.rating})`);
      }
    });

    if (DRY_RUN) {
      console.log('\n💡 Run without --dry-run flag to write to file');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run export
exportCompetitors().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
