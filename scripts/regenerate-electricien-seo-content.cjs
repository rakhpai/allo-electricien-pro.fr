#!/usr/bin/env node

/**
 * AI-Powered SEO Content Generation for Electrician Services
 * Generates optimized titles, meta descriptions, headings, and content for allo-electricien.pro
 * Adapted from locksmith (serrurier) to electrician (électricien) services
 */

const {
  anthropic,
  supabase,
  CONFIG,
  sleep,
  toProperCase,
  DEPARTMENT_NAMES,
  determineContentTheme,
  getThemeGuidance,
  calculateCost,
  extractFirstLine,
  removeMarkdown
} = require('./ai-config.cjs');

// Command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  CITIES: process.argv.find(arg => arg.startsWith('--cities='))?.split('=')[1]?.split(',') || null
};

// Enhanced theme guidance specifically for electrician services
function getElectricianThemeGuidance(theme) {
  const themes = {
    urgence: {
      keywords: 'urgence électrique, panne courant, court-circuit, 24/7, intervention rapide, dépannage',
      tone: 'Reassuring, immediate, professional',
      focus: 'Emergency electrical repairs, power outages, circuit breaker issues',
      titlePattern: 'Électricien Urgence [City] 24h | Dépannage Rapide [Dept]',
      metaOpening: 'Électricien d\'urgence à',
      h2_1Pattern: 'Dépannage électrique urgent à [City]',
      h2_2Focus: 'Intervention rapide 24h/24 et 7j/7',
      taglineAngle: 'Disponibilité immédiate pour toute urgence électrique',
      heroFocus: 'Panne de courant ? Intervention en 30 minutes',
      aboutFocus: 'Service d\'urgence 24/7, diagnostic gratuit, intervention rapide sur tout type de panne électrique'
    },
    installation: {
      keywords: 'installation électrique, tableau électrique, prises, interrupteurs, mise en service',
      tone: 'Professional, competent, technical',
      focus: 'New electrical installations, panel upgrades, complete wiring',
      titlePattern: 'Installation Électrique [City] | Expert Certifié [Dept]',
      metaOpening: 'Installation électrique professionnelle à',
      h2_1Pattern: 'Installations électriques neuves à [City]',
      h2_2Focus: 'Tableaux électriques et câblage moderne',
      taglineAngle: 'Installations conformes aux normes NF C 15-100',
      heroFocus: 'Installation électrique complète par experts certifiés',
      aboutFocus: 'Installations neuves et rénovations, conformité garantie, devis gratuit, garantie décennale'
    },
    renovation: {
      keywords: 'rénovation électrique, remise aux normes, modernisation, mise à jour installation',
      tone: 'Trustworthy, experienced, quality-focused',
      focus: 'Electrical renovations, complete rewiring, safety upgrades',
      titlePattern: 'Rénovation Électrique [City] | Mise aux Normes [Dept]',
      metaOpening: 'Rénovation électrique complète à',
      h2_1Pattern: 'Rénovation et modernisation électrique à [City]',
      h2_2Focus: 'Sécurisation de votre installation',
      taglineAngle: 'Rénovation complète aux normes actuelles',
      heroFocus: 'Modernisez votre installation électrique en toute sécurité',
      aboutFocus: 'Diagnostic complet, rénovation totale ou partielle, mise en sécurité, certification Consuel'
    },
    normes: {
      keywords: 'normes NF C 15-100, conformité, sécurité électrique, diagnostic, Consuel',
      tone: 'Expert, certified, safety-focused',
      focus: 'Compliance, safety standards, electrical certifications',
      titlePattern: 'Mise aux Normes Électriques [City] | Consuel [Dept]',
      metaOpening: 'Mise aux normes NF C 15-100 à',
      h2_1Pattern: 'Mise en conformité électrique à [City]',
      h2_2Focus: 'Certification et attestation Consuel',
      taglineAngle: 'Conformité et sécurité électrique garanties',
      heroFocus: 'Mise aux normes NF C 15-100 par électricien agréé',
      aboutFocus: 'Diagnostic électrique, mise en conformité complète, attestation Consuel, garantie décennale'
    }
  };
  return themes[theme] || themes.urgence;
}

