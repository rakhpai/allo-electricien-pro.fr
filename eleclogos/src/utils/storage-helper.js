/**
 * Supabase Storage Helper
 * Utilities for uploading, downloading, and managing files in Supabase Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseService } from '../services/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StorageHelper {
  constructor() {
    this.client = supabaseService.client;
    this.buckets = {
      source: 'source-images',
      processed: 'processed-images'
    };
  }

  /**
   * Upload file to Supabase Storage
   * @param {string} bucket - Bucket name
   * @param {string} storagePath - Path within bucket
   * @param {Buffer|string} file - File buffer or local file path
   * @param {object} options - Upload options
   * @returns {Promise<{url: string, path: string}>}
   */
  async uploadFile(bucket, storagePath, file, options = {}) {
    try {
      // If file is a string, read it as a file path
      let fileBuffer = file;
      let contentType = options.contentType;

      if (typeof file === 'string') {
        fileBuffer = fs.readFileSync(file);

        // Auto-detect content type if not provided
        if (!contentType) {
          contentType = this.getContentType(file);
        }
      }

      // Default options
      const uploadOptions = {
        contentType: contentType || 'application/octet-stream',
        cacheControl: options.cacheControl || '31536000', // 1 year
        upsert: options.upsert !== undefined ? options.upsert : false
      };

      // Upload to Supabase
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, uploadOptions);

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const publicUrl = this.getPublicUrl(bucket, storagePath);

      return {
        path: data.path,
        url: publicUrl,
        size: fileBuffer.length
      };

    } catch (error) {
      console.error(`Failed to upload to ${bucket}/${storagePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload multiple files in batch
   * @param {string} bucket - Bucket name
   * @param {Array<{path: string, file: Buffer|string}>} files - Array of files to upload
   * @param {object} options - Upload options
   * @returns {Promise<Array>}
   */
  async uploadBatch(bucket, files, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 5;

    console.log(`Uploading ${files.length} files to ${bucket} with concurrency ${concurrency}...`);

    // Process in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);

      const batchPromises = batch.map(async ({ path: storagePath, file, contentType }) => {
        try {
          const result = await this.uploadFile(bucket, storagePath, file, {
            ...options,
            contentType
          });

          console.log(`  ✓ Uploaded: ${storagePath}`);

          return {
            success: true,
            path: storagePath,
            ...result
          };
        } catch (error) {
          console.error(`  ✗ Failed: ${storagePath} - ${error.message}`);
          return {
            success: false,
            path: storagePath,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Progress update
      console.log(`Progress: ${Math.min(i + concurrency, files.length)}/${files.length}`);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\nUpload complete: ${successful} succeeded, ${failed} failed`);

    return results;
  }

  /**
   * Download file from Supabase Storage
   * @param {string} bucket - Bucket name
   * @param {string} storagePath - Path within bucket
   * @returns {Promise<Buffer>}
   */
  async downloadFile(bucket, storagePath) {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .download(storagePath);

      if (error) {
        throw new Error(`Download failed: ${error.message}`);
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.error(`Failed to download from ${bucket}/${storagePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if file exists in storage
   * @param {string} bucket - Bucket name
   * @param {string} storagePath - Path within bucket
   * @returns {Promise<boolean>}
   */
  async fileExists(bucket, storagePath) {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(path.dirname(storagePath), {
          limit: 1,
          offset: 0,
          search: path.basename(storagePath)
        });

      if (error) {
        return false;
      }

      return data && data.length > 0;

    } catch (error) {
      return false;
    }
  }

  /**
   * Get public URL for a file
   * @param {string} bucket - Bucket name
   * @param {string} storagePath - Path within bucket
   * @returns {string}
   */
  getPublicUrl(bucket, storagePath) {
    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  /**
   * Delete file from storage
   * @param {string} bucket - Bucket name
   * @param {string} storagePath - Path within bucket
   * @returns {Promise<void>}
   */
  async deleteFile(bucket, storagePath) {
    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([storagePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log(`Deleted: ${bucket}/${storagePath}`);

    } catch (error) {
      console.error(`Failed to delete ${bucket}/${storagePath}:`, error.message);
      throw error;
    }
  }

  /**
   * List files in a bucket path
   * @param {string} bucket - Bucket name
   * @param {string} folder - Folder path
   * @param {object} options - List options
   * @returns {Promise<Array>}
   */
  async listFiles(bucket, folder = '', options = {}) {
    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .list(folder, {
          limit: options.limit || 1000,
          offset: options.offset || 0,
          sortBy: { column: options.sortBy || 'name', order: options.order || 'asc' }
        });

      if (error) {
        throw new Error(`List failed: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error(`Failed to list files in ${bucket}/${folder}:`, error.message);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} bucket - Bucket name
   * @param {string} storagePath - Path within bucket
   * @returns {Promise<object>}
   */
  async getFileMetadata(bucket, storagePath) {
    try {
      const files = await this.listFiles(bucket, path.dirname(storagePath));
      const file = files.find(f => f.name === path.basename(storagePath));

      if (!file) {
        throw new Error('File not found');
      }

      return {
        name: file.name,
        id: file.id,
        size: file.metadata?.size,
        mimetype: file.metadata?.mimetype,
        lastModified: file.metadata?.lastModified,
        created_at: file.created_at,
        updated_at: file.updated_at
      };

    } catch (error) {
      console.error(`Failed to get metadata for ${bucket}/${storagePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Create bucket if it doesn't exist
   * @param {string} bucketName - Bucket name
   * @param {object} options - Bucket options
   * @returns {Promise<void>}
   */
  async createBucket(bucketName, options = {}) {
    try {
      const { data, error } = await this.client.storage.createBucket(bucketName, {
        public: options.public !== undefined ? options.public : false,
        fileSizeLimit: options.fileSizeLimit,
        allowedMimeTypes: options.allowedMimeTypes
      });

      if (error) {
        // Bucket might already exist
        if (error.message.includes('already exists')) {
          console.log(`Bucket '${bucketName}' already exists`);
          return;
        }
        throw error;
      }

      console.log(`Created bucket: ${bucketName}`);

    } catch (error) {
      console.error(`Failed to create bucket ${bucketName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get content type from file extension
   * @param {string} filePath - File path
   * @returns {string}
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate storage path for image variant
   * @param {string} siteDomain - Site domain
   * @param {string} variantType - Variant type (hero, og, featured, video)
   * @param {number} imageNumber - Image number (1-342)
   * @param {string} format - Format (jpg, webp, avif)
   * @returns {string}
   */
  getVariantStoragePath(siteDomain, variantType, imageNumber, format) {
    const paddedNumber = String(imageNumber).padStart(3, '0');
    const filename = `elec-${paddedNumber}-${variantType}.${format}`;
    return `${siteDomain}/${variantType}/${filename}`;
  }

  /**
   * Generate storage path for source image
   * @param {number} imageNumber - Image number (1-342)
   * @param {string} format - Format (jpg, png)
   * @returns {string}
   */
  getSourceStoragePath(imageNumber, format = 'jpg') {
    const paddedNumber = String(imageNumber).padStart(3, '0');
    return `electrician/elec-${paddedNumber}.${format}`;
  }

  /**
   * Get storage usage for a bucket
   * @param {string} bucket - Bucket name
   * @returns {Promise<{files: number, bytes: number, mb: number, gb: number}>}
   */
  async getStorageUsage(bucket) {
    try {
      // Note: This requires listing all files, which can be slow for large buckets
      // Consider using database aggregation instead for better performance
      const allFiles = await this.listAllFiles(bucket);

      const totalBytes = allFiles.reduce((sum, file) => {
        return sum + (file.metadata?.size || 0);
      }, 0);

      return {
        files: allFiles.length,
        bytes: totalBytes,
        mb: totalBytes / 1024 / 1024,
        gb: totalBytes / 1024 / 1024 / 1024
      };

    } catch (error) {
      console.error(`Failed to get storage usage for ${bucket}:`, error.message);
      throw error;
    }
  }

  /**
   * List all files in a bucket (handles pagination)
   * @param {string} bucket - Bucket name
   * @param {string} folder - Folder path
   * @returns {Promise<Array>}
   */
  async listAllFiles(bucket, folder = '') {
    const allFiles = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const files = await this.listFiles(bucket, folder, { limit, offset });
      allFiles.push(...files);

      if (files.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return allFiles;
  }

  /**
   * Copy file within or between buckets
   * @param {string} sourceBucket - Source bucket
   * @param {string} sourcePath - Source path
   * @param {string} destBucket - Destination bucket
   * @param {string} destPath - Destination path
   * @returns {Promise<void>}
   */
  async copyFile(sourceBucket, sourcePath, destBucket, destPath) {
    try {
      // Download from source
      const buffer = await this.downloadFile(sourceBucket, sourcePath);

      // Get content type from source
      const contentType = this.getContentType(sourcePath);

      // Upload to destination
      await this.uploadFile(destBucket, destPath, buffer, { contentType });

      console.log(`Copied: ${sourceBucket}/${sourcePath} → ${destBucket}/${destPath}`);

    } catch (error) {
      console.error(`Failed to copy file:`, error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const storageHelper = new StorageHelper();
export default storageHelper;
