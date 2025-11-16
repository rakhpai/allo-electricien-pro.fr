#!/usr/bin/env node

/**
 * Electrician Card Personalization Script
 * Generates AI-powered localized content for electrician cards on each commune page
 *
 * Features:
 * - Localized bio (40-60 words) mentioning commune
 * - Local badge text (5-10 words)
 * - Service highlight (15-25 words)
 * - Trust signal (10-15 words)
 * - Why this commune explanation (30-50 words)
 * - Checkpoint system for resume capability
 * - Cost tracking
 */

const {
  anthropic,
  CONFIG,
  sleep,
  toProperCase,
  DEPARTMENT_NAMES,
  calculateCost
} = require('./ai-config.cjs');

const fs = require('fs');
const path = require('path');

// Command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  DEPT: process.argv.find(arg => arg.startsWith('--dept='))?.split('=')[1] || null,
  TIER: process.argv.find(arg => arg.startsWith('--tier='))?.split('=')[1] || null,
  LIMIT: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  OFFSET: parseInt(process.argv.find(arg => arg.startsWith('--offset='))?.split('=')[1]) || 0,
  USE_SONNET: process.argv.includes('--use-sonnet'),
  RESUME: process.argv.includes('--resume'),
  ALL: process.argv.includes('--all')
};

// Select model - use Haiku 4.5 by default
const MODEL = args.USE_SONNET ? CONFIG.MODEL_SONNET : 'claude-haiku-4-5-20251001';
const CHECKPOINT_FILE = 'checkpoint-electrician-cards.json';
const OUTPUT_FILE = path.join(__dirname, '../data/electrician_commune_context.json');
const DELAY_MS = CONFIG.DELAY_MS;

/**
 * Load checkpoint if exists
 */
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      console.log('📂 Checkpoint loaded');
      console.log(`   Last processed: ${data.lastProcessedCommune}`);
      console.log(`   Progress: ${data.processed.successful}/${data.processed.total}`);
      return data;
    }
  } catch (err) {
    console.log('⚠️  Error loading checkpoint:', err.message);
  }
  return null;
}

/**
 * Save checkpoint
 */
function saveCheckpoint(data) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('⚠️  Error saving checkpoint:', err.message);
  }
}

/**
 * Validate French content
 */
function validateFrenchContent(text, fieldName = 'content') {
  const englishIndicators = [
    /\belectricians?\s+in\b/i,
    /\bknowledge of\b/i,
    /\brapid response\b/i,
    /\bavailability\s+(and|for)\b/i,
    /\bunderstand(s)?\s+the\b/i
  ];

  for (const pattern of englishIndicators) {
    if (pattern.test(text)) {
      console.log(`    ⚠️  English detected in ${fieldName}: ${text.substring(0, 50)}...`);
      return false;
    }
  }
  return true;
}

/**
 * Generate localized bio (40-60 words)
 */
async function generateLocalizedBio(electrician, commune) {
  const cityName = toProperCase(commune.city_name || commune.slug);
  const dept = DEPARTMENT_NAMES[commune.department] || 'Île-de-France';

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS.

Électricien: ${electrician.first_name} ${electrician.last_name}
Spécialité: ${electrician.specialty_primary}
Expérience: ${electrician.years_experience} ans
Bio originale: ${electrician.bio_short}

Commune: ${cityName}
Code postal: ${commune.zip_code}
Département: ${commune.department} - ${dept}

Générez une bio personnalisée (40-60 mots) qui:
- Mentionne la commune "${cityName}" naturellement
- Intègre la spécialité de l'électricien
- Évoque les caractéristiques locales (bâtiments haussmanniens, pavillons, immeubles modernes, etc.)
- Reste professionnelle et rassurante
- Inclut des références géographiques locales si pertinent

IMPORTANT:
- EXACTEMENT 40-60 mots
- 100% en français
- Ton professionnel et local
- Pas de marketing agressif

Retournez UNIQUEMENT le texte de la bio, sans guillemets ni explication.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 150,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();

  // Validate French
  if (!validateFrenchContent(text, 'bio')) {
    return {
      text: electrician.bio_short, // Fallback to original
      usage: response.usage,
      fallback: true
    };
  }

  return {
    text,
    usage: response.usage,
    fallback: false
  };
}

