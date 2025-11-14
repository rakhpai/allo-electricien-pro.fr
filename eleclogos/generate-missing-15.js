/**
 * Generate images for the 15 specific pages still showing 400 errors
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import sharp from 'sharp';
import { generateSEOImageName } from '../eleclogos/src/utils/image-seo-namer.js';
import { watermarkManager } from '../eleclogos/src/services/watermark-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../eleclogos/.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('GENERATE 15 MISSING IMAGES');
console.log('═══════════════════════════════════════════════════════════\n');

// Configuration
const CONFIG = {
  siteDomain: 'allo-electricien.pro',
  outputDir: path.resolve(__dirname, '../eleclogos/generated'),
  cacheDir: path.resolve(__dirname, '../eleclogos/cache/source-images'),
  contentDir: path.resolve(__dirname, '../content'),
  variantSpecs: {
    hero: { width: 1920, height: 1080 },
    og: { width: 1200, height: 630 },
    featured: { width: 800, height: 600 },
    video: { width: 1280, height: 720 }
  },
  formats: ['jpg', 'webp', 'avif'],
  quality: {
    jpg: 85,
    webp: 85,
    avif: 80
  }
};

// 15 pages that need images
const PAGES_TO_GENERATE = [
  { slug: 'guyancourt', zipCode: '78280' },
  { slug: 'versailles', zipCode: '78000' },
  { slug: 'la-verriere', zipCode: '60210' },
  { slug: 'pecy', zipCode: '77970' },
  { slug: 'sept-sorts', zipCode: '77260' },
  { slug: 'labbeville', zipCode: '95690' },
  { slug: 'oissery', zipCode: '77178' },
  { slug: 'mondreville', zipCode: '78980' },
  { slug: 'longueville', zipCode: '77650' },
  { slug: 'fa-les-nemours', zipCode: '77167' },
  { slug: 'marolles-en-brie-77', zipCode: '77120' },
  { slug: 'crevecoeur-en-brie', zipCode: '77610' },
  { slug: 'paris-ville', zipCode: '75001' },
  { slug: 'saint-cyr-sous-dourdan', zipCode: '91410' },
  { slug: 'vincy-manoeuvre', zipCode: '77139' }
];

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get source image (round-robin from Supabase)
 */
async function getSourceImage(pageIndex) {
  const { data: images, error } = await supabase
    .from('source_images')
    .select('id, file_name, storage_path')
    .order('id')
    .limit(400);

  if (error || !images || images.length === 0) {
    throw new Error('No source images found in Supabase');
  }

  const sourceImage = images[pageIndex % images.length];
  const cachePath = path.join(CONFIG.cacheDir, sourceImage.file_name);

  if (fsSync.existsSync(cachePath)) {
    return cachePath;
  }

  // Download and cache
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('source-images')
    .download(sourceImage.storage_path);

  if (downloadError) {
    throw new Error(`Failed to download: ${downloadError.message}`);
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  await fs.writeFile(cachePath, buffer);

  return cachePath;
}

/**
 * Generate all variants for a page
 */
async function generatePageImages(pageData, sourcePath) {
  let generated = 0;

  for (const [variantType, specs] of Object.entries(CONFIG.variantSpecs)) {
    for (const format of CONFIG.formats) {
      try {
        const filename = generateSEOImageName(pageData, variantType, format);
        const outputPath = path.join(
          CONFIG.outputDir,
          CONFIG.siteDomain,
          variantType,
          filename
        );

        // Skip if exists
        if (fsSync.existsSync(outputPath)) {
          continue;
        }

        // Process with Sharp
        let pipeline = sharp(sourcePath)
          .resize(specs.width, specs.height, {
            fit: 'cover',
            position: 'center'
          });

        // Add watermark
        const watermarkedBuffer = await watermarkManager.addWatermark(
          await pipeline.toBuffer(),
          pageData.city || pageData.slug.toUpperCase(),
          variantType
        );

        // Convert to format
        pipeline = sharp(watermarkedBuffer);

        if (format === 'jpg') {
          pipeline = pipeline.jpeg({ quality: CONFIG.quality.jpg });
        } else if (format === 'webp') {
          pipeline = pipeline.webp({ quality: CONFIG.quality.webp });
        } else if (format === 'avif') {
          pipeline = pipeline.avif({ quality: CONFIG.quality.avif });
        }

        await pipeline.toFile(outputPath);
        generated++;

      } catch (error) {
        console.error(`  ❌ Error generating ${variantType}.${format}: ${error.message}`);
      }
    }
  }

  return generated;
}

/**
 * Main function
 */
async function main() {
  console.log(`📊 Pages to process: ${PAGES_TO_GENERATE.length}\n`);

  let totalGenerated = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < PAGES_TO_GENERATE.length; i++) {
    const page = PAGES_TO_GENERATE[i];

    try {
      console.log(`[${i + 1}/${PAGES_TO_GENERATE.length}] ${page.slug}...`);

      // Get source image
      const sourcePath = await getSourceImage(i);

      // Generate images
      const pageData = {
        slug: page.slug,
        city: page.slug.toUpperCase().replace(/-/g, ' '),
        zipCode: page.zipCode
      };

      const count = await generatePageImages(pageData, sourcePath);
      totalGenerated += count;

      if (count > 0) {
        console.log(`  ✅ Generated ${count} images`);
        succeeded++;
      } else {
        console.log(`  ⏭️  All images already exist`);
        succeeded++;
      }

    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('GENERATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ Succeeded: ${succeeded} pages`);
  console.log(`❌ Failed: ${failed} pages`);
  console.log(`📁 Total images generated: ${totalGenerated}`);
  console.log(`📁 Output: ${CONFIG.outputDir}/${CONFIG.siteDomain}/`);
  console.log('\n✅ CHECKPOINT: Images generated');
  console.log('\nNext: Upload to Supabase');
}

main().catch(console.error);
