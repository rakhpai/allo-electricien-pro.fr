require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUniqueCities() {
  console.log('Checking unique cities with electricians...\n');

  // Get all electricians with their geographic_location_id
  const { data: electricians, error } = await supabase
    .from('business_listings')
    .select('geographic_location_id')
    .eq('business_type', 'electrician')
    .not('geographic_location_id', 'is', null)
    .neq('business_status', 'CLOSED');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Count unique geographic_location_ids
  const uniqueCityIds = new Set(electricians.map(e => e.geographic_location_id));

  console.log(`Total electricians: ${electricians.length}`);
  console.log(`Unique city IDs: ${uniqueCityIds.size}`);

  // Now get the city names for these IDs
  const cityIds = Array.from(uniqueCityIds);
  const { data: cities, error: cityError } = await supabase
    .from('geographic_locations')
    .select('id, name, slug')
    .in('id', cityIds.slice(0, 100)); // Sample first 100

  if (!cityError && cities) {
    console.log(`\nFirst ${cities.length} cities with electricians:`);
    cities.forEach((c, i) => {
      console.log(`${i+1}. ${c.name} (${c.slug})`);
    });
  }
}

checkUniqueCities();
