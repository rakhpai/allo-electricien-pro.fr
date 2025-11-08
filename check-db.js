require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkDatabase() {
  console.log('Checking Supabase database...\n');

  // Total electricians
  const { count: total, error: e1 } = await supabase
    .from('business_listings')
    .select('*', { count: 'exact', head: true })
    .eq('business_type', 'electrician');

  console.log(`Total electricians: ${total}`);

  // With geographic_location_id
  const { count: withGeoId, error: e2 } = await supabase
    .from('business_listings')
    .select('*', { count: 'exact', head: true })
    .eq('business_type', 'electrician')
    .not('geographic_location_id', 'is', null);

  console.log(`With geographic_location_id: ${withGeoId}`);

  // Not CLOSED
  const { count: notClosed, error: e3 } = await supabase
    .from('business_listings')
    .select('*', { count: 'exact', head: true })
    .eq('business_type', 'electrician')
    .not('geographic_location_id', 'is', null)
    .neq('business_status', 'CLOSED');

  console.log(`Not CLOSED: ${notClosed}`);

  // Get sample without address
  const { data: sample } = await supabase
    .from('business_listings')
    .select('name, full_address, street, city, postal_code')
    .eq('business_type', 'electrician')
    .not('geographic_location_id', 'is', null)
    .limit(10);

  console.log('\nSample electricians:');
  sample.forEach((e, i) => {
    const addr = e.full_address || e.street || [e.city, e.postal_code].filter(Boolean).join(', ');
    console.log(`${i+1}. ${e.name}`);
    console.log(`   full_address: ${e.full_address || 'null'}`);
    console.log(`   street: ${e.street || 'null'}`);
    console.log(`   city: ${e.city || 'null'}`);
    console.log(`   Built address: ${addr}`);
  });
}

checkDatabase();
