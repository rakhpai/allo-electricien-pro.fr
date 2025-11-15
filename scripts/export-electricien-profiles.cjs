require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== EXPORT ELECTRICIEN PROFILES FROM SUPABASE ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');

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
 * Transform profile for output
 */
function transformProfile(profile, phone, isPrimary = false) {
  // Format phone: raw "0176213061" -> display "01 76 21 30 61" + href "+33176213061"
  const rawPhone = phone || '0644644824';

  // Remove leading 0 and format for display: "01 76 21 30 61"
  const phoneDisplay = rawPhone.replace(/^0/, '0').replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');

  // Convert to international format for href: "+33176213061"
  const phoneHref = rawPhone.replace(/^0/, '+33');

  return {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    specialty_primary: profile.specialty_primary,
    specialty_badge: profile.specialty_badge,
    badge_color: profile.badge_color || 'blue',
    bio_short: profile.bio_short || '',
    avatar_url: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name}&background=0D8ABC&color=fff&size=128`,
    service_tags: profile.service_tags || [],
    is_available_24_7: profile.is_available_24_7 || false,
    phone_display: phoneDisplay,  // "01 76 21 30 61" for visual display
    phone_href: phoneHref,         // "+33176213061" for tel: link
    phone: phoneDisplay,           // Legacy field for backward compatibility
    rating: profile.rating_override || 4.7,
    years_experience: profile.years_experience || 5,
    is_primary_for_city: isPrimary,
    coverage_zones: profile.coverage_zone_ids || []
  };
}

/**
 * Main export function
 */
async function exportProfiles() {
  const stats = {
    total_profiles: 0,
    cities_mapped: 0,
    departments_mapped: 0,
    primary_assignments: 0,
    errors: []
  };

  try {
    // Step 1: Load all communes from pages table
    const communes = await loadCommunesFromPages();

    // Step 2: Fetch all profiles with phone numbers
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: FETCH ELECTRICIEN PROFILES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: profiles, error: profilesError } = await supabase
      .from('electricien_profiles')
      .select('*, phone_numbers(phone_number, formatted_number)')
      .order('rating_override', { ascending: false });

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
      throw profilesError;
    }

    console.log(`✓ Loaded ${profiles.length} profiles\n`);
    stats.total_profiles = profiles.length;

    // Step 3: Fetch city coverage mappings with pagination
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: FETCH CITY COVERAGE MAPPINGS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Fetch ALL coverage mappings with pagination to handle 1000 row limit
    let coverageMappings = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('electricien_city_coverage')
        .select('profile_id, city_id, is_primary_city, geo_cities_idf(city, geographic_locations!fk_geo_cities_geographic_location(latitude, longitude))')
        .order('is_primary_city', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error fetching coverage:', error.message);
        throw error;
      }

      coverageMappings = coverageMappings.concat(data);
      hasMore = data.length === limit;
      offset += limit;
      console.log(`  Fetched ${coverageMappings.length} mappings so far...`);
    }

    console.log(`✓ Loaded ${coverageMappings.length} coverage mappings total\n`);

    // Step 4: Build data structures
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: BUILD DATA STRUCTURES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Build by_city structure using GEOGRAPHIC PROXIMITY matching
    const byCity = {};

    // Build electrician coordinate lookup from their primary cities
    console.log('  Building electrician coordinate index from coverage data...\n');
    const electricianCoords = {};

    coverageMappings.forEach(mapping => {
      // Get coordinates from the joined geo_cities_idf -> geographic_locations data
      const geoLoc = mapping.geo_cities_idf?.geographic_locations;
      if (geoLoc && geoLoc.latitude && geoLoc.longitude) {
        if (!electricianCoords[mapping.profile_id]) {
          // Use first city (preferably primary) as electrician's base location
          electricianCoords[mapping.profile_id] = {
            lat: geoLoc.latitude,
            lng: geoLoc.longitude,
            isPrimary: mapping.is_primary_city
          };
        } else if (mapping.is_primary_city && !electricianCoords[mapping.profile_id].isPrimary) {
          // Override with primary city if we find one
          electricianCoords[mapping.profile_id] = {
            lat: geoLoc.latitude,
            lng: geoLoc.longitude,
            isPrimary: true
          };
        }
      }
    });

    console.log(`✓ Mapped coordinates for ${Object.keys(electricianCoords).length} electricians from their coverage cities\n`);

    console.log(`✓ Processing ${communes.length} communes from pages table`);
    console.log('  Building geographic proximity index...\n');

    // For EACH commune, find nearest electricians
    let processedCount = 0;
    let withFallbackCount = 0;

    communes.forEach((commune, index) => {
      const cityCoords = { lat: commune.coordinates.lat, lng: commune.coordinates.lng };

      // Calculate distance to ALL electricians with coordinates
      const electriciansWithDistance = profiles
        .filter(p => electricianCoords[p.id]) // Only electricians with coordinates
        .map(profile => {
          const elecCoords = electricianCoords[profile.id];
          const distance = calculateDistance(
            cityCoords.lat, cityCoords.lng,
            elecCoords.lat,
            elecCoords.lng
          );
          return { profile, distance, phone: profile.phone_numbers?.phone_number || null };
        })
        .sort((a, b) => a.distance - b.distance); // Sort by proximity

      // Take top 6 closest
      let selectedElectricians = electriciansWithDistance.slice(0, 6);

      // Hybrid fallback: if less than 3 nearby, add department fallback
      if (selectedElectricians.length < 3 && commune.department) {
        withFallbackCount++;
        // Will be populated later from by_department
      }

      // Transform to output format
      byCity[commune.citySlug] = selectedElectricians.map(e =>
        transformProfile(e.profile, e.phone, false)
      );

      // Handle Paris arrondissement slug variations (both paris-6 and paris-6e)
      if (commune.citySlug.match(/^paris-\d+e$/)) {
        // Has "e" suffix - also add version without "e"
        const withoutE = commune.citySlug.replace(/e$/, '');
        byCity[withoutE] = byCity[commune.citySlug];
      } else if (commune.citySlug.match(/^paris-\d+$/)) {
        // No "e" suffix - also add version with "e"
        byCity[commune.citySlug + 'e'] = byCity[commune.citySlug];
      }

      processedCount++;

      // Progress indicator every 100 communes
      if (processedCount % 100 === 0) {
        console.log(`  Progress: ${processedCount}/${communes.length} communes (${(processedCount/communes.length*100).toFixed(1)}%)`);
      }
    });

    // Count unique cities (excluding Paris arrondissement duplicates)
    // Paris duplicates are like paris-1 AND paris-1e - we want to count them as one
    const allSlugs = Object.keys(byCity);
    const parisWithE = allSlugs.filter(k => k.match(/^paris-\d+e$/));
    stats.cities_mapped = allSlugs.length - parisWithE.length;
    const avgProfilesPerCity = Object.values(byCity).reduce((sum, arr) => sum + arr.length, 0) / stats.cities_mapped;
    console.log(`✓ Generated geographic matches for ${stats.cities_mapped} communes`);
    console.log(`  Average profiles per commune: ${avgProfilesPerCity.toFixed(1)}\n`);

    // Build by_department structure
    const byDepartment = {
      '75': [],
      '77': [],
      '78': [],
      '91': [],
      '92': [],
      '93': [],
      '94': [],
      '95': []
    };

    profiles.forEach(profile => {
      const phone = profile.phone_numbers?.phone_number || null;
      const transformedProfile = transformProfile(profile, phone);

      // Add to each department in coverage zones
      if (profile.coverage_zone_ids && Array.isArray(profile.coverage_zone_ids)) {
        profile.coverage_zone_ids.forEach(deptCode => {
          const deptKey = String(deptCode);
          if (byDepartment[deptKey]) {
            byDepartment[deptKey].push(transformedProfile);
          }
        });
      }
    });

    // Sort and limit department profiles
    Object.keys(byDepartment).forEach(dept => {
      byDepartment[dept].sort((a, b) => b.rating - a.rating);
      byDepartment[dept] = byDepartment[dept].slice(0, 15); // Top 15 per department
      if (byDepartment[dept].length > 0) {
        stats.departments_mapped++;
      }
    });

    // Build all_profiles array
    const allProfiles = profiles.map(profile => {
      const phone = profile.phone_numbers?.phone_number || null;
      return transformProfile(profile, phone);
    });

    // Step 5: Create final output structure
    const output = {
      generated_at: new Date().toISOString(),
      total_profiles: stats.total_profiles,
      cities_with_profiles: stats.cities_mapped,
      by_city: byCity,
      by_department: byDepartment,
      all_profiles: allProfiles
    };

    // Comprehensive validation
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VALIDATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Calculate unique communes (excluding Paris duplicates)
    const byCityKeys = Object.keys(byCity);
    const parisWithECount = byCityKeys.filter(k => k.match(/^paris-\d+e$/)).length;
    const uniqueCommuneCount = byCityKeys.length - parisWithECount;

    const validation = {
      totalCommunes: communes.length,
      communesWithProfiles: uniqueCommuneCount,
      profilesAssigned: Object.values(byCity).reduce((sum, arr) => sum + arr.length, 0),
      avgProfilesPerCommune: 0,
      communesWithLessThan3: [],
      communesWithNoProfiles: []
    };

    communes.forEach(commune => {
      const profiles = byCity[commune.citySlug] || [];
      if (profiles.length === 0) {
        validation.communesWithNoProfiles.push({
          slug: commune.citySlug,
          city: commune.city,
          department: commune.department
        });
      } else if (profiles.length < 3) {
        validation.communesWithLessThan3.push({
          slug: commune.citySlug,
          city: commune.city,
          count: profiles.length,
          department: commune.department
        });
      }
    });

    validation.avgProfilesPerCommune = (
      validation.profilesAssigned / validation.communesWithProfiles
    ).toFixed(2);

    const coveragePercent = (validation.communesWithProfiles / validation.totalCommunes * 100).toFixed(2);

    console.log(`Total communes processed:     ${validation.totalCommunes}`);
    console.log(`Communes with profiles:       ${validation.communesWithProfiles}`);
    console.log(`Coverage:                     ${coveragePercent}%`);
    console.log(`Total profiles assigned:      ${validation.profilesAssigned}`);
    console.log(`Average profiles per commune: ${validation.avgProfilesPerCommune}`);
    console.log(`Communes with <3 profiles:    ${validation.communesWithLessThan3.length}`);
    console.log(`Communes with NO profiles:    ${validation.communesWithNoProfiles.length}`);

    if (validation.communesWithNoProfiles.length > 0) {
      console.log('\n⚠️  WARNING: Communes with NO profiles:');
      validation.communesWithNoProfiles.slice(0, 10).forEach(c => {
        console.log(`   - ${c.slug} (${c.city}, dept ${c.department})`);
      });
      if (validation.communesWithNoProfiles.length > 10) {
        console.log(`   ... and ${validation.communesWithNoProfiles.length - 10} more`);
      }
    }

    if (validation.communesWithLessThan3.length > 0 && validation.communesWithLessThan3.length <= 20) {
      console.log('\n⚠️  Communes with <3 profiles (may need department fallback):');
      validation.communesWithLessThan3.forEach(c => {
        console.log(`   - ${c.slug} (${c.city}, dept ${c.department}): ${c.count} profiles`);
      });
    }

    console.log('');
    console.log(`✓ Mapped ${stats.cities_mapped} cities`);
    console.log(`✓ Mapped ${stats.departments_mapped} departments`);
    console.log(`✓ ${stats.primary_assignments} primary city assignments\n`);

    // Step 6: Write to file
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 5: WRITE TO FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const outputPath = path.join(__dirname, '..', 'data', 'electricien_profiles.json');

    if (DRY_RUN) {
      console.log('📝 DRY RUN - Would write to:', outputPath);
      console.log(`   Sample data for first city: ${Object.keys(byCity)[0]}`);
      if (Object.keys(byCity).length > 0) {
        console.log(JSON.stringify(byCity[Object.keys(byCity)[0]][0], null, 2));
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
    console.log(`  Total profiles:           ${stats.total_profiles}`);
    console.log(`  Cities mapped:            ${stats.cities_mapped}`);
    console.log(`  Departments mapped:       ${stats.departments_mapped}`);
    console.log(`  Primary assignments:      ${stats.primary_assignments}`);
    console.log('');

    // Sample data preview
    console.log('Sample Data Preview:');
    const sampleCities = Object.keys(byCity).slice(0, 3);
    sampleCities.forEach(citySlug => {
      console.log(`  ${citySlug}: ${byCity[citySlug].length} profiles`);
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
exportProfiles().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
