#!/usr/bin/env node

/**
 * Output Validation - Verifies data integrity and completeness
 */

const fs = require('fs');
const { readJSON } = require('./utils/atomic-file.cjs');

const OUTPUT_FILE = 'data/electrician_commune_context.json';

/**
 * Validate the merged output
 */
function main() {
  console.log('\n🔍 Validating output...\n');

  // Read output file
  const data = readJSON(OUTPUT_FILE);
  if (!data) {
    console.error(`❌ Failed to read ${OUTPUT_FILE}`);
    process.exit(1);
  }

  const issues = [];
  const warnings = [];

  // Check basic structure
  if (!data.by_commune) {
    issues.push('Missing "by_commune" field');
  }

  if (!data.metadata) {
    warnings.push('Missing "metadata" field');
  }

  const communes = Object.keys(data.by_commune || {});
  console.log(`📊 Found ${communes.length} communes\n`);

  // Validate each commune
  let totalPairs = 0;
  const communesWithoutElectricians = [];

  for (const [slug, commune] of Object.entries(data.by_commune || {})) {
    // Check for electricians
    if (!commune.electricians || Object.keys(commune.electricians).length === 0) {
      communesWithoutElectricians.push(slug);
      continue;
    }

    const pairs = Object.keys(commune.electricians);
    totalPairs += pairs.length;

    // Validate each pair
    for (const [profileId, context] of Object.entries(commune.electricians)) {
      // Check required fields
      if (!context.bio_localized) {
        issues.push(`${slug}/${profileId}: Missing bio_localized`);
      }
      if (!context.local_badge) {
        issues.push(`${slug}/${profileId}: Missing local_badge`);
      }
      if (!context.service_highlight) {
        issues.push(`${slug}/${profileId}: Missing service_highlight`);
      }
      if (!context.trust_signal) {
        issues.push(`${slug}/${profileId}: Missing trust_signal`);
      }
      if (!context.why_this_commune) {
        issues.push(`${slug}/${profileId}: Missing why_this_commune`);
      }

      // Check for fallback usage
      if (context.used_fallback) {
        warnings.push(`${slug}/${profileId}: Used fallback content`);
      }
    }
  }

  // Check for duplicates
  const slugSet = new Set(communes);
  if (slugSet.size !== communes.length) {
    issues.push(`Duplicate commune slugs detected (${communes.length} total, ${slugSet.size} unique)`);
  }

  // Report findings
  console.log(`═══════════════════════════════════════════════════════`);
  console.log('  VALIDATION REPORT');
  console.log(`═══════════════════════════════════════════════════════`);

  console.log(`\n✅ Summary:`);
  console.log(`   Communes: ${communes.length}`);
  console.log(`   Electrician pairs: ${totalPairs}`);
  console.log(`   Avg pairs per commune: ${(totalPairs / communes.length).toFixed(1)}`);

  if (communesWithoutElectricians.length > 0) {
    console.log(`\n⚠️  Communes without electricians: ${communesWithoutElectricians.length}`);
    if (communesWithoutElectricians.length <= 10) {
      communesWithoutElectricians.forEach(slug => {
        console.log(`     - ${slug}`);
      });
    } else {
      communesWithoutElectricians.slice(0, 10).forEach(slug => {
        console.log(`     - ${slug}`);
      });
      console.log(`     ... and ${communesWithoutElectricians.length - 10} more`);
    }
  }

  if (issues.length > 0) {
    console.log(`\n❌ Issues found: ${issues.length}`);
    issues.slice(0, 20).forEach(issue => {
      console.log(`   - ${issue}`);
    });
    if (issues.length > 20) {
      console.log(`   ... and ${issues.length - 20} more issues`);
    }
  } else {
    console.log(`\n✅ No critical issues found`);
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${warnings.length}`);
    warnings.slice(0, 10).forEach(warning => {
      console.log(`   - ${warning}`);
    });
    if (warnings.length > 10) {
      console.log(`   ... and ${warnings.length - 10} more warnings`);
    }
  }

  // Sample uniqueness check
  console.log(`\n🔬 Sampling content uniqueness...`);
  const sampleSize = Math.min(10, totalPairs);
  const allBios = [];
  const allBadges = [];

  for (const commune of Object.values(data.by_commune || {})) {
    if (!commune.electricians) continue;
    for (const context of Object.values(commune.electricians)) {
      if (context.bio_localized) allBios.push(context.bio_localized);
      if (context.local_badge) allBadges.push(context.local_badge);
    }
  }

  const uniqueBios = new Set(allBios).size;
  const uniqueBadges = new Set(allBadges).size;

  console.log(`   Unique bios: ${uniqueBios}/${allBios.length} (${(uniqueBios/allBios.length*100).toFixed(1)}%)`);
  console.log(`   Unique badges: ${uniqueBadges}/${allBadges.length} (${(uniqueBadges/allBadges.length*100).toFixed(1)}%)`);

  if (uniqueBios / allBios.length < 0.8) {
    warnings.push('Low bio uniqueness - possible template reuse');
  }

  // Final verdict
  console.log(`\n════════════════════════════════════════════════════════`);
  if (issues.length === 0) {
    console.log('✅ VALIDATION PASSED');
    console.log('   Data is ready for deployment');
  } else {
    console.log('❌ VALIDATION FAILED');
    console.log(`   ${issues.length} issues must be resolved`);
  }
  console.log(`════════════════════════════════════════════════════════\n`);

  process.exit(issues.length > 0 ? 1 : 0);
}

main();
