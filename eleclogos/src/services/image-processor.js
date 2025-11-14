/**
 * Image Processor Service
 * Core service for generating optimized image variants
 * Handles download, processing with Sharp, watermarking, upload, and database tracking
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseService } from './supabase.js';
import { storageHelper } from '../utils/storage-helper.js';
import { imageHelper } from '../utils/image-helper.js';
import { watermarkManager } from './watermark-manager.js';
import LayerCompositor from '../../sharp/lib/layer-compositor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageProcessor {
  constructor() {
    this.variantSpecs = {
      hero: { width: 1920, height: 1080 },
      og: { width: 1200, height: 630 },
      featured: { width: 800, height: 600 },
      video: { width: 1280, height: 720 }
    };

    this.formats = ['jpg', 'webp', 'avif'];
    this.buckets = {
      source: 'source-images',
      processed: 'processed-images'
    };
  }

  /**
   * Get or generate image variant
   * Returns cached variant if exists, generates if not
   * @param {number} imageNumber - Source image number (1-342)
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {string} variantType - Variant type (hero, og, featured, video)
   * @param {string} format - Format (jpg, webp, avif)
   * @returns {Promise<string>} Public URL
   */
  async getImageVariant(imageNumber, siteIdentifier, variantType, format) {
    try {
      // 1. Check if variant already exists
      const existing = await this.checkExistingVariant(
        imageNumber,
        siteIdentifier,
        variantType,
        format
      );

      if (existing) {
        // Update access tracking
        await this.trackAccess(existing.id);
        return existing.public_url;
      }

      // 2. Generate new variant
      return await this.generateVariant(imageNumber, siteIdentifier, variantType, format);

    } catch (error) {
      console.error(`Failed to get variant for image ${imageNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if variant already exists in database
   * @param {number} imageNumber - Source image number
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {string} variantType - Variant type
   * @param {string} format - Format
   * @returns {Promise<object|null>}
   */
  async checkExistingVariant(imageNumber, siteIdentifier, variantType, format) {
    try {
      // Get site config
      const site = await watermarkManager.getSiteConfig(siteIdentifier);

      // Query for existing variant
      const { data, error } = await supabaseService.client
        .from('image_variants')
        .select(`
          id,
          public_url,
          file_size,
          generated_at,
          source_images!inner(image_number)
        `)
        .eq('source_images.image_number', imageNumber)
        .eq('site_id', site.id)
        .eq('variant_type', variantType)
        .eq('format', format)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found, which is okay
        throw error;
      }

      return data;

    } catch (error) {
      // If not found, return null
      return null;
    }
  }

  /**
   * Generate image variant
   * @param {number} imageNumber - Source image number
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {string} variantType - Variant type
   * @param {string} format - Format
   * @returns {Promise<string>} Public URL
   */
  async generateVariant(imageNumber, siteIdentifier, variantType, format) {
    const startTime = Date.now();

    console.log(`Generating: image ${imageNumber}, ${variantType}, ${format} for ${siteIdentifier}`);

    try {
      // 1. Get source image info from database
      const sourceImage = await this.getSourceImage(imageNumber);

      // 2. Get site config
      const site = await watermarkManager.getSiteConfig(siteIdentifier);

      // 3. Download source image from Supabase
      const sourceBuffer = await storageHelper.downloadFile(
        this.buckets.source,
        sourceImage.storage_path
      );

      // 4. Get watermark layout for this variant
      const spec = this.variantSpecs[variantType];
      const watermarkLayout = await watermarkManager.getWatermarkLayout(
        siteIdentifier,
        spec.width,
        spec.height
      );

      // 5. Process image with Sharp
      const processedBuffer = await this.processImage(
        sourceBuffer,
        spec,
        watermarkLayout,
        format
      );

      // 6. Upload to Supabase Storage
      const storagePath = storageHelper.getVariantStoragePath(
        site.domain,
        variantType,
        imageNumber,
        format
      );

      const uploadResult = await storageHelper.uploadFile(
        this.buckets.processed,
        storagePath,
        processedBuffer,
        {
          contentType: storageHelper.getContentType(`.${format}`),
          cacheControl: '31536000' // 1 year
        }
      );

      // 7. Record in database
      const variant = await this.recordVariant({
        source_image_id: sourceImage.id,
        site_id: site.id,
        variant_type: variantType,
        format,
        width: spec.width,
        height: spec.height,
        storage_path: storagePath,
        storage_bucket: this.buckets.processed,
        public_url: uploadResult.url,
        file_size: processedBuffer.length,
        quality: imageHelper.getQualityForFormat(format, variantType),
        watermark_applied: true,
        watermark_config: site.watermark_config,
        generation_time_ms: Date.now() - startTime
      });

      console.log(`✓ Generated in ${Date.now() - startTime}ms`);

      return uploadResult.url;

    } catch (error) {
      console.error(`Failed to generate variant:`, error.message);
      throw error;
    }
  }

  /**
   * Process image with Sharp (resize + watermarks)
   * @param {Buffer} sourceBuffer - Source image buffer
   * @param {object} spec - Variant specifications
   * @param {object} watermarkLayout - Watermark layout
   * @param {string} format - Output format
   * @returns {Promise<Buffer>}
   */
  async processImage(sourceBuffer, spec, watermarkLayout, format) {
    try {
      // 1. Resize base image
      const baseImage = await sharp(sourceBuffer)
        .resize(spec.width, spec.height, {
          fit: 'cover',
          position: 'center',
          kernel: 'lanczos3'
        })
        .toBuffer();

      // 2. Create compositor
      const compositor = new LayerCompositor({
        width: spec.width,
        height: spec.height
      });

      // 3. Add logo watermark
      if (watermarkLayout.logo) {
        const logoBuffer = await compositor.convertLogoToPNG(
          watermarkLayout.logo.buffer,
          {
            width: watermarkLayout.logo.dimensions.width,
            height: watermarkLayout.logo.dimensions.height,
            opacity: watermarkLayout.logo.opacity
          }
        );

        if (logoBuffer) {
          compositor.addLayer(logoBuffer, {
            top: watermarkLayout.logo.position.top,
            left: watermarkLayout.logo.position.left
          });
        }
      }

      // 4. Add CTA watermark
      if (watermarkLayout.cta) {
        const ctaBuffer = await compositor.createSvgOverlay(
          watermarkLayout.cta.buffer,
          {
            width: watermarkLayout.cta.dimensions.width,
            height: watermarkLayout.cta.dimensions.height,
            opacity: watermarkLayout.cta.opacity,
            dropShadow: watermarkLayout.cta.dropShadow
          }
        );

        if (ctaBuffer) {
          compositor.addLayer(ctaBuffer, {
            top: watermarkLayout.cta.position.top,
            left: watermarkLayout.cta.position.left
          });
        }
      }

      // 5. Composite layers
      const composited = await compositor.composite(baseImage);

      // 6. Export with format-specific optimization
      const outputBuffer = await this.exportFormat(composited, format);

      return outputBuffer;

    } catch (error) {
      console.error('Image processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Export image in specific format with optimization
   * @param {Buffer} buffer - Image buffer
   * @param {string} format - Output format
   * @returns {Promise<Buffer>}
   */
  async exportFormat(buffer, format) {
    let pipeline = sharp(buffer);

    const options = imageHelper.getFormatOptions(format, 'default');

    if (format === 'jpg') {
      return await pipeline.jpeg(options).toBuffer();
    } else if (format === 'webp') {
      return await pipeline.webp(options).toBuffer();
    } else if (format === 'avif') {
      return await pipeline.avif(options).toBuffer();
    } else if (format === 'png') {
      return await pipeline.png(options).toBuffer();
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * Get source image from database
   * @param {number} imageNumber - Image number
   * @returns {Promise<object>}
   */
  async getSourceImage(imageNumber) {
    const { data, error } = await supabaseService.client
      .from('source_images')
      .select('*')
      .eq('image_number', imageNumber)
      .single();

    if (error || !data) {
      throw new Error(`Source image ${imageNumber} not found in database`);
    }

    return data;
  }

  /**
   * Record variant in database
   * @param {object} variantData - Variant data
   * @returns {Promise<object>}
   */
  async recordVariant(variantData) {
    const { data, error } = await supabaseService.client
      .from('image_variants')
      .insert(variantData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record variant: ${error.message}`);
    }

    return data;
  }

  /**
   * Track image access
   * @param {string} variantId - Variant UUID
   * @returns {Promise<void>}
   */
  async trackAccess(variantId) {
    try {
      await supabaseService.client
        .from('image_variants')
        .update({
          access_count: supabaseService.client.raw('access_count + 1'),
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', variantId);

    } catch (error) {
      // Non-critical, don't throw
      console.warn('Failed to track access:', error.message);
    }
  }

  /**
   * Generate all variants for an image
   * @param {number} imageNumber - Image number
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {object} options - Generation options
   * @returns {Promise<object>}
   */
  async generateAllVariants(imageNumber, siteIdentifier, options = {}) {
    const variantTypes = options.variants || Object.keys(this.variantSpecs);
    const formats = options.formats || this.formats;

    console.log(`Generating all variants for image ${imageNumber}...`);

    const results = {};

    for (const variantType of variantTypes) {
      results[variantType] = {};

      for (const format of formats) {
        try {
          const url = await this.getImageVariant(
            imageNumber,
            siteIdentifier,
            variantType,
            format
          );

          results[variantType][format] = {
            success: true,
            url
          };

        } catch (error) {
          results[variantType][format] = {
            success: false,
            error: error.message
          };
        }
      }
    }

    return results;
  }

  /**
   * Batch generate variants for multiple images
   * @param {Array<number>} imageNumbers - Array of image numbers
   * @param {string} siteIdentifier - Site domain or UUID
   * @param {object} options - Generation options
   * @returns {Promise<Array>}
   */
  async batchGenerate(imageNumbers, siteIdentifier, options = {}) {
    const concurrency = options.concurrency || 3;
    const variantTypes = options.variants || Object.keys(this.variantSpecs);
    const formats = options.formats || this.formats;

    console.log(`Batch generating for ${imageNumbers.length} images...`);
    console.log(`Variants: ${variantTypes.join(', ')}`);
    console.log(`Formats: ${formats.join(', ')}`);
    console.log(`Concurrency: ${concurrency}\n`);

    const results = [];

    // Process in batches
    for (let i = 0; i < imageNumbers.length; i += concurrency) {
      const batch = imageNumbers.slice(i, i + concurrency);

      const batchPromises = batch.map(async (imageNumber) => {
        try {
          const variants = await this.generateAllVariants(imageNumber, siteIdentifier, {
            variants: variantTypes,
            formats
          });

          return {
            imageNumber,
            success: true,
            variants
          };

        } catch (error) {
          return {
            imageNumber,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      console.log(`Progress: ${Math.min(i + concurrency, imageNumbers.length)}/${imageNumbers.length}`);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\nBatch generation complete: ${successful} succeeded, ${failed} failed`);

    return results;
  }

  /**
   * Generate images for new page
   * @param {string} pageSlug - Page slug
   * @param {string} communeCode - Commune code
   * @param {string} siteIdentifier - Site domain or UUID
   * @returns {Promise<object>}
   */
  async generateImagesForPage(pageSlug, communeCode, siteIdentifier) {
    console.log(`Generating images for page: ${pageSlug}`);

    try {
      // Get image assignment for this commune
      let assignment = await this.getCommuneImageAssignment(communeCode);

      if (!assignment) {
        // Auto-assign image if not assigned
        assignment = await this.assignImageToCommune(communeCode);
      }

      const imageNumber = assignment.image_number;

      // Generate all variants (JPG and WebP initially)
      const variants = await this.generateAllVariants(imageNumber, siteIdentifier, {
        formats: ['jpg', 'webp'] // Skip AVIF for now, generate on-demand
      });

      // Get site config
      const site = await watermarkManager.getSiteConfig(siteIdentifier);

      // Record usage for each variant
      for (const [variantType, formats] of Object.entries(variants)) {
        if (formats.jpg && formats.jpg.success) {
          await this.recordImageUsage({
            page_slug: pageSlug,
            commune_code: communeCode,
            variant_type: variantType,
            site_id: site.id,
            image_number: imageNumber
          });
        }
      }

      return {
        imageNumber,
        variants,
        pageSlug,
        communeCode
      };

    } catch (error) {
      console.error(`Failed to generate images for page ${pageSlug}:`, error.message);
      throw error;
    }
  }

  /**
   * Get commune image assignment
   * @param {string} communeCode - Commune code
   * @returns {Promise<object|null>}
   */
  async getCommuneImageAssignment(communeCode) {
    const { data, error } = await supabaseService.client
      .from('commune_images')
      .select('*')
      .eq('commune_code', communeCode)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Auto-assign image to commune (round-robin)
   * @param {string} communeCode - Commune code
   * @returns {Promise<object>}
   */
  async assignImageToCommune(communeCode) {
    // Get total number of communes
    const { count } = await supabaseService.client
      .from('commune_images')
      .select('*', { count: 'exact', head: true });

    // Assign image using round-robin (342 images)
    const imageNumber = (count % 342) + 1;

    const assignment = {
      commune_code: communeCode,
      image_number: imageNumber,
      image_base_path: `elec-${String(imageNumber).padStart(3, '0')}`,
      assigned_date: new Date().toISOString()
    };

    const { data, error } = await supabaseService.client
      .from('commune_images')
      .insert(assignment)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Record image usage
   * @param {object} usageData - Usage data
   * @returns {Promise<void>}
   */
  async recordImageUsage(usageData) {
    try {
      // Get the variant ID
      const sourceImage = await this.getSourceImage(usageData.image_number);
      const site = await watermarkManager.getSiteConfig(usageData.site_id);

      const { data: variant } = await supabaseService.client
        .from('image_variants')
        .select('id')
        .eq('source_image_id', sourceImage.id)
        .eq('site_id', site.id)
        .eq('variant_type', usageData.variant_type)
        .eq('format', 'jpg')
        .single();

      if (!variant) {
        return;
      }

      await supabaseService.client
        .from('image_usage')
        .upsert({
          variant_id: variant.id,
          site_id: site.id,
          page_slug: usageData.page_slug,
          usage_type: usageData.variant_type,
          commune_code: usageData.commune_code
        }, {
          onConflict: 'page_slug,usage_type,variant_id'
        });

    } catch (error) {
      console.warn('Failed to record image usage:', error.message);
    }
  }

  /**
   * Get generation statistics
   * @param {string} siteIdentifier - Site domain or UUID (optional)
   * @returns {Promise<object>}
   */
  async getStatistics(siteIdentifier) {
    let query = supabaseService.client.from('image_variants').select('*', { count: 'exact', head: false });

    if (siteIdentifier) {
      const site = await watermarkManager.getSiteConfig(siteIdentifier);
      query = query.eq('site_id', site.id);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const stats = {
      total_variants: count,
      total_size_bytes: data.reduce((sum, v) => sum + (v.file_size || 0), 0),
      by_variant: {},
      by_format: {},
      avg_generation_time_ms: 0
    };

    // Calculate averages and breakdowns
    data.forEach(variant => {
      // By variant type
      if (!stats.by_variant[variant.variant_type]) {
        stats.by_variant[variant.variant_type] = 0;
      }
      stats.by_variant[variant.variant_type]++;

      // By format
      if (!stats.by_format[variant.format]) {
        stats.by_format[variant.format] = 0;
      }
      stats.by_format[variant.format]++;
    });

    const genTimes = data.filter(v => v.generation_time_ms).map(v => v.generation_time_ms);
    if (genTimes.length > 0) {
      stats.avg_generation_time_ms = Math.round(genTimes.reduce((a, b) => a + b) / genTimes.length);
    }

    stats.total_size_mb = (stats.total_size_bytes / 1024 / 1024).toFixed(2);
    stats.total_size_gb = (stats.total_size_bytes / 1024 / 1024 / 1024).toFixed(3);

    return stats;
  }
}

// Export singleton instance
export const imageProcessor = new ImageProcessor();
export default imageProcessor;
