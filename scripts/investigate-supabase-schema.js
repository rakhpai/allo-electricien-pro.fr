require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('=== SUPABASE SCHEMA INVESTIGATION ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function investigateSchema() {
  try {
    console.log('📊 Connecting to Supabase...');
    console.log(`   URL: ${process.env.SUPABASE_URL}\n`);

    // Check if business_listings table exists
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('BUSINESS_LISTINGS TABLE SCHEMA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Query table schema from information_schema
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'business_listings')
      .order('ordinal_position');

    if (columnsError) {
      console.log('⚠ Cannot query information_schema directly, trying alternative method...\n');

      // Try to get schema by attempting a select
      const { data, error } = await supabase
        .from('business_listings')
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log('❌ business_listings table does NOT exist');
          console.log('   You need to create this table first\n');

          console.log('Suggested Schema:');
          console.log('```sql');
          console.log('CREATE TABLE business_listings (');
          console.log('  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,');
          console.log('  google_place_id TEXT UNIQUE NOT NULL,');
          console.log('  name TEXT NOT NULL,');
          console.log('  phone TEXT,');
          console.log('  website TEXT,');
          console.log('  email TEXT,');
          console.log('  full_address TEXT,');
          console.log('  street TEXT,');
          console.log('  city TEXT NOT NULL,');
          console.log('  postal_code TEXT,');
          console.log('  country TEXT DEFAULT \'France\',');
          console.log('  country_code TEXT DEFAULT \'FR\',');
          console.log('  latitude DECIMAL(10, 8),');
          console.log('  longitude DECIMAL(11, 8),');
          console.log('  category TEXT,');
          console.log('  business_type TEXT,');
          console.log('  rating DECIMAL(2, 1),');
          console.log('  review_count INTEGER DEFAULT 0,');
          console.log('  description TEXT,');
          console.log('  working_hours JSONB,');
          console.log('  about JSONB,');
          console.log('  verified BOOLEAN DEFAULT false,');
          console.log('  business_status TEXT DEFAULT \'OPERATIONAL\',');
          console.log('  source TEXT DEFAULT \'google_maps\',');
          console.log('  owner_id TEXT,');
          console.log('  owner_name TEXT,');
          console.log('  photo_url TEXT,');
          console.log('  logo_url TEXT,');
          console.log('  google_maps_url TEXT,');
          console.log('  reviews_url TEXT,');
          console.log('  created_at TIMESTAMPTZ DEFAULT NOW(),');
          console.log('  updated_at TIMESTAMPTZ DEFAULT NOW()');
          console.log(');');
          console.log('');
          console.log('CREATE INDEX idx_business_listings_city ON business_listings(city);');
          console.log('CREATE INDEX idx_business_listings_postal_code ON business_listings(postal_code);');
          console.log('CREATE INDEX idx_business_listings_category ON business_listings(category);');
          console.log('CREATE INDEX idx_business_listings_location ON business_listings(latitude, longitude);');
          console.log('```\n');

          return;
        }
        console.error('❌ Error querying business_listings:', error.message);
        return;
      }

      if (data && data.length > 0) {
        console.log('✓ business_listings table EXISTS');
        console.log(`  Sample record found, analyzing structure...\n`);

        console.log('Columns (from sample record):');
        Object.keys(data[0]).forEach(col => {
          const value = data[0][col];
          const type = typeof value;
          console.log(`  - ${col.padEnd(25)} (${type})`);
        });
        console.log('');
      } else {
        console.log('✓ business_listings table EXISTS but is EMPTY\n');
      }
    } else {
      console.log('✓ business_listings table EXISTS');
      console.log(`  Found ${columns.length} columns\n`);

      console.log('Columns:');
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
      });
      console.log('');
    }

    // Count existing records
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('EXISTING DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { count, error: countError } = await supabase
      .from('business_listings')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`⚠ Cannot count records: ${countError.message}\n`);
    } else {
      console.log(`Total records: ${count}`);

      if (count > 0) {
        // Check for electricians
        const { count: electricianCount, error: elecError } = await supabase
          .from('business_listings')
          .select('*', { count: 'exact', head: true })
          .or('category.ilike.%électricien%,business_type.ilike.%électricien%');

        if (!elecError) {
          console.log(`Electrician records: ${electricianCount}`);
        }

        // Get sample records
        const { data: samples, error: samplesError } = await supabase
          .from('business_listings')
          .select('*')
          .limit(3);

        if (!samplesError && samples.length > 0) {
          console.log(`\nSample records (first 3):`);
          samples.forEach((record, i) => {
            console.log(`\n  Record ${i + 1}:`);
            Object.entries(record).slice(0, 10).forEach(([key, value]) => {
              const displayValue = value === null ? 'NULL' : String(value).substring(0, 50);
              console.log(`    ${key}: ${displayValue}`);
            });
          });
        }
      } else {
        console.log('  (table is empty)\n');
      }
    }

    console.log('');

    // Check for related tables
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RELATED TABLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const relatedTables = ['categories', 'business_categories', 'regions', 'cities', 'departments', 'services'];

    for (const tableName of relatedTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`  ❌ ${tableName.padEnd(25)} - does not exist`);
      } else {
        console.log(`  ✓ ${tableName.padEnd(25)} - exists (${data ? 'accessible' : 'restricted'})`);
      }
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

investigateSchema();
