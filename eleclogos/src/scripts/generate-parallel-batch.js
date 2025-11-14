import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';
import { generateSEOImageName } from '../utils/image-seo-namer.js';
import { watermarkManager } from '../services/watermark-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Get CLI arguments
const startIdx = parseInt(process.argv[2]) || 0;
const endIdx = parseInt(process.argv[3]) || null;
const batchId = process.argv[4] || 'main';

console.log(`[Batch ${batchId}] Starting parallel generation`);
console.log(`[Batch ${batchId}] Page range: ${startIdx} - ${endIdx || 'end'}\n`);

// Configuration
const CONFIG = {
  siteDomain: 'allo-electricien.pro',
  outputDir: path.resolve(__dirname, '../../generated'),
  cacheDir: path.resolve(__dirname, '../../cache/source-images'),
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

/**
 * Process single image with Sharp
 */
async function processImage(sourceBuffer, spec, watermarkLayout, format) {
  try {
    // 1. Resize
    let pipeline = sharp(sourceBuffer)
      .resize(spec.width, spec.height, {
        fit: 'cover',
        position: 'center',
        kernel: 'lanczos3'
      });

    // 2. Apply watermarks via composite
    const composites = [];

    if (watermarkLayout.logo && watermarkLayout.logo.buffer) {
      const logoPng = await sharp(watermarkLayout.logo.buffer)
        .resize(watermarkLayout.logo.dimensions.width, watermarkLayout.logo.dimensions.height)
        .png()
        .toBuffer();

      composites.push({
        input: logoPng,
        top: watermarkLayout.logo.position.top,
        left: watermarkLayout.logo.position.left
      });
    }

    if (watermarkLayout.cta && watermarkLayout.cta.buffer) {
      const ctaPng = await sharp(watermarkLayout.cta.buffer)
        .resize(watermarkLayout.cta.dimensions.width, watermarkLayout.cta.dimensions.height)
        .png()
        .toBuffer();

      composites.push({
        input: ctaPng,
        top: watermarkLayout.cta.position.top,
        left: watermarkLayout.cta.position.left
      });
    }

    if (composites.length > 0) {
      pipeline = pipeline.composite(composites);
    }

    // 3. Convert to target format
    switch (format) {
      case 'jpg':
        pipeline = pipeline.jpeg({ quality: CONFIG.quality.jpg, progressive: true });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality: CONFIG.quality.webp });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality: CONFIG.quality.avif });
        break;
    }

    return await pipeline.toBuffer();

  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Generate variants for a single page
 */
async function generatePageVariants(page, sourceImage, watermarkLayouts) {
  const results = [];

  try {
    // Load source image
    const sourceBuffer = await fs.readFile(sourceImage.cachePath);

    // Generate all variants
    for (const variantType of Object.keys(CONFIG.variantSpecs)) {
      const spec = CONFIG.variantSpecs[variantType];
      const watermarkLayout = watermarkLayouts[variantType];

      for (const format of CONFIG.formats) {
        try {
          // Generate SEO filename
          const filename = generateSEOImageName(page.page_data, variantType, format);
          const outputPath = path.join(CONFIG.outputDir, CONFIG.siteDomain, variantType, filename);

          // Check if already exists
          try {
            await fs.access(outputPath);
            results.push({ variant: variantType, format, filename, status: 'skipped' });
            continue;
          } catch {
            // Doesn't exist, generate it
          }

          // Process image
          const buffer = await processImage(sourceBuffer, spec, watermarkLayout, format);

          // Save to disk
          await fs.writeFile(outputPath, buffer);

          results.push({
            variant: variantType,
            format,
            filename,
            size: buffer.length,
            status: 'generated'
          });

        } catch (error) {
          results.push({
            variant: variantType,
            format,
            error: error.message,
            status: 'error'
          });
        }
      }
    }

  } catch (error) {
    console.error(`[Batch ${batchId}] Error generating variants for ${page.slug}:`, error.message);
  }

  return results;
}

/**
 * Main generation function
 */
