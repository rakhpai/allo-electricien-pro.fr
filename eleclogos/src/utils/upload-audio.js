import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import config from '../config/index.js';
import logger from './logger.js';

/**
 * Upload audio file to Creatomate's asset storage
 * @param {string} filepath - Local file path
 * @returns {Promise<string>} - Public URL
 */
export async function uploadAudioToCreatomate(filepath) {
  try {
    logger.info('Uploading audio to Creatomate', { filepath });

    const form = new FormData();
    form.append('source', fs.createReadStream(filepath));

    const response = await axios.post(
      'https://api.creatomate.com/v1/assets',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${config.creatomate.apiKey}`,
        },
      }
    );

    const assetUrl = response.data.url;
    logger.info('Audio uploaded successfully', { assetUrl });

    return assetUrl;
  } catch (error) {
    logger.error('Failed to upload audio', {
      error: error.message,
      response: error.response?.data,
    });
    throw error;
  }
}

export default uploadAudioToCreatomate;
