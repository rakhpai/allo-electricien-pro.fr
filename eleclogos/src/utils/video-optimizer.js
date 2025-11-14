import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs/promises';
import logger from './logger.js';
import { generateCompressedFilename, generateFormatFilename } from './seo-filename.js';

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Video Optimizer Utility
 * Compress and convert videos to multiple formats using FFmpeg
 */

/**
 * Get video metadata using FFmpeg
 * @param {string} inputPath - Path to video file
 * @returns {Promise<Object>} - Video metadata
 */
export async function getVideoMetadata(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        logger.error('Failed to get video metadata', {
          inputPath,
          error: err.message,
        });
        reject(err);
      } else {
        logger.debug('Video metadata retrieved', {
          inputPath,
          format: metadata.format.format_name,
          duration: metadata.format.duration,
          size: metadata.format.size,
        });
        resolve(metadata);
      }
    });
  });
}

/**
 * Compress video to MP4 format optimized for web
 * Target: ~5MB, maintain 1080x1080 resolution
 *
 * @param {string} inputPath - Path to original video
 * @param {string} outputPath - Path for compressed output (optional)
 * @returns {Promise<Object>} - Compression result
 */
export async function compressVideo(inputPath, outputPath = null) {
  try {
    logger.info('Compressing video', { inputPath });

    // Generate output path if not provided
    if (!outputPath) {
      const inputParts = inputPath.split(/[\\/]/);
      const filename = inputParts.pop();
      const directory = inputParts.join('/');
      const compressedFilename = generateCompressedFilename(filename);
      outputPath = `${directory}/${compressedFilename}`;
    }

    // Get original file size
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    logger.debug('Starting compression', {
      inputPath,
      outputPath,
      originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
    });

    // Compress video
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        // Video codec: H.264 with CRF 28 (good quality/size balance)
        .videoCodec('libx264')
        .addOption('-crf', '28')
        .addOption('-preset', 'medium')
        // Audio codec: AAC at 128k bitrate
        .audioCodec('aac')
        .audioBitrate('128k')
        // Optimize for web streaming
        .addOption('-movflags', '+faststart')
        // Keep original resolution (1080x1080)
        .size('1080x1080')
        // Output format
        .format('mp4')
        // Save to output path
        .save(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command', { commandLine });
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.debug('Compression progress', {
              percent: progress.percent.toFixed(2) + '%',
              currentKbps: progress.currentKbps,
            });
          }
        })
        .on('end', () => {
          logger.info('Video compression completed', { outputPath });
          resolve();
        })
        .on('error', (err) => {
          logger.error('Video compression failed', {
            inputPath,
            outputPath,
            error: err.message,
          });
          reject(err);
        });
    });

    // Get compressed file size
    const compressedStats = await fs.stat(outputPath);
    const compressedSize = compressedStats.size;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    logger.info('Compression successful', {
      outputPath,
      originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (compressedSize / 1024 / 1024).toFixed(2) + ' MB',
      saved: compressionRatio + '%',
    });

    return {
      success: true,
      inputPath,
      outputPath,
      originalSize,
      compressedSize,
      compressionRatio: parseFloat(compressionRatio),
    };

  } catch (error) {
    logger.error('Failed to compress video', {
      inputPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Convert video to WebM format
 * Optimized for web with VP9 codec
 *
 * @param {string} inputPath - Path to original video
 * @param {string} outputPath - Path for WebM output (optional)
 * @returns {Promise<Object>} - Conversion result
 */
export async function convertToWebM(inputPath, outputPath = null) {
  try {
    logger.info('Converting to WebM', { inputPath });

    // Generate output path if not provided
    if (!outputPath) {
      const inputParts = inputPath.split(/[\\/]/);
      const filename = inputParts.pop();
      const directory = inputParts.join('/');
      const webmFilename = generateFormatFilename(filename, 'webm');
      outputPath = `${directory}/${webmFilename}`;
    }

    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    logger.debug('Starting WebM conversion', {
      inputPath,
      outputPath,
      originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
    });

    // Convert to WebM
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        // Video codec: VP9 with CRF 35 (optimized for web)
        .videoCodec('libvpx-vp9')
        .addOption('-crf', '35')
        .addOption('-b:v', '0') // Variable bitrate
        // Audio codec: Opus at 128k bitrate
        .audioCodec('libopus')
        .audioBitrate('128k')
        // Keep original resolution
        .size('1080x1080')
        // Output format
        .format('webm')
        // Save to output path
        .save(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command', { commandLine });
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.debug('WebM conversion progress', {
              percent: progress.percent.toFixed(2) + '%',
            });
          }
        })
        .on('end', () => {
          logger.info('WebM conversion completed', { outputPath });
          resolve();
        })
        .on('error', (err) => {
          logger.error('WebM conversion failed', {
            inputPath,
            outputPath,
            error: err.message,
          });
          reject(err);
        });
    });

    // Get WebM file size
    const webmStats = await fs.stat(outputPath);
    const webmSize = webmStats.size;

    logger.info('WebM conversion successful', {
      outputPath,
      originalSize: (originalSize / 1024 / 1024).toFixed(2) + ' MB',
      webmSize: (webmSize / 1024 / 1024).toFixed(2) + ' MB',
    });

    return {
      success: true,
      inputPath,
      outputPath,
      originalSize,
      webmSize,
    };

  } catch (error) {
    logger.error('Failed to convert to WebM', {
      inputPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Process video: compress and generate all formats
 * @param {string} originalPath - Path to original downloaded video
 * @returns {Promise<Object>} - Processing result with all file paths and sizes
 */
export async function processVideo(originalPath) {
  try {
    logger.info('Processing video (compress + WebM)', { originalPath });

    const startTime = Date.now();

    // Get original metadata
    const metadata = await getVideoMetadata(originalPath);
    const originalStats = await fs.stat(originalPath);

    // Compress to MP4
    const compressResult = await compressVideo(originalPath);

    // Convert to WebM
    const webmResult = await convertToWebM(originalPath);

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('Video processing completed', {
      originalPath,
      processingTime: processingTime + 's',
      formats: {
        original: compressResult.originalSize,
        compressed: compressResult.compressedSize,
        webm: webmResult.webmSize,
      },
    });

    return {
      success: true,
      originalPath,
      compressedPath: compressResult.outputPath,
      webmPath: webmResult.outputPath,
      metadata: {
        duration: metadata.format.duration,
        width: metadata.streams[0]?.width,
        height: metadata.streams[0]?.height,
      },
      sizes: {
        original: originalStats.size,
        compressed: compressResult.compressedSize,
        webm: webmResult.webmSize,
      },
      processingTime: parseFloat(processingTime),
    };

  } catch (error) {
    logger.error('Video processing failed', {
      originalPath,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Batch process multiple videos
 * @param {Array<string>} videoPaths - Array of video file paths
 * @param {number} concurrency - Number of concurrent processes (default: 2)
 * @returns {Promise<Array>} - Array of processing results
 */
export async function batchProcessVideos(videoPaths, concurrency = 2) {
  logger.info('Starting batch video processing', {
    totalVideos: videoPaths.length,
    concurrency,
  });

  const results = [];
  const queue = [...videoPaths];

  // Process in batches
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(path => processVideo(path))
    );

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push({ success: true, ...result.value });
      } else {
        results.push({
          success: false,
          path: batch[index],
          error: result.reason.message,
        });
      }
    });

    logger.info('Batch processed', {
      processed: results.length,
      total: videoPaths.length,
      remaining: queue.length,
    });
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logger.info('Batch processing completed', {
    total: videoPaths.length,
    success: successCount,
    failed: failCount,
  });

  return results;
}

export default {
  getVideoMetadata,
  compressVideo,
  convertToWebM,
  processVideo,
  batchProcessVideos,
};
