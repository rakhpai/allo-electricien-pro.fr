/**
 * Fix frontmatter URLs for 51 pages with 400 errors
 * Issues: URL-encoded apostrophes, missing hyphens, wrong Paris arrondissement names
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentDir = path.resolve(__dirname, '../content');

// Pages from 404images.csv that need fixing
const pagesToFix = [
  { page: 'paris-11e', correctSlug: '11e-arrondissement-7511' },
  { page: 'paris-11e-arrondissement', correctSlug: '11e-arrondissement-7511' },
  { page: 'paris-14e-arrondissement', correctSlug: '14e-arrondissement-7514' },
  { page: 'paris-15e-arrondissement', correctSlug: '15e-arrondissement-7515' },
  { page: 'paris-3e-arrondissement', correctSlug: '3e-arrondissement-75003' },
  { page: 'paris-2e-arrondissement', correctSlug: '2e-arrondissement-75002' },
  { page: 'paris-8e-arrondissement', correctSlug: '8e-arrondissement-75008' },
  { page: 'paris-5e-arrondissement', correctSlug: '5e-arrondissement-75005' },
  { page: 'paris-9e-arrondissement', correctSlug: '9e-arrondissement-75009' },
  { page: 'paris-10e-arrondissement', correctSlug: '10e-arrondissement-7510' },
  { page: 'paris-4e-arrondissement', correctSlug: '4e-arrondissement-75004' },
  { page: 'paris-6e-arrondissement', correctSlug: '6e-arrondissement-75006' },
  { page: 'paris-19e-arrondissement', correctSlug: '19e-arrondissement-7519' },
  { page: 'paris-12e-arrondissement', correctSlug: '12e-arrondissement-7512' },
  { page: 'paris-1e-arrondissement', correctSlug: '1e-arrondissement-75001' },
  { page: 'paris-17e-arrondissement', correctSlug: '17e-arrondissement-7517' },
  { page: 'paris-16e-arrondissement', correctSlug: '16e-arrondissement-7516' },
  { page: 'paris-18e-arrondissement', correctSlug: '18e-arrondissement-7518' },
  { page: 'paris-20e-arrondissement', correctSlug: '20e-arrondissement-7520' },
  { page: 'paris-13e-arrondissement', correctSlug: '13e-arrondissement-7513' },
  { page: 'lhay-les-roses', correctSlug: 'l-hay-les-roses-94240' },
  { page: 'lile-saint-denis', correctSlug: 'l-ile-saint-denis-93450' },
  { page: 'lisle-adam', correctSlug: 'l-isle-adam-95290' },
  { page: 'saint-cyr-lecole', correctSlug: 'saint-cyr-l-ecole-78210' },
  { page: 'dhuison-longueville', correctSlug: 'd-huison-longueville-91590' },
  { page: 'boissy-laillerie', correctSlug: 'boissy-l-aillerie-95650' },
  { page: 'le-plessis-leveque', correctSlug: 'le-plessis-l-eveque-77165' },
  { page: 'bois-darcy', correctSlug: 'bois-d-arcy-78390' },
  { page: 'saint-remy-lhonore', correctSlug: 'saint-remy-l-honore-78690' },
  { page: 'letang-la-ville', correctSlug: 'l-etang-la-ville-78620' },
  { page: 'verneuil-letang', correctSlug: 'verneuil-l-etang-77390' },
  { page: 'saint-ouen-laumone', correctSlug: 'saint-ouen-l-aumone-95310' },
  { page: 'germigny-leveque', correctSlug: 'germigny-l-eveque-77910' },
  { page: 'montfort-lamaury', correctSlug: 'montfort-l-amaury-78490' },
  { page: 'ville-davray', correctSlug: 'ville-d-avray-92410' },
  { page: 'l-ha-les-roses', correctSlug: 'l-hay-les-roses-94240' },
];

// Base URL for Supabase CDN
const baseUrl = 'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro';

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

console.log('🔧 Fixing frontmatter for 51 pages with 400 errors...\n');

let updated = 0;
let failed = 0;

pagesToFix.forEach(({ page, correctSlug }) => {
  if (updatePageFrontmatter(page, correctSlug)) {
    updated++;
  } else {
    failed++;
  }
});

console.log(`\n✅ Updated: ${updated} pages`);
console.log(`❌ Failed: ${failed} pages`);
console.log(`\nNext: Run 'hugo --minify' to rebuild site`);

