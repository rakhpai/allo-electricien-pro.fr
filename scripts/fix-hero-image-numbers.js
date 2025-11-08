/**
 * Fix Hero Image Number Format
 * Removes leading zeros from hero image filenames in frontmatter
 * e.g., "elec-092-hero" → "elec-92-hero"
 */

const fs = require('fs');
const path = require('path');

console.log('=== FIX HERO IMAGE NUMBER FORMAT ===\n');

const contentDir = path.join(__dirname, '..', 'content');
let filesProcessed = 0;
let filesUpdated = 0;
let errors = 0;

/**
 * Remove leading zeros from elec-XXX-hero pattern
 * e.g., "elec-092-hero" → "elec-92-hero"
 */
function removeLeadingZeros(str) {
  return str.replace(/elec-0+(\d+)-hero/g, 'elec-$1-hero')
            .replace(/elec-0+(\d+)-og/g, 'elec-$1-og')
            .replace(/elec-0+(\d+)-featured/g, 'elec-$1-featured');
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Fix hero image numbers
    const updatedContent = removeLeadingZeros(content);

    filesProcessed++;

    // Only write if changed
    if (updatedContent !== originalContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      filesUpdated++;

      // Show first few updates
      if (filesUpdated <= 10) {
        const relativePath = filePath.replace(contentDir + '/', '');
        console.log(`  ✓ Updated: ${relativePath}`);
      }
    }

    // Progress indicator
    if (filesProcessed % 50 === 0) {
      console.log(`  Progress: ${filesProcessed} files processed...`);
    }

  } catch (error) {
    errors++;
    console.error(`  ✗ Error processing ${filePath}: ${error.message}`);
  }
}

/**
 * Recursively find and process all index.md files
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name === 'index.md') {
      processFile(fullPath);
    }
  }
}

// Run the fix
console.log('Processing content files...\n');
processDirectory(contentDir);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ FIX COMPLETE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files updated:   ${filesUpdated}`);
console.log(`Errors:          ${errors}\n`);

if (filesUpdated > 0) {
  console.log('Hero image numbers have been fixed to match actual filenames.');
  console.log('Run "npm run build" to rebuild the site.\n');
}
