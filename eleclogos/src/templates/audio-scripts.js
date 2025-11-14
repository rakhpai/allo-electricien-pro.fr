/**
 * Dual Audio Script Generator
 * Generates two scripts per commune:
 * 1. Intro Hook (3-5 seconds) - Short attention-grabbing intro
 * 2. Full Voice-over (30-35 seconds) - Complete service description
 *
 * DUAL AUDIO TIMELINE (Template: cce484ec-163f-48af-8d36-f21080113e19)
 * ================================================================================
 *
 * INTRO AUDIO TRACK:
 * - Timeline: 0s - ~3.59s
 * - Purpose: Immediate attention grab, establishes urgency/relevance
 * - Sync: Plays alongside city name + postal code visual (0.38-3.23s)
 * - Duration: 3-5 seconds maximum (must complete before full audio starts)
 *
 * FULL AUDIO TRACK:
 * - Timeline: 3.59s - 27.23s (23.64s duration)
 * - Purpose: Complete service description, benefits, CTA
 * - Sync: Aligns with service description (9.34s) and CTA visuals (16.49s, 21.76s)
 * - Duration: 30-35 seconds of content → compressed to ~24s by ElevenLabs
 *
 * CRITICAL: Intro must be ≤5s to avoid overlap with full audio track at 3.59s
 */

import { generateScript, determineCommuneSize } from './scripts.js';

/**
 * Intro script templates by urgency level
 * Duration: 3-5 seconds each
 * Multiple variants per category for randomization
 */
const introScripts = {
  urgency: [
    {
      template: "Urgence électrique à {COMMUNE_NAME} ?",
      estimatedDuration: 3,
    },
    {
      template: "Panne électrique à {COMMUNE_NAME} ? Intervention rapide !",
      estimatedDuration: 4,
    },
    {
      template: "Besoin urgent d'un électricien à {COMMUNE_NAME} ?",
      estimatedDuration: 4,
    },
  ],
  professional: [
    {
      template: "Besoin d'un électricien à {COMMUNE_NAME} ?",
      estimatedDuration: 3,
    },
    {
      template: "Recherchez un électricien professionnel à {COMMUNE_NAME} ?",
      estimatedDuration: 4,
    },
    {
      template: "Électricien certifié à {COMMUNE_NAME}, à votre service.",
      estimatedDuration: 4,
    },
  ],
  immediate: [
    {
      template: "Électricien {COMMUNE_NAME}, intervention rapide !",
      estimatedDuration: 4,
    },
    {
      template: "Dépannage électrique immédiat à {COMMUNE_NAME} !",
      estimatedDuration: 4,
    },
    {
      template: "{COMMUNE_NAME} : Électricien disponible maintenant.",
      estimatedDuration: 3,
    },
  ],
  service: [
    {
      template: "Service électrique {COMMUNE_NAME}, disponible maintenant.",
      estimatedDuration: 4,
    },
    {
      template: "Votre électricien à {COMMUNE_NAME}, 24h sur 24.",
      estimatedDuration: 3,
    },
    {
      template: "Dépannage électrique à {COMMUNE_NAME}, 7 jours sur 7.",
      estimatedDuration: 4,
    },
  ],
  local: [
    {
      template: "Votre électricien local à {COMMUNE_NAME}.",
      estimatedDuration: 3,
    },
    {
      template: "Électricien de proximité à {COMMUNE_NAME}.",
      estimatedDuration: 3,
    },
    {
      template: "Artisan électricien à {COMMUNE_NAME}, proche de chez vous.",
      estimatedDuration: 4,
    },
  ],
};

/**
 * Generate intro hook script with random variant selection
 * @param {Object} commune - Commune data
 * @param {string} category - Script category (urgency, professional, immediate, service, local)
 * @returns {Object} - Intro script details
 */
export function generateIntroScript(commune, category = 'urgency') {
  // Get variants for the category (default to urgency if invalid)
  const variants = introScripts[category] || introScripts.urgency;

  // Randomly select one variant from the category
  const randomIndex = Math.floor(Math.random() * variants.length);
  const template = variants[randomIndex];

  const script = template.template
    .replace(/{COMMUNE_NAME}/g, commune.name)
    .replace(/{DEPARTMENT}/g, commune.department || 'Île-de-France')
    .replace(/{REGION}/g, commune.region || 'Île-de-France');

  return {
    script,
    category,
    variantIndex: randomIndex,
    estimatedDuration: template.estimatedDuration,
    characterCount: script.length,
  };
}

