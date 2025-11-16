#!/usr/bin/env node

/**
 * Smart Parallel Batch Launcher
 *
 * Features:
 * - Preserves existing checkpoint data
 * - Identifies already-processed communes
 * - Splits remaining work into 50-commune batches
 * - Launches many parallel batches for fast completion
 * - Safe recovery if anything fails
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BATCH_SIZE = 50; // Communes per batch
const LOG_DIR = '/tmp/electrician-batches-opt';
const CHECKPOINT_BACKUP = 'checkpoint-BACKUP-20251116-064755.json';
const SITEMAP_FILE = path.join(__dirname, '../data/sitemap_pages.json');

console.log('========================================');
console.log('Smart Parallel Batch Launcher');
console.log('========================================\n');

// Step 1: Load existing checkpoint to identify processed communes
console.log('📂 Loading existing checkpoint...');
let processedCommunes = new Set();
let existingData = {};

if (fs.existsSync(CHECKPOINT_BACKUP)) {
  const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_BACKUP, 'utf-8'));
  existingData = checkpoint.output || {};

  if (existingData.by_commune) {
    Object.keys(existingData.by_commune).forEach(slug => {
      processedCommunes.add(slug);
    });
  }

  console.log(`✅ Found ${processedCommunes.size} already-processed communes`);
  console.log(`   Progress: ${checkpoint.processed?.successful || 0} pairs completed\n`);
} else {
  console.log('⚠️  No existing checkpoint found - will process all communes\n');
}

// Step 2: Load all communes from sitemap
console.log('📂 Loading sitemap...');
const sitemapData = JSON.parse(fs.readFileSync(SITEMAP_FILE, 'utf-8'));

let allCommunes = [];

// Paris arrondissements
if (sitemapData.organized?.tier_b?.paris) {
  allCommunes = allCommunes.concat(sitemapData.organized.tier_b.paris);
}

// Tier C communes (by department)
if (sitemapData.organized?.tier_c_by_dept) {
  Object.values(sitemapData.organized.tier_c_by_dept).forEach(deptCommunes => {
    if (Array.isArray(deptCommunes)) {
      allCommunes = allCommunes.concat(deptCommunes);
    }
    }
  });
}

// Tier D communes (by department)
if (sitemapData.organized?.tier_d_by_dept) {
  Object.values(sitemapData.organized.tier_d_by_dept).forEach(deptCommunes => {
    if (Array.isArray(deptCommunes)) {
      allCommunes = allCommunes.concat(deptCommunes);
    }
    }
  });
}

// Add slug field to all communes
allCommunes = allCommunes.map(c => ({
  ...c,
  slug: c.url_path.replace(/^\//, '').replace(/\/$/, '')
}));

console.log(`✅ Found ${allCommunes.length} total communes in sitemap\n`);

// Step 3: Filter out already-processed communes
const remainingCommunes = allCommunes.filter(commune => {
  return !processedCommunes.has(commune.slug);
});

console.log('📊 Status:');
console.log(`   Total communes: ${allCommunes.length}`);
console.log(`   Already processed: ${processedCommunes.size}`);
console.log(`   Remaining: ${remainingCommunes.length}\n`);

if (remainingCommunes.length === 0) {
  console.log('✅ All communes already processed!');
  console.log('   Run merge script to create final output.\n');
  process.exit(0);
}

// Step 4: Split remaining communes into batches
const batches = [];
for (let i = 0; i < remainingCommunes.length; i += BATCH_SIZE) {
  batches.push(remainingCommunes.slice(i, i + BATCH_SIZE));
}

console.log(`🚀 Creating ${batches.length} batches of ~${BATCH_SIZE} communes each\n`);

// Step 5: Create log directory
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Clean old logs
if (fs.existsSync(LOG_DIR)) {
  const oldLogs = fs.readdirSync(LOG_DIR);
  oldLogs.forEach(file => {
    fs.unlinkSync(path.join(LOG_DIR, file));
  });
}

// Step 6: Launch all batches
console.log('========================================');
console.log('Launching batches...');
console.log('========================================\n');

const startTime = Date.now();

batches.forEach((batchCommunes, idx) => {
  const batchNum = idx + 1;
  const firstCommune = batchCommunes[0].city_name;
  const lastCommune = batchCommunes[batchCommunes.length - 1].city_name;
  const dept = batchCommunes[0].department;

  // Create a list of slugs for this batch
  const slugs = batchCommunes.map(c => c.slug).join(',');

  // Create temp file with commune slugs for this batch
  const slugsFile = path.join(LOG_DIR, `batch-${batchNum}-slugs.txt`);
  fs.writeFileSync(slugsFile, batchCommunes.map(c => c.slug).join('\n'));

  const logFile = path.join(LOG_DIR, `batch-${batchNum}.log`);
  const pidFile = path.join(LOG_DIR, `batch-${batchNum}.pid`);
  const checkpointFile = `checkpoint-batch-${batchNum}.json`;

  console.log(`Batch ${batchNum}: Dept ${dept}, ${batchCommunes.length} communes (${firstCommune} → ${lastCommune})`);

  // Launch the batch
  const cmd = `node scripts/enhance-electrician-cards.cjs --slugs-file="${slugsFile}" --checkpoint="${checkpointFile}" --parallel > "${logFile}" 2>&1 & echo $!`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Batch ${batchNum} failed to launch: ${error.message}`);
      return;
    }
    const pid = stdout.trim();
    fs.writeFileSync(pidFile, pid);
  });

  // Small delay between launches
  if (batchNum < batches.length) {
    require('child_process').execSync('sleep 1');
  }
});

console.log('\n========================================');
console.log(`✅ All ${batches.length} batches launched!`);
console.log('========================================\n');

console.log('📊 Monitoring:');
console.log(`   Watch: watch -n 5 "ls -lh ${LOG_DIR}/*.log | wc -l && tail -1 ${LOG_DIR}/batch-*.log"`);
console.log(`   Logs: ls -lh ${LOG_DIR}/`);
console.log(`   Follow: tail -f ${LOG_DIR}/batch-1.log`);
console.log('');

console.log('⏱️  Estimated completion: 15-20 minutes');
console.log('');

console.log('📝 Next steps:');
console.log('   1. Wait for all batches to complete');
console.log('   2. Run: node scripts/merge-all-checkpoints.cjs');
console.log('   3. Check: data/electrician_commune_context.json');
console.log('');
