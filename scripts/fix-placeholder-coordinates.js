const fs = require('fs');
const path = require('path');

console.log('=== FIX PLACEHOLDER COORDINATES ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const PLACEHOLDER_LAT = 48.8566;
const PLACEHOLDER_LNG = 2.3522;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be modified\n');
}

// Load geographic locations data
const idfCommunes = JSON.parse(fs.readFileSync(path.join(__dirname, 'idf-communes-complete.json'), 'utf8'));

// Create a map of slug -> coordinates
const coordinatesMap = new Map();
idfCommunes.forEach(commune => {
  coordinatesMap.set(commune.slug, {
    lat: commune.latitude || PLACEHOLDER_LAT,
    lng: commune.longitude || PLACEHOLDER_LNG
  });
});

console.log(`✓ Loaded coordinates for ${coordinatesMap.size} communes\n`);

/**
 * Parse frontmatter from markdown file
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Extract coordinates from frontmatter
 */
function extractCoordinates(frontmatter) {
  const latMatch = frontmatter.match(/^\s*lat:\s*([\d.]+)/m);
  const lngMatch = frontmatter.match(/^\s*lng:\s*([\d.]+)/m);

  if (!latMatch || !lngMatch) {
    return null;
  }

  return {
    lat: parseFloat(latMatch[1]),
    lng: parseFloat(lngMatch[1])
  };
}

/**
 * Update coordinates in content
 */
function updateCoordinates(content, newLat, newLng) {
  // Replace lat value
  content = content.replace(
    /^(\s*lat:\s*)[\d.]+/m,
    `$1${newLat}`
  );

  // Replace lng value
  content = content.replace(
    /^(\s*lng:\s*)[\d.]+/m,
    `$1${newLng}`
  );

  return content;
}

/**
 * Process all commune pages
 */
function fixCoordinates() {
  const stats = {
    total_pages: 0,
    placeholder_found: 0,
    updated: 0,
    no_match: 0,
    errors: []
  };

  const contentDir = path.join(__dirname, '..', 'content');
  const directories = fs.readdirSync(contentDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  stats.total_pages = directories.length;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SCANNING AND FIXING PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const slug of directories) {
    const indexPath = path.join(contentDir, slug, 'index.md');

    if (!fs.existsSync(indexPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(indexPath, 'utf8');
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter) {
        continue;
      }

      const coords = extractCoordinates(frontmatter);

      if (!coords) {
        continue;
      }

      // Check if using placeholder coordinates
      if (coords.lat === PLACEHOLDER_LAT && coords.lng === PLACEHOLDER_LNG) {
        stats.placeholder_found++;

        // Look up real coordinates
        const realCoords = coordinatesMap.get(slug);

        if (realCoords && (realCoords.lat !== PLACEHOLDER_LAT || realCoords.lng !== PLACEHOLDER_LNG)) {
          if (!DRY_RUN) {
            const updatedContent = updateCoordinates(content, realCoords.lat, realCoords.lng);
            fs.writeFileSync(indexPath, updatedContent, 'utf8');
          }

          stats.updated++;

          if (stats.updated <= 10) {
            console.log(`  ✓ ${slug}: ${coords.lat}, ${coords.lng} → ${realCoords.lat}, ${realCoords.lng}`);
          }
        } else {
          stats.no_match++;
          if (stats.no_match <= 5) {
            console.log(`  ⊘ ${slug}: No real coordinates available`);
          }
        }
      }

      // Progress update
      if (stats.updated % 100 === 0 && stats.updated > 0) {
        console.log(`\n  Progress: ${stats.updated} pages updated\n`);
      }

    } catch (error) {
      stats.errors.push({
        slug: slug,
        error: error.message
      });
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total pages scanned: ${stats.total_pages}`);
  console.log(`  Placeholder coordinates found: ${stats.placeholder_found}`);
  console.log(`  Pages updated: ${stats.updated}`);
  console.log(`  No real coordinates available: ${stats.no_match}`);
  console.log(`  Errors: ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors:');
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.slug}: ${err.error}`);
    });
    console.log('');
  }

  if (DRY_RUN) {
    console.log('💡 This was a DRY RUN - no files were modified');
    console.log('   Run without --dry-run to apply changes\n');
  } else {
    console.log(`✅ Successfully updated ${stats.updated} pages with real coordinates!\n`);
  }

  return stats;
}

// Run the fix
try {
  fixCoordinates();
} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