// Prompt generators adapted for electrician services
function getTitlePrompt(context, recentContent = []) {
  const theme = getElectricianThemeGuidance(context.content_theme);
  const recentStr = recentContent.slice(-5).join(', ') || 'None yet';

  return `Generate an SEO-optimized title tag for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code} (${context.department_name})
- Primary Keyword: ${context.keyword || 'Électricien ' + context.city}
- Content Theme: ${context.content_theme.toUpperCase()}

THEME GUIDANCE (${context.content_theme}):
- Keywords: ${theme.keywords}
- Tone: ${theme.tone}
- Pattern: ${theme.titlePattern}

REQUIREMENTS:
- Length: EXACTLY 45-62 characters (CRITICAL - count carefully)
- Start with "Électricien" or theme modifier
- Include: City name + Department code
- Use pipe separator "|" or dash "-"
- NO phone numbers
- NO English words

STRUCTURE OPTIONS (choose best for ${context.content_theme} theme):
1. Électricien [City] [Modifier] | [Benefit] [Dept]
2. [Service] Électrique [City] | [USP] [Dept]
3. Électricien [Modifier] à [City] | [Benefit]

Examples matching ${context.content_theme} theme:
${context.content_theme === 'urgence' ? `- Électricien Urgence ${context.city} 24h | Dépannage ${context.department_code}
- SOS Électricien ${context.city} | Intervention Rapide
- Urgence Électrique ${context.city} | Panne 24h/24` : ''}
${context.content_theme === 'installation' ? `- Installation Électrique ${context.city} | Expert ${context.department_code}
- Électricien ${context.city} | Tableaux Électriques
- Installations Neuves ${context.city} | Pro Certifié` : ''}
${context.content_theme === 'renovation' ? `- Rénovation Électrique ${context.city} | Devis ${context.department_code}
- Électricien ${context.city} | Mise aux Normes
- Rénovation Installation ${context.city} | Expert` : ''}
${context.content_theme === 'normes' ? `- Mise aux Normes ${context.city} | Consuel ${context.department_code}
- Électricien Agréé ${context.city} | NF C 15-100
- Conformité Électrique ${context.city} | Certifié` : ''}

VARIETY CHECK:
Recent titles: ${recentStr}
→ MUST use different structure and words

Return ONLY the title text, no explanation, no quotes.`;
}

function getMetaDescriptionPrompt(context, generatedTitle, recentContent = []) {
  const theme = getElectricianThemeGuidance(context.content_theme);

  return `Generate an SEO-optimized meta description for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code} (${context.department_name})
- Company: ${context.company_name || 'Allo Électricien'}
- Phone: ${context.phone_formatted || '01 88 33 50 40'}
- Content Theme: ${context.content_theme.toUpperCase()}
- Title (for consistency): ${generatedTitle}

THEME GUIDANCE (${context.content_theme}):
- Opening: ${theme.metaOpening} ${context.city}
- Focus: ${theme.focus}
- Tone: ${theme.tone}

REQUIREMENTS:
- Length: EXACTLY 145-165 characters (CRITICAL)
- Must include: Service type + City + Department in parentheses
- 3-4 key services mentioned
- Trust signal or USP
- Call-to-action with phone number: ☎ ${context.phone_formatted || '01 88 33 50 40'}
- Natural French language

STRUCTURE (145-165 chars):
"${theme.metaOpening} ${context.city} (${context.department_code}). [Service 1], [Service 2], [Service 3]. [Availability/USP]. [CTA with phone]."

SERVICE VARIATIONS (choose 3-4 based on theme):
- dépannage électrique
- installation tableau
- mise aux normes
- panne de courant
- court-circuit
- rénovation électrique
- diagnostic électrique

CTA OPTIONS (match theme):
${context.content_theme === 'urgence' ? '- "Urgence ☎ ' + (context.phone_formatted || '01 88 33 50 40') + '"' : ''}
${context.content_theme === 'installation' ? '- "Devis gratuit ☎ ' + (context.phone_formatted || '01 88 33 50 40') + '"' : ''}
${context.content_theme === 'renovation' ? '- "Contactez-nous ☎ ' + (context.phone_formatted || '01 88 33 50 40') + '"' : ''}
${context.content_theme === 'normes' ? '- "Expert agréé ☎ ' + (context.phone_formatted || '01 88 33 50 40') + '"' : ''}

Return ONLY the meta description text, no explanation, no quotes.`;
}

