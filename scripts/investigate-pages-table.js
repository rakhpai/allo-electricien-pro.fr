require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== INVESTIGATE PAGES TABLE IN SUPABASE ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Main investigation function
 */
async function investigatePagesTable() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: CHECK IF PAGES TABLE EXISTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Try to fetch from pages table to see if it exists
  const { data, error, count } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: false })
    .limit(1);

  if (error) {
    console.error('❌ Error accessing pages table:', error.message);
    console.error('\nPossible reasons:');
    console.error('  - Table does not exist');
    console.error('  - Insufficient permissions');
    console.error('  - Invalid connection credentials\n');
    process.exit(1);
  }

  console.log('✓ Pages table exists and is accessible\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: ANALYZE TABLE SCHEMA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch one record to inspect schema
  if (data && data.length > 0) {
    console.log('Sample record structure:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nColumns detected:');
    Object.keys(data[0]).forEach(key => {
      const value = data[0][key];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${key}: ${type}`);
    });
  } else {
    console.log('⚠️  Table is empty - cannot inspect schema from data');
    console.log('   Attempting to insert a test record to detect schema...\n');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: COUNT EXISTING RECORDS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { count: totalCount, error: countError } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting records:', countError.message);
  } else {
    console.log(`✓ Total records in pages table: ${totalCount || 0}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: FETCH SAMPLE RECORDS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: sampleRecords, error: sampleError } = await supabase
    .from('pages')
    .select('*')
    .limit(5);

  if (sampleError) {
    console.error('❌ Error fetching sample records:', sampleError.message);
  } else if (sampleRecords && sampleRecords.length > 0) {
    console.log(`✓ Fetched ${sampleRecords.length} sample records:\n`);
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.slug || record.id || 'Unknown'}`);
    });
  } else {
    console.log('⚠️  No records found in table');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: ANALYZE CONTENT DIRECTORY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const contentDir = path.join(__dirname, '..', 'content');
  let hugoPageCount = 0;

  if (fs.existsSync(contentDir)) {
    const entries = fs.readdirSync(contentDir, { withFileTypes: true });
    hugoPageCount = entries.filter(entry => entry.isDirectory()).length;
    console.log(`✓ Found ${hugoPageCount} directories in content/ (Hugo pages)`);
  } else {
    console.log('⚠️  Content directory not found');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INVESTIGATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const summary = {
    table_exists: !error,
    record_count: totalCount || 0,
    hugo_pages: hugoPageCount,
    gap: hugoPageCount - (totalCount || 0),
    sample_schema: data && data.length > 0 ? Object.keys(data[0]) : [],
    timestamp: new Date().toISOString()
  };

  console.log('Summary:');
  console.log(`  Pages table exists:        ${summary.table_exists ? 'Yes' : 'No'}`);
  console.log(`  Records in pages table:    ${summary.record_count}`);
  console.log(`  Hugo pages in content/:    ${summary.hugo_pages}`);
  console.log(`  Gap (pages to import):     ${summary.gap}`);
  console.log(`  Table columns:             ${summary.sample_schema.length > 0 ? summary.sample_schema.length : 'Unknown'}`);

  if (summary.sample_schema.length > 0) {
    console.log(`\n  Columns: ${summary.sample_schema.join(', ')}`);
  }

  // Save report
  const reportPath = path.join(__dirname, 'pages-table-investigation.json');
  const report = {
    summary,
    sample_records: sampleRecords || [],
    sample_schema: data && data.length > 0 ? data[0] : null
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Investigation report saved to: scripts/pages-table-investigation.json`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (summary.gap > 0) {
    console.log('💡 Next steps:');
    console.log(`   1. Run extraction script to parse ${summary.hugo_pages} Hugo pages`);
    console.log(`   2. Run import script to add ${summary.gap} pages to Supabase`);
  } else if (summary.gap < 0) {
    console.log('⚠️  Warning: More records in Supabase than Hugo pages');
    console.log('   Some pages in the database may not exist in content/');
  } else {
    console.log('✓ Pages table is in sync with Hugo content!');
  }

  console.log('');
}

// Run investigation
investigatePagesTable().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
