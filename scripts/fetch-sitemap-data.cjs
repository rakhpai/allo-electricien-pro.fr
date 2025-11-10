require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== FETCH SITEMAP DATA FROM SUPABASE ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Check if page has video content
 */
function hasVideoContent(page) {
  if (!page.data || !page.data.images) return false;

  const images = page.data.images;

  // Check for video-related images (hero images typically indicate video pages)
  const videoIndicators = ['hero', 'video', 'thumbnail'];

  for (const key in images) {
    if (videoIndicators.some(indicator => key.toLowerCase().includes(indicator))) {
      return true;
    }
  }

  return false;
}

/**
 * Extract department from page data
 */
function extractDepartment(page) {
  // Try data.department first
  if (page.data && page.data.department) {
    return page.data.department;
  }

  // Try to extract from zip code
  if (page.data && page.data.zip_code) {
    const zipCode = String(page.data.zip_code);
    if (zipCode.length >= 2) {
      return zipCode.substring(0, 2);
    }
  }

  // Try to extract from URL path (e.g., /electricien/75/)
  if (page.url_path) {
    const match = page.url_path.match(/\/electricien\/(\d{2})\//);
    if (match) {
      return match[1];
    }

    // Check for Paris arrondissement patterns
    const parisMatch = page.url_path.match(/\/paris-(\d+)/);
    if (parisMatch) {
      return '75';
    }
  }

  return null;
}

/**
 * Determine page tier based on priority
 */
function getPageTier(priority) {
  if (priority >= 1.0) return 'S'; // Top priority
  if (priority >= 0.92) return 'A'; // Department hubs
  if (priority >= 0.9) return 'B'; // Paris, main services
  if (priority >= 0.7) return 'C'; // Major suburbs
  if (priority >= 0.5) return 'D'; // Standard communes
  return 'E'; // Low priority
}

/**
 * Main fetch function
 */
async function fetchSitemapData() {
  const stats = {
    pages_fetched: 0,
    pages_with_video: 0,
    pages_by_tier: { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 },
    pages_by_department: {},
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
    console.error('   Error:', domainsError?.message);
    process.exit(1);
  }

  const domainId = domains[0].id;
  console.log(`✓ Found domain: ${domains[0].domain} (ID: ${domainId})\n`);

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
      .select('id, url, url_path, title, h1, meta_description, page_type, is_indexed, data, featured_image_url, og_image_url')
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

  console.log(`\n✓ Found ${pages.length} pages for allo-electricien.pro\n`);
  stats.pages_fetched = pages.length;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: TRANSFORM AND ORGANIZE DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sitemapPages = [];

  for (const page of pages) {
    try {
      // Extract sitemap priority from data
      const priority = page.data?.sitemap_priority || 0.5;
      const department = extractDepartment(page);
      const hasVideo = hasVideoContent(page);
      const tier = getPageTier(priority);

      // Transform to sitemap format
      const sitemapPage = {
        id: page.id,
        url: page.url,
        url_path: page.url_path,
        title: page.title || page.h1 || page.url_path,
        page_type: page.page_type,
        is_indexed: page.is_indexed,

        // Location data
        city_name: page.data?.city_name || null,
        zip_code: page.data?.zip_code || null,
        department: department,

        // SEO data
        priority: priority,
        tier: tier,

        // Video status
        has_video: hasVideo,

        // Images
        featured_image: page.featured_image_url,
        og_image: page.og_image_url,

        // Additional metadata
        keyword: page.data?.keyword || null,
        company_name: page.data?.company_name || null
      };

      sitemapPages.push(sitemapPage);

      // Update stats
      if (hasVideo) stats.pages_with_video++;
      stats.pages_by_tier[tier]++;

      if (department) {
        stats.pages_by_department[department] = (stats.pages_by_department[department] || 0) + 1;
      }

      // Progress update every 100 pages
      if (sitemapPages.length % 100 === 0) {
        const progress = ((sitemapPages.length / pages.length) * 100).toFixed(1);
        console.log(`  Progress: ${sitemapPages.length}/${pages.length} pages (${progress}%)`);
      }

    } catch (error) {
      stats.errors.push({
        url_path: page.url_path,
        error: error.message
      });
    }
  }

  console.log(`\n✓ Transformed ${sitemapPages.length} pages\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: ORGANIZE BY HIERARCHY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Organize pages by tier and department
  const organized = {
    // Tier S: Priority 1.0 pages (SOS, homepage, etc.)
    tier_s: sitemapPages.filter(p => p.tier === 'S').sort((a, b) => b.priority - a.priority),

    // Tier A: Department hubs (priority 0.92)
    tier_a: sitemapPages.filter(p => p.tier === 'A').sort((a, b) => b.priority - a.priority),

    // Tier B: Paris arrondissements and main services (priority 0.9)
    tier_b: {
      // Filter canonical Paris URLs - deduplicate by arrondissement number
      paris: (() => {
        const parisByNumber = {};
        sitemapPages
          .filter(p => p.tier === 'B' && p.department === '75')
          .forEach(page => {
            // Extract arrondissement number from URL (e.g., "/paris-1", "/paris-1er/", "/paris-15e/")
            const match = page.url_path.match(/\/paris-(\d+)/);
            if (match) {
              const num = match[1];
              // Keep the shortest URL (most canonical - usually without suffixes)
              if (!parisByNumber[num] || page.url_path.length < parisByNumber[num].url_path.length) {
                parisByNumber[num] = page;
              }
            }
          });
        // Return array of unique Paris pages, sorted by arrondissement number
        return Object.entries(parisByNumber)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([_, page]) => page);
      })(),
      services: sitemapPages.filter(p => p.tier === 'B' && p.url_path.includes('/services/')).sort((a, b) => b.priority - a.priority),
      other: sitemapPages.filter(p => p.tier === 'B' && p.department !== '75' && !p.url_path.includes('/services/')).sort((a, b) => b.priority - a.priority)
    },

    // Tier C: Major suburbs (priority 0.7-0.85)
    tier_c_by_dept: {},

    // Tier D: Standard communes (priority 0.5)
    tier_d_by_dept: {},

    // Tier E: Low priority pages
    tier_e: sitemapPages.filter(p => p.tier === 'E')
  };

  // Organize Tiers C and D by department
  const departments = ['75', '77', '78', '91', '92', '93', '94', '95'];

  departments.forEach(dept => {
    organized.tier_c_by_dept[dept] = sitemapPages
      .filter(p => p.tier === 'C' && p.department === dept)
      .sort((a, b) => b.priority - a.priority || a.city_name?.localeCompare(b.city_name));

    organized.tier_d_by_dept[dept] = sitemapPages
      .filter(p => p.tier === 'D' && p.department === dept)
      .sort((a, b) => (a.city_name || '').localeCompare(b.city_name || ''));
  });

  console.log('✓ Organized pages by hierarchy:\n');
  console.log(`  Tier S (Priority):          ${organized.tier_s.length} pages`);
  console.log(`  Tier A (Departments):       ${organized.tier_a.length} pages`);
  console.log(`  Tier B (Paris + Services):  ${organized.tier_b.paris.length + organized.tier_b.services.length + organized.tier_b.other.length} pages`);
  console.log(`    - Paris arrondissements:  ${organized.tier_b.paris.length}`);
  console.log(`    - Services:               ${organized.tier_b.services.length}`);
  console.log(`    - Other:                  ${organized.tier_b.other.length}`);
  console.log(`  Tier C (Major suburbs):     ${Object.values(organized.tier_c_by_dept).reduce((sum, arr) => sum + arr.length, 0)} pages`);
  console.log(`  Tier D (All communes):      ${Object.values(organized.tier_d_by_dept).reduce((sum, arr) => sum + arr.length, 0)} pages`);
  console.log(`  Tier E (Low priority):      ${organized.tier_e.length} pages\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: SAVE TO FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Save organized data (Hugo expects underscores, not hyphens)
  const outputPath = path.join(dataDir, 'sitemap_pages.json');
  const output = {
    generated_at: new Date().toISOString(),
    domain: 'allo-electricien.pro',
    stats: {
      total_pages: sitemapPages.length,
      pages_with_video: stats.pages_with_video,
      pages_by_tier: stats.pages_by_tier,
      pages_by_department: stats.pages_by_department
    },
    organized: organized
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✓ Saved organized sitemap data to: ${outputPath}`);

  // Get file size
  const fileStats = fs.statSync(outputPath);
  const fileSizeKB = (fileStats.size / 1024).toFixed(2);
  console.log(`  File size: ${fileSizeKB} KB\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FETCH COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total pages fetched:       ${stats.pages_fetched}`);
  console.log(`  Pages with video:          ${stats.pages_with_video} (${((stats.pages_with_video/stats.pages_fetched)*100).toFixed(1)}%)`);
  console.log(`  Errors:                    ${stats.errors.length}\n`);

  console.log('Pages by tier:');
  Object.entries(stats.pages_by_tier).forEach(([tier, count]) => {
    console.log(`  Tier ${tier}:                    ${count}`);
  });
  console.log('');

  console.log('Pages by department:');
  Object.entries(stats.pages_by_department)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([dept, count]) => {
      console.log(`  Department ${dept}:            ${count}`);
    });
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`⚠️  ${stats.errors.length} errors occurred during processing`);
    console.log('  Showing first 5 errors:\n');
    stats.errors.slice(0, 5).forEach(err => {
      console.log(`  - ${err.url_path}: ${err.error}`);
    });
    console.log('');
  }

  console.log('✅ Sitemap data is ready for use in Hugo templates!\n');
}

// Run fetch
fetchSitemapData().catch(error => {
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
