import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Supabase Service
 * Handles all database operations for video tracking
 */
class SupabaseService {
  constructor() {
    // Use service role key for backend operations (bypasses RLS)
    this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    this.tableName = config.supabase.tableName;
  }

  /**
   * Create a new video record
   * @param {Object} videoData - Video information
   * @returns {Promise<Object>} - Created video record
   */
  async createVideo(videoData) {
    try {
      logger.info('Creating video record', {
        commune: videoData.commune_name,
      });

      const { data, error } = await this.client
        .from(this.tableName)
        .insert([videoData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Video record created', {
        id: data.id,
        commune: data.commune_name,
      });

      return data;
    } catch (error) {
      logger.error('Failed to create video record', {
        error: error.message,
        commune: videoData.commune_name,
      });
      throw error;
    }
  }

  /**
   * Get video by ID
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} - Video record
   */
  async getVideoById(videoId) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get video by ID', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Get video by commune code
   * @param {string} communeCode - Commune INSEE code
   * @returns {Promise<Object|null>} - Video record or null
   */
  async getVideoByCommune(communeCode) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('commune_code', communeCode)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is OK
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get video by commune', {
        error: error.message,
        communeCode,
      });
      throw error;
    }
  }

  /**
   * Get all videos for a commune (may be multiple if regenerated)
   * @param {string} communeCode - Commune code
   * @returns {Promise<Array>} - Array of video records
   */
  async getVideosByCommune(communeCode) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('commune_code', communeCode)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get videos by commune', {
        error: error.message,
        communeCode,
      });
      throw error;
    }
  }

  /**
   * Get video by render ID
   * @param {string} renderId - Creatomate render ID
   * @returns {Promise<Object|null>} - Video record
   */
  async getVideoByRenderId(renderId) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('render_id', renderId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get video by render ID', {
        error: error.message,
        renderId,
      });
      throw error;
    }
  }

  /**
   * Update video record
   * @param {string} videoId - Video ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated video record
   */
  async updateVideo(videoId, updates) {
    try {
      logger.debug('Updating video record', { videoId, updates });

      const { data, error } = await this.client
        .from(this.tableName)
        .update(updates)
        .eq('id', videoId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Video record updated', {
        id: data.id,
        status: data.video_status,
      });

      return data;
    } catch (error) {
      logger.error('Failed to update video record', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Update video status
   * @param {string} videoId - Video ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional fields to update
   * @returns {Promise<Object>} - Updated video record
   */
  async updateStatus(videoId, status, additionalData = {}) {
    try {
      const updates = {
        video_status: status,
        ...additionalData,
      };

      // Add timestamp based on status
      if (status === 'processing' && !updates.render_started_at) {
        updates.render_started_at = new Date().toISOString();
      } else if (status === 'completed' && !updates.render_completed_at) {
        updates.render_completed_at = new Date().toISOString();
      }

      return await this.updateVideo(videoId, updates);
    } catch (error) {
      logger.error('Failed to update video status', {
        error: error.message,
        videoId,
        status,
      });
      throw error;
    }
  }

  /**
   * Mark video as completed
   * @param {string} videoId - Video ID
   * @param {string} videoUrl - Final video URL
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Updated video record
   */
  async markCompleted(videoId, videoUrl, metadata = {}) {
    try {
      logger.info('Marking video as completed', { videoId, videoUrl });

      return await this.updateStatus(videoId, 'completed', {
        video_url: videoUrl,
        render_completed_at: new Date().toISOString(),
        ...metadata,
      });
    } catch (error) {
      logger.error('Failed to mark video as completed', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Mark video as failed
   * @param {string} videoId - Video ID
   * @param {string} errorMessage - Error description
   * @returns {Promise<Object>} - Updated video record
   */
  async markFailed(videoId, errorMessage) {
    try {
      logger.warn('Marking video as failed', { videoId, errorMessage });

      return await this.updateStatus(videoId, 'failed', {
        error_message: errorMessage,
      });
    } catch (error) {
      logger.error('Failed to mark video as failed', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Get all pending videos
   * @returns {Promise<Array>} - List of pending videos
   */
  async getPendingVideos() {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('video_status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      logger.info('Retrieved pending videos', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Failed to get pending videos', { error: error.message });
      throw error;
    }
  }

  /**
   * Get videos by status
   * @param {string} status - Video status
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} - List of videos
   */
  async getVideosByStatus(status, limit = 100) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('video_status', status)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get videos by status', {
        error: error.message,
        status,
      });
      throw error;
    }
  }

  /**
   * Get video statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getStatistics() {
    try {
      const { data, error } = await this.client
        .from('video_statistics')
        .select('*');

      if (error) {
        throw error;
      }

      logger.info('Retrieved video statistics');
      return data;
    } catch (error) {
      logger.error('Failed to get statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get total counts by status
   * @returns {Promise<Object>} - Count object
   */
  async getStatusCounts() {
    try {
      const statuses = ['pending', 'processing', 'completed', 'failed'];
      const counts = {};

      for (const status of statuses) {
        const { count, error } = await this.client
          .from(this.tableName)
          .select('*', { count: 'exact', head: true })
          .eq('video_status', status);

        if (error) {
          throw error;
        }

        counts[status] = count;
      }

      logger.info('Retrieved status counts', counts);
      return counts;
    } catch (error) {
      logger.error('Failed to get status counts', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk insert videos
   * @param {Array} videos - Array of video objects
   * @returns {Promise<Array>} - Created records
   */
  async bulkInsert(videos) {
    try {
      logger.info('Bulk inserting videos', { count: videos.length });

      const { data, error } = await this.client
        .from(this.tableName)
        .insert(videos)
        .select();

      if (error) {
        throw error;
      }

      logger.info('Bulk insert completed', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Failed to bulk insert videos', {
        error: error.message,
        count: videos.length,
      });
      throw error;
    }
  }

  /**
   * Check if commune video already exists
   * @param {string} communeCode - Commune INSEE code
   * @returns {Promise<boolean>} - True if exists
   */
  async communeExists(communeCode) {
    try {
      const video = await this.getVideoByCommune(communeCode);
      return !!video;
    } catch (error) {
      logger.error('Failed to check commune existence', {
        error: error.message,
        communeCode,
      });
      return false;
    }
  }

  /**
   * Delete video record (use with caution)
   * @param {string} videoId - Video ID
   * @returns {Promise<void>}
   */
  async deleteVideo(videoId) {
    try {
      logger.warn('Deleting video record', { videoId });

      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('id', videoId);

      if (error) {
        throw error;
      }

      logger.info('Video record deleted', { videoId });
    } catch (error) {
      logger.error('Failed to delete video', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Upload audio file to Supabase Storage
   * @param {string} filepath - Local file path
   * @param {string} communeCode - Commune code for naming
   * @returns {Promise<string>} - Public URL
   */
  async uploadAudio(filepath, communeCode) {
    try {
      logger.info('Uploading audio to Supabase Storage', { filepath, communeCode });

      // Read file from disk
      const fileBuffer = await fs.readFile(filepath);

      // Generate storage path
      const storagePath = `commune-audio/${communeCode}_voiceover.mp3`;

      // Upload to Supabase Storage
      const { data, error } = await this.client.storage
        .from('audio-files')
        .upload(storagePath, fileBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Check if file already exists
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
          logger.warn('Audio file already exists, getting existing URL', { communeCode });
          return this.getAudioUrl(communeCode);
        }
        throw error;
      }

      // Get public URL
      const publicUrl = this.getAudioUrl(communeCode);

      logger.info('Audio uploaded successfully', { publicUrl, communeCode });
      return publicUrl;

    } catch (error) {
      logger.error('Failed to upload audio to Supabase', {
        error: error.message,
        filepath,
        communeCode
      });
      throw error;
    }
  }

  /**
   * Get public URL for uploaded audio
   * @param {string} communeCode - Commune code
   * @returns {string} - Public URL
   */
  getAudioUrl(communeCode) {
    const storagePath = `commune-audio/${communeCode}_voiceover.mp3`;

    const { data } = this.client.storage
      .from('audio-files')
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  /**
   * Delete audio file from storage
   * @param {string} communeCode - Commune code
   * @returns {Promise<void>}
   */
  async deleteAudio(communeCode) {
    try {
      const storagePath = `commune-audio/${communeCode}_voiceover.mp3`;

      const { error } = await this.client.storage
        .from('audio-files')
        .remove([storagePath]);

      if (error) {
        throw error;
      }

      logger.info('Audio deleted from storage', { communeCode });
    } catch (error) {
      logger.error('Failed to delete audio', {
        error: error.message,
        communeCode
      });
      throw error;
    }
  }

  /**
   * Upload dual audio files to Supabase Storage
   * @param {string} introFilepath - Local path to intro audio file
   * @param {string} fullFilepath - Local path to full audio file
   * @param {string} communeCode - Commune code for naming
   * @returns {Promise<Object>} - Public URLs for both audio files
   */
  async uploadDualAudio(introFilepath, fullFilepath, communeCode) {
    try {
      logger.info('Uploading dual audio files to Supabase Storage', {
        introFilepath,
        fullFilepath,
        communeCode,
      });

      // Upload intro audio
      logger.info('Uploading intro audio...');
      const introBuffer = await fs.readFile(introFilepath);
      const introStoragePath = `commune-audio/${communeCode}_intro.mp3`;

      const { data: introData, error: introError } = await this.client.storage
        .from('audio-files')
        .upload(introStoragePath, introBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (introError) {
        if (introError.message.includes('Duplicate') || introError.message.includes('already exists')) {
          logger.warn('Intro audio already exists, getting existing URL', { communeCode });
        } else {
          throw introError;
        }
      }

      // Get intro public URL
      const { data: introUrlData } = this.client.storage
        .from('audio-files')
        .getPublicUrl(introStoragePath);
      const introUrl = introUrlData.publicUrl;

      logger.info('Intro audio uploaded', { introUrl });

      // Upload full audio
      logger.info('Uploading full audio...');
      const fullBuffer = await fs.readFile(fullFilepath);
      const fullStoragePath = `commune-audio/${communeCode}_full.mp3`;

      const { data: fullData, error: fullError } = await this.client.storage
        .from('audio-files')
        .upload(fullStoragePath, fullBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (fullError) {
        if (fullError.message.includes('Duplicate') || fullError.message.includes('already exists')) {
          logger.warn('Full audio already exists, getting existing URL', { communeCode });
        } else {
          throw fullError;
        }
      }

      // Get full public URL
      const { data: fullUrlData } = this.client.storage
        .from('audio-files')
        .getPublicUrl(fullStoragePath);
      const fullUrl = fullUrlData.publicUrl;

      logger.info('Full audio uploaded', { fullUrl });

      logger.info('Dual audio upload completed', {
        introUrl,
        fullUrl,
        communeCode,
      });

      return {
        introUrl,
        fullUrl,
      };
    } catch (error) {
      logger.error('Failed to upload dual audio to Supabase', {
        error: error.message,
        introFilepath,
        fullFilepath,
        communeCode,
      });
      throw error;
    }
  }

  /**
   * Get public URLs for dual audio files
   * @param {string} communeCode - Commune code
   * @returns {Object} - Public URLs for both audio files
   */
  getDualAudioUrls(communeCode) {
    const introStoragePath = `commune-audio/${communeCode}_intro.mp3`;
    const fullStoragePath = `commune-audio/${communeCode}_full.mp3`;

    const { data: introData } = this.client.storage
      .from('audio-files')
      .getPublicUrl(introStoragePath);

    const { data: fullData } = this.client.storage
      .from('audio-files')
      .getPublicUrl(fullStoragePath);

    return {
      introUrl: introData.publicUrl,
      fullUrl: fullData.publicUrl,
    };
  }

  /**
   * Delete dual audio files from storage
   * @param {string} communeCode - Commune code
   * @returns {Promise<void>}
   */
  async deleteDualAudio(communeCode) {
    try {
      const introStoragePath = `commune-audio/${communeCode}_intro.mp3`;
      const fullStoragePath = `commune-audio/${communeCode}_full.mp3`;

      const { error } = await this.client.storage
        .from('audio-files')
        .remove([introStoragePath, fullStoragePath]);

      if (error) {
        throw error;
      }

      logger.info('Dual audio deleted from storage', { communeCode });
    } catch (error) {
      logger.error('Failed to delete dual audio', {
        error: error.message,
        communeCode,
      });
      throw error;
    }
  }

  // ===== A/B TESTING METHODS =====

  /**
   * Record A/B test assignment for a video
   * @param {string} videoId - Video UUID
   * @param {Object} assignment - Test assignment data
   * @returns {Promise<Object>} - Created assignment record
   */
  async recordTestAssignment(videoId, assignment) {
    try {
      logger.info('Recording A/B test assignment', {
        videoId,
        testName: assignment.test_name,
        variant: assignment.variant_group
      });

      const { data, error } = await this.client
        .from('ab_test_assignments')
        .insert([{
          video_id: videoId,
          test_name: assignment.test_name,
          variant_group: assignment.variant_group,
          metadata: assignment.metadata || {}
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Test assignment recorded', {
        assignmentId: data.id,
        testName: data.test_name,
        variant: data.variant_group
      });

      return data;
    } catch (error) {
      logger.error('Failed to record test assignment', {
        error: error.message,
        videoId,
        testName: assignment?.test_name
      });
      throw error;
    }
  }

  /**
   * Get test assignments for a video
   * @param {string} videoId - Video UUID
   * @returns {Promise<Array>} - List of test assignments
   */
  async getTestAssignments(videoId) {
    try {
      const { data, error } = await this.client
        .from('ab_test_assignments')
        .select('*')
        .eq('video_id', videoId);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get test assignments', {
        error: error.message,
        videoId
      });
      throw error;
    }
  }

  /**
   * Record video performance metrics
   * @param {string} videoId - Video UUID
   * @param {Object} metrics - Performance metrics
   * @returns {Promise<Object>} - Created or updated performance record
   */
  async recordVideoPerformance(videoId, metrics) {
    try {
      logger.info('Recording video performance', {
        videoId,
        views: metrics.views,
        conversions: metrics.phone_calls
      });

      const performanceData = {
        video_id: videoId,
        views: metrics.views || 0,
        unique_viewers: metrics.unique_viewers || 0,
        completion_rate: metrics.completion_rate || null,
        avg_watch_time: metrics.avg_watch_time || null,
        clicks: metrics.clicks || 0,
        click_through_rate: metrics.click_through_rate || null,
        phone_calls: metrics.phone_calls || 0,
        conversion_rate: metrics.conversion_rate || null,
        source: metrics.source || null,
        medium: metrics.medium || null,
        campaign: metrics.campaign || null,
        date: metrics.date || new Date().toISOString().split('T')[0]
      };

      // Try to upsert based on video_id, date, source
      const { data, error } = await this.client
        .from('video_performance')
        .upsert([performanceData], {
          onConflict: 'video_id,date,source',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Performance metrics recorded', {
        performanceId: data.id,
        videoId,
        views: data.views
      });

      return data;
    } catch (error) {
      logger.error('Failed to record video performance', {
        error: error.message,
        videoId
      });
      throw error;
    }
  }

  /**
   * Get variant performance summary
   * @param {string} testName - Test name
   * @param {string} variantId - Variant group ID (optional)
   * @returns {Promise<Array|Object>} - Variant performance data
   */
  async getVariantPerformance(testName, variantId = null) {
    try {
      let query = this.client
        .from('variant_performance_summary')
        .select('*')
        .eq('test_name', testName);

      if (variantId) {
        query = query.eq('variant_group', variantId);
        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data;
      }

      const { data, error } = await query.order('avg_conversion_rate', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get variant performance', {
        error: error.message,
        testName,
        variantId
      });
      throw error;
    }
  }

  /**
   * Get complete test results with all variants
   * @param {string} testName - Test name
   * @returns {Promise<Object>} - Complete test analysis
   */
  async getTestResults(testName) {
    try {
      logger.info('Getting test results', { testName });

      // Get variant performance summary
      const variants = await this.getVariantPerformance(testName);

      if (!variants || variants.length === 0) {
        return {
          testName,
          variants: [],
          hasResults: false,
          message: 'No performance data available yet'
        };
      }

      // Get winner if marked
      const winner = variants.find(v => v.is_winner);

      // Calculate total metrics
      const totals = variants.reduce((acc, v) => ({
        totalVideos: acc.totalVideos + (v.total_videos || 0),
        totalViews: acc.totalViews + (v.total_views || 0)
      }), { totalVideos: 0, totalViews: 0 });

      return {
        testName,
        variants: variants.map(v => ({
          variantId: v.variant_group,
          totalVideos: v.total_videos,
          totalViews: v.total_views,
          avgCompletionRate: v.avg_completion_rate,
          avgCTR: v.avg_ctr,
          avgConversionRate: v.avg_conversion_rate,
          confidenceLevel: v.confidence_level,
          isWinner: v.is_winner,
          updatedAt: v.updated_at
        })),
        totals,
        winner: winner ? winner.variant_group : null,
        hasResults: true,
        variantCount: variants.length
      };
    } catch (error) {
      logger.error('Failed to get test results', {
        error: error.message,
        testName
      });
      throw error;
    }
  }

  /**
   * Mark a variant as the winner
   * @param {string} testName - Test name
   * @param {string} variantId - Winning variant ID
   * @param {number} confidenceLevel - Confidence level (0-100)
   * @returns {Promise<Object>} - Updated record
   */
  async markWinner(testName, variantId, confidenceLevel = 95) {
    try {
      logger.info('Marking test winner', { testName, variantId, confidenceLevel });

      // First, unmark any existing winners for this test
      await this.client
        .from('variant_performance_summary')
        .update({ is_winner: false })
        .eq('test_name', testName)
        .eq('is_winner', true);

      // Mark the new winner
      const { data, error } = await this.client
        .from('variant_performance_summary')
        .update({
          is_winner: true,
          confidence_level: confidenceLevel,
          updated_at: new Date().toISOString()
        })
        .eq('test_name', testName)
        .eq('variant_group', variantId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Winner marked successfully', {
        testName,
        winner: variantId,
        confidence: confidenceLevel
      });

      return data;
    } catch (error) {
      logger.error('Failed to mark winner', {
        error: error.message,
        testName,
        variantId
      });
      throw error;
    }
  }

  /**
   * Update commune metadata for personalization intelligence
   * @param {string} communeCode - Commune code
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object>} - Updated record
   */
  async updateCommuneMetadata(communeCode, metadata) {
    try {
      logger.info('Updating commune metadata', { communeCode });

      const { data, error } = await this.client
        .from('commune_metadata')
        .upsert([{
          commune_code: communeCode,
          commune_name: metadata.commune_name,
          population: metadata.population,
          population_density: metadata.population_density,
          urgency_level: metadata.urgency_level,
          recommended_intro_variant: metadata.recommended_intro_variant,
          recommended_cta_variant: metadata.recommended_cta_variant,
          best_performing_variant: metadata.best_performing_variant,
          avg_conversion_rate: metadata.avg_conversion_rate,
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'commune_code'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Commune metadata updated', { communeCode });
      return data;
    } catch (error) {
      logger.error('Failed to update commune metadata', {
        error: error.message,
        communeCode
      });
      throw error;
    }
  }

  /**
   * Get commune metadata
   * @param {string} communeCode - Commune code
   * @returns {Promise<Object|null>} - Commune metadata
   */
  async getCommuneMetadata(communeCode) {
    try {
      const { data, error } = await this.client
        .from('commune_metadata')
        .select('*')
        .eq('commune_code', communeCode)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get commune metadata', {
        error: error.message,
        communeCode
      });
      throw error;
    }
  }

  /**
   * Get performance metrics for a specific video
   * @param {string} videoId - Video UUID
   * @returns {Promise<Array>} - Performance records
   */
  async getVideoPerformance(videoId) {
    try {
      const { data, error } = await this.client
        .from('video_performance')
        .select('*')
        .eq('video_id', videoId)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get video performance', {
        error: error.message,
        videoId
      });
      throw error;
    }
  }

  /**
   * Get top performing videos by conversion rate
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} - Top performing videos
   */
  async getTopPerformingVideos(limit = 10) {
    try {
      const { data, error} = await this.client
        .from('video_performance')
        .select('video_id, conversion_rate, phone_calls, views')
        .not('conversion_rate', 'is', null)
        .order('conversion_rate', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get top performing videos', {
        error: error.message,
        limit
      });
      throw error;
    }
  }

  /**
   * Update video file metadata (download, optimize, format info)
   * @param {string} videoId - Video ID
   * @param {Object} fileData - File metadata
   * @returns {Promise<Object>} - Updated video record
   */
  async updateVideoFiles(videoId, fileData) {
    try {
      logger.info('Updating video file metadata', {
        videoId,
        keys: Object.keys(fileData),
      });

      const { data, error } = await this.client
        .from(this.tableName)
        .update(fileData)
        .eq('id', videoId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Video file metadata updated', {
        videoId,
        seoFilename: data.seo_filename,
        downloaded: data.downloaded,
      });

      return data;
    } catch (error) {
      logger.error('Failed to update video file metadata', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Mark video as downloaded
   * @param {string} videoId - Video ID
   * @param {Object} downloadData - Download metadata
   * @returns {Promise<Object>} - Updated video record
   */
  async markVideoDownloaded(videoId, downloadData) {
    try {
      logger.info('Marking video as downloaded', { videoId });

      const updateData = {
        downloaded: true,
        download_date: new Date().toISOString(),
        processing_status: 'completed',
        ...downloadData,
      };

      return await this.updateVideoFiles(videoId, updateData);
    } catch (error) {
      logger.error('Failed to mark video as downloaded', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Get videos ready for download (completed but not downloaded)
   * @param {number} limit - Number of videos to fetch
   * @returns {Promise<Array>} - Videos to download
   */
  async getVideosToDownload(limit = 50) {
    try {
      logger.info('Fetching videos to download', { limit });

      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('video_status', 'completed')
        .eq('downloaded', false)
        .not('video_url', 'is', null)
        .order('render_completed_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      logger.info('Videos to download fetched', {
        count: data?.length || 0,
      });

      return data || [];
    } catch (error) {
      logger.error('Failed to get videos to download', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update video processing status
   * @param {string} videoId - Video ID
   * @param {string} status - Processing status
   * @returns {Promise<Object>} - Updated video record
   */
  async updateProcessingStatus(videoId, status) {
    try {
      logger.debug('Updating processing status', { videoId, status });

      const { data, error } = await this.client
        .from(this.tableName)
        .update({ processing_status: status })
        .eq('id', videoId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to update processing status', {
        error: error.message,
        videoId,
        status,
      });
      throw error;
    }
  }

  /**
   * Get download statistics
   * @returns {Promise<Object>} - Download statistics
   */
  async getDownloadStats() {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('downloaded, processing_status, file_size_original, file_size_compressed');

      if (error) {
        throw error;
      }

      const stats = {
        total: data.length,
        downloaded: data.filter(v => v.downloaded).length,
        pending: data.filter(v => !v.downloaded && v.processing_status === 'pending').length,
        downloading: data.filter(v => v.processing_status === 'downloading').length,
        optimizing: data.filter(v => v.processing_status === 'optimizing').length,
        failed: data.filter(v => v.processing_status === 'failed').length,
        totalSizeOriginal: data.reduce((sum, v) => sum + (v.file_size_original || 0), 0),
        totalSizeCompressed: data.reduce((sum, v) => sum + (v.file_size_compressed || 0), 0),
      };

      logger.info('Download stats calculated', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to get download stats', {
        error: error.message,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();
export default supabaseService;
