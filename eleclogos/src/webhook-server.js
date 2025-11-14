import express from 'express';
import config from './config/index.js';
import logger from './utils/logger.js';
import supabaseService from './services/supabase.js';
import { downloadCommuneVideo } from './utils/video-downloader.js';
import { processVideo } from './utils/video-optimizer.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

/**
 * Download and optimize video pipeline
 * Runs in background after video rendering completes
 * @param {Object} video - Video record from database
 */
async function downloadAndOptimizeVideo(video) {
  try {
    logger.info('Starting download and optimization pipeline', {
      videoId: video.id,
      commune: video.commune_name,
    });

    // Update processing status to downloading
    await supabaseService.updateProcessingStatus(video.id, 'downloading');

    // Prepare commune data for file path generation
    const communeData = {
      name: video.commune_name,
      code: video.commune_code,
      department: video.commune_code.substring(0, 2), // Extract dept from code
      population: video.commune_population,
    };

    // Download video from Creatomate CDN
    const downloadResult = await downloadCommuneVideo(
      video,
      communeData,
      'videos-downloaded'
    );

    logger.info('Video downloaded successfully', {
      videoId: video.id,
      path: downloadResult.downloadedFile,
      size: (downloadResult.fileSize / 1024 / 1024).toFixed(2) + ' MB',
    });

    // Update processing status to optimizing
    await supabaseService.updateProcessingStatus(video.id, 'optimizing');

    // Optimize video (compress + WebM conversion)
    const optimizationResult = await processVideo(downloadResult.downloadedFile);

    logger.info('Video optimization completed', {
      videoId: video.id,
      formats: {
        original: (optimizationResult.sizes.original / 1024 / 1024).toFixed(2) + ' MB',
        compressed: (optimizationResult.sizes.compressed / 1024 / 1024).toFixed(2) + ' MB',
        webm: (optimizationResult.sizes.webm / 1024 / 1024).toFixed(2) + ' MB',
      },
    });

    // Update database with all file information
    await supabaseService.markVideoDownloaded(video.id, {
      seo_filename: downloadResult.seoFilename,
      local_filename: downloadResult.seoFilename,
      local_storage_path: downloadResult.filePaths.directory,
      file_size_original: optimizationResult.sizes.original,
      file_size_compressed: optimizationResult.sizes.compressed,
      video_formats: {
        original: optimizationResult.originalPath,
        compressed: optimizationResult.compressedPath,
        webm: optimizationResult.webmPath,
      },
    });

    logger.info('Video processing pipeline completed successfully', {
      videoId: video.id,
      commune: video.commune_name,
    });

  } catch (error) {
    logger.error('Download and optimization pipeline failed', {
      videoId: video.id,
      commune: video.commune_name,
      error: error.message,
      stack: error.stack,
    });

    // Mark as failed in database
    await supabaseService.updateProcessingStatus(video.id, 'failed');
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Video Generation Webhook Server',
  });
});

/**
 * Webhook endpoint for Creatomate render completion
 * This endpoint receives notifications when videos are rendered
 */
app.post('/webhook', async (req, res) => {
  try {
    const renderData = req.body;

    logger.info('Received webhook from Creatomate', {
      renderId: renderData.id,
      status: renderData.status,
    });

    // Verify webhook authenticity (if secret is configured)
    if (config.webhook.secret) {
      const signature = req.get('x-creatomate-signature');
      // TODO: Implement signature verification if needed
      // For now, we'll trust the webhook
    }

    // Find the video record by render_id
    const video = await supabaseService.getVideoByRenderId(renderData.id);

    if (!video) {
      logger.warn('No video found for render ID', { renderId: renderData.id });
      // Still return 200 to acknowledge receipt
      return res.json({ received: true, warning: 'Video not found' });
    }

    // Update video based on render status
    if (renderData.status === 'succeeded') {
      await supabaseService.markCompleted(video.id, renderData.url, {
        duration: renderData.duration,
        credits_used: renderData.credits_used || null,
      });

      logger.info('Video marked as completed', {
        videoId: video.id,
        commune: video.commune_name,
        url: renderData.url,
      });

      // Trigger download and optimization pipeline in background
      // Don't await - let webhook respond immediately
      downloadAndOptimizeVideo(video).catch(err => {
        logger.error('Background pipeline error', {
          videoId: video.id,
          error: err.message,
        });
      });

      logger.info('Download and optimization pipeline triggered', {
        videoId: video.id,
        commune: video.commune_name,
      });
    } else if (renderData.status === 'failed') {
      await supabaseService.markFailed(
        video.id,
        renderData.error_message || 'Render failed'
      );

      logger.error('Video marked as failed', {
        videoId: video.id,
        commune: video.commune_name,
        error: renderData.error_message,
      });
    } else if (renderData.status === 'processing') {
      await supabaseService.updateStatus(video.id, 'processing');

      logger.info('Video marked as processing', {
        videoId: video.id,
        commune: video.commune_name,
      });
    }

    // Acknowledge receipt
    res.json({
      received: true,
      videoId: video.id,
      status: renderData.status,
    });
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error.message,
      body: req.body,
    });

    // Still return 200 to prevent Creatomate from retrying
    res.json({ received: true, error: error.message });
  }
});

/**
 * Get all videos (for debugging)
 */
app.get('/videos', async (req, res) => {
  try {
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 100;

    let videos;
    if (status) {
      videos = await supabaseService.getVideosByStatus(status, limit);
    } else {
      // Get all videos (implement if needed)
      videos = await supabaseService.getVideosByStatus('completed', limit);
    }

    res.json({
      count: videos.length,
      videos,
    });
  } catch (error) {
    logger.error('Failed to fetch videos', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get video by ID
 */
app.get('/videos/:id', async (req, res) => {
  try {
    const video = await supabaseService.getVideoById(req.params.id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    logger.error('Failed to fetch video', {
      error: error.message,
      videoId: req.params.id,
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get statistics
 */
app.get('/stats', async (req, res) => {
  try {
    const counts = await supabaseService.getStatusCounts();
    const statistics = await supabaseService.getStatistics();

    res.json({
      counts,
      statistics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch statistics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get download statistics
 */
app.get('/stats/downloads', async (req, res) => {
  try {
    const downloadStats = await supabaseService.getDownloadStats();

    res.json({
      ...downloadStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch download statistics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test endpoint to manually trigger video processing
 */
app.post('/test/create-video', async (req, res) => {
  try {
    const { commune_name, commune_code, commune_population } = req.body;

    if (!commune_name || !commune_code) {
      return res.status(400).json({
        error: 'Missing required fields: commune_name, commune_code',
      });
    }

    // This is a simplified test endpoint
    // In production, use the proper batch processor or on-demand API

    res.json({
      message: 'Use the batch processor or on-demand API for video creation',
      received: { commune_name, commune_code, commune_population },
    });
  } catch (error) {
    logger.error('Test endpoint error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  logger.error('Express error handler', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

/**
 * Start server
 */
const PORT = config.webhook.port;

app.listen(PORT, () => {
  logger.info(`Webhook server started on port ${PORT}`, {
    env: config.app.env,
    webhookUrl: config.webhook.url,
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
