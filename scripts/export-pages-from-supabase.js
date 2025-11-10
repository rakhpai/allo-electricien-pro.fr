require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== EXPORT PAGES FROM SUPABASE ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 10 : null;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only export ${TEST_LIMIT} pages\n`);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Transform Supabase page data to Hugo-compatible format
 */
function transformFromSupabase(page) {
  // Extract data from the JSONB field
  const pageData = page.data || {};

  // Extract slug from URL path
  const slug = page.url_path === '/' ? '' : page.url_path.replace(/^\//, '');

  return {
    // Page identification
    slug: slug,
    url: page.url,
    url_path: page.url_path,

    // Page metadata
    title: page.title,
    meta_description: page.meta_description,
    h1: page.h1,

    // SEO & Content
    keyword: pageData.keyword || null,

    // Location data
    city_name: pageData.city_name || null,
    zip_code: pageData.zip_code || null,
    department: pageData.department || null,

    // Coordinates
    latitude: pageData.latitude || null,
    longitude: pageData.longitude || null,

    // Business info
    company_name: pageData.company_name || null,
    phone: pageData.phone || null,
    phone_raw: pageData.phone_raw || null,

    // Images
    images: pageData.images || {},
    featured_image_url: page.featured_image_url,
    og_image_url: page.og_image_url,

    // Sitemap settings
    sitemap_priority: pageData.sitemap_priority || 0.5,
    sitemap_changefreq: pageData.sitemap_changefreq || 'weekly',

    // Status
    is_indexed: page.is_indexed,
    page_type: page.page_type,

    // City ID for reference
    city_id: page.city_id,

    // Additional data
    niche: pageData.niche || 'électricité',
    kwSource: pageData.kwSource || null,

    // Metadata
    first_seen: page.first_seen,
    domain_id: page.domain_id
  };
}

/**
 * Main export function
 */
async function exportPages() {
  const stats = {
    pages_fetched: 0,
    pages_exported: 0,
    pages_skipped: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: GET DOMAIN ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Find allo-electricien.pro domain
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
  console.log('STEP 2: FETCH PAGES FROM SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch all pages using pagination
  let pages = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error: pagesError } = await supabase
      .from('pages')
      .select('*')
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

  console.log(`\n✓ Found ${pages.length} pages in database\n`);
  stats.pages_fetched = pages.length;

  // Limit pages in test mode
  const pagesToProcess = TEST_MODE ? pages.slice(0, TEST_LIMIT) : pages;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: TRANSFORM PAGE DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const exportedPages = [];

  for (const page of pagesToProcess) {
    try {
      const transformed = transformFromSupabase(page);
      exportedPages.push(transformed);
      stats.pages_exported++;

      if (stats.pages_exported <= 10 || stats.pages_exported % 100 === 0) {
        console.log(`  ✓ ${transformed.url_path} (${transformed.page_type})`);
      }

    } catch (error) {
      stats.errors.push({
        url_path: page.url_path,
        error: error.message
      });

      if (stats.errors.length <= 5) {
        console.log(`  ❌ ${page.url_path}: ${error.message}`);
      }
    }

    // Progress update every 200 pages
    if (stats.pages_exported % 200 === 0 && !TEST_MODE) {
      const progress = ((stats.pages_exported / pagesToProcess.length) * 100).toFixed(1);
      console.log(`  Progress: ${stats.pages_exported}/${pagesToProcess.length} pages (${progress}%)`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: WRITE TO FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const outputPath = path.join(__dirname, '..', 'data', 'pages.json');

  if (DRY_RUN) {
    console.log('📝 DRY RUN - Would write to:', outputPath);
    console.log(`   Sample data for first page: ${exportedPages[0]?.url_path || 'N/A'}`);
    console.log(JSON.stringify(exportedPages[0], null, 2));
  } else {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(exportedPages, null, 2), 'utf8');
    console.log(`✓ Successfully wrote to: ${outputPath}`);

    // Get file size
    const fileStats = fs.statSync(outputPath);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);
    console.log(`  File size: ${fileSizeKB} KB`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EXPORT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Pages fetched:             ${stats.pages_fetched}`);
  console.log(`  Pages exported:            ${stats.pages_exported}`);
  console.log(`  Pages skipped:             ${stats.pages_skipped}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.url_path}: ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'pages-export-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: pages-export-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to write to file');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to export all pages');
  }

  // Save export summary
  const summaryPath = path.join(__dirname, '..', 'pages-export-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    domain_id: domainId,
    stats: stats
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Export summary saved to: pages-export-summary.json\n`);
}

// Run export
exportPages().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
