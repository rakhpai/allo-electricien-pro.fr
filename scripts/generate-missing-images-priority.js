require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== GENERATE MISSING IMAGES PRIORITY LIST ===\n');

// Configuration
const TEST_MODE = process.argv.includes('--test');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Define city importance tiers (from Hugo's add-sitemap-priorities.js)
const MAJOR_CITIES = [
  'versailles', 'nanterre', 'bobigny', 'creteil', 'evry', 'evry-courcouronnes',
  'melun', 'cergy', 'pontoise', 'boulogne-billancourt', 'saint-denis',
  'argenteuil', 'montreuil', 'aulnay-sous-bois', 'aubervilliers',
  'colombes', 'asnieres-sur-seine', 'courbevoie', 'vitry-sur-seine',
  'rueil-malmaison', 'champigny-sur-marne', 'antibes', 'cannes',
  'levallois-perret', 'issy-les-moulineaux', 'neuilly-sur-seine',
  'ivry-sur-seine', 'clichy', 'villejuif', 'epinay-sur-seine',
  'maisons-alfort', 'chelles', 'meaux', 'beauvais', 'compiegne',
  'creil', 'senlis', 'nogent-sur-marne', 'vincennes', 'antony',
  'clamart', 'suresnes', 'puteaux', 'pantin', 'sevran', 'noisy-le-grand',
  'drancy', 'blanc-mesnil', 'livry-gargan', 'bondy'
];

/**
 * Calculate priority score for a missing image page
 */
async function calculatePriority(page, slug, electriciansData, videosData) {
  let score = 0;
  const factors = [];

  // Factor 1: Sitemap priority from frontmatter (0-100 points)
  const sitemapPriority = page.data?.sitemap_priority || 0.5;
  const sitemapPoints = Math.round(sitemapPriority * 100);
  score += sitemapPoints;
  factors.push(`sitemap:${sitemapPoints}`);

  // Factor 2: Paris arrondissements (+50 points)
  if (slug && slug.startsWith('paris-')) {
    score += 50;
    factors.push('paris:50');
  }

  // Factor 3: Major cities (+30 points)
  if (slug && MAJOR_CITIES.includes(slug)) {
    score += 30;
    factors.push('major_city:30');
  }

  // Factor 4: Has electricians (+40 points)
  if (slug && electriciansData && electriciansData[slug]) {
    const electricianCount = electriciansData[slug].length;
    score += Math.min(40, electricianCount * 5); // Up to 40 points
    factors.push(`electricians:${Math.min(40, electricianCount * 5)}`);
  }

  // Factor 5: Has video (+25 points)
  if (slug && videosData && videosData[slug]) {
    score += 25;
    factors.push('video:25');
  }

  // Factor 6: Has city_id (+10 points) - linked to geographic_locations
  if (page.city_id) {
    score += 10;
    factors.push('city_id:10');
  }

  return {
    score,
    factors: factors.join(', ')
  };
}

/**
 * Main function
 */
async function generatePriorityList() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: LOAD VALIDATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const reportPath = path.join(__dirname, '..', 'image-validation-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ image-validation-report.json not found');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const allPages = report.full_validation_results;

  // Filter pages with no images or partial images (missing hero)
  const pagesNeedingImages = allPages.filter(p =>
    p.has_no_images || p.missing_types.includes('hero')
  );

  console.log(`✓ Loaded validation report`);
  console.log(`  Total pages: ${allPages.length}`);
  console.log(`  Pages needing images: ${pagesNeedingImages.length}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: LOAD ELECTRICIANS DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let electriciansData = null;
  const electriciansPath = path.join(__dirname, '..', 'data', 'commune_electricians.json');

  if (fs.existsSync(electriciansPath)) {
    electriciansData = JSON.parse(fs.readFileSync(electriciansPath, 'utf8'));
    console.log(`✓ Loaded electricians data: ${Object.keys(electriciansData).length} communes\n`);
  } else {
    console.log('⚠️  No electricians data found\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: LOAD VIDEOS DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let videosData = null;
  const videosPath = path.join(__dirname, '..', 'data', 'commune_videos.json');

  if (fs.existsSync(videosPath)) {
    videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
    console.log(`✓ Loaded videos data: ${Object.keys(videosData).length} communes\n`);
  } else {
    console.log('⚠️  No videos data found\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: LOAD SUPABASE PAGE DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get domain ID
  const { data: domains } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', 'allo-electricien.pro')
    .limit(1);

  if (!domains || domains.length === 0) {
    console.error('❌ Domain not found');
    process.exit(1);
  }

  const domainId = domains[0].id;

  // Fetch all pages
  let pages = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData } = await supabase
      .from('pages')
      .select('id, url_path, city_id, data')
      .eq('domain_id', domainId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pageData && pageData.length > 0) {
      pages = pages.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`✓ Loaded ${pages.length} pages from Supabase\n`);

  // Build page lookup
  const pageLookup = {};
  pages.forEach(p => {
    const slug = p.url_path === '/' ? '' : p.url_path.replace(/^\//, '');
    pageLookup[slug] = p;
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: CALCULATE PRIORITIES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const prioritized = [];

  for (const validationResult of pagesNeedingImages) {
    const supabasePage = pageLookup[validationResult.slug];

    if (!supabasePage) {
      console.log(`  ⚠️  No Supabase data for: ${validationResult.slug}`);
      continue;
    }

    const priority = await calculatePriority(supabasePage, validationResult.slug, electriciansData, videosData);

    prioritized.push({
      slug: validationResult.slug,
      url_path: validationResult.url_path,
      missing_types: validationResult.missing_types,
      priority_score: priority.score,
      priority_factors: priority.factors,
      city_id: supabasePage.city_id,
      has_electricians: electriciansData && electriciansData[validationResult.slug] ? true : false,
      has_video: videosData && videosData[validationResult.slug] ? true : false,
      sitemap_priority: supabasePage.data?.sitemap_priority || 0.5
    });

    if (prioritized.length % 100 === 0) {
      console.log(`  Processed ${prioritized.length}/${pagesNeedingImages.length} pages...`);
    }
  }

  // Sort by priority score (descending)
  prioritized.sort((a, b) => b.priority_score - a.priority_score);

  console.log(`\n✓ Calculated priorities for ${prioritized.length} pages\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 6: CATEGORIZE AND GENERATE REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Categorize by priority tiers
  const highPriority = prioritized.filter(p => p.priority_score >= 100);
  const mediumPriority = prioritized.filter(p => p.priority_score >= 50 && p.priority_score < 100);
  const lowPriority = prioritized.filter(p => p.priority_score < 50);

  console.log('Priority Distribution:');
  console.log(`  High (≥100):   ${highPriority.length} pages`);
  console.log(`  Medium (50-99): ${mediumPriority.length} pages`);
  console.log(`  Low (<50):      ${lowPriority.length} pages\n`);

  // Generate comprehensive report
  const priorityReport = {
    timestamp: new Date().toISOString(),
    summary: {
      total_pages_needing_images: prioritized.length,
      high_priority_count: highPriority.length,
      medium_priority_count: mediumPriority.length,
      low_priority_count: lowPriority.length,

      missing_hero: prioritized.filter(p => p.missing_types.includes('hero')).length,
      missing_og: prioritized.filter(p => p.missing_types.includes('og')).length,
      missing_featured: prioritized.filter(p => p.missing_types.includes('featured')).length,
      missing_video: prioritized.filter(p => p.missing_types.includes('video')).length,

      pages_with_electricians: prioritized.filter(p => p.has_electricians).length,
      pages_with_videos: prioritized.filter(p => p.has_video).length
    },

    high_priority: highPriority,
    medium_priority: mediumPriority,
    low_priority: lowPriority,

    // All pages sorted by priority
    all_prioritized: prioritized,

    // Top 20 for quick reference
    top_20: prioritized.slice(0, 20).map(p => ({
      slug: p.slug,
      score: p.priority_score,
      factors: p.priority_factors,
      missing: p.missing_types.join(', ')
    }))
  };

  const reportOutputPath = path.join(__dirname, '..', 'missing-images-priority.json');
  fs.writeFileSync(reportOutputPath, JSON.stringify(priorityReport, null, 2));

  console.log(`✓ Saved priority report: missing-images-priority.json\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TOP 20 HIGHEST PRIORITY PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  priorityReport.top_20.forEach((p, index) => {
    console.log(`${(index + 1).toString().padStart(2)}. [${p.score.toString().padStart(3)}] ${p.slug}`);
    console.log(`    Factors: ${p.factors}`);
    console.log(`    Missing: ${p.missing}\n`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run generator
generatePriorityList().catch(error => {
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
