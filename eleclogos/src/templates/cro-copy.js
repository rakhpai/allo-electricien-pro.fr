/**
 * CRO-Optimized Copy Generation
 * Brand: ALLO-Electricien.PRO
 *
 * Generates conversion-optimized copy for all video text elements
 * Personalized by commune, urgency level, and A/B test variants
 */

import { getTrustSignals, getUrgencyLevel, formatRatingText } from '../utils/trust-signals.js';
import logger from '../utils/logger.js';

/**
 * Generate description text (phone number + CTA section)
 * Timeline: 9.34s - 15.39s
 * @param {Object} commune - Commune data
 * @param {string} phone - Phone number to display
 * @param {string} variant - Copy variant (standard|urgent|local)
 * @returns {string} - Description text
 */
export function generateDescriptionText(commune, phone, variant = 'standard') {
  const templates = {
    standard: `Intervention rapide à ${commune.name}. Appelez au ${phone} - Disponible 24/7`,

    urgent: `URGENCE ÉLECTRIQUE à ${commune.name}? ${phone} - Intervention sous 30 min - 24/7`,

    local: `Votre électricien à ${commune.name}. ${phone} - Service de proximité 24/7`,

    professional: `Service électrique professionnel à ${commune.name}. ${phone} - Certifié Qualifelec`
  };

  return templates[variant] || templates.standard;
}

/**
 * Generate Result Title text (search results section)
 * Timeline: 4.86s - 8.37s
 * Includes social proof and trust signals
 * @param {Object} commune - Commune data
 * @param {Object} trustSignals - Trust signal data
 * @param {boolean} includeBrand - Include brand name (default true)
 * @returns {string} - Result title text
 */
export function generateResultTitle(commune, trustSignals, includeBrand = true) {
  const { reviewCount, rating, yearsOfService } = trustSignals;

  const brandLine = includeBrand ? 'ALLO-Electricien.PRO\n' : '';
  const proofLine = `${reviewCount}+ interventions à ${commune.name}`;
  const ratingLine = `Note ${rating}/5 ★ - ${yearsOfService} ans d'expérience`;

  return `${brandLine}${proofLine}\n${ratingLine}`;
}

/**
 * Generate CTA text variants
 * Timeline: 16.49s - 21.20s (first CTA)
 * @param {string} variant - CTA variant (standard|urgent|local|immediate)
 * @param {string} phone - Optional phone number to include
 * @returns {string} - CTA text
 */
export function generateCTAText(variant = 'standard', phone = null) {
  const variants = {
    standard: 'APPELEZ-NOUS',

    urgent: phone
      ? `URGENCE 24/7\n${phone}`
      : 'URGENCE 24/7\nAPPELEZ MAINTENANT',

    local: 'VOTRE ÉLECTRICIEN\nDISPONIBLE MAINTENANT',

    immediate: 'INTERVENTION RAPIDE\nAPPELEZ MAINTENANT',

    phone_focused: phone
      ? `APPELEZ-NOUS\n${phone}`
      : 'APPELEZ-NOUS MAINTENANT'
  };

  return variants[variant] || variants.standard;
}

/**
 * Generate service headline based on commune size
 * Timeline: 22.50s - 27.41s (final section)
 * @param {Object} commune - Commune data
 * @param {string} customText - Optional custom text override
 * @returns {string} - Service headline
 */
export function generateServiceHeadline(commune, customText = null) {
  if (customText) return customText;

  const { population } = commune;

  // Small communes (<10k): Local, personal approach
  if (population < 10000) {
    return 'ÉLECTRICIEN LOCAL\nSERVICE DE PROXIMITÉ';
  }

  // Medium communes (10k-50k): Professional service
  if (population < 50000) {
    return 'DÉPANNAGE ÉLECTRIQUE\nINTERVENTION RAPIDE';
  }

  // Large cities (>50k): Urgency and expertise
  return 'URGENCE ÉLECTRIQUE 24/7\nEXPERT CERTIFIÉ';
}

/**
 * Generate trust badge overlay text
 * Can be displayed at various points for credibility
 * @param {Array<string>} certifications - List of certifications
 * @param {string} separator - Separator between badges
 * @returns {string} - Trust badge text
 */
export function generateTrustBadgeText(certifications, separator = ' • ') {
  return certifications.join(separator);
}

/**
 * Generate complete copy package for a commune (Template 2)
 * Returns all personalized text elements for the template
 *
 * Template 2 uses only: City 2, City 3, City 4, Search Keywords, Cp, Tel-number, Audio sources
 * Note: description, resultTitle, ctaText, serviceHeadline are NOT in template 2 (kept for compatibility)
 *
 * @param {Object} commune - Commune data
 * @param {Object} options - Copy generation options
 * @returns {Object} - Complete copy package
 */
