require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== UPDATE SUPABASE PAGE IMAGES ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 20 : null;
const BATCH_SIZE = 100;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No data will be written to Supabase\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only update ${TEST_LIMIT} pages\n`);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Build update object for a page based on image availability
 */
function buildImageUpdate(page, validation) {
  const update = {
    // Image URLs - set to actual paths or NULL
    featured_image_url: null,
    og_image_url: null,

    // Update data JSONB field with comprehensive image info
    data: {
      ...page.data,

      // Image availability flags
      images_available: validation.has_all_images || validation.has_partial_images,
      has_all_images: validation.has_all_images,
      has_partial_images: validation.has_partial_images,
      has_no_images: validation.has_no_images,

      // Image metadata
      hero_image: null,
      hero_image_url: null,
      video_image: null,
      video_image_url: null,

      // Available image types
      available_image_types: validation.available_types,
      missing_image_types: validation.missing_types,

      // Image formats available
      image_formats: null,

      // Referenced images (from frontmatter)
      images_referenced: validation.references
    }
  };

  // Set URLs for images that exist
  if (validation.availability.featured && validation.availability.featured.exists) {
    update.featured_image_url = validation.availability.featured.basePath;
    update.data.image_formats = validation.availability.featured.formats;
  }

  if (validation.availability.og && validation.availability.og.exists) {
    update.og_image_url = validation.availability.og.basePath;
  }

  if (validation.availability.hero && validation.availability.hero.exists) {
    update.data.hero_image = validation.references.hero;
    update.data.hero_image_url = validation.availability.hero.basePath;
  }

  if (validation.availability.video && validation.availability.video.exists) {
    update.data.video_image = validation.references.video;
    update.data.video_image_url = validation.availability.video.basePath;
  }

  return update;
}

/**
 * Main update function
 */
async function updatePageImages() {
  const stats = {
    pages_in_supabase: 0,
    pages_matched: 0,
    pages_updated: 0,
    pages_failed: 0,
    pages_with_images_set: 0,
    pages_with_images_null: 0,
    batches_processed: 0,
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

  console.log(`✓ Loaded validation report`);
  console.log(`  Total validated pages: ${validationResults.length}`);
  console.log(`  With images: ${report.summary.pages_with_all_images + report.summary.pages_with_partial_images}`);
  console.log(`  Without images: ${report.summary.pages_with_no_images}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: GET DOMAIN ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', 'allo-electricien.pro')
    .limit(1);

  if (domainsError || !domains || domains.length === 0) {
    console.error('❌ Could not find allo-electricien.pro domain');
    process.exit(1);
  }

  const domainId = domains[0].id;
  console.log(`✓ Found domain: ${domains[0].domain} (${domainId})\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: FETCH PAGES FROM SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch all pages for this domain
  let pages = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error: pagesError } = await supabase
      .from('pages')
      .select('id, url_path, data, featured_image_url, og_image_url')
      .eq('domain_id', domainId)
      .order('url_path')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pagesError) {
      console.error('❌ Error fetching pages:', pagesError.message);
      process.exit(1);
    }

    if (pageData && pageData.length > 0) {
      pages = pages.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
      console.log(`  Fetched page ${page}: ${pageData.length} pages (total: ${pages.length})`);
    } else {
      hasMore = false;
    }
  }

  stats.pages_in_supabase = pages.length;
  console.log(`\n✓ Loaded ${pages.length} pages from Supabase\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: MATCH AND UPDATE PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Build validation lookup by url_path
  const validationLookup = {};
  validationResults.forEach(v => {
    validationLookup[v.url_path] = v;
  });

  // Limit pages in test mode
  const pagesToUpdate = TEST_MODE ? pages.slice(0, TEST_LIMIT) : pages;

  // Prepare updates
  const updates = [];

  for (const page of pagesToUpdate) {
    const validation = validationLookup[page.url_path];

    if (!validation) {
      console.log(`  ⚠️  No validation data for: ${page.url_path}`);
      continue;
    }

    stats.pages_matched++;

    const update = buildImageUpdate(page, validation);

    updates.push({
      id: page.id,
      update: update
    });

    if (update.featured_image_url || update.og_image_url) {
      stats.pages_with_images_set++;
    } else {
      stats.pages_with_images_null++;
    }
  }

  console.log(`✓ Prepared ${updates.length} updates`);
  console.log(`  Pages with images to set: ${stats.pages_with_images_set}`);
  console.log(`  Pages with NULL images: ${stats.pages_with_images_null}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: APPLY UPDATES TO SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (DRY_RUN) {
    console.log('📝 DRY RUN - Would update pages in Supabase');
    console.log('\nSample update (first page with images):');
    const sampleWithImages = updates.find(u => u.update.featured_image_url);
    if (sampleWithImages) {
      console.log(JSON.stringify(sampleWithImages.update, null, 2));
    }
    console.log('\nSample update (first page without images):');
    const sampleWithoutImages = updates.find(u => !u.update.featured_image_url);
    if (sampleWithoutImages) {
      console.log(JSON.stringify(sampleWithoutImages.update, null, 2));
    }
  } else {
    // Process in batches
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} pages)...`);

      // Update each page in the batch
      for (const { id, update } of batch) {
        const { error } = await supabase
          .from('pages')
          .update(update)
          .eq('id', id);

        if (error) {
          console.error(`  ❌ Failed to update ${id}:`, error.message);
          stats.pages_failed++;
          stats.errors.push({
            id: id,
            error: error.message
          });
        } else {
          stats.pages_updated++;
        }
      }

      console.log(`  ✓ Batch ${batchNum} complete`);
      stats.batches_processed++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPDATE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Pages in Supabase:         ${stats.pages_in_supabase}`);
  console.log(`  Pages matched:             ${stats.pages_matched}`);
  console.log(`  Pages updated:             ${stats.pages_updated}`);
  console.log(`  Pages failed:              ${stats.pages_failed}`);
  console.log(`  Batches processed:         ${stats.batches_processed}`);
  console.log(`  Pages with images set:     ${stats.pages_with_images_set}`);
  console.log(`  Pages with NULL images:    ${stats.pages_with_images_null}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.id}: ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'image-update-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: image-update-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to update Supabase');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to update all pages');
  }

  // Save update summary
  const summaryPath = path.join(__dirname, '..', 'image-update-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    domain_id: domainId,
    stats: stats
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Update summary saved to: image-update-summary.json\n`);
}

// Run update
updatePageImages().catch(error => {
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
