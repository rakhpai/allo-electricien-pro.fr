#!/usr/bin/env node

/**
 * GENERATE SEO-OPTIMIZED INTERLINKS
 * ==================================
 *
 * Creates proximity-based internal linking data for commune pages
 * with varied, SEO-optimized anchor texts.
 *
 * Source: Supabase pages table + geographic_locations table
 * Output: data/interlinks.json
 *
 * Usage: node scripts/generate-interlinks.cjs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  MAX_LINKS_PER_PAGE: 8,
  MAX_DISTANCE_KM: 15,
  MIN_DISTANCE_KM: 1,
  RADIUS_PARIS: 5,      // km for dept 75
  RADIUS_SUBURBS: 10,   // km for other departments
};

// SEO-optimized anchor text patterns with weights
const ANCHOR_PATTERNS = [
  { template: "électricien {commune}", weight: 15, type: "exact" },
  { template: "dépannage électricien {commune}", weight: 18, type: "partial" },
  { template: "intervention électricien {commune}", weight: 15, type: "partial" },
  { template: "électricien d'urgence {commune}", weight: 15, type: "longtail" },
  { template: "sos électricien {commune}", weight: 12, type: "keyword" },
  { template: "dépannage électricité {commune}", weight: 12, type: "keyword" },
  { template: "nos électriciens {commune}", weight: 8, type: "branded" },
  { template: "{commune}", weight: 5, type: "generic" }
];

// Anchor pattern distribution for 8 links (balanced)
// Ensures variety: 1 exact, 2 partial, 2 keyword/longtail, 2 partial/keyword, 1 branded
const ANCHOR_DISTRIBUTION = [0, 1, 2, 3, 4, 5, 1, 6];

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Select anchor pattern based on index (ensures variety)
 * @param {number} index - Link position (0-7)
 * @returns {object} Anchor pattern object
 */
function selectAnchorPattern(index) {
  const patternIndex = ANCHOR_DISTRIBUTION[index % ANCHOR_DISTRIBUTION.length];
  return ANCHOR_PATTERNS[patternIndex];
}

/**
 * Generate anchor text from pattern
 * @param {string} template - Pattern template
 * @param {string} cityName - City name to insert
 * @returns {string} Generated anchor text
 */
function generateAnchor(template, cityName) {
  return template.replace('{commune}', cityName);
}

/**
 * Extract slug from URL path
 * @param {string} urlPath - URL path like "/versailles/"
 * @returns {string} Slug like "versailles"
 */
function extractSlug(urlPath) {
  return urlPath.replace(/^\/|\/$/g, '');
}

/**
 * Normalize slug by replacing apostrophes with hyphens
 * Hugo cannot create directories with apostrophes, so all slugs must use hyphens
 * @param {string} slug - Slug that may contain apostrophes (e.g., "saint-remy-l'honore")
 * @returns {string} Normalized slug with hyphens (e.g., "saint-remy-l-honore")
 */
