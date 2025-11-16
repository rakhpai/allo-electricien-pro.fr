#!/usr/bin/env node

/**
 * Merge All Checkpoint Files
 *
 * Combines:
 * - Backup checkpoint (if exists)
 * - All batch checkpoint files
 * Into final electrician_commune_context.json
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../data/electrician_commune_context.json');
const BACKUP_FILE = 'checkpoint-BACKUP-20251116-064755.json';

console.log('========================================');
console.log('Merging All Checkpoint Files');
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
    }
  }
};

let filesProcessed = 0;

// Step 1: Load backup checkpoint if exists
if (fs.existsSync(BACKUP_FILE)) {
  console.log(`📂 Loading backup checkpoint...`);
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  
  if (backup.output?.by_commune) {
    Object.assign(merged.by_commune, backup.output.by_commune);
    const communesInBackup = Object.keys(backup.output.by_commune).length;
    console.log(`   ✅ ${communesInBackup} communes from backup`);
    filesProcessed++;
    
    // Add backup stats
    if (backup.stats) {
      merged.metadata.cost.input_tokens += backup.stats.inputTokens || 0;
      merged.metadata.cost.output_tokens += backup.stats.outputTokens || 0;
      merged.metadata.cost.api_calls += backup.stats.apiCalls || 0;
    }
  }
}

// Step 2: Load all batch checkpoint files
console.log('\n📂 Loading batch checkpoints...');

// Find all checkpoint files
const checkpointFiles = fs.readdirSync('.')
  .filter(f => f.startsWith('checkpoint-batch-') && f.endsWith('.json'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/batch-(\d+)/)?.[1] || '0');
    const numB = parseInt(b.match(/batch-(\d+)/)?.[1] || '0');
    return numA - numB;
  });

console.log(`   Found ${checkpointFiles.length} batch checkpoint files\n`);

checkpointFiles.forEach(file => {
  const batchNum = file.match(/batch-(\d+)/)?.[1];
  const checkpoint = JSON.parse(fs.readFileSync(file, 'utf-8'));
  
  if (checkpoint.output?.by_commune) {
    const communesInBatch = Object.keys(checkpoint.output.by_commune).length;
    const pairsInBatch = checkpoint.processed?.successful || 0;
    
    // Merge commune data
    Object.assign(merged.by_commune, checkpoint.output.by_commune);
    
    // Aggregate stats
    if (checkpoint.stats) {
      merged.metadata.cost.input_tokens += checkpoint.stats.inputTokens || 0;
      merged.metadata.cost.output_tokens += checkpoint.stats.outputTokens || 0;
      merged.metadata.cost.api_calls += checkpoint.stats.apiCalls || 0;
    }
    
    console.log(`   Batch ${batchNum}: ${communesInBatch} communes, ${pairsInBatch} pairs`);
    filesProcessed++;
  }
});

// Step 3: Calculate totals
const totalCommunes = Object.keys(merged.by_commune).length;
let totalPairs = 0;

Object.values(merged.by_commune).forEach(commune => {
  if (commune.electricians) {
    totalPairs += Object.keys(commune.electricians).length;
  }
});

merged.metadata.total_communes = totalCommunes;
merged.metadata.total_pairs = totalPairs;

// Calculate final cost (Haiku 4.5 pricing)
const inputCost = (merged.metadata.cost.input_tokens / 1000000) * 0.80;
const outputCost = (merged.metadata.cost.output_tokens / 1000000) * 4.00;
merged.metadata.cost.total_cost_usd = inputCost + outputCost;

// Step 4: Save merged output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));

console.log('\n========================================');
console.log('✅ Merge Complete!');
console.log('========================================');
console.log(`Files processed: ${filesProcessed}`);
console.log(`Total communes: ${totalCommunes}`);
console.log(`Total electrician-commune pairs: ${totalPairs}`);
console.log(`Total cost: $${merged.metadata.cost.total_cost_usd.toFixed(2)}`);
console.log(`\n📄 Output: ${OUTPUT_FILE}`);
console.log('========================================\n');
