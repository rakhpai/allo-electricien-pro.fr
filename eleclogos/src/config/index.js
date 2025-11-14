import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * Application Configuration
 * Centralized configuration management for all services
 */
export const config = {
  // Creatomate Configuration
  creatomate: {
    apiKey: process.env.CREATOMATE_API_KEY,
    templateId: process.env.CREATOMATE_TEMPLATE_ID,
    apiBaseUrl: 'https://api.creatomate.com/v2', // Using v2 for renders
  },

  // ElevenLabs Configuration
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    // Multiple voice IDs for variation across videos
    voiceIds: [
      '1EmYoP3UnnnwhlJKovEy', // Default voice (French)
      'mvhJVdVoTWVUtL4keT7W', // Alternative voice 1
    ],
    model: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128', // Default format for Creatomate compatibility
  },

  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    tableName: 'videos',
  },

  // Webhook Configuration
  webhook: {
    port: parseInt(process.env.WEBHOOK_PORT) || 3000,
    url: process.env.WEBHOOK_URL,
    secret: process.env.WEBHOOK_SECRET,
  },

  // Application Settings
  app: {
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Rate Limiting
  rateLimit: {
    requests: parseInt(process.env.RATE_LIMIT_REQUESTS) || 30,
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 10000,
  },

  // Batch Processing
  batch: {
    size: parseInt(process.env.BATCH_SIZE) || 100,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS) || 5000,
  },
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const required = {
    'CREATOMATE_API_KEY': config.creatomate.apiKey,
    'ELEVENLABS_API_KEY': config.elevenlabs.apiKey,
    'SUPABASE_URL': config.supabase.url,
    'SUPABASE_ANON_KEY': config.supabase.anonKey,
    'SUPABASE_SERVICE_ROLE_KEY': config.supabase.serviceRoleKey,
  };

  const missing = Object.entries(required)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
}

export default config;
