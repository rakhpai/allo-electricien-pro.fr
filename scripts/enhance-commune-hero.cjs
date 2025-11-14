#!/usr/bin/env node

/**
 * Enhance commune pages with hero section data and personalization
 * Adds frontmatter fields for improved hero sections and local context
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Landmark data by department
const LANDMARKS_BY_DEPT = {
  '75': [
    "Tour Eiffel", "Arc de Triomphe", "Champs-Élysées", "Notre-Dame",
    "Sacré-Cœur", "Louvre", "Place de la République", "Bastille",
    "Opéra", "Montmartre", "Belleville", "Marais"
  ],
  '77': [
    "Château de Fontainebleau", "Disneyland Paris", "Vaux-le-Vicomte",
    "Meaux", "Melun", "Provins médiéval", "Forêt de Fontainebleau",
    "Château de Blandy", "Coulommiers"
  ],
  '78': [
    "Château de Versailles", "Saint-Germain-en-Laye", "Rambouillet",
    "Montfort-l'Amaury", "Poissy", "Mantes-la-Jolie", "Houdan",
    "Forêt de Rambouillet", "Vallée de Chevreuse"
  ],
  '91': [
    "Plateau de Saclay", "Arpajon", "Étampes", "Évry-Courcouronnes",
    "Forêt de Sénart", "Massy", "Les Ulis", "Palaiseau",
    "Longjumeau", "Sainte-Geneviève-des-Bois"
  ],
  '92': [
    "La Défense", "Parc de Saint-Cloud", "Mont Valérien", "Île de la Jatte",
    "Boulogne-Billancourt", "Neuilly-sur-Seine", "Rueil-Malmaison",
    "Sèvres", "Meudon", "Château de Malmaison"
  ],
  '93': [
    "Stade de France", "Basilique Saint-Denis", "Parc de la Villette",
    "Canal de l'Ourcq", "Bondy", "Montreuil", "Pantin",
    "Le Bourget", "Rosny-sous-Bois"
  ],
  '94': [
    "Château de Vincennes", "Bois de Vincennes", "Créteil Soleil",
    "Rungis", "Orly", "Vitry-sur-Seine", "Ivry-sur-Seine",
    "Maisons-Alfort", "Bords de Marne"
  ],
  '95': [
    "Aéroport Roissy-CDG", "Château d'Écouen", "Enghien-les-Bains",
    "Cergy-Pontoise", "Argenteuil", "Sarcelles", "Gonesse",
    "Montmorency", "Isle-Adam", "Auvers-sur-Oise"
  ],
  '60': [
    "Château de Chantilly", "Compiègne", "Senlis", "Beauvais",
    "Château de Pierrefonds", "Parc Astérix", "Forêt de Compiègne",
    "Noyon", "Crépy-en-Valois"
  ]
};

/**
 * Generate pseudo-random but consistent number based on string seed
 */
function getConsistentRandom(seed, min, max) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const random = Math.abs(hash) / 2147483647;
  return Math.floor(random * (max - min + 1)) + min;
}

/**
 * Get electrician availability based on city tier
 */
function getElectricianCount(city, tier) {
  const seed = city.toLowerCase();

  switch(tier) {
    case 'S':
    case 'A':
      return getConsistentRandom(seed, 10, 15);
    case 'B':
    case 'C':
      return getConsistentRandom(seed, 7, 10);
    case 'D':
    case 'E':
    default:
      return getConsistentRandom(seed, 5, 8);
  }
}

/**
 * Get local landmark for a commune
 */
function getLocalLandmark(city, department, introText) {
  // First try to extract from introText
  if (introText) {
    // Look for mentions of landmarks in the intro text
    const landmarks = [
      'château', 'église', 'mairie', 'gare', 'centre-ville',
      'zone commerciale', 'parc', 'forêt', 'stade'
    ];

    for (const landmark of landmarks) {
      if (introText.toLowerCase().includes(landmark)) {
        return landmark.charAt(0).toUpperCase() + landmark.slice(1);
      }
    }
  }

  // Use department landmarks
  const deptLandmarks = LANDMARKS_BY_DEPT[department] || [];
  if (deptLandmarks.length > 0) {
    const index = getConsistentRandom(city, 0, deptLandmarks.length - 1);
    return deptLandmarks[index];
  }

  // Default landmarks
  const defaults = ["centre-ville", "zone commerciale", "quartier résidentiel", "mairie"];
  const index = getConsistentRandom(city, 0, defaults.length - 1);
  return defaults[index];
}

