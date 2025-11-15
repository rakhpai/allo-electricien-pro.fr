#!/usr/bin/env node

/**
 * Comprehensive SEO Enhancement Script
 * Generates AI-powered SEO content for all commune pages
 *
 * Features:
 * - SEO titles (55-60 chars)
 * - Meta descriptions (150-160 chars)
 * - Local context paragraphs (200-300 words)
 * - Detailed services (200-250 words)
 * - Why choose us local (150-200 words)
 * - Location-specific FAQs (200-300 words)
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
const matter = require('gray-matter');

// Command line arguments
const args = {
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_ONLY: process.argv.includes('--test'),
  DEPT: process.argv.find(arg => arg.startsWith('--dept='))?.split('=')[1] || null,
  TIER: process.argv.find(arg => arg.startsWith('--tier='))?.split('=')[1] || null,
  LIMIT: parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  BATCH_SIZE: parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 200,
  USE_SONNET: process.argv.includes('--use-sonnet'),
  RESUME: process.argv.includes('--resume'),
  CHECKPOINT: process.argv.find(arg => arg.startsWith('--checkpoint='))?.split('=')[1] || null,
  PARALLEL: process.argv.includes('--parallel')
};

// Select model
const MODEL = args.USE_SONNET ? CONFIG.MODEL_SONNET : CONFIG.MODEL;
// Support custom checkpoint file for parallel processing
const CHECKPOINT_FILE = args.CHECKPOINT || 'checkpoint-seo-enhancement.json';
// Reduce delay for parallel mode (avoid API conflicts by staggering)
const DELAY_MS = args.PARALLEL ? 1000 : CONFIG.DELAY_MS;

/**
 * Load checkpoint if exists
 */
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      console.log('📂 Checkpoint loaded');
      console.log(`   Last processed: ${data.lastProcessedSlug}`);
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
 * Validate French content - detect English
 */
function validateFrenchContent(text, fieldName = 'content') {
  // English phrases/patterns that indicate English content
  // Use specific patterns that won't match French words
  const englishIndicators = [
    /\belectricians?\s+in\b/i,  // "electricians in"
    /\bknowledge of\b/i,         // "knowledge of"
    /\brapid response\b/i,       // "rapid response"
    /\bavailability\s+(and|for)\b/i,  // "availability and/for"
    /\bunderstand(s)?\s+the\b/i, // "understand the"
    /\bneighborhood(s)?\s+in\b/i, // "neighborhoods in"
    /\bemergency\s+calls?\b/i,    // "emergency call"
    /\bbuilding(s)?\s+types?\b/i, // "building types"
    /\btypical(ly)?\s/i,          // "typically "
    /\bservice areas?\b/i,        // "service area"
    /\bdeep knowledge\b/i,
    /\bexpert knowledge\b/i,
    /\bfair pricing\b/i,
    /\btransparency\s+(and|in)\b/i, // "transparency and/in"
    /\brates?\s+(are|may|typically)\b/i, // "rates are/may"
    /\bcost(s)?\s+(are|may|vary)\b/i, // "costs are/may/vary"
    /\bspecialized\s+contractors?\b/i,
    /\bWhat are\b/i,              // "What are"
    /\bDo (you|they)\b/i,         // "Do you/they"
    /\bCan (you|they)\b/i,        // "Can you/they"
    /\bWhich\s+neighborhoods?\b/i  // "Which neighborhood"
  ];

  const hasEnglish = englishIndicators.some(pattern => pattern.test(text));

  if (hasEnglish) {
    console.log(`    ⚠️  ENGLISH DETECTED in ${fieldName}!`);
    console.log(`    Content preview: ${text.substring(0, 100)}...`);
    return false;
  }

  return true;
}

/**
 * Generate SEO title (55-60 chars)
 */
