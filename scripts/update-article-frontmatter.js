#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Article slugs
const articles = [
  '5-signes-urgence-electrique-paris',
  'court-circuit-dangers-solutions',
  'disjoncteur-qui-saute-sos-ou-reparation',
  'electricien-nuit-paris-service-24h',
  'electricien-paris-dimanche-intervention',
  'normes-electriques-paris-loi',
  'panne-totale-courant-que-faire',
  'plus-courant-piece-diagnostic',
  'prix-depannage-electricite-urgence-paris',
  'tableau-electrique-gresille-urgence'
];

async function updateArticleFrontmatter(slug) {
  const articlePath = path.join(__dirname, '..', 'content', 'conseils', slug, 'index.md');

  try {
    // Read the current content
    let content = await fs.readFile(articlePath, 'utf8');

    // Find the end of the frontmatter
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd === -1) {
      console.error(`❌ Could not find frontmatter in ${slug}`);
      return false;
    }

    // Add images section before the closing ---
    const imagePaths = `images:
  hero: "/images/articles/hero/${slug}.webp"
  og: "/images/articles/og/${slug}.png"
  thumbnail: "/images/articles/thumbnail/${slug}.webp"
`;

    // Check if images section already exists
    if (content.includes('images:')) {
      console.log(`⚠️  ${slug} already has images section, skipping`);
      return false;
    }

    // Insert the images section before the closing ---
    const newContent = content.slice(0, frontmatterEnd) + imagePaths + content.slice(frontmatterEnd);

    // Write back the updated content
    await fs.writeFile(articlePath, newContent);
    console.log(`✅ Updated ${slug}`);
    return true;

  } catch (error) {
    console.error(`❌ Error updating ${slug}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('📝 Updating article frontmatter with image paths...\n');

  let successCount = 0;

  for (const slug of articles) {
    const success = await updateArticleFrontmatter(slug);
    if (success) successCount++;
  }

  console.log(`\n✨ Updated ${successCount}/${articles.length} articles successfully!`);
}

main().catch(console.error);