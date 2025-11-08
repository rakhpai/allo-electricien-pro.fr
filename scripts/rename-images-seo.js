#!/usr/bin/env node

/**
 * SEO Image Rename & Alt Tag Optimization Script
 *
 * Renames all images with SEO-friendly filenames and updates frontmatter
 * Based on city name, postal code, and image type
 *
 * Usage:
 *   node scripts/rename-images-seo.js --dry-run          # Generate mapping only
 *   node scripts/rename-images-seo.js --test             # Test on 10 cities
 *   node scripts/rename-images-seo.js --execute          # Full migration
 */

const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================

const CONFIG = {
  dataPath: path.join(__dirname, '../data/sites.json'),
  contentPath: path.join(__dirname, '../content'),
  imagesPath: path.join(__dirname, '../static/images'),
  backupPath: path.join(__dirname, '../backups'),

  imageTypes: ['hero', 'og', 'featured', 'video'],
  imageFormats: ['jpg', 'webp', 'avif'],

  // Test cities (10 diverse examples)
  testCities: [
    'rueil-malmaison',
    'paris-1',
    'versailles',
    'nanterre',
    'melun',
    'argenteuil',
    'sarcelles',
    'ablon-sur-seine',
    'paris-20',
    'paris-4'
  ],

  // Command line modes
  dryRun: process.argv.includes('--dry-run'),
  testMode: process.argv.includes('--test'),
  executeMode: process.argv.includes('--execute'),
  verbose: process.argv.includes('--verbose')
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Format city name for filename (ASCII-only, lowercase, hyphens)
 * Removes accents, special characters, normalizes spacing
 */
function formatCityForFilename(cityName) {
  return cityName
    .toLowerCase()
    // Remove accents (é → e, à → a, etc.)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Handle apostrophes and special characters
    .replace(/'/g, '-')           // Apostrophes to hyphens
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '')    // Remove non-alphanumeric except hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '');        // Trim leading/trailing hyphens
}

/**
 * Format city name for display (Title Case, proper French formatting)
 */
function formatCityForDisplay(cityName) {
  return cityName
    .toLowerCase()
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    // Fix common French patterns
    .replace(/\bD\b/g, "d'")       // "Ville D Avray" → "Ville d'Avray"
    .replace(/\bL\b/g, "l'")       // "L Hay" → "l'Hay"
    .replace(/\b(\d+)(er|e|eme)\b/gi, (match, num, suffix) => {
      // Handle arrondissements: "1er", "2e", "20e"
      if (num === '1') return '1er';
      return num + 'e';
    });
}

/**
 * Generate SEO-optimized filename
 * Format: electricien-urgence-{city-slug}-{zip}-{type}
 */
function generateSeoFilename(city, zipCode, type) {
  const citySlug = formatCityForFilename(city);
  const service = type === 'hero' ? 'urgence' : '';
  const parts = ['electricien', service, citySlug, zipCode, type].filter(Boolean);

  return parts.join('-');
}

/**
 * Generate SEO-optimized alt tag text
 */
function generateAltTag(city, zipCode, type) {
  const cityFormatted = formatCityForDisplay(city);

  const templates = {
    hero: `Électricien d'urgence à ${cityFormatted} (${zipCode}) - Dépannage 24/7`,
    og: `Service électricien professionnel ${cityFormatted} ${zipCode}`,
    featured: `Électricien certifié ${cityFormatted} - Intervention ${zipCode.substring(0, 2)}`,
    video: `Vidéo électricien ${cityFormatted} ${zipCode}`
  };

  return templates[type] || templates.hero;
}

/**
 * Read frontmatter from markdown file
 */
function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      frontmatter[key.trim()] = value;
    }
  }

  return { frontmatter, fullContent: content };
}

/**
 * Extract current image references from content
 */
