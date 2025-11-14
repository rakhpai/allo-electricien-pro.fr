#!/usr/bin/env node

/**
 * Generate Contextual Intro Text for All Commune Pages
 * Creates 450-500 character introductions with local landmarks and context
 * for 1,298 commune pages on allo-electricien.pro
 */

const {
  anthropic,
  supabase,
  CONFIG,
  sleep,
  toProperCase,
  DEPARTMENT_NAMES,
  calculateCost
} = require('./ai-config.cjs');

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  DEPT: process.argv.find(arg => arg.startsWith('--dept='))?.split('=')[1] || null,
  TIER: process.argv.find(arg => arg.startsWith('--tier='))?.split('=')[1] || null,
  LIMIT: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  ALL: process.argv.includes('--all')
};

// Paris arrondissement context
const PARIS_ARRONDISSEMENT_CONTEXT = {
  'paris-1er': {
    landmarks: 'Louvre, Châtelet-Les Halles, place Vendôme',
    character: 'quartier historique et commercial prestigieux',
    areas: 'du Palais Royal aux Halles'
  },
  'paris-2e': {
    landmarks: 'Bourse, Sentier, passages couverts',
    character: 'quartier d\'affaires et de la mode',
    areas: 'de la rue Montorgueil à Richelieu'
  },
  'paris-3e': {
    landmarks: 'Marais Nord, Temple, Archives nationales',
    character: 'quartier historique et branché',
    areas: 'du Carreau du Temple aux galeries d\'art'
  },
  'paris-4e': {
    landmarks: 'Notre-Dame, Hôtel de Ville, île de la Cité',
    character: 'cœur historique de Paris',
    areas: 'de l\'île Saint-Louis au Marais'
  },
  'paris-5e': {
    landmarks: 'Panthéon, Sorbonne, Quartier Latin',
    character: 'quartier universitaire historique',
    areas: 'de Saint-Michel à la Contrescarpe'
  },
  'paris-6e': {
    landmarks: 'Saint-Germain-des-Prés, Luxembourg, Odéon',
    character: 'quartier littéraire et chic',
    areas: 'de Saint-Sulpice au jardin du Luxembourg'
  },
  'paris-7e': {
    landmarks: 'Tour Eiffel, Invalides, musée d\'Orsay',
    character: 'quartier ministériel et monumental',
    areas: 'du Champ de Mars à Saint-Germain'
  },
  'paris-8e': {
    landmarks: 'Champs-Élysées, Arc de Triomphe, Madeleine',
    character: 'quartier du luxe et des affaires',
    areas: 'de l\'Étoile à la Concorde'
  },
  'paris-9e': {
    landmarks: 'Opéra, Grands Boulevards, grands magasins',
    character: 'quartier des théâtres et du shopping',
    areas: 'de Pigalle aux Grands Boulevards'
  },
  'paris-10e': {
    landmarks: 'Gare du Nord, Gare de l\'Est, Canal Saint-Martin',
    character: 'quartier populaire en mutation',
    areas: 'de République au canal'
  },
  'paris-11e': {
    landmarks: 'Bastille, République, Oberkampf',
    character: 'quartier animé et festif',
    areas: 'de Nation à République'
  },
  'paris-12e': {
    landmarks: 'Bercy, Gare de Lyon, Bois de Vincennes',
    character: 'quartier résidentiel et d\'affaires',
    areas: 'de Bastille à Vincennes'
  },
  'paris-13e': {
    landmarks: 'Bibliothèque François-Mitterrand, Butte-aux-Cailles',
    character: 'quartier multiculturel en développement',
    areas: 'de la BNF au quartier asiatique'
  },
  'paris-14e': {
    landmarks: 'Montparnasse, Denfert-Rochereau, Cité Universitaire',
    character: 'quartier résidentiel traditionnel',
    areas: 'de Montparnasse à Alésia'
  },
  'paris-15e': {
    landmarks: 'Tour Montparnasse, Parc André-Citroën, Beaugrenelle',
    character: 'quartier résidentiel familial',
    areas: 'de Grenelle à Vaugirard'
  },
  'paris-16e': {
    landmarks: 'Trocadéro, Passy, Bois de Boulogne',
    character: 'quartier résidentiel prestigieux',
    areas: 'de Passy à Auteuil'
  },
  'paris-17e': {
    landmarks: 'Batignolles, Monceau, Étoile',
    character: 'quartier bourgeois et village',
    areas: 'des Batignolles aux Ternes'
  },
  'paris-18e': {
    landmarks: 'Montmartre, Sacré-Cœur, Moulin Rouge',
    character: 'quartier touristique et populaire',
    areas: 'de la Butte Montmartre à la Goutte d\'Or'
  },
  'paris-19e': {
    landmarks: 'Buttes-Chaumont, La Villette, Belleville',
    character: 'quartier populaire et cosmopolite',
    areas: 'de Belleville à Stalingrad'
  },
  'paris-20e': {
    landmarks: 'Père-Lachaise, Belleville, Ménilmontant',
    character: 'quartier populaire et artistique',
    areas: 'de Gambetta à Nation'
  }
};

