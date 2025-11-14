/**
 * Voice-over script templates for different commune sizes
 * Templates are personalized based on commune characteristics
 *
 * TIMELINE SYNCHRONIZATION (Template: cce484ec-163f-48af-8d36-f21080113e19)
 * ================================================================================
 * Video Duration: 27.4 seconds total
 *
 * INTRO AUDIO (0s - ~3.59s):
 * - Short hook script (3-5s) from audio-scripts.js
 * - Plays immediately, grabs attention
 * - Visual: City name + postal code overlay (0.38-3.23s)
 *
 * FULL AUDIO (3.59s - 27.23s = 23.64s):
 * - Main voice-over script (30-35s content compressed by ElevenLabs)
 * - Timeline breakdown:
 *   • 3.59-9.34s  (5.75s): Introduction & problem statement
 *   • 9.34-15.39s (6.05s): Service description (matches "Service description" text overlay)
 *   • 15.39-21.20s (5.81s): First CTA section (matches first CTA text at 16.49s)
 *   • 21.20-27.23s (6.03s): Final CTA & urgency (matches final CTA text at 21.76s)
 *
 * VISUAL SYNC POINTS:
 * - 9.34s:  Service description text appears → voice should describe services
 * - 16.49s: First CTA text appears → voice should emphasize action
 * - 21.76s: Final CTA text appears → voice should create urgency
 *
 * NOTE: ElevenLabs naturally compresses speech, so a 30-35 second script typically
 * renders to ~24 seconds of actual audio, which matches our 23.64s target perfectly.
 */

/**
 * Determine commune size category based on population
 * @param {number} population - Commune population
 * @returns {string} - 'small', 'medium', or 'large'
 */
export function determineCommuneSize(population) {
  if (population < 10000) return 'small';
  if (population < 50000) return 'medium';
  return 'large';
}

/**
 * Script templates for small communes (< 10,000 inhabitants)
 * Multiple variants for randomization
 *
 * Timeline alignment (after 3.59s intro):
 * [0-6s]    Introduction & credibility
 * [6-12s]   Service description (aligns with visual at 9.34s)
 * [12-18s]  Benefits & trust signals (aligns with first CTA at 16.49s)
 * [18-24s]  Call to action & urgency (aligns with final CTA at 21.76s)
 */
export const smallCommuneScripts = [
  {
    template: `Besoin d'un électricien à {COMMUNE_NAME}?

Nous sommes votre électricien de confiance, disponible 24 heures sur 24, 7 jours sur 7.

Que ce soit pour une urgence électrique, une panne de courant, un problème de tableau électrique ou l'installation de nouvelles prises, notre équipe qualifiée intervient rapidement dans votre commune et ses environs.

Service professionnel, devis gratuit, intervention rapide.

Appelez-nous dès maintenant pour tous vos besoins électriques à {COMMUNE_NAME}.

Votre sécurité électrique est notre priorité.`,

    duration: 'approximately 30 seconds',
    tone: 'professional and reassuring',
  },
  {
    template: `Votre électricien local à {COMMUNE_NAME}.

Disponible jour et nuit pour toutes vos urgences électriques et installations.

Pannes, remplacements, mises aux normes... Nous intervenons chez vous en moins d'une heure.

Notre équipe d'artisans qualifiés garantit un travail soigné et sécurisé.

Tarifs transparents, devis gratuit sans engagement.

Pour toute intervention électrique à {COMMUNE_NAME}, un seul numéro. Contactez-nous!`,

    duration: 'approximately 29 seconds',
    tone: 'friendly and local',
  },
  {
    template: `Problème électrique à {COMMUNE_NAME}?

Notre équipe locale intervient 7 jours sur 7, même les jours fériés.

Dépannage rapide, installation, rénovation électrique... Tous travaux garantis.

Électriciens certifiés avec plus de 15 ans d'expérience dans le {DEPARTMENT}.

Satisfaction client garantie. Devis clair et détaillé avant intervention.

Ne laissez pas un souci électrique gâcher votre journée. Appelez-nous maintenant!`,

    duration: 'approximately 30 seconds',
    tone: 'reassuring and expert',
  },
];

/**
 * Script templates for medium communes (10,000 - 50,000 inhabitants)
 * Multiple variants for randomization
 *
 * Timeline alignment (after 3.59s intro):
 * [0-6s]    Urgency hook & location confirmation
 * [6-12s]   Problem identification (aligns with visual at 9.34s)
 * [12-18s]  Service listing & credentials (aligns with first CTA at 16.49s)
 * [18-24s]  Benefits & immediate CTA (aligns with final CTA at 21.76s)
 */