function extractImageReferences(content) {
  const images = {};
  const imageMatch = content.match(/images:\s*\n([\s\S]*?)(?=\n\w+:|---|\n\n)/);

  if (imageMatch) {
    const imageBlock = imageMatch[1];
    const heroMatch = imageBlock.match(/hero:\s*"([^"]+)"/);
    const ogMatch = imageBlock.match(/og:\s*"([^"]+)"/);
    const featuredMatch = imageBlock.match(/featured:\s*"([^"]+)"/);
    const videoMatch = imageBlock.match(/video:\s*"([^"]+)"/);

    if (heroMatch) images.hero = heroMatch[1].replace(/-hero$/, '');
    if (ogMatch) images.og = ogMatch[1].replace(/-og$/, '');
    if (featuredMatch) images.featured = featuredMatch[1].replace(/-featured$/, '');
    if (videoMatch) images.video = videoMatch[1].replace(/-video$/, '');
  }

  return images;
}

/**
 * Create backup before migration
 */
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(CONFIG.backupPath, `backup-${timestamp}`);

  console.log('\n📦 Creating backup...');

  if (!fs.existsSync(CONFIG.backupPath)) {
    fs.mkdirSync(CONFIG.backupPath, { recursive: true });
  }

  fs.mkdirSync(backupDir, { recursive: true });

  // Note: For full backup, you'd use cp -r or tar
  console.log(`   Backup directory created: ${backupDir}`);
  console.log('   ℹ️  Run manually: tar -czf backups/images.tar.gz static/images/');
  console.log('   ℹ️  Run manually: tar -czf backups/content.tar.gz content/\n');

  return backupDir;
}

/**
 * Log with optional verbose mode
 */
function log(message, level = 'info') {
  if (level === 'verbose' && !CONFIG.verbose) return;

  const prefix = {
    info: '  ',
    success: '✓ ',
    error: '✗ ',
    verbose: '  ➜ '
  }[level] || '  ';

  console.log(prefix + message);
}

// ==================== MAIN PROCESS ====================

