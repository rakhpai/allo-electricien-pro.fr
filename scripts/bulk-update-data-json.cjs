#!/usr/bin/env node

/**
 * Bulk Update Phone Numbers in Data JSON Files
 *
 * Updates phone numbers in:
 * - data/sites.json
 * - data/electricien_profiles.json
 * - data/extracted-pages.json
 *
 * SKIPS: data/commune_electricians.json (competitor data)
 */

const fs = require('fs');
const path = require('path');

const TARGET_PHONE = '06 44 64 48 24';
const TARGET_PHONE_RAW = '0644644824';
const TARGET_PHONE_HREF = '+33644644824';

let stats = {
  filesProcessed: 0,
  filesModified: 0,
  recordsUpdated: 0,
  errors: []
};

/**
 * Update phone numbers in a JSON file
 */
function updateJSONFile(filePath, updateFn) {
  try {
    console.log(`\nProcessing: ${path.basename(filePath)}...`);

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const updatedData = updateFn(data);

    // Write back to file with 2-space indentation
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');

    stats.filesProcessed++;
    stats.filesModified++;
    console.log(`✓ Updated: ${path.basename(filePath)}`);

  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Update sites.json
 */
function updateSitesJSON(data) {
  let updated = 0;

  if (Array.isArray(data)) {
    data.forEach(site => {
      // Update phone field
      if (site.phone && site.phone !== TARGET_PHONE) {
        site.phone = TARGET_PHONE;
        updated++;
      }

      // Update phoneRaw field
      if (site.phoneRaw && site.phoneRaw !== TARGET_PHONE_RAW) {
        site.phoneRaw = TARGET_PHONE_RAW;
        updated++;
      }
    });
  }

  stats.recordsUpdated += updated;
  console.log(`  → Updated ${updated} phone field(s) in ${data.length} records`);
  return data;
}

/**
 * Update electricien_profiles.json
 */
function updateProfilesJSON(data) {
  let updated = 0;

  if (data && data.profiles && Array.isArray(data.profiles)) {
    data.profiles.forEach(profile => {
      // Update phone_display
      if (profile.phone_display && profile.phone_display !== TARGET_PHONE) {
        profile.phone_display = TARGET_PHONE;
        updated++;
      }

      // Update phone (legacy)
      if (profile.phone && profile.phone !== TARGET_PHONE) {
        profile.phone = TARGET_PHONE;
        updated++;
      }

      // Update phone_href
      if (profile.phone_href && profile.phone_href !== TARGET_PHONE_HREF) {
        profile.phone_href = TARGET_PHONE_HREF;
        updated++;
      }
    });

    console.log(`  → Updated ${updated} phone field(s) in ${data.profiles.length} profiles`);
  }

  stats.recordsUpdated += updated;
  return data;
}

/**
 * Update extracted-pages.json
 */
function updateExtractedJSON(data) {
  let updated = 0;

  if (Array.isArray(data)) {
    data.forEach(page => {
      // Update phone field
      if (page.phone && page.phone !== TARGET_PHONE) {
        page.phone = TARGET_PHONE;
        updated++;
      }

      // Update phone_raw field
      if (page.phone_raw && page.phone_raw !== TARGET_PHONE_RAW) {
        page.phone_raw = TARGET_PHONE_RAW;
        updated++;
      }
    });
  }

  stats.recordsUpdated += updated;
  console.log(`  → Updated ${updated} phone field(s) in ${data.length} records`);
  return data;
}

/**
 * Main execution
 */
function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  DATA JSON FILES PHONE NUMBER UPDATE                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const dataDir = path.join(__dirname, '../data');

  // 1. Update sites.json
  const sitesFile = path.join(dataDir, 'sites.json');
  if (fs.existsSync(sitesFile)) {
    updateJSONFile(sitesFile, updateSitesJSON);
  } else {
    console.log(`⚠️  File not found: sites.json`);
  }

  // 2. Update electricien_profiles.json
  const profilesFile = path.join(dataDir, 'electricien_profiles.json');
  if (fs.existsSync(profilesFile)) {
    updateJSONFile(profilesFile, updateProfilesJSON);
  } else {
    console.log(`⚠️  File not found: electricien_profiles.json`);
  }

  // 3. Update extracted-pages.json
  const extractedFile = path.join(dataDir, 'extracted-pages.json');
  if (fs.existsSync(extractedFile)) {
    updateJSONFile(extractedFile, updateExtractedJSON);
  } else {
    console.log(`⚠️  File not found: extracted-pages.json`);
  }

  // Print summary
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  UPDATE SUMMARY                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`📁 Files processed:        ${stats.filesProcessed}`);
  console.log(`✏️  Files modified:         ${stats.filesModified}`);
  console.log(`📝 Records updated:         ${stats.recordsUpdated}`);
  console.log(`❌ Errors:                 ${stats.errors.length}\n`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    stats.errors.forEach(err => {
      console.log(`   ${err.file}: ${err.error}`);
    });
  }

  console.log('\n✅ Data JSON files updated successfully!\n');
  console.log(`All phone numbers updated to: ${TARGET_PHONE} / ${TARGET_PHONE_HREF}\n`);
}

// Run the script
main();