async function generateBatch() {
  const startTime = Date.now();

  // Initialize Supabase
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Load mapping
  const mappingPath = path.resolve(__dirname, '../../page-to-image-mapping.json');
  const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

  const allPages = Object.values(mapping.mappings);

  // Slice pages for this batch
  const pages = endIdx ? allPages.slice(startIdx, endIdx) : allPages.slice(startIdx);

  console.log(`[Batch ${batchId}] Processing ${pages.length} pages (indices ${startIdx}-${startIdx + pages.length - 1})\n`);

  // Load source images from database
  const { data: sourceImages, error } = await supabase
    .from('source_images')
    .select('*')
    .order('image_number');

  if (error) {
    console.error(`[Batch ${batchId}] ❌ Failed to load source images:`, error.message);
    process.exit(1);
  }

  // Create source image lookup and add cache paths
  const sourceByNumber = {};
  sourceImages.forEach(img => {
    sourceByNumber[img.image_number] = {
      ...img,
      cachePath: path.join(CONFIG.cacheDir, img.filename)
    };
  });

  // Get watermark layouts for each variant type
  const watermarkLayouts = {};
  for (const variantType of Object.keys(CONFIG.variantSpecs)) {
    const spec = CONFIG.variantSpecs[variantType];
    watermarkLayouts[variantType] = await watermarkManager.getWatermarkLayout(
      CONFIG.siteDomain,
      spec.width,
      spec.height
    );
  }

  console.log(`[Batch ${batchId}] ✓ Watermarks loaded\n`);
  console.log(`[Batch ${batchId}] Generating variants...\n`);

  const stats = {
    batch_id: batchId,
    start_index: startIdx,
    end_index: startIdx + pages.length,
    total_pages: pages.length,
    pages_processed: 0,
    variants_generated: 0,
    variants_skipped: 0,
    errors: [],
    total_size: 0
  };

  // Process pages
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const sourceImage = sourceByNumber[page.source_image_number];

    if (!sourceImage) {
      console.error(`[Batch ${batchId}] Warning: Source image ${page.source_image_number} not found for ${page.slug}`);
      continue;
    }

    try {
      const results = await generatePageVariants(page, sourceImage, watermarkLayouts);

      results.forEach(r => {
        if (r.status === 'generated') {
          stats.variants_generated++;
          stats.total_size += r.size || 0;
        } else if (r.status === 'skipped') {
          stats.variants_skipped++;
        } else if (r.status === 'error') {
          stats.errors.push({ page: page.slug, ...r });
        }
      });

      stats.pages_processed++;

      // Progress update every 10 pages
      if ((i + 1) % 10 === 0) {
        const percent = ((i + 1) / pages.length * 100).toFixed(1);
        console.log(`[Batch ${batchId}] Progress: ${i + 1}/${pages.length} pages (${percent}%)`);
      }

    } catch (error) {
      stats.errors.push({ page: page.slug, error: error.message });
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const totalSizeMB = (stats.total_size / 1024 / 1024).toFixed(1);

  console.log(`\n[Batch ${batchId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[Batch ${batchId}] COMPLETE`);
  console.log(`[Batch ${batchId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log(`[Batch ${batchId}] Statistics:`);
  console.log(`[Batch ${batchId}]   Pages processed:     ${stats.pages_processed}`);
  console.log(`[Batch ${batchId}]   Variants generated:  ${stats.variants_generated}`);
  console.log(`[Batch ${batchId}]   Variants skipped:    ${stats.variants_skipped}`);
  console.log(`[Batch ${batchId}]   Total size:          ${totalSizeMB} MB`);
  console.log(`[Batch ${batchId}]   Duration:            ${duration} minutes`);
  console.log(`[Batch ${batchId}]   Errors:              ${stats.errors.length}\n`);

  if (stats.errors.length > 0) {
    console.log(`[Batch ${batchId}] First 5 errors:`);
    stats.errors.slice(0, 5).forEach(e => {
      console.log(`[Batch ${batchId}]   • ${e.page}: ${e.error || 'Unknown error'}`);
    });
  }

  // Save batch stats
  const statsPath = path.resolve(__dirname, `../../batch-${batchId}-stats.json`);
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
  console.log(`[Batch ${batchId}] ✓ Stats saved: batch-${batchId}-stats.json\n`);
}

generateBatch().catch(error => {
  console.error(`\n[Batch ${batchId}] ❌ Generation failed:`, error.message);
  console.error(error.stack);
  process.exit(1);
});
