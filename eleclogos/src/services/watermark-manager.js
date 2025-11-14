/**
 * Watermark Manager Service
 * Manages multi-site watermark configurations and assets
 * Handles loading, caching, and providing watermarks for image processing
 */

import { supabaseService } from './supabase.js';
import { storageHelper } from '../utils/storage-helper.js';

class WatermarkManager {
  constructor() {
    this.siteConfigs = new Map(); // Cache site configs
    this.watermarkAssets = new Map(); // Cache downloaded watermark buffers
    this.cacheTTL = 3600000; // 1 hour in milliseconds
  }

  /**
   * Get site configuration by domain or ID
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<object>}
   */
  async getSiteConfig(siteIdentifier) {
    try {
      // Check cache first
      const cached = this.siteConfigs.get(siteIdentifier);
      if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
        return cached.config;
      }

      // Query database
      let query = supabaseService.client
        .from('sites')
        .select('*')
        .eq('active', true)
        .single();

      // Determine if identifier is UUID or domain
      if (this.isUUID(siteIdentifier)) {
        query = query.eq('id', siteIdentifier);
      } else {
        query = query.eq('domain', siteIdentifier);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch site config: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Site not found: ${siteIdentifier}`);
      }

      // Cache the config
      this.siteConfigs.set(siteIdentifier, {
        config: data,
        timestamp: Date.now()
      });

      // Also cache by the other identifier
      if (this.isUUID(siteIdentifier)) {
        this.siteConfigs.set(data.domain, {
          config: data,
          timestamp: Date.now()
        });
      } else {
        this.siteConfigs.set(data.id, {
          config: data,
          timestamp: Date.now()
        });
      }

      return data;

    } catch (error) {
      console.error(`Failed to get site config for ${siteIdentifier}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all active sites
   * @returns {Promise<Array>}
   */
  async getAllSites() {
    try {
      const { data, error } = await supabaseService.client
        .from('sites')
        .select('*')
        .eq('active', true)
        .order('domain', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Failed to get all sites:', error.message);
      throw error;
    }
  }

  /**
   * Get watermark configuration for a site
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<object>}
   */
  async getWatermarkConfig(siteIdentifier) {
    const site = await this.getSiteConfig(siteIdentifier);
    return site.watermark_config;
  }

  /**
   * Download and cache watermark asset
   * @param {string} storagePath - Path in Supabase Storage (e.g., "logos/logoicon-9.svg")
   * @returns {Promise<Buffer>}
   */
  async getWatermarkAsset(storagePath) {
    try {
      // Check cache first
      const cached = this.watermarkAssets.get(storagePath);
      if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
        return cached.buffer;
      }

      console.log(`Downloading watermark asset: ${storagePath}`);

      // Download from Supabase Storage
      const buffer = await storageHelper.downloadFile('source-images', storagePath);

      // Cache the buffer
      this.watermarkAssets.set(storagePath, {
        buffer,
        timestamp: Date.now()
      });

      return buffer;

    } catch (error) {
      console.error(`Failed to download watermark asset ${storagePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Get logo watermark for a site
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<{buffer: Buffer, config: object}>}
   */
  async getLogoWatermark(siteIdentifier) {
    const watermarkConfig = await this.getWatermarkConfig(siteIdentifier);

    const logoConfig = watermarkConfig.logo;
    const logoBuffer = await this.getWatermarkAsset(logoConfig.path);

    return {
      buffer: logoBuffer,
      config: logoConfig
    };
  }

  /**
   * Get CTA watermark for a site
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<{buffer: Buffer, config: object}>}
   */
  async getCtaWatermark(siteIdentifier) {
    const watermarkConfig = await this.getWatermarkConfig(siteIdentifier);

    const ctaConfig = watermarkConfig.cta;
    const ctaBuffer = await this.getWatermarkAsset(ctaConfig.path);

    return {
      buffer: ctaBuffer,
      config: ctaConfig
    };
  }

  /**
   * Get all watermarks for a site
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<{logo: object, cta: object, config: object}>}
   */
  async getSiteWatermarks(siteIdentifier) {
    const watermarkConfig = await this.getWatermarkConfig(siteIdentifier);

    const [logo, cta] = await Promise.all([
      this.getLogoWatermark(siteIdentifier),
      this.getCtaWatermark(siteIdentifier)
    ]);

    return {
      logo,
      cta,
      config: watermarkConfig
    };
  }

  /**
   * Calculate watermark dimensions for variant
   * @param {object} logoConfig - Logo configuration
   * @param {number} imageWidth - Target image width
   * @param {number} imageHeight - Target image height
   * @returns {object}
   */
  calculateLogoDimensions(logoConfig, imageWidth, imageHeight) {
    const baseSize = logoConfig.size || 240;

    // Scale proportionally based on image dimensions
    // Base size is for 1920px width
    const scale = imageWidth / 1920;
    const scaledSize = Math.round(baseSize * scale);

    return {
      width: scaledSize,
      height: scaledSize // Assuming square logo
    };
  }

  /**
   * Calculate CTA dimensions for variant
   * @param {object} ctaConfig - CTA configuration
   * @param {number} imageWidth - Target image width
   * @param {number} imageHeight - Target image height
   * @returns {object}
   */
  calculateCtaDimensions(ctaConfig, imageWidth, imageHeight) {
    const baseWidth = ctaConfig.size || 1050;
    const maxWidthPercent = ctaConfig.maxWidthPercent || 0.6;

    // Calculate maximum allowed width
    const maxWidth = Math.round(imageWidth * maxWidthPercent);

    // Scale down if necessary
    const width = Math.min(baseWidth, maxWidth);

    // Maintain aspect ratio (approximate 6:1 for CTA button)
    const aspectRatio = 6;
    const height = Math.round(width / aspectRatio);

    return {
      width,
      height
    };
  }

  /**
   * Calculate watermark position
   * @param {string} position - Position string (e.g., "top-left", "bottom-right")
   * @param {number} watermarkWidth - Watermark width
   * @param {number} watermarkHeight - Watermark height
   * @param {number} imageWidth - Image width
   * @param {number} imageHeight - Image height
   * @param {number} padding - Padding from edges (default: 15)
   * @returns {object}
   */
  calculatePosition(position, watermarkWidth, watermarkHeight, imageWidth, imageHeight, padding = 15) {
    const positions = {
      'top-left': {
        left: padding,
        top: padding
      },
      'top-right': {
        left: imageWidth - watermarkWidth - padding,
        top: padding
      },
      'top-center': {
        left: Math.round((imageWidth - watermarkWidth) / 2),
        top: padding
      },
      'bottom-left': {
        left: padding,
        top: imageHeight - watermarkHeight - padding
      },
      'bottom-right': {
        left: imageWidth - watermarkWidth - padding,
        top: imageHeight - watermarkHeight - padding
      },
      'bottom-center': {
        left: Math.round((imageWidth - watermarkWidth) / 2),
        top: imageHeight - watermarkHeight - padding
      },
      'center': {
        left: Math.round((imageWidth - watermarkWidth) / 2),
        top: Math.round((imageHeight - watermarkHeight) / 2)
      }
    };

    return positions[position] || positions['bottom-right'];
  }

  /**
   * Get complete watermark layout for variant
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {number} imageWidth - Target image width
   * @param {number} imageHeight - Target image height
   * @returns {Promise<object>}
   */
  async getWatermarkLayout(siteIdentifier, imageWidth, imageHeight) {
    const watermarks = await this.getSiteWatermarks(siteIdentifier);

    // Calculate logo dimensions and position
    const logoDimensions = this.calculateLogoDimensions(
      watermarks.logo.config,
      imageWidth,
      imageHeight
    );

    const logoPosition = this.calculatePosition(
      watermarks.logo.config.position,
      logoDimensions.width,
      logoDimensions.height,
      imageWidth,
      imageHeight
    );

    // Calculate CTA dimensions and position
    const ctaDimensions = this.calculateCtaDimensions(
      watermarks.cta.config,
      imageWidth,
      imageHeight
    );

    const ctaPosition = this.calculatePosition(
      watermarks.cta.config.position,
      ctaDimensions.width,
      ctaDimensions.height,
      imageWidth,
      imageHeight
    );

    return {
      logo: {
        buffer: watermarks.logo.buffer,
        dimensions: logoDimensions,
        position: logoPosition,
        opacity: watermarks.logo.config.opacity || 1.0
      },
      cta: {
        buffer: watermarks.cta.buffer,
        dimensions: ctaDimensions,
        position: ctaPosition,
        opacity: watermarks.cta.config.opacity || 1.0,
        dropShadow: watermarks.cta.config.dropShadow !== false
      },
      brandColor: watermarks.config.brandColor || '#dc2626'
    };
  }

  /**
   * Update site watermark configuration
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {object} watermarkConfig - New watermark configuration
   * @returns {Promise<void>}
   */
  async updateWatermarkConfig(siteIdentifier, watermarkConfig) {
    try {
      const site = await this.getSiteConfig(siteIdentifier);

      const { error } = await supabaseService.client
        .from('sites')
        .update({
          watermark_config: watermarkConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', site.id);

      if (error) {
        throw error;
      }

      // Clear cache
      this.siteConfigs.delete(siteIdentifier);
      this.siteConfigs.delete(site.id);
      this.siteConfigs.delete(site.domain);

      console.log(`Updated watermark config for ${site.domain}`);

    } catch (error) {
      console.error('Failed to update watermark config:', error.message);
      throw error;
    }
  }

  /**
   * Clear cache
   * @param {string} type - Type to clear ('sites', 'assets', 'all')
   */
  clearCache(type = 'all') {
    if (type === 'sites' || type === 'all') {
      this.siteConfigs.clear();
      console.log('Cleared site config cache');
    }

    if (type === 'assets' || type === 'all') {
      this.watermarkAssets.clear();
      console.log('Cleared watermark asset cache');
    }
  }

  /**
   * Preload watermarks for a site
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<void>}
   */
  async preloadWatermarks(siteIdentifier) {
    console.log(`Preloading watermarks for ${siteIdentifier}...`);

    await this.getSiteWatermarks(siteIdentifier);

    console.log(`✓ Watermarks preloaded for ${siteIdentifier}`);
  }

  /**
   * Preload watermarks for all active sites
   * @returns {Promise<void>}
   */
  async preloadAllWatermarks() {
    const sites = await this.getAllSites();

    console.log(`Preloading watermarks for ${sites.length} sites...`);

    await Promise.all(
      sites.map(site => this.preloadWatermarks(site.domain))
    );

    console.log(`✓ All watermarks preloaded`);
  }

  /**
   * Check if string is UUID
   * @param {string} str - String to check
   * @returns {boolean}
   */
  isUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getCacheStats() {
    return {
      siteConfigs: this.siteConfigs.size,
      watermarkAssets: this.watermarkAssets.size,
      cacheTTL: this.cacheTTL
    };
  }
}

// Export singleton instance
export const watermarkManager = new WatermarkManager();
export default watermarkManager;
