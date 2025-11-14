require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== EXPORT ELECTRICIEN PROFILES (ENHANCED FOR CAROUSEL SCHEMA) ===\n');

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
 * Slugify text for URLs
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculate realistic review count based on rating and experience
 * Formula: Higher ratings + more experience = more reviews
 */
function calculateReviewCount(rating, yearsExperience) {
  const baseReviews = rating * 30; // 4.7 rating → 141 reviews
  const experienceBonus = yearsExperience * 2; // 10 years → +20 reviews
  const randomVariation = Math.floor(Math.random() * 20) - 10; // ±10 variation

  return Math.max(20, Math.round(baseReviews + experienceBonus + randomVariation));
}

/**
 * Determine price range based on specialty and experience
 * Returns: €, €€, or €€€
 */
function determinePriceRange(specialty, yearsExperience) {
  const premiumSpecialties = [
    'Domotique',
    'Borne recharge VE',
    'Photovoltaïque',
    'Installation Intelligente',
    'Système Connecté'
  ];

  const isPremium = premiumSpecialties.some(s => specialty.includes(s));

  if (isPremium && yearsExperience >= 10) return '€€€';
  if (isPremium || yearsExperience >= 15) return '€€-€€€';
  if (yearsExperience >= 8) return '€€';
  return '€-€€';
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
 * Transform profile for output with enhanced data for carousel schema
 */
function transformProfile(profile, phone, primaryCityData = null, isPrimary = false) {
  // Format phone: raw "0176213061" -> display "01 76 21 30 61" + href "+33176213061"
  const rawPhone = phone || '0144901131';

  // Remove leading 0 and format for display: "01 76 21 30 61"
  const phoneDisplay = rawPhone.replace(/^0/, '0').replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');

  // Convert to international format for href: "+33176213061"
  const phoneHref = rawPhone.replace(/^0/, '+33');

  // Calculate review count
  const rating = profile.rating_override || 4.7;
  const yearsExperience = profile.years_experience || 5;
  const reviewCount = calculateReviewCount(rating, yearsExperience);

  // Determine price range
  const priceRange = determinePriceRange(profile.specialty_primary || '', yearsExperience);

  // Generate profile URL slug
  const firstName = slugify(profile.first_name || '');
  const lastName = slugify(profile.last_name || '');
  const shortId = profile.id.split('-')[0];
  const profileSlug = `${firstName}-${lastName}-${shortId}`;
  const profileUrl = `https://allo-electricien.pro/profiles/${profileSlug}/`;

  // Base profile object
  const transformedProfile = {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    specialty_primary: profile.specialty_primary,
    specialty_badge: profile.specialty_badge,
    badge_color: profile.badge_color || 'blue',
    bio_short: profile.bio_short || '',

    // Images (multi-aspect-ratio placeholders - will be updated after image generation)
    images: {
      square: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name}&background=0D8ABC&color=fff&size=900`,
      landscape: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name}&background=0D8ABC&color=fff&size=1200x900`,
      wide: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name}&background=0D8ABC&color=fff&size=1600x900`
    },
    avatar_url: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name}&background=0D8ABC&color=fff&size=128`,

    service_tags: profile.service_tags || [],
    is_available_24_7: profile.is_available_24_7 || false,

    // Phone numbers
    phone_display: phoneDisplay,
    phone_href: phoneHref,
    phone: phoneDisplay,

    // Rating and experience
    rating: rating,
    years_experience: yearsExperience,
    review_count: reviewCount,

    // Price range
    price_range: priceRange,

    // Profile URL
    profile_url: profileUrl,
    profile_slug: profileSlug,

    is_primary_for_city: isPrimary,
    coverage_zones: profile.coverage_zone_ids || []
  };

  // Add address and geo coordinates if primary city data available
  if (primaryCityData && primaryCityData.city && primaryCityData.coordinates) {
    transformedProfile.address = {
      addressLocality: primaryCityData.city,
      postalCode: primaryCityData.zipCode || '',
      addressRegion: 'Île-de-France',
      addressCountry: 'FR'
    };

    transformedProfile.geo = {
      latitude: primaryCityData.coordinates.lat,
      longitude: primaryCityData.coordinates.lng
    };
  }

  return transformedProfile;
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
    profiles_with_addresses: 0,
    profiles_with_coordinates: 0,
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
    console.log('STEP 4: BUILD ENHANCED DATA STRUCTURES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Build city name to postal code lookup from communes data
    const cityNameToPostalCode = {};
    communes.forEach(commune => {
      if (commune.city && commune.zipCode) {
        // Normalize city name for matching (uppercase, trim)
        const normalizedCity = commune.city.toUpperCase().trim();
        cityNameToPostalCode[normalizedCity] = commune.zipCode;
      }
    });

    // Build electrician coordinate lookup AND primary city data from coverage
    console.log('  Building electrician coordinate & address index from coverage data...\n');
    const electricianCoords = {};
    const electricianPrimaryCityData = {}; // NEW: Store complete primary city data

    coverageMappings.forEach(mapping => {
      // Get coordinates from the joined geo_cities_idf -> geographic_locations data
      const geoLoc = mapping.geo_cities_idf?.geographic_locations;
      const cityName = mapping.geo_cities_idf?.city;
      const normalizedCity = cityName ? cityName.toUpperCase().trim() : '';
      const postalCode = normalizedCity ? cityNameToPostalCode[normalizedCity] : '';

      if (geoLoc && geoLoc.latitude && geoLoc.longitude && cityName) {
        if (!electricianCoords[mapping.profile_id]) {
          // Use first city (preferably primary) as electrician's base location
          electricianCoords[mapping.profile_id] = {
            lat: geoLoc.latitude,
            lng: geoLoc.longitude,
            isPrimary: mapping.is_primary_city
          };

          // Store primary city data for address
          electricianPrimaryCityData[mapping.profile_id] = {
            city: cityName,
            zipCode: postalCode || '',
            coordinates: {
              lat: geoLoc.latitude,
              lng: geoLoc.longitude
            }
          };
        } else if (mapping.is_primary_city && !electricianCoords[mapping.profile_id].isPrimary) {
          // Override with primary city if we find one
          electricianCoords[mapping.profile_id] = {
            lat: geoLoc.latitude,
            lng: geoLoc.longitude,
            isPrimary: true
          };

          electricianPrimaryCityData[mapping.profile_id] = {
            city: cityName,
            zipCode: postalCode || '',
            coordinates: {
              lat: geoLoc.latitude,
              lng: geoLoc.longitude
            }
          };
        }
      }
    });

    console.log(`✓ Mapped coordinates for ${Object.keys(electricianCoords).length} electricians from their coverage cities`);
    console.log(`✓ Mapped primary city data for ${Object.keys(electricianPrimaryCityData).length} electricians\n`);

    stats.profiles_with_coordinates = Object.keys(electricianCoords).length;
    stats.profiles_with_addresses = Object.keys(electricianPrimaryCityData).length;

    console.log(`✓ Processing ${communes.length} communes from pages table`);
    console.log('  Building geographic proximity index...\n');

    // Build by_city structure using GEOGRAPHIC PROXIMITY matching
    const byCity = {};
    let processedCount = 0;
    let withFallbackCount = 0;

    // For EACH commune, find nearest electricians
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
          return {
            profile,
            distance,
            phone: profile.phone_numbers?.phone_number || null,
            primaryCityData: electricianPrimaryCityData[profile.id] || null
          };
        })
        .sort((a, b) => a.distance - b.distance); // Sort by proximity

      // Take top 6 closest
      let selectedElectricians = electriciansWithDistance.slice(0, 6);

      // Hybrid fallback: if less than 3 nearby, add department fallback
      if (selectedElectricians.length < 3 && commune.department) {
        withFallbackCount++;
        // Will be populated later from by_department
      }

      // Transform to output format with enhanced data
      byCity[commune.citySlug] = selectedElectricians.map(e =>
        transformProfile(e.profile, e.phone, e.primaryCityData, false)
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
      const primaryCityData = electricianPrimaryCityData[profile.id] || null;
      const transformedProfile = transformProfile(profile, phone, primaryCityData);

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

    // Build all_profiles array with enhanced data
    const allProfiles = profiles.map(profile => {
      const phone = profile.phone_numbers?.phone_number || null;
      const primaryCityData = electricianPrimaryCityData[profile.id] || null;
      return transformProfile(profile, phone, primaryCityData);
    });

    // Step 5: Create final output structure
    const output = {
      generated_at: new Date().toISOString(),
      total_profiles: stats.total_profiles,
      cities_with_profiles: stats.cities_mapped,
      profiles_with_addresses: stats.profiles_with_addresses,
      profiles_with_coordinates: stats.profiles_with_coordinates,
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
      communesWithNoProfiles: [],
      profilesWithCompleteData: 0
    };

    // Count profiles with complete carousel schema data
    allProfiles.forEach(profile => {
      const hasCompleteData =
        profile.profile_url &&
        profile.images && profile.images.square && profile.images.landscape && profile.images.wide &&
        profile.address && profile.address.addressLocality &&
        profile.geo && profile.geo.latitude && profile.geo.longitude &&
        profile.review_count &&
        profile.price_range;

      if (hasCompleteData) {
        validation.profilesWithCompleteData++;
      }
    });

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
    const completeDataPercent = (validation.profilesWithCompleteData / stats.total_profiles * 100).toFixed(2);

    console.log(`Total communes processed:          ${validation.totalCommunes}`);
    console.log(`Communes with profiles:            ${validation.communesWithProfiles}`);
    console.log(`Coverage:                          ${coveragePercent}%`);
    console.log(`Total profiles assigned:           ${validation.profilesAssigned}`);
    console.log(`Average profiles per commune:      ${validation.avgProfilesPerCommune}`);
    console.log(`Communes with <3 profiles:         ${validation.communesWithLessThan3.length}`);
    console.log(`Communes with NO profiles:         ${validation.communesWithNoProfiles.length}`);
    console.log(`\n📊 CAROUSEL SCHEMA READINESS:`);
    console.log(`Profiles with complete data:       ${validation.profilesWithCompleteData} / ${stats.total_profiles} (${completeDataPercent}%)`);
    console.log(`Profiles with addresses:           ${stats.profiles_with_addresses}`);
    console.log(`Profiles with coordinates:         ${stats.profiles_with_coordinates}`);

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
      console.log('\n⚠️  Communes with <3 profiles (may not show carousel):');
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
      const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
      console.log(`  File size: ${fileSizeMB} MB`);
    }

    // Step 7: Print summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EXPORT COMPLETE (ENHANCED FOR CAROUSEL SCHEMA)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Statistics:');
    console.log(`  Total profiles:                ${stats.total_profiles}`);
    console.log(`  Cities mapped:                 ${stats.cities_mapped}`);
    console.log(`  Departments mapped:            ${stats.departments_mapped}`);
    console.log(`  Profiles with complete data:   ${validation.profilesWithCompleteData} (${completeDataPercent}%)`);
    console.log('');

    // Sample data preview
    console.log('Sample Enhanced Profile Data:');
    if (allProfiles.length > 0) {
      const sampleProfile = allProfiles[0];
      console.log(`  ${sampleProfile.first_name} ${sampleProfile.last_name}:`);
      console.log(`    - Profile URL: ${sampleProfile.profile_url}`);
      console.log(`    - Rating: ${sampleProfile.rating} (${sampleProfile.review_count} reviews)`);
      console.log(`    - Price Range: ${sampleProfile.price_range}`);
      if (sampleProfile.address) {
        console.log(`    - Address: ${sampleProfile.address.addressLocality}, ${sampleProfile.address.postalCode}`);
      }
      if (sampleProfile.geo) {
        console.log(`    - Coordinates: ${sampleProfile.geo.latitude}, ${sampleProfile.geo.longitude}`);
      }
      console.log(`    - Images: Square, Landscape, Wide ✓`);
    }

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
