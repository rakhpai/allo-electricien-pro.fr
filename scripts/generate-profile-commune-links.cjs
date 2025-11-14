#!/usr/bin/env node

/**
 * GENERATE PROFILE-TO-COMMUNE SEO LINKS
 * ======================================
 *
 * Creates optimized internal links from electrician profile pages
 * to important commune pages (with videos only).
 *
 * Source: electricien_profiles.json, sitemap_pages.json, commune_videos.json
 * Output: data/profile_commune_links.json
 *
 * Usage: node scripts/generate-profile-commune-links.cjs
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  MIN_LINKS_PER_PROFILE: 10,
  MAX_LINKS_PER_PROFILE: 15,
  PRIORITIZE_PARIS: true,        // Always include Paris arrondissements if dept 75 in coverage
  PARIS_LINKS_MIN: 4,             // Minimum Paris links if dept 75 in coverage
  PARIS_LINKS_MAX: 6,             // Maximum Paris links
  TIER_B_WEIGHT: 10,              // Priority weight for Tier B (Paris arrondissements)
  TIER_C_WEIGHT: 5,               // Priority weight for Tier C (major suburbs)
  TIER_D_WEIGHT: 1,               // Priority weight for Tier D (other cities)
};

// SEO-optimized anchor text patterns (10 patterns for variety)
const ANCHOR_PATTERNS = [
  { template: "électricien {commune}", weight: 15, type: "exact" },
  { template: "dépannage électrique {commune}", weight: 12, type: "service" },
  { template: "électricien d'urgence {commune}", weight: 12, type: "longtail" },
  { template: "intervention électricien {commune}", weight: 10, type: "partial" },
  { template: "sos électricien {commune}", weight: 10, type: "keyword" },
  { template: "dépannage électricité {commune}", weight: 10, type: "keyword" },
  { template: "service électricien {commune}", weight: 8, type: "branded" },
  { template: "urgence électrique {commune}", weight: 8, type: "urgency" },
  { template: "nos électriciens {commune}", weight: 8, type: "branded" },
  { template: "{commune}", weight: 7, type: "generic" }
];

// Anchor distribution pattern for 10 links (ensures variety)
// Positions:      0     1     2     3     4     5     6     7     8     9
const ANCHOR_DISTRIBUTION = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1];
// Pattern types: exact, service, longtail, partial, keyword, keyword, branded, urgency, branded, service

/**
 * Slugify text for URLs
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Select anchor pattern based on index (ensures variety)
 */
function selectAnchorPattern(index) {
  const patternIndex = ANCHOR_DISTRIBUTION[index % ANCHOR_DISTRIBUTION.length];
  return ANCHOR_PATTERNS[patternIndex];
}

/**
 * Generate anchor text from pattern
 */
function generateAnchor(template, cityName) {
  return template.replace('{commune}', cityName);
}

/**
 * Extract slug from URL path
 */
