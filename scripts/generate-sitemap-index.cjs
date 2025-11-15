#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://allo-electricien.pro';
const OUTPUT_PATH = path.join(__dirname, '..', 'static', 'sitemap_index.xml');

// Sitemaps to include
const sitemaps = [
  {
    loc: `${BASE_URL}/sitemap.xml`,
    description: 'Main sitemap with all city pages'
  },
  {
    loc: `${BASE_URL}/video_sitemap.xml`,
    description: 'Video sitemap for pages with video content'
  }
];

function generateSitemapIndex() {
  const currentDate = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const sitemap of sitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${sitemap.loc}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>\n';

  return xml;
}

// Main execution
console.log('Generating sitemap index...');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Output: ${OUTPUT_PATH}`);
console.log('');

const sitemapIndexContent = generateSitemapIndex();

// Write to file
fs.writeFileSync(OUTPUT_PATH, sitemapIndexContent, 'utf8');

console.log('Sitemap index generated successfully!');
console.log('');
console.log('Included sitemaps:');
sitemaps.forEach((sitemap, index) => {
  console.log(`  ${index + 1}. ${sitemap.loc}`);
  console.log(`     ${sitemap.description}`);
});
console.log('');
console.log(`File saved to: ${OUTPUT_PATH}`);
