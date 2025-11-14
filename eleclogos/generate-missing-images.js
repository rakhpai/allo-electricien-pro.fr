/**
 * Generate images for 940 pages from pages-to-generate.json
 * Resumable: Saves progress checkpoints
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import sharp from 'sharp';
import cliProgress from 'cli-progress';
import { generateSEOImageName } from './src/utils/image-seo-namer.js';
import { watermarkManager } from './src/services/watermark-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('GENERATE MISSING IMAGES (RESUMABLE)');
console.log('═══════════════════════════════════════════════════════════\n');

// Configuration
const CONFIG = {
  siteDomain: 'allo-electricien.pro',
  outputDir: path.resolve(__dirname, 'generated'),
  cacheDir: path.resolve(__dirname, 'cache/source-images'),
  contentDir: path.resolve(__dirname, '../content'),
  pagesFile: path.resolve(__dirname, '../debug/pages-to-generate.json'),
  checkpointFile: path.resolve(__dirname, 'generation-checkpoint.json'),
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

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Load or create checkpoint
 */
function loadCheckpoint() {
  try {
    if (fsSync.existsSync(CONFIG.checkpointFile)) {
      const data = fsSync.readFileSync(CONFIG.checkpointFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('No valid checkpoint found, starting fresh');
  }
  return { completed: [], failed: [], lastIndex: 0 };
}

/**
 * Save checkpoint
 */
function saveCheckpoint(checkpoint) {
  fsSync.writeFileSync(CONFIG.checkpointFile, JSON.stringify(checkpoint, null, 2));
}

/**
 * Get page frontmatter
 */
async function getPageData(slug) {
  const indexPath = path.join(CONFIG.contentDir, slug, 'index.md');

  try {
    const content = await fs.readFile(indexPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

    if (!frontmatterMatch) {
      return null;
    }

    // Simple YAML parsing for needed fields
    const yaml = frontmatterMatch[1];
    const cityMatch = yaml.match(/city:\s*(.+)/);
    const zipMatch = yaml.match(/zipCode:\s*['"]?(\d+)['"]?/);

    return {
      slug,
      city: cityMatch ? cityMatch[1].trim() : slug.toUpperCase(),
      zipCode: zipMatch ? zipMatch[1] : ''
    };
  } catch (error) {
    console.log(`⚠️  Page not found: ${slug}`);
    return null;
  }
}

/**
 * Get source image from Supabase (round-robin)
 */
async function getSourceImage(pageIndex) {
  // Fetch source images list
  const { data: images, error } = await supabase
    .from('source_images')
    .select('id, file_name, storage_path')
    .order('id')
    .limit(400);

  if (error || !images || images.length === 0) {
    throw new Error('No source images found in Supabase');
  }

  // Round-robin: cycle through available images
  const sourceImage = images[pageIndex % images.length];

  // Check if cached locally
  const cachePath = path.join(CONFIG.cacheDir, sourceImage.file_name);

  if (fsSync.existsSync(cachePath)) {
    return cachePath;
  }

  // Download and cache
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('source-images')
    .download(sourceImage.storage_path);

  if (downloadError) {
    throw new Error(`Failed to download source image: ${downloadError.message}`);
  }

  // Save to cache
  const buffer = Buffer.from(await fileData.arrayBuffer());
  await fs.writeFile(cachePath, buffer);

  return cachePath;
}

/**
 * Generate all variants for a page
 */
async function generatePageImages(pageData, sourcePath, pageIndex) {
  const results = [];

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

        // Skip if already exists
        if (fsSync.existsSync(outputPath)) {
          results.push({ variant: variantType, format, status: 'skipped' });
          continue;
        }

        // Process image with Sharp
        let pipeline = sharp(sourcePath)
          .resize(specs.width, specs.height, {
            fit: 'cover',
            position: 'center'
          });

        // Add watermark
        const watermarkedBuffer = await watermarkManager.addWatermark(
          await pipeline.toBuffer(),
          pageData.city || pageData.slug,
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
        results.push({ variant: variantType, format, status: 'success' });

      } catch (error) {
        results.push({ variant: variantType, format, status: 'error', error: error.message });
      }
    }
  }

  return results;
}

/**
 * Main generation function
 */
async function generateMissingImages() {
  // Load pages list
  const pagesData = JSON.parse(fsSync.readFileSync(CONFIG.pagesFile, 'utf8'));
  const pages = pagesData.pages;

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const startIndex = checkpoint.lastIndex;

  console.log(`📊 Total pages: ${pages.length}`);
  console.log(`✅ Already completed: ${checkpoint.completed.length}`);
  console.log(`❌ Previously failed: ${checkpoint.failed.length}`);
  console.log(`🔄 Resuming from index: ${startIndex}\n`);

  // Setup progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} pages | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });

  progressBar.start(pages.length, startIndex);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  // Process pages
  for (let i = startIndex; i < pages.length; i++) {
    const slug = pages[i];

    try {
      // Get page data
      const pageData = await getPageData(slug);
      if (!pageData) {
        checkpoint.failed.push({ slug, error: 'Page not found' });
        failed++;
        continue;
      }

      // Get source image
      const sourcePath = await getSourceImage(i);

      // Generate images
      const results = await generatePageImages(pageData, sourcePath, i);

      // Count results
      const successCount = results.filter(r => r.status === 'success').length;
      const skipCount = results.filter(r => r.status === 'skipped').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      if (errorCount > 0) {
        checkpoint.failed.push({ slug, errors: results.filter(r => r.status === 'error') });
        failed++;
      } else {
        checkpoint.completed.push(slug);
        if (successCount > 0) generated++;
        if (skipCount === results.length) skipped++;
      }

      // Update checkpoint every 10 pages
      if ((i + 1) % 10 === 0) {
        checkpoint.lastIndex = i + 1;
        saveCheckpoint(checkpoint);
      }

    } catch (error) {
      checkpoint.failed.push({ slug, error: error.message });
      failed++;
    }

    progressBar.update(i + 1);
  }

  progressBar.stop();

  // Final checkpoint
  checkpoint.lastIndex = pages.length;
  saveCheckpoint(checkpoint);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('GENERATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ Generated: ${generated} pages (${generated * 12} images)`);
  console.log(`⏭️  Skipped (already exist): ${skipped} pages`);
  console.log(`❌ Failed: ${failed} pages`);
  console.log(`📁 Output: ${CONFIG.outputDir}/${CONFIG.siteDomain}/`);
  console.log(`\n✅ CHECKPOINT 2 COMPLETE: Images generated`);
  console.log(`\nNext: Upload images to Supabase`);
}

// Run
generateMissingImages().catch(console.error);
