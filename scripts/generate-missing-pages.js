/**
 * Generate Missing Hugo Pages Script
 * Creates 169 missing commune pages based on image mapping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  mappingPath: path.join(__dirname, '../../elec/data/image-mapping.json'),
  contentPath: path.join(__dirname, '../content'),
  templatesPath: path.join(__dirname, '../archetypes')
};

/**
 * Generate phone number in format: 06 44 XX XX XX
 * Based on department code for variety
 */
function generatePhoneNumber(department) {
  const base = '06 44';
  const seed = parseInt(department) || 60;
  const part1 = (60 + (seed % 40)).toString().padStart(2, '0');
  const part2 = (40 + (seed % 30)).toString().padStart(2, '0');
  const part3 = (20 + (seed % 40)).toString().padStart(2, '0');
  return `${base} ${part1} ${part2} ${part3}`;
}

/**
 * Generate company name from commune name
 * Example: "VERSAILLES" → "VERSAILLESExpert"
 */
function generateCompanyName(communeName) {
  const cleaned = communeName.replace(/[^A-Z]/g, '');
  return `${cleaned}Expert`;
}

/**
 * Generate SEO title
 */
function generateTitle(communeName, postalCode) {
  return `⚡ Électricien Urgence ${communeName} | Dépannage ${postalCode}`;
}

/**
 * Generate SEO description
 */
function generateDescription(communeName, department) {
  return `Électricien d'urgence ${communeName} ${department} ⚡ Court-circuit, panne, installation. Intervention 24h/7j garantie. Devis gratuit. Artisan qualifié. Appelez maintenant!`;
}

/**
 * Generate Hugo frontmatter for a commune
 */
function generateFrontmatter(commune) {
  const phone = generatePhoneNumber(commune.department);
  const phoneRaw = phone.replace(/\s/g, '');

  return `---
title: "${generateTitle(commune.communeName, commune.postalCode)}"
slug: "${commune.communeSlug}"
city: "${commune.communeName}"
zipCode: "${commune.postalCode}"
department: "${commune.department}"
keyword: "Électricien Urgence ${commune.communeName}"
company: "${generateCompanyName(commune.communeName)}"
phone: "${phone}"
phoneRaw: "${phoneRaw}"
description: "${generateDescription(commune.communeName, commune.department)}"
niche: "électricité"
kwSource: "électricité"
coordinates:
  lat: 48.8566
  lng: 2.3522
images:
  hero: "${commune.images.hero}"
  og: "${commune.images.og}"
  featured: "${commune.images.featured}"
  video: "${commune.images.video}"
draft: false
---

`;
}

/**
 * Create directory if it doesn't exist
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate missing pages
 */
async function generateMissingPages() {
  console.log('🚀 Generating Missing Hugo Pages\n');

  // Load image mapping
  console.log('📂 Loading image mapping...');
  const mapping = JSON.parse(fs.readFileSync(CONFIG.mappingPath, 'utf8'));
  console.log(`✓ Loaded ${mapping.length} commune mappings\n`);

  // Filter missing pages
  const missingPages = mapping.filter(commune => !commune.pageExists);
  console.log(`📄 Found ${missingPages.length} missing pages to generate\n`);

  if (missingPages.length === 0) {
    console.log('✅ No missing pages to generate!');
    return { created: 0, skipped: 0 };
  }

  // Generate pages
  let created = 0;
  let skipped = 0;
  let errors = 0;

  console.log('⚙️  Generating pages...');

  for (const commune of missingPages) {
    try {
      const communeDir = path.join(CONFIG.contentPath, commune.communeSlug);
      const indexPath = path.join(communeDir, 'index.md');

      // Check if page already exists (safety check)
      if (fs.existsSync(indexPath)) {
        console.log(`   ⊘ Skipped ${commune.communeSlug} (already exists)`);
        skipped++;
        continue;
      }

      // Create directory
      ensureDir(communeDir);

      // Generate frontmatter
      const content = generateFrontmatter(commune);

      // Write file
      fs.writeFileSync(indexPath, content, 'utf8');

      created++;

      // Log progress every 10 pages
      if (created % 10 === 0) {
        console.log(`   ✓ Created ${created}/${missingPages.length} pages...`);
      }

    } catch (error) {
      console.error(`   ✗ Error creating ${commune.communeSlug}:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Generation complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}\n`);

  // Generate report
  const reportPath = path.join(__dirname, '../data/page-generation-report.json');
  const report = {
    generated: new Date().toISOString(),
    stats: {
      total: missingPages.length,
      created,
      skipped,
      errors
    },
    createdPages: missingPages.slice(0, created).map(c => ({
      slug: c.communeSlug,
      name: c.communeName,
      department: c.department,
      image: c.imageBasePath
    }))
  };

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 Report saved to: ${reportPath}\n`);

  console.log('✅ Page generation complete!\n');
  console.log('Next steps:');
  console.log('1. Review generated pages in content/ directory');
  console.log('2. Update coordinates for new communes (currently using placeholder)');
  console.log('3. Update existing page frontmatter with image fields');
  console.log('4. Build Hugo site to test\n');

  return { created, skipped, errors };
}

// Run if called directly
if (process.argv[1].includes('generate-missing-pages')) {
  generateMissingPages().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { generateMissingPages, generateFrontmatter };
