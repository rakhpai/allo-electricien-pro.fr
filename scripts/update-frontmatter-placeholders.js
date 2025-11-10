const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

console.log('=== UPDATE FRONTMATTER WITH PLACEHOLDER IMAGES ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 10 : null;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only update ${TEST_LIMIT} pages\n`);
}

/**
 * Update frontmatter to use default placeholder images
 */
function updateFrontmatter(filePath, slug) {
  // Read file
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(content);

  // Check if already using placeholders
  const currentHero = parsed.data.images?.hero;
  if (currentHero && currentHero.startsWith('default-electricien')) {
    return { updated: false, reason: 'already_placeholder' };
  }

  // Update images to use default placeholders
  parsed.data.images = {
    hero: 'default-electricien-hero',
    og: 'default-electricien-og',
    featured: 'default-electricien-featured',
    video: 'default-electricien-video'
  };

  // Convert back to markdown with frontmatter
  const newContent = matter.stringify(parsed.content, parsed.data);

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }

  return { updated: true, reason: 'placeholder_set' };
}

/**
 * Main function
 */
async function updatePages() {
  const stats = {
    pages_total: 0,
    pages_needing_update: 0,
    pages_updated: 0,
    pages_skipped: 0,
    pages_already_placeholder: 0,
    pages_not_found: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: LOAD VALIDATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const reportPath = path.join(__dirname, '..', 'image-validation-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ image-validation-report.json not found');
    console.error('   Run validation script first: node scripts/validate-page-images.js');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const validationResults = report.full_validation_results;

  // Filter pages that need updates (no images or partial images)
  const pagesNeedingUpdate = validationResults.filter(v =>
    v.has_no_images || v.has_partial_images
  );

  stats.pages_total = validationResults.length;
  stats.pages_needing_update = pagesNeedingUpdate.length;

  console.log(`✓ Loaded validation report`);
  console.log(`  Total pages: ${stats.pages_total}`);
  console.log(`  Pages needing placeholder images: ${stats.pages_needing_update}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: UPDATE FRONTMATTER FOR PAGES WITHOUT IMAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const contentDir = path.join(__dirname, '..', 'content');

  // Limit in test mode
  const pagesToUpdate = TEST_MODE ? pagesNeedingUpdate.slice(0, TEST_LIMIT) : pagesNeedingUpdate;

  for (const page of pagesToUpdate) {
    const slug = page.slug;

    // Skip homepage for now (different structure)
    if (!slug || slug === 'homepage' || page.url_path === '/') {
      stats.pages_skipped++;
      if (stats.pages_updated <= 10) {
        console.log(`  ⊘ Skipping homepage`);
      }
      continue;
    }

    // Construct file path
    const filePath = path.join(contentDir, slug, 'index.md');

    if (!fs.existsSync(filePath)) {
      stats.pages_not_found++;
      if (stats.pages_updated <= 10) {
        console.log(`  ⚠️  File not found: ${slug}/index.md`);
      }
      continue;
    }

    try {
      const result = updateFrontmatter(filePath, slug);

      if (result.updated) {
        stats.pages_updated++;
        if (stats.pages_updated <= 10 || stats.pages_updated % 100 === 0) {
          console.log(`  ✓ ${slug}`);
        }
      } else if (result.reason === 'already_placeholder') {
        stats.pages_already_placeholder++;
        if (stats.pages_updated <= 10) {
          console.log(`  ⊘ ${slug} (already using placeholders)`);
        }
      } else {
        stats.pages_skipped++;
      }

    } catch (error) {
      stats.errors.push({
        slug: slug,
        file: `${slug}/index.md`,
        error: error.message
      });

      if (stats.errors.length <= 5) {
        console.log(`  ❌ ${slug}: ${error.message}`);
      }
    }

    // Progress update
    if ((stats.pages_updated + stats.pages_skipped) % 200 === 0) {
      const processed = stats.pages_updated + stats.pages_skipped + stats.pages_already_placeholder;
      const progress = ((processed / pagesToUpdate.length) * 100).toFixed(1);
      console.log(`  Progress: ${processed}/${pagesToUpdate.length} pages (${progress}%)`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPDATE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total pages:               ${stats.pages_total}`);
  console.log(`  Pages needing update:      ${stats.pages_needing_update}`);
  console.log(`  Pages updated:             ${stats.pages_updated}`);
  console.log(`  Already using placeholders: ${stats.pages_already_placeholder}`);
  console.log(`  Pages skipped:             ${stats.pages_skipped}`);
  console.log(`  Files not found:           ${stats.pages_not_found}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.slug} (${err.file}): ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'frontmatter-update-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: frontmatter-update-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to update files');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to update all pages');
  }

  // Save update summary
  const summaryPath = path.join(__dirname, '..', 'frontmatter-update-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    stats: stats,
    placeholder_images: {
      hero: 'default-electricien-hero',
      og: 'default-electricien-og',
      featured: 'default-electricien-featured',
      video: 'default-electricien-video'
    }
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Update summary saved to: frontmatter-update-summary.json\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1. Create placeholder images (see PLACEHOLDER_IMAGES_SPEC.md)');
  console.log('   Required: 12 files (4 types × 3 formats)');
  console.log('');
  console.log('2. Place images in static/images/ directories:');
  console.log('   static/images/hero/default-electricien-hero.{jpg,webp,avif}');
  console.log('   static/images/og/default-electricien-og.{jpg,webp,avif}');
  console.log('   static/images/featured/default-electricien-featured.{jpg,webp,avif}');
  console.log('   static/images/video/default-electricien-video.{jpg,webp,avif}');
  console.log('');
  console.log('3. Test Hugo build:');
  console.log('   hugo server');
  console.log('');
  console.log('4. Verify no 404s for placeholder images');
  console.log('');
  console.log('5. Deploy to production');
  console.log('');
}

// Run update
updatePages().catch(error => {
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
