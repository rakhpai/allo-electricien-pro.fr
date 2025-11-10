require('dotenv').config({ path: '/home/proalloelectrici/hugosource/.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debug() {
  // Load sites.json
  const sitesPath = path.join('/home/proalloelectrici/hugosource', 'data', 'sites.json');
  const sitesData = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

  console.log('=== SITES.JSON SAMPLE (first 5) ===');
  sitesData.sites.slice(0, 5).forEach(site => {
    console.log(`City: "${site.city}" | Slug: "${site.citySlug}"`);
  });

  // Load geo_cities_idf
  const { data: cities, error } = await supabase
    .from('geo_cities_idf')
    .select('city_id, city, county_id')
    .limit(5);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('\n=== GEO_CITIES_IDF SAMPLE (first 5) ===');
  cities.forEach(city => {
    console.log(`ID: ${city.city_id} | City: "${city.city}" | County: ${city.county_id}`);
  });

  // Test normalization
  console.log('\n=== NORMALIZATION TEST ===');
  const testCity = cities[0].city;
  const normalized = testCity
    .toUpperCase()
    .trim()
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u')
    .replace(/[ç]/gi, 'c');

  console.log(`Original: "${testCity}"`);
  console.log(`Normalized: "${normalized}"`);

  // Check if any sites.json city matches
  const sitesNormalized = sitesData.sites[0].city
    .toUpperCase()
    .trim()
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u')
    .replace(/[ç]/gi, 'c');

  console.log(`\nSites.json city normalized: "${sitesNormalized}"`);
  console.log(`Match: ${normalized === sitesNormalized}`);
}

debug();
