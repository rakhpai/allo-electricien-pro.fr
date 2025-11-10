#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Define city importance tiers
const MAJOR_CITIES = [
  // Prefecture cities and major communes
  'versailles', 'nanterre', 'bobigny', 'creteil', 'evry', 'evry-courcouronnes',
  'melun', 'cergy', 'pontoise', 'boulogne-billancourt', 'saint-denis',
  'argenteuil', 'montreuil', 'aulnay-sous-bois', 'aubervilliers',
  'colombes', 'asnieres-sur-seine', 'courbevoie', 'vitry-sur-seine',
  'rueil-malmaison', 'champigny-sur-marne', 'antibes', 'cannes',
  'levallois-perret', 'issy-les-moulineaux', 'neuilly-sur-seine',
  'ivry-sur-seine', 'clichy', 'villejuif', 'epinay-sur-seine',
  'maisons-alfort', 'chelles', 'meaux', 'beauvais', 'compiegne',
  'creil', 'senlis', 'nogent-sur-marne', 'vincennes', 'antony',
  'clamart', 'suresnes', 'puteaux', 'pantin', 'sevran', 'noisy-le-grand',
  'drancy', 'blanc-mesnil', 'livry-gargan', 'bondy'
];

// Priority mapping
const PRIORITIES = {
  PARIS: 0.9,      // Paris arrondissements
  MAJOR: 0.7,      // Prefecture cities and major communes
  DEFAULT: 0.5     // Smaller communes
};

function determinePriority(slug, city) {
  // Paris arrondissements get highest priority
  if (slug.startsWith('paris-') || (city && city.toLowerCase().startsWith('paris '))) {
    return PRIORITIES.PARIS;
  }

  // Major cities get medium-high priority
  if (MAJOR_CITIES.includes(slug)) {
    return PRIORITIES.MAJOR;
  }

  // All others get default priority
  return PRIORITIES.DEFAULT;
}

function updateMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(content);

  // Determine priority based on slug and city
  const priority = determinePriority(parsed.data.slug, parsed.data.city);

  // Add sitemap configuration to front matter if not already present
  if (!parsed.data.sitemap) {
    parsed.data.sitemap = {};
  }

  parsed.data.sitemap.priority = priority;

  // Set changefreq based on priority
  if (priority >= 0.9) {
    parsed.data.sitemap.changefreq = 'daily';
  } else if (priority >= 0.7) {
    parsed.data.sitemap.changefreq = 'weekly';
  } else {
    parsed.data.sitemap.changefreq = 'monthly';
  }

  // Rebuild the markdown file
  const newContent = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, newContent, 'utf8');

  return priority;
}

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const stats = {
    paris: 0,
    major: 0,
    default: 0,
    total: 0
  };

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const indexPath = path.join(dirPath, entry.name, 'index.md');

      if (fs.existsSync(indexPath)) {
        try {
          const priority = updateMarkdownFile(indexPath);
          stats.total++;

          if (priority === PRIORITIES.PARIS) {
            stats.paris++;
          } else if (priority === PRIORITIES.MAJOR) {
            stats.major++;
          } else {
            stats.default++;
          }

          if (stats.total % 100 === 0) {
            console.log(`Processed ${stats.total} files...`);
          }
        } catch (error) {
          console.error(`Error processing ${indexPath}:`, error.message);
        }
      }
    }
  }

  return stats;
}

// Main execution
const contentDir = path.join(__dirname, '..', 'content');

console.log('Adding sitemap priorities to city pages...');
console.log('Content directory:', contentDir);
console.log('');

const stats = processDirectory(contentDir);

console.log('\n✅ Sitemap priorities added successfully!');
console.log('');
console.log('Statistics:');
console.log(`  Paris arrondissements (priority 0.9): ${stats.paris}`);
console.log(`  Major cities (priority 0.7): ${stats.major}`);
console.log(`  Other communes (priority 0.5): ${stats.default}`);
console.log(`  Total files updated: ${stats.total}`);
