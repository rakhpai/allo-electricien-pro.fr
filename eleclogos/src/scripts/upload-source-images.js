/**
 * Upload Source Images to Supabase Storage
 * Uploads 342 source images from elecphotos/ to Supabase
 * Populates source_images table with metadata
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cliProgress from 'cli-progress';
import { storageHelper } from '../utils/storage-helper.js';
import { imageHelper } from '../utils/image-helper.js';
import { supabaseService } from '../services/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../../elecphotos'),
  bucket: 'source-images',
  prefix: 'electrician',
  concurrency: 5,
  expectedCount: 342
};

/**
 * Scan source directory for images
 */
function scanSourceImages() {
  console.log(`📂 Scanning source directory: ${CONFIG.sourceDir}\n`);

  if (!fs.existsSync(CONFIG.sourceDir)) {
    throw new Error(`Source directory not found: ${CONFIG.sourceDir}`);
  }

  const files = fs.readdirSync(CONFIG.sourceDir);

  // Filter for image files (elec-*.jpg)
  const imageFiles = files.filter(file => {
    return file.match(/^elec-\d{3}\.(jpg|jpeg|png)$/i);
  });

  console.log(`✓ Found ${imageFiles.length} images`);

  if (imageFiles.length === 0) {
    throw new Error('No source images found. Expected files like elec-001.jpg, elec-002.jpg, etc.');
  }

  return imageFiles.sort();
}

/**
 * Extract metadata from all images
 */
async function extractMetadata(imageFiles) {
  console.log(`\n🔍 Extracting metadata from ${imageFiles.length} images...\n`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} | {filename}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(imageFiles.length, 0, { filename: 'Starting...' });

  const imageData = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const filename = imageFiles[i];
    const filePath = path.join(CONFIG.sourceDir, filename);

    try {
      // Parse filename
      const parsed = imageHelper.parseFilename(filename);
      if (!parsed) {
        console.warn(`\nWarning: Could not parse filename: ${filename}`);
        continue;
      }

      // Get metadata
      const metadata = await imageHelper.getImageMetadata(filePath);
      const fileSize = imageHelper.getFileSize(filePath);

      // Prepare data
      imageData.push({
        filename,
        filePath,
        imageNumber: parsed.imageNumber,
        format: parsed.format,
        metadata,
        fileSize
      });

      progressBar.update(i + 1, { filename });

    } catch (error) {
      console.error(`\nError processing ${filename}:`, error.message);
    }
  }

  progressBar.stop();

  console.log(`\n✓ Metadata extracted from ${imageData.length} images`);

  return imageData;
}

/**
 * Upload images to Supabase Storage
 */
