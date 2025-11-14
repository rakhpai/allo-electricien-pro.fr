#!/usr/bin/env node

/**
 * AI-Powered Service Descriptions for Electrician Services
 * Generates detailed service descriptions for common electrical services
 * Optimized for SEO and local relevance
 */

const {
  anthropic,
  supabase,
  CONFIG,
  sleep,
  toProperCase,
  calculateCost
} = require('./ai-config.cjs');

// Command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  MODEL: process.argv.find(arg => arg.startsWith('--model='))?.split('=')[1] || CONFIG.MODEL
};

// Common electrician services to generate descriptions for
const ELECTRICIAN_SERVICES = [
  {
    id: 'depannage-urgence',
    name: 'Dépannage Électrique Urgence',
    keywords: 'panne courant, court-circuit, disjoncteur, urgence électrique',
    focus: 'emergency response, quick diagnosis, 24/7 availability'
  },
  {
    id: 'tableau-electrique',
    name: 'Installation Tableau Électrique',
    keywords: 'tableau électrique, disjoncteurs, coffret, répartition',
    focus: 'panel upgrades, safety, modern equipment, compliance'
  },
  {
    id: 'mise-aux-normes',
    name: 'Mise aux Normes NF C 15-100',
    keywords: 'normes électriques, NF C 15-100, conformité, Consuel',
    focus: 'compliance, safety standards, certification, legal requirements'
  },
  {
    id: 'renovation-electrique',
    name: 'Rénovation Électrique Complète',
    keywords: 'rénovation, modernisation, câblage, installation complète',
    focus: 'complete rewiring, modernization, energy efficiency, safety'
  },
  {
    id: 'installation-prises',
    name: 'Installation Prises et Interrupteurs',
    keywords: 'prises électriques, interrupteurs, points lumineux, câblage',
    focus: 'outlets, switches, lighting points, proper installation'
  },
  {
    id: 'diagnostic-electrique',
    name: 'Diagnostic Électrique Immobilier',
    keywords: 'diagnostic électrique, contrôle installation, rapport, vente immobilier',
    focus: 'property inspection, safety report, real estate requirement'
  },
  {
    id: 'eclairage-led',
    name: 'Installation Éclairage LED',
    keywords: 'éclairage LED, économie énergie, spots, luminaires',
    focus: 'energy savings, modern lighting, ambiance, efficiency'
  },
  {
    id: 'chauffage-electrique',
    name: 'Installation Chauffage Électrique',
    keywords: 'chauffage électrique, radiateurs, plancher chauffant, thermostat',
    focus: 'heating solutions, energy efficiency, comfort, control'
  },
  {
    id: 'borne-recharge',
    name: 'Installation Borne de Recharge',
    keywords: 'borne recharge, véhicule électrique, wallbox, charge rapide',
    focus: 'EV charging, home installation, future-ready, convenience'
  },
  {
    id: 'domotique',
    name: 'Installation Domotique',
    keywords: 'domotique, maison connectée, automatisation, contrôle',
    focus: 'smart home, automation, convenience, energy management'
  }
];

/**
 * Generate service description using AI
 */
