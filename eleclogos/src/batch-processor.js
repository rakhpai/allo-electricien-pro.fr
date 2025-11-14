import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import { queue, retryTask } from './utils/queue.js';
import elevenLabsService from './services/elevenlabs.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';
import { generateScript, determineCommuneSize } from './templates/scripts.js';
import { generateDualScripts } from './templates/audio-scripts.js';
import { uploadAudioToCreatomate } from './utils/upload-audio.js';
import { getTrustSignals, getRecommendedIntroVariant } from './utils/trust-signals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Batch Video Processor
 * Generates videos for all communes in the data file
 */
class BatchProcessor {
  constructor() {
    this.communes = [];
    this.results = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
  }

  /**
   * Load commune data from JSON file
   * @param {string} filepath - Path to communes data file
   * @returns {Promise<Array>} - Array of commune objects
   */
  async loadCommunesData(filepath) {
    try {
      logger.info('Loading communes data', { filepath });

      const data = await fs.readFile(filepath, 'utf-8');
      this.communes = JSON.parse(data);

      logger.info('Communes data loaded', { count: this.communes.length });
      return this.communes;
    } catch (error) {
      logger.error('Failed to load communes data', { error: error.message });
      throw error;
    }
  }

  /**
   * Process a single commune
   * @param {Object} commune - Commune data
   * @returns {Promise<Object>} - Processing result
   */
  async processCommune(commune) {
    try {
      logger.info('Processing commune', {
        name: commune.name,
        code: commune.code,
      });

      // Check if video already exists
      const exists = await supabaseService.communeExists(commune.code);
      if (exists) {
        logger.info('Commune video already exists, skipping', {
          commune: commune.name,
        });
        this.results.skipped++;
        return { success: true, skipped: true };
      }

      // Get trust signals and recommended variants for this commune
      const trustSignals = getTrustSignals({
        name: commune.name,
        population: commune.population,
        department: commune.department,
        region: commune.region || 'Île-de-France'
      });

      const recommendedIntroVariant = getRecommendedIntroVariant({
        name: commune.name,
        population: commune.population,
        department: commune.department,
        region: commune.region || 'Île-de-France'
      });

      logger.info('Trust signals generated', {
        commune: commune.name,
        reviewCount: trustSignals.reviewCount,
        rating: trustSignals.rating,
        certifications: trustSignals.certifications,
        recommendedVariant: recommendedIntroVariant
      });

      // Generate dual scripts (intro + full voice-over)
      const dualScripts = generateDualScripts({
        name: commune.name,
        department: commune.department,
        population: commune.population,
        region: commune.region || 'Île-de-France',
      }, { introVariant: recommendedIntroVariant });

      logger.info('Dual scripts generated', {
        commune: commune.name,
        size: dualScripts.combined.communeSize,
        introLength: dualScripts.intro.script.length,
        fullLength: dualScripts.full.script.length,
        totalDuration: `${dualScripts.combined.totalDuration}s`,
        introVariant: recommendedIntroVariant
      });

      // Generate dual audio files
      const audioFilename = commune.code;
      const audioResult = await elevenLabsService.generateDualAudio(
        dualScripts.intro.script,
        dualScripts.full.script,
        audioFilename
      );

      logger.info('Dual audio generated', {
        commune: commune.name,
        introFilepath: audioResult.intro.filepath,
        fullFilepath: audioResult.full.filepath,
      });

      // Upload dual audio to Supabase Storage
      logger.info('Uploading dual audio to Supabase Storage...', { commune: commune.name });
      const audioUrls = await supabaseService.uploadDualAudio(
        audioResult.intro.filepath,
        audioResult.full.filepath,
        commune.code
      );

      logger.info('Dual audio uploaded successfully', {
        commune: commune.name,
        introUrl: audioUrls.introUrl,
        fullUrl: audioUrls.fullUrl,
      });

      // Determine CRO variants (can be customized per commune or A/B tested)
      const ctaVariant = commune.population > 50000 ? 'urgent' : 'standard';
      const descriptionVariant = recommendedIntroVariant === 'urgency' ? 'urgent' : 'standard';

      // Create video record in database with ALL CRO fields populated
      const videoRecord = await supabaseService.createVideo({
        // Commune data
        commune_name: commune.name,
        commune_code: commune.code,
        commune_department: commune.department,
        commune_region: commune.region || 'Île-de-France',
        commune_population: commune.population,
        commune_size: dualScripts.combined.communeSize,

        // Audio files
        voiceover_script: dualScripts.full.script, // Full script for reference
        voiceover_audio_url: audioUrls.fullUrl, // Legacy field - use full audio
        intro_audio_url: audioUrls.introUrl, // New dual audio field
        full_audio_url: audioUrls.fullUrl, // New dual audio field
        voice_id: audioResult.voiceId,
        voice_model: audioResult.model,

        // Video metadata
        video_status: 'pending',
        template_id: config.creatomate.templateId,

        // CRO Fields - Phone tracking
        phone_number: commune.phoneNumber || '06 44 64 71 75',

        // CRO Fields - A/B test variants
        intro_variant: recommendedIntroVariant,
        cta_variant: ctaVariant,
        trust_badge_variant: 'all',
        description_variant: descriptionVariant,

        // CRO Fields - Trust signals
        years_of_service: trustSignals.yearsOfService,
        average_rating: trustSignals.rating,
        review_count: trustSignals.reviewCount,
        certifications: trustSignals.certifications,

        // CRO Fields - Personalization metadata
        urgency_level: trustSignals.urgencyLevel || (commune.population > 50000 ? 'high' : commune.population > 10000 ? 'medium' : 'low'),
        local_context: commune.population < 10000 ? 'Votre électricien de quartier' : 'Service électrique professionnel'
      });

      logger.info('Video record created', {
        videoId: videoRecord.id,
        commune: commune.name,
      });

      // Create video render with Creatomate (dual audio + CRO personalization)
      logger.info('Creating video render with dual audio and CRO personalization...', { commune: commune.name });
      const renderResult = await creatomateService.createCommuneVideoDualAudio(
        {
          name: commune.name,
          code: commune.code,
          department: commune.department,
          population: commune.population,
          phoneNumber: commune.phoneNumber || '06 44 64 71 75',
        },
        audioUrls.introUrl,
        audioUrls.fullUrl,
        {
          // CRO options for personalized copy
          phone: commune.phoneNumber || '06 44 64 71 75',
          descriptionVariant: descriptionVariant,
          ctaVariant: ctaVariant,
          trustBadgeVariant: 'all',
          includePhoneInCTA: ctaVariant === 'urgent'
        }
      );

      logger.info('Video render submitted to Creatomate', {
        renderId: renderResult.id,
        status: renderResult.status,
        commune: commune.name,
      });

      // Update video record with render ID
      await supabaseService.updateVideo(videoRecord.id, {
        render_id: renderResult.id,
        video_status: 'processing',
        render_started_at: new Date().toISOString(),
      });

      this.results.successful++;

      return {
        success: true,
        commune: commune.name,
        videoId: videoRecord.id,
        renderId: renderResult.id,
      };
    } catch (error) {
      logger.error('Failed to process commune', {
        commune: commune.name,
        error: error.message,
      });

      this.results.failed++;
      this.results.errors.push({
        commune: commune.name,
        error: error.message,
      });

      return {
        success: false,
        commune: commune.name,
        error: error.message,
      };
    }
  }

