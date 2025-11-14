import config from '../config/index.js';
import logger from './logger.js';

/**
 * Rate-limited queue for processing tasks
 * Respects Creatomate's rate limit of 30 requests per 10 seconds
 */
class RateLimitedQueue {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || config.rateLimit.requests;
    this.windowMs = options.windowMs || config.rateLimit.windowMs;
    this.queue = [];
    this.processing = false;
    this.requestTimestamps = [];
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      startTime: null,
    };
  }

  /**
   * Add a task to the queue
   * @param {Function} task - Async function to execute
   * @param {Object} metadata - Task metadata for logging
   * @returns {Promise} - Promise that resolves when task completes
   */
  add(task, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        metadata,
        resolve,
        reject,
      });

      if (!this.processing) {
        this.start();
      }
    });
  }

  /**
   * Start processing the queue
   */
  async start() {
    if (this.processing) return;

    this.processing = true;
    this.stats.startTime = Date.now();

    logger.info('Queue processing started', {
      queueSize: this.queue.length,
      rateLimit: `${this.maxRequests} requests per ${this.windowMs}ms`,
    });

    while (this.queue.length > 0) {
      await this.processNext();
    }

    this.processing = false;

    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);
    logger.info('Queue processing completed', {
      ...this.stats,
      duration: `${duration}s`,
      averageRate: `${(this.stats.totalProcessed / (duration / 60)).toFixed(2)} per minute`,
    });
  }

  /**
   * Process the next task in the queue
   */
  async processNext() {
    if (this.queue.length === 0) return;

    // Wait if we've hit the rate limit
    await this.waitForRateLimit();

    const item = this.queue.shift();

    try {
      logger.debug('Processing queue item', {
        metadata: item.metadata,
        remaining: this.queue.length,
      });

      // Record request timestamp
      this.requestTimestamps.push(Date.now());

      // Execute the task
      const result = await item.task();

      this.stats.totalProcessed++;
      this.stats.successful++;

      item.resolve(result);

      logger.debug('Queue item completed', {
        metadata: item.metadata,
        remaining: this.queue.length,
      });
    } catch (error) {
      this.stats.totalProcessed++;
      this.stats.failed++;

      logger.error('Queue item failed', {
        metadata: item.metadata,
        error: error.message,
      });

      item.reject(error);
    }
  }

  /**
   * Wait if rate limit would be exceeded
   */
  async waitForRateLimit() {
    const now = Date.now();

    // Remove timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    // If we're at the limit, wait for the oldest request to expire
    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp);

      if (waitTime > 0) {
        logger.debug('Rate limit reached, waiting', {
          waitTimeMs: waitTime,
          currentRequests: this.requestTimestamps.length,
        });

        await this.sleep(waitTime + 100); // Add 100ms buffer
      }
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   * @returns {Object} - Current statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      processing: this.processing,
      requestsInWindow: this.requestTimestamps.length,
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    logger.warn('Clearing queue', { itemsRemoved: this.queue.length });

    this.queue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });

    this.queue = [];
  }

  /**
   * Get queue size
   * @returns {number} - Number of items in queue
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.queue.length === 0;
  }
}

/**
 * Retry wrapper for tasks
 * @param {Function} task - Task to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Task result
 */
export async function retryTask(task, options = {}) {
  const {
    maxAttempts = config.batch.retryAttempts,
    delayMs = config.batch.retryDelayMs,
    exponentialBackoff = true,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;

        logger.warn('Task failed, retrying', {
          attempt,
          maxAttempts,
          delayMs: delay,
          error: error.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Export singleton instance
export const queue = new RateLimitedQueue();
export default RateLimitedQueue;
