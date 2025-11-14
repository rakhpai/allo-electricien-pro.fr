import logger from './utils/logger.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';
import { downloadCommuneVideo } from './utils/video-downloader.js';
import { processVideo } from './utils/video-optimizer.js';
import cliProgress from 'cli-progress';

/**
 * Check All Renders and Download Script
 * Checks all pending videos and downloads completed ones
 */

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
    const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1]) || 50;
    const concurrency = parseInt(args.find(a => a.startsWith('--concurrent='))?.split('=')[1]) || 3;

    console.log('\n' + '='.repeat(70));
    console.log('     CHECKING AND DOWNLOADING ALL COMPLETED RENDERS');
    console.log('='.repeat(70));
    console.log('');
    console.log(`Configuration:`);
    console.log(`  Batch size: ${batchSize} videos`);
    console.log(`  Concurrent downloads: ${concurrency}`);
    console.log('');

    // Get all completed videos that haven't been downloaded
    const { data: pendingVideos } = await supabaseService.client
      .from('videos')
      .select('*')
      .eq('video_status', 'completed')
      .eq('downloaded', false)
      .not('video_url', 'is', null)
      .order('render_completed_at', { ascending: true })
      .limit(batchSize);

    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('✅ No pending downloads. All videos are up to date!');
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

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% | {value}/{total} | Current: {current}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(pendingVideos.length, 0, { current: '' });

    const results = [];
    let completed = 0;
    let failed = 0;

    // Process in batches with concurrency limit
    for (let i = 0; i < pendingVideos.length; i += concurrency) {
      const batch = pendingVideos.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async video => {
          progressBar.update(completed + failed, { current: video.commune_name });
          const result = await downloadAndOptimize(video);

          if (result.success) {
            completed++;
          } else {
            failed++;
          }

          progressBar.update(completed + failed, { current: video.commune_name });
          return result;
        })
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failed++;
          results.push({ success: false, error: result.reason.message });
        }
      });
    }

    progressBar.stop();

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
      results.filter(r => !r.success).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.video?.commune_name || 'Unknown'}: ${r.error}`);
      });
      console.log('');
    }

    // Overall statistics
    const finalStats = await supabaseService.getDownloadStats();
    console.log('Overall Progress:');
    console.log(`  Total Videos: ${finalStats.total}`);
    console.log(`  Downloaded: ${finalStats.downloaded} (${((finalStats.downloaded/finalStats.total)*100).toFixed(1)}%)`);
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
      console.log('📥 More videos available. Run again to download next batch:');
      console.log(`   node src/check-renders-all.js --batch=${batchSize} --concurrent=${concurrency}`);
      console.log('');
    } else {
      console.log('🎉 All videos downloaded and optimized!');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    logger.error('Check renders all failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