async function uploadImages(imageData) {
  console.log(`\n☁️  Uploading ${imageData.length} images to Supabase Storage...\n`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Upload |{bar}| {percentage}% | {value}/{total} | {eta_formatted} | {filename}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(imageData.length, 0, { filename: 'Starting...', eta_formatted: '0s' });

  const uploadResults = [];
  const errors = [];

  // Process in batches for concurrency control
  for (let i = 0; i < imageData.length; i += CONFIG.concurrency) {
    const batch = imageData.slice(i, i + CONFIG.concurrency);

    const batchPromises = batch.map(async (image) => {
      try {
        // Generate storage path
        const storagePath = storageHelper.getSourceStoragePath(
          image.imageNumber,
          image.format
        );

        // Check if already exists
        const exists = await storageHelper.fileExists(CONFIG.bucket, storagePath);

        if (exists) {
          console.log(`\n  ⊙ Skipped (exists): ${storagePath}`);
          return {
            success: true,
            skipped: true,
            imageNumber: image.imageNumber,
            storagePath
          };
        }

        // Upload to Supabase
        const result = await storageHelper.uploadFile(
          CONFIG.bucket,
          storagePath,
          image.filePath,
          {
            contentType: `image/${image.format === 'jpg' ? 'jpeg' : image.format}`,
            cacheControl: '31536000' // 1 year
          }
        );

        return {
          success: true,
          skipped: false,
          imageNumber: image.imageNumber,
          filename: image.filename,
          storagePath,
          publicUrl: result.url,
          fileSize: image.fileSize,
          metadata: image.metadata
        };

      } catch (error) {
        console.error(`\n  ✗ Failed: ${image.filename} - ${error.message}`);
        errors.push({
          imageNumber: image.imageNumber,
          filename: image.filename,
          error: error.message
        });

        return {
          success: false,
          imageNumber: image.imageNumber,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    uploadResults.push(...batchResults);

    // Update progress
    progressBar.update(Math.min(i + CONFIG.concurrency, imageData.length), {
      filename: batchResults[batchResults.length - 1]?.filename || ''
    });
  }

  progressBar.stop();

  const successful = uploadResults.filter(r => r.success && !r.skipped).length;
  const skipped = uploadResults.filter(r => r.skipped).length;
  const failed = uploadResults.filter(r => !r.success).length;

  console.log(`\n✓ Upload complete:`);
  console.log(`  Uploaded: ${successful}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(err => {
      console.log(`  - ${err.filename}: ${err.error}`);
    });
  }

  return uploadResults.filter(r => r.success);
}

/**
 * Populate source_images table in database
 */
async function populateDatabase(uploadResults, imageData) {
  console.log(`\n💾 Populating database with ${uploadResults.length} image records...\n`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Database |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(uploadResults.length, 0);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < uploadResults.length; i++) {
    const result = uploadResults[i];

    // Get metadata from imageData array (works for both uploaded and skipped)
    const imageInfo = imageData.find(img => img.imageNumber === result.imageNumber);

    if (!imageInfo) {
      console.error(`\n  ✗ Could not find metadata for image ${result.imageNumber}`);
      errors++;
      progressBar.update(i + 1);
      continue;
    }

    try {
      const imageRecord = {
        filename: result.filename,
        image_number: result.imageNumber,
        storage_path: result.storagePath,
        storage_bucket: CONFIG.bucket,
        file_size: result.fileSize,
        width: result.metadata.width,
        height: result.metadata.height,
        format: result.metadata.format,
        mime_type: `image/${result.metadata.format === 'jpeg' ? 'jpeg' : result.metadata.format}`,
        metadata: {
          channels: result.metadata.channels,
          depth: result.metadata.depth,
          density: result.metadata.density,
          hasAlpha: result.metadata.hasAlpha,
          space: result.metadata.space
        },
        uploaded_at: new Date().toISOString()
      };

      // Upsert into database
      const { data, error } = await supabaseService.client
        .from('source_images')
        .upsert(imageRecord, {
          onConflict: 'image_number',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        inserted++;
      }

    } catch (error) {
      console.error(`\n  ✗ Database error for image ${result.imageNumber}:`, error.message);
      errors++;
    }

    progressBar.update(i + 1);
  }

  progressBar.stop();

  console.log(`\n✓ Database population complete:`);
  console.log(`  Inserted/Updated: ${inserted}`);
  console.log(`  Errors:           ${errors}`);

  return { inserted, errors };
}

/**
 * Verify upload and database integrity
 */
async function verifyIntegrity() {
  console.log(`\n🔍 Verifying upload integrity...\n`);

  // Query database
  const { data: dbImages, error } = await supabaseService.client
    .from('source_images')
    .select('image_number, filename, storage_path, file_size')
    .order('image_number', { ascending: true });

  if (error) {
    console.error('Database query error:', error.message);
    return;
  }

  console.log(`✓ Database contains ${dbImages.length} image records`);

  // Check for gaps in sequence
  const imageNumbers = dbImages.map(img => img.image_number).sort((a, b) => a - b);
  const gaps = [];

  for (let i = 1; i <= CONFIG.expectedCount; i++) {
    if (!imageNumbers.includes(i)) {
      gaps.push(i);
    }
  }

  if (gaps.length > 0) {
    console.log(`\n⚠️  Missing images: ${gaps.length}`);
    if (gaps.length <= 20) {
      console.log(`   ${gaps.join(', ')}`);
    } else {
      console.log(`   ${gaps.slice(0, 20).join(', ')} ... and ${gaps.length - 20} more`);
    }
  } else {
    console.log(`✓ Complete sequence: 1-${CONFIG.expectedCount}`);
  }

  // Calculate total storage
  const totalBytes = dbImages.reduce((sum, img) => sum + (img.file_size || 0), 0);
  console.log(`\n📊 Storage Statistics:`);
  console.log(`   Total images: ${dbImages.length}`);
  console.log(`   Total size:   ${imageHelper.formatFileSize(totalBytes)}`);
  console.log(`   Average size: ${imageHelper.formatFileSize(totalBytes / dbImages.length)}`);

  return {
    total: dbImages.length,
    gaps: gaps.length,
    totalBytes
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  UPLOAD SOURCE IMAGES TO SUPABASE STORAGE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Scan source directory
    const imageFiles = scanSourceImages();

    // Step 2: Extract metadata
    const imageData = await extractMetadata(imageFiles);

    if (imageData.length === 0) {
      console.error('\n❌ No valid images found to upload');
      process.exit(1);
    }

    // Step 3: Upload to Supabase Storage
    const uploadResults = await uploadImages(imageData);

    if (uploadResults.length === 0) {
      console.error('\n❌ No images were uploaded successfully');
      process.exit(1);
    }

    // Step 4: Populate database
    const dbResult = await populateDatabase(uploadResults, imageData);

    // Step 5: Verify integrity
    await verifyIntegrity();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ SOURCE IMAGE UPLOAD COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Next steps:');
    console.log('1. Verify images in Supabase Storage dashboard');
    console.log('2. Run upload-logos.js to upload brand assets');
    console.log('3. Test image-processor service');
    console.log('4. Begin pre-generation process\n');

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { main as uploadSourceImages };
