import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSEOImageName } from '../utils/image-seo-namer.js';
import cliProgress from 'cli-progress';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('UPDATE HUGO FRONTMATTER WITH SEO IMAGE NAMES');
console.log('═══════════════════════════════════════════════════════════\n');

// Configuration
const CONFIG = {
  hugoContentDir: path.resolve(__dirname, '../../../content'),
  supabaseUrl: process.env.SUPABASE_URL,
  cdnBucket: 'processed-images',
  siteDomain: 'allo-electricien.pro',
  variantTypes: ['hero', 'og', 'featured', 'video'],
  formats: ['avif', 'webp', 'jpg']
};

/**
 * Get CDN URL for an image
 */
function getCdnUrl(filename, variantType) {
  const supabaseProjectId = CONFIG.supabaseUrl.match(/https:\/\/([^\.]+)\.supabase\.co/)[1];
  return `https://${supabaseProjectId}.supabase.co/storage/v1/object/public/${CONFIG.cdnBucket}/${CONFIG.siteDomain}/${variantType}/${filename}`;
}

/**
 * Parse frontmatter from markdown file
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return null;
  }

  return {
    frontmatter: match[1],
    body: match[2],
    raw: content
  };
}

/**
 * Update frontmatter with CDN image URLs
 */
function updateFrontmatter(frontmatter, cdnImages) {
  let updated = frontmatter;

  // Check if cdnImages section already exists
  const cdnImagesRegex = /cdnImages:\s*\n([\s\S]*?)(?=\n\w+:|$)/;

  // Build the new cdnImages YAML block
  let yamlBlock = 'cdnImages:\n';
  Object.entries(cdnImages).forEach(([variantType, formats]) => {
    yamlBlock += `  ${variantType}:\n`;
    Object.entries(formats).forEach(([format, url]) => {
      yamlBlock += `    ${format}: "${url}"\n`;
    });
  });

  if (cdnImagesRegex.test(updated)) {
    // Replace existing cdnImages block
    updated = updated.replace(cdnImagesRegex, yamlBlock);
  } else {
    // Add new cdnImages block after title
    const titleMatch = updated.match(/title:\s*["'].*?["']/);
    if (titleMatch) {
      const insertPos = titleMatch.index + titleMatch[0].length;
      updated = updated.slice(0, insertPos) + '\n' + yamlBlock + updated.slice(insertPos);
    } else {
      // Add at the end
      updated += '\n' + yamlBlock;
    }
  }

  return updated;
}

/**
 * Process a single Hugo page
 */
async function processPage(pagePath, pageData) {
  try {
    // Read file
    const content = await fs.readFile(pagePath, 'utf8');
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      return { status: 'error', error: 'Could not parse frontmatter' };
    }

    // Generate CDN image URLs for all variants and formats
    const cdnImages = {};

    CONFIG.variantTypes.forEach(variantType => {
      cdnImages[variantType] = {};

      CONFIG.formats.forEach(format => {
        // Generate SEO filename
        const filename = generateSEOImageName(pageData, variantType, format);

        // Get CDN URL
        const url = getCdnUrl(filename, variantType);

        cdnImages[variantType][format] = url;
      });
    });

    // Update frontmatter
    const updatedFrontmatter = updateFrontmatter(parsed.frontmatter, cdnImages);

    // Reconstruct file
    const updatedContent = `---\n${updatedFrontmatter}\n---\n${parsed.body}`;

    // Write back
    await fs.writeFile(pagePath, updatedContent, 'utf8');

    return {
      status: 'updated',
      path: pagePath,
      images: CONFIG.variantTypes.length * CONFIG.formats.length
    };

  } catch (error) {
    return {
      status: 'error',
      path: pagePath,
      error: error.message
    };
  }
}

/**
 * Get all Hugo pages
 */
async function getAllPages() {
  const pages = [];

  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name === 'index.md') {
          // Parse page data from path
          const relativePath = path.relative(CONFIG.hugoContentDir, dir);
          const slug = relativePath || 'home';

          // Read frontmatter to get city and zipCode
          const content = await fs.readFile(fullPath, 'utf8');
          const parsed = parseFrontmatter(content);

          if (parsed) {
            const cityMatch = parsed.frontmatter.match(/city:\s*["']?([^"'\n]+)["']?/);
            const zipMatch = parsed.frontmatter.match(/zipCode:\s*["']?([^"'\n]+)["']?/);

            if (cityMatch && zipMatch) {
              pages.push({
                path: fullPath,
                slug,
                city: cityMatch[1].trim(),
                zipCode: zipMatch[1].trim()
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dir}:`, error.message);
    }
  }

  await scanDir(CONFIG.hugoContentDir);
  return pages;
}

/**
 * Main function
 */
async function updateAllPages() {
  const startTime = Date.now();

  console.log('Scanning Hugo content directory...\n');
  const pages = await getAllPages();

  console.log(`Found ${pages.length} Hugo pages\n`);

  if (pages.length === 0) {
    console.log('No pages found!\n');
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPDATING FRONTMATTER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} | {updated} updated, {errors} errors',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  const stats = {
    total: pages.length,
    updated: 0,
    skipped: 0,
    errors: []
  };

  progressBar.start(pages.length, 0, {
    updated: 0,
    errors: 0
  });

  // Process pages
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const result = await processPage(page.path, page);

    if (result.status === 'updated') {
      stats.updated++;
    } else if (result.status === 'error') {
      stats.errors.push(result);
    }

    progressBar.update(i + 1, {
      updated: stats.updated,
      errors: stats.errors.length
    });
  }

  progressBar.stop();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPDATE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total pages:       ${stats.total}`);
  console.log(`  Updated:           ${stats.updated}`);
  console.log(`  Errors:            ${stats.errors.length}`);
  console.log(`  Duration:          ${duration} seconds`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors (first 10):');
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`  • ${e.path}: ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more\n`);
    }
  }

  // Save stats
  const statsPath = path.resolve(__dirname, '../../frontmatter-update-stats.json');
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
  console.log('✓ Statistics saved: frontmatter-update-stats.json\n');

  if (stats.updated > 0) {
    console.log('✅ Hugo frontmatter updated with CDN image URLs!');
    console.log(`   ${stats.updated} pages now reference Supabase CDN images\n`);
  }

  console.log('Next steps:');
  console.log('  1. Update Hugo templates to use responsive picture elements');
  console.log('  2. Test the site locally');
  console.log('  3. Deploy to production\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

updateAllPages().catch(error => {
  console.error('\n❌ Update failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
