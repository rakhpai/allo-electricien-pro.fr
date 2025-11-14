/**
 * Fix remaining 13 pages with 400 errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentDir = path.resolve(__dirname, '../content');
const baseUrl = 'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro';

// Remaining pages with correct directory names
const pagesToFix = [
  { page: 'l-isle-adam', correctSlug: 'l-isle-adam-95290' },
  { page: 'saint-cyr-l-ecole', correctSlug: 'saint-cyr-l-ecole-78210' },
  { page: 'd-huison-longueville', correctSlug: 'd-huison-longueville-91590' },
  { page: 'boissy-l-aillerie', correctSlug: 'boissy-l-aillerie-95650' },
  { page: 'le-plessis-l-eveque', correctSlug: 'le-plessis-l-eveque-77165' },
  { page: 'bois-d-arcy', correctSlug: 'bois-d-arcy-78390' },
  { page: 'saint-remy-l-honore', correctSlug: 'saint-remy-l-honore-78690' },
  { page: 'l-etang-la-ville', correctSlug: 'l-etang-la-ville-78620' },
  { page: 'verneuil-l-etang', correctSlug: 'verneuil-l-etang-77390' },
  { page: 'saint-ouen-l-aumone', correctSlug: 'saint-ouen-l-aumone-95310' },
  { page: 'germigny-l-eveque', correctSlug: 'germigny-l-eveque-77910' },
  { page: 'montfort-l-amaury', correctSlug: 'montfort-l-amaury-78490' },
  { page: 'ville-d-avray', correctSlug: 'ville-d-avray-92410' },
];

function generateCdnUrls(slug) {
  const variants = ['hero', 'og', 'featured', 'video'];
  const formats = ['avif', 'webp', 'jpg'];

  const cdnImages = {};

  variants.forEach(variant => {
    cdnImages[variant] = {};
    formats.forEach(format => {
      const filename = `electricien-urgence-${slug}-${variant}.${format}`;
      cdnImages[variant][format] = `${baseUrl}/${variant}/${filename}`;
    });
  });

  return cdnImages;
}

function updatePageFrontmatter(pagePath, correctSlug) {
  const indexPath = path.join(contentDir, pagePath, 'index.md');

  if (!fs.existsSync(indexPath)) {
    console.log(`❌ Page not found: ${pagePath}`);
    return false;
  }

  const content = fs.readFileSync(indexPath, 'utf8');

  // Parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!frontmatterMatch) {
    console.log(`❌ No frontmatter found in: ${pagePath}`);
    return false;
  }

  // Generate correct CDN URLs
  const cdnImages = generateCdnUrls(correctSlug);

  // Build new cdnImages YAML
  const cdnImagesYaml = `cdnImages:
  hero:
    avif: "${cdnImages.hero.avif}"
    webp: "${cdnImages.hero.webp}"
    jpg: "${cdnImages.hero.jpg}"
  og:
    avif: "${cdnImages.og.avif}"
    webp: "${cdnImages.og.webp}"
    jpg: "${cdnImages.og.jpg}"
  featured:
    avif: "${cdnImages.featured.avif}"
    webp: "${cdnImages.featured.webp}"
    jpg: "${cdnImages.featured.jpg}"
  video:
    avif: "${cdnImages.video.avif}"
    webp: "${cdnImages.video.webp}"
    jpg: "${cdnImages.video.jpg}"`;

  // Replace cdnImages section
  const updatedContent = content.replace(
    /cdnImages:[\s\S]*?(?=\n[a-zA-Z]|\n---)/,
    cdnImagesYaml + '\n'
  );

  // Write back
  fs.writeFileSync(indexPath, updatedContent, 'utf8');
  console.log(`✅ Updated: ${pagePath} → ${correctSlug}`);
  return true;
}

console.log('🔧 Fixing remaining 13 pages...\n');

let updated = 0;
let failed = 0;

pagesToFix.forEach(({ page, correctSlug }) => {
  if (updatePageFrontmatter(page, correctSlug)) {
    updated++;
  } else {
    failed++;
  }
});

const total = 23 + updated;
console.log(`\n✅ Updated: ${updated} pages`);
console.log(`❌ Failed: ${failed} pages`);
console.log(`\nTotal fixed: ${total} out of 51 pages`);
