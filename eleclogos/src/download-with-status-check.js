import logger from './utils/logger.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';
import { downloadCommuneVideo } from './utils/video-downloader.js';
import { processVideo } from './utils/video-optimizer.js';
import cliProgress from 'cli-progress';

/**
 * Download Script with Status Checking
 * Checks Creatomate status for "processing" videos, updates database, and downloads completed ones
 */

/**
 * Check render status and update database
 */
async function checkAndUpdateStatus(video) {
  try {
    const render = await creatomateService.getRenderStatus(video.render_id);

    if (render.status === 'succeeded' && render.url) {
      // Update to completed
      await supabaseService.client
        .from('videos')
        .update({
          video_status: 'completed',
          video_url: render.url,
          render_completed_at: new Date().toISOString(),
        })
        .eq('id', video.id);

      return { ...video, video_status: 'completed', video_url: render.url };
    } else if (render.status === 'failed') {
      // Mark as failed
      await supabaseService.client
        .from('videos')
        .update({
          video_status: 'failed',
        })
        .eq('id', video.id);

      return null; // Skip download
    } else {
      // Still processing
      return null; // Skip download
    }
  } catch (error) {
    logger.error('Failed to check render status', {
      videoId: video.id,
      error: error.message,
    });
    return null;
  }
}

/**
 * Download and optimize a video
 */