async function generateSEOTitle(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));
  const dept = DEPARTMENT_NAMES[commune.department] || 'Île-de-France';

  const prompt = `Generate a French SEO title for an electrician service page.

City: ${cityName}
Postal Code: ${commune.zip_code}
Department: ${commune.department} - ${dept}

Requirements:
- EXACTLY 55-60 characters (strict)
- Include: city name, service type (électricien/dépannage), urgency signal
- Natural French, compelling for clicks
- Must include postal code OR city name
- Use symbols like ⚡ | 24/7 for impact

Examples (follow this pattern):
- "Électricien Urgence Sèvres 92310 | Dépannage 24/7"
- "⚡ Électricien Sèvres 92310 - Intervention <30min"
- "Dépannage Électrique Sèvres | Service 24h/24"

Generate ONE title only. Return ONLY the title text, no quotes, no explanation.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 50,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  });

  const title = response.content[0].text.trim();
  return {
    title,
    usage: response.usage
  };
}

/**
 * Generate meta description (150-160 chars)
 */
async function generateMetaDescription(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

  const prompt = `Generate a French meta description for an electrician service page.

City: ${cityName}
Postal Code: ${commune.zip_code}

Requirements:
- EXACTLY 150-160 characters (strict)
- Include: service, location, main benefit, call-to-action
- Use emojis sparingly (⚡ ⭐)
- Compelling for click-through rate
- End with action phrase

Example:
"Électricien d'urgence à Sèvres 92310. Intervention rapide <30min, 24h/24 et 7j/7. Devis gratuit ⚡ Certifié Qualifelec ⭐4.8/5. Appelez maintenant !"

Generate ONE description. Return ONLY the description text, no quotes.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 100,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  });

  const description = response.content[0].text.trim();
  return {
    description,
    usage: response.usage
  };
}

/**
 * Generate local context paragraphs (3 paragraphs, 200-300 words)
 */
async function generateLocalContext(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));
  const dept = DEPARTMENT_NAMES[commune.department] || 'Île-de-France';

  const prompt = `Write 3 paragraphs about electrician services in this French location.

City: ${cityName}
Postal Code: ${commune.zip_code}
Department: ${commune.department} - ${dept}

Requirements:
- EXACTLY 3 paragraphs
- Total: 200-300 words
- Paragraph 1 (60-80 words): Describe the city character, local architecture, building types
- Paragraph 2 (60-80 words): Explain electrical needs specific to this area, common issues
- Paragraph 3 (60-80 words): Service coverage, rapid response, local expertise

Style:
- Professional, informative French
- Mention specific neighborhoods/landmarks if major city
- Reference local building characteristics (Haussmannien, pavillons, etc.)
- Natural, not marketing fluff

Return ONLY the 3 paragraphs, separated by double line breaks. No title, no quotes.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.6,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  return {
    paragraphs: paragraphs.slice(0, 3),
    usage: response.usage
  };
}

/**
 * Generate detailed services (4 services, 200-250 words)
 */
async function generateDetailedServices(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

  const prompt = `Generate 4 detailed electrical services for ${cityName}.

Format as JSON array with this structure:
[
  {
    "title": "Service name",
    "description": "2-3 sentence description (40-60 words)",
    "icon": "lightning|tools|certificate|refresh|shield|wrench"
  }
]

Services to cover:
1. Emergency repair (lightning icon)
2. Installation/wiring (tools icon)
3. Safety/compliance (certificate icon)
4. Renovation (refresh icon)

Requirements:
- Each description: 40-60 words
- Specific to electrical work
- Mention benefits, not just features
- Professional French

Return ONLY valid JSON array, nothing else.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });

  let services = [];
  try {
    const text = response.content[0].text.trim();
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      services = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.log('    ⚠️  Error parsing services JSON, using defaults');
    services = [
      {
        title: "Dépannage électrique urgent",
        description: "Intervention rapide pour pannes, coupures secteur, disjoncteurs qui sautent. Diagnostic précis et réparation immédiate par électricien certifié.",
        icon: "lightning"
      },
      {
        title: "Installation électrique complète",
        description: "Pose de tableaux électriques, prises, interrupteurs, câblage. Installation conforme aux normes NF C 15-100 avec garantie décennale.",
        icon: "tools"
      },
      {
        title: "Mise aux normes électriques",
        description: "Diagnostic complet, mise en conformité NF C 15-100, attestation Consuel. Indispensable pour vente immobilière et sécurité.",
        icon: "certificate"
      },
      {
        title: "Rénovation installation électrique",
        description: "Modernisation complète de l'installation, remplacement câblage ancien, upgrade tableau électrique. Sécurité et performance optimales.",
        icon: "refresh"
      }
    ];
  }

  return {
    services: services.slice(0, 4),
    usage: response.usage
  };
}

