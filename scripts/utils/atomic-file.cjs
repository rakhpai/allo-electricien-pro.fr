/**
 * Atomic File Operations Utility
 * Ensures safe file writes with no corruption on crashes
 */

const writeFileAtomic = require('write-file-atomic');
const fs = require('fs');

/**
 * Atomically write data to file
 * Uses temp file + rename strategy for atomic operation
 */
async function atomicWrite(filepath, data) {
  await writeFileAtomic(filepath, data, { encoding: 'utf-8' });
}

/**
 * Atomically write JSON to file with formatting
 */
async function atomicWriteJSON(filepath, obj) {
  const data = JSON.stringify(obj, null, 2);
  await atomicWrite(filepath, data);
}

/**
 * Safely read JSON file with error handling
 */
function readJSON(filepath) {
  if (!fs.existsSync(filepath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filepath}:`, err.message);
    return null;
  }
}

module.exports = {
  atomicWrite,
  atomicWriteJSON,
  readJSON
};
