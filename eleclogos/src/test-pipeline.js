import logger from './utils/logger.js';
import BatchProcessor from './batch-processor.js';
import supabaseService from './services/supabase.js';
import { generateSEOFilename, generateFilePaths } from './utils/seo-filename.js';

/**
 * Test Pipeline Script
 * Tests the complete video generation, download, and optimization pipeline
 * with a small set of test communes
 */

// Test communes (diverse set for testing)
const testCommunes = [
  {
    name: 'Versailles',
    code: '78646',
    department: '78',
    region: 'Île-de-France',
    population: 85771,
    phoneNumber: '06 44 64 71 75',
  },
  {
    name: 'Saint-Denis',
    code: '93066',
    department: '93',
    region: 'Île-de-France',
    population: 111103,
    phoneNumber: '06 44 64 71 75',
  },
  {
    name: 'Cergy',
    code: '95127',
    department: '95',
    region: 'Île-de-France',
    population: 67194,
    phoneNumber: '06 44 64 71 75',
  },
];

/**
 * Monitor test video progress
 * @param {Array} videoIds - Array of video IDs to monitor
 * @param {number} timeout - Timeout in milliseconds
 */
async function monitorTestVideos(videoIds, timeout = 300000) {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds

  logger.info('Monitoring test videos', {
    videoIds,
    timeout: timeout / 1000 + 's',
  });

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > timeout) {
      logger.warn('Monitoring timeout reached');
      break;
    }

    // Check status of each video
    const statuses = await Promise.all(
      videoIds.map(async (id) => {
        const video = await supabaseService.getVideoById(id);
        return {
          id,
          commune: video.commune_name,
          videoStatus: video.video_status,
          downloaded: video.downloaded,
          processingStatus: video.processing_status,
          seoFilename: video.seo_filename,
        };
      })
    );

    // Log current status
    console.log('\n📊 Test Video Status:');
    statuses.forEach((status, index) => {
      console.log(`  ${index + 1}. ${status.commune}:`);
      console.log(`     Video: ${status.videoStatus}`);
      console.log(`     Processing: ${status.processingStatus || 'pending'}`);
      console.log(`     Downloaded: ${status.downloaded ? '✓' : '✗'}`);
      console.log(`     SEO Filename: ${status.seoFilename || 'not set'}`);
    });

    // Check if all are completed
    const allDownloaded = statuses.every(s => s.downloaded);
    const allCompleted = statuses.every(s => s.videoStatus === 'completed');

    if (allDownloaded && allCompleted) {
      console.log('\n✓ All test videos completed and downloaded!');
      return statuses;
    }

    // Wait before next check
    console.log(`\n⏳ Waiting ${pollInterval / 1000}s before next check...`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Get final status even if timeout
  const finalStatuses = await Promise.all(
    videoIds.map(async (id) => {
      const video = await supabaseService.getVideoById(id);
      return {
        id,
        commune: video.commune_name,
        videoStatus: video.video_status,
        downloaded: video.downloaded,
        processingStatus: video.processing_status,
      };
    })
  );

  return finalStatuses;
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('              TESTING VIDEO PIPELINE');
    console.log('='.repeat(70));
    console.log('');
    console.log('This script will:');
    console.log('  1. Generate videos for 3 test communes');
    console.log('  2. Wait for Creatomate to render them');
    console.log('  3. Webhook will automatically download and optimize');
    console.log('  4. Monitor progress and show results');
    console.log('');
    console.log('Test communes:');
    testCommunes.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (${c.code}) - Pop: ${c.population.toLocaleString()}`);

      // Show what the SEO filename will be
      const seoFilename = generateSEOFilename(c);
      const paths = generateFilePaths(c);
      console.log(`     SEO: ${seoFilename}`);
      console.log(`     Dir: ${paths.directory}`);
    });
    console.log('');
    console.log('='.repeat(70));
    console.log('');

    // Confirm before proceeding
    console.log('⚠️  NOTE: Make sure the webhook server is running!');
    console.log('   Run: npm run webhook');
    console.log('');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 1: Generate test videos
    console.log('\n🎬 Step 1: Generating test videos...\n');

    const processor = new BatchProcessor();
    const results = await processor.processBatch(testCommunes);

    console.log('\n✓ Video generation completed:');
    console.log(`  Successful: ${results.successful}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Skipped: ${results.skipped}`);

    if (results.failed > 0) {
      console.log('\n❌ Some videos failed to generate:');
      results.errors.forEach(err => {
        console.log(`  - ${err.commune}: ${err.error}`);
      });
    }

    if (results.successful === 0) {
      console.log('\n❌ No videos were generated. Check logs for errors.');
      process.exit(1);
    }

    // Get video IDs for monitoring
    const videoIds = [];
    for (const commune of testCommunes) {
      const videos = await supabaseService.getVideosByCommune(commune.code);
      if (videos && videos.length > 0) {
        videoIds.push(videos[0].id);
      }
    }

    if (videoIds.length === 0) {
      console.log('\n❌ No video IDs found in database. Something went wrong.');
      process.exit(1);
    }

    console.log(`\n📋 Tracking ${videoIds.length} videos\n`);

    // Step 2: Monitor progress
    console.log('📥 Step 2: Monitoring download and optimization...\n');
    console.log('This may take 5-10 minutes depending on Creatomate render time.');
    console.log('The webhook will automatically download and optimize completed videos.\n');

    const finalStatuses = await monitorTestVideos(videoIds, 600000); // 10 minute timeout

    // Step 3: Show final results
    console.log('\n' + '='.repeat(70));
    console.log('                    TEST RESULTS');
    console.log('='.repeat(70));
    console.log('');

    const completed = finalStatuses.filter(s => s.videoStatus === 'completed').length;
    const downloaded = finalStatuses.filter(s => s.downloaded).length;

    console.log(`Videos Rendered:       ${completed}/${finalStatuses.length}`);
    console.log(`Videos Downloaded:     ${downloaded}/${finalStatuses.length}`);
    console.log('');

    // Get detailed stats for downloaded videos
    if (downloaded > 0) {
      console.log('Downloaded Video Details:');
      for (const status of finalStatuses.filter(s => s.downloaded)) {
        const video = await supabaseService.getVideoById(status.id);
        console.log(`\n  ${video.commune_name}:`);
        console.log(`    SEO Filename:      ${video.seo_filename}`);
        console.log(`    Storage Path:      ${video.local_storage_path}`);
        console.log(`    Original Size:     ${(video.file_size_original / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Compressed Size:   ${(video.file_size_compressed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Compression:       ${((1 - video.file_size_compressed / video.file_size_original) * 100).toFixed(2)}%`);
        console.log(`    Formats:           ${Object.keys(video.video_formats || {}).join(', ')}`);
      }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('');

    // Summary
    if (downloaded === finalStatuses.length && completed === finalStatuses.length) {
      console.log('✅ TEST PASSED: All videos generated, downloaded, and optimized successfully!\n');
      console.log('You can now run the full batch with:');
      console.log('  npm run generate:all\n');
      process.exit(0);
    } else {
      console.log('⚠️  TEST INCOMPLETE: Some videos not yet completed.\n');
      console.log('Check logs for details. You may need to wait longer or check the webhook server.\n');
      process.exit(1);
    }

  } catch (error) {
    logger.error('Test pipeline failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Test failed:', error.message);
    console.error('See logs for details.\n');

    process.exit(1);
  }
}

// Run
main();