  /**
   * Process all communes in batch
   * @param {Array} communes - Optional array of communes (uses loaded data if not provided)
   */
  async processBatch(communes = null) {
    try {
      const communesToProcess = communes || this.communes;

      if (communesToProcess.length === 0) {
        throw new Error('No communes to process. Load data first.');
      }

      this.results.total = communesToProcess.length;

      logger.info('Starting batch processing', {
        total: this.results.total,
        rateLimit: `${config.rateLimit.requests} per ${config.rateLimit.windowMs}ms`,
      });

      // Add all communes to the queue
      const promises = communesToProcess.map((commune) =>
        queue.add(
          () => retryTask(() => this.processCommune(commune)),
          { commune: commune.name }
        )
      );

      // Wait for all to complete
      await Promise.allSettled(promises);

      logger.info('Batch processing completed', this.results);

      return this.results;
    } catch (error) {
      logger.error('Batch processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Save processing results to file
   * @param {string} filepath - Output file path
   */
  async saveResults(filepath) {
    try {
      const output = {
        timestamp: new Date().toISOString(),
        ...this.results,
      };

      await fs.writeFile(filepath, JSON.stringify(output, null, 2));

      logger.info('Results saved', { filepath });
    } catch (error) {
      logger.error('Failed to save results', { error: error.message });
    }
  }

  /**
   * Get processing summary
   * @returns {Object} - Summary statistics
   */
  getSummary() {
    return {
      ...this.results,
      successRate:
        this.results.total > 0
          ? ((this.results.successful / this.results.total) * 100).toFixed(2) + '%'
          : '0%',
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    logger.info('Batch processor started');

    // Validate configuration
    validateConfig();

    // Create processor instance
    const processor = new BatchProcessor();

    // Load communes data
    // Update the path to your actual data file
    const dataPath = path.resolve(__dirname, '../data/communes.json');

    try {
      await processor.loadCommunesData(dataPath);
    } catch (error) {
      logger.error('Data file not found. Creating example file...');

      // Create example data structure
      const exampleData = [
        {
          name: 'Paris',
          code: '75056',
          department: '75',
          region: 'Île-de-France',
          population: 2165423,
          phoneNumber: '06 44 64 71 75',
        },
        {
          name: 'Boulogne-Billancourt',
          code: '92012',
          department: '92',
          region: 'Île-de-France',
          population: 121583,
          phoneNumber: '06 44 64 71 75',
        },
        // Add more communes here...
      ];

      const examplePath = path.resolve(__dirname, '../data/communes-example.json');
      await fs.mkdir(path.dirname(examplePath), { recursive: true });
      await fs.writeFile(examplePath, JSON.stringify(exampleData, null, 2));

      logger.info('Example data file created', { path: examplePath });
      logger.info('Please update with your actual 500 communes data and rename to communes.json');

      process.exit(0);
    }

    // Process all communes
    const results = await processor.processBatch();

    // Save results
    const resultsPath = path.resolve(
      __dirname,
      `../assets/logs/batch-results-${Date.now()}.json`
    );
    await processor.saveResults(resultsPath);

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('BATCH PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(JSON.stringify(processor.getSummary(), null, 2));
    console.log('='.repeat(50) + '\n');

    logger.info('Batch processor completed');

    // Exit
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    logger.error('Batch processor error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default BatchProcessor;
