/**
 * Image Helper Utilities
 * Functions for image metadata extraction, validation, and manipulation
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageHelper {
  constructor() {
    this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
    this.variantSpecs = {
      hero: { width: 1920, height: 1080, aspectRatio: 16/9 },
      og: { width: 1200, height: 630, aspectRatio: 1.905 },
      featured: { width: 800, height: 600, aspectRatio: 4/3 },
      video: { width: 1280, height: 720, aspectRatio: 16/9 }
    };
  }

  /**
   * Extract metadata from image file
   * @param {string|Buffer} input - File path or buffer
   * @returns {Promise<object>}
   */
  async getImageMetadata(input) {
    try {
      const metadata = await sharp(input).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        exif: metadata.exif,
        icc: metadata.icc,
        size: metadata.size
      };

    } catch (error) {
      console.error('Failed to extract metadata:', error.message);
      throw error;
    }
  }

  /**
   * Get file size in bytes
   * @param {string|Buffer} input - File path or buffer
   * @returns {number}
   */
  getFileSize(input) {
    if (Buffer.isBuffer(input)) {
      return input.length;
    }

    if (typeof input === 'string' && fs.existsSync(input)) {
      const stats = fs.statSync(input);
      return stats.size;
    }

    return 0;
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate image format
   * @param {string} format - Format to validate
   * @returns {boolean}
   */
  isValidFormat(format) {
    return this.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Validate variant type
   * @param {string} variantType - Variant type to validate
   * @returns {boolean}
   */
  isValidVariant(variantType) {
    return Object.keys(this.variantSpecs).includes(variantType);
  }

  /**
   * Get variant specifications
   * @param {string} variantType - Variant type
   * @returns {object}
   */
  getVariantSpec(variantType) {
    if (!this.isValidVariant(variantType)) {
      throw new Error(`Invalid variant type: ${variantType}`);
    }

    return this.variantSpecs[variantType];
  }

  /**
   * Calculate aspect ratio
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @returns {number}
   */
  calculateAspectRatio(width, height) {
    return width / height;
  }

  /**
   * Check if image meets minimum dimensions
   * @param {object} metadata - Image metadata
   * @param {number} minWidth - Minimum width
   * @param {number} minHeight - Minimum height
   * @returns {boolean}
   */
  meetsMinimumDimensions(metadata, minWidth, minHeight) {
    return metadata.width >= minWidth && metadata.height >= minHeight;
  }

  /**
   * Validate image for variant generation
   * @param {string|Buffer} input - File path or buffer
   * @param {string} variantType - Target variant type
   * @returns {Promise<{valid: boolean, errors: Array}>}
   */
  async validateForVariant(input, variantType) {
    const errors = [];

    try {
      // Get metadata
      const metadata = await this.getImageMetadata(input);

      // Check format
      if (!this.isValidFormat(metadata.format)) {
        errors.push(`Unsupported format: ${metadata.format}`);
      }

      // Get variant spec
      const spec = this.getVariantSpec(variantType);

      // Check dimensions (source should be at least as large as target)
      if (metadata.width < spec.width) {
        errors.push(`Width too small: ${metadata.width}px (requires ${spec.width}px)`);
      }

      if (metadata.height < spec.height) {
        errors.push(`Height too small: ${metadata.height}px (requires ${spec.height}px)`);
      }

      // Check file size (not empty)
      const fileSize = this.getFileSize(input);
      if (fileSize === 0) {
        errors.push('File is empty');
      }

      return {
        valid: errors.length === 0,
        errors,
        metadata
      };

    } catch (error) {
      errors.push(`Validation failed: ${error.message}`);
      return {
        valid: false,
        errors
      };
    }
  }

  /**
   * Extract EXIF data from image
   * @param {string|Buffer} input - File path or buffer
   * @returns {Promise<object>}
   */
  async extractExif(input) {
    try {
      const metadata = await sharp(input).metadata();

      if (!metadata.exif) {
        return null;
      }

      // Parse EXIF buffer (simplified)
      return {
        raw: metadata.exif,
        hasExif: true
      };

    } catch (error) {
      console.error('Failed to extract EXIF:', error.message);
      return null;
    }
  }

  /**
   * Generate image filename
   * @param {number} imageNumber - Image number (1-342)
   * @param {string} variantType - Variant type
   * @param {string} format - Format
   * @returns {string}
   */
  generateFilename(imageNumber, variantType, format) {
    const paddedNumber = String(imageNumber).padStart(3, '0');

    if (variantType) {
      return `elec-${paddedNumber}-${variantType}.${format}`;
    }

    return `elec-${paddedNumber}.${format}`;
  }

  /**
   * Parse filename to extract components
   * @param {string} filename - Filename to parse
   * @returns {object|null}
   */
  parseFilename(filename) {
    // Pattern: elec-001-hero.jpg or elec-001.jpg
    const withVariant = /^elec-(\d{3})-(\w+)\.(jpg|webp|avif|png)$/;
    const withoutVariant = /^elec-(\d{3})\.(jpg|png)$/;

    let match = filename.match(withVariant);
    if (match) {
      return {
        imageNumber: parseInt(match[1], 10),
        variantType: match[2],
        format: match[3]
      };
    }

    match = filename.match(withoutVariant);
    if (match) {
      return {
        imageNumber: parseInt(match[1], 10),
        variantType: null,
        format: match[2]
      };
    }

    return null;
  }

  /**
   * Get image quality based on format and variant
   * @param {string} format - Image format
   * @param {string} variantType - Variant type
   * @returns {number}
   */
  getQualityForFormat(format, variantType) {
    const qualitySettings = {
      jpg: 85,
      webp: 85,
      avif: 80,
      png: 100
    };

    return qualitySettings[format] || 85;
  }

  /**
   * Get Sharp options for format
   * @param {string} format - Image format
   * @param {string} variantType - Variant type
   * @returns {object}
   */
  getFormatOptions(format, variantType) {
    const quality = this.getQualityForFormat(format, variantType);

    const options = {
      jpg: {
        quality,
        progressive: true,
        mozjpeg: true
      },
      webp: {
        quality,
        effort: 6,
        smartSubsample: true
      },
      avif: {
        quality,
        effort: 6,
        chromaSubsampling: '4:2:0'
      },
      png: {
        quality,
        compressionLevel: 9,
        adaptiveFiltering: true
      }
    };

    return options[format] || {};
  }

  /**
   * Compare two images by size
   * @param {Buffer} buffer1 - First image buffer
   * @param {Buffer} buffer2 - Second image buffer
   * @returns {object}
   */
  compareImageSizes(buffer1, buffer2) {
    const size1 = buffer1.length;
    const size2 = buffer2.length;

    return {
      size1,
      size2,
      difference: size2 - size1,
      percentChange: ((size2 - size1) / size1) * 100,
      isSmaller: size2 < size1
    };
  }

  /**
   * Estimate variant file size
   * @param {number} sourceSize - Source file size in bytes
   * @param {string} variantType - Variant type
   * @param {string} format - Output format
   * @returns {number}
   */
  estimateVariantSize(sourceSize, variantType, format) {
    const spec = this.getVariantSpec(variantType);

    // Assume source is ~5MB at 1920x1080
    const baseWidth = 1920;
    const baseHeight = 1080;
    const basePixels = baseWidth * baseHeight;
    const variantPixels = spec.width * spec.height;

    // Scale proportionally to pixel count
    const pixelRatio = variantPixels / basePixels;

    // Format compression factors
    const compressionFactors = {
      jpg: 1.0,
      webp: 0.7,   // WebP is ~30% smaller
      avif: 0.5    // AVIF is ~50% smaller
    };

    const compressionFactor = compressionFactors[format] || 1.0;

    return Math.round(sourceSize * pixelRatio * compressionFactor);
  }

  /**
   * Batch validate images
   * @param {Array<string>} filePaths - Array of file paths
   * @param {string} variantType - Target variant type
   * @returns {Promise<object>}
   */
  async batchValidate(filePaths, variantType) {
    const results = {
      valid: [],
      invalid: [],
      total: filePaths.length
    };

    for (const filePath of filePaths) {
      const validation = await this.validateForVariant(filePath, variantType);

      if (validation.valid) {
        results.valid.push({
          path: filePath,
          metadata: validation.metadata
        });
      } else {
        results.invalid.push({
          path: filePath,
          errors: validation.errors
        });
      }
    }

    return results;
  }

  /**
   * Get image dominant color (simplified)
   * @param {string|Buffer} input - File path or buffer
   * @returns {Promise<object>}
   */
  async getDominantColor(input) {
    try {
      const { dominant } = await sharp(input)
        .resize(1, 1, { fit: 'cover' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const [r, g, b] = dominant.data;

      return {
        rgb: { r, g, b },
        hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      };

    } catch (error) {
      console.error('Failed to extract dominant color:', error.message);
      return null;
    }
  }

  /**
   * Calculate compression savings
   * @param {number} originalSize - Original file size
   * @param {number} compressedSize - Compressed file size
   * @returns {object}
   */
  calculateCompressionSavings(originalSize, compressedSize) {
    const saved = originalSize - compressedSize;
    const percentSaved = (saved / originalSize) * 100;

    return {
      originalSize,
      compressedSize,
      saved,
      percentSaved: percentSaved.toFixed(2),
      formatted: {
        original: this.formatFileSize(originalSize),
        compressed: this.formatFileSize(compressedSize),
        saved: this.formatFileSize(saved)
      }
    };
  }
}

// Export singleton instance
export const imageHelper = new ImageHelper();
export default imageHelper;
