#!/usr/bin/env node

/**
 * AI-Powered Location-Specific Content Enhancements for Electrician Services
 * Generates contextual content for city pages on allo-electricien.pro
 * Adapted from locksmith to electrician services with relevant local context
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

// Command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  CITIES: process.argv.find(arg => arg.startsWith('--cities='))?.split('=')[1]?.split(',') || null
};

// Test cities for electrician services
const TEST_SLUGS = [
  'versailles',
  'paris',
  'rueil-malmaison',
  'meudon',
  'bezons'
];

// Track overall usage
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalCost = 0;

/**
 * Generate AI enhancements for electrician services
 */
async function generateElectricienEnhancements(city) {
  const prompt = `You are a professional electrician service content writer creating CONTEXTUAL enhancements for an electrician service page.

CRITICAL INSTRUCTIONS:
- Generate ONLY contextual introductory text
- DO NOT include business names, addresses, or phone numbers
- DO NOT replace existing data - you are ENHANCING it
- Focus on WHY the service matters, HOW it helps, WHEN to use it
- Each text should be city-specific and relevant to electrical services

City: ${city.name}
Department: ${city.department} (${DEPARTMENT_NAMES[city.department] || 'Île-de-France'})
Postal Code: ${city.postal_code}
Population: ${city.population?.toLocaleString() || 'N/A'}

Generate the following contextual enhancements for ELECTRICIAN services in JSON format:

{
  "hero_intro": "120-150 char city-specific intro for electrician hero section. Mention local context or neighborhood character for ${city.name}",
  "urgence_context": "80-120 char explaining electrical emergency services importance in ${city.name} (power outages, short circuits)",
  "insurance_context": "80-120 char explaining electrical work insurance coverage benefits for ${city.name} residents",
  "normes_context": "80-120 char explaining NF C 15-100 compliance importance in ${city.name}",
  "products_context": "80-120 char introducing electrical equipment/services available in ${city.name} (panels, outlets, switches)",
  "city_hall_context": "80-120 char explaining when to contact city hall for electrical permits in ${city.name}",
  "transport_context": "80-120 char about rapid electrician intervention accessibility in ${city.name}",
  "streets_context": "80-120 char emphasizing local knowledge of ${city.name} for quick response",
  "emergency_steps": "150-200 char: numbered steps for electrical emergency in ${city.name}. Format: '1. Coupez le disjoncteur 2. Appelez un électricien 3. Évitez de toucher'",
  "why_choose_us": "200-250 char: bulleted list of ${city.name}-specific electrician benefits. Format: '• Intervention rapide ${city.name} • Électriciens certifiés • Devis gratuit • Garantie décennale'",
  "tableau_context": "80-120 char about electrical panel upgrades and modernization needs in ${city.name}",
  "renovation_context": "80-120 char about electrical renovation needs for older buildings in ${city.name}",
  "diagnostic_context": "80-120 char explaining electrical diagnosis importance for ${city.name} property owners",
  "consuel_context": "80-120 char about Consuel certification requirements in ${city.name}"
}

Requirements:
- All text in French
- Natural, helpful tone
- City-specific (mention ${city.name} naturally)
- NO business names or contact info
- Focus on ELECTRICAL services (not locksmith)
- Focus on CONTEXT not DATA
- Be concise but informative
- Use electrical terminology (tableau électrique, disjoncteur, mise aux normes, etc.)`;

  const message = await anthropic.messages.create({
    model: CONFIG.MODEL,
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  // Parse JSON response
  const content = message.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid JSON response from AI');
  }

  const enhancements = JSON.parse(jsonMatch[0]);

  // Track tokens and cost
  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;
  const cost = calculateCost(inputTokens, outputTokens, CONFIG.MODEL);

  totalInputTokens += inputTokens;
  totalOutputTokens += outputTokens;
  totalCost += cost.cost;

  return {
    data: enhancements,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost: cost.cost
    }
  };
}

/**
 * Store enhancements in database
 */
