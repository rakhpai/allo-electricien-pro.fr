#!/usr/bin/env node

/**
 * Parallel-capable Commune Contextual Intro Text Generator
 * Generates 450-500 character contextual introductions for electrician service pages
 * Supports skip-existing, range processing, and custom delays for parallel execution
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

// Parse command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  DEPT: process.argv.find(arg => arg.startsWith('--dept='))?.split('=')[1] || null,
  TIER: process.argv.find(arg => arg.startsWith('--tier='))?.split('=')[1] || null,
  LIMIT: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  START: parseInt(process.argv.find(arg => arg.startsWith('--start='))?.split('=')[1]) || 0,
  END: parseInt(process.argv.find(arg => arg.startsWith('--end='))?.split('=')[1]) || null,
  SKIP_EXISTING: process.argv.includes('--skip-existing'),
  PROCESS_ID: process.argv.find(arg => arg.startsWith('--process-id='))?.split('=')[1] || '1',
  DELAY: parseInt(process.argv.find(arg => arg.startsWith('--delay='))?.split('=')[1]) || 2400, // Default 2.4s for parallel
  ALL: process.argv.includes('--all')
};

// Show usage if no action specified
if (!args.ALL && !args.TEST_ONLY && !args.DEPT && !args.TIER && !args.LIMIT && !args.END) {
  console.log(`
Usage: node generate-commune-intro-text-parallel.cjs [options]

Options:
  --all            Process all communes
  --test           Test mode (5 communes)
  --skip-existing  Skip communes that already have introText
  --start=N        Start at commune index N (default: 0)
  --end=N          End at commune index N (exclusive)
  --process-id=ID  Process identifier for parallel runs
  --delay=MS       Delay between API calls in ms (default: 2400)
  --dept=XX        Filter by department (e.g., 75, 77)
  --tier=X         Filter by tier (A, B, C, D)
  --limit=N        Limit to N communes
  --dry-run        Test without saving

Examples:
  # Process first half with skip-existing
  node generate-commune-intro-text-parallel.cjs --all --skip-existing --start=0 --end=650 --process-id=1

  # Process second half
  node generate-commune-intro-text-parallel.cjs --all --skip-existing --start=650 --process-id=2
`);
  process.exit(0);
}

// Paris arrondissement context mapping
const PARIS_ARRONDISSEMENT_CONTEXT = {
  'paris-1er': {
    landmarks: 'Louvre, Châtelet-Les Halles, place Vendôme',
    character: 'quartier historique et commercial prestigieux',
    areas: 'du Palais Royal aux Halles'
  },
  'paris-2e': {
    landmarks: 'Grands Boulevards, passages couverts',
    character: 'quartier d\'affaires et commercial',
    areas: 'de la Bourse à Sentier'
  },
  'paris-3e': {
    landmarks: 'place des Vosges, musée Carnavalet',
    character: 'cœur historique du Marais',
    areas: 'du Temple au Marais'
  },
  'paris-4e': {
    landmarks: 'Notre-Dame, Hôtel de Ville, île Saint-Louis',
    character: 'quartier historique emblématique',
    areas: 'de l\'île de la Cité au Marais'
  },
  'paris-5e': {
    landmarks: 'Panthéon, Sorbonne, jardin du Luxembourg',
    character: 'Quartier Latin historique',
    areas: 'de Saint-Michel à la Contrescarpe'
  },
  'paris-6e': {
    landmarks: 'Saint-Germain-des-Prés, jardin du Luxembourg',
    character: 'quartier littéraire et artistique',
    areas: 'de Saint-Sulpice à Odéon'
  },
  'paris-7e': {
    landmarks: 'Tour Eiffel, Invalides, musée d\'Orsay',
    character: 'quartier ministériel prestigieux',
    areas: 'du Champ de Mars à Saint-Germain'
  },
  'paris-8e': {
    landmarks: 'Champs-Élysées, Arc de Triomphe, place de la Concorde',
    character: 'quartier d\'affaires prestigieux',
    areas: 'de l\'Étoile à la Madeleine'
  },
  'paris-9e': {
    landmarks: 'Opéra, Grands Boulevards, Pigalle',
    character: 'quartier animé et commerçant',
    areas: 'de l\'Opéra aux Grands Boulevards'
  },
  'paris-10e': {
    landmarks: 'Canal Saint-Martin, Gare du Nord, Gare de l\'Est',
    character: 'quartier populaire et multiculturel',
    areas: 'de République au canal Saint-Martin'
  },
  'paris-11': {
    landmarks: 'Bastille, Oberkampf, République',
    character: 'quartier dynamique et festif',
    areas: 'de Bastille à Belleville'
  },
  'paris-12e': {
    landmarks: 'Gare de Lyon, Bercy, bois de Vincennes',
    character: 'quartier résidentiel et d\'affaires',
    areas: 'de Bastille à Vincennes'
  },
  'paris-13e': {
    landmarks: 'Bibliothèque François-Mitterrand, Butte-aux-Cailles',
    character: 'quartier universitaire et asiatique',
    areas: 'de la Gare d\'Austerlitz à Ivry'
  },
  'paris-14e': {
    landmarks: 'Montparnasse, Catacombes, parc Montsouris',
    character: 'quartier artistique historique',
    areas: 'de Montparnasse à Alésia'
  },
  'paris-15e': {
    landmarks: 'parc André-Citroën, Front de Seine, Beaugrenelle',
    character: 'quartier résidentiel familial',
    areas: 'de Grenelle à la porte de Versailles'
  },
  'paris-16e': {
    landmarks: 'Trocadéro, bois de Boulogne, Passy',
    character: 'quartier résidentiel huppé',
    areas: 'du Trocadéro à Auteuil'
  },
  'paris-17e': {
    landmarks: 'parc Monceau, Batignolles, place de Clichy',
    character: 'quartier bourgeois et village',
    areas: 'des Batignolles aux Ternes'
  },
  'paris-18e': {
    landmarks: 'Montmartre, Sacré-Cœur, Moulin Rouge',
    character: 'quartier touristique et populaire',
    areas: 'de Montmartre à la Goutte d\'Or'
  },
  'paris-19e': {
    landmarks: 'Buttes-Chaumont, La Villette, Canal de l\'Ourcq',
    character: 'quartier familial et culturel',
    areas: 'de Belleville à La Villette'
  },
  'paris-20e': {
    landmarks: 'Père-Lachaise, Belleville, Ménilmontant',
    character: 'quartier populaire et artistique',
    areas: 'de Belleville à Charonne'
  }
};

/**
 * Get Paris arrondissement context
 */
