/**
 * A/B Test Variant Definitions
 *
 * Defines all possible variants for each testable element in the video.
 * Used for systematic A/B testing and performance optimization.
 */

/**
 * Intro Script Variants
 * Impact: First 3-5 seconds - critical for hook and retention
 */
export const introVariants = {
  urgency: {
    id: 'urgency',
    name: 'Urgency-Focused',
    description: 'Emphasizes emergency availability and rapid response',
    bestFor: 'Large cities, urban areas, high-urgency markets',
    hooks: [
      'Panne électrique urgente',
      'Besoin d\'un électricien maintenant',
      'Urgence électrique'
    ],
    estimatedRetention: 0.85, // Expected completion rate
    priority: 1
  },

  professional: {
    id: 'professional',
    name: 'Professional Authority',
    description: 'Emphasizes certifications, expertise, and professionalism',
    bestFor: 'Medium cities, professional demographics',
    hooks: [
      'Électricien certifié',
      'Expert électrique qualifié',
      'Service professionnel'
    ],
    estimatedRetention: 0.78,
    priority: 2
  },

  local: {
    id: 'local',
    name: 'Local Proximity',
    description: 'Emphasizes local service and community connection',
    bestFor: 'Small communes, suburban areas, tight-knit communities',
    hooks: [
      'Votre électricien de proximité',
      'Service local à [commune]',
      'Électricien de quartier'
    ],
    estimatedRetention: 0.82,
    priority: 3
  },

  immediate: {
    id: 'immediate',
    name: 'Immediate Action',
    description: 'Direct call-to-action with phone number upfront',
    bestFor: 'High-intent traffic, emergency searches',
    hooks: [
      'Appelez maintenant',
      'Intervention rapide',
      'Disponible immédiatement'
    ],
    estimatedRetention: 0.75,
    priority: 4
  },

  service: {
    id: 'service',
    name: 'Service-Focused',
    description: 'Lists services and capabilities upfront',
    bestFor: 'Informational searches, comparison shoppers',
    hooks: [
      'Dépannage électrique complet',
      'Tous travaux électriques',
      'Service électrique professionnel'
    ],
    estimatedRetention: 0.72,
    priority: 5
  }
};

/**
 * CTA (Call-to-Action) Variants
 * Impact: Conversion point - directly affects phone calls
 */
export const ctaVariants = {
  standard: {
    id: 'standard',
    name: 'Standard CTA',
    text: 'APPELEZ-NOUS',
    description: 'Simple, clear call to action',
    bestFor: 'General traffic, brand awareness',
    estimatedCTR: 0.12, // Expected click-through rate
    includePhone: false
  },

  urgent: {
    id: 'urgent',
    name: 'Urgent with Phone',
    text: 'URGENCE 24/7',
    description: 'Urgency emphasis with phone number',
    bestFor: 'Emergency traffic, high-intent searches',
    estimatedCTR: 0.18,
    includePhone: true
  },

  local: {
    id: 'local',
    name: 'Local Availability',
    text: 'VOTRE ÉLECTRICIEN\nDISPONIBLE MAINTENANT',
    description: 'Local + availability emphasis',
    bestFor: 'Local searches, community-focused',
    estimatedCTR: 0.15,
    includePhone: false
  },

  immediate: {
    id: 'immediate',
    name: 'Immediate Action',
    text: 'INTERVENTION RAPIDE\nAPPELEZ MAINTENANT',
    description: 'Speed + urgency combined',
    bestFor: 'High-urgency traffic',
    estimatedCTR: 0.16,
    includePhone: false
  },

  phone_focused: {
    id: 'phone_focused',
    name: 'Phone Number Focus',
    text: 'APPELEZ-NOUS',
    description: 'Phone number prominently displayed',
    bestFor: 'Mobile traffic, direct response',
    estimatedCTR: 0.20,
    includePhone: true
  }
};

/**
 * Description Variants
 * Impact: Mid-video retention and information delivery
 */