function getH2_1Prompt(context, generatedFields) {
  const theme = getElectricianThemeGuidance(context.content_theme);

  return `Generate a primary H2 heading for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code} (${context.department_name})
- Content Theme: ${context.content_theme.toUpperCase()}
- Title: ${generatedFields.title}

THEME PATTERN (${context.content_theme}):
${theme.h2_1Pattern}

REQUIREMENTS:
- Length: 30-70 characters
- Must include: City name OR department
- Professional, clear, direct
- NO markdown symbols
- Complement title without duplication

Examples matching ${context.content_theme} theme:
${context.content_theme === 'urgence' ? `- Dépannage électrique urgent à ${context.city}
- Électricien d'urgence ${context.city} 24h/24
- SOS Panne électrique dans le ${context.department_code}` : ''}
${context.content_theme === 'installation' ? `- Installation électrique à ${context.city}
- Votre électricien installateur ${context.department_code}
- Tableaux et câblage électrique ${context.city}` : ''}
${context.content_theme === 'renovation' ? `- Rénovation électrique complète à ${context.city}
- Modernisation installation ${context.department_code}
- Rénovation aux normes à ${context.city}` : ''}
${context.content_theme === 'normes' ? `- Mise aux normes NF C 15-100 à ${context.city}
- Conformité électrique dans le ${context.department_code}
- Certification Consuel ${context.city}` : ''}

Return ONLY the H2 heading text, no explanation, no symbols.`;
}

function getH2_2Prompt(context, generatedFields) {
  const theme = getElectricianThemeGuidance(context.content_theme);

  return `Generate a secondary H2 heading for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code} (${context.department_name})
- Content Theme: ${context.content_theme.toUpperCase()}
- H2_1: ${generatedFields.h2_1}

THEME FOCUS (${context.content_theme}):
${theme.h2_2Focus}

REQUIREMENTS:
- Length: 30-70 characters
- DIFFERENT from H2_1 pattern
- Benefit-focused
- NO markdown symbols

Examples matching ${context.content_theme} theme:
${context.content_theme === 'urgence' ? `- Intervention rapide 24h/24 et 7j/7
- Diagnostic gratuit sur place
- Résolution garantie de vos pannes` : ''}
${context.content_theme === 'installation' ? `- Installations conformes et durables
- Garantie décennale sur nos travaux
- Matériel de qualité professionnelle` : ''}
${context.content_theme === 'renovation' ? `- Sécurisation de votre installation
- Économies d'énergie garanties
- Travaux propres et soignés` : ''}
${context.content_theme === 'normes' ? `- Attestation Consuel délivrée
- Sécurité électrique optimale
- Conformité totale garantie` : ''}

Return ONLY the H2 heading text, no explanation, no symbols.`;
}

function getTaglinePrompt(context, recentContent = []) {
  const theme = getElectricianThemeGuidance(context.content_theme);
  const recentStr = recentContent.slice(-5).join(', ') || 'None yet';

  return `Generate a compelling tagline for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code}
- Company: ${context.company_name || 'Allo Électricien'}
- Content Theme: ${context.content_theme.toUpperCase()}

THEME ANGLE (${context.content_theme}):
${theme.taglineAngle}

REQUIREMENTS:
- Length: 25-65 characters
- Memorable and professional
- Match content theme
- French language

Examples matching ${context.content_theme} theme:
${context.content_theme === 'urgence' ? `- Intervention en moins de 30 minutes
- Votre électricien 24h/24 à ${context.city}
- Dépannage urgent, service immédiat` : ''}
${context.content_theme === 'installation' ? `- Installations électriques de qualité
- Votre expert en électricité à ${context.city}
- Du tableau au câblage, tout est maîtrisé` : ''}
${context.content_theme === 'renovation' ? `- Rénovation complète, sécurité garantie
- Modernisez votre installation électrique
- De l'ancien au neuf, en toute confiance` : ''}
${context.content_theme === 'normes' ? `- Conformité et sécurité avant tout
- Certifié pour votre tranquillité
- Normes respectées, sécurité assurée` : ''}

VARIETY: Recent taglines: ${recentStr}
→ MUST use different angle

Return ONLY the tagline, no explanation, no quotes.`;
}

function getHeroHeadlinePrompt(context, generatedFields) {
  const theme = getElectricianThemeGuidance(context.content_theme);

  return `Generate a hero headline for a French electrician website homepage.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code}
