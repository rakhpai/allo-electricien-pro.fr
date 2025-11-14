import logger from './utils/logger.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';

/**
 * Sync Render Statuses from Creatomate (Bulk Method)
 * Fetches all renders from Creatomate and updates database in bulk
 * Much faster than checking each render individually
 */

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('     SYNCING RENDER STATUSES FROM CREATOMATE');
    console.log('='.repeat(70));
    console.log('');

    // Get all processing videos from database
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

    console.log(`Found ${processingVideos.length} videos in database with "processing" status`);
    console.log('Fetching all renders from Creatomate...');
    console.log('');

    // Fetch all renders from Creatomate (paginated)
    let allRenders = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const renders = await creatomateService.getRenders({ limit, offset });
      allRenders = allRenders.concat(renders);

      console.log(`  Fetched ${renders.length} renders (offset: ${offset})`);

      if (renders.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log('');
    console.log(`✅ Fetched ${allRenders.length} total renders from Creatomate`);
    console.log('');

    // Create a map of render_id => render for fast lookup
    const renderMap = new Map();
    allRenders.forEach(render => {
      renderMap.set(render.id, render);
    });

    console.log('Matching and updating database records...');
    console.log('');

    let completed = 0;
    let failed = 0;
    let stillProcessing = 0;
    let notFound = 0;

    // Match database records with Creatomate renders and update
    for (const video of processingVideos) {
      const render = renderMap.get(video.render_id);

      if (!render) {
        console.log(`⚠️  ${video.commune_name}: Render not found in Creatomate`);
        notFound++;
        continue;
      }

      try {
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
          console.log(`✅ ${video.commune_name}: Completed`);
        } else if (render.status === 'failed') {
          // Mark as failed
          await supabaseService.client
            .from('videos')
            .update({
              video_status: 'failed',
            })
            .eq('id', video.id);

          failed++;
          console.log(`❌ ${video.commune_name}: Failed`);
        } else {
          // Still processing
          stillProcessing++;
          console.log(`⏳ ${video.commune_name}: Still ${render.status}`);
        }
      } catch (error) {
        logger.error('Failed to update video status', {
          videoId: video.id,
          error: error.message,
        });
      }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Completed: ${completed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏳ Still Processing: ${stillProcessing}`);
    console.log(`⚠️  Not Found: ${notFound}`);
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
      console.log('   npm run sync:statuses');
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(0);
  } catch (error) {
    logger.error('Sync failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