export const descriptionVariants = {
  standard: {
    id: 'standard',
    name: 'Standard Description',
    template: 'Intervention rapide à {commune}. Appelez au {phone} - Disponible 24/7',
    description: 'Balanced information delivery',
    bestFor: 'General traffic'
  },

  urgent: {
    id: 'urgent',
    name: 'Urgent Emergency',
    template: 'URGENCE ÉLECTRIQUE à {commune}? {phone} - Intervention sous 30 min - 24/7',
    description: 'Urgency + speed emphasis',
    bestFor: 'Emergency searches, competitive markets'
  },

  local: {
    id: 'local',
    name: 'Local Service',
    template: 'Votre électricien à {commune}. {phone} - Service de proximité 24/7',
    description: 'Local connection emphasis',
    bestFor: 'Community-focused, suburban areas'
  },

  professional: {
    id: 'professional',
    name: 'Professional Certification',
    template: 'Service électrique professionnel à {commune}. {phone} - Certifié Qualifelec',
    description: 'Certification and expertise emphasis',
    bestFor: 'Professional demographics, quality-focused'
  }
};

/**
 * Trust Badge Variants
 * Impact: Credibility and trust building
 */
export const trustBadgeVariants = {
  certifications: {
    id: 'certifications',
    name: 'Certifications Only',
    focus: ['Qualifelec', 'RGE'],
    description: 'Professional certifications emphasis',
    bestFor: 'Professional demographics'
  },

  reviews: {
    id: 'reviews',
    name: 'Reviews and Ratings',
    focus: ['rating', 'reviewCount'],
    description: 'Social proof emphasis',
    bestFor: 'Consumer traffic, comparison shoppers'
  },

  insurance: {
    id: 'insurance',
    name: 'Insurance and Guarantee',
    focus: ['Assurance Décennale', 'guarantee'],
    description: 'Safety and guarantee emphasis',
    bestFor: 'Risk-averse customers, major work'
  },

  all: {
    id: 'all',
    name: 'All Trust Signals',
    focus: ['certifications', 'rating', 'reviewCount', 'insurance'],
    description: 'Comprehensive trust building',
    bestFor: 'General traffic, maximum credibility'
  }
};

/**
 * Service Headline Variants
 * Impact: Mid-video messaging and positioning
 */
export const serviceHeadlineVariants = {
  emergency: {
    id: 'emergency',
    name: 'Emergency Focus',
    text: 'URGENCE ÉLECTRIQUE 24/7\nEXPERT CERTIFIÉ',
    bestFor: 'Large cities, high urgency'
  },

  fast_service: {
    id: 'fast_service',
    name: 'Fast Service',
    text: 'DÉPANNAGE ÉLECTRIQUE\nINTERVENTION RAPIDE',
    bestFor: 'Medium cities, balanced approach'
  },

  local_expert: {
    id: 'local_expert',
    name: 'Local Expert',
    text: 'ÉLECTRICIEN LOCAL\nSERVICE DE PROXIMITÉ',
    bestFor: 'Small communes, community focus'
  },

  professional: {
    id: 'professional',
    name: 'Professional Service',
    text: 'SERVICE ÉLECTRIQUE\nPROFESSIONNEL CERTIFIÉ',
    bestFor: 'Professional demographics'
  }
};

/**
 * Complete A/B Test Configurations
 * Pre-defined test combinations for common scenarios
 */
