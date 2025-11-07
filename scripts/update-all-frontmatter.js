/**
 * Update All Frontmatter Script
 * Adds image fields to all 520 commune pages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  mappingPath: path.join(__dirname, '../../elec/data/image-mapping.json'),
  contentPath: path.join(__dirname, '../content')
};

/**
 * Parse frontmatter from markdown file
 * Returns { frontmatter, content, raw }
 */
function parseFrontmatter(fileContent) {
  const lines = fileContent.split('\n');

  // Check for frontmatter delimiters
  if (lines[0] !== '---') {
    return { frontmatter: {}, content: fileContent, raw: fileContent };
  }

  // Find end of frontmatter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, content: fileContent, raw: fileContent };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const contentLines = lines.slice(endIndex + 1);

  return {
    frontmatterLines,
    frontmatterText: frontmatterLines.join('\n'),
    content: contentLines.join('\n'),
    raw: fileContent
  };
}

/**
 * Add or update image fields in frontmatter
 */
function updateFrontmatterWithImages(frontmatterText, images) {
  const lines = frontmatterText.split('\n');

  // Check if images section already exists
  const hasImages = lines.some(line => line.trim().startsWith('images:'));

  if (hasImages) {
    // Remove existing images section
    let inImagesSection = false;
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('images:')) {
        inImagesSection = true;
        continue; // Skip this line
      }

      if (inImagesSection) {
        // Check if still in images section (indented)
        if (line.startsWith('  ') && trimmed && !trimmed.startsWith('#')) {
          continue; // Skip image fields
        } else {
          inImagesSection = false; // End of images section
        }
      }

      filteredLines.push(line);
    }

    lines.length = 0;
    lines.push(...filteredLines);
  }

  // Find insertion point (before draft: or at end)
  let insertIndex = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('draft:')) {
      insertIndex = i;
      break;
    }
  }

  // Insert images section
  const imageLines = [
    'images:',
    `  hero: "${images.hero}"`,
    `  og: "${images.og}"`,
    `  featured: "${images.featured}"`,
    `  video: "${images.video}"`
  ];

  lines.splice(insertIndex, 0, ...imageLines);

  return lines.join('\n');
}

/**
 * Update a single page
 */
function updatePage(communeSlug, images) {
  const pagePath = path.join(CONFIG.contentPath, communeSlug, 'index.md');

  if (!fs.existsSync(pagePath)) {
    return { success: false, error: 'File not found' };
  }

  try {
    // Read file
    const content = fs.readFileSync(pagePath, 'utf8');

    // Parse frontmatter
    const parsed = parseFrontmatter(content);

    // Update frontmatter
    const updatedFrontmatter = updateFrontmatterWithImages(parsed.frontmatterText, images);

    // Reconstruct file
    const updatedContent = `---\n${updatedFrontmatter}\n---${parsed.content}`;

    // Write file
    fs.writeFileSync(pagePath, updatedContent, 'utf8');

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update all frontmatter files
 */
async function updateAllFrontmatter() {
  console.log('🚀 Updating All Frontmatter Files\n');

  // Load image mapping
  console.log('📂 Loading image mapping...');
  const mapping = JSON.parse(fs.readFileSync(CONFIG.mappingPath, 'utf8'));
  console.log(`✓ Loaded ${mapping.length} commune mappings\n`);

  // Update all pages
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  console.log('⚙️  Updating frontmatter...\n');

  for (const commune of mapping) {
    const result = updatePage(commune.communeSlug, commune.images);

    if (result.success) {
      updated++;

      // Log progress every 25 pages
      if (updated % 25 === 0) {
        console.log(`   ✓ Updated ${updated}/${mapping.length} pages...`);
      }
    } else if (result.error === 'File not found') {
      skipped++;
    } else {
      console.error(`   ✗ Error updating ${commune.communeSlug}: ${result.error}`);
      errors++;
    }
  }

  console.log(`\n📊 Update complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped} (files not found)`);
  console.log(`   Errors:  ${errors}\n`);

  // Generate report
  const reportPath = path.join(__dirname, '../data/frontmatter-update-report.json');
  const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  };

  ensureDir(path.dirname(reportPath));

  const report = {
    generated: new Date().toISOString(),
    stats: {
      total: mapping.length,
      updated,
      skipped,
      errors
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 Report saved to: ${reportPath}\n`);

  console.log('✅ Frontmatter update complete!\n');
  console.log('Next steps:');
  console.log('1. Review updated pages');
  console.log('2. Update Hugo templates with image support');
  console.log('3. Copy images to static directory');
  console.log('4. Build Hugo site\n');

  return { updated, skipped, errors };
}

// Run if called directly
if (process.argv[1].includes('update-all-frontmatter')) {
  updateAllFrontmatter().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { updateAllFrontmatter, updatePage };