/**
 * Generate why choose local (3 reasons, 150-200 words)
 */
async function generateWhyChooseLocal(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));
  const dept = DEPARTMENT_NAMES[commune.department] || '';

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS. Generate 3 reasons to choose local electricians in ${cityName}.

Format as JSON array:
[
  {
    "title": "Titre court en français (4-6 mots)",
    "description": "Explication en français (30-50 mots)",
    "icon": "map|clock|euro|star|users|shield|check"
  }
]

Focus on:
1. Local knowledge/proximity (map icon)
2. Speed/availability (clock icon)
3. Pricing/transparency (euro icon)

EXEMPLES EN FRANÇAIS:
{
  "title": "Connaissance parfaite de ${cityName}",
  "description": "Nos électriciens maîtrisent les spécificités architecturales de ${cityName}. Expérience locale approfondie du parc immobilier et des contraintes techniques du secteur.",
  "icon": "map"
}

EXIGENCES STRICTES:
- TOUT LE CONTENU DOIT ÊTRE EN FRANÇAIS
- Chaque description: 30-50 mots EN FRANÇAIS
- Mettre en avant les avantages LOCAUX
- Spécifique à ${cityName} ou ${dept}
- Ton professionnel et rassurant
- PAS D'ANGLAIS - 100% FRANÇAIS

Return ONLY valid JSON array with FRENCH content.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });

  let reasons = [];
  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      reasons = JSON.parse(jsonMatch[0]);

      // Validate French content
      const combinedText = reasons.map(r => `${r.title} ${r.description}`).join(' ');
      if (!validateFrenchContent(combinedText, 'whyChooseLocal')) {
        console.log('    ⚠️  English content detected, using French defaults');
        reasons = []; // Force fallback
      }
    }
  } catch (err) {
    console.log('    ⚠️  Error parsing reasons JSON, using defaults');
  }

  // Use French defaults if validation failed or parse error
  if (reasons.length === 0) {
    reasons = [
      {
        title: "Connaissance du secteur",
        description: `Nos électriciens connaissent parfaitement ${cityName} et ses spécificités. Expérience locale, connaissance des bâtiments du secteur.`,
        icon: "map"
      },
      {
        title: "Intervention ultra-rapide",
        description: "Basés à proximité, nous intervenons en moins de 30 minutes pour toute urgence électrique. Disponibles 24h/24 et 7j/7.",
        icon: "clock"
      },
      {
        title: "Tarifs transparents",
        description: "Devis gratuit et détaillé avant intervention. Pas de frais cachés, tarification claire et honnête.",
        icon: "euro"
      }
    ];
  }

  return {
    reasons: reasons.slice(0, 3),
    usage: response.usage
  };
}

/**
 * Generate local FAQs (5 questions, 200-300 words)
 */
