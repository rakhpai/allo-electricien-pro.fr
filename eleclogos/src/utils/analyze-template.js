import config from '../config/index.js';
import creatomateService from '../services/creatomate.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyze Creatomate Template
 * Fetches template and identifies all elements that can be modified
 */
async function analyzeTemplate() {
  try {
    console.log('Starting template analysis...');
    console.log('Template ID:', config.creatomate.templateId);
    console.log('Fetching from Creatomate API...');

    const template = await creatomateService.getTemplate(config.creatomate.templateId);

    console.log('\n=== TEMPLATE ANALYSIS ===');
    console.log('Template ID:', template.id);
    console.log('Template Name:', template.name);
    console.log('Duration:', template.duration, 'seconds');
    console.log('Resolution:', `${template.width}x${template.height}`);
    console.log('Frame Rate:', template.frame_rate);

    // Analyze elements
    const elements = extractElements(template.source);

    console.log('\n=== ELEMENTS DISCOVERED ===');
    console.log('Total Elements:', elements.length);

    // Categorize elements
    const textElements = elements.filter(e => e.type === 'text');
    const audioElements = elements.filter(e => e.type === 'audio');
    const videoElements = elements.filter(e => e.type === 'video');
    const imageElements = elements.filter(e => e.type === 'image');

    console.log('\n--- TEXT ELEMENTS ---');
    textElements.forEach(el => {
      console.log(`  ${el.name}: "${el.text || el.content || '(empty)'}" [${el.track}]`);
    });

    console.log('\n--- AUDIO ELEMENTS ---');
    audioElements.forEach(el => {
      console.log(`  ${el.name}: ${el.source || '(no source)'} [${el.track}]`);
    });

    console.log('\n--- VIDEO ELEMENTS ---');
    videoElements.forEach(el => {
      console.log(`  ${el.name}: ${el.source || '(no source)'} [${el.track}]`);
    });

    console.log('\n--- IMAGE ELEMENTS ---');
    imageElements.forEach(el => {
      console.log(`  ${el.name}: ${el.source || '(no source)'} [${el.track}]`);
    });

    // Generate modification map
    const modificationMap = generateModificationMap(elements);

    console.log('\n=== RECOMMENDED MODIFICATIONS MAP ===');
    console.log(JSON.stringify(modificationMap, null, 2));

    // Save full template to file for reference
    const outputPath = path.resolve(__dirname, '../../assets/logs/template-analysis.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({
      template,
      elements,
      modificationMap,
      analyzedAt: new Date().toISOString()
    }, null, 2));

    console.log('\n=== SAVED ===');
    console.log('Full analysis saved to:', outputPath);

    return { template, elements, modificationMap };

  } catch (error) {
    console.error('Failed to analyze template:', error.message);
    throw error;
  }
}

/**
 * Recursively extract all elements from template source
 */
function extractElements(source, track = 0, elements = []) {
  if (!source || !source.elements) {
    return elements;
  }

  source.elements.forEach((element, index) => {
    const elementInfo = {
      track,
      index,
      type: element.type,
      name: element.name || `Unnamed_${element.type}_${track}_${index}`,
      duration: element.duration,
      time: element.time,
    };

    // Add type-specific properties
    if (element.type === 'text') {
      elementInfo.text = element.text;
      elementInfo.font_family = element.font_family;
      elementInfo.font_size = element.font_size;
    } else if (element.type === 'audio' || element.type === 'video' || element.type === 'image') {
      elementInfo.source = element.source;
    }

    elements.push(elementInfo);

    // Recursively process composition elements
    if (element.type === 'composition' && element.source) {
      extractElements(element.source, track + 1, elements);
    }
  });

  return elements;
}

/**
 * Generate recommended modification map based on element analysis
 */
function generateModificationMap(elements) {
  const map = {
    text: {},
    audio: {},
    video: {},
    image: {}
  };

  elements.forEach(el => {
    const key = `${el.name}.`;

    if (el.type === 'text') {
      if (el.text) {
        map.text[`${key}text`] = `Dynamic value for "${el.text.substring(0, 50)}..."`;
      }
    } else if (el.type === 'audio') {
      map.audio[`${key}source`] = 'URL to audio file';
    } else if (el.type === 'video') {
      map.video[`${key}source`] = 'URL to video file';
    } else if (el.type === 'image') {
      map.image[`${key}source`] = 'URL to image file';
    }
  });

  return map;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeTemplate()
    .then(() => {
      console.log('\n✓ Analysis complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Analysis failed:', error.message);
      process.exit(1);
    });
}

export default analyzeTemplate;
export { extractElements, generateModificationMap };
