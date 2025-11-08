require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== EXPORT ELECTRICIANS FROM SUPABASE ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 5 : null; // Limit to 5 cities in test mode

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only process ${TEST_LIMIT} cities\n`);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Transform business listing to electrician format for JSON
 */
function transformElectrician(business, cityLat, cityLon) {
  // Calculate distance from city center
  const distance = cityLat && cityLon && business.latitude && business.longitude
    ? parseFloat(calculateDistance(cityLat, cityLon, business.latitude, business.longitude).toFixed(1))
    : null;

  // Extract services array (limit to useful service names)
  let services = null;
  if (business.services && Array.isArray(business.services)) {
    services = business.services
      .filter(s => s && s.length > 0)
      .slice(0, 5); // Limit to 5 services
  }

  // Parse working hours if available
  let workingHours = null;
  if (business.working_hours && typeof business.working_hours === 'object') {
    workingHours = business.working_hours;
  }

  return {
    name: business.name,
    phone: business.phone || null,
    rating: business.rating || null,
    reviews: business.review_count || 0,
    distance: distance,
    website: business.website || null,
    address: business.full_address || business.street || null,
    city: business.city || null,
    postal_code: business.postal_code || "",
    verified: business.verified || false,
    services: services,
    working_hours: workingHours,
    business_status: business.business_status || null
  };
}

/**
 * Get today's day name in French for working hours
 */
function getTodayName() {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[new Date().getDay()];
}

/**
 * Main export function
 */
async function exportElectricians() {
  const stats = {
    cities_processed: 0,
    cities_with_electricians: 0,
    total_electricians: 0,
    cities_skipped: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: FETCH CITIES FROM GEOGRAPHIC_LOCATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch all cities
  const { data: cities, error: citiesError } = await supabase
    .from('geographic_locations')
    .select('id, slug, name, latitude, longitude')
    .order('slug');

  if (citiesError) {
    console.error('❌ Error fetching cities:', citiesError.message);
    process.exit(1);
  }

  console.log(`✓ Found ${cities.length} cities in database\n`);

  // Limit cities in test mode
  const citiesToProcess = TEST_MODE ? cities.slice(0, TEST_LIMIT) : cities;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: FETCH ELECTRICIANS FOR EACH CITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const communeElectricians = {};

  for (const city of citiesToProcess) {
    stats.cities_processed++;

    try {
      // Fetch electricians for this city
      // IMPORTANT: Only fetch electricians that:
      // 1. Are linked to this city via geographic_location_id
      // 2. Have a full_address (required)
      // 3. Are operational
      const { data: electricians, error: electriciansError } = await supabase
        .from('business_listings')
        .select('*')
        .eq('business_type', 'electrician')
        .eq('geographic_location_id', city.id)
        .eq('business_status', 'OPERATIONAL')
        .not('full_address', 'is', null); // Only those with addresses

      if (electriciansError) {
        throw electriciansError;
      }

      if (!electricians || electricians.length === 0) {
        stats.cities_skipped++;
        if (stats.cities_processed <= 10) {
          console.log(`  ⊘ ${city.name} (${city.slug}): No electricians with addresses`);
        }
        continue;
      }

      // Transform electricians
      const transformedElectricians = electricians
        .map(e => transformElectrician(e, city.latitude, city.longitude))
        .filter(e => e.name && e.phone && e.address) // Must have name, phone AND address
        .sort((a, b) => {
          // Sort by distance first (nulls last), then by rating (desc)
          if (a.distance === null && b.distance !== null) return 1;
          if (a.distance !== null && b.distance === null) return -1;
          if (a.distance !== b.distance) return (a.distance || 0) - (b.distance || 0);
          return (b.rating || 0) - (a.rating || 0);
        })
        .slice(0, 10); // Limit to top 10 electricians per city

      if (transformedElectricians.length > 0) {
        communeElectricians[city.slug] = transformedElectricians;
        stats.cities_with_electricians++;
        stats.total_electricians += transformedElectricians.length;

        if (stats.cities_processed <= 10) {
          console.log(`  ✓ ${city.name} (${city.slug}): ${transformedElectricians.length} electricians`);
        }
      }

    } catch (error) {
      stats.errors.push({
        city: city.name,
        slug: city.slug,
        error: error.message
      });

      if (stats.errors.length <= 5) {
        console.log(`  ❌ ${city.name} (${city.slug}): ${error.message}`);
      }
    }

    // Progress update every 50 cities
    if (stats.cities_processed % 50 === 0) {
      const progress = ((stats.cities_processed / citiesToProcess.length) * 100).toFixed(1);
      console.log(`  Progress: ${stats.cities_processed}/${citiesToProcess.length} cities (${progress}%)`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: WRITE TO FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const outputPath = path.join(__dirname, '..', 'data', 'commune_electricians.json');

  if (DRY_RUN) {
    console.log('📝 DRY RUN - Would write to:', outputPath);
    console.log(`   Sample data for first city: ${Object.keys(communeElectricians)[0]}`);
    console.log(JSON.stringify(communeElectricians[Object.keys(communeElectricians)[0]][0], null, 2));
  } else {
    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(communeElectricians, null, 2), 'utf8');
    console.log(`✓ Successfully wrote to: ${outputPath}`);

    // Get file size
    const stats_fs = fs.statSync(outputPath);
    const fileSizeKB = (stats_fs.size / 1024).toFixed(2);
    console.log(`  File size: ${fileSizeKB} KB`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EXPORT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Cities processed:          ${stats.cities_processed}`);
  console.log(`  Cities with electricians:  ${stats.cities_with_electricians}`);
  console.log(`  Cities skipped (no data):  ${stats.cities_skipped}`);
  console.log(`  Total electricians:        ${stats.total_electricians}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.city} (${err.slug}): ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'export-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: export-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to write to file');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to export all cities');
  }

  // Save export summary
  const summaryPath = path.join(__dirname, '..', 'export-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    stats: stats
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Export summary saved to: export-summary.json\n`);
}

// Run export
exportElectricians().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
