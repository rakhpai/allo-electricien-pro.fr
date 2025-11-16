#!/usr/bin/env node

/**
 * Merge Checkpoints - Combines all worker checkpoints into final output
 */

const fs = require('fs');
const path = require('path');
const { atomicWriteJSON, readJSON } = require('./utils/atomic-file.cjs');

const CHECKPOINT_DIR = 'checkpoints';
const OUTPUT_FILE = 'data/electrician_commune_context.json';

/**
 * Main merge function
 */
async function main() {
  console.log('\n🔨 Merging checkpoints...\n');

  // Read manifest to get completed batches
  const manifest = readJSON('work-manifest.json');
  if (!manifest) {
    console.error('❌ Failed to read work-manifest.json');
    process.exit(1);
  }

  const completedBatches = manifest.batches.filter(b => b.status === 'completed');

  console.log(`📊 Found ${completedBatches.length} completed batches`);

  if (completedBatches.length === 0) {
    console.error('❌ No completed batches to merge!');
    process.exit(1);
  }

  // Find all checkpoint files
  const checkpointFiles = fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.startsWith('worker-') && f.endsWith('.json'))
    .map(f => path.join(CHECKPOINT_DIR, f));

  console.log(`📁 Found ${checkpointFiles.length} checkpoint files\n`);

  // Initialize merged output
  const merged = {
    by_commune: {},
    metadata: {
      merged_at: new Date().toISOString(),
      total_communes: 0,
      total_pairs: 0,
      total_batches: completedBatches.length,
      total_cost: 0,
      input_tokens: 0,
      output_tokens: 0
    }
  };

  // Merge each checkpoint
  for (const checkpointFile of checkpointFiles) {
    console.log(`📄 Processing: ${path.basename(checkpointFile)}`);

    try {
      const checkpoint = readJSON(checkpointFile);

      if (!checkpoint) {
        console.warn(`   ⚠️  Skipping - failed to read`);
        continue;
      }

      if (!checkpoint.output || !checkpoint.output.by_commune) {
        console.warn(`   ⚠️  Skipping - invalid format`);
        continue;
      }

      // Merge commune data
      const communes = Object.keys(checkpoint.output.by_commune);
      console.log(`   ✅ Merging ${communes.length} communes`);

      Object.assign(merged.by_commune, checkpoint.output.by_commune);

      // Aggregate stats
      if (checkpoint.stats) {
        merged.metadata.total_cost += checkpoint.stats.cost || 0;
        merged.metadata.input_tokens += checkpoint.stats.inputTokens || 0;
        merged.metadata.output_tokens += checkpoint.stats.outputTokens || 0;
      }

    } catch (err) {
      console.error(`   ❌ Error processing ${checkpointFile}:`, err.message);
    }
  }

  // Calculate final stats
  merged.metadata.total_communes = Object.keys(merged.by_commune).length;

  let totalPairs = 0;
  for (const commune of Object.values(merged.by_commune)) {
    if (commune.electricians) {
      totalPairs += Object.keys(commune.electricians).length;
    }
  }
  merged.metadata.total_pairs = totalPairs;

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log('  MERGE SUMMARY');
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`\n📊 Results:`);
  console.log(`   Communes processed: ${merged.metadata.total_communes}`);
  console.log(`   Electrician pairs: ${merged.metadata.total_pairs}`);
  console.log(`   Batches merged: ${completedBatches.length}`);
  console.log(`\n💰 API Usage:`);
  console.log(`   Input tokens: ${merged.metadata.input_tokens.toLocaleString()}`);
  console.log(`   Output tokens: ${merged.metadata.output_tokens.toLocaleString()}`);
  console.log(`   Estimated cost: $${merged.metadata.total_cost.toFixed(2)}`);

  // Save merged output
  console.log(`\n💾 Saving to: ${OUTPUT_FILE}`);
  await atomicWriteJSON(OUTPUT_FILE, merged);

  console.log(`\n✅ Merge complete!`);
  console.log(`\nNext step: node scripts/validate-output.cjs\n`);
}

main().catch(err => {
  console.error('\n💥 Merge failed:', err);
  process.exit(1);
});
