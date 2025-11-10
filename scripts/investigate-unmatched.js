require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function investigate() {
  const testCodes = ['93150', '92350', '93340', '92240', '95670', '78160'];

  console.log('Investigating unmatched postal codes...\n');

  for (const code of testCodes) {
    const { data, error } = await supabase
      .from('geographic_locations')
      .select('id, slug, name, postal_codes, city_id, latitude, longitude')
      .contains('postal_codes', [code]);

    if (error) {
      console.log(`❌ Error querying ${code}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`✓ Postal code ${code}:`);
      data.forEach(loc => {
        console.log(`  - ${loc.name} (slug: ${loc.slug})`);
        console.log(`    city_id: ${loc.city_id || 'NULL'}`);
        console.log(`    postal_codes: ${loc.postal_codes?.join(', ')}`);
      });
    } else {
      console.log(`❌ Postal code ${code}: NOT FOUND in database`);
    }
    console.log('');
  }
}

investigate();