export function generateCompleteCopyPackage(commune, options = {}) {
  const {
    phone = '06 44 64 71 75',
    descriptionVariant = 'standard',
    ctaVariant = 'standard',
    trustBadgeVariant = 'all',
    includePhoneInCTA = false
  } = options;

  // Get trust signals for the commune
  const trustSignals = getTrustSignals(commune);
  const urgencyLevel = getUrgencyLevel(commune);

  // Generate copy elements (template 2: simplified to 7 dynamic elements)
  const copyPackage = {
    // ===== TEMPLATE 2 ELEMENTS (actively used) =====
    // Brand consistency
    brandName: 'ALLO-Electricien.PRO',

    // City names (3 formats for template 2)
    cityUppercase: commune.name.toUpperCase(),  // City 2
    cityNormal: commune.name,                    // City 3

    // Service identifiers
    serviceCity: `Électricien ${commune.name}`, // City 4 (not uppercase in template 2)
    searchKeywords: `Électricien ${commune.name}`, // Search Keywords

    // Postal code
    postalCode: commune.code ? commune.code.substring(0, 5) : '', // Cp

    // Phone number (dedicated element in template 2)
    phoneNumber: phone,  // Tel-number

    // ===== LEGACY FIELDS (not in template 2, kept for compatibility/tracking) =====
    description: generateDescriptionText(commune, phone, descriptionVariant),
    resultTitle: generateResultTitle(commune, trustSignals),
    ctaText: generateCTAText(ctaVariant, includePhoneInCTA ? phone : null),
    serviceHeadline: generateServiceHeadline(commune),
    trustBadge: generateTrustBadgeText(trustSignals.certifications),

    // Trust signals
    trustSignals,

    // Metadata
    urgencyLevel,
    populationSize: commune.population < 10000 ? 'small' : commune.population < 50000 ? 'medium' : 'large'
  };

  logger.debug('Generated copy package for Template 2', {
    commune: commune.name,
    urgencyLevel,
    activeElements: 7, // Template 2 has 7 dynamic elements
    phone
  });

  return copyPackage;
}

/**
 * Validate copy package for completeness (Template 2)
 * @param {Object} copyPackage - Copy package to validate
 * @returns {Object} - Validation result
 */
export function validateCopyPackage(copyPackage) {
  // Template 2 required fields only (7 dynamic elements)
  const required = [
    'brandName',
    'cityUppercase',      // City 2
    'cityNormal',         // City 3
    'serviceCity',        // City 4
    'searchKeywords',     // Search Keywords
    'postalCode',         // Cp
    'phoneNumber'         // Tel-number (NEW in template 2)
  ];

  const missing = required.filter(field => !copyPackage[field]);
  const warnings = [];

  // Template 2 validations
  if (copyPackage.phoneNumber && !copyPackage.phoneNumber.match(/\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/)) {
    warnings.push('Phone number format may be invalid');
  }

  // Check text length limits (Creatomate text element constraints)
  if (copyPackage.cityNormal.length > 50) {
    warnings.push(`City name too long: ${copyPackage.cityNormal.length} chars (max 50)`);
  }

  if (copyPackage.searchKeywords.length > 80) {
    warnings.push(`Search keywords too long: ${copyPackage.searchKeywords.length} chars (max 80)`);
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Generate A/B test copy variants
 * Creates multiple versions for testing
 * @param {Object} commune - Commune data
 * @param {string} phone - Phone number
 * @returns {Object} - Map of variant names to copy packages
 */
export function generateABTestVariants(commune, phone) {
  const variants = {
    control: generateCompleteCopyPackage(commune, {
      phone,
      descriptionVariant: 'standard',
      ctaVariant: 'standard'
    }),

    urgent: generateCompleteCopyPackage(commune, {
      phone,
      descriptionVariant: 'urgent',
      ctaVariant: 'urgent',
      includePhoneInCTA: true
    }),

    local: generateCompleteCopyPackage(commune, {
      phone,
      descriptionVariant: 'local',
      ctaVariant: 'local'
    }),

    professional: generateCompleteCopyPackage(commune, {
      phone,
      descriptionVariant: 'professional',
      ctaVariant: 'immediate'
    })
  };

  return variants;
}

/**
 * Get recommended copy variant based on commune profile
 * @param {Object} commune - Commune data
 * @returns {string} - Recommended variant name
 */
export function getRecommendedVariant(commune) {
  const urgencyLevel = getUrgencyLevel(commune);

  const recommendations = {
    high: 'urgent',         // Large cities: urgency-focused
    medium: 'professional', // Medium towns: professional
    low: 'local'           // Small communes: local/personal
  };

  return recommendations[urgencyLevel] || 'control';
}

export default {
  generateDescriptionText,
  generateResultTitle,
  generateCTAText,
  generateServiceHeadline,
  generateTrustBadgeText,
  generateCompleteCopyPackage,
  validateCopyPackage,
  generateABTestVariants,
  getRecommendedVariant
};