async function downloadAndOptimize(video) {
  try {
    await supabaseService.updateProcessingStatus(video.id, 'downloading');

    const communeData = {
      name: video.commune_name,
      code: video.commune_code,
      department: video.commune_code.substring(0, 2),
      population: video.commune_population,
    };

    const downloadResult = await downloadCommuneVideo(video, communeData, 'videos-downloaded');
    await supabaseService.updateProcessingStatus(video.id, 'optimizing');

    const optimizationResult = await processVideo(downloadResult.downloadedFile);

    await supabaseService.markVideoDownloaded(video.id, {
      seo_filename: downloadResult.seoFilename,
      local_filename: downloadResult.seoFilename,
      local_storage_path: downloadResult.filePaths.directory,
      file_size_original: optimizationResult.sizes.original,
      file_size_compressed: optimizationResult.sizes.compressed,
      video_formats: {
        original: optimizationResult.originalPath,
        compressed: optimizationResult.compressedPath,
        webm: optimizationResult.webmPath,
      },
    });

    return { success: true, video, optimization: optimizationResult };
  } catch (error) {
    await supabaseService.updateProcessingStatus(video.id, 'failed');
    return { success: false, video, error: error.message };
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const checkBatchSize = parseInt(args.find(a => a.startsWith('--check='))?.split('=')[1]) || 100;
    const downloadBatchSize = parseInt(args.find(a => a.startsWith('--download='))?.split('=')[1]) || 50;
    const concurrency = parseInt(args.find(a => a.startsWith('--concurrent='))?.split('=')[1]) || 3;

    console.log('\n' + '='.repeat(70));
    console.log('     CHECKING STATUSES AND DOWNLOADING COMPLETED RENDERS');
    console.log('='.repeat(70));
    console.log('');
    console.log(`Configuration:`);
    console.log(`  Check batch size: ${checkBatchSize} videos`);
    console.log(`  Download batch size: ${downloadBatchSize} videos`);
    console.log(`  Concurrent downloads: ${concurrency}`);
    console.log('');

    // === PHASE 1: Check render statuses ===
    console.log('PHASE 1: Checking render statuses on Creatomate');
    console.log('');

    // Get processing videos
    const { data: processingVideos } = await supabaseService.client
      .from('videos')
      .select('*')
      .eq('video_status', 'processing')
      .not('render_id', 'is', null)
      .limit(checkBatchSize);

    if (!processingVideos || processingVideos.length === 0) {
      console.log('✅ No processing videos found. Moving to download phase...');
      console.log('');
    } else {
      console.log(`Found ${processingVideos.length} processing videos to check`);
      console.log('');

      const checkProgressBar = new cliProgress.SingleBar({
        format: 'Checking |{bar}| {percentage}% | {value}/{total} | {current}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      });

      checkProgressBar.start(processingVideos.length, 0, { current: '' });

      let statusUpdated = 0;
      let stillProcessing = 0;

      // Check statuses sequentially (1/sec to avoid rate limits)
      for (let i = 0; i < processingVideos.length; i++) {
        const video = processingVideos[i];
        checkProgressBar.update(i + 1, { current: video.commune_name });

        const updatedVideo = await checkAndUpdateStatus(video);
        if (updatedVideo) {
          statusUpdated++;
        } else {
          stillProcessing++;
        }

        // Rate limit: 1 request per second
        if (i < processingVideos.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      checkProgressBar.stop();

      console.log('');
      console.log(`Status check complete:`);
      console.log(`  ✅ Completed: ${statusUpdated}`);
      console.log(`  ⏳ Still processing: ${stillProcessing}`);
      console.log('');
    }

    // === PHASE 2: Download completed videos ===
    console.log('PHASE 2: Downloading completed videos');
    console.log('');

    // Get completed videos that haven't been downloaded
    const { data: pendingVideos } = await supabaseService.client
      .from('videos')
      .select('*')
      .eq('video_status', 'completed')
      .eq('downloaded', false)
      .not('video_url', 'is', null)
      .order('render_completed_at', { ascending: true })
      .limit(downloadBatchSize);

    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('✅ No videos ready to download.');
      console.log('');

      // Show statistics
      const stats = await supabaseService.getDownloadStats();
      console.log('Current Status:');
      console.log(`  Total Videos: ${stats.total}`);
      console.log(`  Downloaded: ${stats.downloaded}`);
      console.log(`  Pending: ${stats.pending}`);
      console.log('');

      process.exit(0);
    }

    console.log(`Found ${pendingVideos.length} videos ready to download`);
    console.log('');

    // Create progress bar for downloads
    const downloadProgressBar = new cliProgress.SingleBar({
      format: 'Downloading |{bar}| {percentage}% | {value}/{total} | {current}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    downloadProgressBar.start(pendingVideos.length, 0, { current: '' });

    const results = [];
    let completed = 0;
    let failed = 0;

    // Process in batches with concurrency limit
    for (let i = 0; i < pendingVideos.length; i += concurrency) {
      const batch = pendingVideos.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async (video) => {
          downloadProgressBar.update(completed + failed, { current: video.commune_name });
          const result = await downloadAndOptimize(video);

          if (result.success) {
            completed++;
          } else {
            failed++;
          }

          downloadProgressBar.update(completed + failed, { current: video.commune_name });
          return result;
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failed++;
          results.push({ success: false, error: result.reason.message });
        }
      });
    }

    downloadProgressBar.stop();

    console.log('');
    console.log('='.repeat(70));
    console.log('BATCH DOWNLOAD COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Successfully downloaded: ${completed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('');

    // Show failed videos if any
    if (failed > 0) {
      console.log('Failed downloads:');
      results
        .filter((r) => !r.success)
        .forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.video?.commune_name || 'Unknown'}: ${r.error}`);
        });
      console.log('');
    }

    // Overall statistics
    const finalStats = await supabaseService.getDownloadStats();
    console.log('Overall Progress:');
    console.log(`  Total Videos: ${finalStats.total}`);
    console.log(
      `  Downloaded: ${finalStats.downloaded} (${((finalStats.downloaded / finalStats.total) * 100).toFixed(1)}%)`
    );
    console.log(`  Pending: ${finalStats.pending}`);
    console.log('');

    if (finalStats.totalSizeOriginal > 0) {
      const originalGB = (finalStats.totalSizeOriginal / 1024 / 1024 / 1024).toFixed(2);
      const compressedGB = (finalStats.totalSizeCompressed / 1024 / 1024 / 1024).toFixed(2);
      const savedPercent = ((1 - finalStats.totalSizeCompressed / finalStats.totalSizeOriginal) * 100).toFixed(1);

      console.log('Storage:');
      console.log(`  Original: ${originalGB} GB`);
      console.log(`  Compressed: ${compressedGB} GB`);
      console.log(`  Saved: ${savedPercent}%`);
      console.log('');
    }

    if (finalStats.pending > 0) {
      console.log('📥 More videos available. Run again to check and download next batch:');
      console.log(`   node src/download-with-status-check.js --check=${checkBatchSize} --download=${downloadBatchSize} --concurrent=${concurrency}`);
      console.log('');
    } else {
      console.log('🎉 All videos downloaded and optimized!');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    logger.error('Download with status check failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
