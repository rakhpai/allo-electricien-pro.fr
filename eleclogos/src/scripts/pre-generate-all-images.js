/**
 * Pre-Generate All Images
 * Batch generate all 4,104 image variants
 * 342 images × 4 variants (hero, og, featured, video) × 3 formats (jpg, webp, avif)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cliProgress from 'cli-progress';
import { imageProcessor } from '../services/image-processor.js';
import { watermarkManager } from '../services/watermark-manager.js';
import { supabaseService } from '../services/supabase.js';
import { imageHelper } from '../utils/image-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  siteIdentifier: 'allo-electricien.pro',
  totalImages: 342,
  variants: ['hero', 'og', 'featured', 'video'],
  formats: ['jpg', 'webp', 'avif'],
  concurrency: 3, // Process 3 images at a time
  saveProgressInterval: 10, // Save progress every 10 images
  reportPath: path.join(__dirname, '../data/generation-report.json')
};

// Calculate totals
const TOTALS = {
  images: CONFIG.totalImages,
  variants: CONFIG.variants.length,
  formats: CONFIG.formats.length,
  total: CONFIG.totalImages * CONFIG.variants.length * CONFIG.formats.length
};

/**
 * Load or create progress state
 */
function loadProgress() {
  const progressPath = path.join(__dirname, '../data/generation-progress.json');

  if (fs.existsSync(progressPath)) {
    console.log('📂 Loading previous progress...\n');
    const data = fs.readFileSync(progressPath, 'utf8');
    return JSON.parse(data);
  }

  return {
    completedImages: [],
    failedImages: [],
    startedAt: null,
    lastUpdated: null,
    resumeCount: 0
  };
}

/**
 * Save progress state
 */
