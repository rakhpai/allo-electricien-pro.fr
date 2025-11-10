require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== VALIDATE PAGE IMAGES ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 20 : null;

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only validate ${TEST_LIMIT} pages\n`);
}

/**
 * Check if an image file exists in any format
 * Returns object with format availability
 */
function checkImageExists(basePath, imageName, imageType) {
  const formats = ['jpg', 'webp', 'avif'];
  const availability = {
    exists: false,
    formats: [],
    basePath: null
  };

  for (const format of formats) {
    const imagePath = path.join(basePath, imageType, `${imageName}.${format}`);
    if (fs.existsSync(imagePath)) {
      availability.exists = true;
      availability.formats.push(format);
      if (!availability.basePath) {
        availability.basePath = `/images/${imageType}/${imageName}.${format}`;
      }
    }
  }

  return availability;
}

/**
 * Validate all images for a page
 */
function validatePageImages(page, staticPath) {
  const validation = {
    slug: page.slug || 'homepage',
    url_path: page.url_path,

    // Image references from frontmatter
    references: {
      hero: page.images?.hero || page.hero_image || null,
      og: page.images?.og || null,
      featured: page.images?.featured || null,
      video: page.images?.video || page.video_image || null
    },

    // Actual availability
    availability: {
      hero: null,
      og: null,
      featured: null,
      video: null
    },

    // Summary
    has_all_images: false,
    has_partial_images: false,
    has_no_images: false,
    missing_types: [],
    available_types: []
  };

  // Check each image type
  const imageTypes = ['hero', 'og', 'featured', 'video'];

  for (const type of imageTypes) {
    const imageName = validation.references[type];

    if (imageName) {
      validation.availability[type] = checkImageExists(staticPath, imageName, type);

      if (validation.availability[type].exists) {
        validation.available_types.push(type);
      } else {
        validation.missing_types.push(type);
      }
    } else {
      validation.missing_types.push(type);
      validation.availability[type] = { exists: false, formats: [], basePath: null };
    }
  }

  // Determine status
  const availableCount = validation.available_types.length;

  if (availableCount === 4) {
    validation.has_all_images = true;
  } else if (availableCount > 0) {
    validation.has_partial_images = true;
  } else {
    validation.has_no_images = true;
  }

  return validation;
}

/**
 * Load and parse 404 CSV files
 */
function load404Data() {
  const csv404 = {
    hero_404s: [],
    no_hero_inlinks: []
  };

  // Load 404_heros.csv
  const heroFile = path.join(__dirname, '..', '404_heros.csv');
  if (fs.existsSync(heroFile)) {
    const content = fs.readFileSync(heroFile, 'utf8');
    const lines = content.split('\n').slice(1); // Skip header
    csv404.hero_404s = lines
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(',');
        return {
          url: parts[0] || '',
          image_url: parts[1] || '',
          section: parts[2] || ''
        };
      });
  }

  // Load no_hero_1inlinks.csv
  const noHeroFile = path.join(__dirname, '..', 'no_hero_1inlinks.csv');
  if (fs.existsSync(noHeroFile)) {
    const content = fs.readFileSync(noHeroFile, 'utf8');
    const lines = content.split('\n').slice(1); // Skip header
    csv404.no_hero_inlinks = lines
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(',');
        return {
          url: parts[0] || '',
          image_url: parts[1] || ''
        };
      });
  }

  return csv404;
}

/**
 * Main validation function
 */
async function validateImages() {
  const stats = {
    pages_total: 0,
    pages_validated: 0,
    pages_with_all_images: 0,
    pages_with_partial_images: 0,
    pages_with_no_images: 0,

    images_total_referenced: 0,
    images_exist: 0,
    images_missing: 0,

    by_type: {
      hero: { referenced: 0, exist: 0, missing: 0 },
      og: { referenced: 0, exist: 0, missing: 0 },
      featured: { referenced: 0, exist: 0, missing: 0 },
      video: { referenced: 0, exist: 0, missing: 0 }
    },

    csv_404_hero_count: 0,
    csv_no_hero_inlinks_count: 0
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: LOAD 404 CSV DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const csv404 = load404Data();
  stats.csv_404_hero_count = csv404.hero_404s.length;
  stats.csv_no_hero_inlinks_count = csv404.no_hero_inlinks.length;

  console.log(`✓ Loaded 404_heros.csv: ${stats.csv_404_hero_count} entries`);
  console.log(`✓ Loaded no_hero_1inlinks.csv: ${stats.csv_no_hero_inlinks_count} entries\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: LOAD EXTRACTED PAGES DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const dataPath = path.join(__dirname, '..', 'data', 'extracted-pages.json');

  if (!fs.existsSync(dataPath)) {
    console.error('❌ extracted-pages.json not found');
    process.exit(1);
  }

  const pages = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  stats.pages_total = pages.length;

  console.log(`✓ Loaded ${stats.pages_total} pages\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: VALIDATE IMAGES FOR EACH PAGE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const staticPath = path.join(__dirname, '..', 'static', 'images');

  if (!fs.existsSync(staticPath)) {
    console.error('❌ Static images directory not found:', staticPath);
    process.exit(1);
  }

  const pagesToValidate = TEST_MODE ? pages.slice(0, TEST_LIMIT) : pages;
  const validationResults = [];

  const categorized = {
    all_images: [],
    partial_images: [],
    no_images: [],
    missing_hero_only: [],
    missing_all_except_hero: []
  };

  for (const page of pagesToValidate) {
    const validation = validatePageImages(page, staticPath);
    validationResults.push(validation);
    stats.pages_validated++;

    // Update statistics
    if (validation.has_all_images) {
      stats.pages_with_all_images++;
      categorized.all_images.push(validation);
    } else if (validation.has_partial_images) {
      stats.pages_with_partial_images++;
      categorized.partial_images.push(validation);
    } else {
      stats.pages_with_no_images++;
      categorized.no_images.push(validation);
    }

    // Track by type
    ['hero', 'og', 'featured', 'video'].forEach(type => {
      if (validation.references[type]) {
        stats.by_type[type].referenced++;

        if (validation.availability[type].exists) {
          stats.by_type[type].exist++;
          stats.images_exist++;
        } else {
          stats.by_type[type].missing++;
          stats.images_missing++;
        }

        stats.images_total_referenced++;
      }
    });

    // Special categories
    if (validation.missing_types.includes('hero') && validation.available_types.length > 0) {
      categorized.missing_hero_only.push(validation);
    }

    // Progress logging
    if (stats.pages_validated <= 10 || stats.pages_validated % 100 === 0) {
      const status = validation.has_all_images ? '✓ ALL' :
                     validation.has_partial_images ? '⚠ PARTIAL' :
                     '✗ NONE';
      console.log(`  ${status} ${validation.slug} (${validation.available_types.join(', ') || 'no images'})`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: GENERATE REPORTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Comprehensive report
  const report = {
    timestamp: new Date().toISOString(),
    summary: stats,
    categorized: {
      all_images: categorized.all_images.map(v => ({ slug: v.slug, url: v.url_path })),
      partial_images: categorized.partial_images.map(v => ({
        slug: v.slug,
        url: v.url_path,
        available: v.available_types,
        missing: v.missing_types
      })),
      no_images: categorized.no_images.map(v => ({ slug: v.slug, url: v.url_path }))
    },
    csv_404_comparison: {
      hero_404s_csv: stats.csv_404_hero_count,
      hero_missing_validated: stats.by_type.hero.missing,
      match: stats.csv_404_hero_count === stats.by_type.hero.missing
    },
    full_validation_results: validationResults
  };

  const reportPath = path.join(__dirname, '..', 'image-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✓ Saved full report: image-validation-report.json\n`);

  // Missing images list
  const missingImagesList = {
    by_type: {
      hero: [],
      og: [],
      featured: [],
      video: []
    },
    summary: {
      total_missing: stats.images_missing,
      hero: stats.by_type.hero.missing,
      og: stats.by_type.og.missing,
      featured: stats.by_type.featured.missing,
      video: stats.by_type.video.missing
    }
  };

  validationResults.forEach(v => {
    ['hero', 'og', 'featured', 'video'].forEach(type => {
      if (v.references[type] && !v.availability[type].exists) {
        missingImagesList.by_type[type].push({
          slug: v.slug,
          image_name: v.references[type],
          url: v.url_path
        });
      }
    });
  });

  const missingPath = path.join(__dirname, '..', 'missing-images-list.json');
  fs.writeFileSync(missingPath, JSON.stringify(missingImagesList, null, 2));
  console.log(`✓ Saved missing images list: missing-images-list.json\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VALIDATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📊 SUMMARY STATISTICS:\n');
  console.log(`Pages:`);
  console.log(`  Total validated:           ${stats.pages_validated}`);
  console.log(`  With ALL images (4/4):     ${stats.pages_with_all_images} (${(stats.pages_with_all_images/stats.pages_validated*100).toFixed(1)}%)`);
  console.log(`  With PARTIAL images:       ${stats.pages_with_partial_images} (${(stats.pages_with_partial_images/stats.pages_validated*100).toFixed(1)}%)`);
  console.log(`  With NO images (0/4):      ${stats.pages_with_no_images} (${(stats.pages_with_no_images/stats.pages_validated*100).toFixed(1)}%)`);
  console.log('');

  console.log(`Images by Type:`);
  ['hero', 'og', 'featured', 'video'].forEach(type => {
    const ref = stats.by_type[type].referenced;
    const exist = stats.by_type[type].exist;
    const missing = stats.by_type[type].missing;
    const coverage = ref > 0 ? (exist/ref*100).toFixed(1) : '0.0';
    console.log(`  ${type.padEnd(10)} Referenced: ${ref.toString().padStart(4)}  |  Exist: ${exist.toString().padStart(4)}  |  Missing: ${missing.toString().padStart(4)}  |  Coverage: ${coverage}%`);
  });
  console.log('');

  console.log(`Total Images:`);
  console.log(`  Referenced:                ${stats.images_total_referenced}`);
  console.log(`  Exist:                     ${stats.images_exist} (${(stats.images_exist/stats.images_total_referenced*100).toFixed(1)}%)`);
  console.log(`  Missing:                   ${stats.images_missing} (${(stats.images_missing/stats.images_total_referenced*100).toFixed(1)}%)`);
  console.log('');

  console.log(`CSV 404 Comparison:`);
  console.log(`  404_heros.csv entries:     ${stats.csv_404_hero_count}`);
  console.log(`  no_hero_1inlinks.csv:      ${stats.csv_no_hero_inlinks_count}`);
  console.log(`  Total CSV 404s:            ${stats.csv_404_hero_count + stats.csv_no_hero_inlinks_count}`);
  console.log(`  Validated hero missing:    ${stats.by_type.hero.missing}`);
  console.log(`  Match:                     ${stats.csv_404_hero_count + stats.csv_no_hero_inlinks_count === stats.by_type.hero.missing ? '✓ Yes' : '✗ No'}`);
  console.log('');

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to validate all pages');
  }
}

// Run validation
validateImages().catch(error => {
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