- Company: ${context.company_name || 'Allo Électricien'}
- Content Theme: ${context.content_theme.toUpperCase()}
- Title: ${generatedFields.title}

THEME FOCUS (${context.content_theme}):
${theme.heroFocus}

REQUIREMENTS:
- Length: 30-60 characters
- Must include: City name
- Direct, compelling, benefit-focused
- Match theme

Examples:
${context.content_theme === 'urgence' ? `- Électricien Urgence ${context.city} 24h/24
- Panne électrique à ${context.city} ? On intervient
- SOS Électricien ${context.city} - Dépannage Rapide` : ''}
${context.content_theme === 'installation' ? `- Installation Électrique ${context.city}
- Votre Projet Électrique à ${context.city}
- Expert Installation ${context.city}` : ''}
${context.content_theme === 'renovation' ? `- Rénovation Électrique ${context.city}
- Modernisez votre Installation à ${context.city}
- Rénovation Complète ${context.city}` : ''}
${context.content_theme === 'normes' ? `- Mise aux Normes ${context.city}
- Conformité Électrique ${context.city}
- Certification NF à ${context.city}` : ''}

Return ONLY the headline, no explanation, no quotes.`;
}

function getHeroSubheadlinePrompt(context, generatedFields) {
  const theme = getElectricianThemeGuidance(context.content_theme);

  return `Generate a hero subheadline for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code}
- Company: ${context.company_name || 'Allo Électricien'}
- Phone: ${context.phone_formatted || '01 88 33 50 40'}
- Content Theme: ${context.content_theme.toUpperCase()}
- Hero Headline: ${generatedFields.hero_headline}

REQUIREMENTS:
- Length: 60-110 characters
- Include: 2-3 key benefits OR trust signal + CTA
- Phone number REQUIRED: ☎ ${context.phone_formatted || '01 88 33 50 40'}
- Professional, reassuring

Examples matching ${context.content_theme} theme:
${context.content_theme === 'urgence' ? `- Intervention rapide 24h/24. Devis gratuit. ☎ ${context.phone_formatted || '01 88 33 50 40'}
- Électricien certifié. Dépannage sous 30 min. ☎ ${context.phone_formatted || '01 88 33 50 40'}` : ''}
${context.content_theme === 'installation' ? `- Installations neuves et rénovations. Garantie 10 ans. ☎ ${context.phone_formatted || '01 88 33 50 40'}
- Tableaux électriques modernes. Devis gratuit. ☎ ${context.phone_formatted || '01 88 33 50 40'}` : ''}
${context.content_theme === 'renovation' ? `- Diagnostic gratuit. Travaux garantis. ☎ ${context.phone_formatted || '01 88 33 50 40'}
- Mise aux normes complète. Devis offert. ☎ ${context.phone_formatted || '01 88 33 50 40'}` : ''}
${context.content_theme === 'normes' ? `- Certification Consuel. Conformité garantie. ☎ ${context.phone_formatted || '01 88 33 50 40'}
- Expert agréé. Attestation délivrée. ☎ ${context.phone_formatted || '01 88 33 50 40'}` : ''}

Return ONLY the subheadline, no explanation, no quotes.`;
}

function getAboutTextPrompt(context, generatedFields) {
  const theme = getElectricianThemeGuidance(context.content_theme);

  return `Generate an "About Us" text for a French electrician website.

CONTEXT:
- City: ${context.city}
- Department: ${context.department_code} (${context.department_name})
- Company: ${context.company_name || 'Allo Électricien'}
- Phone: ${context.phone_formatted || '01 88 33 50 40'}
- Content Theme: ${context.content_theme.toUpperCase()}

ALL PREVIOUS CONTENT (for consistency):
- Title: ${generatedFields.title}
- Tagline: ${generatedFields.tagline}
- Hero Headline: ${generatedFields.hero_headline}

THEME FOCUS (${context.content_theme}):
${theme.aboutFocus}

STRUCTURE (150-250 words, 800-1400 characters):

PARAGRAPH 1 - Introduction (2-3 sentences):
"${context.company_name || 'Allo Électricien'} est votre électricien ${context.content_theme === 'urgence' ? 'd\'urgence' : context.content_theme === 'installation' ? 'installateur' : context.content_theme === 'renovation' ? 'rénovateur' : 'agréé'} à ${context.city}, dans le département ${context.department_name} (${context.department_code}). [Unique positioning based on theme]."