async function generateServiceDescription(service, cityContext = null) {
  const cityPrompt = cityContext ?
    `City context: ${cityContext.name} (${cityContext.department}), Population: ${cityContext.population}` :
    'General service (no specific city)';

  const prompt = `Generate a professional service description for an electrician website in French.

SERVICE: ${service.name}
Keywords: ${service.keywords}
Focus areas: ${service.focus}
${cityPrompt}

Generate a compelling service description with this structure:

1. Opening paragraph (60-80 words): Explain what the service is and why it's important
2. Benefits paragraph (60-80 words): List 3-4 key benefits for the customer
3. Process paragraph (60-80 words): Briefly explain how the service is performed
4. Call-to-action paragraph (40-60 words): Encourage contact with urgency/trust signals

Requirements:
- Total length: 220-300 words
- Professional yet approachable tone
- Include relevant keywords naturally
- Mention safety and compliance where relevant
- Focus on customer benefits
- Use French language
- If city is provided, make 1-2 natural local references
- NO company names, phone numbers, or specific pricing
- End with a soft CTA (not pushy)

Write in natural French, avoiding excessive technical jargon.`;

  const message = await anthropic.messages.create({
    model: args.MODEL,
    max_tokens: 800,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const content = message.content[0].text.trim();

  return {
    content,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens
    }
  };
}

/**
 * Generate short service summary
 */
async function generateServiceSummary(service) {
  const prompt = `Generate a brief service summary in French for: ${service.name}

Requirements:
- Length: EXACTLY 150-160 characters
- Include main keyword: ${service.keywords.split(',')[0]}
- Professional tone
- Highlight key benefit
- Natural French language
- NO markdown, quotes, or special characters

Return only the summary text.`;

  const message = await anthropic.messages.create({
    model: CONFIG.MODEL, // Use Haiku for summaries
    max_tokens: 100,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return message.content[0].text.trim();
}

/**
 * Main function
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('  AI SERVICE DESCRIPTIONS - ÉLECTRICIEN');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Mode: ${args.DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Model: ${args.MODEL}`);
  console.log(`Services: ${args.TEST_ONLY ? '3 test services' : `All ${ELECTRICIAN_SERVICES.length} services`}\n`);

  const servicesToProcess = args.TEST_ONLY ?
    ELECTRICIAN_SERVICES.slice(0, 3) :
    ELECTRICIAN_SERVICES;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const results = [];

  // Get sample cities for context (optional)
  const { data: sampleCities } = await supabase
    .from('cities')
    .select('*')
    .in('slug', ['versailles', 'paris', 'rueil-malmaison'])
    .limit(3);

  for (let i = 0; i < servicesToProcess.length; i++) {
    const service = servicesToProcess[i];

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`[${i + 1}/${servicesToProcess.length}] ${service.name}`);
    console.log('─'.repeat(80));

    try {
      // Generate main description (optionally with city context)
      const cityContext = sampleCities && sampleCities[i % sampleCities.length] || null;

      console.log('Generating service description...');
      const description = await generateServiceDescription(service, cityContext);

      console.log('Generating service summary...');
      const summary = await generateServiceSummary(service);

      // Display results
      console.log(`\n📝 Generated Description (${description.content.split(' ').length} words):`);
      console.log('─'.repeat(40));
      const preview = description.content.substring(0, 200) + '...';
      console.log(preview);

      console.log(`\n📝 Summary (${summary.length} chars):`);
      console.log(summary);

      console.log(`\n📊 Token usage:`);
      console.log(`  Description: ${description.usage.input_tokens} in, ${description.usage.output_tokens} out`);

      totalInputTokens += description.usage.input_tokens;
      totalOutputTokens += description.usage.output_tokens;

      // Store results
      const result = {
        service_id: service.id,
        service_name: service.name,
        description: description.content,
        summary: summary,
        city_context: cityContext?.name || null,
        word_count: description.content.split(' ').length,
        tokens_used: description.usage.input_tokens + description.usage.output_tokens
      };

      results.push(result);

      // Save to database if not dry run
      if (!args.DRY_RUN) {
        console.log('Saving to database...');

        // Create table if needed
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS electricien_services (
              id SERIAL PRIMARY KEY,
              service_id VARCHAR(50) UNIQUE,
              service_name VARCHAR(255),
              description TEXT,
              summary TEXT,
              keywords TEXT,
              focus_areas TEXT,
              ai_model VARCHAR(100),
              generated_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
          `
        }).single();

        // Insert or update service
        const { error } = await supabase
          .from('electricien_services')
          .upsert({
            service_id: service.id,
            service_name: service.name,
            description: description.content,
            summary: summary,
            keywords: service.keywords,
            focus_areas: service.focus,
            ai_model: args.MODEL,
            generated_at: new Date().toISOString()
          }, {
            onConflict: 'service_id'
          });

        if (error && !error.message.includes('already exists')) {
          console.error('Database error:', error.message);
        } else {
          console.log('✅ Saved to database');
        }
      }

      // Rate limiting
      if (i < servicesToProcess.length - 1) {
        await sleep(CONFIG.DELAY_MS);
      }

    } catch (error) {
      console.error(`❌ Error generating service ${service.name}:`, error.message);
    }
  }

  // Final report
  console.log('\n' + '═'.repeat(80));
  console.log('  SUMMARY REPORT');
  console.log('═'.repeat(80));

  console.log(`\n📊 Token Usage:`);
  console.log(`  Total input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`  Total output tokens: ${totalOutputTokens.toLocaleString()}`);

  const cost = calculateCost(totalInputTokens, totalOutputTokens, args.MODEL);
  console.log(`\n💰 Cost:`);
  console.log(`  Model: ${args.MODEL}`);
  console.log(`  Total cost: $${cost.cost.toFixed(4)}`);

  if (args.TEST_ONLY) {
    const fullCost = (cost.cost / servicesToProcess.length) * ELECTRICIAN_SERVICES.length;
    console.log(`  Estimated full cost: $${fullCost.toFixed(2)}`);
  }

  // Save results to file
  const fs = require('fs');
  const filename = `electricien-services-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify({
    metadata: {
      mode: args.DRY_RUN ? 'dry_run' : 'live',
      model: args.MODEL,
      services_processed: servicesToProcess.length,
      total_tokens: totalInputTokens + totalOutputTokens,
      total_cost: cost.cost,
      timestamp: new Date().toISOString()
    },
    services: results
  }, null, 2));

  console.log(`\n✓ Results saved to ${filename}`);

  if (args.DRY_RUN) {
    console.log('\n🔍 DRY RUN COMPLETE - No database changes made');
  } else if (args.TEST_ONLY) {
    console.log('\n🧪 TEST COMPLETE - Review results above');
  } else {
    console.log('\n✅ COMPLETE - All service descriptions generated!');
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});