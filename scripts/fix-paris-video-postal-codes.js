import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paris pages with their correct postal codes
const PARIS_PAGES = {
  'paris': '75001',
  'paris-1er': '75001',
  'paris-2e': '75002',
  'paris-3e': '75003',
  'paris-4e': '75004',
  'paris-5e': '75005',
  'paris-6e': '75006',
  'paris-7e': '75007',
  'paris-8e': '75008',
  'paris-9e': '75009',
  'paris-10e': '75010',
  'paris-11e': '75011',
  'paris-12e': '75012',
  'paris-13e': '75013',
  'paris-14e': '75014',
  'paris-15e': '75015',
  'paris-16e': '75016',
  'paris-17e': '75017',
  'paris-18e': '75018',
  'paris-19e': '75019',
  'paris-20e': '75020'
};

const CONTENT_DIR = path.join(__dirname, '..', 'content');

/**
 * Fix postal codes in cdnImages.video paths
 */
function fixPostalCodesInFrontmatter(slug, correctPostalCode) {
  const indexPath = path.join(CONTENT_DIR, slug, 'index.md');

  if (!fs.existsSync(indexPath)) {
    console.log(`  ⚠️  File not found: ${indexPath}`);
    return false;
  }

  let content = fs.readFileSync(indexPath, 'utf8');
  const originalContent = content;

  // Pattern to match incorrect postal codes in video image paths
  // Example: electricien-urgence-paris-1er-75101-video.avif (wrong)
  // Should be: electricien-urgence-paris-1er-75001-video.avif (correct)

  // Find the wrong postal code pattern (751XX, 752XX, etc.)
  const wrongPostalCodePattern = /75[12]\d{2}/g;

  // Replace in cdnImages section
  content = content.replace(
    new RegExp(`(electricien-urgence-${slug.replace(/\//g, '\\/')}-)(75[12]\\d{2})(-video\\.(avif|webp|jpg))`, 'g'),
    `$1${correctPostalCode}$3`
  );

  // Also update the images.video field if it's still set to default
  if (content.includes('video: default-electricien-video')) {
    const videoImageId = `electricien-urgence-${slug}-${correctPostalCode}-video`;
    content = content.replace(
      /^(\s*)video:\s*default-electricien-video\s*$/m,
      `$1video: ${videoImageId}`
    );
  }

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
  console.log('🔧 FIX PARIS PAGES VIDEO POSTAL CODES');
  console.log('='.repeat(80));
  console.log();

  const results = {
    updated: 0,
    unchanged: 0,
    notFound: 0,
    total: Object.keys(PARIS_PAGES).length
  };

  let index = 1;
  for (const [slug, correctPostalCode] of Object.entries(PARIS_PAGES)) {
    console.log(`[${index}/${results.total}] ${slug} → ${correctPostalCode}`);

    const indexPath = path.join(CONTENT_DIR, slug, 'index.md');

    if (!fs.existsSync(indexPath)) {
      console.log(`  ⚠️  Page not found`);
      results.notFound++;
      index++;
      continue;
    }

    const updated = fixPostalCodesInFrontmatter(slug, correctPostalCode);

    if (updated) {
      console.log(`  ✅ Postal codes updated in cdnImages.video paths`);
      results.updated++;
    } else {
      console.log(`  ℹ️  No changes needed (already correct or no cdnImages)`);
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
  const resultsPath = path.join(__dirname, '..', 'paris-video-postal-fix-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${resultsPath}`);

  console.log('\n✅ Postal code fix complete!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