// Major suburbs (Tier C) context
const MAJOR_SUBURBS_CONTEXT = {
  'versailles': {
    landmarks: 'château, quartiers Saint-Louis et Notre-Dame',
    character: 'ville royale aux monuments historiques'
  },
  'boulogne-billancourt': {
    landmarks: 'proximité La Défense, île Seguin',
    character: 'dynamique ville d\'affaires'
  },
  'nanterre': {
    landmarks: 'La Défense, université, préfecture',
    character: 'pôle économique et administratif'
  },
  'argenteuil': {
    landmarks: 'bords de Seine, centre historique',
    character: 'grande ville résidentielle'
  },
  'montreuil': {
    landmarks: 'proximité Paris, Croix de Chavaux',
    character: 'ville créative et dynamique'
  },
  'saint-denis': {
    landmarks: 'Stade de France, basilique',
    character: 'ville historique en transformation'
  },
  'rueil-malmaison': {
    landmarks: 'château de Malmaison, quartier d\'affaires',
    character: 'ville résidentielle et d\'entreprises'
  }
  // Add more as needed
};

/**
 * Get tier description for prompt
 */
function getTierDescription(tier) {
  const descriptions = {
    'tier_b': 'Arrondissement parisien - quartier dense urbain',
    'tier_c': 'Grande ville de banlieue - pôle urbain majeur',
    'tier_d': 'Commune résidentielle - cadre de vie périurbain'
  };
  return descriptions[tier] || 'Commune standard';
}

/**
 * Get example intro for tier
 */
function getExampleForTier(tier, commune) {
  const examples = {
    'tier_b': `"Au cœur du ${commune.city_name}, entre [landmark1] et [landmark2], les installations électriques des [type de bâtiments] nécessitent une expertise adaptée aux contraintes du quartier. De [zone1] à [zone2], nos électriciens maîtrisent les spécificités locales. Intervention rapide 24h/24 dans tout l'arrondissement, des immeubles haussmanniens aux commerces."`,

    'tier_c': `"À ${commune.city_name}, [caractéristique ville], l'entretien des installations électriques demande polyvalence et réactivité. Des [type quartier1] aux [type quartier2], nos professionnels interviennent sur tous types de bâtiments. Service d'urgence disponible pour tous les habitants, dépannage express dans tous les quartiers."`,

    'tier_d': `"${commune.city_name}, commune ${commune.department === '77' ? 'de Seine-et-Marne' : commune.department === '78' ? 'des Yvelines' : commune.department === '91' ? 'de l\'Essonne' : commune.department === '95' ? 'du Val-d\'Oise' : 'francilienne'}, allie habitat pavillonnaire et petits immeubles nécessitant des services électriques de proximité. Nos électriciens connaissent parfaitement le secteur et ses spécificités. Intervention rapide garantie, expertise locale pour tous vos besoins électriques."`
  };

  return examples[tier] || examples['tier_d'];
}