function getParisContext(slug) {
  // Map variations to canonical slugs
  const slugMap = {
    'paris-11e': 'paris-11',
    'paris-11': 'paris-11'
  };

  const canonicalSlug = slugMap[slug] || slug;
  return PARIS_ARRONDISSEMENT_CONTEXT[canonicalSlug] || null;
}

/**
 * Post-process text to adjust length
 */
function adjustTextLength(text, targetMin = 440, targetMax = 520) {
  const length = text.length;

  if (length >= targetMin && length <= targetMax) {
    return { text, adjustment: 'none', originalLength: length };
  }

  // If too long, try trimming last sentence
  if (length > targetMax) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length > 3) {
      // Remove last sentence
      const shortened = sentences.slice(0, -1).join('').trim();
      if (shortened.length >= targetMin) {
        return {
          text: shortened,
          adjustment: 'trimmed_last_sentence',
          originalLength: length
        };
      }
    }
  }

  // Return as-is if we can't adjust
  return { text, adjustment: 'cannot_adjust', originalLength: length };
}

/**
 * Validate generated text
 */
function validateIntroText(text, cityName, zipCode, department) {
  const errors = [];

  // Check length (acceptable range with buffer)
  if (text.length < 440) {
    errors.push(`Too short: ${text.length} chars (min 440)`);
  }
  if (text.length > 520) {
    errors.push(`Too long: ${text.length} chars (max 520)`);
  }

  // Normalize for comparison (remove accents)
  const normalizedText = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const normalizedCityName = cityName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Check city name presence (normalized)
  if (!normalizedText.includes(normalizedCityName)) {
    // Also check for zipcode as fallback
    if (!text.includes(zipCode)) {
      errors.push(`Missing city name "${cityName}" or zipcode "${zipCode}"`);
    }
  }

  // Check for markdown symbols
  if (text.includes('*') || text.includes('#') || text.includes('`')) {
    errors.push('Contains markdown symbols');
  }

  return {
    valid: errors.length === 0,
    errors,
    length: text.length
  };
}

