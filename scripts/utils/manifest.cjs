/**
 * Work Manifest Management with File Locking
 * Coordinates work distribution across parallel workers
 */

const lockfile = require('proper-lockfile');
const { atomicWriteJSON, readJSON } = require('./atomic-file.cjs');

const MANIFEST_FILE = 'work-manifest.json';

/**
 * Claim the next available batch from the manifest
 * Uses file locking to prevent race conditions
 * @returns {Object|null} Claimed batch or null if no work available
 */
async function claimNextBatch() {
  let release;

  try {
    // Acquire lock with retries
    release = await lockfile.lock(MANIFEST_FILE, {
      retries: {
        retries: 20,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 2000
      }
    });

    // Read manifest
    const manifest = readJSON(MANIFEST_FILE);
    if (!manifest) {
      console.error('Failed to read manifest');
      return null;
    }

    // Find first pending batch
    const batch = manifest.batches.find(b => b.status === 'pending');

    if (batch) {
      // Claim it
      batch.status = 'in_progress';
      batch.worker_pid = process.pid;
      batch.started_at = new Date().toISOString();

      // Save updated manifest
      await atomicWriteJSON(MANIFEST_FILE, manifest);

      console.log(`Worker ${process.pid} claimed batch ${batch.id}`);
    }

    return batch;

  } catch (err) {
    console.error('Error claiming batch:', err.message);
    return null;
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Mark a batch as completed
 * @param {number} batchId - ID of the batch to mark complete
 */
async function markBatchComplete(batchId) {
  let release;

  try {
    release = await lockfile.lock(MANIFEST_FILE, {
      retries: {
        retries: 20,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 2000
      }
    });

    const manifest = readJSON(MANIFEST_FILE);
    const batch = manifest.batches.find(b => b.id === batchId);

    if (batch) {
      batch.status = 'completed';
      batch.completed_at = new Date().toISOString();

      await atomicWriteJSON(MANIFEST_FILE, manifest);

      console.log(`Batch ${batchId} marked complete`);
    }

  } catch (err) {
    console.error('Error marking batch complete:', err.message);
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Reset a stale batch back to pending status
 * @param {number} batchId - ID of the batch to reset
 */
async function resetBatch(batchId) {
  let release;

  try {
    release = await lockfile.lock(MANIFEST_FILE, {
      retries: {
        retries: 20,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 2000
      }
    });

    const manifest = readJSON(MANIFEST_FILE);
    const batch = manifest.batches.find(b => b.id === batchId);

    if (batch) {
      batch.status = 'pending';
      batch.worker_pid = null;
      batch.started_at = null;

      await atomicWriteJSON(MANIFEST_FILE, manifest);

      console.log(`Batch ${batchId} reset to pending`);
    }

  } catch (err) {
    console.error('Error resetting batch:', err.message);
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Get current manifest status without locking
 * @returns {Object} Status summary
 */
function getManifestStatus() {
  const manifest = readJSON(MANIFEST_FILE);
  if (!manifest) {
    return null;
  }

  const status = {
    pending: manifest.batches.filter(b => b.status === 'pending').length,
    in_progress: manifest.batches.filter(b => b.status === 'in_progress').length,
    completed: manifest.batches.filter(b => b.status === 'completed').length,
    total: manifest.batches.length
  };

  return status;
}

/**
 * Check for stale batches (running too long)
 * @param {number} maxHours - Maximum hours before considering stale
 * @returns {Array} Array of stale batch IDs
 */
function findStaleBatches(maxHours = 2) {
  const manifest = readJSON(MANIFEST_FILE);
  if (!manifest) {
    return [];
  }

  const now = new Date();
  const maxMs = maxHours * 60 * 60 * 1000;

  const stale = manifest.batches
    .filter(b => {
      if (b.status !== 'in_progress') return false;
      const started = new Date(b.started_at);
      return (now - started) > maxMs;
    })
    .map(b => b.id);

  return stale;
}

module.exports = {
  claimNextBatch,
  markBatchComplete,
  resetBatch,
  getManifestStatus,
  findStaleBatches
};