async function generateLocalFAQs(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS. Generate 5 frequently asked questions about electrician services in ${cityName} (${commune.zip_code}).

Format as JSON array:
[
  {
    "question": "Question en français (10-15 mots)?",
    "answer": "Réponse en français (30-60 mots)"
  }
]

Topics to cover:
1. Pricing for ${cityName}
2. Service areas/neighborhoods
3. Weekend/emergency availability
4. Types of buildings serviced
5. Compliance/certifications

EXEMPLES EN FRANÇAIS:
{
  "question": "Quels sont les tarifs d'un électricien à ${cityName} ${commune.zip_code} ?",
  "answer": "Les tarifs à ${cityName} varient de 65€ à 85€/heure selon l'intervention. Devis gratuit systématique avant travaux. Majoration de 30-50% pour urgences nocturnes ou week-end selon la réglementation en vigueur."
}

EXIGENCES STRICTES:
- TOUT LE CONTENU DOIT ÊTRE EN FRANÇAIS
- Les questions DOIVENT mentionner "${cityName}" ou "${commune.zip_code}"
- Réponses: précises, utiles, 30-60 mots EN FRANÇAIS
- Ton professionnel et informatif
- Total: 200-300 mots combinés
- PAS D'ANGLAIS - 100% FRANÇAIS

Return ONLY valid JSON array with FRENCH questions and answers.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });

  let faqs = [];
  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      faqs = JSON.parse(jsonMatch[0]);

      // Validate French content
      const combinedText = faqs.map(f => `${f.question} ${f.answer}`).join(' ');
      if (!validateFrenchContent(combinedText, 'faqLocal')) {
        console.log('    ⚠️  English content detected, using French defaults');
        faqs = []; // Force fallback
      }
    }
  } catch (err) {
    console.log('    ⚠️  Error parsing FAQs JSON, using defaults');
  }

  // Use French defaults if validation failed or parse error
  if (faqs.length === 0) {
    faqs = [
      {
        question: `Combien coûte un dépannage électrique à ${cityName} ?`,
        answer: "À partir de 65€/h pour une intervention standard. Devis gratuit avant intervention. Tarifs majorés pour nuit/week-end selon la réglementation."
      },
      {
        question: `Intervenez-vous dans tous les quartiers de ${cityName} ?`,
        answer: `Oui, nous couvrons l'ensemble de ${cityName} (${commune.zip_code}). Intervention en moins de 30 minutes dans toute la commune.`
      },
      {
        question: `Êtes-vous disponibles le dimanche à ${cityName} ?`,
        answer: "Oui, nous intervenons 24h/24 et 7j/7, y compris dimanches et jours fériés pour les urgences électriques."
      },
      {
        question: `Quels types de bâtiments traitez-vous à ${cityName} ?`,
        answer: "Maisons individuelles, appartements, immeubles, commerces, bureaux. Expertise sur bâtiments anciens et modernes."
      },
      {
        question: `Faites-vous les mises aux normes électriques à ${cityName} ?`,
        answer: "Oui, diagnostic complet, mise en conformité NF C 15-100, et attestation Consuel pour ventes immobilières."
      }
    ];
  }

  return {
    faqs: faqs.slice(0, 5),
    usage: response.usage
  };
}

/**
 * Generate pricing section (200-250 words)
 */
