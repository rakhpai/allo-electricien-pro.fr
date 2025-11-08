require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

console.log('=== GENERATE VIDEO THUMBNAILS ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 5 : null;
const SKIP_WEBP = process.argv.includes('--skip-webp');

const VIDEO_SOURCE_DIR = path.join(__dirname, '..', 'videos-downloaded');
const THUMBNAIL_OUTPUT_DIR = path.join(__dirname, '..', 'static', 'images', 'video');

// Thumbnail settings
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;
const THUMBNAIL_QUALITY = 85;
const EXTRACT_TIME = '00:00:02.5'; // Extract frame at 2.5 seconds

if (DRY_RUN) {
  console.log('[DRY RUN MODE] No files will be written\n');
}

if (TEST_MODE) {
  console.log('[TEST MODE] Will only process ' + TEST_LIMIT + ' videos\n');
}

if (SKIP_WEBP) {
  console.log('[SKIP_WEBP MODE] Only generating JPG thumbnails\n');
}

/**
 * Check if ffmpeg is installed
 */
async function checkFfmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    const version = stdout.split('\n')[0];
    console.log('Found: ' + version + '\n');
    return true;
  } catch (error) {
    console.error('ERROR: ffmpeg not found. Please install ffmpeg first.');
    console.error('   Ubuntu/Debian: sudo apt-get install ffmpeg');
    console.error('   CentOS/RHEL: sudo yum install ffmpeg');
    return false;
  }
}

/**
 * Find all unique video files (using MP4 as source)
 */
function findVideoFiles() {
  const videoFiles = [];
  const departments = fs.readdirSync(VIDEO_SOURCE_DIR);

  for (const dept of departments) {
    const deptPath = path.join(VIDEO_SOURCE_DIR, dept);
    const stat = fs.statSync(deptPath);

    if (!stat.isDirectory()) continue;

    const files = fs.readdirSync(deptPath);

    for (const file of files) {
      // Only process original MP4 files (not compressed)
      // We use the higher quality source for better thumbnails
      if (file.endsWith('.mp4') && !file.includes('-compressed')) {
        const videoPath = path.join(deptPath, file);
        const basename = file.replace('.mp4', '');

        videoFiles.push({
          path: videoPath,
          basename: basename,
          filename: file,
          department: dept
        });
      }
    }
  }

  return videoFiles;
}

/**
 * Generate JPG thumbnail from video
 */
async function generateJpgThumbnail(videoPath, outputPath) {
  const command = 'ffmpeg -ss ' + EXTRACT_TIME + ' -i "' + videoPath + '" -vframes 1 -vf scale=' + THUMBNAIL_WIDTH + ':' + THUMBNAIL_HEIGHT + ':force_original_aspect_ratio=decrease,pad=' + THUMBNAIL_WIDTH + ':' + THUMBNAIL_HEIGHT + ':(ow-iw)/2:(oh-ih)/2,setsar=1 -q:v ' + THUMBNAIL_QUALITY + ' -y "' + outputPath + '"';

  await execAsync(command);
}

/**
 * Generate WebP thumbnail from JPG
 */
async function generateWebpThumbnail(jpgPath, outputPath) {
  const command = 'ffmpeg -i "' + jpgPath + '" -vf scale=' + THUMBNAIL_WIDTH + ':' + THUMBNAIL_HEIGHT + ' -quality ' + THUMBNAIL_QUALITY + ' -y "' + outputPath + '"';

  await execAsync(command);
}

/**
 * Main generation function
 */
