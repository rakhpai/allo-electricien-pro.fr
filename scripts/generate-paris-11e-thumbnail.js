import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VIDEO_PATH = path.join(__dirname, '..', 'videos-downloaded', '75-Paris', 'electricien-paris-11e-75.mp4');
const TEMP_DIR = path.join(__dirname, '..', 'tmp-thumbnails');
const EXTRACT_TIME = '00:00:02.5';
const WIDTH = 1280;
const HEIGHT = 720;

async function checkFfmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    console.log('✓ ffmpeg found:', stdout.split('\n')[0]);
    return true;
  } catch (error) {
    console.error('❌ ffmpeg not found. Install with: apt-get install ffmpeg');
    return false;
  }
}

async function generateThumbnails() {
  console.log('🎬 Generating paris-11e video thumbnail\n');

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const baseFilename = 'electricien-urgence-paris-11e-75011-video';
  const jpgPath = path.join(TEMP_DIR, `${baseFilename}.jpg`);
  const webpPath = path.join(TEMP_DIR, `${baseFilename}.webp`);
  const avifPath = path.join(TEMP_DIR, `${baseFilename}.avif`);

  console.log('📹 Source video:', VIDEO_PATH);
  console.log('📁 Output directory:', TEMP_DIR);
  console.log();

  // Check video exists
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error('❌ Video file not found:', VIDEO_PATH);
    process.exit(1);
  }

  // Generate JPG thumbnail
  console.log('1/3 Generating JPG...');
  const jpgCommand = `ffmpeg -ss ${EXTRACT_TIME} -i "${VIDEO_PATH}" -vframes 1 -vf scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1 -q:v 85 -y "${jpgPath}"`;

  try {
    await execAsync(jpgCommand);
    console.log('  ✓ JPG created:', fs.statSync(jpgPath).size, 'bytes');
  } catch (error) {
    console.error('  ❌ Failed to generate JPG:', error.message);
    throw error;
  }

  // Generate WebP thumbnail
  console.log('2/3 Generating WebP...');
  const webpCommand = `ffmpeg -i "${jpgPath}" -vcodec libwebp -q:v 80 -y "${webpPath}"`;

  try {
    await execAsync(webpCommand);
    console.log('  ✓ WebP created:', fs.statSync(webpPath).size, 'bytes');
  } catch (error) {
    console.error('  ❌ Failed to generate WebP:', error.message);
    throw error;
  }

  // Generate AVIF thumbnail
  console.log('3/3 Generating AVIF...');
  const avifCommand = `ffmpeg -i "${jpgPath}" -c:v libaom-av1 -crf 30 -y "${avifPath}"`;

  try {
    await execAsync(avifCommand);
    console.log('  ✓ AVIF created:', fs.statSync(avifPath).size, 'bytes');
  } catch (error) {
    console.error('  ⚠️  Failed to generate AVIF (may not be supported), skipping...');
    // AVIF generation might fail if libaom-av1 is not available
    // We'll upload without it if needed
  }

  return {
    jpg: jpgPath,
    webp: webpPath,
    avif: fs.existsSync(avifPath) ? avifPath : null
  };
}

async function uploadToSupabase(files) {
  console.log('\n📤 Uploading thumbnails to Supabase storage...\n');

  const bucket = 'processed-images';
  const basePath = 'allo-electricien.pro/video';

  const uploads = [
    { format: 'jpg', file: files.jpg },
    { format: 'webp', file: files.webp },
  ];

  if (files.avif) {
    uploads.push({ format: 'avif', file: files.avif });
  }

  const results = [];

  for (const upload of uploads) {
    const filename = path.basename(upload.file);
    const storagePath = `${basePath}/${filename}`;

    console.log(`Uploading ${upload.format.toUpperCase()}...`);

    try {
      const fileBuffer = fs.readFileSync(upload.file);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: `image/${upload.format}`,
          upsert: true
        });

      if (error) {
        console.error(`  ❌ Upload failed:`, error.message);
        results.push({ format: upload.format, success: false, error: error.message });
      } else {
        console.log(`  ✓ Uploaded: ${storagePath}`);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(storagePath);

        console.log(`  🔗 URL: ${urlData.publicUrl}`);
        results.push({ format: upload.format, success: true, url: urlData.publicUrl });
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
      results.push({ format: upload.format, success: false, error: error.message });
    }
  }

  return results;
}

async function cleanup() {
  console.log('\n🧹 Cleaning up temporary files...');
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('  ✓ Temporary files removed');
  } catch (error) {
    console.error('  ⚠️  Could not remove temp files:', error.message);
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('GENERATE PARIS-11E VIDEO THUMBNAIL');
  console.log('═'.repeat(80));
  console.log();

  // Check ffmpeg
  const ffmpegOk = await checkFfmpeg();
  if (!ffmpegOk) {
    process.exit(1);
  }

  // Generate thumbnails
  const files = await generateThumbnails();

  // Upload to Supabase
  const results = await uploadToSupabase(files);

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✓ Successfully uploaded: ${successful} format(s)`);
  if (failed > 0) {
    console.log(`❌ Failed uploads: ${failed} format(s)`);
  }

  results.forEach(r => {
    if (r.success) {
      console.log(`  ✓ ${r.format.toUpperCase()}: ${r.url}`);
    } else {
      console.log(`  ❌ ${r.format.toUpperCase()}: ${r.error}`);
    }
  });

  console.log('\n✅ Paris-11e thumbnail generation complete!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
