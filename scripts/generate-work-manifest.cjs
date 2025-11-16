#!/usr/bin/env node

/**
 * Work Manifest Generator
 * Splits communes into batches for parallel processing
 */

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('./utils/atomic-file.cjs');

// Parse command line arguments
const args = {
  BATCH_SIZE: parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 87,
  LIMIT: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  TEST: process.argv.includes('--test'),
  RESUME: process.argv.includes('--resume')
};

/**
 * Load all communes from sitemap data
 */
function loadAllCommunes() {
  const sitemapData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/sitemap_pages.json'), 'utf-8')
  );

  let communes = [];

  // Tier B (Paris arrondissements)
  if (sitemapData.organized.tier_b?.paris) {
    communes = communes.concat(sitemapData.organized.tier_b.paris);
  }

  // Tier C
  if (sitemapData.organized.tier_c_by_dept) {
    Object.values(sitemapData.organized.tier_c_by_dept).forEach(deptCommunes => {
      if (Array.isArray(deptCommunes)) {
        communes = communes.concat(deptCommunes);
      }
    });
  }

  // Tier D
  if (sitemapData.organized.tier_d_by_dept) {
    Object.values(sitemapData.organized.tier_d_by_dept).forEach(deptCommunes => {
      if (Array.isArray(deptCommunes)) {
        communes = communes.concat(deptCommunes);
      }
    });
  }

  // Filter and add slug field
  communes = communes
    .filter(c => (c.page_type === 'commune' || c.page_type === 'city') && c.city_name)
    .map(c => ({
      slug: c.url_path.replace(/^\//, '').replace(/\/$/, ''),
      city_name: c.city_name,
      department: c.department,
      tier: c.tier
    }));

  return communes;
}

/**
 * Filter communes that already have generated content
 */
function filterAlreadyProcessed(communes) {
  try {
    const existingData = JSON.parse(
      fs.readFileSync('data/electrician_commune_context.json', 'utf-8')
    );

    const processedSlugs = new Set(Object.keys(existingData.by_commune || {}));

    const remaining = communes.filter(c => !processedSlugs.has(c.slug));

    console.log(`✅ Found ${processedSlugs.size} already processed communes`);
    console.log(`📋 ${remaining.length} communes remaining to process`);

    return remaining;

  } catch (err) {
    // No existing data, process all
    console.log(`📋 No existing data found, processing all ${communes.length} communes`);
    return communes;
  }
}

/**
 * Create batches from commune list
 */
function createBatches(communes, batchSize) {
  const batches = [];

  for (let i = 0; i < communes.length; i += batchSize) {
    const batchCommunes = communes.slice(i, i + batchSize);

    batches.push({
      id: batches.length + 1,
      communes: batchCommunes.map(c => c.slug),
      communeCount: batchCommunes.length,
      status: 'pending',
      worker_pid: null,
      started_at: null,
      completed_at: null
    });
  }

  return batches;
}

/**
 * Main function
 */
async function main() {
  console.log('🔨 Generating work manifest...\n');

  // Check if manifest already exists
  if (fs.existsSync('work-manifest.json') && !args.RESUME) {
    console.error('❌ work-manifest.json already exists!');
    console.error('   Use --resume to continue existing manifest');
    console.error('   Or delete the file to start fresh');
    process.exit(1);
  }

  if (args.RESUME && fs.existsSync('work-manifest.json')) {
    console.log('✅ Resuming from existing manifest');
    const manifest = JSON.parse(fs.readFileSync('work-manifest.json', 'utf-8'));

    const status = {
      pending: manifest.batches.filter(b => b.status === 'pending').length,
      in_progress: manifest.batches.filter(b => b.status === 'in_progress').length,
      completed: manifest.batches.filter(b => b.status === 'completed').length,
      total: manifest.batches.length
    };

    console.log(`\nCurrent status:`);
    console.log(`  Pending: ${status.pending}`);
    console.log(`  In Progress: ${status.in_progress}`);
    console.log(`  Completed: ${status.completed}`);
    console.log(`  Total: ${status.total}\n`);

    return;
  }

  // Load communes
  let communes = loadAllCommunes();
  console.log(`📊 Loaded ${communes.length} total communes`);

  // Filter already processed (skip if testing)
  if (!args.TEST) {
    communes = filterAlreadyProcessed(communes);
  }

  // Apply test limit
  if (args.TEST) {
    communes = communes.slice(0, 10);
    console.log(`🧪 TEST MODE: Limited to ${communes.length} communes`);
  }

  // Apply limit if specified
  if (args.LIMIT) {
    communes = communes.slice(0, args.LIMIT);
    console.log(`📌 Limited to ${communes.length} communes (--limit=${args.LIMIT})`);
  }

  if (communes.length === 0) {
    console.log('✅ All communes already processed! Nothing to do.');
    process.exit(0);
  }

  // Create batches
  const batches = createBatches(communes, args.BATCH_SIZE);

  console.log(`\n📦 Created ${batches.length} batches:`);
  console.log(`   Batch size: ${args.BATCH_SIZE} communes`);
  console.log(`   Total communes: ${communes.length}`);
  console.log(`   Expected pairs: ~${communes.length * 6} (assuming 6 electricians/commune)`);

  // Calculate estimates
  const totalPairs = communes.length * 6;
  const apiCallsPerPair = 5;
  const totalApiCalls = totalPairs * apiCallsPerPair;

  console.log(`\n⏱️  Estimates (at 2400ms delay between calls):`);
  console.log(`   API calls: ${totalApiCalls.toLocaleString()}`);
  console.log(`   Time per worker: ~${Math.ceil(totalApiCalls / batches.length / 25)} minutes`);
  console.log(`   With 12 workers: ~${Math.ceil(totalApiCalls / (12 * 25))} minutes total`);

  // Create manifest
  const manifest = {
    created_at: new Date().toISOString(),
    batch_size: args.BATCH_SIZE,
    total_communes: communes.length,
    batches: batches
  };

  // Save manifest
  await atomicWriteJSON('work-manifest.json', manifest);

  console.log(`\n✅ Work manifest saved to: work-manifest.json`);
  console.log(`\nNext step: Run coordinator to start processing`);
  console.log(`   node scripts/coordinator.cjs --workers=12\n`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