/**
 * Generate contextual intro text for a commune
 */
async function generateIntroText(commune, retryCount = 0) {
  const maxRetries = 3;

  // Get Paris-specific context if applicable
  const parisContext = commune.department === '75' ? getParisContext(commune.slug) : null;

  // Build context-aware prompt
  let contextualElements = '';

  if (parisContext) {
    contextualElements = `
Contexte spécifique pour ${commune.city}:
- Landmarks: ${parisContext.landmarks}
- Caractère: ${parisContext.character}
- Zone: ${parisContext.areas}`;
  } else {
    // Generic context based on tier
    const tierContext = {
      'A': 'grande métropole avec infrastructure complexe',
      'B': 'ville importante avec mixité urbaine',
      'C': 'commune dynamique avec habitat diversifié',
      'D': 'commune résidentielle avec tissu local'
    };
    contextualElements = `Contexte: ${tierContext[commune.tier] || 'commune locale'}`;
  }

  // Add feedback if this is a retry
  const retryFeedback = commune.previousLength ?
    `\n⚠️ ATTENTION: Tentative précédente était ${commune.previousLength} caractères - TROP LONG!\nGénérez EXACTEMENT 430-470 caractères cette fois.\n` : '';

  const prompt = `Générez EXACTEMENT 3 phrases pour un texte d'introduction contextuel pour un électricien à ${commune.city} (${commune.zipCode}).
${retryFeedback}
${contextualElements}

Instructions STRICTES:
1. EXACTEMENT 3 phrases, séparées par des points
2. Longueur totale: 430-470 caractères (OBLIGATOIRE)
3. Première phrase: Contexte géographique et architectural (mentionner ${commune.city} et caractéristiques locales)
4. Deuxième phrase: Besoins électriques spécifiques de la zone
5. Troisième phrase: Notre présence et disponibilité locale

Structure OBLIGATOIRE des 3 phrases:
1. "À [Ville], [contexte géographique/architectural], [type de bâtiments]..."
2. "Les installations [caractéristiques] nécessitent [besoins spécifiques]..."
3. "Nos électriciens interviennent [rapidité/zone] pour [services]..."

INTERDICTIONS:
- PAS de guillemets
- PAS de markdown (* # \`)
- PAS de superlatifs excessifs
- PAS plus de 3 phrases

Département: ${commune.department} (${DEPARTMENT_NAMES[commune.department] || 'Île-de-France'})
Code postal: ${commune.zipCode}
Ville exacte: ${commune.city}

Générez UNIQUEMENT le texte de 3 phrases (430-470 caractères):`;

  try {
    const message = await anthropic.messages.create({
      model: CONFIG.MODEL,
      max_tokens: 150,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let generatedText = message.content[0].text.trim();

    // Remove quotes if present
    generatedText = generatedText.replace(/^["']|["']$/g, '');
    generatedText = generatedText.replace(/\\n/g, ' ');

    // Post-process for length if needed
    const adjusted = adjustTextLength(generatedText);
    if (adjusted.adjustment !== 'none') {
      console.log(`    Adjusted length: ${adjusted.originalLength} → ${adjusted.text.length} chars (${adjusted.adjustment})`);
    }
    generatedText = adjusted.text;

    // Validate
    const validation = validateIntroText(generatedText, commune.city, commune.zipCode, commune.department);

    if (!validation.valid && retryCount < maxRetries) {
      console.log(`    Attempt ${retryCount + 1} validation failed: ${validation.errors.join(', ')}`);
      // Shorter delay for retries
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Add feedback about length to next attempt
      commune.previousLength = generatedText.length;
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
  if (args.DRY_RUN) {
    console.log('    [DRY RUN] Would store intro text');
    return true;
  }

  // Update frontmatter file
  const contentPath = path.join(__dirname, '..', 'content', commune.url_path.replace(/^\//, ''), 'index.md');
  if (fs.existsSync(contentPath)) {
    try {
      const fileContent = fs.readFileSync(contentPath, 'utf-8');
      const parsed = matter(fileContent);
      parsed.data.introText = introText;
      parsed.data.introGeneratedAt = new Date().toISOString();

      const updated = matter.stringify(parsed.content, parsed.data);
      fs.writeFileSync(contentPath, updated);
      return true;
    } catch (err) {
      console.log(`    Frontmatter update error: ${err.message}`);
      return false;
    }
  } else {
    console.log(`    Content file not found: ${contentPath}`);
    return false;
  }
}

/**
 * Check if commune already has intro text
 */
function hasExistingIntroText(commune) {
  const contentPath = path.join(__dirname, '..', 'content', commune.url_path.replace(/^\//, ''), 'index.md');
  if (!fs.existsSync(contentPath)) return false;

  try {
    const fileContent = fs.readFileSync(contentPath, 'utf-8');
    const parsed = matter(fileContent);
    return !!parsed.data.introText && parsed.data.introText.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Main generation function
 */
async function generateCommuneIntros() {
  const timestamp = new Date().toISOString().split('T')[0];

  console.log('═'.repeat(80));
  console.log(`  PARALLEL INTRO TEXT GENERATION`);
  console.log(`  Process ID: ${args.PROCESS_ID}`);
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Mode: ${args.DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Skip existing: ${args.SKIP_EXISTING ? 'YES' : 'NO'}`);
  console.log(`Range: ${args.START}-${args.END || 'END'}`);
  console.log(`Delay: ${args.DELAY}ms between calls`);
  console.log('');

  // Load commune data from sitemap
  console.log('📂 Loading commune data...');
  const sitemapPath = path.join(__dirname, '..', 'data', 'sitemap_pages.json');
  const sitemapData = JSON.parse(fs.readFileSync(sitemapPath, 'utf-8'));

  // Collect all pages from all tiers
  let allPages = [];
  if (sitemapData.organized) {
    Object.keys(sitemapData.organized).forEach(tierKey => {
      const tierData = sitemapData.organized[tierKey];
      if (Array.isArray(tierData)) {
        allPages = allPages.concat(tierData);
      } else if (typeof tierData === 'object') {
        // It's organized by department
        Object.values(tierData).forEach(deptPages => {
          if (Array.isArray(deptPages)) {
            allPages = allPages.concat(deptPages);
          }
        });
      }
    });
  }

  // Filter and extract only commune pages (not homepage, services, etc.)
  let communes = allPages
    .filter(page => page.city_name && page.page_type === 'city')
    .map(page => ({
      city: page.city_name,
      slug: page.url_path.replace(/^\//, '').replace(/\/$/, ''),
      url_path: page.url_path,
      department: page.department,
      zipCode: page.zip_code,
      tier: page.tier || 'D'
    }));

  const totalCommunes = communes.length;
  console.log(`✅ Found ${totalCommunes} total communes`);

  // Apply filters
  if (args.TEST_ONLY) {
    communes = communes.slice(0, 5);
    console.log('Test mode: Limited to 5 communes');
  }

  if (args.DEPT) {
    communes = communes.filter(c => c.department === args.DEPT);
    console.log(`Filtered by department ${args.DEPT}: ${communes.length} communes`);
  }

  if (args.TIER) {
    communes = communes.filter(c => c.tier === args.TIER);
    console.log(`Filtered by tier ${args.TIER}: ${communes.length} communes`);
  }

  // Skip existing if requested
  if (args.SKIP_EXISTING) {
    const originalCount = communes.length;
    communes = communes.filter(commune => !hasExistingIntroText(commune));
    console.log(`Filtered existing: ${originalCount} → ${communes.length} (skipped ${originalCount - communes.length})`);
  }

  // Apply range filtering
  if (args.START !== 0 || args.END !== null) {
    const originalCount = communes.length;
    const endIndex = args.END || communes.length;
    communes = communes.slice(args.START, endIndex);
    console.log(`Range filter: [${args.START}:${endIndex}] → ${communes.length} communes`);
  }

  if (args.LIMIT) {
    communes = communes.slice(0, args.LIMIT);
    console.log(`Limited to ${args.LIMIT} communes`);
  }

  // Process communes
  console.log('');
  console.log('🚀 Starting generation...');
  console.log('');
  console.log('═'.repeat(80));
  console.log('');

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < communes.length; i++) {
    const commune = communes[i];
    const globalIndex = args.START + i + 1;

    console.log(`[${globalIndex}/${totalCommunes}] ${commune.city} (${commune.zipCode})`);
    console.log(`  Tier: ${commune.tier}, Dept: ${commune.department}`);
    console.log(`  Generating intro text...`);

    const result = await generateIntroText(commune);

    if (result.success) {
      console.log(`  ✓ Generated: ${result.length} chars (attempt ${result.attempts})`);
      console.log(`  Preview: "${result.text.substring(0, 100)}..."`);

      // Store the text
      const stored = await storeIntroText(commune, result.text);
      if (stored) {
        console.log(`  ✓ Stored successfully`);
        successCount++;
      } else {
        console.log(`  ⚠ Storage failed`);
      }

      results.push({
        commune: commune.city,
        tier: commune.tier,
        department: commune.department,
        charCount: result.length,
        text: result.text,
        success: true
      });

      if (result.usage) {
        totalInputTokens += result.usage.input_tokens;
        totalOutputTokens += result.usage.output_tokens;
      }
    } else {
      console.log(`  ✗ Generation failed: ${result.error || result.errors?.join(', ') || 'Unknown error'}`);
      failCount++;

      results.push({
        commune: commune.city,
        tier: commune.tier,
        department: commune.department,
        success: false,
        error: result.error || result.errors?.join(', ')
      });
    }

    console.log('');

    // Delay between API calls (customizable for parallel coordination)
    if (i < communes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, args.DELAY));
    }
  }

  // Summary
  console.log('═'.repeat(80));
  console.log('  GENERATION COMPLETE');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Process ID: ${args.PROCESS_ID}`);
  console.log(`Processed: ${communes.length} communes`);
  console.log(`Successful: ${successCount} (${Math.round(successCount/communes.length*100)}%)`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total tokens: ${totalInputTokens} in, ${totalOutputTokens} out`);

  const cost = calculateCost(totalInputTokens, totalOutputTokens, CONFIG.MODEL);
  console.log(`Estimated cost: $${cost.cost.toFixed(4)}`);

  // Save results
  const filename = `commune-intro-text-${timestamp}-p${args.PROCESS_ID}.json`;
  const output = {
    metadata: {
      mode: args.DRY_RUN ? 'dry_run' : 'live',
      processId: args.PROCESS_ID,
      range: `${args.START}-${args.END || 'END'}`,
      skipExisting: args.SKIP_EXISTING,
      delay: args.DELAY,
      processed: communes.length,
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
generateCommuneIntros().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});