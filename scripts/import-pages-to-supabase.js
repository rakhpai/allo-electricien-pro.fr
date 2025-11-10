require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== IMPORT PAGES TO SUPABASE ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 20 : null;
const BATCH_SIZE = 100; // Insert in batches of 100

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No data will be written to Supabase\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only import ${TEST_LIMIT} pages\n`);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get or create domain for allo-electricien.pro
 */
async function getOrCreateDomain() {
  console.log('Getting/creating domain for allo-electricien.pro...');

  // Try to find existing domain
  const { data: existingDomains, error: findError } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', 'allo-electricien.pro')
    .limit(1);

  if (findError) {
    console.log('⚠️  Could not query domains table:', findError.message);
    console.log('   Will proceed without domain_id (may cause issues)\n');
    return null;
  }

  if (existingDomains && existingDomains.length > 0) {
    console.log(`✓ Found existing domain: ${existingDomains[0].domain} (${existingDomains[0].id})\n`);
    return existingDomains[0].id;
  }

  // Domain doesn't exist, try to create it
  console.log('⚠️  Domain not found, attempting to create...');

  const { data: newDomain, error: createError } = await supabase
    .from('domains')
    .insert([{
      domain: 'allo-electricien.pro',
      service_type: 'électricien',
      status: 'active',
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (createError) {
    console.error('❌ Could not create domain:', createError.message);
    console.log('   Will proceed without domain_id\n');
    return null;
  }

  console.log(`✓ Created new domain: ${newDomain.domain} (${newDomain.id})\n`);
  return newDomain.id;
}

/**
 * Build a mapping of city slugs to city IDs
 */
async function buildCityMapping() {
  console.log('Building city slug → city_id mapping...');

  // Try to get cities from geographic_locations table
  let cities = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error } = await supabase
      .from('geographic_locations')
      .select('id, slug, name, city_id')
      .order('slug')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.log('⚠️  Could not query geographic_locations:', error.message);
      break;
    }

    if (pageData && pageData.length > 0) {
      cities = cities.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`✓ Loaded ${cities.length} geographic locations\n`);

  // Build slug → city_id map
  const mapping = {};
  cities.forEach(city => {
    if (city.slug && city.city_id) {
      mapping[city.slug] = city.city_id;
    }
  });

  console.log(`✓ Built mapping for ${Object.keys(mapping).length} cities with city_id\n`);
  return mapping;
}

/**
 * Transform extracted page data to Supabase schema
 */
function transformForSupabase(page, domainId, cityMapping) {
  // Try to find city_id from mapping
  const cityId = page.slug ? cityMapping[page.slug] : null;

  return {
    // Domain reference
    domain_id: domainId,

    // URL identification
    url_hash: page.url_hash,
    url: page.url,
    url_path: page.url_path,

    // Page type and status
    page_type: page.page_type,
    is_indexed: page.is_indexed,

    // SEO metadata
    title: page.title,
    meta_description: page.meta_description,
    h1: page.h1,

    // Word count (null for now, could be calculated)
    word_count: null,

    // SEO position tracking (null initially)
    position_best: null,
    position_current: null,
    traffic_estimate: null,

    // HTTP status
    status_code: 200, // Assume 200 for existing pages

    // Performance scores (null initially)
    mobile_score: null,
    speed_score: null,

    // Internal links (0 initially, could be calculated)
    internal_links_out: 0,
    internal_links_in: 0,

    // References to other tables
    geographic_target_id: null, // UUID reference if needed
    service_category_id: null,  // Could be set based on 'électricité'
    brand_focus_id: null,

    // City ID (integer reference)
    city_id: cityId,

    // Dates
    first_seen: page.first_seen,
    last_crawled: null,
    content_modified: null,

    // Data JSONB field
    data: {
      ...page.data,
      city_name: page.city_name,
      zip_code: page.zip_code,
      department: page.department,
      latitude: page.latitude,
      longitude: page.longitude,
      company_name: page.company_name,
      phone: page.phone,
      phone_raw: page.phone_raw,
      keyword: page.keyword,
      sitemap_priority: page.sitemap_priority,
      sitemap_changefreq: page.sitemap_changefreq,
      images: page.images,
      extracted_at: page.extracted_at
    },

    // Images
    featured_image_url: page.featured_image_url,
    featured_image_alt: page.title,  // Use title as alt text
    featured_image_width: null,
    featured_image_height: null,
    og_image_url: page.og_image_url,
    schema_image_url: page.og_image_url // Reuse OG image for schema
  };
}

/**
 * Main import function
 */
async function importPages() {
  const stats = {
    pages_loaded: 0,
    pages_imported: 0,
    pages_failed: 0,
    pages_with_city_id: 0,
    pages_without_city_id: 0,
    batches_processed: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: LOAD EXTRACTED PAGES DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const dataPath = path.join(__dirname, '..', 'data', 'extracted-pages.json');

  if (!fs.existsSync(dataPath)) {
    console.error('❌ extracted-pages.json not found at:', dataPath);
    console.error('   Run extraction script first: node scripts/extract-pages-data.js');
    process.exit(1);
  }

  const extractedPages = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  stats.pages_loaded = extractedPages.length;

  console.log(`✓ Loaded ${stats.pages_loaded} pages from extracted-pages.json\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: GET DOMAIN ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const domainId = DRY_RUN ? 'DRY-RUN-ID' : await getOrCreateDomain();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: BUILD CITY MAPPING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cityMapping = DRY_RUN ? {} : await buildCityMapping();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: TRANSFORM AND IMPORT PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Limit pages in test mode
  const pagesToImport = TEST_MODE ? extractedPages.slice(0, TEST_LIMIT) : extractedPages;

  // Process in batches
  for (let i = 0; i < pagesToImport.length; i += BATCH_SIZE) {
    const batch = pagesToImport.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pagesToImport.length / BATCH_SIZE);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} pages)...`);

    // Transform pages for this batch
    const transformedBatch = batch.map(page => {
      const transformed = transformForSupabase(page, domainId, cityMapping);

      // Track city_id stats
      if (transformed.city_id) {
        stats.pages_with_city_id++;
      } else if (page.page_type === 'city') {
        stats.pages_without_city_id++;
      }

      return transformed;
    });

    if (DRY_RUN) {
      console.log(`  📝 DRY RUN - Would import ${transformedBatch.length} pages`);
      if (i === 0) {
        console.log('\n  Sample transformed page:');
        console.log(JSON.stringify(transformedBatch[0], null, 2));
      }
    } else {
      // Import to Supabase using upsert
      // Uses unique constraint on (domain_id, url_hash) to handle duplicates
      const { data, error } = await supabase
        .from('pages')
        .upsert(transformedBatch, {
          onConflict: 'domain_id,url_hash',
          ignoreDuplicates: false
        })
        .select('id, url_path');

      if (error) {
        console.error(`  ❌ Batch ${batchNum} failed:`, error.message);
        stats.pages_failed += batch.length;
        stats.errors.push({
          batch: batchNum,
          error: error.message,
          pages: batch.map(p => p.slug)
        });
      } else {
        console.log(`  ✓ Batch ${batchNum} imported: ${data?.length || batch.length} pages`);
        stats.pages_imported += batch.length;
      }
    }

    stats.batches_processed++;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IMPORT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Pages loaded:              ${stats.pages_loaded}`);
  console.log(`  Pages imported:            ${stats.pages_imported}`);
  console.log(`  Pages failed:              ${stats.pages_failed}`);
  console.log(`  Batches processed:         ${stats.batches_processed}`);
  console.log(`  Pages with city_id:        ${stats.pages_with_city_id}`);
  console.log(`  Pages without city_id:     ${stats.pages_without_city_id}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors:');
    stats.errors.forEach(err => {
      console.log(`  - Batch ${err.batch}: ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'import-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: import-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to import to Supabase');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to import all pages');
  }

  // Save import summary
  const summaryPath = path.join(__dirname, '..', 'import-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    domain_id: domainId,
    stats: stats
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Import summary saved to: import-summary.json\n`);
}

// Run import
importPages().catch(error => {
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
