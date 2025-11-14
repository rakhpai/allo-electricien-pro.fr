import config from '../config/index.js';
import axios from 'axios';

async function testCreatomateAPI() {
  try {
    console.log('Testing Creatomate API...');
    console.log('Template ID:', config.creatomate.templateId);
    console.log('API Base URL:', config.creatomate.apiBaseUrl);

    const response = await axios.get(
      `${config.creatomate.apiBaseUrl}/templates/${config.creatomate.templateId}`,
      {
        headers: {
          Authorization: `Bearer ${config.creatomate.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    console.log('✓ API Response received');
    console.log('Template Name:', response.data.name);
    console.log('Duration:', response.data.duration);
    console.log('Elements Count:', response.data.source?.elements?.length || 0);

    return response.data;
  } catch (error) {
    console.error('✗ API Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
}

testCreatomateAPI()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