async function generatePricingSection(commune) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

  const prompt = `RÉPONDEZ UNIQUEMENT EN FRANÇAIS. Generate pricing information for electrician services in ${cityName} (${commune.zip_code}).

Format as JSON object:
{
  "intro": "Paragraph about pricing in ${cityName} (40-60 words in FRENCH)",
  "pricing_points": [
    {
      "title": "Titre du tarif (en français)",
      "description": "Détails (20-30 mots)"
    }
  ]
}

EXEMPLE EN FRANÇAIS:
{
  "intro": "Nos tarifs d'électricien à ${cityName} sont transparents et compétitifs. Nous proposons des devis gratuits détaillés avant intervention. Paiement échelonné possible pour travaux importants. Toutes nos prestations incluent garantie décennale et assurance professionnelle.",
  "pricing_points": [
    {
      "title": "Dépannage urgence 24/7",
      "description": "À partir de 65€/h en journée, 85€/h nuit et week-end. Déplacement inclus dans un rayon de 20km de ${cityName}."
    },
    {
      "title": "Installation et rénovation",
      "description": "Tarifs sur devis personnalisé. Prise électrique dès 45€, tableau électrique à partir de 400€, rénovation complète dès 2000€."
    },
    {
      "title": "Mise aux normes NF C 15-100",
      "description": "Diagnostic gratuit, devis détaillé. Intervention complète avec attestation Consuel pour ventes immobilières."
    }
  ]
}

EXIGENCES STRICTES:
- TOUT LE CONTENU DOIT ÊTRE EN FRANÇAIS
- Intro: 40-60 mots sur tarifs à ${cityName}
- 3 pricing_points minimum
- Mention prix réalistes pour région Île-de-France
- Ton professionnel et rassurant
- PAS D'ANGLAIS - 100% FRANÇAIS

Return ONLY valid JSON object with FRENCH content.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.5,
    messages: [{ role: 'user', content: prompt }]
  });

  let pricingData = null;
  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      pricingData = JSON.parse(jsonMatch[0]);

      // Validate French content
      const combinedText = pricingData.intro + ' ' +
        pricingData.pricing_points.map(p => `${p.title} ${p.description}`).join(' ');
      if (!validateFrenchContent(combinedText, 'pricingSection')) {
        console.log('    ⚠️  English content detected, using French defaults');
        pricingData = null; // Force fallback
      }
    }
  } catch (err) {
    console.log('    ⚠️  Error parsing pricing JSON, using defaults');
  }

  // Use French defaults if validation failed or parse error
  if (!pricingData) {
    pricingData = {
      intro: `Nos tarifs d'électricien à ${cityName} sont transparents et sans surprise. Devis gratuit systématique avant intervention. Paiement facilité pour travaux importants. Garantie décennale et assurance RC Pro incluses.`,
      pricing_points: [
        {
          title: "Dépannage urgence 24/7",
          description: `Intervention rapide à ${cityName}. À partir de 65€/h en journée, 85€/h nuit et week-end. Déplacement inclus.`
        },
        {
          title: "Installation électrique",
          description: "Prise/interrupteur dès 45€, tableau électrique à partir de 400€. Travaux aux normes NF C 15-100."
        },
        {
          title: "Rénovation complète",
          description: "Devis personnalisé gratuit. Mise aux normes avec attestation Consuel. Paiement échelonné possible."
        }
      ]
    };
  }

  return {
    pricingData,
    usage: response.usage
  };
}

/**
 * Process single commune
 */
