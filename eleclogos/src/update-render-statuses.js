import logger from './utils/logger.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';
import cliProgress from 'cli-progress';

/**
 * Update Render Statuses Script
 * Polls Creatomate API to check render status and updates database
 * (Bypasses webhook since localhost can't receive external notifications)
 */

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('     UPDATING RENDER STATUSES FROM CREATOMATE');
    console.log('='.repeat(70));
    console.log('');

    // Get all processing videos
    const { data: processingVideos } = await supabaseService.client
      .from('videos')
      .select('*')
      .eq('video_status', 'processing')
      .not('render_id', 'is', null);

    if (!processingVideos || processingVideos.length === 0) {
      console.log('✅ No videos currently processing. All renders complete!');
      console.log('');
      process.exit(0);
    }

    console.log(`Found ${processingVideos.length} videos to check`);
    console.log('');

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% | {value}/{total} | Current: {current}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(processingVideos.length, 0, { current: '' });

    let completed = 0;
    let failed = 0;
    let stillProcessing = 0;

    // Check renders sequentially (rate limit: 1 request per second to be safe)
    for (let i = 0; i < processingVideos.length; i++) {
      const video = processingVideos[i];

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

          completed++;
        } else if (render.status === 'failed') {
          // Mark as failed
          await supabaseService.client
            .from('videos')
            .update({
              video_status: 'failed',
            })
            .eq('id', video.id);

          failed++;
        } else {
          // Still processing
          stillProcessing++;
        }

        progressBar.update(completed + failed + stillProcessing, {
          current: video.commune_name,
        });
      } catch (error) {
        logger.error('Failed to check render status', {
          videoId: video.id,
          renderId: video.render_id,
          error: error.message,
        });
        stillProcessing++;
        progressBar.update(completed + failed + stillProcessing, {
          current: video.commune_name,
        });
      }

      // Rate limiting delay (1 second between requests)
      if (i < processingVideos.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    progressBar.stop();

    console.log('');
    console.log('='.repeat(70));
    console.log('STATUS UPDATE COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Completed: ${completed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏳ Still Processing: ${stillProcessing}`);
    console.log('');

    // Get updated stats
    const { data: allVideos } = await supabaseService.client
      .from('videos')
      .select('video_status, downloaded');

    const total = allVideos.length;
    const totalCompleted = allVideos.filter((v) => v.video_status === 'completed').length;
    const totalProcessing = allVideos.filter((v) => v.video_status === 'processing').length;
    const downloaded = allVideos.filter((v) => v.downloaded === true).length;
    const readyToDownload = allVideos.filter(
      (v) => v.video_status === 'completed' && v.downloaded === false
    ).length;

    const percentComplete = ((totalCompleted / total) * 100).toFixed(1);

    console.log('Overall Progress:');
    console.log(`  Total Videos: ${total}`);
    console.log(`  Renders Complete: ${totalCompleted} (${percentComplete}%)`);
    console.log(`  Still Processing: ${totalProcessing}`);
    console.log(`  Downloaded: ${downloaded}`);
    console.log(`  Ready to Download: ${readyToDownload}`);
    console.log('');

    if (readyToDownload > 0) {
      console.log('📥 Next Step:');
      console.log('   Download and optimize completed videos:');
      console.log('   npm run download:all -- --batch=50 --concurrent=3');
      console.log('');
    }

    if (totalProcessing > 0) {
      console.log('⏳ Some videos still rendering. Check again in a few minutes:');
      console.log('   node src/update-render-statuses.js');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(0);
  } catch (error) {
    logger.error('Status update failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