/**
 * Generate dual scripts for a commune
 * @param {Object} commune - Commune data
 * @param {Object} options - Generation options
 * @returns {Object} - Both intro and full scripts
 */
export function generateDualScripts(commune, options = {}) {
  const { introVariant = 'urgency' } = options;

  // Generate intro hook (3-5 seconds)
  const introScript = generateIntroScript(commune, introVariant);

  // Generate full voice-over (30-35 seconds based on size)
  const fullScript = generateScript(commune);

  const size = determineCommuneSize(commune.population);

  return {
    intro: {
      script: introScript.script,
      duration: introScript.estimatedDuration,
      category: introScript.category,
      variantIndex: introScript.variantIndex,
      characterCount: introScript.characterCount,
    },
    full: {
      script: fullScript.script,
      duration: fullScript.estimatedDuration,
      size: fullScript.size,
      characterCount: fullScript.script.length,
    },
    combined: {
      totalDuration: introScript.estimatedDuration + fullScript.estimatedDuration,
      totalCharacters: introScript.characterCount + fullScript.script.length,
      communeSize: size,
    },
  };
}

/**
 * Get available intro variants
 * @returns {Array} - List of available variants with descriptions
 */
export function getIntroVariants() {
  return [
    {
      name: 'urgency',
      description: 'Urgency-focused intro for emergency situations',
      example: 'Urgence électrique à Paris ?',
      duration: 3,
    },
    {
      name: 'professional',
      description: 'Professional and service-oriented',
      example: "Besoin d'un électricien à Paris ?",
      duration: 3,
    },
    {
      name: 'immediate',
      description: 'Emphasizes quick response',
      example: 'Électricien Paris, intervention rapide !',
      duration: 4,
    },
    {
      name: 'service',
      description: 'Service availability focused',
      example: 'Service électrique Paris, disponible maintenant.',
      duration: 4,
    },
    {
      name: 'local',
      description: 'Emphasizes local presence',
      example: 'Votre électricien local à Paris.',
      duration: 3,
    },
  ];
}

/**
 * Validate dual script generation for a commune
 * @param {Object} commune - Commune data
 * @returns {Object} - Validation result
 */
export function validateDualScripts(commune) {
  const errors = [];
  const warnings = [];

  // Validate required fields
  if (!commune.name) {
    errors.push('Commune name is required');
  }

  if (!commune.population) {
    warnings.push('Population not provided, will use default sizing');
  }

  // Generate scripts to test
  try {
    const scripts = generateDualScripts(commune);

    // Validate duration constraints
    if (scripts.intro.duration < 2 || scripts.intro.duration > 6) {
      warnings.push(`Intro duration ${scripts.intro.duration}s is outside recommended range (3-5s)`);
    }

    if (scripts.full.duration < 28 || scripts.full.duration > 37) {
      warnings.push(`Full script duration ${scripts.full.duration}s is outside recommended range (30-35s)`);
    }

    // Validate character counts (ElevenLabs has limits)
    if (scripts.intro.characterCount > 500) {
      errors.push(`Intro script too long: ${scripts.intro.characterCount} characters`);
    }

    if (scripts.full.characterCount > 5000) {
      errors.push(`Full script too long: ${scripts.full.characterCount} characters`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      scripts,
    };
  } catch (error) {
    errors.push(`Script generation failed: ${error.message}`);
    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Generate test scripts for all commune sizes
 * Useful for debugging and preview
 */
export function generateTestScripts() {
  const testCommunes = [
    {
      name: 'Petit Village',
      code: '75001',
      department: '75',
      region: 'Île-de-France',
      population: 5000, // Small
    },
    {
      name: 'Ville Moyenne',
      code: '75002',
      department: '75',
      region: 'Île-de-France',
      population: 25000, // Medium
    },
    {
      name: 'Grande Ville',
      code: '75003',
      department: '75',
      region: 'Île-de-France',
      population: 100000, // Large
    },
  ];

  return testCommunes.map((commune) => {
    const scripts = generateDualScripts(commune);
    return {
      commune: commune.name,
      population: commune.population,
      size: scripts.combined.communeSize,
      scripts,
    };
  });
}

export default generateDualScripts;
