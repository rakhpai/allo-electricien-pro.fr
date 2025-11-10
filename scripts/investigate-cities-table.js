require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('=== INVESTIGATE CITIES TABLE ===\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function investigateCitiesTable() {
  console.log('📊 STEP 1: Query cities table structure and sample data\n');

  // Get sample cities
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('*')
    .limit(10);

  if (citiesError) {
    console.log('❌ Error querying cities table:', citiesError.message);
    console.log('   The cities table may not exist or may have different permissions\n');
  } else {
    console.log(`✓ Found cities table with ${cities.length} sample records`);
    console.log('\nSample city record:');
    console.log(JSON.stringify(cities[0], null, 2));
    console.log('\nColumns in cities table:');
    console.log(Object.keys(cities[0]).join(', '));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STEP 2: Analyze geographic_locations with and without city_id\n');

  // Count total
  const { count: totalCount } = await supabase
    .from('geographic_locations')
    .select('*', { count: 'exact', head: true });

  // Count with city_id
  const { count: withCityId } = await supabase
    .from('geographic_locations')
    .select('*', { count: 'exact', head: true })
    .not('city_id', 'is', null);

  // Count without city_id
  const { count: withoutCityId } = await supabase
    .from('geographic_locations')
    .select('*', { count: 'exact', head: true })
    .is('city_id', null);

  console.log(`Geographic Locations Statistics:`);
  console.log(`  Total: ${totalCount}`);
  console.log(`  With city_id: ${withCityId} (${(withCityId/totalCount*100).toFixed(1)}%)`);
  console.log(`  Without city_id: ${withoutCityId} (${(withoutCityId/totalCount*100).toFixed(1)}%)`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STEP 3: Sample geographic_locations WITH city_id\n');

  const { data: withCityIdSamples } = await supabase
    .from('geographic_locations')
    .select('id, slug, name, postal_codes, city_id, type')
    .not('city_id', 'is', null)
    .limit(5);

  console.log('Sample locations WITH city_id:');
  withCityIdSamples.forEach((loc, idx) => {
    console.log(`\n${idx + 1}. ${loc.name} (${loc.slug})`);
    console.log(`   city_id: ${loc.city_id}`);
    console.log(`   type: ${loc.type}`);
    console.log(`   postal_codes: ${loc.postal_codes?.join(', ')}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STEP 4: Sample geographic_locations WITHOUT city_id\n');

  const { data: withoutCityIdSamples } = await supabase
    .from('geographic_locations')
    .select('id, slug, name, postal_codes, city_id, type')
    .is('city_id', null)
    .limit(10);

  console.log('Sample locations WITHOUT city_id:');
  withoutCityIdSamples.forEach((loc, idx) => {
    console.log(`\n${idx + 1}. ${loc.name} (${loc.slug})`);
    console.log(`   city_id: NULL`);
    console.log(`   type: ${loc.type}`);
    console.log(`   postal_codes: ${loc.postal_codes?.join(', ')}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STEP 5: Check our specific problem cities\n');

  const problemCities = ['le-blanc-mesnil', 'malakoff', 'le-raincy', 'le-plessis-robinson', 'marly-la-ville'];

  for (const slug of problemCities) {
    const { data, error } = await supabase
      .from('geographic_locations')
      .select('id, slug, name, postal_codes, city_id, type')
      .eq('slug', slug)
      .limit(1)
      .single();

    if (error) {
      console.log(`❌ ${slug}: NOT FOUND`);
    } else {
      console.log(`\n✓ ${slug}:`);
      console.log(`   UUID: ${data.id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Postal: ${data.postal_codes?.join(', ')}`);
      console.log(`   city_id: ${data.city_id || 'NULL'}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STEP 6: If cities table exists, try to match by name/postal\n');

  if (!citiesError && cities && cities.length > 0) {
    console.log('Attempting to find matching cities for problem locations...\n');

    // Check if cities table has name or postal_code fields
    const cityColumns = Object.keys(cities[0]);
    console.log('Available city columns:', cityColumns.join(', '));

    // Try to match Le Blanc-Mesnil
    if (cityColumns.includes('name')) {
      const { data: matchingCity } = await supabase
        .from('cities')
        .select('*')
        .ilike('name', '%blanc%mesnil%')
        .limit(1)
        .single();

      if (matchingCity) {
        console.log('\n✓ Found potential match in cities table:');
        console.log(JSON.stringify(matchingCity, null, 2));
      } else {
        console.log('\n❌ No match found for "Le Blanc-Mesnil" in cities table');
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 STEP 7: Analyze relationship between geographic_locations.id and city_id\n');

  // Check if there's a pattern in existing city_id values
  const { data: cityIdAnalysis } = await supabase
    .from('geographic_locations')
    .select('id, slug, name, city_id')
    .not('city_id', 'is', null)
    .order('city_id')
    .limit(20);

  console.log('Sample of city_id values in geographic_locations:');
  console.log('city_id range:',
    Math.min(...cityIdAnalysis.map(l => l.city_id)),
    'to',
    Math.max(...cityIdAnalysis.map(l => l.city_id))
  );
  console.log('\nFirst few entries:');
  cityIdAnalysis.slice(0, 5).forEach(loc => {
    console.log(`  ${loc.city_id}: ${loc.name} (${loc.slug})`);
  });

  console.log('\n✅ Investigation complete!\n');
}

investigateCitiesTable().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
