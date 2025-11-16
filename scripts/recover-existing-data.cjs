#!/usr/bin/env node

/**
 * Recover Existing Data from Backup Checkpoints
 * Merges batches 7-8 and 10-11 from previous runs
 */

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON } = require('./utils/atomic-file.cjs');

const BACKUP_DIR = '/tmp/CRITICAL-BACKUP-20251116-103626';
const OUTPUT_FILE = 'data/electrician_commune_context.json';

const checkpointFiles = [
  'checkpoint-batch-7.json',
  'checkpoint-batch-8.json',
  'checkpoint-batch-10-rerun.json',
  'checkpoint-batch-11-rerun.json'
];

async function main() {
  console.log('\n🔄 Recovering existing data from backups...\n');

  const merged = {
    by_commune: {},
    metadata: {
      recovered_at: new Date().toISOString(),
      source: 'backup checkpoints from previous runs',
      total_communes: 0,
      total_pairs: 0
    }
  };

  for (const file of checkpointFiles) {
    const filePath = path.join(BACKUP_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping ${file} - not found`);
      continue;
    }

    console.log(`📄 Processing: ${file}`);

    try {
      const checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (!checkpoint.output || !checkpoint.output.by_commune) {
        console.warn(`   ⚠️  Invalid format, skipping`);
        continue;
      }

      const communes = Object.keys(checkpoint.output.by_commune);
      console.log(`   ✅ Merging ${communes.length} communes`);

      // Merge commune data
      Object.assign(merged.by_commune, checkpoint.output.by_commune);

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  // Calculate stats
  merged.metadata.total_communes = Object.keys(merged.by_commune).length;

  let totalPairs = 0;
  for (const commune of Object.values(merged.by_commune)) {
    if (commune.electricians) {
      totalPairs += Object.keys(commune.electricians).length;
    }
  }
  merged.metadata.total_pairs = totalPairs;

  console.log(`\n📊 Recovery Summary:`);
  console.log(`   Communes: ${merged.metadata.total_communes}`);
  console.log(`   Electrician pairs: ${merged.metadata.total_pairs}`);

  // Save to output file
  console.log(`\n💾 Saving to: ${OUTPUT_FILE}`);
  await atomicWriteJSON(OUTPUT_FILE, merged);

  console.log(`\n✅ Data recovery complete!\n`);
}

main().catch(err => {
  console.error('\n💥 Recovery failed:', err);
  process.exit(1);
});