function extractSlug(urlPath) {
  return urlPath.replace(/^\//, '').replace(/\/$/, '');
}

/**
 * Calculate weighted score for city priority
 */
function calculateCityScore(city) {
  let score = 0;

  // Tier weighting
  if (city.tier === 'B') score += CONFIG.TIER_B_WEIGHT;
  else if (city.tier === 'C') score += CONFIG.TIER_C_WEIGHT;
  else score += CONFIG.TIER_D_WEIGHT;

  // Bonus for videos (all should have it since we filter, but just in case)
  if (city.has_video) score += 2;

  // Paris arrondissements get extra boost
  if (city.department === '75') score += 5;

  return score;
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Select cities for a profile based on coverage zones
 */
function selectCitiesForProfile(profile, allCitiesWithVideo, profileSlug) {
  const coverageZones = profile.coverage_zones || [];
  const selectedCities = [];

  // Convert coverage zones to strings for comparison
  const coverageZonesStr = coverageZones.map(z => String(z));

  // Separate Paris arrondissements from other cities
  const parisCities = [];
  const otherCities = [];

  allCitiesWithVideo.forEach(city => {
    if (coverageZonesStr.includes(city.department)) {
      if (city.department === '75') {
        parisCities.push(city);
      } else {
        otherCities.push(city);
      }
    }
  });

  // Sort both by score (highest priority first)
  parisCities.sort((a, b) => calculateCityScore(b) - calculateCityScore(a));
  otherCities.sort((a, b) => calculateCityScore(b) - calculateCityScore(a));

  // Determine how many links total
  const targetLinks = Math.min(
    CONFIG.MAX_LINKS_PER_PROFILE,
    Math.max(CONFIG.MIN_LINKS_PER_PROFILE, parisCities.length + otherCities.length)
  );

  // If profile covers Paris (dept 75), always include Paris links
  let parisLinksCount = 0;
  let otherLinksCount = 0;

  if (coverageZonesStr.includes('75') && parisCities.length > 0) {
    parisLinksCount = Math.min(
      Math.max(CONFIG.PARIS_LINKS_MIN, Math.floor(targetLinks * 0.4)),
      CONFIG.PARIS_LINKS_MAX,
      parisCities.length
    );
    otherLinksCount = targetLinks - parisLinksCount;
  } else {
    otherLinksCount = targetLinks;
  }

  // Add Paris cities
  for (let i = 0; i < parisLinksCount && i < parisCities.length; i++) {
    selectedCities.push(parisCities[i]);
  }

  // Add other cities (distribute across departments if possible)
  const cityCountByDept = {};
  const remainingCities = [...otherCities];

  // Try to balance across departments
  for (let i = 0; i < otherLinksCount && remainingCities.length > 0; i++) {
    // Find city from least-represented department
    remainingCities.sort((a, b) => {
      const countA = cityCountByDept[a.department] || 0;
      const countB = cityCountByDept[b.department] || 0;
      if (countA !== countB) return countA - countB;
      return calculateCityScore(b) - calculateCityScore(a);
    });

    const city = remainingCities.shift();
    selectedCities.push(city);
    cityCountByDept[city.department] = (cityCountByDept[city.department] || 0) + 1;
  }

  // Shuffle to avoid predictable patterns
  return shuffleArray(selectedCities);
}

/**
 * Generate links data for all profiles
 */
function generateProfileLinks(profiles, allCitiesWithVideo) {
  const profileLinks = {};
  const stats = {
    total_profiles: profiles.all_profiles.length,
    profiles_with_links: 0,
    total_links_generated: 0,
    links_per_profile: {
      min: Infinity,
      max: 0,
      avg: 0
    },
    cities_linked_count: {},
    anchor_type_distribution: {}
  };

  profiles.all_profiles.forEach((profile, index) => {
    const firstName = slugify(profile.first_name || '');
    const lastName = slugify(profile.last_name || '');
    const shortId = profile.id.split('-')[0];
    const profileSlug = `${firstName}-${lastName}-${shortId}`;

    // Select cities for this profile
    const selectedCities = selectCitiesForProfile(profile, allCitiesWithVideo, profileSlug);

    if (selectedCities.length === 0) {
      console.log(`⚠️  ${profile.first_name} ${profile.last_name}: No cities found in coverage zones`);
      return;
    }

    // Generate link objects with varied anchors
    const links = selectedCities.map((city, linkIndex) => {
      const anchorPattern = selectAnchorPattern(linkIndex);
      const anchorText = generateAnchor(anchorPattern.template, city.city_name);
      const slug = extractSlug(city.url_path);

      // Track stats
      stats.anchor_type_distribution[anchorPattern.type] =
        (stats.anchor_type_distribution[anchorPattern.type] || 0) + 1;
      stats.cities_linked_count[slug] = (stats.cities_linked_count[slug] || 0) + 1;

      return {
        slug: slug,
        city: city.city_name,
        url: city.url_path,
        anchor: anchorText,
        anchor_type: anchorPattern.type,
        department: city.department,
        has_video: city.has_video,
        tier: city.tier
      };
    });

    profileLinks[profileSlug] = links;

    // Update stats
    stats.profiles_with_links++;
    stats.total_links_generated += links.length;
    stats.links_per_profile.min = Math.min(stats.links_per_profile.min, links.length);
    stats.links_per_profile.max = Math.max(stats.links_per_profile.max, links.length);

    // Progress indicator
    if ((index + 1) % 50 === 0) {
      console.log(`✓ Processed ${index + 1}/${profiles.all_profiles.length} profiles`);
    }
  });

  // Calculate average
  stats.links_per_profile.avg = (stats.total_links_generated / stats.profiles_with_links).toFixed(1);

  return {
    generated_at: new Date().toISOString(),
    config: CONFIG,
    stats: stats,
    by_profile: profileLinks
  };
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('GENERATE PROFILE-TO-COMMUNE LINKS (VIDEO PAGES ONLY)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load data files
  console.log('📂 Loading data files...\n');

  const profilesPath = path.join(__dirname, '..', 'data', 'electricien_profiles.json');
  const sitemapPath = path.join(__dirname, '..', 'data', 'sitemap_pages.json');
  const videosPath = path.join(__dirname, '..', 'data', 'commune_videos.json');

  if (!fs.existsSync(profilesPath)) {
    console.error('❌ Error: electricien_profiles.json not found');
    process.exit(1);
  }

  if (!fs.existsSync(sitemapPath)) {
    console.error('❌ Error: sitemap_pages.json not found');
    process.exit(1);
  }

  if (!fs.existsSync(videosPath)) {
    console.error('❌ Error: commune_videos.json not found');
    process.exit(1);
  }

  const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const sitemap = JSON.parse(fs.readFileSync(sitemapPath, 'utf8'));
  const communeVideos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));

  console.log(`✓ Loaded ${profiles.all_profiles.length} electrician profiles`);
  console.log(`✓ Loaded ${sitemap.stats.total_pages} sitemap pages`);
  console.log(`✓ Loaded ${Object.keys(communeVideos).length} commune videos\n`);

  // Build list of all cities with videos (from sitemap, filtered by commune_videos)
  console.log('🎬 Filtering for video-enabled cities only...\n');

  const allCitiesWithVideo = [];
  const videoSlugs = new Set(Object.keys(communeVideos));

  // Process Tier B (Paris arrondissements)
  if (sitemap.organized.tier_b && sitemap.organized.tier_b.paris) {
    sitemap.organized.tier_b.paris.forEach(city => {
      const slug = extractSlug(city.url_path);
      if (videoSlugs.has(slug)) {
        allCitiesWithVideo.push(city);
      }
    });
  }

  // Process Tier C (major suburbs) by department
  if (sitemap.organized.tier_c_by_dept) {
    Object.values(sitemap.organized.tier_c_by_dept).forEach(deptCities => {
      if (Array.isArray(deptCities)) {
        deptCities.forEach(city => {
          const slug = extractSlug(city.url_path);
          if (videoSlugs.has(slug)) {
            allCitiesWithVideo.push(city);
          }
        });
      }
    });
  }

  // Process Tier D (other cities)
  if (sitemap.organized.tier_d_by_dept) {
    Object.values(sitemap.organized.tier_d_by_dept).forEach(deptCities => {
      if (Array.isArray(deptCities)) {
        deptCities.forEach(city => {
          const slug = extractSlug(city.url_path);
          if (videoSlugs.has(slug) && city.has_video) {
            allCitiesWithVideo.push(city);
          }
        });
      }
    });
  }

  console.log(`✓ Found ${allCitiesWithVideo.length} cities with videos\n`);
  console.log(`   Tier B (Paris): ${allCitiesWithVideo.filter(c => c.tier === 'B').length}`);
  console.log(`   Tier C (Major suburbs): ${allCitiesWithVideo.filter(c => c.tier === 'C').length}`);
  console.log(`   Tier D (Other cities): ${allCitiesWithVideo.filter(c => c.tier === 'D').length}\n`);

  // Generate links for all profiles
  console.log('🔗 Generating profile-to-commune links...\n');

  const result = generateProfileLinks(profiles, allCitiesWithVideo);

  // Print statistics
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('GENERATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Statistics:\n');
  console.log(`Total profiles:           ${result.stats.total_profiles}`);
  console.log(`Profiles with links:      ${result.stats.profiles_with_links}`);
  console.log(`Total links generated:    ${result.stats.total_links_generated}`);
  console.log(`\nLinks per profile:`);
  console.log(`  Minimum:                ${result.stats.links_per_profile.min}`);
  console.log(`  Maximum:                ${result.stats.links_per_profile.max}`);
  console.log(`  Average:                ${result.stats.links_per_profile.avg}`);

  console.log(`\nAnchor text distribution:`);
  Object.entries(result.stats.anchor_type_distribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const percentage = ((count / result.stats.total_links_generated) * 100).toFixed(1);
      console.log(`  ${type.padEnd(15)} ${count.toString().padStart(5)} (${percentage}%)`);
    });

  // Top 10 most-linked cities
  console.log(`\nTop 10 most-linked cities:`);
  Object.entries(result.stats.cities_linked_count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([slug, count], index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${slug.padEnd(30)} ${count} links`);
    });

  // Save to file
  const outputPath = path.join(__dirname, '..', 'data', 'profile_commune_links.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\n✅ Data saved to: data/profile_commune_links.json`);
  console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB\n`);

  // Sample links
  const sampleProfiles = Object.keys(result.by_profile).slice(0, 3);
  console.log('📝 Sample links (first 3 profiles):\n');

  sampleProfiles.forEach(profileSlug => {
    const links = result.by_profile[profileSlug];
    console.log(`Profile: ${profileSlug}`);
    console.log(`  Total links: ${links.length}`);
    console.log(`  Sample anchors:`);
    links.slice(0, 5).forEach(link => {
      console.log(`    • "${link.anchor}" → ${link.url} [${link.tier}, ${link.department}]`);
    });
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