async function main() {
  console.log('\n🔧 SEO Image Rename & Alt Tag Optimization\n');
  console.log('━'.repeat(60));

  // Determine mode
  let mode = 'dry-run';
  if (CONFIG.executeMode) mode = 'execute';
  else if (CONFIG.testMode) mode = 'test';

  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log('━'.repeat(60) + '\n');

  // 1. Load sites data
  console.log('📊 Loading site data...');

  if (!fs.existsSync(CONFIG.dataPath)) {
    console.error(`✗ Error: Data file not found at ${CONFIG.dataPath}`);
    process.exit(1);
  }

  const sitesData = JSON.parse(fs.readFileSync(CONFIG.dataPath, 'utf8'));
  console.log(`   Loaded ${sitesData.sites.length} sites\n`);

  // 2. Build mapping for all cities
  console.log('🗺️  Building filename mapping...\n');

  const mapping = [];
  const imageUsageMap = new Map(); // Track which cities use which images
  const errors = [];

  for (const site of sitesData.sites) {
    try {
      const citySlug = site.slug || formatCityForFilename(site.city);
      const contentFile = path.join(CONFIG.contentPath, citySlug, 'index.md');

      if (!fs.existsSync(contentFile)) {
        errors.push(`Content file not found for: ${citySlug}`);
        continue;
      }

      // Read current image references
      const { fullContent } = readFrontmatter(contentFile);
      const currentImages = extractImageReferences(fullContent);

      if (!currentImages.hero) {
        errors.push(`No hero image reference in: ${citySlug}`);
        continue;
      }

      const currentBase = currentImages.hero; // e.g., "elec-013"

      // Track image usage (for identifying shared images)
      if (!imageUsageMap.has(currentBase)) {
        imageUsageMap.set(currentBase, []);
      }
      imageUsageMap.get(currentBase).push(citySlug);

      // Generate new SEO-friendly base name
      const newBase = generateSeoFilename(site.city, site.zipCode, 'base').replace(/-base$/, '');

      // Create mapping entry
      const mapEntry = {
        citySlug,
        city: site.city,
        zipCode: site.zipCode,
        department: site.zipCode.substring(0, 2),
        oldBase: currentBase,
        newBase,
        newFilenames: {},
        altTags: {},
        isShared: false // Will update after checking all cities
      };

      // Generate new filenames for each type
      for (const type of CONFIG.imageTypes) {
        mapEntry.newFilenames[type] = generateSeoFilename(site.city, site.zipCode, type);
        mapEntry.altTags[type] = generateAltTag(site.city, site.zipCode, type);
      }

      mapping.push(mapEntry);

    } catch (error) {
      errors.push(`Error processing ${site.city}: ${error.message}`);
    }
  }

  // Mark shared images
  let sharedCount = 0;
  for (const entry of mapping) {
    const usageCount = imageUsageMap.get(entry.oldBase)?.length || 0;
    if (usageCount > 1) {
      entry.isShared = true;
      entry.sharedWith = imageUsageMap.get(entry.oldBase).filter(slug => slug !== entry.citySlug);
      sharedCount++;
    }
  }

  console.log(`   Generated ${mapping.length} mappings`);
  console.log(`   Found ${sharedCount} cities sharing images`);
  console.log(`   Unique source images: ${imageUsageMap.size}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} warnings/errors:`);
    errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
    if (errors.length > 5) console.log(`   ... and ${errors.length - 5} more`);
  }

  // 3. Save mapping file
  const mappingPath = path.join(__dirname, '../data/image-rename-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\n✅ Mapping saved to: ${mappingPath}\n`);

  // Filter for test mode
  let citiesToProcess = mapping;
  if (mode === 'test') {
    citiesToProcess = mapping.filter(m => CONFIG.testCities.includes(m.citySlug));
    console.log(`\n🧪 TEST MODE: Processing ${citiesToProcess.length} cities\n`);
    citiesToProcess.forEach(m => console.log(`   - ${m.city} (${m.citySlug})`));
    console.log('');
  }

  if (mode === 'dry-run') {
    console.log('🔍 DRY RUN COMPLETE - No changes made\n');
    console.log('Next steps:');
    console.log('1. Review mapping file:');
    console.log(`   cat ${mappingPath} | jq '.[:5]'`);
    console.log('2. Run test migration:');
    console.log('   node scripts/rename-images-seo.js --test');
    console.log('');
    return;
  }

  // 4. Create backup (for execute/test modes)
  if (mode === 'execute') {
    createBackup();
  }

  // 5. Duplicate shared images (create unique copy for each city)
  console.log('📋 Duplicating shared images for unique naming...\n');

  let duplicatedCount = 0;
  const duplicatedImages = new Set();

  for (const mapEntry of citiesToProcess) {
    if (!mapEntry.isShared) continue;

    // For each image type and format, copy from old to new
    for (const type of CONFIG.imageTypes) {
      for (const format of CONFIG.imageFormats) {
        const oldFilename = `${mapEntry.oldBase}-${type}.${format}`;
        const newFilename = `${mapEntry.newFilenames[type]}.${format}`;
        const oldPath = path.join(CONFIG.imagesPath, type, oldFilename);
        const newPath = path.join(CONFIG.imagesPath, type, newFilename);

        // Skip if source doesn't exist (e.g., video directory is empty)
        if (!fs.existsSync(oldPath)) {
          log(`Skipping (source not found): ${oldFilename}`, 'verbose');
          continue;
        }

        // Skip if destination already exists
        if (fs.existsSync(newPath)) {
          log(`Skipping (already exists): ${newFilename}`, 'verbose');
          continue;
        }

        // Copy file
        fs.copyFileSync(oldPath, newPath);
        duplicatedImages.add(`${type}/${newFilename}`);
        duplicatedCount++;

        if (duplicatedCount % 50 === 0) {
          log(`Duplicated ${duplicatedCount} shared image files...`);
        }
      }
    }
  }

  console.log(`✅ Duplicated ${duplicatedCount} shared image files\n`);

  // 6. Rename unique images (not shared, or first occurrence)
  console.log('📦 Renaming unique image files...\n');

  let renamedCount = 0;
  const processedBases = new Set();

  for (const mapEntry of citiesToProcess) {
    // Skip if we already processed this base (for shared images)
    if (processedBases.has(mapEntry.oldBase)) continue;
    processedBases.add(mapEntry.oldBase);

    // Skip if this is a shared image (already duplicated above)
    if (mapEntry.isShared) continue;

    // Rename all formats for this unique image
    for (const type of CONFIG.imageTypes) {
      for (const format of CONFIG.imageFormats) {
        const oldFilename = `${mapEntry.oldBase}-${type}.${format}`;
        const newFilename = `${mapEntry.newFilenames[type]}.${format}`;
        const oldPath = path.join(CONFIG.imagesPath, type, oldFilename);
        const newPath = path.join(CONFIG.imagesPath, type, newFilename);

        if (!fs.existsSync(oldPath)) {
          log(`Skipping (not found): ${oldFilename}`, 'verbose');
          continue;
        }

        if (fs.existsSync(newPath)) {
          log(`Skipping (already exists): ${newFilename}`, 'verbose');
          continue;
        }

        fs.renameSync(oldPath, newPath);
        renamedCount++;

        if (renamedCount % 50 === 0) {
          log(`Renamed ${renamedCount} unique image files...`);
        }
      }
    }
  }

  console.log(`✅ Renamed ${renamedCount} unique image files\n`);

  // 7. Update frontmatter in content files
  console.log('📝 Updating frontmatter references...\n');

  let updatedCount = 0;

  for (const mapEntry of citiesToProcess) {
    const contentFile = path.join(CONFIG.contentPath, mapEntry.citySlug, 'index.md');

    if (!fs.existsSync(contentFile)) {
      log(`Content file not found: ${mapEntry.citySlug}`, 'error');
      continue;
    }

    let content = fs.readFileSync(contentFile, 'utf8');

    // Build new images block
    const newImagesBlock = `images:
  hero: "${mapEntry.newFilenames.hero}"
  og: "${mapEntry.newFilenames.og}"
  featured: "${mapEntry.newFilenames.featured}"
  video: "${mapEntry.newFilenames.video}"`;

    // Replace images block
    content = content.replace(
      /images:\s*\n\s*hero:.*\n\s*og:.*\n\s*featured:.*\n\s*video:.*/,
      newImagesBlock
    );

    fs.writeFileSync(contentFile, content);
    updatedCount++;

    if (updatedCount % 50 === 0) {
      log(`Updated ${updatedCount} frontmatter files...`);
    }
  }

  console.log(`✅ Updated ${updatedCount} frontmatter files\n`);

  // 8. Generate completion report
  const report = {
    timestamp: new Date().toISOString(),
    mode,
    stats: {
      citiesProcessed: citiesToProcess.length,
      totalCities: mapping.length,
      sharedImagesCopied: duplicatedCount,
      uniqueImagesRenamed: renamedCount,
      frontmatterUpdated: updatedCount,
      totalFiles: duplicatedCount + renamedCount
    },
    testCities: mode === 'test' ? CONFIG.testCities : null,
    sampleMappings: citiesToProcess.slice(0, 5).map(m => ({
      city: m.city,
      oldHero: `${m.oldBase}-hero.jpg`,
      newHero: `${m.newFilenames.hero}.jpg`,
      altTag: m.altTags.hero,
      isShared: m.isShared
    }))
  };

  const reportPath = path.join(__dirname, `../data/migration-report-${mode}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('━'.repeat(60));
  console.log('✅ MIGRATION COMPLETE!\n');
  console.log(`📊 Report saved to: ${reportPath}\n`);

  // 9. Next steps
  console.log('Next steps:');

  if (mode === 'test') {
    console.log('1. Test the migrated cities:');
    console.log('   hugo server');
    console.log('   # Visit test city pages and check images');
    console.log('2. Review the test results');
    console.log('3. If good, run full migration:');
    console.log('   node scripts/rename-images-seo.js --execute\n');
  } else {
    console.log('1. Update Hugo templates (alt tags):');
    console.log('   - layouts/_default/single.html (line 26)');
    console.log('   - layouts/partials/hero.html (line 9)');
    console.log('   - layouts/partials/head.html (OG image alt)');
    console.log('2. Rebuild site:');
    console.log('   hugo --gc --minify');
    console.log('3. Test locally:');
    console.log('   hugo server');
    console.log('4. Deploy to production\n');
  }
}

// ==================== RUN ====================

main().catch(error => {
  console.error('\n✗ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
