const fs = require('fs');
const path = require('path');

console.log('=== GENERATE COMMUNE CONTENT FILES ===\n');

// Load sites data
const dataPath = path.join(__dirname, '..', 'data', 'sites.json');

if (!fs.existsSync(dataPath)) {
  console.error('❌ Error: data/sites.json not found');
  console.error('   Run "npm run data" first to generate data from Supabase\n');
  process.exit(1);
}

const sitesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log(`📝 Generating ${sitesData.total_sites} commune pages...\n`);

const contentDir = path.join(__dirname, '..', 'content');

// Ensure content directory exists
if (!fs.existsSync(contentDir)) {
  fs.mkdirSync(contentDir, { recursive: true });
}

let created = 0;
let updated = 0;
let skipped = 0;

sitesData.sites.forEach((site, index) => {
  // Skip sites with missing required fields
  if (!site.slug || !site.city) {
    console.log();
    skipped++;
    return;
  }

  const siteDir = path.join(contentDir, site.slug);
  const indexPath = path.join(siteDir, 'index.md');

  // Create directory if doesn't exist
  if (!fs.existsSync(siteDir)) {
    fs.mkdirSync(siteDir, { recursive: true });
  }

  // Create frontmatter for the page
  const frontmatter = `---
title: "${site.title || site.keyword}"
slug: "${site.slug}"
city: "${site.city}"
zipCode: "${site.zipCode}"
department: "${site.department}"
keyword: "${site.keyword || 'Électricien ' + site.city}"
company: "${site.name}"
phone: "${site.phone}"
phoneRaw: "${site.phoneRaw}"
description: "${site.metaDescription || 'Électricien urgence ' + site.city + '. Dépannage électrique, installation, réparation. Intervention rapide 24h/7j.'}"
niche: "${site.niche || 'électricité'}"
kwSource: "${site.kwSource || 'électricité'}"
coordinates:
  lat: ${site.coordinates.lat}
  lng: ${site.coordinates.lng}
draft: false
---
`;

  // Check if file already exists
  const fileExists = fs.existsSync(indexPath);

  // Write the file
  fs.writeFileSync(indexPath, frontmatter);

  if (fileExists) {
    updated++;
  } else {
    created++;
  }

  // Progress indicator
  if ((index + 1) % 50 === 0 || (index + 1) === sitesData.total_sites) {
    console.log(`  Progress: ${index + 1}/${sitesData.total_sites} pages processed`);
  }
});

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ CONTENT GENERATION COMPLETE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Created: ${created} new pages`);
console.log(`Updated: ${updated} existing pages`);
console.log(`Total: ${created + updated} pages\n`);

console.log('Sample pages created:');
sitesData.sites.slice(0, 5).forEach((site, i) => {
  console.log(`  ${i + 1}. content/${site.slug}/index.md`);
});
console.log('');

console.log('Next step: npm run build\n');
