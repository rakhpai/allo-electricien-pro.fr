#!/usr/bin/env node

/**
 * Bulk Phone Number Update Script
 *
 * Updates all phone numbers across content files to standardize on: 06 44 64 48 24
 * Replaces:
 * - 01 44 90 11 31 → 06 44 64 48 24
 * - 06 44 95 55 55 → 06 44 64 48 24
 * - 01 83 64 02 20 → 06 44 64 48 24
 * - Any other variations → 06 44 64 48 24
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const TARGET_PHONE = '06 44 64 48 24';
const TARGET_PHONE_RAW = '0644644824';

// Phone numbers to replace (in various formats)
const OLD_PHONES = [
  // Format: "XX XX XX XX XX"
  '01 44 90 11 31',
  '06 44 95 55 55',
  '01 83 64 02 20',
  '06 44 64 09 80',
  '06 44 60 48 30',
  '06 44 64 46 99',

  // Raw format (no spaces)
  '0144901131',
  '0644955555',
  '0183640220',
  '0644640980',
  '0644604830',
  '0644644699',

  // Emoji versions
  '☎️ 01 44 90 11 31',
  '☎️ 06 44 95 55 55',
  '📞 01 44 90 11 31',
  '📞 06 44 95 55 55',
];

// Statistics
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  phoneReplacements: 0,
  phoneRawReplacements: 0,
  contentReplacements: 0,
  errors: []
};

/**
 * Update phone numbers in a markdown file
 */
function updatePhoneNumbers(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let modified = false;

    // 1. Update frontmatter phone field
    const phoneRegex = /^phone:\s*["']?([^"'\n]+)["']?\s*$/m;
    if (phoneRegex.test(content)) {
      const match = content.match(phoneRegex);
      const oldPhone = match[1];

      // Check if it's not already the target phone
      if (oldPhone !== TARGET_PHONE) {
        content = content.replace(phoneRegex, `phone: "${TARGET_PHONE}"`);
        stats.phoneReplacements++;
        modified = true;
      }
    }

    // 2. Update frontmatter phoneRaw field
    const phoneRawRegex = /^phoneRaw:\s*["']?([^"'\n]+)["']?\s*$/m;
    if (phoneRawRegex.test(content)) {
      const match = content.match(phoneRawRegex);
      const oldPhoneRaw = match[1];

      // Check if it's not already the target phone raw
      if (oldPhoneRaw !== TARGET_PHONE_RAW) {
        content = content.replace(phoneRawRegex, `phoneRaw: "${TARGET_PHONE_RAW}"`);
        stats.phoneRawReplacements++;
        modified = true;
      }
    }

    // 3. Replace phone numbers in content (both formatted and with emojis)
    for (const oldPhone of OLD_PHONES) {
      const escapedOldPhone = oldPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const phoneContentRegex = new RegExp(escapedOldPhone, 'g');

      if (phoneContentRegex.test(content)) {
        // Determine replacement based on whether it had emoji
        let replacement = TARGET_PHONE;
        if (oldPhone.startsWith('☎️')) {
          replacement = '☎️ ' + TARGET_PHONE;
        } else if (oldPhone.startsWith('📞')) {
          replacement = '📞 ' + TARGET_PHONE;
        }

        const beforeCount = (content.match(phoneContentRegex) || []).length;
        content = content.replace(phoneContentRegex, replacement);
        stats.contentReplacements += beforeCount;
        modified = true;
      }
    }

    // Only write if content was actually modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      stats.filesModified++;
      console.log(`✓ Updated: ${path.relative(process.cwd(), filePath)}`);
    }

    stats.filesProcessed++;

  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  BULK PHONE NUMBER UPDATE - 06 44 64 48 24           ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const contentDir = path.join(__dirname, '../content');

  // Find all index.md files in content directory
  const markdownFiles = glob.sync('**/index.md', {
    cwd: contentDir,
    absolute: true,
    ignore: ['**/node_modules/**']
  });

  console.log(`Found ${markdownFiles.length} markdown files to process...\n`);

  // Process each file
  markdownFiles.forEach((file, index) => {
    if (index % 100 === 0) {
      console.log(`Progress: ${index}/${markdownFiles.length} files...`);
    }
    updatePhoneNumbers(file);
  });

  // Print summary
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  UPDATE SUMMARY                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`📁 Files processed:              ${stats.filesProcessed}`);
  console.log(`✏️  Files modified:                ${stats.filesModified}`);
  console.log(`📞 Frontmatter phone updated:     ${stats.phoneReplacements}`);
  console.log(`🔢 Frontmatter phoneRaw updated:  ${stats.phoneRawReplacements}`);
  console.log(`📝 Content replacements:          ${stats.contentReplacements}`);
  console.log(`❌ Errors:                        ${stats.errors.length}\n`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    stats.errors.forEach(err => {
      console.log(`   ${err.file}: ${err.error}`);
    });
  }

  console.log('\n✅ Phone number standardization complete!\n');
  console.log(`All phone numbers updated to: ${TARGET_PHONE} (${TARGET_PHONE_RAW})\n`);
}

// Run the script
main();
