import { Client } from 'creatomate';
import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { generateCompleteCopyPackage } from '../templates/cro-copy.js';
import { getTrustSignals } from '../utils/trust-signals.js';

/**
 * Creatomate Service
 * Handles video rendering using Creatomate API
 */
class CreatomateService {
  constructor() {
    this.client = new Client(config.creatomate.apiKey);
    this.apiKey = config.creatomate.apiKey;
    this.templateId = config.creatomate.templateId;
    this.apiBaseUrl = config.creatomate.apiBaseUrl;
    this.webhookUrl = config.webhook.url;
  }

  /**
   * Get all templates in the project
   * @returns {Promise<Array>} - List of templates
   */
  async getTemplates() {
    try {
      logger.info('Fetching templates from Creatomate');

      const response = await axios.get(`${this.apiBaseUrl}/templates`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('Templates retrieved successfully', {
        count: response.data.length,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch templates', { error: error.message });
      throw new Error(`Creatomate API error: ${error.message}`);
    }
  }

  /**
   * Get a specific template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} - Template object
   */
  async getTemplate(templateId) {
    try {
      logger.info('Fetching template', { templateId });

      const response = await axios.get(
        `${this.apiBaseUrl}/templates/${templateId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Template retrieved successfully', { templateId });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch template', { error: error.message, templateId });
      throw error;
    }
  }

  /**
   * Create a video render using template modifications
   * @param {Object} params - Render parameters
   * @returns {Promise<Object>} - Render response
   */
  async createRender(params) {
    try {
      const {
        templateId = this.templateId,
        modifications = {},
        metadata = {},
        webhookUrl = this.webhookUrl,
      } = params;

      logger.info('Creating video render', {
        templateId,
        modificationsCount: Object.keys(modifications).length,
      });

      const payload = {
        template_id: templateId,
        modifications,
      };

      // Add webhook URL if provided
      if (webhookUrl) {
        payload.webhook_url = webhookUrl;
      }

      // Add metadata for tracking (must be a JSON string)
      if (Object.keys(metadata).length > 0) {
        payload.metadata = JSON.stringify(metadata);
      }

      const response = await axios.post(`${this.apiBaseUrl}/renders`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('Render created successfully', {
        renderId: response.data.id,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create render', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Creatomate render error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get render status by ID
   * @param {string} renderId - Render ID
   * @returns {Promise<Object>} - Render status object
   */
  async getRenderStatus(renderId) {
    try {
      logger.debug('Fetching render status', { renderId });

      const response = await axios.get(`${this.apiBaseUrl}/renders/${renderId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.debug('Render status retrieved', {
        renderId,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch render status', {
        error: error.message,
        renderId,
      });
      throw error;
    }
  }

  /**
   * Poll render status until completion or failure
   * @param {string} renderId - Render ID
   * @param {number} maxAttempts - Maximum polling attempts
   * @param {number} intervalMs - Polling interval in milliseconds
   * @returns {Promise<Object>} - Final render object
   */
  async pollRenderStatus(renderId, maxAttempts = 60, intervalMs = 10000) {
    logger.info('Starting render status polling', {
      renderId,
      maxAttempts,
      intervalMs,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const render = await this.getRenderStatus(renderId);

        logger.debug(`Poll attempt ${attempt}/${maxAttempts}`, {
          renderId,
          status: render.status,
        });

        // Check if render is complete
        if (render.status === 'succeeded') {
          logger.info('Render completed successfully', {
            renderId,
            url: render.url,
          });
          return render;
        }

        // Check if render failed
        if (render.status === 'failed') {
          logger.error('Render failed', {
            renderId,
            error: render.error_message,
          });
          throw new Error(`Render failed: ${render.error_message || 'Unknown error'}`);
        }

        // Wait before next poll (but not on last attempt)
        if (attempt < maxAttempts) {
          await this.sleep(intervalMs);
        }
      } catch (error) {
        if (error.message.includes('Render failed')) {
          throw error;
        }
        logger.warn('Poll attempt failed, retrying', {
          attempt,
          error: error.message,
        });
      }
    }

    throw new Error(`Render polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Create a video with commune-specific modifications (legacy single audio)
   * @param {Object} communeData - Commune information
   * @param {string} audioUrl - URL to voice-over audio file
   * @returns {Promise<Object>} - Render response
   * @deprecated Use createCommuneVideoDualAudio for dual audio support
   */
  async createCommuneVideo(communeData, audioUrl) {
    try {
      logger.warn('Using legacy single audio method. Consider using createCommuneVideoDualAudio instead.');

      logger.info('Creating commune video', {
        commune: communeData.name,
        audioUrl,
      });

      // Build modifications based on actual template structure
      // Template element names from: cce484ec-163f-48af-8d36-f21080113e19
      const modifications = {
        // City names (multiple instances in template)
        'City 1.text': communeData.name.toUpperCase(), // e.g., BOULOGNE-BILLANCOURT
        'City 2.text': communeData.name.toUpperCase(), // e.g., BOULOGNE-BILLANCOURT
        'City 3.text': communeData.name, // e.g., Paris (normal case)

        // Service type and keywords
        'City 4.text': `ÉLECTRICIEN ${(communeData.department || 'PARIS').toUpperCase()}`, // e.g., ÉLECTRICIEN PARIS
        'Search Keywords.text': `Électricien ${communeData.name}`, // e.g., Électricien Paris

        // Postal code (first 5 digits of INSEE code)
        'Cp.text': communeData.code ? communeData.code.substring(0, 5) : '',

        // Service description text (replacing plumbing text with electrical)
        'Result Text.text': `Nous sommes spécialisés dans les dépannages électriques d'urgence, disponibles 24 heures sur 24 et 7 jours sur 7.`,

        // Voice-over audio (legacy - single audio)
        'Intro_audio.source': audioUrl,
        'Full Audio.source': audioUrl, // Use same audio for both in legacy mode

        // Optional: Add more elements as needed from your template
        // 'Background-Video': 'https://your-cdn.com/background.mp4',
        // 'Logo-Image': 'https://your-cdn.com/logo.png',
      };

      // Metadata for tracking
      const metadata = {
        commune_code: communeData.code,
        commune_name: communeData.name,
        commune_population: communeData.population,
        generated_at: new Date().toISOString(),
      };

      const render = await this.createRender({
        modifications,
        metadata,
      });

      return render;
    } catch (error) {
      logger.error('Failed to create commune video', {
        commune: communeData.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create a video with commune-specific modifications and dual audio (Template 7)
   *
   * Template 7 Features:
   * - Duration: 33 seconds (extended to prevent audio cut-off)
   * - 7 dynamic text elements
   * - 4 static image elements (LOGO, Phone_bg, IDFMap, certifiee)
   * - 2 audio sources (Intro + Full with NO duration limit)
   * - Static CTA: "APPELEZ-NOUS ! Des professionnels vous répondent 24h/24 et 7j/7"
   * - Dedicated phone number element: Tel-number.text
   * - Full Audio plays until end of template (no cut-off)
   *
   * @param {Object} communeData - Commune information
   * @param {string} introAudioUrl - URL to intro hook audio file (3-5s)
   * @param {string} fullAudioUrl - URL to full voice-over audio file (up to 29s playback)
   * @param {Object} options - CRO options (tracked but not all used in template 7)
   * @returns {Promise<Object>} - Render response
   */
  async createCommuneVideoDualAudio(communeData, introAudioUrl, fullAudioUrl, options = {}) {
    try {
      logger.info('Creating commune video with dual audio', {
        commune: communeData.name,
        introAudioUrl,
        fullAudioUrl,
      });

      // Get variants and options
      const {
        phone = '06 44 64 71 75',
        descriptionVariant = 'standard',
        ctaVariant = 'standard',
        trustBadgeVariant = 'all',
        includePhoneInCTA = false
      } = options;

      // Generate complete CRO-optimized copy package
      const trustSignals = getTrustSignals(communeData);
      const copyPackage = generateCompleteCopyPackage(communeData, {
        phone,
        descriptionVariant,
        ctaVariant,
        trustBadgeVariant,
        includePhoneInCTA
      });

      logger.debug('Copy package generated', {
        commune: communeData.name,
        urgencyLevel: copyPackage.urgencyLevel,
        populationSize: copyPackage.populationSize
      });

      // Build modifications object for Template 7 (33 seconds, 7 text + 4 images + 2 audio)
      // Template ID: cce484ec-163f-48af-8d36-f21080113e19
      const modifications = {
        // ===== CITY NAMES (3 instances) =====
        'City 2.text': copyPackage.cityUppercase,     // Final city banner (23.71-27.41s)
        'City 3.text': copyPackage.cityNormal,        // Opening city display (0.38-3.23s)
        'City 4.text': copyPackage.serviceCity,       // Mid-video service+city (9.34-15.25s)

        // ===== SEARCH INTERFACE =====
        'Search Keywords.text': copyPackage.searchKeywords, // Search box text (3.34-8.86s)

        // ===== POSTAL CODE =====
        'Cp.text': copyPackage.postalCode,            // Opening postal code (0.38-3.23s)

        // ===== PHONE NUMBER (Single dedicated element) =====
        'Tel-number.text': phone,                     // Phone display (16.20-30.99s)

        // ===== STATIC IMAGES (Template 7 - Updated sources) =====
        'LOGO.source': '3b9f6d01-88df-4d18-a063-f37afdccecc4',           // Brand logo (0-5.9s)
        'Phone_bg.source': '4fed73f3-bfba-43bb-987d-7159c231ec87',       // Phone background (16-33s) - NEW in T7
        'IDFMap.source': '910e16b3-f191-42dd-9026-7434fdda7d9c',         // IDF map (11-15s) - NEW in T7
        'certifiee.source': 'fc4f38ca-cc00-4204-b1b7-339d6bced2ed',      // Certification (6-8s)

        // ===== DUAL AUDIO SOURCES =====
        'Intro_audio.source': introAudioUrl,          // Short intro hook (0-~3.6s)
        'Full Audio.source': fullAudioUrl,            // Full voice-over (3.59-end) - NO DURATION LIMIT in T7
      };

      // Metadata for tracking and analytics
      const metadata = {
        commune_code: communeData.code,
        commune_name: communeData.name,
        commune_population: communeData.population,
        commune_size: copyPackage.populationSize,

        // Dual audio system
        dual_audio: true,
        intro_audio_url: introAudioUrl,
        full_audio_url: fullAudioUrl,

        // CRO variants
        description_variant: descriptionVariant,
        cta_variant: ctaVariant,
        trust_badge_variant: trustBadgeVariant,
        urgency_level: copyPackage.urgencyLevel,

        // Trust signals
        review_count: trustSignals.reviewCount,
        rating: trustSignals.rating,
        years_of_service: trustSignals.yearsOfService,
        certifications: trustSignals.certifications.join(', '),

        // Phone tracking
        phone_number: phone,

        generated_at: new Date().toISOString(),
        brand: 'ALLO-Electricien.PRO'
      };

      const render = await this.createRender({
        modifications,
        metadata,
      });

      logger.info('Template 7: Video render created (33s, 13 modifications)', {
        renderId: render.id,
        commune: communeData.name,
        phone: phone,
        modifications: {
          text: 7,
          images: 4,
          audio: 2
        },
        note: 'Full Audio has NO duration limit - plays to end'
      });

      return render;
    } catch (error) {
      logger.error('Failed to create commune video with dual audio', {
        commune: communeData.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all renders (with pagination)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - List of renders
   */
  async getRenders(options = {}) {
    try {
      const { limit = 100, offset = 0 } = options;

      logger.info('Fetching renders', { limit, offset });

      const response = await axios.get(`${this.apiBaseUrl}/renders`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        params: { limit, offset },
      });

      logger.info('Renders retrieved', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch renders', { error: error.message });
      throw error;
    }
  }

  /**
   * Cancel a render
   * @param {string} renderId - Render ID to cancel
   * @returns {Promise<Object>} - Cancellation response
   */
  async cancelRender(renderId) {
    try {
      logger.info('Cancelling render', { renderId });

      const response = await axios.delete(
        `${this.apiBaseUrl}/renders/${renderId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('Render cancelled', { renderId });
      return response.data;
    } catch (error) {
      logger.error('Failed to cancel render', {
        error: error.message,
        renderId,
      });
      throw error;
    }
  }

  /**
   * Sleep utility for polling
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate template modifications against template structure
   * @param {string} templateId - Template ID
   * @param {Object} modifications - Proposed modifications
   * @returns {Promise<boolean>} - Validation result
   */
  async validateModifications(templateId, modifications) {
    try {
      // This is a basic validation
      // In production, you'd fetch the template and validate against its structure
      logger.info('Validating modifications', {
        templateId,
        modificationsCount: Object.keys(modifications).length,
      });

      const template = await this.getTemplate(templateId);

      // Check if template exists
      if (!template) {
        throw new Error('Template not found');
      }

      // Additional validation logic can be added here
      return true;
    } catch (error) {
      logger.error('Modification validation failed', {
        error: error.message,
        templateId,
      });
      return false;
    }
  }
}

// Export singleton instance
export const creatomateService = new CreatomateService();
export default creatomateService;