PARAGRAPH 2 - Services (3-4 sentences):
List 4-6 electrical services:
- Dépannage électrique d'urgence
- Installation tableaux électriques
- Mise aux normes NF C 15-100
- Rénovation installation complète
- Diagnostic électrique
- Pose prises et interrupteurs

PARAGRAPH 3 - Local Expertise (2-3 sentences):
Coverage of ${context.city} and surrounding areas, rapid response, local knowledge.

PARAGRAPH 4 - Trust Signals (2-3 sentences):
${context.content_theme === 'urgence' ? 'Fast response 24/7, no call-out charge, transparent pricing' : ''}
${context.content_theme === 'installation' ? 'Certified electricians, 10-year warranty, quality materials' : ''}
${context.content_theme === 'renovation' ? 'Complete renovations, energy savings, clean work' : ''}
${context.content_theme === 'normes' ? 'Consuel certification, full compliance, safety guarantee' : ''}

PARAGRAPH 5 - Call-to-Action (2 sentences):
"Contactez ${context.company_name || 'Allo Électricien'} au ${context.phone_formatted || '01 88 33 50 40'} pour toute intervention électrique à ${context.city}. [Final benefit]."

REQUIREMENTS:
- Length: 800-1400 characters
- Natural keyword integration: électricien, ${context.city}, ${context.department_code}
- Professional, trustworthy tone
- French language only

