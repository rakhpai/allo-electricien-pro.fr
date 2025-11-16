#!/usr/bin/env node

/**
 * Merge Worker Checkpoint Files
 *
 * Combines all checkpoints/worker-*.json files into final electrician_commune_context.json
 * These files are created by parallel batch processing workers
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../data/electrician_commune_context.json');
const CHECKPOINTS_DIR = path.join(__dirname, '../checkpoints');

console.log('========================================');
console.log('Merging Worker Checkpoint Files');
console.log('========================================\n');

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
    workers_merged: 0,
    source: 'parallel worker checkpoints'
  }
};

let filesProcessed = 0;

// Find all worker checkpoint files
console.log('📂 Loading worker checkpoints...\n');

const checkpointFiles = fs.readdirSync(CHECKPOINTS_DIR)
  .filter(f => f.startsWith('worker-') && f.endsWith('.json'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/batch-(\d+)/)?.[1] || '0');
    const numB = parseInt(b.match(/batch-(\d+)/)?.[1] || '0');
    return numA - numB;
  });

console.log(`   Found ${checkpointFiles.length} worker checkpoint files\n`);

if (checkpointFiles.length === 0) {
  console.error('❌ ERROR: No worker checkpoint files found in checkpoints/');
  process.exit(1);
}

checkpointFiles.forEach(file => {
  const filePath = path.join(CHECKPOINTS_DIR, file);
  const batchNum = file.match(/batch-(\d+)/)?.[1] || '?';

  try {
    const checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (checkpoint.output?.by_commune) {
      const communesInBatch = Object.keys(checkpoint.output.by_commune).length;

      // Count pairs in this batch
      let pairsInBatch = 0;
      Object.values(checkpoint.output.by_commune).forEach(commune => {
        if (commune.electricians) {
          pairsInBatch += Object.keys(commune.electricians).length;
        }
      });

      // Merge commune data (later batches overwrite earlier ones if duplicate keys)
      Object.assign(merged.by_commune, checkpoint.output.by_commune);

      // Aggregate stats
      if (checkpoint.stats) {
        merged.metadata.cost.input_tokens += checkpoint.stats.inputTokens || 0;
        merged.metadata.cost.output_tokens += checkpoint.stats.outputTokens || 0;
        merged.metadata.cost.api_calls += checkpoint.stats.apiCalls || 0;
      }

      if (checkpoint.processed) {
        merged.metadata.total_errors += checkpoint.processed.errors || 0;
      }

      console.log(`   ✅ Batch ${batchNum} (${file}): ${communesInBatch} communes, ${pairsInBatch} pairs`);
      filesProcessed++;
      merged.metadata.workers_merged++;
    } else {
      console.log(`   ⚠️  ${file}: No commune data found`);
    }
  } catch (err) {
    console.error(`   ❌ Error reading ${file}:`, err.message);
  }
});

// Calculate totals
const totalCommunes = Object.keys(merged.by_commune).length;
let totalPairs = 0;

Object.values(merged.by_commune).forEach(commune => {
  if (commune.electricians) {
    totalPairs += Object.keys(commune.electricians).length;
  }
});

merged.metadata.total_communes = totalCommunes;
merged.metadata.total_pairs = totalPairs;

// Calculate final cost (Haiku 4.5 pricing: $0.80 per MTok input, $4.00 per MTok output)
const inputCost = (merged.metadata.cost.input_tokens / 1000000) * 0.80;
const outputCost = (merged.metadata.cost.output_tokens / 1000000) * 4.00;
merged.metadata.cost.total_cost_usd = inputCost + outputCost;

// Save merged output
console.log('\n💾 Writing merged output...');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));

// Print summary
console.log('\n========================================');
console.log('✅ Merge Complete!');
console.log('========================================');
console.log(`Worker files processed: ${filesProcessed}`);
console.log(`Total communes: ${totalCommunes}`);
console.log(`Total electrician-commune pairs: ${totalPairs}`);
console.log(`Errors during processing: ${merged.metadata.total_errors}`);
console.log(`API calls: ${merged.metadata.cost.api_calls.toLocaleString()}`);
console.log(`Input tokens: ${merged.metadata.cost.input_tokens.toLocaleString()}`);
console.log(`Output tokens: ${merged.metadata.cost.output_tokens.toLocaleString()}`);
console.log(`Total cost: $${merged.metadata.cost.total_cost_usd.toFixed(2)}`);
console.log(`\n📄 Output: ${OUTPUT_FILE}`);
console.log('========================================\n');

// Validation
if (totalCommunes < 850) {
  console.log(`⚠️  WARNING: Expected ~885-908 communes, got ${totalCommunes}`);
  console.log(`   Some worker checkpoints may be incomplete`);
}

if (totalPairs < 5000) {
  console.log(`⚠️  WARNING: Expected ~5,000-5,500 pairs, got ${totalPairs}`);
  console.log(`   Data may be incomplete`);
}

if (totalCommunes >= 850 && totalPairs >= 5000) {
  console.log('');
  console.log('🎉 SUCCESS: Data looks complete!');
  console.log(`✅ ${totalCommunes} communes recovered`);
  console.log(`✅ ${totalPairs} electrician-commune pairs`);
}

console.log('');
