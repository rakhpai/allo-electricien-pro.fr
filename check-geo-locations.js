require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkGeoLocations() {
  console.log('Checking geographic_locations table...\n');

  // Count total
  const { count: total, error: e1 } = await supabase
    .from('geographic_locations')
    .select('*', { count: 'exact', head: true });

  console.log(`Total geographic_locations: ${total}`);

  // Get first 10 with their info
  const { data: first10, error: e2 } = await supabase
    .from('geographic_locations')
    .select('id, name, slug')
    .order('slug')
    .limit(10);

  if (first10) {
    console.log('\nFirst 10 cities (by slug):');
    first10.forEach((c, i) => {
      console.log(`${i+1}. ${c.name} (${c.slug})`);
    });
  }

  // Check if our Hugo cities are in the geo table
  const hugoSlugs = ['ablon-sur-seine', 'acheres', 'alfortville', 'andresy', 'argenteuil'];

  console.log('\nChecking Hugo city slugs in geo table:');
  for (const slug of hugoSlugs) {
    const { data: city, error } = await supabase
      .from('geographic_locations')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();

    if (city) {
      // Check if this city has electricians
      const { count: elecCount } = await supabase
        .from('business_listings')
        .select('*', { count: 'exact', head: true })
        .eq('business_type', 'electrician')
        .eq('geographic_location_id', city.id)
        .neq('business_status', 'CLOSED');

      console.log(`✓ ${slug}: Found (ID: ${city.id}, Electricians: ${elecCount || 0})`);
    } else {
      console.log(`✗ ${slug}: NOT FOUND in geographic_locations`);
    }
  }
}

checkGeoLocations();
