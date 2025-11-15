#!/usr/bin/env node

/**
 * Merge Parallel Batch Outputs
 * Combines outputs from 12 parallel batches into single file
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const OUTPUT_FILE = path.join(SCRIPT_DIR, '../data/electrician_commune_context.json');
const BATCH_COUNT = 12;

console.log('🔄 Merging batch outputs...\n');

const merged = {
  generated_at: new Date().toISOString(),
  model: 'claude-haiku-4-5-20251001',
  by_commune: {},
  metadata: {
    total_communes: 0,
    total_pairs: 0,
    total_errors: 0,
    cost: {
      input_tokens: 0,
      output_tokens: 0,
      api_calls: 0,
      total_cost_usd: 0
    },
    batches_merged: 0,
    missing_batches: []
  }
};

// Read all checkpoint files
for (let batch = 1; batch <= BATCH_COUNT; batch++) {
  const checkpointFile = path.join(SCRIPT_DIR, `../checkpoint-batch-${batch}.json`);

  if (!fs.existsSync(checkpointFile)) {
    console.log(`⚠️  Missing checkpoint for batch ${batch}`);
    merged.metadata.missing_batches.push(batch);
    continue;
  }

  try {
    const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));

    // Merge commune data
    if (checkpoint.output && checkpoint.output.by_commune) {
      const communeCount = Object.keys(checkpoint.output.by_commune).length;
      Object.assign(merged.by_commune, checkpoint.output.by_commune);
      console.log(`✅ Batch ${batch}: ${communeCount} communes merged`);
    } else {
      console.log(`⚠️  Batch ${batch}: No commune data found`);
    }

    // Aggregate stats
    if (checkpoint.stats) {
      merged.metadata.cost.input_tokens += checkpoint.stats.inputTokens || 0;
      merged.metadata.cost.output_tokens += checkpoint.stats.outputTokens || 0;
      merged.metadata.cost.api_calls += checkpoint.stats.apiCalls || 0;
    }

    if (checkpoint.processed) {
      merged.metadata.total_pairs += checkpoint.processed.successful || 0;
      merged.metadata.total_errors += checkpoint.processed.errors || 0;
    }

    merged.metadata.batches_merged++;

  } catch (err) {
    console.error(`❌ Error reading batch ${batch}:`, err.message);
    merged.metadata.missing_batches.push(batch);
  }
}

// Calculate final cost (Haiku 4.5 pricing: $0.80 per MTok input, $4.00 per MTok output)
const inputCost = (merged.metadata.cost.input_tokens / 1000000) * 0.80;
const outputCost = (merged.metadata.cost.output_tokens / 1000000) * 4.00;
merged.metadata.cost.total_cost_usd = inputCost + outputCost;

// Count communes and pairs
merged.metadata.total_communes = Object.keys(merged.by_commune).length;

// Count actual pairs
let actualPairs = 0;
for (const commune of Object.values(merged.by_commune)) {
  if (commune.electricians) {
    actualPairs += Object.keys(commune.electricians).length;
  }
}

// Save merged output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 MERGE SUMMARY');
console.log('='.repeat(60));
console.log(`Batches merged: ${merged.metadata.batches_merged}/${BATCH_COUNT}`);
console.log(`Total communes: ${merged.metadata.total_communes} (expected: 1,298)`);
console.log(`Electrician pairs: ${actualPairs} (from processed: ${merged.metadata.total_pairs})`);
console.log(`Errors: ${merged.metadata.total_errors}`);
console.log(`API calls: ${merged.metadata.cost.api_calls.toLocaleString()}`);
console.log(`Input tokens: ${merged.metadata.cost.input_tokens.toLocaleString()}`);
console.log(`Output tokens: ${merged.metadata.cost.output_tokens.toLocaleString()}`);
console.log(`Total cost: $${merged.metadata.cost.total_cost_usd.toFixed(2)}`);
console.log('='.repeat(60));
console.log(`✅ Merged output: ${OUTPUT_FILE}`);

// Validation warnings
console.log('');
if (merged.metadata.total_communes !== 1298) {
  console.log(`⚠️  WARNING: Expected 1,298 communes, got ${merged.metadata.total_communes}`);
  console.log(`   Missing ${1298 - merged.metadata.total_communes} communes`);
}

if (merged.metadata.batches_merged !== BATCH_COUNT) {
  console.log(`⚠️  WARNING: Expected ${BATCH_COUNT} batches, merged ${merged.metadata.batches_merged}`);
  if (merged.metadata.missing_batches.length > 0) {
    console.log(`   Missing batches: ${merged.metadata.missing_batches.join(', ')}`);
  }
}

if (merged.metadata.total_errors > 0) {
  console.log(`⚠️  WARNING: ${merged.metadata.total_errors} errors occurred during processing`);
}

if (merged.metadata.total_communes === 1298 && merged.metadata.batches_merged === BATCH_COUNT && merged.metadata.total_errors === 0) {
  console.log('');
  console.log('🎉 SUCCESS: All batches merged successfully!');
  console.log('✅ All 1,298 communes processed');
  console.log('✅ No errors');
}

console.log('');