/**
 * Generate local badge (5-10 words)
 */
async function generateLocalBadge(electrician, commune) {
  const cityName = toProperCase(commune.city_name || commune.slug);

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS.

Générez un badge court (5-10 mots) pour un électricien dans la commune de ${cityName}.

EXEMPLES VALIDES:
- "Expert de ${cityName}"
- "Spécialiste ${cityName} depuis 5 ans"
- "${commune.zip_code} - Intervention rapide"
- "Connaît parfaitement ${cityName}"

IMPORTANT:
- EXACTEMENT 5-10 mots
- 100% en français
- Court et percutant
- Évoque l'expertise locale

Retournez UNIQUEMENT le texte du badge, sans guillemets.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 50,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim().replace(/^["']|["']$/g, '');

  return {
    text,
    usage: response.usage
  };
}

/**
 * Generate service highlight (15-25 words)
 */
async function generateServiceHighlight(electrician, commune) {
  const cityName = toProperCase(commune.city_name || commune.slug);

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS.

Électricien spécialité: ${electrician.specialty_primary}
Commune: ${cityName}

Générez une phrase courte (15-25 mots) qui met en avant l'expertise de cet électricien pour ${cityName}.

EXEMPLES:
- "Spécialiste des installations électriques dans les pavillons de ${cityName}"
- "Expert en rénovation électrique pour les immeubles anciens de ${cityName}"
- "Interventions fréquentes sur les bâtiments haussmanniens du quartier"

IMPORTANT:
- 15-25 mots exactement
- Lien avec la spécialité et la commune
- Style professionnel
- 100% en français

Retournez UNIQUEMENT la phrase, sans guillemets.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 80,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim().replace(/^["']|["']$/g, '');

  return {
    text,
    usage: response.usage
  };
}

/**
 * Generate trust signal (10-15 words)
 */
async function generateTrustSignal(electrician, commune) {
  const cityName = toProperCase(commune.city_name || commune.slug);

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS.

Commune: ${cityName}
Expérience: ${electrician.years_experience} ans

Générez un signal de confiance court (10-15 mots) pour cet électricien dans ${cityName}.

EXEMPLES:
- "127 interventions réussies à ${cityName}"
- "Disponible sous 20min dans ${cityName}"
- "${electrician.years_experience} ans d'expérience dans le secteur ${commune.zip_code}"
- "95% de clients satisfaits à ${cityName}"

IMPORTANT:
- 10-15 mots exactement
- Chiffre/stat si possible
- Crédible et professionnel
- 100% en français

Retournez UNIQUEMENT le signal, sans guillemets.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 60,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim().replace(/^["']|["']$/g, '');

  return {
    text,
    usage: response.usage
  };
}

/**
 * Generate "why this commune" explanation (30-50 words)
 */
async function generateWhyThisCommune(electrician, commune) {
  const cityName = toProperCase(commune.city_name || commune.slug);
  const dept = DEPARTMENT_NAMES[commune.department] || '';

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS.

Électricien: ${electrician.first_name} ${electrician.last_name}
Commune: ${cityName}
Département: ${dept}

Expliquez en 30-50 mots pourquoi cet électricien est un bon choix pour ${cityName}.

Points à évoquer:
- Connaissance des spécificités locales (bâtiments, quartiers)
- Proximité et temps d'intervention rapide
- Expérience dans cette zone

IMPORTANT:
- 30-50 mots exactement
- 100% en français
- Ton professionnel et rassurant
- Spécifique à ${cityName}

Retournez UNIQUEMENT le texte, sans guillemets.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 120,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim().replace(/^["']|["']$/g, '');

  return {
    text,
    usage: response.usage
  };
}

/**
 * Process a single electrician-commune pair
 */
async function processElectricianCommune(electrician, commune, stats) {
  console.log(`  Processing: ${electrician.first_name} ${electrician.last_name} for ${commune.slug}`);

  const allUsage = [];

  // Generate all 5 content types
  const bio = await generateLocalizedBio(electrician, commune);
  allUsage.push(bio.usage);
  await sleep(DELAY_MS);

  const badge = await generateLocalBadge(electrician, commune);
  allUsage.push(badge.usage);
  await sleep(DELAY_MS);

  const serviceHighlight = await generateServiceHighlight(electrician, commune);
  allUsage.push(serviceHighlight.usage);
  await sleep(DELAY_MS);

  const trustSignal = await generateTrustSignal(electrician, commune);
  allUsage.push(trustSignal.usage);
  await sleep(DELAY_MS);

  const whyCommune = await generateWhyThisCommune(electrician, commune);
  allUsage.push(whyCommune.usage);

  // Update stats
  allUsage.forEach(usage => {
    stats.inputTokens += usage.input_tokens;
    stats.outputTokens += usage.output_tokens;
  });
  stats.apiCalls += 5;

  return {
    profile_id: electrician.id,
    commune_slug: commune.slug,
    bio_localized: bio.text,
    local_badge: badge.text,
    service_highlight: serviceHighlight.text,
    trust_signal: trustSignal.text,
    why_this_commune: whyCommune.text,
    generated_at: new Date().toISOString(),
    used_fallback: bio.fallback || false
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Electrician Card Enhancement Script');
  console.log(`📊 Model: ${MODEL}`);
  console.log('');

  // Load data files
  const profilesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/electricien_profiles.json'), 'utf-8'));
  const sitemapData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/sitemap_pages.json'), 'utf-8'));

  // Extract all communes from organized tiers
  let communes = [];

  // Tier B (Paris arrondissements)
  if (sitemapData.organized.tier_b?.paris) {
    communes = communes.concat(sitemapData.organized.tier_b.paris);
  }

  // Tier C
  if (sitemapData.organized.tier_c_by_dept) {
    Object.values(sitemapData.organized.tier_c_by_dept).forEach(deptCommunes => {
      if (Array.isArray(deptCommunes)) {
        communes = communes.concat(deptCommunes);
      }
    });
  }

  // Tier D
  if (sitemapData.organized.tier_d_by_dept) {
    Object.values(sitemapData.organized.tier_d_by_dept).forEach(deptCommunes => {
      if (Array.isArray(deptCommunes)) {
        communes = communes.concat(deptCommunes);
      }
    });
  }

  // Filter out non-commune/city pages and add slug field
  communes = communes
    .filter(c => (c.page_type === 'commune' || c.page_type === 'city') && c.city_name)
    .map(c => ({
      ...c,
      slug: c.url_path.replace(/^\//, '').replace(/\/$/, '')
    }));

  if (args.TEST_ONLY) {
    // Test on 5 specific communes
    const testSlugs = ['paris-1er', 'sevres', 'versailles', 'chailly-en-biere', 'cessoy-en-montois'];
    communes = communes.filter(c => testSlugs.includes(c.slug));
    console.log(`🧪 TEST MODE: Processing ${communes.length} communes`);
  } else if (args.TIER) {
    communes = communes.filter(c => c.tier === args.TIER);
    console.log(`📌 Tier filter: ${args.TIER} (${communes.length} communes)`);
  } else if (args.DEPT) {
    communes = communes.filter(c => c.department === args.DEPT);
    console.log(`📌 Department filter: ${args.DEPT} (${communes.length} communes)`);
  } else if (args.ALL) {
    console.log(`📌 Processing ALL communes (${communes.length} total)`);
  } else {
    console.log('⚠️  No filter specified. Use --test, --tier=X, --dept=XX, or --all');
    process.exit(1);
  }

  // Apply offset and limit for parallel processing
  if (args.OFFSET > 0) {
    communes = communes.slice(args.OFFSET);
    console.log(`📌 Offset: skipping first ${args.OFFSET} communes`);
  }

  if (args.LIMIT) {
    communes = communes.slice(0, args.LIMIT);
    console.log(`📌 Limit: processing ${args.LIMIT} communes`);
  }

  // Load checkpoint or initialize
  let checkpoint = args.RESUME ? loadCheckpoint() : null;
  let output = checkpoint?.output || {
    generated_at: new Date().toISOString(),
    model: MODEL,
    by_commune: {}
  };

  const stats = {
    inputTokens: checkpoint?.stats?.inputTokens || 0,
    outputTokens: checkpoint?.stats?.outputTokens || 0,
    apiCalls: checkpoint?.stats?.apiCalls || 0,
    total: communes.length,
    processed: checkpoint?.processed?.successful || 0,
    errors: checkpoint?.processed?.errors || 0
  };

  // Process communes
  for (const commune of communes) {
    // Skip if already processed
    if (checkpoint && checkpoint.processedCommunes?.includes(commune.slug)) {
      console.log(`⏭️  Skipping ${commune.slug} (already processed)`);
      continue;
    }

    console.log(`\n📍 ${commune.city_name} (${commune.slug}) - ${commune.zip_code}`);

    // Get electricians for this commune
    const electricians = profilesData.by_city[commune.slug] || [];

    if (electricians.length === 0) {
      console.log(`  ⚠️  No electricians assigned to ${commune.slug}`);
      continue;
    }

    console.log(`  ${electricians.length} electricians assigned`);

    // Initialize commune entry
    output.by_commune[commune.slug] = {
      commune_name: commune.city_name,
      postal_code: commune.zip_code,
      department: commune.department,
      electricians: {}
    };

    // Process each electrician for this commune
    for (const electrician of electricians) {
      try {
        const context = await processElectricianCommune(electrician, commune, stats);
        output.by_commune[commune.slug].electricians[electrician.id] = context;
        stats.processed++;
      } catch (err) {
        console.error(`  ❌ Error processing ${electrician.first_name} ${electrician.last_name}:`, err.message);
        stats.errors++;
      }
    }

    // Save checkpoint every 10 communes
    if ((stats.processed) % 10 === 0) {
      saveCheckpoint({
        lastProcessedCommune: commune.slug,
        processedCommunes: Object.keys(output.by_commune),
        processed: {
          successful: stats.processed,
          errors: stats.errors,
          total: communes.length
        },
        stats: {
          inputTokens: stats.inputTokens,
          outputTokens: stats.outputTokens,
          apiCalls: stats.apiCalls
        },
        output
      });
      console.log(`  💾 Checkpoint saved (${stats.processed}/${stats.total})`);
    }
  }

  // Calculate final cost
  const costCalc = calculateCost(stats.inputTokens, stats.outputTokens, MODEL);
  const totalCost = costCalc.totalCost || 0;

  // Add metadata to output
  output.metadata = {
    total_communes: communes.length,
    total_pairs: stats.processed,
    total_errors: stats.errors,
    cost: {
      input_tokens: stats.inputTokens,
      output_tokens: stats.outputTokens,
      api_calls: stats.apiCalls,
      total_cost_usd: totalCost
    },
    generated_at: new Date().toISOString(),
    model: MODEL
  };

  // Save final output
  if (!args.DRY_RUN) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n✅ Output saved to ${OUTPUT_FILE}`);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total communes: ${communes.length}`);
  console.log(`Electrician-commune pairs processed: ${stats.processed}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`API calls: ${stats.apiCalls}`);
  console.log(`Input tokens: ${stats.inputTokens.toLocaleString()}`);
  console.log(`Output tokens: ${stats.outputTokens.toLocaleString()}`);
  console.log(`Estimated cost: $${totalCost.toFixed(2)}`);
  console.log('='.repeat(60));

  // Clean up checkpoint on success
  if (!args.DRY_RUN && fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('🧹 Checkpoint file removed');
  }
}

// Run
main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
