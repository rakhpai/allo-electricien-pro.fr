import logger from './utils/logger.js';
import { getCommunes } from './utils/fetch-communes.js';
import BatchProcessor from './batch-processor.js';

/**
 * Generate All 518 Commune Videos
 * Simple script to generate all IDF videos
 */

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('        GENERATING ALL 518 IDF COMMUNE VIDEOS');
    console.log('='.repeat(70));
    console.log('');

    // Fetch all communes (500 IDF + 20 Paris, excluding Boulogne & Issy)
    console.log('📋 Fetching communes from Supabase...');
    const communes = await getCommunes(false); // Use cached if available

    console.log(`✅ Fetched ${communes.length} communes`);
    console.log('');
    console.log('Breakdown:');
    console.log(`  - IDF Communes: ~500`);
    console.log(`  - Paris Arrondissements: 20 (Paris 1er - 20e)`);
    console.log(`  - Excluded: 2 (Boulogne-Billancourt, Issy-les-Moulineaux)`);
    console.log('');
    console.log('='.repeat(70));
    console.log('');

    console.log('🎬 Starting batch video generation...');
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('   - This will take 2-3 hours to complete');
    console.log('   - Videos will be submitted to Creatomate for rendering');
    console.log('   - After generation, use check-renders.js to download');
    console.log('');
    console.log('Press Ctrl+C to cancel, or wait 10 seconds to start...');
    console.log('');

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Start batch processing
    const processor = new BatchProcessor();
    const results = await processor.processBatch(communes);

    console.log('');
    console.log('='.repeat(70));
    console.log('           GENERATION COMPLETE');
    console.log('='.repeat(70));
    console.log('');
    console.log(`Total Communes: ${results.total}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log('');

    if (results.failed > 0) {
      console.log('Failed videos:');
      results.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.commune}: ${err.error}`);
      });
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');
    console.log('📥 Next Steps:');
    console.log('');
    console.log('1. Wait 30-60 minutes for Creatomate to render all videos');
    console.log('');
    console.log('2. Check render status and download completed videos:');
    console.log('   node src/check-renders-all.js');
    console.log('');
    console.log('3. Monitor progress in Creatomate dashboard:');
    console.log('   https://creatomate.com/renders');
    console.log('');
    console.log('='.repeat(70));
    console.log('');

    // Save results
    const resultsPath = `assets/logs/generation-all-518-${Date.now()}.json`;
    await processor.saveResults(resultsPath);
    console.log(`📄 Results saved to: ${resultsPath}`);
    console.log('');

    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    logger.error('Generation failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Generation failed:', error.message);
    process.exit(1);
  }
}

main();
