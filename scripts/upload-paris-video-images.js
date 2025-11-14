import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SOURCE_DIR = path.join(__dirname, '..', 'eleclogos', 'generated', 'allo-electricien.pro', 'video');
const BUCKET = 'processed-images';
const STORAGE_PATH = 'allo-electricien.pro/video';

/**
 * Get content type for file extension
 */
function getContentType(filename) {
  if (filename.endsWith('.jpg')) return 'image/jpeg';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.avif')) return 'image/avif';
  return 'application/octet-stream';
}

/**
 * Upload a single file to Supabase storage
 */
async function uploadFile(localPath, storagePath) {
  const fileBuffer = fs.readFileSync(localPath);
  const filename = path.basename(localPath);
  const contentType = getContentType(filename);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Main upload function
 */
async function uploadParisVideoImages() {
  console.log('📤 UPLOAD PARIS VIDEO IMAGES TO SUPABASE');
  console.log('='.repeat(80));
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Path: ${STORAGE_PATH}`);
  console.log('='.repeat(80));
  console.log();

  // Find all Paris video files with correct postal codes (750XX)
  const allFiles = fs.readdirSync(SOURCE_DIR);

  // Filter for Paris video files with correct postal codes
  const parisFiles = allFiles.filter(filename => {
    // Match pattern: electricien-urgence-paris-{number}-750{XX}-video.{ext}
    const correctPattern = /^electricien-urgence-paris-(\d+|1er)-750(0[1-9]|1[0-9]|20)-video\.(jpg|webp|avif)$/;
    return correctPattern.test(filename);
  });

  console.log(`Found ${parisFiles.length} Paris video files to upload\n`);

  const results = {
    uploaded: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < parisFiles.length; i++) {
    const filename = parisFiles[i];
    const localPath = path.join(SOURCE_DIR, filename);
    const storagePath = `${STORAGE_PATH}/${filename}`;

    console.log(`[${i + 1}/${parisFiles.length}] ${filename}`);

    try {
      const stats = fs.statSync(localPath);
      console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);

      await uploadFile(localPath, storagePath);

      console.log(`  ✅ Uploaded to ${storagePath}`);
      results.uploaded++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ filename, error: error.message });
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total files processed: ${parisFiles.length}`);
  console.log(`✅ Successfully uploaded: ${results.uploaded}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(80));

  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach(err => {
      console.log(`  - ${err.filename}: ${err.error}`);
    });
  }

  // Save results
  const resultsPath = path.join(__dirname, '..', 'paris-video-upload-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    ...results,
    timestamp: new Date().toISOString(),
    files: parisFiles
  }, null, 2));

  console.log(`\n📄 Results saved to: ${resultsPath}`);
  console.log('\n✅ Upload complete!');
}

uploadParisVideoImages().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
