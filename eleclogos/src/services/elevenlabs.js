import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ElevenLabs Service
 * Handles voice-over generation using ElevenLabs API
 */
class ElevenLabsService {
  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: config.elevenlabs.apiKey,
    });
    this.voiceIds = config.elevenlabs.voiceIds;
    this.model = config.elevenlabs.model;
    this.outputFormat = config.elevenlabs.outputFormat;
    this.audioDir = path.resolve(__dirname, '../../assets/audio');
  }

  /**
   * Get a random voice ID from the configured voice pool
   * @returns {string} - Random voice ID
   */
  getRandomVoiceId() {
    const randomIndex = Math.floor(Math.random() * this.voiceIds.length);
    return this.voiceIds[randomIndex];
  }

  /**
   * Ensure audio directory exists
   */
  async ensureAudioDirectory() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create audio directory', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate voice-over from text
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Optional parameters
   * @returns {Promise<Object>} - Audio data and metadata
   */
  async generateVoiceOver(text, options = {}) {
    try {
      // Use provided voice ID or randomly select one
      const voiceId = options.voiceId || this.getRandomVoiceId();

      logger.info('Generating voice-over', {
        textLength: text.length,
        voiceId: voiceId,
      });

      const model = options.model || this.model;

      // Generate audio using ElevenLabs
      const audio = await this.client.textToSpeech.convert(voiceId, {
        text: text,
        model_id: model,
        output_format: this.outputFormat,
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarity || 0.75,
          style: options.style || 0.0,
          use_speaker_boost: options.speakerBoost || true,
        },
      });

      logger.info('Voice-over generated successfully');

      return {
        audio,
        voiceId,
        model,
        textLength: text.length,
      };
    } catch (error) {
      logger.error('Failed to generate voice-over', { error: error.message });
      throw new Error(`ElevenLabs API error: ${error.message}`);
    }
  }

  /**
   * Save audio to file
   * @param {Buffer|Stream} audio - Audio data
   * @param {string} filename - Filename (without extension)
   * @returns {Promise<string>} - Path to saved file
   */
  async saveAudioToFile(audio, filename) {
    try {
      await this.ensureAudioDirectory();

      const filepath = path.join(this.audioDir, `${filename}.mp3`);

      // Convert ReadableStream to Buffer if needed
      let audioBuffer;
      if (audio instanceof ReadableStream || typeof audio[Symbol.asyncIterator] === 'function') {
        const chunks = [];
        for await (const chunk of audio) {
          chunks.push(chunk);
        }
        audioBuffer = Buffer.concat(chunks);
      } else {
        audioBuffer = audio;
      }

      await fs.writeFile(filepath, audioBuffer);
      logger.info('Audio saved to file', { filepath });

      return filepath;
    } catch (error) {
      logger.error('Failed to save audio file', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate and save voice-over
   * @param {string} text - Text to convert
   * @param {string} filename - Output filename (without extension)
   * @param {Object} options - Optional parameters
   * @returns {Promise<Object>} - Audio file path and metadata
   */
  async generateAndSave(text, filename, options = {}) {
    try {
      const result = await this.generateVoiceOver(text, options);
      const filepath = await this.saveAudioToFile(result.audio, filename);

      return {
        filepath,
        filename: `${filename}.mp3`,
        voiceId: result.voiceId,
        model: result.model,
        textLength: result.textLength,
      };
    } catch (error) {
      logger.error('Failed to generate and save voice-over', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available voices from ElevenLabs
   * @returns {Promise<Array>} - List of available voices
   */
  async getAvailableVoices() {
    try {
      const voices = await this.client.voices.getAll();
      logger.info('Retrieved available voices', { count: voices.voices?.length });
      return voices.voices || [];
    } catch (error) {
      logger.error('Failed to retrieve voices', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate voice-over with streaming (for real-time applications)
   * @param {string} text - Text to convert
   * @param {Object} options - Optional parameters
   * @returns {Promise<Stream>} - Audio stream
   */
  async generateVoiceOverStream(text, options = {}) {
    try {
      // Use provided voice ID or randomly select one
      const voiceId = options.voiceId || this.getRandomVoiceId();

      logger.info('Generating voice-over stream', {
        textLength: text.length,
        voiceId: voiceId,
      });

      const model = options.model || this.model;

      const audioStream = await this.client.textToSpeech.stream(voiceId, {
        text: text,
        model_id: model,
        output_format: this.outputFormat,
      });

      logger.info('Voice-over stream created successfully');
      return audioStream;
    } catch (error) {
      logger.error('Failed to create voice-over stream', { error: error.message });
      throw error;
    }
  }

  /**
   * Estimate audio duration based on text length
   * Rough estimate: ~150 words per minute for French
   * @param {string} text - Input text
   * @returns {number} - Estimated duration in seconds
   */
  estimateDuration(text) {
    const wordCount = text.split(/\s+/).length;
    const wordsPerMinute = 150; // Average speaking rate in French
    const durationMinutes = wordCount / wordsPerMinute;
    const durationSeconds = durationMinutes * 60;

    return Math.ceil(durationSeconds);
  }

  /**
   * Generate dual audio files (intro + full voice-over)
   * @param {string} introText - Short intro hook text (3-5s)
   * @param {string} fullText - Full voice-over text (30-35s)
   * @param {string} baseFilename - Base filename (without extension)
   * @param {Object} options - Optional parameters
   * @returns {Promise<Object>} - Paths and metadata for both audio files
   */
  async generateDualAudio(introText, fullText, baseFilename, options = {}) {
    try {
      // Select one random voice ID for both intro and full audio (consistency within video)
      const voiceId = options.voiceId || this.getRandomVoiceId();

      logger.info('Generating dual audio files', {
        introLength: introText.length,
        fullLength: fullText.length,
        baseFilename,
        voiceId: voiceId,
      });

      // Generate intro audio with selected voice
      logger.info('Generating intro audio...');
      const introResult = await this.generateVoiceOver(introText, { ...options, voiceId });
      const introFilename = `${baseFilename}_intro`;
      const introFilepath = await this.saveAudioToFile(introResult.audio, introFilename);

      logger.info('Intro audio generated', {
        filepath: introFilepath,
        duration: this.estimateDuration(introText),
      });

      // Generate full voice-over audio with same voice
      logger.info('Generating full voice-over audio...');
      const fullResult = await this.generateVoiceOver(fullText, { ...options, voiceId });
      const fullFilename = `${baseFilename}_full`;
      const fullFilepath = await this.saveAudioToFile(fullResult.audio, fullFilename);

      logger.info('Full audio generated', {
        filepath: fullFilepath,
        duration: this.estimateDuration(fullText),
      });

      return {
        intro: {
          filepath: introFilepath,
          filename: `${introFilename}.mp3`,
          textLength: introResult.textLength,
          estimatedDuration: this.estimateDuration(introText),
        },
        full: {
          filepath: fullFilepath,
          filename: `${fullFilename}.mp3`,
          textLength: fullResult.textLength,
          estimatedDuration: this.estimateDuration(fullText),
        },
        voiceId: introResult.voiceId,
        model: introResult.model,
      };
    } catch (error) {
      logger.error('Failed to generate dual audio', {
        error: error.message,
        baseFilename,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;
