require('dotenv').config();
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const crypto = require('crypto');

console.log('=== EXTRACT PAGES DATA FROM HUGO CONTENT ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 10 : null;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only process ${TEST_LIMIT} pages\n`);
}

/**
 * Generate URL hash for deduplication (MD5)
 */
function generateUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Extract page data from Hugo frontmatter
 */
function extractPageData(slug, frontmatter) {
  const url = `https://allo-electricien.pro/${slug}`;
  const urlPath = `/${slug}`;

  return {
    // URL identification
    slug: slug,
    url: url,
    url_path: urlPath,
    url_hash: generateUrlHash(url),

    // Page type and status
    page_type: slug === '' ? 'homepage' : 'city',
    is_indexed: !frontmatter.draft,
    draft: frontmatter.draft || false,

    // SEO metadata
    title: frontmatter.title || null,
    meta_description: frontmatter.description || null,
    h1: frontmatter.title || null, // Assuming h1 matches title
    keyword: frontmatter.keyword || null,

    // City/Location data
    city_name: frontmatter.city || null,
    zip_code: frontmatter.zipCode || null,
    department: frontmatter.department || null,

    // Coordinates
    latitude: frontmatter.coordinates?.lat || null,
    longitude: frontmatter.coordinates?.lng || null,

    // Business info
    company_name: frontmatter.company || null,
    phone: frontmatter.phone || null,
    phone_raw: frontmatter.phoneRaw || null,

    // Images
    images: frontmatter.images || {},
    featured_image_url: frontmatter.images?.featured ? `/images/${frontmatter.images.featured}.jpg` : null,
    og_image_url: frontmatter.images?.og ? `/images/${frontmatter.images.og}.jpg` : null,
    hero_image: frontmatter.images?.hero || null,
    video_image: frontmatter.images?.video || null,

    // Sitemap settings
    sitemap_priority: frontmatter.sitemap?.priority || 0.5,
    sitemap_changefreq: frontmatter.sitemap?.changefreq || 'weekly',

    // Additional data (flexible JSONB field)
    data: {
      niche: frontmatter.niche || 'électricité',
      kwSource: frontmatter.kwSource || null,
      framework: 'Hugo',
      source: 'hugo-extraction',
      original_frontmatter: frontmatter
    },

    // Timestamps
    first_seen: new Date().toISOString().split('T')[0], // Today's date
    extracted_at: new Date().toISOString()
  };
}

/**
 * Main extraction function
 */
async function extractPages() {
  const stats = {
    pages_scanned: 0,
    pages_extracted: 0,
    pages_skipped: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: SCAN CONTENT DIRECTORY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const contentDir = path.join(__dirname, '..', 'content');

  if (!fs.existsSync(contentDir)) {
    console.error('❌ Content directory not found:', contentDir);
    process.exit(1);
  }

  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  const directories = entries.filter(entry => entry.isDirectory());

  console.log(`✓ Found ${directories.length} directories in content/\n`);

  // Add homepage (_index.md) if it exists
  const homepageFile = path.join(contentDir, '_index.md');
  const hasHomepage = fs.existsSync(homepageFile);

  if (hasHomepage) {
    console.log('✓ Homepage file (_index.md) found\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: EXTRACT FRONTMATTER FROM PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const extractedPages = [];

  // Process homepage first
  if (hasHomepage) {
    try {
      const content = fs.readFileSync(homepageFile, 'utf8');
      const parsed = matter(content);
      const pageData = extractPageData('', parsed.data);
      extractedPages.push(pageData);
      stats.pages_extracted++;
      console.log('  ✓ Homepage');
    } catch (error) {
      stats.errors.push({
        slug: 'homepage',
        file: '_index.md',
        error: error.message
      });
      console.log(`  ❌ Homepage: ${error.message}`);
    }
  }

  // Limit directories in test mode
  const directoriesToProcess = TEST_MODE ? directories.slice(0, TEST_LIMIT) : directories;

  // Process all city pages
  for (const dir of directoriesToProcess) {
    stats.pages_scanned++;
    const slug = dir.name;
    const indexFile = path.join(contentDir, slug, 'index.md');

    if (!fs.existsSync(indexFile)) {
      stats.pages_skipped++;
      if (stats.pages_scanned <= 10) {
        console.log(`  ⊘ ${slug}: No index.md file`);
      }
      continue;
    }

    try {
      const content = fs.readFileSync(indexFile, 'utf8');
      const parsed = matter(content);

      if (!parsed.data) {
        throw new Error('No frontmatter found');
      }

      const pageData = extractPageData(slug, parsed.data);
      extractedPages.push(pageData);
      stats.pages_extracted++;

      if (stats.pages_extracted <= 10 || stats.pages_extracted % 100 === 0) {
        console.log(`  ✓ ${slug} (${pageData.city_name || 'N/A'})`);
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

    // Progress update every 200 pages
    if (stats.pages_scanned % 200 === 0) {
      const progress = ((stats.pages_scanned / directoriesToProcess.length) * 100).toFixed(1);
      console.log(`  Progress: ${stats.pages_scanned}/${directoriesToProcess.length} pages (${progress}%)`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: WRITE TO FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const outputPath = path.join(__dirname, '..', 'data', 'extracted-pages.json');

  if (DRY_RUN) {
    console.log('📝 DRY RUN - Would write to:', outputPath);
    console.log(`   Sample data for first page: ${extractedPages[0]?.slug || 'N/A'}`);
    console.log(JSON.stringify(extractedPages[0], null, 2));
  } else {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(extractedPages, null, 2), 'utf8');
    console.log(`✓ Successfully wrote to: ${outputPath}`);

    // Get file size
    const fileStats = fs.statSync(outputPath);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);
    console.log(`  File size: ${fileSizeKB} KB`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EXTRACTION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Pages scanned:             ${stats.pages_scanned}`);
  console.log(`  Pages extracted:           ${stats.pages_extracted}`);
  console.log(`  Pages skipped:             ${stats.pages_skipped}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.slug} (${err.file}): ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'extraction-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: extraction-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to write to file');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to extract all pages');
  }

  // Save extraction summary
  const summaryPath = path.join(__dirname, '..', 'extraction-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    stats: stats,
    sample_page: extractedPages[0] || null
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Extraction summary saved to: extraction-summary.json\n`);
}

// Run extraction
extractPages().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
