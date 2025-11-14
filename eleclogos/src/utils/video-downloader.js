import axios from 'axios';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import logger from './logger.js';
import { generateFilePaths } from './seo-filename.js';

/**
 * Video Downloader Utility
 * Downloads videos from Creatomate CDN and saves them locally with SEO filenames
 */

/**
 * Ensure directory exists, create if not
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug('Directory ensured', { dirPath });
  } catch (error) {
    logger.error('Failed to create directory', { dirPath, error: error.message });
    throw error;
  }
}

/**
 * Download video from URL to local file with retry logic
 * @param {string} url - Video URL (Creatomate CDN)
 * @param {string} outputPath - Local file path to save
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} - Download metadata
 */
export async function downloadVideo(url, outputPath, maxRetries = 3) {
  let attempt = 0;
  let lastError;

  while (attempt < maxRetries) {
    attempt++;

    try {
      logger.info('Downloading video', {
        url,
        outputPath,
        attempt,
        maxRetries,
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await ensureDirectory(outputDir);

      // Stream download to file
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000, // 60 second timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB max
      });

      // Get file size from headers
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      // Create write stream
      const writer = createWriteStream(outputPath);

      // Track progress
      response.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = ((downloadedSize / totalSize) * 100).toFixed(2);

        // Log progress every 10%
        if (downloadedSize % (totalSize / 10) < chunk.length) {
          logger.debug('Download progress', { progress: `${progress}%`, downloadedSize, totalSize });
        }
      });

      // Pipe response to file
      response.data.pipe(writer);

      // Wait for download to complete
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      // Verify file exists and has content
      const stats = await fs.stat(outputPath);

      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      if (totalSize && stats.size !== totalSize) {
        logger.warn('File size mismatch', {
          expected: totalSize,
          actual: stats.size,
          outputPath,
        });
      }

      logger.info('Video downloaded successfully', {
        outputPath,
        size: stats.size,
        sizeFormatted: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
      });

      return {
        success: true,
        path: outputPath,
        size: stats.size,
        contentLength: totalSize,
      };

    } catch (error) {
      lastError = error;

      logger.warn('Download attempt failed', {
        attempt,
        maxRetries,
        error: error.message,
        url,
      });

      // Clean up partial file
      try {
        await fs.unlink(outputPath);
      } catch (unlinkError) {
        // Ignore if file doesn't exist
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.debug('Waiting before retry', { waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  logger.error('Video download failed after all retries', {
    url,
    outputPath,
    maxRetries,
    error: lastError?.message,
  });

  throw new Error(`Failed to download video after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Download video for a commune with automatic path generation
 * @param {Object} videoData - Video record from database
 * @param {Object} communeData - Commune information
 * @param {string} baseDir - Base directory for downloads
 * @returns {Promise<Object>} - Download result with file paths
 */
export async function downloadCommuneVideo(videoData, communeData, baseDir = 'videos-downloaded') {
  try {
    logger.info('Downloading commune video', {
      commune: communeData.name,
      videoId: videoData.id,
      videoUrl: videoData.video_url,
    });

    // Validate video URL
    if (!videoData.video_url) {
      throw new Error('Video URL not available (video may not be rendered yet)');
    }

    // Generate file paths
    const filePaths = generateFilePaths(communeData, baseDir);

    logger.debug('Generated file paths', { filePaths });

    // Download original video
    const downloadResult = await downloadVideo(
      videoData.video_url,
      filePaths.original,
      3 // max retries
    );

    logger.info('Commune video downloaded', {
      commune: communeData.name,
      path: filePaths.original,
      size: downloadResult.size,
    });

    return {
      success: true,
      videoId: videoData.id,
      commune: communeData.name,
      filePaths: filePaths,
      downloadedFile: filePaths.original,
      fileSize: downloadResult.size,
      seoFilename: filePaths.seoFilename,
    };

  } catch (error) {
    logger.error('Failed to download commune video', {
      commune: communeData.name,
      videoId: videoData.id,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

/**
 * Check if video file exists locally
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} - True if file exists and is not empty
 */
export async function videoExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get local file size
 * @param {string} filePath - Path to file
 * @returns {Promise<number|null>} - File size in bytes or null if not found
 */
export async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    return null;
  }
}

/**
 * Delete video file
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} - True if deleted
 */
export async function deleteVideo(filePath) {
  try {
    await fs.unlink(filePath);
    logger.info('Video file deleted', { filePath });
    return true;
  } catch (error) {
    logger.warn('Failed to delete video file', {
      filePath,
      error: error.message,
    });
    return false;
  }
}

export default {
  downloadVideo,
  downloadCommuneVideo,
  videoExists,
  getFileSize,
  deleteVideo,
};