function normalizeSlug(slug) {
  if (!slug) return slug;
  // Replace both straight apostrophe (') and curly apostrophe (')
  return slug.replace(/['\']/g, '-');
}

/**
 * Normalize URL by replacing apostrophes with hyphens
 * Preserves leading/trailing slashes
 * @param {string} url - URL like "/saint-remy-l'honore/" or "https://site.com/saint-remy-l'honore/"
 * @returns {string} Normalized URL like "/saint-remy-l-honore/"
 */
function normalizeUrl(url) {
  if (!url) return url;
  // Replace both straight apostrophe (') and curly apostrophe (')
  return url.replace(/['\']/g, '-');
}

/**
 * Ensure URL has trailing slash
 * @param {string} url - URL that may or may not have trailing slash
 * @returns {string} URL with trailing slash
 */
function ensureTrailingSlash(url) {
  if (!url) return url;
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Extract path from full URL or return path as-is
 * @param {string} url - Full URL like "https://site.com/path/" or just "/path/"
 * @returns {string} Path like "/path/"
 */
function extractPath(url) {
  if (!url) return url;
  // If it's a full URL with protocol, extract just the path
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch (e) {
      return url;
    }
  }
  // Already a path
  return url;
}

/**
 * Get maximum distance radius based on department
 * @param {string} department - Department code (e.g., "75", "78")
 * @returns {number} Radius in km
 */
function getMaxRadius(department) {
  return department === '75' ? CONFIG.RADIUS_PARIS : CONFIG.RADIUS_SUBURBS;
}

/**
 * Main execution function
 */
async function generateInterlinks() {
  console.log('🚀 Starting interlinks generation...\n');

  try {
    // Step 1: Get domain ID for allo-electricien.pro
    console.log('📡 Fetching domain ID...');
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', 'allo-electricien.pro')
      .single();

    if (domainError || !domain) {
      throw new Error(`Domain not found: ${domainError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Domain ID: ${domain.id}\n`);

    // Step 2: Load all city pages with geographic data (with pagination)
    console.log('📡 Loading pages from Supabase (with pagination)...');
    const allPages = [];
    let hasMorePages = true;
    let pageOffset = 0;
    const pageBatchSize = 1000;

    while (hasMorePages) {
      const { data: batch, error: batchError } = await supabase
        .from('pages')
        .select('id, url, url_path, page_type, city_id, geographic_target_id, data')
        .eq('domain_id', domain.id)
        .eq('page_type', 'city')
        .not('city_id', 'is', null)
        .range(pageOffset, pageOffset + pageBatchSize - 1);

      if (batchError) {
        throw new Error(`Failed to load pages batch: ${batchError.message}`);
      }

      if (batch.length === 0) break;

      allPages.push(...batch);
      hasMorePages = batch.length === pageBatchSize;
      pageOffset += pageBatchSize;

      console.log(`   Loaded ${allPages.length} pages so far...`);
    }

    const pages = allPages;
    console.log(`✅ Loaded ${pages.length} city pages total\n`);

    // Step 3: Load geographic locations with coordinates (with pagination)
    console.log('📡 Loading geographic locations (with pagination)...');
    const allLocations = [];
    let hasMoreLocations = true;
    let locationOffset = 0;
    const locationBatchSize = 1000;

    while (hasMoreLocations) {
      const { data: batch, error: batchError } = await supabase
        .from('geographic_locations')
        .select('id, slug, name, latitude, longitude, postal_codes')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .range(locationOffset, locationOffset + locationBatchSize - 1);

      if (batchError) {
        throw new Error(`Failed to load locations batch: ${batchError.message}`);
      }

      if (batch.length === 0) break;

      allLocations.push(...batch);
      hasMoreLocations = batch.length === locationBatchSize;
      locationOffset += locationBatchSize;

      console.log(`   Loaded ${allLocations.length} locations so far...`);
    }

    const locations = allLocations;
    console.log(`✅ Loaded ${locations.length} geographic locations total\n`);

    // Step 4: Create lookup maps
    console.log('🔄 Building lookup maps...');

    // Map by geographic_target_id (UUID)
    const locationsByGeoId = {};
    locations.forEach(loc => {
      locationsByGeoId[loc.id] = loc;
    });

    // Map by slug for matching
    const locationsBySlug = {};
    locations.forEach(loc => {
      if (loc.slug) {
        locationsBySlug[loc.slug] = loc;
      }
    });

    console.log(`✅ Created lookup maps\n`);

    // Step 5: Enrich pages with coordinate data
    console.log('🔄 Enriching pages with coordinates...');
    const enrichedPages = [];
    let skipped = 0;

    for (const page of pages) {
      // Extract path from full URL, normalize apostrophes, ensure trailing slash
      const rawUrl = page.url || page.url_path;
      const pathOnly = extractPath(rawUrl);  // Convert full URL to path
      const normalizedUrl = ensureTrailingSlash(normalizeUrl(pathOnly));
      const slug = extractSlug(normalizedUrl);
      let location = null;

      // Try to find location by geographic_target_id first
      if (page.geographic_target_id && locationsByGeoId[page.geographic_target_id]) {
        location = locationsByGeoId[page.geographic_target_id];
      }
      // Fallback to slug match
      else if (locationsBySlug[slug]) {
        location = locationsBySlug[slug];
      }
      // Last resort: try to get from page.data if it has coordinates
      else if (page.data?.latitude && page.data?.longitude) {
        location = {
          slug: slug,
          name: page.data.city_name || slug,
          latitude: parseFloat(page.data.latitude),
          longitude: parseFloat(page.data.longitude),
          postal_codes: page.data.zip_code ? [page.data.zip_code] : []
        };
      }

      if (location && location.latitude && location.longitude) {
        enrichedPages.push({
          slug: slug,  // Normalized slug for lookup key
          city: location.name || page.data?.city_name || slug,
          url: normalizedUrl,  // Normalized URL with trailing slash
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
          department: page.data?.department || (location.postal_codes?.[0] ? location.postal_codes[0].substring(0, 2) : ''),
          zipCode: location.postal_codes?.[0] || page.data?.zip_code || ''
        });
      } else {
        skipped++;
      }
    }

    console.log(`✅ Enriched ${enrichedPages.length} pages (skipped ${skipped} without coordinates)\n`);

    // Step 6: Generate interlinks for each page
    console.log('🔗 Generating proximity-based interlinks...');
    const interlinks = {};
    let totalLinks = 0;
    let processedCount = 0;

    for (const page of enrichedPages) {
      const maxRadius = getMaxRadius(page.department);

      // Calculate distances to all other pages
      const nearby = [];

      for (const otherPage of enrichedPages) {
        // Skip self
        if (otherPage.slug === page.slug) continue;

        const distance = calculateDistance(
          page.latitude,
          page.longitude,
          otherPage.latitude,
          otherPage.longitude
        );

        // Apply distance filters
        if (distance >= CONFIG.MIN_DISTANCE_KM && distance <= maxRadius) {
          nearby.push({
            ...otherPage,
            distance: distance
          });
        }
      }

      // Sort by distance and take top N
      nearby.sort((a, b) => a.distance - b.distance);
      const topNearby = nearby.slice(0, CONFIG.MAX_LINKS_PER_PAGE);

      // Generate varied anchor texts
      interlinks[page.slug] = topNearby.map((nearbyPage, index) => {
        const pattern = selectAnchorPattern(index);

        return {
          slug: nearbyPage.slug,
          city: nearbyPage.city,
          url: nearbyPage.url,
          anchor: generateAnchor(pattern.template, nearbyPage.city),
          anchor_type: pattern.type,
          distance_km: nearbyPage.distance.toFixed(1),
          department: nearbyPage.department
        };
      });

      totalLinks += topNearby.length;
      processedCount++;

      // Progress indicator
      if (processedCount % 100 === 0) {
        console.log(`   Processed ${processedCount}/${enrichedPages.length} pages...`);
      }
    }

    console.log(`✅ Generated ${totalLinks} total interlinks (avg ${(totalLinks / processedCount).toFixed(1)} per page)\n`);

    // Step 7: Generate output JSON
    const output = {
      generated_at: new Date().toISOString(),
      total_pages: enrichedPages.length,
      pages_with_interlinks: Object.keys(interlinks).length,
      total_links_generated: totalLinks,
      config: {
        max_links_per_page: CONFIG.MAX_LINKS_PER_PAGE,
        max_distance_km: CONFIG.MAX_DISTANCE_KM,
        radius_paris: CONFIG.RADIUS_PARIS,
        radius_suburbs: CONFIG.RADIUS_SUBURBS
      },
      anchor_patterns: ANCHOR_PATTERNS.map(p => ({
        type: p.type,
        template: p.template
      })),
      by_city: interlinks
    };

    // Step 8: Write to file
    const outputPath = path.join(__dirname, '..', 'data', 'interlinks.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`✅ Saved to: ${outputPath}`);
    console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);

    // Step 9: Statistics
    console.log('📈 STATISTICS:');
    console.log('━'.repeat(50));
    console.log(`Total pages:              ${enrichedPages.length}`);
    console.log(`Pages with interlinks:    ${Object.keys(interlinks).length}`);
    console.log(`Total links generated:    ${totalLinks}`);
    console.log(`Average links per page:   ${(totalLinks / processedCount).toFixed(1)}`);
    console.log(`Estimated SEO impact:     ~${totalLinks} new internal links`);
    console.log('━'.repeat(50));
    console.log('\n✨ Interlinks generation complete!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  generateInterlinks();
}

module.exports = { generateInterlinks };