export const mediumCommuneScripts = [
  {
    template: `Électricien d'urgence à {COMMUNE_NAME}!

Vous habitez {COMMUNE_NAME} dans le {DEPARTMENT}? Nous intervenons rapidement pour tous vos problèmes électriques.

Panne de courant, court-circuit, tableau électrique défectueux? Notre équipe d'électriciens professionnels et certifiés est disponible 24/7.

Nous proposons: dépannage urgent, mise aux normes, installation de luminaires et tous travaux d'électricité générale.

Intervention rapide. Devis gratuit. Artisans qualifiés.

Contactez-nous maintenant!`,

    duration: 'approximately 30 seconds',
    tone: 'professional and comprehensive',
  },
  {
    template: `Service électrique professionnel à {COMMUNE_NAME}.

Nos électriciens certifiés couvrent tout le {DEPARTMENT}, disponibles 24 heures sur 24.

Urgences, rénovations, mises en conformité... Nous gérons tous vos projets électriques avec expertise.

Plus de 1000 clients satisfaits. Équipe locale de confiance depuis 15 ans.

Prix justes, garantie sur tous travaux, intervention sous une heure en cas d'urgence.

Un problème électrique? Appelez votre expert local!`,

    duration: 'approximately 30 seconds',
    tone: 'trustworthy and established',
  },
  {
    template: `Besoin d'un électricien à {COMMUNE_NAME}?

Intervention express 7j/7 dans tout le {DEPARTMENT}. Électriciens agréés et assurés.

Dépannage, installation, rénovation complète... Notre équipe maîtrise tous les travaux d'électricité résidentielle et commerciale.

Devis détaillé gratuit. Tarifs transparents affichés. Satisfaction garantie.

Pour une prestation de qualité à {COMMUNE_NAME}, faites confiance aux professionnels. Contactez-nous!`,

    duration: 'approximately 29 seconds',
    tone: 'transparent and reliable',
  },
];

/**
 * Script templates for large communes/cities (> 50,000 inhabitants)
 * Multiple variants for randomization
 * Max 30 seconds for all variants (CRO optimized)
 *
 * Timeline alignment (after 3.59s intro):
 * [0-6s]    Emergency positioning & coverage area
 * [6-12s]   Comprehensive service list (aligns with visual at 9.34s)
 * [12-18s]  Trust signals & credentials (aligns with first CTA at 16.49s)
 * [18-24s]  Benefits & urgent CTA (aligns with final CTA at 21.76s)
 */
export const largeCommuneScripts = [
  {
    template: `Urgence électrique à {COMMUNE_NAME}?

Nous couvrons {COMMUNE_NAME} et tout le {DEPARTMENT}, 24h/24 et 7j/7.

Dépannage urgent, tableaux électriques, mises aux normes, installations complètes.

15 ans d'expérience. Électriciens certifiés. Travaux garantis et conformes aux normes.

Devis gratuit, intervention rapide, tarifs clairs.

Appelez maintenant votre électricien de confiance à {COMMUNE_NAME}!`,

    duration: 'approximately 30 seconds',
    tone: 'urgent and professional',
  },
  {
    template: `Électricien professionnel à {COMMUNE_NAME}.

Service d'urgence disponible jour et nuit sur tout le {DEPARTMENT}.

Pannes, installations, rénovations, domotique... Tous travaux d'électricité pour particuliers et professionnels.

Entreprise établie, équipe certifiée, plus de 5000 interventions réussies.

Garantie décennale. Devis transparent avant intervention.

Pour toute urgence électrique à {COMMUNE_NAME}, un seul numéro. Contactez-nous!`,

    duration: 'approximately 30 seconds',
    tone: 'established and comprehensive',
  },
  {
    template: `Dépannage électrique express à {COMMUNE_NAME}.

Intervention rapide 7j/7 dans {COMMUNE_NAME} et environs du {DEPARTMENT}.

Urgences, mises en conformité, installations neuves... Notre équipe maîtrise tous les travaux électriques.

Artisans certifiés avec 15 ans d'expertise. Satisfaction client garantie.

Prix justes, devis gratuit, travaux aux normes.

Ne laissez pas un problème électrique perturber votre quotidien. Appelez-nous!`,

    duration: 'approximately 30 seconds',
    tone: 'responsive and expert',
  },
];

/**
 * Generate personalized script based on commune data with random variant selection
 * @param {Object} commune - Commune data
 * @param {string} commune.name - Commune name
 * @param {string} commune.department - Department number/name
 * @param {number} commune.population - Population count
 * @param {string} commune.region - Region name
 * @returns {Object} - Personalized script with metadata
 */
export function generateScript(commune) {
  const size = determineCommuneSize(commune.population);

  // Get script variants for the size category
  let scriptVariants;
  switch (size) {
    case 'small':
      scriptVariants = smallCommuneScripts;
      break;
    case 'medium':
      scriptVariants = mediumCommuneScripts;
      break;
    case 'large':
      scriptVariants = largeCommuneScripts;
      break;
    default:
      scriptVariants = mediumCommuneScripts;
  }

  // Randomly select one variant
  const randomIndex = Math.floor(Math.random() * scriptVariants.length);
  const selectedVariant = scriptVariants[randomIndex];

  // Replace placeholders with actual commune data
  let script = selectedVariant.template
    .replace(/{COMMUNE_NAME}/g, commune.name)
    .replace(/{DEPARTMENT}/g, commune.department || 'Île-de-France')
    .replace(/{REGION}/g, commune.region || 'Île-de-France')
    .replace(/{YEARS}/g, '15'); // Can be configured

  return {
    script,
    size,
    variantIndex: randomIndex,
    tone: selectedVariant.tone,
    estimatedDuration: 30, // All variants are now max 30 seconds
  };
}

/**
 * Get script template variants for a specific size
 * @param {string} size - 'small', 'medium', or 'large'
 * @returns {Array} - Array of script template objects
 */
export function getScriptTemplates(size) {
  switch (size) {
    case 'small':
      return smallCommuneScripts;
    case 'medium':
      return mediumCommuneScripts;
    case 'large':
      return largeCommuneScripts;
    default:
      return mediumCommuneScripts;
  }
}

export default {
  generateScript,
  determineCommuneSize,
  getScriptTemplates,
  smallCommuneScripts,
  mediumCommuneScripts,
  largeCommuneScripts,
};
