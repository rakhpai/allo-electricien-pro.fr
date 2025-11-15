#!/usr/bin/env node

/**
 * Bulk Phone Number Update Script v2 - YAML-Safe
 *
 * Updates all phone numbers across content files to standardize on: 06 44 64 48 24
 * Properly handles YAML frontmatter without breaking structure
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const TARGET_PHONE = '06 44 64 48 24';
const TARGET_PHONE_RAW = '0644644824';

// Phone numbers to replace in content
const OLD_PHONES = [
  '01 44 90 11 31',
  '06 44 95 55 55',
  '01 83 64 02 20',
  '06 44 64 09 80',
  '06 44 60 48 30',
  '06 44 64 46 99',
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
 * Split file into frontmatter and content
 */
function splitFile(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: '', content: content, hasFrontmatter: false };
  }
  return {
    frontmatter: match[1],
    content: match[2],
    hasFrontmatter: true
  };
}

/**
 * Update phone numbers in file
 */
function updatePhoneNumbers(filePath) {
  try {
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, content, hasFrontmatter } = splitFile(fileContent);

    if (!hasFrontmatter) {
      // No frontmatter, skip
      stats.filesProcessed++;
      return;
    }

    let modifiedFrontmatter = frontmatter;
    let modifiedContent = content;
    let modified = false;

    // 1. Update phone field in frontmatter (single line)
    const phoneRegex = /^(phone:\s*)(["']?)([^"'\n]+)(["']?)\s*$/m;
    if (phoneRegex.test(modifiedFrontmatter)) {
      const match = modifiedFrontmatter.match(phoneRegex);
      const oldPhone = match[3];

      if (oldPhone !== TARGET_PHONE) {
        modifiedFrontmatter = modifiedFrontmatter.replace(phoneRegex, `$1"${TARGET_PHONE}"`);
        stats.phoneReplacements++;
        modified = true;
      }
    }

    // 2. Update phoneRaw field in frontmatter (single line)
    const phoneRawRegex = /^(phoneRaw:\s*)(["']?)([^"'\n]+)(["']?)\s*$/m;
    if (phoneRawRegex.test(modifiedFrontmatter)) {
      const match = modifiedFrontmatter.match(phoneRawRegex);
      const oldPhoneRaw = match[3];

      if (oldPhoneRaw !== TARGET_PHONE_RAW) {
        modifiedFrontmatter = modifiedFrontmatter.replace(phoneRawRegex, `$1"${TARGET_PHONE_RAW}"`);
        stats.phoneRawReplacements++;
        modified = true;
      }
    }

    // 3. Replace phone numbers in content (markdown body only)
    for (const oldPhone of OLD_PHONES) {
      const escapedOldPhone = oldPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const phoneContentRegex = new RegExp(escapedOldPhone, 'g');

      if (phoneContentRegex.test(modifiedContent)) {
        // Determine replacement based on whether it had emoji
        let replacement = TARGET_PHONE;
        if (oldPhone.startsWith('☎️')) {
          replacement = '☎️ ' + TARGET_PHONE;
        } else if (oldPhone.startsWith('📞')) {
          replacement = '📞 ' + TARGET_PHONE;
        }

        const beforeCount = (modifiedContent.match(phoneContentRegex) || []).length;
        modifiedContent = modifiedContent.replace(phoneContentRegex, replacement);
        stats.contentReplacements += beforeCount;
        modified = true;
      }
    }

    // Only write if content was modified
    if (modified) {
      const newFileContent = `---\n${modifiedFrontmatter}\n---\n${modifiedContent}`;
      fs.writeFileSync(filePath, newFileContent, 'utf-8');
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
  console.log('║  BULK PHONE NUMBER UPDATE v2 - YAML-SAFE             ║');
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
