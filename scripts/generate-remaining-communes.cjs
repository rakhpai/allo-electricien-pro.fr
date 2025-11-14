#!/usr/bin/env node

/**
 * Generate intro text for remaining communes with flexible validation
 * Specifically designed for communes that failed with strict validation
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Import AI configuration
const {
  anthropic,
  CONFIG,
  toProperCase,
  DEPARTMENT_NAMES,
  calculateCost
} = require('./ai-config.cjs');

// Read list of remaining communes
const communesFile = process.argv[2] || 'final-remaining-communes.txt';
const processId = process.argv[3] || '7';

// Flexible communes that need special handling
const FLEXIBLE_COMMUNES = [
  'ANDRESY', 'BEAUVAIS', 'BOIS-D\'ARCY', 'BOISSY-L\'AILLERIE',
  'CHAMBLY', 'COMPIEGNE', 'D\'HUISON-LONGUEVILLE', 'FLINS-NEUVE-EGLISE',
  'GERMIGNY-L\'EVEQUE', 'JOUY-EN-JOSAS', 'LA-VERRIERE', 'LE-PLESSIS-L\'EVEQUE',
  'L\'ETANG-LA-VILLE', 'L\'HAY-LES-ROSES', 'L\'ILE-SAINT-DENIS', 'LIMAY',
  'L\'ISLE-ADAM', 'MARGNY-LES-COMPIEGNE', 'MONTAINVILLE', 'MONTFORT-L\'AMAURY',
  'ORSONVILLE', 'PONTHEVRARD', 'SAINT-CYR-L\'ECOLE', 'SAINT-HILARION',
  'SAINT-OUEN-L\'AUMONE', 'SAINT-REMY-L\'HONORE', 'VERNEUIL-L\'ETANG', 'VILLE-D\'AVRAY'
];

/**
 * Validate generated text with flexible rules
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

  // Check city name presence (normalized)
  const normalizedText = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const normalizedCityName = cityName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalizedText.includes(normalizedCityName.replace(/['-]/g, ' '))) {
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

  // Adjust prompt based on retry count
  let lengthTarget = isFlexible ? '400-500' : '430-470';
  if (retryCount > 0) {
    // Get more specific with each retry
    if (retryCount === 1) lengthTarget = '440-480';
    if (retryCount === 2) lengthTarget = '450-470';
    if (retryCount >= 3) lengthTarget = '460 EXACTEMENT';
  }

  const prompt = `Générez un texte d'introduction pour un électricien à ${commune.city} (${commune.zipCode || commune.department}).

INSTRUCTIONS TRÈS IMPORTANTES:
- Longueur: ${lengthTarget} caractères (OBLIGATOIRE)
- Mentionner ${commune.city} dans la première phrase
- 3 phrases maximum
- Style professionnel et local
- Parler du type d'habitat local
- Mentionner notre disponibilité

${retryCount > 0 ? `⚠️ ATTENTION: Tentative ${retryCount + 1} - Respectez ABSOLUMENT la longueur demandée!` : ''}

Structure suggérée:
1. "À [Ville], [contexte local et type d'habitat]..."
2. "Les installations électriques [besoins spécifiques]..."
3. "Nos électriciens interviennent [disponibilité]..."

Département: ${commune.department} (${DEPARTMENT_NAMES[commune.department] || 'Île-de-France'})

Générez UNIQUEMENT le texte (${lengthTarget} caractères):`;

  try {
    const message = await anthropic.messages.create({
      model: CONFIG.MODEL,
      max_tokens: 200,
      temperature: retryCount > 2 ? 0.2 : 0.4, // Lower temperature on retries
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let generatedText = message.content[0].text.trim();
    generatedText = generatedText.replace(/^["']|["']$/g, '');
    generatedText = generatedText.replace(/\\n/g, ' ');

    // Validate
    const validation = validateIntroText(generatedText, commune.city, isFlexible);

    if (!validation.valid && retryCount < maxRetries) {
      console.log(`    Attempt ${retryCount + 1} failed: ${validation.errors.join(', ')}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateIntroText(commune, retryCount + 1);
    }

    return {
      success: validation.valid,
      text: generatedText,
      length: generatedText.length,
      attempts: retryCount + 1,
      errors: validation.errors,
      usage: message.usage
    };

  } catch (error) {
    console.error(`    Generation error: ${error.message}`);

    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateIntroText(commune, retryCount + 1);
    }

    return {
      success: false,
      error: error.message,
      attempts: retryCount + 1
    };
  }
}

/**
 * Store intro text in frontmatter
 */