Return ONLY the about text (multiple paragraphs OK), no explanation, no quotes.`;
}

async function generateFieldContent(fieldName, context, generatedFields = {}, recentContent = {}) {
  let prompt;

  // Get appropriate prompt based on field
  switch(fieldName) {
    case 'title':
      prompt = getTitlePrompt(context, recentContent[fieldName] || []);
      break;
    case 'meta_description':
      prompt = getMetaDescriptionPrompt(context, generatedFields.title, recentContent[fieldName] || []);
      break;
    case 'h2_1':
      prompt = getH2_1Prompt(context, generatedFields);
      break;
    case 'h2_2':
      prompt = getH2_2Prompt(context, generatedFields);
      break;
    case 'tagline':
      prompt = getTaglinePrompt(context, recentContent[fieldName] || []);
      break;
    case 'hero_headline':
      prompt = getHeroHeadlinePrompt(context, generatedFields);
      break;
    case 'hero_subheadline':
      prompt = getHeroSubheadlinePrompt(context, generatedFields);
      break;
    case 'about_text':
      prompt = getAboutTextPrompt(context, generatedFields);
      break;
    default:
      throw new Error(`Unknown field: ${fieldName}`);
  }

  // Field length requirements
  const fieldLengths = {
    title: { min: 45, max: 62 },
    meta_description: { min: 145, max: 165 },
    h2_1: { min: 30, max: 70 },
    h2_2: { min: 30, max: 70 },
    tagline: { min: 25, max: 65 },
    hero_headline: { min: 30, max: 60 },
    hero_subheadline: { min: 60, max: 110 },
    about_text: { min: 800, max: 1400 }
  };

  const limits = fieldLengths[fieldName];

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: CONFIG.MODEL,
        max_tokens: fieldName === 'about_text' ? 600 : 200,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      let content = message.content[0].text.trim()
        .replace(/^[\"']|[\"']$/g, '') // Remove quotes
        .replace(/^#+\s*/g, ''); // Remove markdown headers

      // For about_text, allow multiple paragraphs
      if (fieldName !== 'about_text') {
        content = extractFirstLine(content);
      }

      // Remove any markdown formatting
      content = removeMarkdown(content);

      // Validate length
      if (content.length < limits.min) {
        console.log(`    Retry ${attempt}: Too short (${content.length} chars, min ${limits.min})`);
        continue;
      }

      if (content.length > limits.max) {
        console.log(`    Retry ${attempt}: Too long (${content.length} chars, max ${limits.max})`);
        continue;
      }

      // Success!
      return {
        success: true,
        content: content,
        attempt,
        tokens: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens
        }
      };

    } catch (error) {
      console.log(`    Retry ${attempt}: API Error: ${error.message}`);
      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(2000 * attempt); // Exponential backoff
      }
    }
  }

  // Failed after all retries
  return {
    success: false,
    content: null,
    error: 'Max retries exceeded'
  };
}

async function regenerateElectricienSEOContent() {
  console.log(`╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║   AI SEO CONTENT GENERATION - ALLO-ELECTRICIEN.PRO           ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);
  console.log(`Mode: ${args.DRY_RUN ? 'DRY RUN (no database updates)' : 'LIVE (will update database)'}`);
  console.log(`Scope: ${args.TEST_ONLY ? 'TEST (5 cities only)' : args.CITIES ? `SPECIFIC (${args.CITIES.length} cities)` : 'FULL (all cities)'}\n`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Get cities to process
  let query = supabase
    .from('cities')
    .select('*')
    .order('name', { ascending: true });

  // Apply filters
  if (args.CITIES) {
    query = query.in('slug', args.CITIES);
  } else if (args.TEST_ONLY) {
    // Test cities: Versailles, Paris, Rueil-Malmaison, Meudon, Bezons
    query = query.in('slug', ['versailles', 'paris', 'rueil-malmaison', 'meudon', 'bezons']);
  }

  const { data: cities, error } = await query;

  if (error) {
    console.error('Error fetching cities:', error);
    process.exit(1);
  }

  const citiesToProcess = cities;

  console.log(`Found ${citiesToProcess.length} cities to process`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = {
    total: citiesToProcess.length,
    success: 0,
    failed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    cities: []
  };

  const recentByField = {
    title: [],
    meta_description: [],
    tagline: [],
    hero_headline: [],
    hero_subheadline: []
  };

  for (let i = 0; i < citiesToProcess.length; i++) {
    const city = citiesToProcess[i];

    console.log(`\n[${i + 1}/${citiesToProcess.length}] ${city.name}`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    // Determine content theme based on city characteristics
    const contentTheme = determineContentTheme(city.name, city.slug);

    console.log(`  City: ${city.name}, Dept: ${city.department}`);
    console.log(`  Postal: ${city.postal_code}, Population: ${city.population}`);
    console.log(`  📋 CONTENT THEME: ${contentTheme.toUpperCase()}\n`);

    const context = {
      city: toProperCase(city.name),
      department_code: city.department,
      department_name: DEPARTMENT_NAMES[city.department] || 'Île-de-France',
      company_name: 'Allo Électricien',
      phone: '01 88 33 50 40',
      phone_formatted: '01 88 33 50 40',
      keyword: `Électricien ${toProperCase(city.name)}`,
      postal_code: city.postal_code,
      population: city.population,
      content_theme: contentTheme
    };

    const cityResult = {
      id: city.id,
      name: city.name,
      slug: city.slug,
      theme: contentTheme,
      fields: {},
      tokens: { input: 0, output: 0 },
      success: true
    };

    // Generate fields sequentially
    const generatedFields = {};
    const fieldOrder = ['title', 'meta_description', 'h2_1', 'h2_2', 'tagline', 'hero_headline', 'hero_subheadline', 'about_text'];

    for (const fieldName of fieldOrder) {
      console.log(`  Generating ${fieldName}...`);

      const result = await generateFieldContent(fieldName, context, generatedFields, recentByField);

      if (result.success) {
        const preview = result.content.length > 80 ? result.content.substring(0, 77) + '...' : result.content;
        console.log(`    ✓ "${preview}" (${result.content.length} chars)`);

        cityResult.fields[fieldName] = result.content;
        generatedFields[fieldName] = result.content;
        cityResult.tokens.input += result.tokens.input;
        cityResult.tokens.output += result.tokens.output;

        // Track recent for variety
        if (recentByField[fieldName]) {
          recentByField[fieldName].push(result.content);
        }

      } else {
        console.log(`    ✗ Failed: ${result.error}`);
        cityResult.success = false;
      }

      // Rate limiting delay between fields
      await sleep(CONFIG.DELAY_MS);
    }

    // Update database if not dry run
    if (!args.DRY_RUN && cityResult.success) {
      console.log(`\n  Updating database...`);

      // Check if a page exists for this city
      const { data: existingPage, error: pageError } = await supabase
        .from('pages')
        .select('id')
        .eq('city_id', city.id)
        .single();

      if (existingPage) {
        // Update existing page
        const { error: updateError } = await supabase
          .from('pages')
          .update({
            title: cityResult.fields.title,
            meta_description: cityResult.fields.meta_description,
            h2_features: cityResult.fields.h2_1,
            h2_zones: cityResult.fields.h2_2,
            tagline: cityResult.fields.tagline,
            hero_headline: cityResult.fields.hero_headline,
            hero_subheadline: cityResult.fields.hero_subheadline,
            about_text: cityResult.fields.about_text,
            ai_generated: true,
            ai_theme: contentTheme,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPage.id);

        if (updateError) {
          console.log(`    ✗ Database update failed: ${updateError.message}`);
          cityResult.success = false;
        } else {
          console.log(`    ✓ Page updated successfully`);
        }
      } else {
        // Create new page
        const { error: insertError } = await supabase
          .from('pages')
          .insert({
            city_id: city.id,
            slug: city.slug,
            title: cityResult.fields.title,
            meta_description: cityResult.fields.meta_description,
            h2_features: cityResult.fields.h2_1,
            h2_zones: cityResult.fields.h2_2,
            tagline: cityResult.fields.tagline,
            hero_headline: cityResult.fields.hero_headline,
            hero_subheadline: cityResult.fields.hero_subheadline,
            about_text: cityResult.fields.about_text,
            ai_generated: true,
            ai_theme: contentTheme,
            active: true,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.log(`    ✗ Database insert failed: ${insertError.message}`);
          cityResult.success = false;
        } else {
          console.log(`    ✓ New page created successfully`);
        }
      }
    }

    if (cityResult.success) {
      results.success++;
    } else {
      results.failed++;
    }

    results.totalInputTokens += cityResult.tokens.input;
    results.totalOutputTokens += cityResult.tokens.output;
    results.cities.push(cityResult);

    console.log(`  Tokens: ${cityResult.tokens.input} in, ${cityResult.tokens.output} out`);
  }

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`Total cities processed: ${results.total}`);
  console.log(`Successful: ${results.success} (${Math.round(results.success/results.total*100)}%)`);
  console.log(`Failed: ${results.failed} (${Math.round(results.failed/results.total*100)}%)`);

  console.log(`\nToken Usage:`);
  console.log(`  Input tokens:  ${results.totalInputTokens}`);
  console.log(`  Output tokens: ${results.totalOutputTokens}`);
  console.log(`  Total tokens:  ${results.totalInputTokens + results.totalOutputTokens}`);

  const cost = calculateCost(results.totalInputTokens, results.totalOutputTokens, CONFIG.MODEL);

  console.log(`\nCost Estimate (${CONFIG.MODEL}):`);
  console.log(`  Input:  $${cost.inputCost.toFixed(4)}`);
  console.log(`  Output: $${cost.outputCost.toFixed(4)}`);
  console.log(`  Total:  $${cost.cost.toFixed(4)}`);

  // Theme distribution
  const themeCount = {};
  results.cities.forEach(city => {
    themeCount[city.theme] = (themeCount[city.theme] || 0) + 1;
  });
  console.log(`\nContent Theme Distribution:`);
  Object.entries(themeCount).forEach(([theme, count]) => {
    console.log(`  ${theme.padEnd(15)}: ${count} cities`);
  });

  // Show sample content
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    SAMPLE CONTENT                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  results.cities.slice(0, 3).forEach((city, i) => {
    console.log(`\n${i + 1}. ${city.name} (${city.slug}) - THEME: ${city.theme.toUpperCase()}`);
    console.log('─'.repeat(70));
    Object.entries(city.fields).forEach(([field, content]) => {
      const preview = content.length > 100 ? content.substring(0, 97) + '...' : content;
      console.log(`  ${field.padEnd(20)}: ${preview}`);
    });
  });

  // Save results to file
  const fs = require('fs');
  const filename = `electricien-seo-results-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n✓ Full results saved to ${filename}\n`);

  if (args.DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No database changes were made');
    console.log('Run without --dry-run flag to apply changes\n');
  } else if (args.TEST_ONLY) {
    console.log('🧪 TEST COMPLETE - Review the samples above');
    console.log('Run without --test flag to process all cities\n');
  } else {
    console.log('✅ COMPLETE - All SEO content has been generated!\n');
  }

  return results;
}

// Run the script
regenerateElectricienSEOContent()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });