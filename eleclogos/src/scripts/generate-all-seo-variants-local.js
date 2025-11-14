import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';
import cliProgress from 'cli-progress';
import { generateSEOImageName } from '../utils/image-seo-namer.js';
import { watermarkManager } from '../services/watermark-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('LOCAL SEO IMAGE VARIANT GENERATION');
console.log('═══════════════════════════════════════════════════════════\n');

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
  },
  batchSize: 50, // Process 50 pages at a time
  concurrent: 3 // Generate 3 images concurrently
};

/**
 * Setup output directories
 */
async function setupDirectories() {
  console.log('Setting up directories...\n');

  const dirs = [
    CONFIG.outputDir,
    CONFIG.cacheDir,
    path.join(CONFIG.outputDir, CONFIG.siteDomain, 'hero'),
    path.join(CONFIG.outputDir, CONFIG.siteDomain, 'og'),
    path.join(CONFIG.outputDir, CONFIG.siteDomain, 'featured'),
    path.join(CONFIG.outputDir, CONFIG.siteDomain, 'video')
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log('✓ Directories created:');
  console.log(`  Output: ${CONFIG.outputDir}`);
  console.log(`  Cache: ${CONFIG.cacheDir}\n`);
}

/**
 * Download and cache source images
 */
async function downloadSourceImages(supabase, sourceImages) {
  console.log(`Downloading ${sourceImages.length} source images to cache...\n`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Download |{bar}| {percentage}% | {value}/{total} | {filename}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(sourceImages.length, 0, { filename: 'Starting...' });

  const cached = [];

  for (let i = 0; i < sourceImages.length; i++) {
    const img = sourceImages[i];
    const cachePath = path.join(CONFIG.cacheDir, img.filename);

    try {
      // Check if already cached
      try {
        await fs.access(cachePath);
        cached.push({ ...img, cachePath });
        progressBar.update(i + 1, { filename: img.filename });
        continue;
      } catch {
        // Not cached, need to download
      }

      // Download from Supabase
      const { data, error } = await supabase.storage
        .from('source-images')
        .download(img.storage_path);

      if (error) throw error;

      // Save to cache
      const buffer = Buffer.from(await data.arrayBuffer());
      await fs.writeFile(cachePath, buffer);

      cached.push({ ...img, cachePath });
      progressBar.update(i + 1, { filename: img.filename });

    } catch (error) {
      console.error(`\nError downloading ${img.filename}:`, error.message);
    }
  }

  progressBar.stop();
  console.log(`\n✓ Cached ${cached.length}/${sourceImages.length} source images\n`);

  return cached;
}

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
      // Convert logo SVG to PNG
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
      // Convert CTA SVG to PNG
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
    console.error(`Error generating variants for ${page.slug}:`, error.message);
  }

  return results;
}

/**
 * Main generation function
 */
async function generateAllVariants() {
  const startTime = Date.now();

  // Initialize Supabase
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Setup directories
  await setupDirectories();

  // Load mapping
  console.log('Loading page-to-image mapping...\n');
  const mappingPath = path.resolve(__dirname, '../../page-to-image-mapping.json');
  const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

  const pages = Object.values(mapping.mappings);
  console.log(`✓ Loaded ${pages.length} page mappings\n`);

  // Load source images from database
  console.log('Loading source images from database...\n');
  const { data: sourceImages, error } = await supabase
    .from('source_images')
    .select('*')
    .order('image_number');

  if (error) {
    console.error('❌ Failed to load source images:', error.message);
    process.exit(1);
  }

  console.log(`✓ Loaded ${sourceImages.length} source images\n`);

  // Download and cache source images
  const cachedSources = await downloadSourceImages(supabase, sourceImages);

  // Create source image lookup
  const sourceByNumber = {};
  cachedSources.forEach(img => {
    sourceByNumber[img.image_number] = img;
  });

  // Get watermark layouts for each variant type
  console.log('Loading watermark configurations...\n');
  const watermarkLayouts = {};
  for (const variantType of Object.keys(CONFIG.variantSpecs)) {
    const spec = CONFIG.variantSpecs[variantType];
    watermarkLayouts[variantType] = await watermarkManager.getWatermarkLayout(
      CONFIG.siteDomain,
      spec.width,
      spec.height
    );
  }
  console.log('✓ Watermarks loaded for all variant types\n');

  // Start generation
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GENERATING VARIANTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} pages | ETA: {eta}s | {page}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(pages.length, 0, { page: 'Starting...' });

  const stats = {
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
      console.error(`\nWarning: Source image ${page.source_image_number} not found for ${page.slug}`);
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
      progressBar.update(i + 1, { page: page.slug });

    } catch (error) {
      stats.errors.push({ page: page.slug, error: error.message });
      progressBar.update(i + 1, { page: page.slug });
    }
  }

  progressBar.stop();

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const totalSizeGB = (stats.total_size / 1024 / 1024 / 1024).toFixed(2);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GENERATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Pages processed:     ${stats.pages_processed}`);
  console.log(`  Variants generated:  ${stats.variants_generated}`);
  console.log(`  Variants skipped:    ${stats.variants_skipped} (already exist)`);
  console.log(`  Total size:          ${totalSizeGB} GB`);
  console.log(`  Duration:            ${duration} minutes`);
  console.log(`  Errors:              ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors (first 10):');
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`  • ${e.page}: ${e.error || 'Unknown error'}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more\n`);
    }
  }

  // Save stats
  const statsPath = path.resolve(__dirname, '../../generation-stats.json');
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
  console.log('✓ Statistics saved: generation-stats.json\n');

  console.log('Output directory:');
  console.log(`  ${CONFIG.outputDir}/${CONFIG.siteDomain}/\n`);

  console.log('Next steps:');
  console.log('  1. Verify generated files');
  console.log('  2. Run: node src/scripts/verify-local-generation.js');
  console.log('  3. Upload to Supabase: node src/scripts/batch-upload-variants.js\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

generateAllVariants().catch(error => {
  console.error('\n❌ Generation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