/**
 * Generate intro text prompt
 */
function generateIntroPrompt(commune) {
  const tier = commune.tier || 'tier_d';
  const dept = commune.department;
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

  // Get specific context for Paris or major suburbs
  let localContext = '';
  if (tier === 'tier_b') {
    const slug = commune.url_path.replace(/^\//, '');
    const parisContext = PARIS_ARRONDISSEMENT_CONTEXT[slug];
    if (parisContext) {
      localContext = `
SPECIFIC CONTEXT FOR ${cityName}:
- Landmarks: ${parisContext.landmarks}
- Character: ${parisContext.character}
- Areas: ${parisContext.areas}
`;
    }
  } else if (tier === 'tier_c') {
    const slug = commune.url_path.replace(/^\//, '');
    const suburbContext = MAJOR_SUBURBS_CONTEXT[slug];
    if (suburbContext) {
      localContext = `
SPECIFIC CONTEXT FOR ${cityName}:
- Key features: ${suburbContext.landmarks}
- Character: ${suburbContext.character}
`;
    }
  }

  return `You are a local content writer with deep knowledge of French geography, especially Île-de-France region.

Generate a compelling introduction for electrician services in:

LOCATION: ${cityName}
CODE POSTAL: ${commune.zip_code}
DÉPARTEMENT: ${dept} - ${DEPARTMENT_NAMES[dept] || 'Île-de-France'}
Type: ${getTierDescription(tier)}
${localContext}

CRITICAL REQUIREMENTS:
- Write EXACTLY 3 sentences (no more, no less)
- Total length: 450-500 characters (approximately 75-85 words)
- MUST mention "${cityName}" or "${commune.zip_code}" at least once
- Natural, professional French language

SENTENCE STRUCTURE (EXACTLY 3 SENTENCES):
1. First sentence (140-160 chars): Open with ${cityName} or "À ${cityName}", describe location character and context
2. Second sentence (180-200 chars): Explain why electrical services matter here, mention building types
3. Third sentence (120-160 chars): Coverage area and rapid response availability

CONTENT FOCUS:
- Include 1-2 local references based on location type
- Mention appropriate building types for the area
- Reference neighborhoods or areas when relevant
- End with service coverage and availability

DO NOT INCLUDE:
- Company names or phone numbers
- Prices or specific tariffs
- Generic statements that could apply anywhere
- Marketing fluff or excessive adjectives

${tier === 'tier_b' ? `For this Paris arrondissement, MUST reference:
- Specific landmarks or streets from the context provided
- The unique character of this particular arrondissement
- Mix of building types (Haussmannien, modern, commercial)` : ''}

${tier === 'tier_c' ? `For this major suburb, emphasize:
- Its role in the greater Paris area
- Mix of residential and commercial zones
- Any major business districts or transport hubs` : ''}

${tier === 'tier_d' ? `For this residential commune, focus on:
- Residential character (pavillons, small buildings)
- Local community feel
- Position relative to larger cities` : ''}

Example structure:
${getExampleForTier(tier, commune)}

Generate the introduction paragraph now. Return ONLY the text, no quotes or formatting.`;
}

/**
 * Validate intro text
 */
function validateIntroText(text, commune) {
  const errors = [];
  const charCount = text.length;

  // Check character count - with tolerance for close values
  if (charCount < 440) {
    errors.push(`Too short: ${charCount} chars (min 440)`);
  }
  if (charCount > 510) {
    errors.push(`Too long: ${charCount} chars (max 510)`);
  }

  // Check for forbidden content
  if (/\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/.test(text)) {
    errors.push('Contains phone number');
  }

  if (/€|euros?|tarif/i.test(text)) {
    errors.push('Contains pricing information');
  }

  // Check if city name is mentioned - normalize both sides for comparison
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));
  const normalizedCityName = cityName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/-/g, ' ');
  const normalizedText = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents

  // Check for city name OR zipcode
  const cityMentioned = normalizedText.includes(normalizedCityName) ||
                       text.includes(commune.zip_code);

  if (!cityMentioned) {
    errors.push(`City name not mentioned (looking for "${cityName}" or ${commune.zip_code})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    charCount
  };
}

/**
 * Adjust text length intelligently
 */
function adjustLength(text, targetMin = 450, targetMax = 500) {
  const length = text.length;

  // If within range, return as-is
  if (length >= targetMin && length <= targetMax) {
    return { text, adjusted: false };
  }

  // Primary target achieved
  if (length >= 440 && length <= 510) {
    return { text, adjusted: false };
  }

  // If too long but close (511-530), try intelligent trim
  if (length > 510 && length <= 530) {
    // Try to trim at sentence boundary
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    // If we have exactly 3 sentences, try trimming the last one
    if (sentences.length === 3) {
      const twoSentences = sentences.slice(0, 2).join('').trim();
      const lastSentence = sentences[2];

      // Try to shorten the last sentence
      if (lastSentence.length > 140) {
        // Find a good cutting point in the last sentence
        const shortenedLast = lastSentence.substring(0, 120) + '.';
        const adjusted = twoSentences + ' ' + shortenedLast;

        if (adjusted.length >= targetMin && adjusted.length <= targetMax + 10) {
          return { text: adjusted.trim(), adjusted: true, reason: 'trimmed_last_sentence' };
        }
      }
    }
  }

  // Otherwise, text needs to be regenerated
  return { text, adjusted: false, needsRegeneration: true };
}

/**
 * Generate intro text for a commune
 */
async function generateIntroText(commune) {
  let lastLength = null;
  let basePrompt = generateIntroPrompt(commune);

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Adapt prompt based on previous attempt
      let promptModifier = '';
      if (lastLength) {
        if (lastLength > 510) {
          promptModifier = `\n\nIMPORTANT: Previous attempt was TOO LONG (${lastLength} chars). Be MORE CONCISE. Use shorter sentences. Target: 450-500 chars (440-510 acceptable).`;
        } else if (lastLength < 440) {
          promptModifier = `\n\nIMPORTANT: Previous attempt was TOO SHORT (${lastLength} chars). Add MORE DETAIL. Elaborate slightly more. Target: 450-500 chars (440-510 acceptable).`;
        }
      }

      const prompt = basePrompt + promptModifier;

      const message = await anthropic.messages.create({
        model: CONFIG.MODEL,
        max_tokens: 150,  // Reduced from 300 for tighter control
        temperature: 0.3,  // Reduced from 0.7 for more controlled output
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const text = message.content[0].text.trim();
      lastLength = text.length;

      // Try to adjust length if slightly out of range
      const adjustment = adjustLength(text, 450, 500);

      // Use adjusted text if successful
      const finalText = adjustment.adjusted ? adjustment.text : text;
      const validation = validateIntroText(finalText, commune);

      if (validation.valid || adjustment.tolerance) {
        if (adjustment.adjusted) {
          console.log(`    Adjusted length: ${text.length} → ${finalText.length} chars (${adjustment.reason})`);
        } else if (adjustment.tolerance) {
          console.log(`    Accepted with tolerance: ${finalText.length} chars`);
        }

        return {
          success: true,
          text: finalText,
          charCount: finalText.length,
          tokens: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens
          },
          attempt,
          adjusted: adjustment.adjusted || adjustment.tolerance
        };
      }

      // If invalid, log and retry
      console.log(`    Attempt ${attempt} validation failed:`, validation.errors.join(', '));

      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(1000 * attempt); // Exponential backoff
      }

    } catch (error) {
      console.log(`    Attempt ${attempt} API error:`, error.message);
      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(2000 * attempt);
      }
    }
  }

  return {
    success: false,
    error: 'Max retries exceeded'
  };
}

/**
 * Store intro text in database or file
 */
async function storeIntroText(commune, introText) {
  if (args.DRY_RUN) {
    console.log('    [DRY RUN] Would store intro text');
    return true;
  }

  // Option 1: Update frontmatter file (primary method)
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
      console.log('    File update error:', err.message);
      return false;
    }
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('  CONTEXTUAL INTRO TEXT GENERATION');
  console.log('  1,298 Commune Pages');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Mode: ${args.DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Scope: ${args.TEST_ONLY ? 'TEST (5 communes)' : args.DEPT ? `Department ${args.DEPT}` : args.TIER ? `Tier ${args.TIER}` : args.LIMIT ? `Limited to ${args.LIMIT}` : 'ALL 1,298 communes'}`);
  console.log('');

  // Load commune data
  console.log('📂 Loading commune data...');
  const sitemapData = require('../data/sitemap_pages.json');

  // Get communes based on scope
  let communes = [];

  if (args.TEST_ONLY) {
    // Test with 5 specific communes
    const testSlugs = [
      '/paris-1er', '/versailles', '/meaux', '/poissy', '/evry'
    ];

    communes = [
      ...sitemapData.organized.tier_b.paris.filter(p => testSlugs.includes(p.url_path)),
      ...Object.values(sitemapData.organized.tier_c_by_dept).flat().filter(p => testSlugs.includes(p.url_path)),
      ...Object.values(sitemapData.organized.tier_d_by_dept).flat().filter(p => testSlugs.includes(p.url_path))
    ];
  } else if (args.DEPT) {
    // Filter by department
    communes = [
      ...sitemapData.organized.tier_c_by_dept[args.DEPT] || [],
      ...sitemapData.organized.tier_d_by_dept[args.DEPT] || []
    ];

    if (args.DEPT === '75') {
      communes = [...sitemapData.organized.tier_b.paris, ...communes];
    }
  } else if (args.TIER) {
    // Filter by tier
    if (args.TIER === 'tier_b') {
      communes = sitemapData.organized.tier_b.paris;
    } else if (args.TIER === 'tier_c') {
      communes = Object.values(sitemapData.organized.tier_c_by_dept).flat();
    } else if (args.TIER === 'tier_d') {
      communes = Object.values(sitemapData.organized.tier_d_by_dept).flat();
    }
  } else if (args.LIMIT) {
    // Limited number
    communes = [
      ...sitemapData.organized.tier_b.paris,
      ...Object.values(sitemapData.organized.tier_c_by_dept).flat(),
      ...Object.values(sitemapData.organized.tier_d_by_dept).flat()
    ].slice(0, args.LIMIT);
  } else {
    // All communes
    communes = [
      ...sitemapData.organized.tier_b.paris,
      ...Object.values(sitemapData.organized.tier_c_by_dept).flat(),
      ...Object.values(sitemapData.organized.tier_d_by_dept).flat()
    ];
  }

  console.log(`✅ Found ${communes.length} communes to process\n`);

  if (communes.length === 0) {
    console.log('❌ No communes found with given criteria');
    return;
  }

  // Process communes
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let successful = 0;
  let failed = 0;
  const results = [];

  console.log('🚀 Starting generation...\n');
  console.log('═'.repeat(80));

  for (let i = 0; i < communes.length; i++) {
    const commune = communes[i];
    const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

    console.log(`\n[${i + 1}/${communes.length}] ${cityName} (${commune.zip_code})`);
    console.log(`  Tier: ${commune.tier}, Dept: ${commune.department}`);

    // Generate intro text
    console.log('  Generating intro text...');
    const result = await generateIntroText(commune);

    if (result.success) {
      console.log(`  ✓ Generated: ${result.charCount} chars (attempt ${result.attempt})`);

      // Preview first 100 chars
      const preview = result.text.substring(0, 100) + '...';
      console.log(`  Preview: "${preview}"`);

      // Store the text
      const stored = await storeIntroText(commune, result.text);
      if (stored) {
        console.log('  ✓ Stored successfully');
      } else {
        console.log('  ⚠ Storage failed');
      }

      successful++;
      totalInputTokens += result.tokens.input;
      totalOutputTokens += result.tokens.output;

      results.push({
        commune: cityName,
        tier: commune.tier,
        department: commune.department,
        charCount: result.charCount,
        text: result.text,
        success: true
      });

    } else {
      console.log(`  ✗ Generation failed: ${result.error}`);
      failed++;

      results.push({
        commune: cityName,
        tier: commune.tier,
        department: commune.department,
        error: result.error,
        success: false
      });
    }

    // Rate limiting
    if (i < communes.length - 1) {
      await sleep(CONFIG.DELAY_MS);
    }

    // Progress report every 50
    if ((i + 1) % 50 === 0) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Progress: ${i + 1}/${communes.length} (${Math.round((i + 1) / communes.length * 100)}%)`);
      console.log(`Success: ${successful}, Failed: ${failed}`);
      console.log('─'.repeat(80));
    }
  }

  // Final report
  console.log('\n' + '═'.repeat(80));
  console.log('  GENERATION COMPLETE');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📊 Results:`);
  console.log(`  Total processed: ${communes.length}`);
  console.log(`  Successful: ${successful} (${Math.round(successful / communes.length * 100)}%)`);
  console.log(`  Failed: ${failed}`);
  console.log('');
  console.log(`🎯 Token Usage:`);
  console.log(`  Input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`  Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);

  const cost = calculateCost(totalInputTokens, totalOutputTokens, CONFIG.MODEL);
  console.log('');
  console.log(`💰 Cost:`);
  console.log(`  Model: ${CONFIG.MODEL}`);
  console.log(`  Total cost: $${cost.cost.toFixed(4)}`);

  if (args.TEST_ONLY || args.LIMIT || args.DEPT || args.TIER) {
    const fullEstimate = (cost.cost / communes.length) * 1298;
    console.log(`  Estimated full cost (1,298 communes): $${fullEstimate.toFixed(2)}`);
  }

  // Save results to file
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `commune-intro-text-${timestamp}${args.TEST_ONLY ? '-test' : args.DEPT ? `-dept-${args.DEPT}` : ''}.json`;

  fs.writeFileSync(filename, JSON.stringify({
    metadata: {
      mode: args.DRY_RUN ? 'dry_run' : 'live',
      scope: args.TEST_ONLY ? 'test' : args.DEPT ? `dept_${args.DEPT}` : args.TIER ? `tier_${args.TIER}` : 'all',
      processed: communes.length,
      successful,
      failed,
      totalTokens: totalInputTokens + totalOutputTokens,
      cost: cost.cost,
      timestamp: new Date().toISOString()
    },
    results
  }, null, 2));

  console.log('');
  console.log(`📄 Results saved to: ${filename}`);

  // Show sample results
  if (results.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log('  SAMPLE GENERATED INTROS');
    console.log('═'.repeat(80));

    const samples = results.filter(r => r.success).slice(0, 3);
    samples.forEach((sample, idx) => {
      console.log(`\n${idx + 1}. ${sample.commune} (${sample.department}, ${sample.tier})`);
      console.log('─'.repeat(40));
      console.log(`Characters: ${sample.charCount}`);
      console.log(`Text:\n${sample.text}`);
    });
  }

  if (args.DRY_RUN) {
    console.log('\n🔍 DRY RUN COMPLETE - No database changes made');
  } else if (args.TEST_ONLY) {
    console.log('\n🧪 TEST COMPLETE - Review results above');
    console.log('Run with --all to process all 1,298 communes');
  } else {
    console.log('\n✅ GENERATION COMPLETE');
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});