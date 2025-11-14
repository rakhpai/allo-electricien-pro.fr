import config, { validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import elevenLabsService from './services/elevenlabs.js';
import creatomateService from './services/creatomate.js';
import supabaseService from './services/supabase.js';
import { generateScript } from './templates/scripts.js';
import { generateDualScripts } from './templates/audio-scripts.js';
import { uploadAudioToCreatomate } from './utils/upload-audio.js';
import { getTrustSignals, getRecommendedIntroVariant } from './utils/trust-signals.js';

/**
 * On-Demand Video Generation API
 * Generate a single video for a specific commune
 */
class VideoGenerator {
  constructor() {
    validateConfig();
  }

  /**
   * Generate a video for a single commune
   * @param {Object} communeData - Commune information
   * @returns {Promise<Object>} - Generation result
   */
  async generateVideo(communeData) {
    try {
      const { name, code, department, region, population, phoneNumber } = communeData;

      // Validate required fields
      if (!name || !code) {
        throw new Error('Missing required fields: name and code');
      }

      logger.info('Starting video generation', { commune: name, code });

      // Check if video already exists
      const existingVideo = await supabaseService.getVideoByCommune(code);
      if (existingVideo) {
        logger.warn('Video already exists for commune', {
          commune: name,
          videoId: existingVideo.id,
          status: existingVideo.video_status,
        });

        return {
          success: true,
          message: 'Video already exists',
          video: existingVideo,
        };
      }

      // Get trust signals for this commune
      const trustSignals = getTrustSignals({ name, population, department, region });

      // Get intro category recommendation (but will randomly select variant within category)
      const recommendedIntroCategory = getRecommendedIntroVariant({ name, population, department, region });

      logger.info('Trust signals and intro category generated', {
        commune: name,
        reviewCount: trustSignals.reviewCount,
        rating: trustSignals.rating,
        certifications: trustSignals.certifications,
        introCategory: recommendedIntroCategory
      });

      // Generate dual scripts with random variant selection
      // Intro: random variant within recommended category
      // Full: random variant within size category
      const dualScripts = generateDualScripts({
        name,
        department,
        population,
        region: region || 'Île-de-France',
      }, { introVariant: recommendedIntroCategory });

      logger.info('Dual scripts generated with random variants', {
        commune: name,
        size: dualScripts.combined.communeSize,
        introCategory: dualScripts.intro.category,
        introVariantIndex: dualScripts.intro.variantIndex,
        fullScriptSize: dualScripts.full.size,
        fullVariantIndex: dualScripts.full.variantIndex,
        introLength: dualScripts.intro.script.length,
        fullLength: dualScripts.full.script.length,
        totalDuration: `${dualScripts.combined.totalDuration}s`,
      });

      // Generate dual audio files with random voice selection
      logger.info('Generating dual audio files with random voice...', { commune: name });
      const audioFilename = code;
      const audioResult = await elevenLabsService.generateDualAudio(
        dualScripts.intro.script,
        dualScripts.full.script,
        audioFilename
      );

      logger.info('Dual audio generated with random voice', {
        commune: name,
        voiceId: audioResult.voiceId,
        introFilepath: audioResult.intro.filepath,
        fullFilepath: audioResult.full.filepath,
      });

      // Upload dual audio to Supabase Storage
      logger.info('Uploading dual audio to Supabase Storage...', { commune: name });
      const audioUrls = await supabaseService.uploadDualAudio(
        audioResult.intro.filepath,
        audioResult.full.filepath,
        code
      );

      logger.info('Dual audio uploaded and accessible', {
        commune: name,
        introUrl: audioUrls.introUrl,
        fullUrl: audioUrls.fullUrl,
      });

      // Determine CRO variants (can be customized per commune or A/B tested)
      const ctaVariant = population > 50000 ? 'urgent' : 'standard';
      const descriptionVariant = recommendedIntroCategory === 'urgency' ? 'urgent' : 'standard';

      // Create video record in database with ALL CRO fields populated
      const videoRecord = await supabaseService.createVideo({
        // Commune data
        commune_name: name,
        commune_code: code,
        commune_department: department,
        commune_region: region || 'Île-de-France',
        commune_population: population,
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
        phone_number: phoneNumber || '06 44 64 71 75',

        // CRO Fields - A/B test variants (tracking random selections)
        intro_variant: `${dualScripts.intro.category}-${dualScripts.intro.variantIndex}`, // e.g., "professional-2"
        cta_variant: ctaVariant,
        trust_badge_variant: 'all',
        description_variant: descriptionVariant,

        // CRO Fields - Trust signals
        years_of_service: trustSignals.yearsOfService,
        average_rating: trustSignals.rating,
        review_count: trustSignals.reviewCount,
        certifications: trustSignals.certifications,

        // CRO Fields - Personalization metadata
        urgency_level: trustSignals.urgencyLevel || (population > 50000 ? 'high' : population > 10000 ? 'medium' : 'low'),
        local_context: population < 10000 ? 'Votre électricien de quartier' : 'Service électrique professionnel'
      });

      logger.info('Video record created in database', {
        videoId: videoRecord.id,
        commune: name,
      });

      // Create video render with Creatomate (dual audio + CRO personalization)
      logger.info('Creating video render with dual audio and CRO personalization...', { commune: name });
      const renderResult = await creatomateService.createCommuneVideoDualAudio(
        {
          name,
          code,
          department,
          population,
          phoneNumber: phoneNumber || '06 44 64 71 75',
        },
        audioUrls.introUrl,
        audioUrls.fullUrl,
        {
          // CRO options for personalized copy
          phone: phoneNumber || '06 44 64 71 75',
          descriptionVariant: descriptionVariant,
          ctaVariant: ctaVariant,
          trustBadgeVariant: 'all',
          includePhoneInCTA: ctaVariant === 'urgent'
        }
      );

      logger.info('Video render submitted to Creatomate', {
        renderId: renderResult.id,
        status: renderResult.status,
        commune: name,
      });

      // Update video record with render ID
      await supabaseService.updateVideo(videoRecord.id, {
        render_id: renderResult.id,
        video_status: 'processing',
        render_started_at: new Date().toISOString(),
      });

      logger.info('Video generation completed successfully', {
        videoId: videoRecord.id,
        renderId: renderResult.id,
        commune: name,
      });

      return {
        success: true,
        video: {
          id: videoRecord.id,
          renderId: renderResult.id,
          commune: name,
          status: 'processing',
          message: 'Video is being rendered. Check webhook for completion.',
        },
      };
    } catch (error) {
      logger.error('Video generation failed', {
        commune: communeData.name,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Get video status
   * @param {string} communeCode - Commune code
   * @returns {Promise<Object>} - Video status
   */
  async getVideoStatus(communeCode) {
    try {
      const video = await supabaseService.getVideoByCommune(communeCode);

      if (!video) {
        return {
          found: false,
          message: 'No video found for this commune',
        };
      }

      // If video has a render ID but status is not completed, check Creatomate
      if (video.render_id && video.video_status !== 'completed') {
        try {
          const renderStatus = await creatomateService.getRenderStatus(video.render_id);

          // Update if status has changed
          if (renderStatus.status === 'succeeded' && video.video_status !== 'completed') {
            await supabaseService.markCompleted(video.id, renderStatus.url, {
              duration: renderStatus.duration,
            });
            video.video_status = 'completed';
            video.video_url = renderStatus.url;
          } else if (renderStatus.status === 'failed' && video.video_status !== 'failed') {
            await supabaseService.markFailed(video.id, renderStatus.error_message);
            video.video_status = 'failed';
            video.error_message = renderStatus.error_message;
          }
        } catch (error) {
          logger.warn('Failed to check render status', {
            renderId: video.render_id,
            error: error.message,
          });
        }
      }

      return {
        found: true,
        video,
      };
    } catch (error) {
      logger.error('Failed to get video status', {
        communeCode,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List all videos
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - List of videos
   */
  async listVideos(filters = {}) {
    try {
      const { status, limit = 100 } = filters;

      if (status) {
        return await supabaseService.getVideosByStatus(status, limit);
      }

      // Get all videos by fetching all statuses
      const statuses = ['pending', 'processing', 'completed', 'failed'];
      const allVideos = [];

      for (const s of statuses) {
        const videos = await supabaseService.getVideosByStatus(s, limit);
        allVideos.push(...videos);
      }

      return allVideos;
    } catch (error) {
      logger.error('Failed to list videos', { error: error.message });
      throw error;
    }
  }

  /**
   * Get statistics
   * @returns {Promise<Object>} - Statistics
   */
  async getStatistics() {
    try {
      const counts = await supabaseService.getStatusCounts();
      const statistics = await supabaseService.getStatistics();

      return {
        counts,
        statistics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get statistics', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const videoGenerator = new VideoGenerator();
export default videoGenerator;
