import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paris pages with their slug transformations
// From "paris-Xe" to "paris-X" (remove the "e" or "er")
const PARIS_PAGES = {
  'paris': { correctSlug: 'paris', postalCode: '75001' },  // Main Paris stays as-is
  'paris-1er': { correctSlug: 'paris-1', postalCode: '75001' },
  'paris-2e': { correctSlug: 'paris-2', postalCode: '75002' },
  'paris-3e': { correctSlug: 'paris-3', postalCode: '75003' },
  'paris-4e': { correctSlug: 'paris-4', postalCode: '75004' },
  'paris-5e': { correctSlug: 'paris-5', postalCode: '75005' },
  'paris-6e': { correctSlug: 'paris-6', postalCode: '75006' },
  'paris-7e': { correctSlug: 'paris-7', postalCode: '75007' },
  'paris-8e': { correctSlug: 'paris-8', postalCode: '75008' },
  'paris-9e': { correctSlug: 'paris-9', postalCode: '75009' },
  'paris-10e': { correctSlug: 'paris-10', postalCode: '75010' },
  'paris-11e': { correctSlug: 'paris-11', postalCode: '75011' },
  'paris-12e': { correctSlug: 'paris-12', postalCode: '75012' },
  'paris-13e': { correctSlug: 'paris-13', postalCode: '75013' },
  'paris-14e': { correctSlug: 'paris-14', postalCode: '75014' },
  'paris-15e': { correctSlug: 'paris-15', postalCode: '75015' },
  'paris-16e': { correctSlug: 'paris-16', postalCode: '75016' },
  'paris-17e': { correctSlug: 'paris-17', postalCode: '75017' },
  'paris-18e': { correctSlug: 'paris-18', postalCode: '75018' },
  'paris-19e': { correctSlug: 'paris-19', postalCode: '75019' },
  'paris-20e': { correctSlug: 'paris-20', postalCode: '75020' }
};

const CONTENT_DIR = path.join(__dirname, '..', 'content');

/**
 * Fix video image slug in frontmatter
 * Change from paris-Xe to paris-X format to match existing Sharp-generated images
 */
function fixVideoSlugInFrontmatter(pageSlug, correctImageSlug, postalCode) {
  const indexPath = path.join(CONTENT_DIR, pageSlug, 'index.md');

  if (!fs.existsSync(indexPath)) {
    console.log(`  ⚠️  File not found: ${indexPath}`);
    return false;
  }

  let content = fs.readFileSync(indexPath, 'utf8');
  const originalContent = content;

  // Update the cdnImages.video paths
  // From: electricien-urgence-paris-1er-75001-video
  // To:   electricien-urgence-paris-1-75001-video

  const oldImagePattern = `electricien-urgence-${pageSlug}-${postalCode}-video`;
  const newImagePattern = `electricien-urgence-${correctImageSlug}-${postalCode}-video`;

  // Replace in all video image URLs
  content = content.replace(new RegExp(oldImagePattern.replace(/\//g, '\\\\/'), 'g'), newImagePattern);

  // Also update the images.video identifier field
  const oldVideoId = `electricien-urgence-${pageSlug}-${postalCode}-video`;
  const newVideoId = `electricien-urgence-${correctImageSlug}-${postalCode}-video`;

  content = content.replace(
    new RegExp(`(video:\\s*)${oldVideoId.replace(/\//g, '\\\\/')}`, 'g'),
    `$1${newVideoId}`
  );

  if (content !== originalContent) {
    fs.writeFileSync(indexPath, content, 'utf8');
    return true;
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 FIX PARIS VIDEO IMAGE SLUG NAMES');
  console.log('='.repeat(80));
  console.log('Updating from paris-Xe format to paris-X to match Sharp images');
  console.log('='.repeat(80));
  console.log();

  const results = {
    updated: 0,
    unchanged: 0,
    notFound: 0,
    total: Object.keys(PARIS_PAGES).length
  };

  let index = 1;
  for (const [pageSlug, config] of Object.entries(PARIS_PAGES)) {
    console.log(`[${index}/${results.total}] ${pageSlug} → ${config.correctSlug}`);

    const indexPath = path.join(CONTENT_DIR, pageSlug, 'index.md');

    if (!fs.existsSync(indexPath)) {
      console.log(`  ⚠️  Page not found`);
      results.notFound++;
      index++;
      continue;
    }

    const updated = fixVideoSlugInFrontmatter(pageSlug, config.correctSlug, config.postalCode);

    if (updated) {
      console.log(`  ✅ Video slug updated: ${pageSlug} → ${config.correctSlug}`);
      results.updated++;
    } else {
      console.log(`  ℹ️  No changes needed`);
      results.unchanged++;
    }

    index++;
  }

  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Paris pages: ${results.total}`);
  console.log(`✅ Updated: ${results.updated}`);
  console.log(`ℹ️  Unchanged: ${results.unchanged}`);
  console.log(`⚠️  Not found: ${results.notFound}`);
  console.log('='.repeat(80));

  // Save results
  const resultsPath = path.join(__dirname, '..', 'paris-video-slug-fix-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${resultsPath}`);

  console.log('\n✅ Video slug fix complete!');
  console.log('\nNext: Update Supabase database to match these changes');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
