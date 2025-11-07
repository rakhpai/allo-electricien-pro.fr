require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== LINK ELECTRICIANS TO CITIES ===\n');

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

// Load matching data
const reportPath = path.join(__dirname, '..', 'city-linking-report.json');
if (!fs.existsSync(reportPath)) {
  console.error('❌ Error: city-linking-report.json not found');
  console.error('   Please run: node scripts/investigate-city-linking.js');
  process.exit(1);
}

console.log('📊 Loading match data...');
const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const matches = TEST_MODE ? reportData.matches.slice(0, TEST_LIMIT) : reportData.matches;
console.log(`✓ Loaded ${matches.length} matches to process\n`);

async function updateElectricianCityLinks() {
  const stats = {
    total: matches.length,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPDATING GEOGRAPHIC LOCATION LINKS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get current state before updates
  if (!DRY_RUN && !TEST_MODE) {
    console.log('📊 Current state in database:');
    const { count: beforeCount, error: beforeError } = await supabase
      .from('business_listings')
      .select('*', { count: 'exact', head: true })
      .eq('business_type', 'electrician')
      .not('geographic_location_id', 'is', null);

    if (beforeError) {
      console.log(`⚠ Could not check before state: ${beforeError.message}`);
    } else {
      console.log(`  Electricians with geo ID: ${beforeCount}`);
    }
    console.log('');
  }

  // Process in batches
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, Math.min(i + BATCH_SIZE, matches.length));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(matches.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNum}/${totalBatches} (records ${i + 1}-${Math.min(i + BATCH_SIZE, matches.length)})`);

    for (const match of batch) {
      stats.processed++;

      try {
        if (DRY_RUN) {
          // In dry run mode, just log what we would do
          stats.updated++;
          if (stats.processed <= 5) {
            console.log(`  Would link: ${match.electrician_name} → ${match.matched_city_name}`);
          }
          continue;
        }

        // Check if already linked
        const { data: existing, error: checkError } = await supabase
          .from('business_listings')
          .select('geographic_location_id')
          .eq('id', match.electrician_id)
          .single();

        if (checkError) {
          throw checkError;
        }

        if (existing && existing.geographic_location_id !== null) {
          // Already has a geo ID, skip
          stats.skipped++;
          if (stats.processed <= 5) {
            console.log(`  ⊘ Skipped: ${match.electrician_name} (already linked)`);
          }
          continue;
        }

        // Update the geographic_location_id
        const { error: updateError } = await supabase
          .from('business_listings')
          .update({
            geographic_location_id: match.matched_city_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.electrician_id);

        if (updateError) {
          throw updateError;
        }

        stats.updated++;
        if (stats.processed <= 5) {
          console.log(`  ✓ Linked: ${match.electrician_name} → ${match.matched_city_name} (${match.match_type})`);
        }

      } catch (error) {
        stats.failed++;
        stats.errors.push({
          electrician_id: match.electrician_id,
          electrician_name: match.electrician_name,
          matched_city_id: match.matched_city_id,
          error: error.message
        });

        if (stats.failed <= 5) {
          console.log(`  ❌ Failed: ${match.electrician_name} - ${error.message}`);
        }
      }
    }

    // Progress update
    const progress = ((stats.processed / stats.total) * 100).toFixed(1);
    console.log(`  Progress: ${stats.processed}/${stats.total} (${progress}%)`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPDATE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total matches:    ${stats.total}`);
  console.log(`  Processed:        ${stats.processed}`);
  console.log(`  Updated:          ${stats.updated}`);
  console.log(`  Skipped:          ${stats.skipped} (already linked)`);
  console.log(`  Failed:           ${stats.failed}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.electrician_name} (${err.electrician_id})`);
      console.log(`    Target city ID: ${err.matched_city_id}`);
      console.log(`    Error: ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'city-linking-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: city-linking-errors.json`);
  }

  console.log('');

  if (!DRY_RUN && !TEST_MODE) {
    // Verify updates
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { count: withGeoId, error: withError } = await supabase
      .from('business_listings')
      .select('*', { count: 'exact', head: true })
      .eq('business_type', 'electrician')
      .not('geographic_location_id', 'is', null);

    const { count: withoutGeoId, error: withoutError } = await supabase
      .from('business_listings')
      .select('*', { count: 'exact', head: true })
      .eq('business_type', 'electrician')
      .is('geographic_location_id', null);

    if (withError || withoutError) {
      console.log('⚠ Could not verify updates');
    } else {
      const total = withGeoId + withoutGeoId;
      const percentage = ((withGeoId / total) * 100).toFixed(1);

      console.log('Current database state:');
      console.log(`  Total electricians:         ${total}`);
      console.log(`  With geographic link:       ${withGeoId} (${percentage}%)`);
      console.log(`  Without geographic link:    ${withoutGeoId} (${(100 - percentage).toFixed(1)}%)`);
      console.log('');

      if (withoutGeoId > 0) {
        console.log(`💡 ${withoutGeoId} electricians still need city linking`);
        console.log('   These are likely the unmatched records from the investigation');
        console.log('   Check unmatched-cities.json for details');
      } else {
        console.log('✓ All electricians are now linked to cities!');
      }
    }
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to perform actual updates');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to process all matches');
  }

  // Save update summary
  const summaryPath = path.join(__dirname, '..', 'city-linking-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    stats: stats,
    report_source: reportPath
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Update summary saved to: city-linking-summary.json\n`);
}

// Run updates
updateElectricianCityLinks().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
