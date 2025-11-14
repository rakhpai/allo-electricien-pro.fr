#!/usr/bin/env node

/**
 * Generate intro text for remaining communes with apostrophes
 * Fixed version with better apostrophe handling
 */

require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Initialize Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Flexible validation for problem communes
const FLEXIBLE_COMMUNES = [
  "BOIS-D'ARCY", "BOISSY-L'AILLERIE", "D'HUISON-LONGUEVILLE",
  "FLINS-NEUVE-ÉGLISE", "GERMIGNY-L'EVEQUE", "JOUY-EN-JOSAS",
  "LE PLESSIS-L'EVEQUE", "L'ETANG-LA-VILLE", "L'HAY-LES-ROSES",
  "L'ILE-SAINT-DENIS", "L'ISLE-ADAM", "MARGNY-LES-COMPIEGNE",
  "MONTFORT-L'AMAURY", "SAINT-CYR-L'ECOLE", "SAINT-HILARION",
  "SAINT-OUEN-L'AUMONE", "SAINT-REMY-L'HONORE", "VERNEUIL-L'ETANG",
  "VILLE-D'AVRAY"
];

/**
 * Validate generated intro text with improved apostrophe handling
 */
function validateIntroText(text, cityName, isFlexible = false) {
  const errors = [];

  // More flexible length requirements for problem communes
  const minLength = isFlexible ? 380 : 440;
  const maxLength = isFlexible ? 550 : 520;

  if (text.length < minLength) {
    errors.push(`Too short: ${text.length} chars (min ${minLength})`);
  }
  if (text.length > maxLength) {
    errors.push(`Too long: ${text.length} chars (max ${maxLength})`);
  }

  // Check city name presence with multiple variations
  const normalizedText = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents

  const normalizedCityName = cityName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents

  // Try multiple variations for city name matching
  const variations = [
    normalizedCityName, // Original
    normalizedCityName.replace(/['-]/g, ' '), // Replace apostrophes/hyphens with spaces
    normalizedCityName.replace(/'/g, "'"), // Straight apostrophe to curly
    normalizedCityName.replace(/'/g, "'"), // Curly apostrophe to straight
    normalizedCityName.replace(/['-]/g, '-'), // All to hyphens
    normalizedCityName.replace(/['-]/g, ''), // Remove all punctuation
  ];

  // Also try without "SAINT" prefix if applicable
  if (normalizedCityName.startsWith('saint-')) {
    const withoutSaint = normalizedCityName.replace('saint-', 'st-');
    variations.push(withoutSaint);
    variations.push(withoutSaint.replace(/['-]/g, ' '));
  }

  // Check if any variation is found in the text
  const found = variations.some(variant => normalizedText.includes(variant));

  if (!found) {
    errors.push(`Missing city name "${cityName}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
    length: text.length
  };
}

/**
 * Generate intro text with flexible approach
 */
async function generateIntroText(commune, retryCount = 0) {
  const maxRetries = 5; // More retries for difficult communes
  const isFlexible = FLEXIBLE_COMMUNES.includes(commune.city.toUpperCase());

  try {
    // Adaptive temperature for retries
    const temperature = Math.min(0.3 + (retryCount * 0.1), 0.7);

    // Progressive length targeting
    let targetLength = isFlexible ? "430-470" : "450-490";
    if (retryCount > 2) {
      targetLength = isFlexible ? "400-450" : "430-470";
    }

    // Build retry feedback
    const retryFeedback = commune.previousLength ?
      `\n⚠️ ATTENTION: Tentative précédente était ${commune.previousLength} caractères - TROP LONG!\nGénérez EXACTEMENT ${targetLength} caractères cette fois.\n` : '';

    const prompt = `Tu es un expert en rédaction web pour un service d'électricité local en France.
Génère un texte d'introduction contextuel pour la page de la commune ${commune.city.toUpperCase()} (${commune.zipCode}, département ${commune.department}).

${retryFeedback}

INSTRUCTIONS CRITIQUES:
1. Commence OBLIGATOIREMENT par "À ${commune.city}" (avec la bonne casse et orthographe exacte)
2. Mentionne des éléments contextuels spécifiques à cette commune ou région
3. Inclus les types d'interventions électriques pertinents
4. Longueur STRICTE: ${targetLength} caractères (espaces inclus)
5. Une seule phrase fluide et naturelle
6. Pas de guillemets dans le texte
7. Style professionnel mais accessible

${getLocalContext(commune)}

ATTENTION À L'ORTHOGRAPHE:
- Si le nom contient une apostrophe, l'écrire correctement (ex: "L'Étang-la-Ville" ou "Bois-d'Arcy")
- Respecter les majuscules et minuscules appropriées
- Les traits d'union doivent être conservés

Génère UNIQUEMENT le texte d'introduction (sans guillemets, sans préfixe):`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 150,
      temperature: temperature,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const text = response.content[0].text.trim();

    // Clean up any quotes if present
    const cleanText = text.replace(/^["']|["']$/g, '').trim();

    // Validate
    const validation = validateIntroText(cleanText, commune.city, isFlexible);

    if (validation.valid) {
      return {
        success: true,
        text: cleanText,
        attempts: retryCount + 1
      };
    }

    // Retry if validation failed and we have retries left
    if (retryCount < maxRetries - 1) {
      commune.previousLength = validation.length;
      console.log(`    Attempt ${retryCount + 1} failed: ${validation.errors.join(', ')}`);
      return generateIntroText(commune, retryCount + 1);
    }

    return {
      success: false,
      error: validation.errors.join(', '),
      attempts: retryCount + 1,
      text: cleanText
    };

  } catch (err) {
    if (retryCount < maxRetries - 1 && err.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateIntroText(commune, retryCount + 1);
    }
    throw err;
  }
}

/**
 * Get local context based on commune
 */
function getLocalContext(commune) {
  const dept = commune.department;

  const contexts = {
    '75': 'CONTEXTE: Paris - quartier urbain dense, immeubles haussmanniens, commerces, bureaux',
    '77': 'CONTEXTE: Seine-et-Marne - mix urbain/rural, zones pavillonnaires, proximité Disneyland ou Fontainebleau selon localisation',
    '78': 'CONTEXTE: Yvelines - résidentiel, nombreux pavillons, proximité Versailles ou Saint-Germain-en-Laye',
    '91': "CONTEXTE: Essonne - banlieue sud, zones pavillonnaires, proximité RER, développement urbain",
    '92': 'CONTEXTE: Hauts-de-Seine - quartier d\'affaires (La Défense), résidentiel haut standing',
    '93': 'CONTEXTE: Seine-Saint-Denis - habitat mixte, rénovations urbaines, développement économique',
    '94': 'CONTEXTE: Val-de-Marne - résidentiel, bords de Marne, mix pavillons et petits immeubles',
    '95': "CONTEXTE: Val-d'Oise - périurbain, zones pavillonnaires, espaces verts, proximité Roissy",
    '60': 'CONTEXTE: Oise - région Hauts-de-France, patrimoine historique, zones rurales et urbaines'
  };

  return contexts[dept] || 'CONTEXTE: Commune française, habitat varié entre maisons individuelles et petits collectifs';
}

/**
 * Store intro text to file
 */
function storeIntroText(commune, text) {
  try {
    const contentPath = path.join(__dirname, '..', 'content', commune.slug, 'index.md');

    if (!fs.existsSync(contentPath)) {
      console.log(`    File not found: ${contentPath}`);
      return false;
    }

    const fileContent = fs.readFileSync(contentPath, 'utf-8');
    const parsed = matter(fileContent);

    // Add or update introText
    parsed.data.introText = text;

    // Rebuild file
    const newContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(contentPath, newContent, 'utf-8');

    return true;
  } catch (err) {
    console.log(`    Storage error: ${err.message}`);
    return false;
  }
}

/**
 * Load commune data from sitemap
 */
function loadCommuneData(slug) {
  const sitemapPath = path.join(__dirname, '..', 'data', 'sitemap_pages.json');
  const sitemapData = JSON.parse(fs.readFileSync(sitemapPath, 'utf-8'));

  // Search in all tiers
  let allPages = [];
  if (sitemapData.organized) {
    Object.keys(sitemapData.organized).forEach(tierKey => {
      const tierData = sitemapData.organized[tierKey];
      if (Array.isArray(tierData)) {
        allPages = allPages.concat(tierData);
      } else if (typeof tierData === 'object') {
        Object.values(tierData).forEach(deptPages => {
          if (Array.isArray(deptPages)) {
            allPages = allPages.concat(deptPages);
          }
        });
      }
    });
  }

  // Find the commune
  const page = allPages.find(p =>
    p.url_path === `/${slug}/` ||
    p.url_path === `/${slug}` ||
    p.city_name && p.city_name.toLowerCase().replace(/['-]/g, '') === slug.replace(/['-]/g, '')
  );

  if (!page) {
    // Try to extract from content file
    const contentPath = path.join(__dirname, '..', 'content', slug, 'index.md');
    if (fs.existsSync(contentPath)) {
      const fileContent = fs.readFileSync(contentPath, 'utf-8');
      const parsed = matter(fileContent);
      return {
        city: parsed.data.city || toProperCase(slug),
        slug: slug,
        department: parsed.data.department || '78',
        zipCode: parsed.data.zipCode || parsed.data.zip_code,
        tier: parsed.data.tier || 'D'
      };
    }
    return null;
  }

  return {
    city: page.city_name || toProperCase(slug),
    slug: slug,
    department: page.postal_code ? page.postal_code.substring(0, 2) : '78',
    zipCode: page.postal_code,
    tier: page.tier || 'D'
  };
}

/**
 * Convert slug to proper case
 */
function toProperCase(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-');
}

/**
 * Main processing function
 */
async function main() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  FIXED APOSTROPHE HANDLING - COMMUNE GENERATION');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');

  // Get input file from command line
  const inputFile = process.argv[2];
  const processId = process.argv[3] || 'main';

  if (!inputFile) {
    console.error('Usage: node generate-remaining-communes-fixed.cjs <input-file.txt> [process-id]');
    process.exit(1);
  }

  // Read communes from file
  const communesList = fs.readFileSync(inputFile, 'utf-8')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${communesList.length} communes to process`);
  console.log('');

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (let i = 0; i < communesList.length; i++) {
    const slug = communesList[i];
    console.log(`[${i+1}/${communesList.length}] Processing: ${slug}`);

    const communeData = loadCommuneData(slug);
    if (!communeData) {
      console.log(`  ✗ Could not find data for: ${slug}`);
      failCount++;
      continue;
    }

    console.log(`  ${communeData.city.toUpperCase()} (${communeData.zipCode})`);

    // Check if already has intro
    const contentPath = path.join(__dirname, '..', 'content', slug, 'index.md');
    if (fs.existsSync(contentPath)) {
      const content = fs.readFileSync(contentPath, 'utf-8');
      const parsed = matter(content);
      if (parsed.data.introText) {
        console.log(`  ⚠ Already has intro text, skipping`);
        continue;
      }
    }

    console.log(`  Generating intro text...`);

    try {
      const result = await generateIntroText(communeData);

      if (result.success) {
        console.log(`  ✓ Generated: ${result.text.length} chars (${result.attempts} attempts)`);
        console.log(`  Preview: "${result.text.substring(0, 80)}..."`);

        if (storeIntroText(communeData, result.text)) {
          console.log(`  ✓ Stored successfully`);
          successCount++;
        } else {
          console.log(`  ✗ Failed to store`);
          failCount++;
        }
      } else {
        console.log(`  ✗ Generation failed: ${result.error}`);
        failCount++;
      }

      results.push({
        commune: slug,
        success: result.success,
        text: result.text,
        attempts: result.attempts,
        error: result.error
      });

      // Estimate tokens (rough)
      totalIn += 500;
      totalOut += result.text ? Math.ceil(result.text.length / 4) : 0;

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      failCount++;
    }

    console.log('');

    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Summary
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  GENERATION COMPLETE');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Processed: ${communesList.length} communes`);
  console.log(`Successful: ${successCount} (${Math.round(successCount*100/communesList.length)}%)`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total tokens: ${totalIn} in, ${totalOut} out`);
  console.log(`Estimated cost: $${((totalIn * 0.0008 + totalOut * 0.004) / 1000).toFixed(4)}`);
  console.log('');

  // Save results
  const outputFile = `remaining-communes-fixed-results-${new Date().toISOString().split('T')[0]}-p${processId}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`Results saved to: ${outputFile}`);
  console.log('');
}

// Run
main().catch(console.error);