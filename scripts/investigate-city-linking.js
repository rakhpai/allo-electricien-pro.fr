require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== CITY LINKING INVESTIGATION ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Normalize city name for matching
function normalizeCity(city) {
  if (!city) return '';
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except space and dash
    .trim();
}

async function investigate() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DATABASE EXPLORATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // First check the websites table to understand the structure
    console.log('📊 Checking websites table structure...');
    const { data: websites, error: websitesError } = await supabase
      .from('websites')
      .select('*')
      .eq('niche', 'électricité')
      .limit(3);

    if (websitesError) {
      console.log(`⚠ Cannot query websites table: ${websitesError.message}`);
    } else if (websites && websites.length > 0) {
      console.log(`✓ Found ${websites.length} sample website records\n`);
      console.log('Sample website record fields:');
      Object.keys(websites[0]).forEach(key => {
        const value = websites[0][key];
        const displayValue = value === null ? 'NULL' : String(value).substring(0, 60);
        console.log(`  ${key.padEnd(30)}: ${displayValue}`);
      });
      console.log('');
    }

    // Try to find city-related tables
    console.log('Attempting to find city/location tables...\n');

    const tablesToTry = ['cities', 'city', 'locations', 'communes', 'geographic_locations'];
    let citiesTable = null;
    let cities = null;

    for (const tableName of tablesToTry) {
      console.log(`  Trying '${tableName}'...`);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);

      if (!error && data) {
        console.log(`    ✓ Found table: ${tableName}`);
        citiesTable = tableName;
        cities = data;
        break;
      } else {
        console.log(`    ❌ ${error.message}`);
      }
    }

    if (!cities || cities.length === 0) {
      console.log('\n⚠ No accessible city table found');
      console.log('Checking if geographic_location_id references websites table itself...\n');

      // Check if it's a self-reference
      const { data: sampleBiz, error: bizError } = await supabase
        .from('business_listings')
        .select('id, geographic_location_id')
        .not('geographic_location_id', 'is', null)
        .limit(1);

      if (!bizError && sampleBiz && sampleBiz.length > 0) {
        console.log('Sample business with geographic_location_id:', sampleBiz[0].geographic_location_id);

        // Try to find what this ID references
        const { data: refWebsite, error: refError } = await supabase
          .from('websites')
          .select('*')
          .eq('id', sampleBiz[0].geographic_location_id)
          .single();

        if (!refError && refWebsite) {
          console.log('✓ geographic_location_id references websites table!\n');
          console.log('Referenced website:');
          console.log(`  City: ${refWebsite.city}`);
          console.log(`  Zip: ${refWebsite.zip}`);
          console.log(`  Department: ${refWebsite.department_code}`);
          console.log('');

          // Use websites table as "cities" for matching
          console.log('Using websites table for city matching...\n');
          cities = websites;
          citiesTable = 'websites';
        }
      }

      if (!cities || cities.length === 0) {
        console.log('Cannot proceed without a city reference table.');
        return;
      }
    }

    if (!cities || cities.length === 0) {
      console.log('⚠ Cities table is empty or inaccessible');
      return;
    }

    console.log(`✓ Cities table accessible\n`);
    console.log('Sample city record:');
    const sampleCity = cities[0];
    Object.entries(sampleCity).forEach(([key, value]) => {
      const displayValue = value === null ? 'NULL' : String(value).substring(0, 60);
      console.log(`  ${key.padEnd(20)}: ${displayValue}`);
    });
    console.log('');

    // Count total cities
    const { count: totalCities, error: countError } = await supabase
      .from('cities')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`Total cities in database: ${totalCities}`);
    }
    console.log('');

    // Get all cities for matching
    console.log(`📥 Loading all records from ${citiesTable} table...`);
    let selectFields;
    if (citiesTable === 'websites') {
      selectFields = 'id, city, zip, department_code, subdomain';
    } else if (citiesTable === 'geographic_locations') {
      selectFields = 'id, name, slug, postal_codes, insee_code, type';
    } else {
      selectFields = 'id, name, postal_code, slug, department_code';
    }

    // Load all cities (need to paginate)
    let allCities = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(citiesTable)
        .select(selectFields)
        .eq('type', 'commune')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error loading cities:', error.message);
        return;
      }

      if (data && data.length > 0) {
        allCities = allCities.concat(data);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const allCitiesError = null; // Set to null since we handled errors in loop

    if (allCitiesError) {
      console.error('❌ Error loading cities:', allCitiesError.message);
      return;
    }

    console.log(`✓ Loaded ${allCities.length} location records\n`);

    // Create lookup maps
    const citiesByPostalCode = new Map();
    const citiesByName = new Map();
    const citiesBySlug = new Map();

    allCities.forEach(city => {
      // Handle both table structures
      const postalCode = city.postal_code || city.zip || city.postal_codes;
      const cityName = city.name || city.city;
      const slug = city.slug || city.subdomain;

      // By postal code (handle plural postal_codes field which may have multiple codes)
      if (postalCode) {
        const codes = postalCode.toString().split(',').map(c => c.trim());
        codes.forEach(code => {
          if (code) {
            if (!citiesByPostalCode.has(code)) {
              citiesByPostalCode.set(code, []);
            }
            citiesByPostalCode.get(code).push(city);
          }
        });
      }

      // By normalized name
      const normalizedName = normalizeCity(cityName);
      if (normalizedName) {
        if (!citiesByName.has(normalizedName)) {
          citiesByName.set(normalizedName, []);
        }
        citiesByName.get(normalizedName).push(city);
      }

      // By slug
      if (slug) {
        citiesBySlug.set(slug, city);
      }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ELECTRICIANS ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Query electricians (paginate)
    console.log('📥 Loading electricians...');
    let electricians = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('business_listings')
        .select('id, name, city, postal_code, geographic_location_id')
        .eq('business_type', 'electrician')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error loading electricians:', error.message);
        return;
      }

      if (data && data.length > 0) {
        electricians = electricians.concat(data);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const elecError = null; // Set to null since we handled errors in loop

    if (elecError) {
      console.error('❌ Error loading electricians:', elecError.message);
      return;
    }

    console.log(`✓ Loaded ${electricians.length} electricians\n`);

    // Analyze current state
    const withGeoId = electricians.filter(e => e.geographic_location_id !== null).length;
    const withoutGeoId = electricians.filter(e => e.geographic_location_id === null).length;

    console.log('Current geographic_location_id status:');
    console.log(`  With geo ID:    ${withGeoId}`);
    console.log(`  Without geo ID: ${withoutGeoId}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('MATCHING ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const stats = {
      total: electricians.length,
      matchedByPostalCode: 0,
      matchedByName: 0,
      unmatched: 0,
      multipleMatches: 0
    };

    const matches = [];
    const unmatched = [];

    electricians.forEach(elec => {
      let matched = false;
      let matchType = '';
      let matchedCity = null;

      // Try postal code first (most reliable)
      if (elec.postal_code && citiesByPostalCode.has(elec.postal_code)) {
        const candidates = citiesByPostalCode.get(elec.postal_code);

        if (candidates.length === 1) {
          matchedCity = candidates[0];
          matchType = 'postal_code';
          stats.matchedByPostalCode++;
          matched = true;
        } else if (candidates.length > 1) {
          // Multiple cities with same postal code, try to match by name too
          const normalizedElecCity = normalizeCity(elec.city);
          const exactMatch = candidates.find(c => normalizeCity(c.name) === normalizedElecCity);

          if (exactMatch) {
            matchedCity = exactMatch;
            matchType = 'postal_code_and_name';
            stats.matchedByPostalCode++;
            matched = true;
          } else {
            // Take first one, log as multiple matches
            matchedCity = candidates[0];
            matchType = 'postal_code_first';
            stats.matchedByPostalCode++;
            stats.multipleMatches++;
            matched = true;
          }
        }
      }

      // Try name match if no postal code match
      if (!matched && elec.city) {
        const normalizedElecCity = normalizeCity(elec.city);
        if (citiesByName.has(normalizedElecCity)) {
          const candidates = citiesByName.get(normalizedElecCity);

          if (candidates.length > 0) {
            matchedCity = candidates[0];
            matchType = 'name';
            stats.matchedByName++;
            matched = true;

            if (candidates.length > 1) {
              stats.multipleMatches++;
            }
          }
        }
      }

      if (matched && matchedCity) {
        matches.push({
          electrician_id: elec.id,
          electrician_name: elec.name,
          electrician_city: elec.city,
          electrician_postal: elec.postal_code,
          matched_city_id: matchedCity.id,
          matched_city_name: matchedCity.name || matchedCity.city,
          matched_city_postal: matchedCity.postal_code || matchedCity.zip || matchedCity.postal_codes,
          match_type: matchType
        });
      } else {
        stats.unmatched++;
        unmatched.push({
          id: elec.id,
          name: elec.name,
          city: elec.city,
          postal_code: elec.postal_code
        });
      }
    });

    console.log('Match Statistics:');
    console.log(`  Total electricians:        ${stats.total}`);
    console.log(`  Matched by postal code:    ${stats.matchedByPostalCode} (${(stats.matchedByPostalCode / stats.total * 100).toFixed(1)}%)`);
    console.log(`  Matched by name only:      ${stats.matchedByName} (${(stats.matchedByName / stats.total * 100).toFixed(1)}%)`);
    console.log(`  Unmatched:                 ${stats.unmatched} (${(stats.unmatched / stats.total * 100).toFixed(1)}%)`);
    console.log(`  Multiple match candidates: ${stats.multipleMatches}`);
    console.log('');

    const totalMatched = stats.matchedByPostalCode + stats.matchedByName;
    const matchRate = (totalMatched / stats.total * 100).toFixed(1);
    console.log(`Overall match rate: ${matchRate}%`);
    console.log('');

    // Show sample matches
    if (matches.length > 0) {
      console.log('Sample matches (first 5):');
      matches.slice(0, 5).forEach((m, i) => {
        console.log(`\n  ${i + 1}. ${m.electrician_name}`);
        console.log(`     Electrician: ${m.electrician_city} (${m.electrician_postal})`);
        console.log(`     Matched to:  ${m.matched_city_name} (${m.matched_city_postal})`);
        console.log(`     Match type:  ${m.match_type}`);
      });
      console.log('');
    }

    // Show unmatched cities
    if (unmatched.length > 0) {
      console.log(`Unmatched electricians (showing first 10 of ${unmatched.length}):`);
      unmatched.slice(0, 10).forEach(u => {
        console.log(`  - ${u.name} in ${u.city || 'Unknown'} (${u.postal_code || 'No postal code'})`);
      });
      console.log('');
    }

    // Save reports
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: stats,
      cities_available: allCities.length,
      electricians_total: electricians.length,
      matches: matches,
      unmatched: unmatched
    };

    const reportPath = path.join(__dirname, '..', 'city-linking-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`✓ Full report saved to: city-linking-report.json`);

    const unmatchedPath = path.join(__dirname, '..', 'unmatched-cities.json');
    fs.writeFileSync(unmatchedPath, JSON.stringify(unmatched, null, 2));
    console.log(`✓ Unmatched list saved to: unmatched-cities.json`);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`✓ ${totalMatched} electricians can be linked to cities (${matchRate}%)`);
    console.log(`⚠ ${stats.unmatched} electricians need manual review`);
    console.log('');
    console.log('Run the update script to populate geographic_location_id:');
    console.log('  node scripts/link-electricians-to-cities.js --dry-run    (preview)');
    console.log('  node scripts/link-electricians-to-cities.js              (execute)');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

investigate();