async function storeIntroText(commune, introText) {
  const contentPath = path.join(__dirname, '..', 'content', commune.slug, 'index.md');

  if (!fs.existsSync(contentPath)) {
    console.log(`    Content file not found: ${contentPath}`);
    return false;
  }

  try {
    const fileContent = fs.readFileSync(contentPath, 'utf-8');
    const parsed = matter(fileContent);
    parsed.data.introText = introText;
    parsed.data.introGeneratedAt = new Date().toISOString();

    const updated = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(contentPath, updated);
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
    department: page.department,
    zipCode: page.zip_code,
    tier: page.tier || 'D'
  };
}

/**
 * Main function
 */
async function generateRemainingCommunes() {
  const timestamp = new Date().toISOString().split('T')[0];

  console.log('═'.repeat(80));
  console.log('  REMAINING COMMUNES GENERATION');
  console.log('  Flexible Validation Enabled');
  console.log('═'.repeat(80));
  console.log('');

  // Read commune list
  if (!fs.existsSync(communesFile)) {
    console.error(`File not found: ${communesFile}`);
    process.exit(1);
  }

  const communeSlugs = fs.readFileSync(communesFile, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.trim());

  console.log(`Found ${communeSlugs.length} communes to process`);
  console.log('');

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < communeSlugs.length; i++) {
    const slug = communeSlugs[i];
    console.log(`[${i+1}/${communeSlugs.length}] Processing: ${slug}`);

    const commune = loadCommuneData(slug);

    if (!commune) {
      console.log(`  ✗ Could not load commune data for: ${slug}`);
      failCount++;
      continue;
    }

    console.log(`  ${commune.city} (${commune.zipCode || commune.department})`);
    console.log(`  Generating intro text...`);

    const result = await generateIntroText(commune);

    if (result.success) {
      console.log(`  ✓ Generated: ${result.length} chars (${result.attempts} attempts)`);
      console.log(`  Preview: "${result.text.substring(0, 80)}..."`);

      const stored = await storeIntroText(commune, result.text);
      if (stored) {
        console.log(`  ✓ Stored successfully`);
        successCount++;
      } else {
        console.log(`  ⚠ Storage failed`);
      }

      results.push({
        commune: commune.city,
        slug: slug,
        success: true,
        length: result.length,
        text: result.text
      });

      if (result.usage) {
        totalInputTokens += result.usage.input_tokens;
        totalOutputTokens += result.usage.output_tokens;
      }
    } else {
      console.log(`  ✗ Generation failed: ${result.error || result.errors?.join(', ')}`);
      failCount++;

      results.push({
        commune: commune.city,
        slug: slug,
        success: false,
        error: result.error || result.errors?.join(', ')
      });
    }

    console.log('');

    // Delay between API calls
    if (i < communeSlugs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('═'.repeat(80));
  console.log('  GENERATION COMPLETE');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Processed: ${communeSlugs.length} communes`);
  console.log(`Successful: ${successCount} (${Math.round(successCount/communeSlugs.length*100)}%)`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total tokens: ${totalInputTokens} in, ${totalOutputTokens} out`);

  const cost = calculateCost(totalInputTokens, totalOutputTokens, CONFIG.MODEL);
  console.log(`Estimated cost: $${cost.cost.toFixed(4)}`);

  // Save results
  const filename = `remaining-communes-results-${timestamp}-p${processId}.json`;
  const output = {
    metadata: {
      processed: communeSlugs.length,
      successful: successCount,
      failed: failCount,
      totalTokens: totalInputTokens + totalOutputTokens,
      cost: cost.cost,
      timestamp: new Date().toISOString()
    },
    results
  };

  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${filename}`);
}

// Run the generation
generateRemainingCommunes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});