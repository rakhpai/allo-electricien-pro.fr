import logger from './utils/logger.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';
import { downloadCommuneVideo } from './utils/video-downloader.js';
import { processVideo } from './utils/video-optimizer.js';

/**
 * Check Creatomate Render Status Script
 * Polls Creatomate API directly to check render status
 * Updates database and optionally triggers downloads
 */

/**
 * Check a single render status
 * @param {string} renderId - Creatomate render ID
 * @returns {Promise<Object>} - Render data
 */
async function checkRenderStatus(renderId) {
  try {
    const render = await creatomateService.getRenderStatus(renderId);

    logger.info('Render status checked', {
      renderId,
      status: render.status,
      url: render.url || 'not available',
    });

    return render;
  } catch (error) {
    logger.error('Failed to check render status', {
      renderId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Update database with completed render
 * @param {string} videoId - Video database ID
 * @param {Object} render - Creatomate render object
 * @returns {Promise<void>}
 */
async function updateVideoWithRender(videoId, render) {
  try {
    if (render.status === 'succeeded' && render.url) {
      await supabaseService.markCompleted(videoId, render.url, {
        duration: render.duration,
        credits_used: render.creditsUsed || null,
      });

      logger.info('Video marked as completed in database', {
        videoId,
        url: render.url,
      });

      return true;
    } else if (render.status === 'failed') {
      await supabaseService.markFailed(
        videoId,
        render.errorMessage || 'Render failed'
      );

      logger.error('Video marked as failed in database', {
        videoId,
        error: render.errorMessage,
      });

      return false;
    }

    logger.info('Video still processing', {
      videoId,
      status: render.status,
    });

    return null; // Still processing
  } catch (error) {
    logger.error('Failed to update video in database', {
      videoId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Download and optimize a completed video
 * @param {Object} video - Video database record
 * @returns {Promise<void>}
 */
async function downloadAndOptimize(video) {
  try {
    logger.info('Starting download and optimization', {
      videoId: video.id,
      commune: video.commune_name,
    });

    // Update processing status
    await supabaseService.updateProcessingStatus(video.id, 'downloading');

    // Prepare commune data
    const communeData = {
      name: video.commune_name,
      code: video.commune_code,
      department: video.commune_code.substring(0, 2),
      population: video.commune_population,
    };

    // Download video
    const downloadResult = await downloadCommuneVideo(
      video,
      communeData,
      'videos-downloaded'
    );

    logger.info('Video downloaded', {
      videoId: video.id,
      path: downloadResult.downloadedFile,
    });

    // Update processing status
    await supabaseService.updateProcessingStatus(video.id, 'optimizing');

    // Optimize video
    const optimizationResult = await processVideo(downloadResult.downloadedFile);

    logger.info('Video optimized', {
      videoId: video.id,
      formats: Object.keys(optimizationResult.sizes),
    });

    // Update database with all file information
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

    logger.info('Video processing completed', {
      videoId: video.id,
      commune: video.commune_name,
    });

    return optimizationResult;

  } catch (error) {
    logger.error('Download and optimization failed', {
      videoId: video.id,
      error: error.message,
    });

    await supabaseService.updateProcessingStatus(video.id, 'failed');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const autoDownload = args.includes('--download');
    const testCodes = ['78646', '93066', '95127'];

    console.log('\n' + '='.repeat(70));
    console.log('           CHECKING CREATOMATE RENDER STATUS');
    console.log('='.repeat(70));
    console.log('');

    const results = [];

    // Check each test video
    for (const code of testCodes) {
      const videos = await supabaseService.getVideosByCommune(code);

      if (videos.length === 0) {
        console.log(`⚠️  No video found for commune ${code}`);
        continue;
      }

      const video = videos[0];

      console.log(`Checking ${video.commune_name} (${code})...`);
      console.log(`  Render ID: ${video.render_id}`);

      // Check Creatomate status
      const render = await checkRenderStatus(video.render_id);

      console.log(`  Creatomate Status: ${render.status}`);

      if (render.status === 'succeeded') {
        console.log(`  ✅ Video URL: ${render.url}`);

        // Update database
        const updated = await updateVideoWithRender(video.id, render);

        if (updated) {
          console.log(`  ✅ Database updated`);

          results.push({
            video,
            render,
            ready: true,
          });
        }
      } else if (render.status === 'failed') {
        console.log(`  ❌ Render failed: ${render.errorMessage || 'Unknown error'}`);
        await updateVideoWithRender(video.id, render);
      } else {
        console.log(`  ⏳ Still processing (${render.status})...`);
        results.push({
          video,
          render,
          ready: false,
        });
      }

      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const completed = results.filter(r => r.ready).length;
    const processing = results.filter(r => !r.ready).length;

    console.log(`Completed: ${completed}/${testCodes.length}`);
    console.log(`Processing: ${processing}/${testCodes.length}`);
    console.log('');

    // Auto-download if requested and videos are ready
    if (autoDownload && completed > 0) {
      console.log('Starting automatic download and optimization...');
      console.log('');

      for (const result of results.filter(r => r.ready)) {
        console.log(`📥 Downloading ${result.video.commune_name}...`);

        try {
          // Refresh video data to get updated URL
          const updatedVideo = await supabaseService.getVideoById(result.video.id);
          await downloadAndOptimize(updatedVideo);
          console.log(`✅ ${result.video.commune_name} completed\n`);
        } catch (error) {
          console.error(`❌ ${result.video.commune_name} failed: ${error.message}\n`);
        }
      }
    } else if (completed > 0) {
      console.log('✅ Videos are ready! Run with --download flag to download:');
      console.log('   node src/check-renders.js --download');
      console.log('');
    } else {
      console.log('⏳ Videos still processing. Wait 1-2 minutes and run again:');
      console.log('   node src/check-renders.js');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(0);

  } catch (error) {
    logger.error('Check renders failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
main();