export const testConfigurations = {
  // High-urgency market test (large cities)
  urgency_test: {
    name: 'Urgency vs Professional',
    variants: [
      {
        id: 'urgency_urgent',
        intro: 'urgency',
        cta: 'urgent',
        description: 'urgent',
        trustBadge: 'all',
        headline: 'emergency'
      },
      {
        id: 'urgency_professional',
        intro: 'professional',
        cta: 'phone_focused',
        description: 'professional',
        trustBadge: 'certifications',
        headline: 'professional'
      }
    ],
    bestFor: 'Large cities (>50k population)',
    hypothesis: 'Urgency messaging will outperform professional messaging in high-population areas'
  },

  // Local market test (small communes)
  local_test: {
    name: 'Local vs Service',
    variants: [
      {
        id: 'local_proximity',
        intro: 'local',
        cta: 'local',
        description: 'local',
        trustBadge: 'reviews',
        headline: 'local_expert'
      },
      {
        id: 'local_service',
        intro: 'service',
        cta: 'standard',
        description: 'standard',
        trustBadge: 'all',
        headline: 'fast_service'
      }
    ],
    bestFor: 'Small communes (<10k population)',
    hypothesis: 'Local proximity messaging will outperform generic service messaging in small communities'
  },

  // CTA optimization test (all markets)
  cta_test: {
    name: 'CTA Format Test',
    variants: [
      {
        id: 'cta_standard',
        intro: 'urgency',
        cta: 'standard',
        description: 'standard',
        trustBadge: 'all',
        headline: 'emergency'
      },
      {
        id: 'cta_phone',
        intro: 'urgency',
        cta: 'phone_focused',
        description: 'standard',
        trustBadge: 'all',
        headline: 'emergency'
      },
      {
        id: 'cta_urgent',
        intro: 'urgency',
        cta: 'urgent',
        description: 'urgent',
        trustBadge: 'all',
        headline: 'emergency'
      }
    ],
    bestFor: 'All markets',
    hypothesis: 'Phone-focused CTA will drive highest conversion rates'
  },

  // Trust signal test
  trust_test: {
    name: 'Trust Signal Optimization',
    variants: [
      {
        id: 'trust_certifications',
        intro: 'professional',
        cta: 'standard',
        description: 'professional',
        trustBadge: 'certifications',
        headline: 'professional'
      },
      {
        id: 'trust_reviews',
        intro: 'professional',
        cta: 'standard',
        description: 'standard',
        trustBadge: 'reviews',
        headline: 'professional'
      },
      {
        id: 'trust_all',
        intro: 'professional',
        cta: 'standard',
        description: 'professional',
        trustBadge: 'all',
        headline: 'professional'
      }
    ],
    bestFor: 'All markets',
    hypothesis: 'Combined trust signals (all) will outperform single-focus approaches'
  }
};

/**
 * Get recommended variant based on commune characteristics
 * @param {Object} commune - Commune data
 * @returns {Object} - Recommended variant configuration
 */
export function getRecommendedVariantConfig(commune) {
  const { population } = commune;

  if (population > 50000) {
    // Large city: urgency-focused
    return {
      intro: 'urgency',
      cta: 'urgent',
      description: 'urgent',
      trustBadge: 'all',
      headline: 'emergency',
      reasoning: 'Large city - high urgency, competitive market'
    };
  }

  if (population > 10000) {
    // Medium city: professional balanced
    return {
      intro: 'professional',
      cta: 'phone_focused',
      description: 'professional',
      trustBadge: 'all',
      headline: 'fast_service',
      reasoning: 'Medium city - professional credibility focus'
    };
  }

  // Small commune: local proximity
  return {
    intro: 'local',
    cta: 'local',
    description: 'local',
    trustBadge: 'reviews',
    headline: 'local_expert',
    reasoning: 'Small commune - local community focus'
  };
}

/**
 * Get all possible variant combinations
 * @returns {Array} - All possible variant combinations
 */
export function getAllVariantCombinations() {
  const combinations = [];

  Object.keys(introVariants).forEach(intro => {
    Object.keys(ctaVariants).forEach(cta => {
      Object.keys(descriptionVariants).forEach(desc => {
        Object.keys(trustBadgeVariants).forEach(trust => {
          combinations.push({
            id: `${intro}_${cta}_${desc}_${trust}`,
            intro,
            cta,
            description: desc,
            trustBadge: trust
          });
        });
      });
    });
  });

  return combinations;
}

/**
 * Get variant by ID
 * @param {string} type - Variant type (intro, cta, description, trustBadge)
 * @param {string} id - Variant ID
 * @returns {Object|null} - Variant configuration
 */
export function getVariantById(type, id) {
  const variantMaps = {
    intro: introVariants,
    cta: ctaVariants,
    description: descriptionVariants,
    trustBadge: trustBadgeVariants,
    headline: serviceHeadlineVariants
  };

  return variantMaps[type]?.[id] || null;
}

/**
 * Validate variant configuration
 * @param {Object} config - Variant configuration
 * @returns {boolean} - True if valid
 */
export function validateVariantConfig(config) {
  return (
    config.intro in introVariants &&
    config.cta in ctaVariants &&
    config.description in descriptionVariants &&
    config.trustBadge in trustBadgeVariants
  );
}

export default {
  introVariants,
  ctaVariants,
  descriptionVariants,
  trustBadgeVariants,
  serviceHeadlineVariants,
  testConfigurations,
  getRecommendedVariantConfig,
  getAllVariantCombinations,
  getVariantById,
  validateVariantConfig
};