async function generateThumbnails() {
  const stats = {
    videos_found: 0,
    thumbnails_generated: 0,
    webp_generated: 0,
    errors: [],
    skipped: 0
  };

  console.log('='.repeat(60));
  console.log('STEP 1: CHECK DEPENDENCIES');
  console.log('='.repeat(60) + '\n');

  const ffmpegInstalled = await checkFfmpeg();
  if (!ffmpegInstalled) {
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('STEP 2: FIND VIDEO FILES');
  console.log('='.repeat(60) + '\n');

  const videoFiles = findVideoFiles();
  stats.videos_found = videoFiles.length;

  console.log('Found ' + videoFiles.length + ' video files\n');

  // Limit in test mode
  const videosToProcess = TEST_MODE ? videoFiles.slice(0, TEST_LIMIT) : videoFiles;

  console.log('='.repeat(60));
  console.log('STEP 3: CREATE OUTPUT DIRECTORY');
  console.log('='.repeat(60) + '\n');

  if (!DRY_RUN) {
    if (!fs.existsSync(THUMBNAIL_OUTPUT_DIR)) {
      fs.mkdirSync(THUMBNAIL_OUTPUT_DIR, { recursive: true });
      console.log('Created directory: ' + THUMBNAIL_OUTPUT_DIR + '\n');
    } else {
      console.log('Directory exists: ' + THUMBNAIL_OUTPUT_DIR + '\n');
    }
  } else {
    console.log('Would create: ' + THUMBNAIL_OUTPUT_DIR + '\n');
  }

  console.log('='.repeat(60));
  console.log('STEP 4: GENERATE THUMBNAILS');
  console.log('='.repeat(60) + '\n');

  console.log('Processing ' + videosToProcess.length + ' videos...\n');

  for (let i = 0; i < videosToProcess.length; i++) {
    const video = videosToProcess[i];
    const jpgOutput = path.join(THUMBNAIL_OUTPUT_DIR, video.basename + '.jpg');
    const webpOutput = path.join(THUMBNAIL_OUTPUT_DIR, video.basename + '.webp');

    try {
      // Check if thumbnail already exists
      if (!DRY_RUN && fs.existsSync(jpgOutput)) {
        stats.skipped++;
        if (stats.skipped <= 5) {
          console.log('  SKIP: ' + video.basename + '.jpg (already exists)');
        }
        continue;
      }

      if (DRY_RUN) {
        console.log('  [DRY RUN] Would generate: ' + video.basename + '.jpg');
        if (!SKIP_WEBP) {
          console.log('  [DRY RUN] Would generate: ' + video.basename + '.webp');
        }
        stats.thumbnails_generated++;
        continue;
      }

      // Generate JPG thumbnail
      await generateJpgThumbnail(video.path, jpgOutput);
      stats.thumbnails_generated++;

      // Get file size
      const jpgStats = fs.statSync(jpgOutput);
      const jpgSizeKB = (jpgStats.size / 1024).toFixed(1);

      console.log('  OK [' + (i + 1) + '/' + videosToProcess.length + '] ' + video.basename + '.jpg (' + jpgSizeKB + ' KB)');

      // Generate WebP thumbnail (if not skipped)
      if (!SKIP_WEBP) {
        await generateWebpThumbnail(jpgOutput, webpOutput);
        stats.webp_generated++;

        const webpStats = fs.statSync(webpOutput);
        const webpSizeKB = (webpStats.size / 1024).toFixed(1);

        console.log('  OK [' + (i + 1) + '/' + videosToProcess.length + '] ' + video.basename + '.webp (' + webpSizeKB + ' KB)');
      }

    } catch (error) {
      stats.errors.push({
        video: video.filename,
        path: video.path,
        error: error.message
      });

      console.log('  ERROR: ' + video.basename + ' - ' + error.message);
    }

    // Progress update every 50 videos
    if ((i + 1) % 50 === 0) {
      const progress = (((i + 1) / videosToProcess.length) * 100).toFixed(1);
      console.log('\n  Progress: ' + (i + 1) + '/' + videosToProcess.length + ' (' + progress + '%)\n');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('GENERATION COMPLETE');
  console.log('='.repeat(60) + '\n');

  console.log('Statistics:');
  console.log('  Videos found:              ' + stats.videos_found);
  console.log('  Thumbnails generated:      ' + stats.thumbnails_generated);
  console.log('  WebP thumbnails generated: ' + stats.webp_generated);
  console.log('  Already existed (skipped): ' + stats.skipped);
  console.log('  Errors:                    ' + stats.errors.length);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors (showing first 10 of ' + stats.errors.length + '):');
    stats.errors.slice(0, 10).forEach(function(err) {
      console.log('  - ' + err.video + ': ' + err.error);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'thumbnail-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log('\n  Full error log saved to: thumbnail-errors.json');
  }

  console.log('');

  if (DRY_RUN) {
    console.log('TIP: Run without --dry-run flag to generate thumbnails');
  }

  if (TEST_MODE) {
    console.log('TIP: Run without --test flag to process all videos');
  }

  if (SKIP_WEBP) {
    console.log('TIP: Run without --skip-webp flag to generate WebP thumbnails');
  }

  // Save generation summary
  const summaryPath = path.join(__dirname, '..', 'thumbnail-generation-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    output_directory: THUMBNAIL_OUTPUT_DIR,
    settings: {
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
      quality: THUMBNAIL_QUALITY,
      extract_time: EXTRACT_TIME,
      skip_webp: SKIP_WEBP
    },
    stats: stats
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('Summary saved to: thumbnail-generation-summary.json\n');
}

// Run generation
generateThumbnails().catch(function(error) {
  console.error('FATAL ERROR: ' + error.message);
  process.exit(1);
});