async function storeEnhancements(city, enhancements) {
  if (args.DRY_RUN) {
    console.log('  [DRY RUN] Would store enhancements in database');
    return;
  }

  // Check if enhancements table exists, if not create it
  const { error: createError } = await supabase.rpc('create_enhancements_table_if_not_exists', {});

  // Store enhancements
  const { error } = await supabase
    .from('electricien_enhancements')
    .upsert({
      city_id: city.id,
      city_slug: city.slug,
      city_name: city.name,

      // AI-generated contextual text
      hero_intro: enhancements.data.hero_intro,
      urgence_context: enhancements.data.urgence_context,
      insurance_context: enhancements.data.insurance_context,
      normes_context: enhancements.data.normes_context,
      products_context: enhancements.data.products_context,
      city_hall_context: enhancements.data.city_hall_context,
      transport_context: enhancements.data.transport_context,
      streets_context: enhancements.data.streets_context,
      emergency_steps: enhancements.data.emergency_steps,
      why_choose_us: enhancements.data.why_choose_us,
      tableau_context: enhancements.data.tableau_context,
      renovation_context: enhancements.data.renovation_context,
      diagnostic_context: enhancements.data.diagnostic_context,
      consuel_context: enhancements.data.consuel_context,

      // Metadata
      total_input_tokens: enhancements.usage.input_tokens,
      total_output_tokens: enhancements.usage.output_tokens,
      generation_cost: enhancements.usage.cost,
      is_generated: true,
      has_errors: false,
      error_message: null,
      ai_model: CONFIG.MODEL,
      generated_at: new Date().toISOString()
    }, {
      onConflict: 'city_slug'
    });

  if (error) {
    // If table doesn't exist, create it
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('  Creating electricien_enhancements table...');

      // Create table via raw SQL
      const { error: createTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS electricien_enhancements (
            id SERIAL PRIMARY KEY,
            city_id INTEGER REFERENCES cities(id),
            city_slug VARCHAR(255) UNIQUE,
            city_name VARCHAR(255),

            -- AI-generated content
            hero_intro TEXT,
            urgence_context TEXT,
            insurance_context TEXT,
            normes_context TEXT,
            products_context TEXT,
            city_hall_context TEXT,
            transport_context TEXT,
            streets_context TEXT,
            emergency_steps TEXT,
            why_choose_us TEXT,
            tableau_context TEXT,
            renovation_context TEXT,
            diagnostic_context TEXT,
            consuel_context TEXT,

            -- Metadata
            total_input_tokens INTEGER,
            total_output_tokens INTEGER,
            generation_cost DECIMAL(10,6),
            is_generated BOOLEAN DEFAULT false,
            has_errors BOOLEAN DEFAULT false,
            error_message TEXT,
            ai_model VARCHAR(100),
            generated_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `
      });

      if (createTableError) {
        console.log('  Note: Table might already exist or needs manual creation');
        console.log('  Attempting to insert data anyway...');
      }

      // Retry the insert
      const { error: retryError } = await supabase
        .from('electricien_enhancements')
        .upsert({
          city_id: city.id,
          city_slug: city.slug,
          city_name: city.name,
          hero_intro: enhancements.data.hero_intro,
          urgence_context: enhancements.data.urgence_context,
          insurance_context: enhancements.data.insurance_context,
          normes_context: enhancements.data.normes_context,
          products_context: enhancements.data.products_context,
          city_hall_context: enhancements.data.city_hall_context,
          transport_context: enhancements.data.transport_context,
          streets_context: enhancements.data.streets_context,
          emergency_steps: enhancements.data.emergency_steps,
          why_choose_us: enhancements.data.why_choose_us,
          tableau_context: enhancements.data.tableau_context,
          renovation_context: enhancements.data.renovation_context,
          diagnostic_context: enhancements.data.diagnostic_context,
          consuel_context: enhancements.data.consuel_context,
          total_input_tokens: enhancements.usage.input_tokens,
          total_output_tokens: enhancements.usage.output_tokens,
          generation_cost: enhancements.usage.cost,
          is_generated: true,
          has_errors: false,
          ai_model: CONFIG.MODEL,
          generated_at: new Date().toISOString()
        });

      if (retryError) {
        throw new Error(`Database error: ${retryError.message}`);
      }
    } else {
      throw new Error(`Database error: ${error.message}`);
    }
  }
}

/**
 * Store error in database
 */
async function storeError(city, errorMessage) {
  if (args.DRY_RUN) {
    console.log('  [DRY RUN] Would store error in database');
    return;
  }

  await supabase
    .from('electricien_enhancements')
    .upsert({
      city_id: city.id,
      city_slug: city.slug,
      city_name: city.name,
      is_generated: false,
      has_errors: true,
      error_message: errorMessage,
      generated_at: new Date().toISOString()
    }, {
      onConflict: 'city_slug'
    });
}

/**
 * Main function
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('  AI LOCATION-SPECIFIC ENHANCEMENTS - ELECTRICIEN');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Mode: ${args.DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Scope: ${args.TEST_ONLY ? 'TEST (5 cities)' : args.CITIES ? `SPECIFIC (${args.CITIES.length} cities)` : 'FULL'}\n`);

  // Get cities to process
  let query = supabase
    .from('cities')
    .select('*')
    .order('name', { ascending: true });

  // Apply filters
  if (args.CITIES) {
    query = query.in('slug', args.CITIES);
  } else if (args.TEST_ONLY) {
    query = query.in('slug', TEST_SLUGS);
  }

  const { data: cities, error } = await query;

  if (error) {
    console.error('❌ Error fetching cities:', error);
    process.exit(1);
  }

  if (cities.length === 0) {
    console.error('❌ No cities found');
    process.exit(1);
  }

  console.log(`✅ Found ${cities.length} cities to process\n`);

  // Process each city
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];

    try {
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[${i + 1}/${cities.length}] ${toProperCase(city.name)}`);
      console.log('═'.repeat(80));

      // Generate AI enhancements
      const enhancements = await generateElectricienEnhancements(city);

      // Display generated content
      console.log('\n📝 GENERATED ENHANCEMENTS:\n');

      console.log('Hero Intro:');
      console.log(`  "${enhancements.data.hero_intro}"\n`);

      console.log('Urgence Context:');
      console.log(`  "${enhancements.data.urgence_context}"\n`);

      console.log('Normes Context:');
      console.log(`  "${enhancements.data.normes_context}"\n`);

      console.log('Tableau Context:');
      console.log(`  "${enhancements.data.tableau_context}"\n`);

      console.log('Emergency Steps:');
      console.log(`  "${enhancements.data.emergency_steps}"\n`);

      console.log('Why Choose Us:');
      console.log(`  "${enhancements.data.why_choose_us}"\n`);

      console.log('📊 Token Usage:');
      console.log(`  Input: ${enhancements.usage.input_tokens}`);
      console.log(`  Output: ${enhancements.usage.output_tokens}`);
      console.log(`  Cost: $${enhancements.usage.cost.toFixed(4)}\n`);

      // Store in database
      await storeEnhancements(city, enhancements);
      console.log('✅ Stored in database');

      // Rate limiting
      if (i < cities.length - 1) {
        await sleep(CONFIG.DELAY_MS);
      }

    } catch (err) {
      console.error(`❌ Error for ${city.name}:`, err.message);
      await storeError(city, err.message);
    }
  }

  // Final report
  console.log('\n' + '═'.repeat(80));
  console.log('  FINAL REPORT');
  console.log('═'.repeat(80));
  console.log(`📊 Total input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`📊 Total output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`💰 Total cost: $${totalCost.toFixed(4)}`);

  if (args.TEST_ONLY && cities.length > 0) {
    const estimatedTotal = (totalCost / cities.length) * 410; // Estimated 410 total cities
    console.log(`\n📈 Extrapolated cost for all cities (~410): $${estimatedTotal.toFixed(2)}`);
  }

  console.log('═'.repeat(80));

  // Save results
  const fs = require('fs');
  const results = {
    mode: args.DRY_RUN ? 'dry_run' : 'live',
    scope: args.TEST_ONLY ? 'test' : args.CITIES ? 'specific' : 'full',
    cities_processed: cities.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost: totalCost,
    model: CONFIG.MODEL,
    timestamp: new Date().toISOString()
  };

  const filename = `electricien-enhancements-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n✓ Results saved to ${filename}\n`);

  if (args.DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No database changes were made\n');
  } else if (args.TEST_ONLY) {
    console.log('🧪 TEST COMPLETE - Review the results above\n');
  } else {
    console.log('✅ COMPLETE - All enhancements have been generated!\n');
  }
}

// Run the script
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});