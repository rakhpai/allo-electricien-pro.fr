import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import { fetchAllCommunes, saveCommunesToJSON, getCommunes } from './utils/fetch-communes.js';
import BatchProcessor from './batch-processor.js';
import supabaseService from './services/supabase.js';
import cliProgress from 'cli-progress';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Master Orchestration Script
 * Generates all 500+ IDF commune videos with automatic download and optimization
 *
 * Process:
 * 1. Fetch 518 communes (500 IDF + 20 Paris) from Supabase geo_cities_idf
 * 2. Exclude existing videos (Boulogne 92012, Issy 92040)
 * 3. Generate videos using batch processor
 * 4. Webhook automatically downloads and optimizes each completed video
 * 5. Monitor progress and generate final report
 */

class MasterOrchestrator {
  constructor() {
    this.communes = [];
    this.stats = {
      startTime: null,
      endTime: null,
      totalCommunes: 0,
      videosGenerated: 0,
      videosDownloaded: 0,
      videosFailed: 0,
      totalDuration: 0,
    };
  }

  /**
   * Step 1: Fetch all communes from Supabase
   * @param {boolean} forceRefresh - Force fresh data from Supabase
   * @returns {Promise<Array>} - Array of communes
   */
  async fetchCommunes(forceRefresh = false) {
    try {
      logger.info('Fetching communes from Supabase', { forceRefresh });

      // Use the getCommunes utility (handles caching)
      this.communes = await getCommunes(forceRefresh);

      logger.info('Communes fetched successfully', {
        total: this.communes.length,
        sample: this.communes.slice(0, 5).map(c => `${c.name} (${c.code})`),
      });

      this.stats.totalCommunes = this.communes.length;

      return this.communes;

    } catch (error) {
      logger.error('Failed to fetch communes', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Step 2: Generate all videos using batch processor
   * @returns {Promise<Object>} - Batch processing results
   */
  async generateVideos() {
    try {
      logger.info('Starting video generation', {
        communes: this.communes.length,
      });

      const processor = new BatchProcessor();
      const results = await processor.processBatch(this.communes);

      this.stats.videosGenerated = results.successful;
      this.stats.videosFailed = results.failed;

      logger.info('Video generation completed', {
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped,
      });

      // Save batch results
      const resultsPath = path.resolve(
        __dirname,
        `../assets/logs/master-batch-${Date.now()}.json`
      );
      await processor.saveResults(resultsPath);

      return results;

    } catch (error) {
      logger.error('Video generation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Step 3: Monitor download progress
   * @param {number} pollInterval - Polling interval in milliseconds
   * @param {number} maxWaitTime - Maximum wait time in milliseconds
   * @returns {Promise<Object>} - Download statistics
   */
  async monitorDownloads(pollInterval = 30000, maxWaitTime = 7200000) {
    try {
      logger.info('Monitoring download progress', {
        pollInterval: pollInterval / 1000 + 's',
        maxWaitTime: maxWaitTime / 1000 + 's',
      });

      const startTime = Date.now();
      let lastStats = null;

      // Create progress bar
      const progressBar = new cliProgress.SingleBar({
        format: 'Download Progress |{bar}| {percentage}% | {value}/{total} videos | ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      });

      let barStarted = false;

      while (true) {
        const elapsed = Date.now() - startTime;

        if (elapsed > maxWaitTime) {
          logger.warn('Maximum wait time reached, stopping monitoring');
          break;
        }

        // Get current download stats
        const stats = await supabaseService.getDownloadStats();

        // Start progress bar on first iteration
        if (!barStarted && stats.total > 0) {
          progressBar.start(stats.total, stats.downloaded);
          barStarted = true;
        }

        // Update progress bar
        if (barStarted) {
          progressBar.update(stats.downloaded);
        }

        // Log progress
        logger.info('Download progress', {
          total: stats.total,
          downloaded: stats.downloaded,
          pending: stats.pending,
          progress: ((stats.downloaded / stats.total) * 100).toFixed(2) + '%',
          elapsedTime: (elapsed / 1000).toFixed(0) + 's',
        });

        // Check if all downloads are complete
        if (stats.pending === 0 && stats.total > 0) {
          logger.info('All downloads completed');
          if (barStarted) {
            progressBar.stop();
          }
          return stats;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        lastStats = stats;
      }

      if (barStarted) {
        progressBar.stop();
      }

      return lastStats;

    } catch (error) {
      logger.error('Failed to monitor downloads', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Step 4: Generate final report
   * @returns {Promise<Object>} - Final statistics
   */
  async generateReport() {
    try {
      logger.info('Generating final report');

      // Get comprehensive statistics
      const downloadStats = await supabaseService.getDownloadStats();
      const videoStats = await supabaseService.getStatusCounts();
      const dbStats = await supabaseService.getStatistics();

      this.stats.videosDownloaded = downloadStats.downloaded;
      this.stats.endTime = new Date();
      this.stats.totalDuration = (this.stats.endTime - this.stats.startTime) / 1000;

      const report = {
        timestamp: this.stats.endTime.toISOString(),
        duration: {
          total: this.stats.totalDuration + 's',
          formatted: this.formatDuration(this.stats.totalDuration),
        },
        communes: {
          total: this.stats.totalCommunes,
          processed: this.communes.length,
        },
        videos: {
          generated: this.stats.videosGenerated,
          failed: this.stats.videosFailed,
          downloaded: downloadStats.downloaded,
          pending: downloadStats.pending,
        },
        storage: {
          originalSize: this.formatBytes(downloadStats.totalSizeOriginal),
          compressedSize: this.formatBytes(downloadStats.totalSizeCompressed),
          saved: this.formatBytes(downloadStats.totalSizeOriginal - downloadStats.totalSizeCompressed),
          compressionRatio: downloadStats.totalSizeOriginal > 0
            ? ((1 - downloadStats.totalSizeCompressed / downloadStats.totalSizeOriginal) * 100).toFixed(2) + '%'
            : '0%',
        },
        videosByStatus: videoStats,
        database: dbStats,
      };

      // Save report to file
      const reportPath = path.resolve(
        __dirname,
        `../assets/logs/final-report-${Date.now()}.json`
      );
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      logger.info('Final report saved', { path: reportPath });

      // Print summary to console
      this.printSummary(report);

      return report;

    } catch (error) {
      logger.error('Failed to generate report', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Format bytes to human-readable size
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration to human-readable time
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Print summary to console
   * @param {Object} report - Final report
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(70));
    console.log('                    FINAL REPORT - ALL VIDEOS                    ');
    console.log('='.repeat(70));
    console.log('');
    console.log('COMMUNES:');
    console.log(`  Total:                ${report.communes.total}`);
    console.log(`  Processed:            ${report.communes.processed}`);
    console.log('');
    console.log('VIDEOS:');
    console.log(`  Generated:            ${report.videos.generated}`);
    console.log(`  Failed:               ${report.videos.failed}`);
    console.log(`  Downloaded:           ${report.videos.downloaded}`);
    console.log(`  Pending Download:     ${report.videos.pending}`);
    console.log('');
    console.log('STORAGE:');
    console.log(`  Original Size:        ${report.storage.originalSize}`);
    console.log(`  Compressed Size:      ${report.storage.compressedSize}`);
    console.log(`  Space Saved:          ${report.storage.saved}`);
    console.log(`  Compression Ratio:    ${report.storage.compressionRatio}`);
    console.log('');
    console.log('DURATION:');
    console.log(`  Total Time:           ${report.duration.formatted}`);
    console.log('');
    console.log('='.repeat(70));
    console.log('');
  }

  /**
   * Run the complete orchestration
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} - Final report
   */
  async run(options = {}) {
    try {
      this.stats.startTime = new Date();

      const {
        forceRefresh = false,
        skipDownloadMonitoring = false,
        monitorPollInterval = 30000,
        monitorMaxWaitTime = 7200000,
      } = options;

      logger.info('Master orchestration started', {
        forceRefresh,
        skipDownloadMonitoring,
      });

      // Step 1: Fetch communes
      console.log('\n📋 Fetching communes from Supabase...');
      await this.fetchCommunes(forceRefresh);
      console.log(`✓ Fetched ${this.communes.length} communes\n`);

      // Step 2: Generate videos
      console.log('🎬 Generating videos for all communes...');
      console.log('This will take a while. Videos will be generated and webhooks will trigger downloads.\n');
      const batchResults = await this.generateVideos();
      console.log(`✓ Video generation completed: ${batchResults.successful} successful, ${batchResults.failed} failed\n`);

      // Step 3: Monitor downloads (optional)
      if (!skipDownloadMonitoring) {
        console.log('📥 Monitoring download and optimization progress...');
        console.log('Videos will be automatically downloaded and optimized via webhooks.\n');
        await this.monitorDownloads(monitorPollInterval, monitorMaxWaitTime);
        console.log('\n✓ Download monitoring completed\n');
      } else {
        console.log('⏭️  Skipping download monitoring\n');
      }

      // Step 4: Generate final report
      console.log('📊 Generating final report...');
      const report = await this.generateReport();

      logger.info('Master orchestration completed successfully');

      return report;

    } catch (error) {
      logger.error('Master orchestration failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const orchestrator = new MasterOrchestrator();

    const options = {
      forceRefresh: process.argv.includes('--force-refresh'),
      skipDownloadMonitoring: process.argv.includes('--skip-monitoring'),
      monitorPollInterval: 30000, // 30 seconds
      monitorMaxWaitTime: 7200000, // 2 hours
    };

    const report = await orchestrator.run(options);

    // Exit with success
    process.exit(0);

  } catch (error) {
    logger.error('Master orchestration error', {
      error: error.message,
      stack: error.stack,
    });

    console.error('\n❌ Orchestration failed:', error.message);

    // Exit with error
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MasterOrchestrator;