function saveProgress(progress) {
  const progressPath = path.join(__dirname, '../data/generation-progress.json');

  // Ensure directory exists
  const dir = path.dirname(progressPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  progress.lastUpdated = new Date().toISOString();

  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
}

/**
 * Get list of image numbers to process
 */
async function getImagesToProcess(progress) {
  console.log('📋 Determining images to process...\n');

  // Get all source images from database
  const { data: sourceImages, error } = await supabaseService.client
    .from('source_images')
    .select('image_number')
    .order('image_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch source images: ${error.message}`);
  }

  const allImages = sourceImages.map(img => img.image_number);

  console.log(`✓ Found ${allImages.length} source images in database`);

  // Filter out completed images
  const toProcess = allImages.filter(num => !progress.completedImages.includes(num));

  console.log(`✓ ${progress.completedImages.length} already completed`);
  console.log(`✓ ${toProcess.length} remaining to process\n`);

  return {
    all: allImages,
    toProcess,
    completed: progress.completedImages
  };
}

/**
 * Preload watermarks to speed up processing
 */
async function preloadWatermarks() {
  console.log('🔧 Preloading watermarks...\n');

  await watermarkManager.preloadWatermarks(CONFIG.siteIdentifier);

  console.log('✓ Watermarks preloaded\n');
}

/**
 * Generate all variants for a single image
 */
async function generateImageVariants(imageNumber) {
  try {
    const results = {};

    for (const variantType of CONFIG.variants) {
      results[variantType] = {};

      for (const format of CONFIG.formats) {
        try {
          const url = await imageProcessor.getImageVariant(
            imageNumber,
            CONFIG.siteIdentifier,
            variantType,
            format
          );

          results[variantType][format] = {
            success: true,
            url
          };

        } catch (error) {
          results[variantType][format] = {
            success: false,
            error: error.message
          };
        }
      }
    }

    return {
      success: true,
      results
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Batch generate all images
 */
async function batchGenerate(imagesToProcess, progress) {
  console.log('🚀 Starting batch generation...\n');
  console.log(`Total images to process: ${imagesToProcess.length}`);
  console.log(`Variants per image: ${CONFIG.variants.join(', ')}`);
  console.log(`Formats: ${CONFIG.formats.join(', ')}`);
  console.log(`Concurrency: ${CONFIG.concurrency}\n`);
  console.log(`Total files to generate: ${imagesToProcess.length * TOTALS.variants * TOTALS.formats}\n`);

  const startTime = Date.now();

  // Create progress bars
  const multibar = new cliProgress.MultiBar({
    format: '{name} |{bar}| {percentage}% | {value}/{total} | ETA: {eta_formatted} | {status}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true
  });

  const overallBar = multibar.create(imagesToProcess.length, 0, {
    name: 'Overall  ',
    status: 'Starting...'
  });

  const variantBar = multibar.create(TOTALS.variants * TOTALS.formats, 0, {
    name: 'Current  ',
    status: 'Waiting...'
  });

  const stats = {
    completed: 0,
    failed: 0,
    totalGenerationTime: 0,
    errors: []
  };

  // Process in batches
  for (let i = 0; i < imagesToProcess.length; i += CONFIG.concurrency) {
    const batch = imagesToProcess.slice(i, i + CONFIG.concurrency);

    const batchPromises = batch.map(async (imageNumber) => {
      variantBar.update(0, { status: `Image ${imageNumber}` });

      const result = await generateImageVariants(imageNumber);

      // Count successes and failures
      let successCount = 0;
      let failCount = 0;

      if (result.success) {
        for (const variantType in result.results) {
          for (const format in result.results[variantType]) {
            if (result.results[variantType][format].success) {
              successCount++;
            } else {
              failCount++;
            }
            variantBar.increment(1);
          }
        }
      } else {
        failCount = TOTALS.variants * TOTALS.formats;
        variantBar.increment(TOTALS.variants * TOTALS.formats);
      }

      if (failCount === 0) {
        progress.completedImages.push(imageNumber);
        stats.completed++;
      } else {
        progress.failedImages.push({
          imageNumber,
          error: result.error || 'Partial failure',
          failCount
        });
        stats.failed++;
        stats.errors.push({
          imageNumber,
          error: result.error || 'Some variants failed'
        });
      }

      overallBar.increment(1, { status: `${stats.completed} OK, ${stats.failed} failed` });

      return result;
    });

    await Promise.all(batchPromises);

    // Save progress periodically
    if ((i / CONFIG.concurrency) % CONFIG.saveProgressInterval === 0) {
      saveProgress(progress);
    }

    // Reset variant bar for next batch
    variantBar.update(0);
  }

  multibar.stop();

  const totalTime = Date.now() - startTime;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BATCH GENERATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✓ Completed: ${stats.completed} images`);
  console.log(`✗ Failed:    ${stats.failed} images`);
  console.log(`⏱  Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
  console.log(`⚡ Avg time per image: ${(totalTime / imagesToProcess.length / 1000).toFixed(1)}s\n`);

  if (stats.errors.length > 0) {
    console.log(`⚠️  Errors (showing first 10):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   Image ${err.imageNumber}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more\n`);
    }
  }

  return {
    stats,
    totalTime
  };
}

/**
 * Generate final report
 */
async function generateReport(progress, stats, totalTime) {
  console.log('📊 Generating final report...\n');

  // Get statistics from image processor
  const processorStats = await imageProcessor.getStatistics(CONFIG.siteIdentifier);

  const report = {
    generated_at: new Date().toISOString(),
    site: CONFIG.siteIdentifier,
    configuration: {
      total_source_images: CONFIG.totalImages,
      variants: CONFIG.variants,
      formats: CONFIG.formats,
      concurrency: CONFIG.concurrency
    },
    expected: {
      total_files: TOTALS.total,
      files_per_image: TOTALS.variants * TOTALS.formats
    },
    results: {
      images_completed: progress.completedImages.length,
      images_failed: progress.failedImages.length,
      success_rate: ((progress.completedImages.length / CONFIG.totalImages) * 100).toFixed(2) + '%'
    },
    performance: {
      total_time_ms: totalTime,
      total_time_minutes: (totalTime / 1000 / 60).toFixed(1),
      avg_time_per_image_ms: Math.round(totalTime / CONFIG.totalImages),
      avg_time_per_file_ms: Math.round(totalTime / TOTALS.total)
    },
    storage: {
      total_variants: processorStats.total_variants,
      total_size_bytes: processorStats.total_size_bytes,
      total_size_mb: processorStats.total_size_mb,
      total_size_gb: processorStats.total_size_gb,
      by_variant: processorStats.by_variant,
      by_format: processorStats.by_format
    },
    errors: progress.failedImages,
    resume_count: progress.resumeCount
  };

  // Save report
  const dir = path.dirname(CONFIG.reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`✓ Report saved to: ${CONFIG.reportPath}\n`);

  // Print summary
  console.log('📊 Final Statistics:\n');
  console.log(`Total variants generated: ${processorStats.total_variants}`);
  console.log(`Total storage used: ${processorStats.total_size_gb} GB`);
  console.log(`\nBy Variant:`);
  Object.entries(processorStats.by_variant).forEach(([variant, count]) => {
    console.log(`  ${variant}: ${count}`);
  });
  console.log(`\nBy Format:`);
  Object.entries(processorStats.by_format).forEach(([format, count]) => {
    console.log(`  ${format}: ${count}`);
  });
  console.log();

  return report;
}

/**
 * Verify generation completeness
 */
async function verifyGeneration() {
  console.log('🔍 Verifying generation completeness...\n');

  const { data: variants, error } = await supabaseService.client
    .from('image_variants')
    .select('source_images!inner(image_number), variant_type, format')
    .order('source_images.image_number', { ascending: true });

  if (error) {
    console.warn('Verification failed:', error.message);
    return;
  }

  // Check coverage
  const coverage = {};

  for (let i = 1; i <= CONFIG.totalImages; i++) {
    coverage[i] = {
      hero: { jpg: false, webp: false, avif: false },
      og: { jpg: false, webp: false, avif: false },
      featured: { jpg: false, webp: false, avif: false },
      video: { jpg: false, webp: false, avif: false }
    };
  }

  variants.forEach(v => {
    const imgNum = v.source_images.image_number;
    if (coverage[imgNum]) {
      coverage[imgNum][v.variant_type][v.format] = true;
    }
  });

  // Find gaps
  const gaps = [];

  for (let i = 1; i <= CONFIG.totalImages; i++) {
    const missing = [];

    for (const variant of CONFIG.variants) {
      for (const format of CONFIG.formats) {
        if (!coverage[i][variant][format]) {
          missing.push(`${variant}-${format}`);
        }
      }
    }

    if (missing.length > 0) {
      gaps.push({
        imageNumber: i,
        missing
      });
    }
  }

  if (gaps.length === 0) {
    console.log('✅ Perfect! All images have complete variant coverage.\n');
  } else {
    console.log(`⚠️  Found ${gaps.length} images with missing variants:\n`);
    gaps.slice(0, 10).forEach(gap => {
      console.log(`   Image ${gap.imageNumber}: missing ${gap.missing.join(', ')}`);
    });
    if (gaps.length > 10) {
      console.log(`   ... and ${gaps.length - 10} more\n`);
    }
  }

  return { complete: gaps.length === 0, gaps };
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PRE-GENERATE ALL IMAGE VARIANTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Site: ${CONFIG.siteIdentifier}`);
  console.log(`Total images: ${CONFIG.totalImages}`);
  console.log(`Variants: ${CONFIG.variants.join(', ')}`);
  console.log(`Formats: ${CONFIG.formats.join(', ')}`);
  console.log(`Expected files: ${TOTALS.total}\n`);

  try {
    // Load previous progress
    const progress = loadProgress();

    if (progress.completedImages.length > 0) {
      console.log(`📂 Resuming from previous run (attempt #${progress.resumeCount + 1})`);
      console.log(`   Completed: ${progress.completedImages.length} images\n`);
      progress.resumeCount++;
    } else {
      progress.startedAt = new Date().toISOString();
    }

    // Get images to process
    const images = await getImagesToProcess(progress);

    if (images.toProcess.length === 0) {
      console.log('✅ All images already generated!\n');
      await verifyGeneration();
      return;
    }

    // Preload watermarks
    await preloadWatermarks();

    // Batch generate
    const { stats, totalTime } = await batchGenerate(images.toProcess, progress);

    // Save final progress
    saveProgress(progress);

    // Generate report
    await generateReport(progress, stats, totalTime);

    // Verify generation
    await verifyGeneration();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ PRE-GENERATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Next steps:');
    console.log('1. Verify images in Supabase Storage dashboard');
    console.log('2. Check generation report for any errors');
    console.log('3. Test image URLs in browser');
    console.log('4. Begin Hugo site migration\n');

  } catch (error) {
    console.error('\n❌ Pre-generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { main as preGenerateAllImages };
