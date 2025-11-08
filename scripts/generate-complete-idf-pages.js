const fs = require('fs');
const path = require('path');

console.log('=== GENERATE COMPLETE IDF COMMUNE PAGES ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const PRIORITY = process.argv.find(arg => arg.startsWith('--priority='))?.split('=')[1] || 'high';
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

console.log(`📊 Priority level: ${PRIORITY.toUpperCase()}`);
if (LIMIT > 0) {
  console.log(`🔢 Limit: ${LIMIT} pages\n`);
}

// Load data files
const prioritizedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'prioritized-communes.json'), 'utf8'));
const communeElectricians = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commune_electricians.json'), 'utf8'));

// Company names by department
const COMPANY_NAMES = {
  '75': 'Watt75',
  '77': 'ÉlecExpert77',
  '78': 'VoltPro78',
  '91': 'AmpèrePlus91',
  '92': 'AmpèrePro92',
  '93': 'ÉlecUrgence93',
  '94': 'VoltExpress94',
  '95': 'WattService95'
};

// Base phone numbers by department (will vary slightly)
const BASE_PHONES = {
  '75': '0644644699',
  '77': '0144901131',
  '78': '0644604830',
  '91': '0144901131',
  '92': '0644644699',
  '93': '0144901131',
  '94': '0644644699',
  '95': '0144901131'
};

/**
 * Format phone number for display
 */
function formatPhone(phoneRaw) {
  if (!phoneRaw || phoneRaw.length !== 10) return phoneRaw;
  return phoneRaw.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
}

/**
 * Capitalize city name properly
 */
function capitalizeCityName(name) {
  // Convert to uppercase for consistency
  return name.toUpperCase();
}

/**
 * Generate SEO-optimized title
 */
function generateTitle(cityName, zipCode) {
  return `⚡ Intervention Électricien ${cityName} | 24/7`;
}

/**
 * Generate meta description
 */
function generateDescription(cityName, zipCode) {
  return `Intervention électricien ${cityName} ${zipCode} ⚡ Panne, dépannage, réparation. Urgence 24h/7j. Technicien certifié. Devis gratuit. Appelez maintenant!`;
}

/**
 * Generate keyword
 */
function generateKeyword(cityName) {
  return `Intervention Électricien ${cityName}`;
}

/**
 * Generate image references
 */