/**
 * Generate hero USP points
 */
function generateHeroUSP(electricianCount, landmark, city) {
  return [
    {
      text: `${electricianCount} électriciens disponibles maintenant`,
      icon: "users"
    },
    {
      text: `Proche de ${landmark}`,
      icon: "map-marker"
    },
    {
      text: "Certifié Qualifelec ⭐4.8/5",
      icon: "certificate"
    },
    {
      text: "Interventions dès 65€/h",
      icon: "euro"
    }
  ];
}

/**
 * Generate trust badges
 */
function generateTrustBadges(city) {
  const interventions = getConsistentRandom(city, 800, 1500);
  return [
    "Certifié Qualifelec",
    "⭐ 4.8/5 (1247 avis)",
    `${interventions}+ interventions`
  ];
}

/**
 * Process a single commune file
 */
function processCommune(filePath, stats) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);

    // Skip if already has hero enhancement
    if (parsed.data.heroEnhanced) {
      stats.skipped++;
      return;
    }

    const city = parsed.data.city || path.basename(path.dirname(filePath));
    const department = parsed.data.department || '78';
    const tier = parsed.data.tier || 'D';
    const introText = parsed.data.introText || '';

    // Generate enhancement data
    const electricianCount = getElectricianCount(city, tier);
    const landmark = getLocalLandmark(city, department, introText);

    // Add new frontmatter fields
    parsed.data.heroEnhanced = true;
    parsed.data.heroSubheading = `Intervention Express <30min à ${city}`;
    parsed.data.electriciansAvailable = electricianCount;
    parsed.data.localLandmark = landmark;
    parsed.data.heroUSP = generateHeroUSP(electricianCount, landmark, city);
    parsed.data.trustBadges = generateTrustBadges(city);
    parsed.data.pricingTeaser = "À partir de 65€/h";

    // Add local context based on department
    const contexts = {
      '75': "au cœur de Paris",
      '77': "en Seine-et-Marne",
      '78': "dans les Yvelines",
      '91': "en Essonne",
      '92': "dans les Hauts-de-Seine",
      '93': "en Seine-Saint-Denis",
      '94': "dans le Val-de-Marne",
      '95': "dans le Val-d'Oise",
      '60': "dans l'Oise"
    };
    parsed.data.localContext = contexts[department] || "en Île-de-France";

    // Save the updated file
    const newContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, newContent);

    stats.processed++;
    return true;

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    stats.errors++;
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  COMMUNE HERO ENHANCEMENT');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');

  const stats = {
    total: 0,
    processed: 0,
    skipped: 0,
    errors: 0
  };

  // Get all commune directories
  const contentDir = path.join(__dirname, '..', 'content');
  const directories = fs.readdirSync(contentDir)
    .filter(dir => {
      const fullPath = path.join(contentDir, dir);
      return fs.statSync(fullPath).isDirectory() &&
        !['mentions-legales', 'politique-confidentialite', 'electricien', 'services', 'profiles'].includes(dir);
    });

  stats.total = directories.length;
  console.log(`Found ${stats.total} commune directories to process\n`);

  // Process in batches for better performance
  const batchSize = 50;
  for (let i = 0; i < directories.length; i += batchSize) {
    const batch = directories.slice(i, Math.min(i + batchSize, directories.length));

    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(directories.length/batchSize)}...`);

    for (const dir of batch) {
      const indexPath = path.join(contentDir, dir, 'index.md');
      if (fs.existsSync(indexPath)) {
        processCommune(indexPath, stats);
      }
    }
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  ENHANCEMENT COMPLETE');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total communes:  ${stats.total}`);
  console.log(`Processed:       ${stats.processed}`);
  console.log(`Skipped:         ${stats.skipped}`);
  console.log(`Errors:          ${stats.errors}`);
  console.log('');

  if (stats.processed > 0) {
    console.log('✅ Hero enhancement data added successfully!');
    console.log('   Next step: Create the Hugo partials and update templates');
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { processCommune, getElectricianCount, getLocalLandmark };