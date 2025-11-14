#!/usr/bin/env node

/**
 * AI Configuration and Utilities for Electrician Content Generation
 * Shared configuration and helper functions for all AI-powered content scripts
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configuration
const CONFIG = {
  // Model selection
  MODEL: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
  MODEL_SONNET: 'claude-3-5-sonnet-20241022',

  // Rate limiting
  DELAY_MS: parseInt(process.env.RATE_LIMIT_MS) || 1500,
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 10,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,

  // Pricing (per million tokens)
  HAIKU_PRICING: {
    input: 0.80,
    output: 4.00
  },
  SONNET_PRICING: {
    input: 3.00,
    output: 15.00
  }
};

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Convert city name to proper case with French rules
 */
function toProperCase(cityName) {
  if (!cityName) return '';

  // First, lowercase everything and split by hyphens
  const words = cityName.toLowerCase().split('-');

  // Capitalize first letter of each word
  const capitalized = words.map((word, index) => {
    // Special cases for French words that should stay lowercase in middle of names
    if (index > 0 && ['sur', 'sous', 'les', 'des', 'de', 'la', 'le', 'en', 'et'].includes(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  let result = capitalized.join('-');

  // Fix special French characters and names
  result = result
    .replace(/asnieres/gi, 'Asnières')
    .replace(/genevieve/gi, 'Geneviève')
    .replace(/etang/gi, 'Étang')
    .replace(/eveque/gi, 'Évêque')
    .replace(/evry/gi, 'Évry')
    // Sainte/Saint should be capitalized when at start
    .replace(/^sainte-/gi, 'Sainte-')
    .replace(/^saint-/gi, 'Saint-');

  return result;
}

/**
 * Department names mapping for Île-de-France and Oise
 */
const DEPARTMENT_NAMES = {
  '60': 'Oise',
  '75': 'Paris',
  '77': 'Seine-et-Marne',
  '78': 'Yvelines',
  '91': 'Essonne',
  '92': 'Hauts-de-Seine',
  '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne',
  '95': 'Val-d\'Oise'
};

/**
 * Determine content theme based on city characteristics
 * Adapted for electrician services
 */
function determineContentTheme(cityName, keywords = '') {
  // For electrician services, themes are different from locksmith
  if (keywords.includes('urgence') || keywords.includes('depannage')) return 'urgence';
  if (keywords.includes('installation')) return 'installation';
  if (keywords.includes('renovation')) return 'renovation';
  if (keywords.includes('mise-aux-normes')) return 'normes';

  // Default distribution: 40% urgence, 30% installation, 20% renovation, 10% normes
  const rand = Math.random();
  if (rand < 0.4) return 'urgence';
  if (rand < 0.7) return 'installation';
  if (rand < 0.9) return 'renovation';
  return 'normes';
}

/**
 * Get theme guidance for electrician content generation
 */
function getThemeGuidance(theme) {
  const themes = {
    urgence: {
      keywords: 'urgence, panne, coupure, court-circuit, 24/7, intervention rapide, dépannage',
      tone: 'Reassuring, immediate, professional',
      focus: 'Emergency electrical repairs, power outages, circuit breaker issues',
      titlePattern: 'Électricien Urgence [City] 24h/24 | Dépannage Rapide',
      metaOpening: 'Électricien d\'urgence à',
      h2_1Pattern: 'Dépannage électrique urgent à [City]',
      h2_2Focus: 'Intervention 24h/24 et 7j/7',
      taglineAngle: 'Disponibilité et rapidité d\'intervention',
      heroFocus: 'Panne électrique ? Intervention en 30 minutes',
      aboutFocus: 'Service d\'urgence 24/7, interventions rapides, diagnostic gratuit'
    },
    installation: {
      keywords: 'installation, tableau électrique, prises, interrupteurs, câblage, neuf',
      tone: 'Professional, competent, detailed',
      focus: 'New electrical installations, panel upgrades, wiring',
      titlePattern: 'Installation Électrique [City] | Électricien Professionnel',
      metaOpening: 'Installation électrique professionnelle à',
      h2_1Pattern: 'Installations électriques à [City]',
      h2_2Focus: 'Tableaux électriques et câblage',
      taglineAngle: 'Installations conformes et durables',
      heroFocus: 'Votre projet d\'installation électrique réalisé par des experts',
      aboutFocus: 'Installations neuves, rénovations complètes, conformité garantie'
    },
    renovation: {
      keywords: 'rénovation, remise aux normes, modernisation, ancien, mise à jour',
      tone: 'Trustworthy, experienced, quality-focused',
      focus: 'Electrical renovations, upgrades, modernization',
      titlePattern: 'Rénovation Électrique [City] | Remise aux Normes',
      metaOpening: 'Rénovation électrique complète à',
      h2_1Pattern: 'Rénovation électrique à [City]',
      h2_2Focus: 'Modernisation et sécurisation',
      taglineAngle: 'Rénovation complète de votre installation',
      heroFocus: 'Modernisez votre installation électrique en toute sécurité',
      aboutFocus: 'Rénovation complète, diagnostic, devis gratuit, garantie décennale'
    },
    normes: {
      keywords: 'normes, NF C 15-100, conformité, sécurité, diagnostic, certification',
      tone: 'Expert, certified, safety-focused',
      focus: 'Compliance, safety standards, electrical certifications',
      titlePattern: 'Mise aux Normes Électriques [City] | NF C 15-100',
      metaOpening: 'Mise aux normes électriques à',
      h2_1Pattern: 'Mise en conformité électrique à [City]',
      h2_2Focus: 'Normes NF C 15-100 et sécurité',
      taglineAngle: 'Conformité et sécurité garanties',
      heroFocus: 'Mise aux normes NF C 15-100 par électricien certifié',
      aboutFocus: 'Diagnostic complet, mise en conformité, certification, attestation Consuel'
    }
  };

  return themes[theme] || themes.urgence;
}

/**
 * Calculate token usage and cost
 */
function calculateCost(inputTokens, outputTokens, model = CONFIG.MODEL) {
  const pricing = model.includes('sonnet') ? CONFIG.SONNET_PRICING : CONFIG.HAIKU_PRICING;
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: inputCost + outputCost,
    inputCost,
    outputCost
  };
}

/**
 * Retry wrapper for API calls
 */
async function retryWithBackoff(fn, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Generate AI content with retry logic
 */
async function generateAIContent(prompt, model = CONFIG.MODEL, temperature = 0.7, maxTokens = 1024) {
  return retryWithBackoff(async () => {
    const response = await anthropic.messages.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return {
      content: response.content[0].text,
      usage: response.usage
    };
  });
}

/**
 * Validate generated content meets requirements
 */
function validateContent(content, requirements) {
  const errors = [];

  if (requirements.minLength && content.length < requirements.minLength) {
    errors.push(`Content too short: ${content.length} < ${requirements.minLength}`);
  }

  if (requirements.maxLength && content.length > requirements.maxLength) {
    errors.push(`Content too long: ${content.length} > ${requirements.maxLength}`);
  }

  if (requirements.noMarkdown && /[*_#`]/.test(content)) {
    errors.push('Content contains markdown symbols');
  }

  if (requirements.language === 'french' && /\b(the|and|or|with)\b/i.test(content)) {
    errors.push('Content may contain English words');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract first line from multi-line content
 */
function extractFirstLine(content) {
  if (!content) return '';
  return content.split('\n')[0].trim();
}

/**
 * Remove markdown formatting
 */
function removeMarkdown(content) {
  return content
    .replace(/[*_]/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
}

module.exports = {
  anthropic,
  supabase,
  CONFIG,
  sleep,
  toProperCase,
  DEPARTMENT_NAMES,
  determineContentTheme,
  getThemeGuidance,
  calculateCost,
  retryWithBackoff,
  generateAIContent,
  validateContent,
  extractFirstLine,
  removeMarkdown
};