function generateImages(slug, zipCode) {
  const baseSlug = slug.toLowerCase().replace(/'/g, '');
  return {
    hero: `electricien-urgence-${baseSlug}-${zipCode}-hero`,
    og: `electricien-${baseSlug}-${zipCode}-og`,
    featured: `electricien-${baseSlug}-${zipCode}-featured`,
    video: `electricien-${baseSlug}-${zipCode}-video`
  };
}

/**
 * Create frontmatter for Hugo page
 */
function createFrontmatter(commune) {
  const zipCode = Array.isArray(commune.postal_codes) ? commune.postal_codes[0] : commune.postal_codes;
  const department = commune.department;
  const phoneRaw = BASE_PHONES[department] || '0144901131';
  const phone = formatPhone(phoneRaw);
  const company = COMPANY_NAMES[department] || 'ÉlecPro';
  const cityName = commune.name;
  const cityUpper = capitalizeCityName(cityName);

  const frontmatter = {
    title: generateTitle(cityName, zipCode),
    slug: commune.slug,
    city: cityUpper,
    zipCode: zipCode,
    department: department,
    keyword: generateKeyword(cityName),
    company: company,
    phone: phone,
    phoneRaw: phoneRaw,
    description: generateDescription(cityName, zipCode),
    niche: 'électricité',
    kwSource: 'électricité',
    coordinates: {
      lat: commune.latitude || 48.8566,
      lng: commune.longitude || 2.3522
    },
    images: generateImages(commune.slug, zipCode),
    draft: false
  };

  return frontmatter;
}

/**
 * Convert frontmatter object to YAML string
 */
function frontmatterToYAML(frontmatter) {
  let yaml = '---\n';

  // Simple fields
  yaml += `title: "${frontmatter.title}"\n`;
  yaml += `slug: "${frontmatter.slug}"\n`;
  yaml += `city: "${frontmatter.city}"\n`;
  yaml += `zipCode: "${frontmatter.zipCode}"\n`;
  yaml += `department: "${frontmatter.department}"\n`;
  yaml += `keyword: "${frontmatter.keyword}"\n`;
  yaml += `company: "${frontmatter.company}"\n`;
  yaml += `phone: "${frontmatter.phone}"\n`;
  yaml += `phoneRaw: "${frontmatter.phoneRaw}"\n`;
  yaml += `description: "${frontmatter.description}"\n`;
  yaml += `niche: "${frontmatter.niche}"\n`;
  yaml += `kwSource: "${frontmatter.kwSource}"\n`;

  // Coordinates
  yaml += 'coordinates:\n';
  yaml += `  lat: ${frontmatter.coordinates.lat}\n`;
  yaml += `  lng: ${frontmatter.coordinates.lng}\n`;

  // Images
  yaml += 'images:\n';
  yaml += `  hero: "${frontmatter.images.hero}"\n`;
  yaml += `  og: "${frontmatter.images.og}"\n`;
  yaml += `  featured: "${frontmatter.images.featured}"\n`;
  yaml += `  video: "${frontmatter.images.video}"\n`;

  yaml += `draft: ${frontmatter.draft}\n`;
  yaml += '---\n';

  return yaml;
}

/**
 * Create Hugo page file
 */
function createPageFile(commune, contentDir) {
  const frontmatter = createFrontmatter(commune);
  const yaml = frontmatterToYAML(frontmatter);

  const communeDir = path.join(contentDir, commune.slug);
  const indexPath = path.join(communeDir, 'index.md');

  if (!DRY_RUN) {
    // Create directory if it doesn't exist
    if (!fs.existsSync(communeDir)) {
      fs.mkdirSync(communeDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(indexPath, yaml, 'utf8');
  }

  return indexPath;
}

/**
 * Main generation function
 */
function generatePages() {
  const stats = {
    total_to_generate: 0,
    generated: 0,
    skipped: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SELECTING COMMUNES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Select communes based on priority
  let communesToGenerate = [];
  if (PRIORITY === 'critical') {
    communesToGenerate = prioritizedData.priorities.critical;
  } else if (PRIORITY === 'high') {
    communesToGenerate = prioritizedData.priorities.high;
  } else if (PRIORITY === 'medium') {
    communesToGenerate = prioritizedData.priorities.medium;
  } else if (PRIORITY === 'low') {
    communesToGenerate = prioritizedData.priorities.low;
  } else if (PRIORITY === 'all') {
    communesToGenerate = [
      ...prioritizedData.priorities.critical,
      ...prioritizedData.priorities.high,
      ...prioritizedData.priorities.medium,
      ...prioritizedData.priorities.low
    ];
  }

  if (LIMIT > 0 && LIMIT < communesToGenerate.length) {
    console.log(`⚠ Limiting to first ${LIMIT} communes`);
    communesToGenerate = communesToGenerate.slice(0, LIMIT);
  }

  stats.total_to_generate = communesToGenerate.length;

  console.log(`Selected ${communesToGenerate.length} communes to generate\n`);

  // Group by department
  const byDepartment = {};
  communesToGenerate.forEach(c => {
    if (!byDepartment[c.department]) byDepartment[c.department] = 0;
    byDepartment[c.department]++;
  });

  console.log('Distribution:');
  Object.entries(byDepartment).sort().forEach(([dept, count]) => {
    console.log(`  Department ${dept}: ${count} communes`);
  });
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GENERATING PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const contentDir = path.join(__dirname, '..', 'content');

  for (const commune of communesToGenerate) {
    try {
      const hasElectricians = communeElectricians[commune.slug];
      const electricianCount = hasElectricians ? communeElectricians[commune.slug].length : 0;

      const filePath = createPageFile(commune, contentDir);
      stats.generated++;

      if (stats.generated <= 10 || stats.generated % 50 === 0) {
        const elecInfo = electricianCount > 0 ? ` (${electricianCount} electricians)` : '';
        console.log(`  ✓ ${commune.slug} (${commune.name}, ${commune.department})${elecInfo}`);
      }

    } catch (error) {
      stats.errors.push({
        commune: commune.slug,
        error: error.message
      });
      console.error(`  ❌ ${commune.slug}: ${error.message}`);
      stats.skipped++;
    }

    // Progress update
    if (stats.generated % 100 === 0) {
      const progress = ((stats.generated / stats.total_to_generate) * 100).toFixed(1);
      console.log(`\n  Progress: ${stats.generated}/${stats.total_to_generate} (${progress}%)\n`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GENERATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total to generate: ${stats.total_to_generate}`);
  console.log(`  Successfully generated: ${stats.generated}`);
  console.log(`  Skipped/Errors: ${stats.skipped}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (${stats.errors.length} total):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.commune}: ${err.error}`);
    });
    console.log('');
  }

  if (DRY_RUN) {
    console.log('💡 This was a DRY RUN - no files were actually created');
    console.log('   Run without --dry-run to create the files\n');

    // Show example frontmatter
    if (communesToGenerate.length > 0) {
      console.log('Example frontmatter for first commune:');
      console.log('─'.repeat(60));
      const exampleFrontmatter = createFrontmatter(communesToGenerate[0]);
      console.log(frontmatterToYAML(exampleFrontmatter));
      console.log('─'.repeat(60));
      console.log('');
    }
  }

  console.log('Usage:');
  console.log('  node scripts/generate-complete-idf-pages.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run              Preview without creating files');
  console.log('  --priority=LEVEL       Priority level: critical, high, medium, low, all (default: high)');
  console.log('  --limit=N              Limit to N pages (default: unlimited)');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/generate-complete-idf-pages.js --dry-run --priority=high --limit=10');
  console.log('  node scripts/generate-complete-idf-pages.js --priority=high');
  console.log('  node scripts/generate-complete-idf-pages.js --priority=all\n');

  return stats;
}

// Run generation
try {
  generatePages();
} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