async function processCommune(commune, stats) {
  const cityName = toProperCase(commune.city_name || commune.url_path.replace(/^\//, ''));

  console.log(`\n[${ stats.processed + 1}/${stats.total}] ${cityName} (${commune.zip_code})`);
  console.log(`  Tier: ${commune.tier}, Dept: ${commune.department}`);

  try {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Generate all content
    console.log('  🤖 Generating SEO title...');
    const titleResult = await generateSEOTitle(commune);
    totalInputTokens += titleResult.usage.input_tokens;
    totalOutputTokens += titleResult.usage.output_tokens;
    console.log(`     "${titleResult.title}" (${titleResult.title.length} chars)`);
    await sleep(DELAY_MS);

    console.log('  🤖 Generating meta description...');
    const metaResult = await generateMetaDescription(commune);
    totalInputTokens += metaResult.usage.input_tokens;
    totalOutputTokens += metaResult.usage.output_tokens;
    console.log(`     ${metaResult.description.length} chars`);
    await sleep(DELAY_MS);

    console.log('  🤖 Generating local context...');
    const contextResult = await generateLocalContext(commune);
    totalInputTokens += contextResult.usage.input_tokens;
    totalOutputTokens += contextResult.usage.output_tokens;
    console.log(`     ${contextResult.paragraphs.length} paragraphs`);
    await sleep(DELAY_MS);

    console.log('  🤖 Generating detailed services...');
    const servicesResult = await generateDetailedServices(commune);
    totalInputTokens += servicesResult.usage.input_tokens;
    totalOutputTokens += servicesResult.usage.output_tokens;
    console.log(`     ${servicesResult.services.length} services`);
    await sleep(DELAY_MS);

    console.log('  🤖 Generating why choose local...');
    const whyChooseResult = await generateWhyChooseLocal(commune);
    totalInputTokens += whyChooseResult.usage.input_tokens;
    totalOutputTokens += whyChooseResult.usage.output_tokens;
    console.log(`     ${whyChooseResult.reasons.length} reasons`);
    await sleep(DELAY_MS);

    console.log('  🤖 Generating local FAQs...');
    const faqsResult = await generateLocalFAQs(commune);
    totalInputTokens += faqsResult.usage.input_tokens;
    totalOutputTokens += faqsResult.usage.output_tokens;
    console.log(`     ${faqsResult.faqs.length} FAQs`);
    await sleep(DELAY_MS);

    console.log('  🤖 Generating pricing section...');
    const pricingResult = await generatePricingSection(commune);
    totalInputTokens += pricingResult.usage.input_tokens;
    totalOutputTokens += pricingResult.usage.output_tokens;
    console.log(`     ${pricingResult.pricingData.pricing_points.length} pricing points`);

    // Calculate word count
    const allText = [
      ...contextResult.paragraphs,
      servicesResult.services.map(s => s.description).join(' '),
      whyChooseResult.reasons.map(r => r.description).join(' '),
      faqsResult.faqs.map(f => f.answer).join(' '),
      pricingResult.pricingData.intro,
      pricingResult.pricingData.pricing_points.map(p => p.description).join(' ')
    ].join(' ');
    const wordCount = allText.split(/\s+/).length;

    // Update frontmatter
    if (!args.DRY_RUN) {
      const contentPath = path.join(__dirname, '..', 'content', commune.url_path.replace(/^\//, ''), 'index.md');
      if (fs.existsSync(contentPath)) {
        const fileContent = fs.readFileSync(contentPath, 'utf-8');
        const parsed = matter(fileContent);

        // Add all new fields
        parsed.data.seoTitle = titleResult.title;
        parsed.data.seoMetaDescription = metaResult.description;
        parsed.data.seoContent = {
          localContext: {
            title: `Votre électricien à ${cityName}`,
            paragraphs: contextResult.paragraphs
          },
          servicesDetailed: {
            title: `Nos interventions électriques à ${cityName}`,
            intro: `Nos électriciens interviennent rapidement à ${cityName} pour tous types de travaux électriques.`,
            services: servicesResult.services
          },
          whyChooseLocal: {
            title: `Pourquoi choisir nos électriciens à ${cityName} ?`,
            reasons: whyChooseResult.reasons
          },
          faqLocal: faqsResult.faqs,
          pricing: {
            title: `Nos Tarifs Transparents à ${cityName}`,
            intro: pricingResult.pricingData.intro,
            pricing_points: pricingResult.pricingData.pricing_points
          }
        };
        parsed.data.seoEnhanced = true;
        parsed.data.seoEnhancedAt = new Date().toISOString();
        parsed.data.seoContentWordCount = wordCount;

        const updated = matter.stringify(parsed.content, parsed.data);
        fs.writeFileSync(contentPath, updated);
        console.log(`  ✅ Saved (~${wordCount} words)`);
      } else {
        console.log('  ⚠️  File not found');
        stats.failed++;
        return { inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
      }
    } else {
      console.log(`  ✅ [DRY RUN] Would save (~${wordCount} words)`);
    }

    stats.successful++;
    return { inputTokens: totalInputTokens, outputTokens: totalOutputTokens };

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    stats.failed++;
    return { inputTokens: 0, outputTokens: 0 };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('  COMPREHENSIVE SEO ENHANCEMENT');
  console.log('  Hugo Template Integrated');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Mode: ${args.DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Scope: ${args.TEST_ONLY ? 'TEST (5 communes)' : args.TIER ? `Tier ${args.TIER}` : 'ALL communes'}`);
  console.log('');

  // Load commune data
  console.log('📂 Loading commune data...');
  const sitemapData = require('../data/sitemap_pages.json');

  // Get communes based on scope
  let communes = [];

  if (args.TEST_ONLY) {
    const testSlugs = ['/sevres', '/meudon', '/versailles', '/poissy', '/evry'];
    communes = [
      ...Object.values(sitemapData.organized.tier_c_by_dept || {}).flat(),
      ...Object.values(sitemapData.organized.tier_d_by_dept || {}).flat()
    ].filter(p => testSlugs.includes(p.url_path)).slice(0, 5);
  } else if (args.TIER === 'tier_b') {
    communes = sitemapData.organized.tier_b?.paris || [];
  } else if (args.TIER === 'tier_c' && args.DEPT) {
    // Tier C filtered by department
    communes = sitemapData.organized.tier_c_by_dept?.[args.DEPT] || [];
  } else if (args.TIER === 'tier_c') {
    // All Tier C
    communes = Object.values(sitemapData.organized.tier_c_by_dept || {}).flat();
  } else if (args.TIER === 'tier_d' && args.DEPT) {
    // Tier D filtered by department - THIS IS THE FIX FOR PARALLEL PROCESSING
    communes = sitemapData.organized.tier_d_by_dept?.[args.DEPT] || [];
  } else if (args.TIER === 'tier_d') {
    // All Tier D
    communes = Object.values(sitemapData.organized.tier_d_by_dept || {}).flat();
  } else if (args.DEPT) {
    // Specific department (both tier_c and tier_d)
    communes = [
      ...(sitemapData.organized.tier_c_by_dept?.[args.DEPT] || []),
      ...(sitemapData.organized.tier_d_by_dept?.[args.DEPT] || [])
    ];
  } else {
    // All communes
    communes = [
      ...(sitemapData.organized.tier_b?.paris || []),
      ...Object.values(sitemapData.organized.tier_c_by_dept || {}).flat(),
      ...Object.values(sitemapData.organized.tier_d_by_dept || {}).flat()
    ];
  }

  if (args.LIMIT) {
    communes = communes.slice(0, args.LIMIT);
  }

  console.log(`✅ Found ${communes.length} communes to process\n`);

  // Initialize stats
  const stats = {
    total: communes.length,
    processed: 0,
    successful: 0,
    failed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0
  };

  // Process communes
  console.log('🚀 Starting generation...\n');
  console.log('═'.repeat(80));

  for (let i = 0; i < communes.length; i++) {
    const commune = communes[i];
    const result = await processCommune(commune, stats);

    stats.processed++;
    stats.totalInputTokens += result.inputTokens;
    stats.totalOutputTokens += result.outputTokens;

    // Save checkpoint every 10 pages
    if (stats.processed % 10 === 0) {
      saveCheckpoint({
        sessionId: `seo-enhancement-${new Date().toISOString().split('T')[0]}`,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        processed: stats,
        lastProcessedSlug: commune.url_path,
        costs: calculateCost(stats.totalInputTokens, stats.totalOutputTokens, MODEL)
      });
      console.log('\n💾 Checkpoint saved');
    }

    // Progress report every 50
    if (stats.processed % 50 === 0) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Progress: ${stats.processed}/${stats.total} (${Math.round(stats.processed / stats.total * 100)}%)`);
      const cost = calculateCost(stats.totalInputTokens, stats.totalOutputTokens, MODEL);
      console.log(`Cost so far: $${cost.cost.toFixed(4)}`);
      console.log('─'.repeat(80));
    }
  }

  // Final report
  console.log('\n' + '═'.repeat(80));
  console.log('  ENHANCEMENT COMPLETE');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📊 Results:`);
  console.log(`  Total processed: ${stats.total}`);
  console.log(`  Successful: ${stats.successful}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log('');

  const finalCost = calculateCost(stats.totalInputTokens, stats.totalOutputTokens, MODEL);
  console.log(`💰 Cost:`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Input tokens: ${stats.totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${stats.totalOutputTokens.toLocaleString()}`);
  console.log(`  Total cost: $${finalCost.cost.toFixed(4)}`);
  console.log('');

  if (args.DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No files were modified');
  } else if (args.TEST_ONLY) {
    console.log('🧪 TEST COMPLETE');
    console.log('Run without --test to process all communes');
  } else {
    console.log('✅ ALL PAGES ENHANCED');
    console.log('Next: Build Hugo site and deploy');
  }

  // Clean up checkpoint on success
  if (!args.DRY_RUN && stats.failed === 0) {
    try {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('🗑️  Checkpoint file removed');
    } catch (err) {
      // Ignore
    }
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
