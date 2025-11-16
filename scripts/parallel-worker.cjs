#!/usr/bin/env node

/**
 * Parallel Worker for Electrician Card Generation
 * Claims batches from manifest and processes communes with isolated checkpoints
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { claimNextBatch, markBatchComplete } = require('./utils/manifest.cjs');
const { atomicWriteJSON, readJSON } = require('./utils/atomic-file.cjs');

// Constants
const CHECKPOINT_DIR = 'checkpoints';
const DELAY_MS = 2400; // Rate limiting delay

/**
 * Process a single batch by calling enhance-electrician-cards.cjs
 * with isolated checkpoint file
 */
async function processBatch(batch) {
  const batchId = batch.id;
  const communeSlugs = batch.communes;

  console.log(`\n🔨 Worker ${process.pid} processing batch ${batchId}`);
  console.log(`   Communes: ${communeSlugs.length}`);

  // Create isolated checkpoint file for this worker/batch
  const checkpointFile = path.join(CHECKPOINT_DIR, `worker-${process.pid}-batch-${batchId}.json`);

  // Create slugs file for this batch
  const slugsFile = `/tmp/batch-${batchId}-slugs-${process.pid}.txt`;
  fs.writeFileSync(slugsFile, communeSlugs.join('\n'));

  console.log(`   Checkpoint: ${checkpointFile}`);
  console.log(`   Slugs file: ${slugsFile}`);

  // Call enhance-electrician-cards.cjs with batch-specific parameters
  const args = [
    'scripts/enhance-electrician-cards.cjs',
    `--checkpoint=${checkpointFile}`,
    `--slugs-file=${slugsFile}`,
    '--parallel'
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('node', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Stream output in real-time
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Batch ${batchId} completed successfully`);
        resolve({ batchId, checkpointFile, stdout, stderr });
      } else {
        console.error(`❌ Batch ${batchId} failed with code ${code}`);
        console.error(`stderr: ${stderr}`);
        reject(new Error(`Batch ${batchId} failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error(`❌ Error spawning process for batch ${batchId}:`, err);
      reject(err);
    });
  });
}

/**
 * Main worker loop
 */
async function main() {
  console.log(`\n👷 Worker ${process.pid} started`);

  // Ensure checkpoint directory exists
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }

  let batchesProcessed = 0;

  while (true) {
    // Claim next available batch
    const batch = await claimNextBatch();

    if (!batch) {
      console.log(`\n✅ Worker ${process.pid} finished - no more work available`);
      console.log(`   Batches processed: ${batchesProcessed}`);
      break;
    }

    try {
      // Process the batch
      const result = await processBatch(batch);

      // Mark as complete in manifest
      await markBatchComplete(batch.id);

      batchesProcessed++;

      console.log(`\n📊 Worker ${process.pid} progress:`);
      console.log(`   Batches completed: ${batchesProcessed}`);

    } catch (err) {
      console.error(`\n❌ Worker ${process.pid} error processing batch ${batch.id}:`, err.message);
      console.error(`   Batch will remain in 'in_progress' state for coordinator to reset`);

      // Don't mark as complete - let coordinator detect and reset stale batch
      break; // Exit this worker, coordinator will reassign the batch
    }
  }

  console.log(`\n👋 Worker ${process.pid} exiting`);
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n⚠️  Worker ${process.pid} received SIGINT, shutting down...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n⚠️  Worker ${process.pid} received SIGTERM, shutting down...`);
  process.exit(0);
});

// Start worker
main().catch(err => {
  console.error(`\n💥 Worker ${process.pid} fatal error:`, err);
  process.exit(1);
});
