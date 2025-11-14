import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import cliProgress from 'cli-progress';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('BATCH UPLOAD TO SUPABASE CDN');
console.log('═══════════════════════════════════════════════════════════\n');

// Configuration
const CONFIG = {
  siteDomain: 'allo-electricien.pro',
  localDir: path.resolve(__dirname, '../../generated/allo-electricien.pro'),
  bucket: 'processed-images',
  variantTypes: ['hero', 'og', 'featured', 'video'],
  batchSize: 50, // Upload 50 files at a time
  concurrent: 10 // 10 concurrent uploads
};

/**
 * Upload files in batches with concurrency control
 */
async function uploadBatch(supabase, files) {
  const results = {
    uploaded: 0,
    skipped: 0,
    errors: []
  };

  // Process in chunks for concurrency control
  for (let i = 0; i < files.length; i += CONFIG.concurrent) {
    const chunk = files.slice(i, i + CONFIG.concurrent);

    const promises = chunk.map(async (file) => {
      try {
        const { localPath, storagePath } = file;

        // Check if already exists
        const { data: existing } = await supabase.storage
          .from(CONFIG.bucket)
          .list(path.dirname(storagePath), {
            search: path.basename(storagePath)
          });

        if (existing && existing.length > 0) {
          return { status: 'skipped', file: storagePath };
        }

        // Read file
        const fileBuffer = await fs.readFile(localPath);

        // Upload to Supabase
        const { error } = await supabase.storage
          .from(CONFIG.bucket)
          .upload(storagePath, fileBuffer, {
            contentType: getMimeType(localPath),
            cacheControl: '31536000', // 1 year
            upsert: false
          });

        if (error) {
          return { status: 'error', file: storagePath, error: error.message };
        }

        return { status: 'uploaded', file: storagePath };

      } catch (error) {
        return { status: 'error', file: file.storagePath, error: error.message };
      }
    });

    const chunkResults = await Promise.all(promises);

    chunkResults.forEach(result => {
      if (result.status === 'uploaded') {
        results.uploaded++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else if (result.status === 'error') {
        results.errors.push(result);
      }
    });
  }

  return results;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.png': 'image/png'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get all files to upload
 */
async function getAllFiles() {
  const files = [];

  for (const variantType of CONFIG.variantTypes) {
    const variantDir = path.join(CONFIG.localDir, variantType);

    try {
      const dirFiles = await fs.readdir(variantDir);

      for (const filename of dirFiles) {
        if (filename.match(/\.(jpg|jpeg|webp|avif)$/i)) {
          files.push({
            localPath: path.join(variantDir, filename),
            storagePath: `${CONFIG.siteDomain}/${variantType}/${filename}`,
            variantType,
            filename
          });
        }
      }
    } catch (error) {
      console.error(`Error reading ${variantType} directory:`, error.message);
    }
  }

  return files;
}

/**
 * Main upload function
 */
async function uploadAllFiles() {
  const startTime = Date.now();

  // Initialize Supabase
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get all files
  console.log('Scanning local files...\n');
  const allFiles = await getAllFiles();

  console.log(`Found ${allFiles.length} files to upload\n`);

  if (allFiles.length === 0) {
    console.log('No files to upload!\n');
    return;
  }

  // Group by variant type for reporting
  const byType = {};
  CONFIG.variantTypes.forEach(type => {
    byType[type] = allFiles.filter(f => f.variantType === type).length;
  });

  console.log('Files by type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} files`);
  });
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPLOADING TO SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const progressBar = new cliProgress.SingleBar({
    format: 'Upload |{bar}| {percentage}% | {value}/{total} | {uploaded} uploaded, {skipped} skipped, {errors} errors',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  const stats = {
    total: allFiles.length,
    uploaded: 0,
    skipped: 0,
    errors: []
  };

  progressBar.start(allFiles.length, 0, {
    uploaded: 0,
    skipped: 0,
    errors: 0
  });

  // Upload in batches
  for (let i = 0; i < allFiles.length; i += CONFIG.batchSize) {
    const batch = allFiles.slice(i, i + CONFIG.batchSize);
    const batchResults = await uploadBatch(supabase, batch);

    stats.uploaded += batchResults.uploaded;
    stats.skipped += batchResults.skipped;
    stats.errors.push(...batchResults.errors);

    progressBar.update(i + batch.length, {
      uploaded: stats.uploaded,
      skipped: stats.skipped,
      errors: stats.errors.length
    });
  }

  progressBar.stop();

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('UPLOAD COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Total files:       ${stats.total}`);
  console.log(`  Uploaded:          ${stats.uploaded}`);
  console.log(`  Skipped:           ${stats.skipped} (already exist)`);
  console.log(`  Errors:            ${stats.errors.length}`);
  console.log(`  Duration:          ${duration} minutes`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors (first 10):');
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`  • ${e.file}: ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more\n`);
    }
  }

  // Save stats
  const statsPath = path.resolve(__dirname, '../../upload-stats.json');
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
  console.log('✓ Statistics saved: upload-stats.json\n');

  if (stats.uploaded > 0) {
    console.log('✅ Files are now available on Supabase CDN!');
    console.log(`   Bucket: ${CONFIG.bucket}`);
    console.log(`   Path: ${CONFIG.siteDomain}/[variant]/[filename]\n`);
  }

  console.log('Next steps:');
  console.log('  1. Update Hugo frontmatter with image URLs');
  console.log('  2. Update Hugo templates to use CDN images');
  console.log('  3. Test and deploy\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

uploadAllFiles().catch(error => {
  console.error('\n❌ Upload failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
