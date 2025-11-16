#!/usr/bin/env node

/**
 * Coordinator - Spawns and manages parallel workers
 * Monitors progress and handles failures
 */

const { spawn } = require('child_process');
const fs = require('fs');
const { getManifestStatus, findStaleBatches, resetBatch } = require('./utils/manifest.cjs');

// Parse command line arguments
const args = {
  WORKERS: parseInt(process.argv.find(arg => arg.startsWith('--workers='))?.split('=')[1]) || 3,
  MONITOR_INTERVAL: parseInt(process.argv.find(arg => arg.startsWith('--monitor='))?.split('=')[1]) || 10000
};

const workers = [];
let monitorInterval;

/**
 * Spawn a single worker process
 */
function spawnWorker(workerId) {
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const worker = spawn('node', ['scripts/parallel-worker.cjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WORKER_ID: workerId }
  });

  const logFile = fs.createWriteStream(`${logDir}/worker-${worker.pid}.log`);
  const errFile = fs.createWriteStream(`${logDir}/worker-${worker.pid}.error.log`);

  worker.stdout.pipe(logFile);
  worker.stderr.pipe(errFile);

  worker.on('exit', (code, signal) => {
    if (code === 0) {
      console.log(`✅ Worker ${worker.pid} exited successfully`);
    } else {
      console.log(`⚠️  Worker ${worker.pid} exited with code ${code}, signal ${signal}`);
    }

    // Remove from workers list
    const index = workers.indexOf(worker);
    if (index > -1) {
      workers.splice(index, 1);
    }
  });

  console.log(`🚀 Spawned worker ${workerId} (PID: ${worker.pid})`);
  return worker;
}

/**
 * Monitor progress and display status
 */
function displayStatus() {
  const status = getManifestStatus();

  if (!status) {
    console.error('❌ Failed to read manifest');
    return;
  }

  const percent = ((status.completed / status.total) * 100).toFixed(1);
  const activeWorkers = workers.length;

  console.clear();
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PARALLEL PROCESSING STATUS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📊 Progress: ${status.completed}/${status.total} batches (${percent}%)`);
  console.log(`\n🔄 Status Breakdown:`);
  console.log(`   ✅ Completed:    ${status.completed}`);
  console.log(`   🔄 In Progress:  ${status.in_progress}`);
  console.log(`   ⏳ Pending:      ${status.pending}`);
  console.log(`\n👷 Active Workers: ${activeWorkers}/${args.WORKERS}`);

  if (status.completed === status.total) {
    console.log(`\n✅ ALL BATCHES COMPLETE!`);
    return true; // Signal completion
  }

  return false;
}

/**
 * Check for and reset stale batches
 */
function checkStaleBatches() {
  const staleBatches = findStaleBatches(2); // 2 hours timeout

  if (staleBatches.length > 0) {
    console.log(`\n⚠️  Found ${staleBatches.length} stale batches:`);

    staleBatches.forEach(batchId => {
      console.log(`   Resetting batch ${batchId}...`);
      resetBatch(batchId);
    });
  }
}

/**
 * Main coordinator function
 */
async function main() {
  console.log('\n🎯 Starting Coordinator\n');

  // Check for manifest
  if (!fs.existsSync('work-manifest.json')) {
    console.error('❌ work-manifest.json not found!');
    console.error('   Run: node scripts/generate-work-manifest.cjs');
    process.exit(1);
  }

  // Display initial status
  console.log('📋 Initial status:');
  const initialStatus = getManifestStatus();
  console.log(`   Total batches: ${initialStatus.total}`);
  console.log(`   Completed: ${initialStatus.completed}`);
  console.log(`   Remaining: ${initialStatus.pending + initialStatus.in_progress}\n`);

  if (initialStatus.completed === initialStatus.total) {
    console.log('✅ All batches already complete!');
    process.exit(0);
  }

  // Spawn workers
  console.log(`🚀 Spawning ${args.WORKERS} workers...\n`);
  for (let i = 0; i < args.WORKERS; i++) {
    const worker = spawnWorker(i + 1);
    workers.push(worker);
  }

  // Start monitoring
  monitorInterval = setInterval(() => {
    const complete = displayStatus();

    if (complete) {
      // All done!
      clearInterval(monitorInterval);

      console.log('\n🎉 All batches processed!');
      console.log('\nNext steps:');
      console.log('  1. Run merge script: node scripts/merge-checkpoints.cjs');
      console.log('  2. Validate output: node scripts/validate-output.cjs');
      console.log('  3. Deploy to production\n');

      // Give workers time to exit gracefully
      setTimeout(() => {
        workers.forEach(w => w.kill('SIGTERM'));
        process.exit(0);
      }, 5000);
    }

    // Check for stale batches every 5 minutes
    if (Date.now() % (5 * 60 * 1000) < args.MONITOR_INTERVAL) {
      checkStaleBatches();
    }

  }, args.MONITOR_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Coordinator received SIGINT, shutting down...');

  clearInterval(monitorInterval);

  console.log('🛑 Stopping workers...');
  workers.forEach(worker => {
    worker.kill('SIGTERM');
  });

  setTimeout(() => {
    console.log('👋 Coordinator exiting');
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Coordinator received SIGTERM, shutting down...');

  clearInterval(monitorInterval);

  workers.forEach(worker => {
    worker.kill('SIGTERM');
  });

  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

// Start coordinator
main().catch(err => {
  console.error('\n💥 Coordinator fatal error:', err);
  process.exit(1);
});
