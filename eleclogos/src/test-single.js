import videoGenerator from './index.js';
import logger from './utils/logger.js';

/**
 * Test script to generate a single video
 * Usage: npm run test
 */
async function testSingleVideo() {
  try {
    logger.info('Starting single video generation test');

    // Example commune data
    const testCommune = {
      name: 'Paris',
      code: '75056',
      department: '75',
      region: 'Île-de-France',
      population: 2165423,
      phoneNumber: '01 23 45 67 89',
    };

    console.log('\n' + '='.repeat(60));
    console.log('TESTING VIDEO GENERATION');
    console.log('='.repeat(60));
    console.log(`Commune: ${testCommune.name}`);
    console.log(`Code: ${testCommune.code}`);
    console.log(`Population: ${testCommune.population.toLocaleString()}`);
    console.log('='.repeat(60) + '\n');

    // Generate video
    const result = await videoGenerator.generateVideo(testCommune);

    console.log('\n' + '='.repeat(60));
    console.log('GENERATION RESULT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(60) + '\n');

    if (result.success) {
      logger.info('Video generation test successful');

      // Wait a bit and check status
      console.log('Waiting 5 seconds before checking status...\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const status = await videoGenerator.getVideoStatus(testCommune.code);

      console.log('='.repeat(60));
      console.log('VIDEO STATUS');
      console.log('='.repeat(60));
      console.log(JSON.stringify(status, null, 2));
      console.log('='.repeat(60) + '\n');

      console.log('✓ Test completed successfully!');
      console.log('Check the webhook server for completion notifications.');
    } else {
      logger.error('Video generation test failed');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Test failed', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testSingleVideo();
