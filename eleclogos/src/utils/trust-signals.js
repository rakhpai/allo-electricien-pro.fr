/**
 * Trust Signal Management
 * Brand: ALLO-Electricien.PRO
 *
 * Certifications: Qualifelec, RGE, Assurance Décennale
 * Purpose: Build credibility and trust in videos
 */

import logger from './logger.js';

/**
 * Get complete trust signals for a commune
 * @param {Object} commune - Commune data
 * @returns {Object} - Trust signal package
 */
export function getTrustSignals(commune) {
  const reviewCount = calculateReviewCount(commune.population);

  return {
    // Professional certifications
    certifications: ['Qualifelec', 'RGE', 'Assurance Décennale'],

    // Experience and reputation
    yearsOfService: 15,
    reviewCount,
    rating: 4.8,

    // Insurance and guarantees
    insuranceInfo: 'Assurance Responsabilité Civile Professionnelle',
    guaranteeText: 'Garantie sur tous nos travaux',

    // Additional trust elements
    availability: '24/7',
    responseTime: 'Intervention sous 30 minutes',
    coverage: 'Île-de-France'
  };
}

/**
 * Calculate appropriate review count based on commune population
 * Larger communes = more reviews for credibility scaling
 * @param {number} population - Commune population
 * @returns {number} - Review count
 */
function calculateReviewCount(population) {
  if (population < 10000) return 50;   // Small communes
  if (population < 50000) return 150;  // Medium communes
  return 300;                           // Large communes/cities
}

/**
 * Format certification badges for display
 * @param {Array<string>} certifications - List of certifications
 * @param {string} separator - Separator between badges
 * @returns {string} - Formatted certification string
 */
export function formatCertificationBadge(certifications, separator = ' • ') {
  return certifications.join(separator);
}

/**
 * Format rating text with social proof
 * @param {number} rating - Rating value (e.g., 4.8)
 * @param {number} reviewCount - Number of reviews
 * @param {string} commune - Commune name for localization
 * @returns {string} - Formatted rating text
 */
export function formatRatingText(rating, reviewCount, commune) {
  return `Note ${rating}/5 ★ - ${reviewCount}+ clients à ${commune}`;
}

/**
 * Format experience text
 * @param {number} years - Years of service
 * @returns {string} - Experience text
 */
export function formatExperienceText(years) {
  return `${years} ans d'expérience`;
}

/**
 * Get trust signal variant based on preference
 * @param {string} variant - Variant type (certifications|reviews|insurance|all)
 * @param {Object} trustSignals - Complete trust signals object
 * @returns {Object} - Filtered trust signals
 */
export function getTrustSignalVariant(variant, trustSignals) {
  const variants = {
    certifications: {
      primary: formatCertificationBadge(['Qualifelec', 'RGE']),
      secondary: formatExperienceText(trustSignals.yearsOfService)
    },
    reviews: {
      primary: `Note ${trustSignals.rating}/5 ★`,
      secondary: `${trustSignals.reviewCount}+ clients satisfaits`
    },
    insurance: {
      primary: 'Assurance Décennale',
      secondary: 'Garantie tous travaux'
    },
    all: {
      primary: formatCertificationBadge(trustSignals.certifications),
      secondary: `${trustSignals.rating}/5 ★ - ${trustSignals.yearsOfService} ans - ${trustSignals.reviewCount}+ clients`
    }
  };

  return variants[variant] || variants.all;
}

/**
 * Get urgency level based on commune characteristics
 * @param {Object} commune - Commune data
 * @returns {string} - Urgency level (low|medium|high)
 */
export function getUrgencyLevel(commune) {
  const { population } = commune;

  // High-density urban areas = higher urgency messaging
  if (population > 50000) return 'high';
  if (population > 10000) return 'medium';
  return 'low';
}

/**
 * Get recommended intro variant based on commune profile
 * @param {Object} commune - Commune data
 * @returns {string} - Recommended intro variant
 */
export function getRecommendedIntroVariant(commune) {
  const urgencyLevel = getUrgencyLevel(commune);

  const recommendations = {
    high: 'urgency',      // Large cities: urgency-focused
    medium: 'professional', // Medium towns: professional tone
    low: 'local'          // Small communes: local/personal
  };

  return recommendations[urgencyLevel];
}

/**
 * Validate trust signal data
 * @param {Object} trustSignals - Trust signals to validate
 * @returns {Object} - Validation result
 */
export function validateTrustSignals(trustSignals) {
  const errors = [];
  const warnings = [];

  if (!trustSignals.certifications || trustSignals.certifications.length === 0) {
    warnings.push('No certifications specified');
  }

  if (trustSignals.rating < 1 || trustSignals.rating > 5) {
    errors.push(`Invalid rating: ${trustSignals.rating} (must be 1-5)`);
  }

  if (trustSignals.reviewCount < 0) {
    errors.push(`Invalid review count: ${trustSignals.reviewCount}`);
  }

  if (trustSignals.yearsOfService < 0) {
    errors.push(`Invalid years of service: ${trustSignals.yearsOfService}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate complete trust badge text for overlay
 * @param {Object} commune - Commune data
 * @param {string} variant - Badge variant type
 * @returns {string} - Complete badge text
 */
export function generateTrustBadgeText(commune, variant = 'all') {
  const trustSignals = getTrustSignals(commune);
  const signalVariant = getTrustSignalVariant(variant, trustSignals);

  return `${signalVariant.primary}\n${signalVariant.secondary}`;
}

export default {
  getTrustSignals,
  formatCertificationBadge,
  formatRatingText,
  formatExperienceText,
  getTrustSignalVariant,
  getUrgencyLevel,
  getRecommendedIntroVariant,
  validateTrustSignals,
  generateTrustBadgeText
};
