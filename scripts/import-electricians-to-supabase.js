require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

console.log('=== IMPORT ELECTRICIANS TO SUPABASE ===\n');

// Configuration
const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 10 : null;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No data will be written to Supabase\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only process ${TEST_LIMIT} records\n`);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Load Outscraper data
const dataPath = path.join(__dirname, '..', 'Outscraper-electrician.json');
if (!fs.existsSync(dataPath)) {
  console.error('❌ Error: Outscraper-electrician.json not found');
  process.exit(1);
}

console.log('📊 Loading Outscraper data...');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const data = TEST_MODE ? rawData.slice(0, TEST_LIMIT) : rawData;
console.log(`✓ Loaded ${data.length} records to import\n`);

// Transform Outscraper record to Supabase format
function transformRecord(record) {
  // Create MD5 hash for deduplication
  const hashString = `${record.place_id}-${record.name}-${record.city}`;
  const md5Hash = crypto.createHash('md5').update(hashString).digest('hex');

  // Parse working hours if available
  let workingHours = null;
  if (record.working_hours && typeof record.working_hours === 'object') {
    workingHours = record.working_hours;
  }

  // Parse about/features if available
  let about = null;
  if (record.about && typeof record.about === 'object') {
    about = record.about;
  }

  return {
    // Required fields
    name: record.name,
    business_type: 'electrician',
    place_id: record.place_id,
    city: record.city || 'Unknown',

    // Google IDs
    google_id: record.google_id || null,
    cid: record.cid ? String(record.cid) : null,

    // Address information
    full_address: record.full_address || null,
    street: record.street || null,
    postal_code: record.postal_code ? String(record.postal_code) : null,

    // Coordinates (required in source data, always present)
    latitude: record.latitude,
    longitude: record.longitude,

    // Contact information
    phone: record.phone || null,
    website: record.site || null,
    email: null, // Outscraper doesn't have email

    // Business status
    business_status: record.business_status || 'OPERATIONAL',
    verified: record.verified === true,

    // Ratings and reviews
    rating: record.rating ? parseFloat(record.rating) : null,
    review_count: record.reviews ? parseInt(record.reviews) : 0,

    // Price level
    price_level: record.range ? { range: record.range } : null,

    // Operating hours
    working_hours: workingHours,

    // Description
    description: record.description ? { text: record.description } : null,

    // Categories - store as JSON array
    categories: record.category ? [record.category] : null,

    // Services - parse from subtypes
    services: record.subtypes ? record.subtypes.split(',').map(s => s.trim()) : null,

    // Metadata
    query_used: record.query || null,
    scraped_at: new Date().toISOString(),
    last_verified: null,
    md5_hash: md5Hash,

    // Timestamps
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),

    // Geographic location ID - will be null for now, can be populated later
    geographic_location_id: null
  };
}

// Validate record has required fields
function validateRecord(record) {
  const errors = [];

  if (!record.name || record.name.trim() === '') {
    errors.push('Missing name');
  }

  if (!record.place_id) {
    errors.push('Missing place_id');
  }

  if (!record.city || record.city === 'Unknown') {
    errors.push('Missing city');
  }

  if (record.latitude === null || record.latitude === undefined) {
    errors.push('Missing latitude');
  }

  if (record.longitude === null || record.longitude === undefined) {
    errors.push('Missing longitude');
  }

  return errors;
}

// Import records in batches
async function importRecords() {
  const stats = {
    total: data.length,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IMPORTING RECORDS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Process in batches
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNum}/${totalBatches} (records ${i + 1}-${Math.min(i + BATCH_SIZE, data.length)})`);

    for (const rawRecord of batch) {
      stats.processed++;

      try {
        // Transform record
        const record = transformRecord(rawRecord);

        // Validate record
        const validationErrors = validateRecord(record);
        if (validationErrors.length > 0) {
          stats.skipped++;
          stats.errors.push({
            place_id: rawRecord.place_id,
            name: rawRecord.name,
            errors: validationErrors
          });
          continue;
        }

        if (DRY_RUN) {
          // In dry run mode, just log what we would do
          stats.inserted++;
          if (stats.processed <= 3) {
            console.log(`  Would insert: ${record.name} (${record.city})`);
          }
          continue;
        }

        // Check if record exists
        const { data: existing, error: checkError } = await supabase
          .from('business_listings')
          .select('id')
          .eq('place_id', record.place_id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          // Error other than "not found"
          throw checkError;
        }

        if (existing) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('business_listings')
            .update({
              ...record,
              updated_at: new Date().toISOString()
            })
            .eq('place_id', record.place_id);

          if (updateError) {
            throw updateError;
          }

          stats.updated++;
          if (stats.processed <= 5) {
            console.log(`  ✓ Updated: ${record.name} (${record.city})`);
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('business_listings')
            .insert(record);

          if (insertError) {
            throw insertError;
          }

          stats.inserted++;
          if (stats.processed <= 5) {
            console.log(`  ✓ Inserted: ${record.name} (${record.city})`);
          }
        }

      } catch (error) {
        stats.failed++;
        stats.errors.push({
          place_id: rawRecord.place_id,
          name: rawRecord.name,
          error: error.message
        });

        if (stats.failed <= 5) {
          console.log(`  ❌ Failed: ${rawRecord.name} - ${error.message}`);
        }
      }
    }

    // Progress update
    const progress = ((stats.processed / stats.total) * 100).toFixed(1);
    console.log(`  Progress: ${stats.processed}/${stats.total} (${progress}%)`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IMPORT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total records:    ${stats.total}`);
  console.log(`  Processed:        ${stats.processed}`);
  console.log(`  Inserted:         ${stats.inserted}`);
  console.log(`  Updated:          ${stats.updated}`);
  console.log(`  Skipped:          ${stats.skipped}`);
  console.log(`  Failed:           ${stats.failed}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.name} (${err.place_id})`);
      if (err.errors) {
        err.errors.forEach(e => console.log(`    • ${e}`));
      } else {
        console.log(`    • ${err.error}`);
      }
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'import-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: import-errors.json`);
  }

  console.log('');

  if (!DRY_RUN && !TEST_MODE) {
    // Verify import
    console.log('Verifying import in Supabase...');
    const { count, error } = await supabase
      .from('business_listings')
      .select('*', { count: 'exact', head: true })
      .eq('business_type', 'electrician');

    if (error) {
      console.log(`⚠ Could not verify: ${error.message}`);
    } else {
      console.log(`✓ Total electricians in database: ${count}`);
    }
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to perform actual import');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to import all records');
  }
}

// Run import
importRecords().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
