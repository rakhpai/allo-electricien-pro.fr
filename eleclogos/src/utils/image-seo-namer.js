/**
 * SEO Image Naming Utility
 * Generates SEO-optimized filenames for image variants
 * Based on page data (city, zipCode, department)
 */

/**
 * Generate SEO-friendly slug from French text
 * Removes accents, converts to lowercase, replaces spaces with hyphens
 * @param {string} text - Input text (e.g., "PARIS 18E ARRONDISSEMENT")
 * @returns {string} - SEO slug (e.g., "paris-18e-arrondissement")
 */
export function generateSlug(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate SEO-optimized image filename for a page
 * @param {object} pageData - Page frontmatter data
 * @param {string} pageData.city - City name (e.g., "PARIS 18E ARRONDISSEMENT")
 * @param {string} pageData.zipCode - Zip code (e.g., "75018")
 * @param {string} pageData.department - Department code (e.g., "75")
 * @param {string} pageData.slug - Page slug (fallback)
 * @param {string} variantType - Variant type (hero, og, featured, video)
 * @param {string} format - File format (jpg, webp, avif)
 * @returns {string} - SEO filename (e.g., "electricien-urgence-paris-18e-75018-hero.jpg")
 */
export function generateSEOImageName(pageData, variantType, format) {
  // Validate inputs
  if (!pageData || !variantType || !format) {
    throw new Error('Missing required parameters for SEO image name generation');
  }

  // Generate city slug - prefer existing slug over generating from city name
  // This prevents issues with apostrophes in city names (e.g., L'Étang, Ville-d'Avray)
  const citySlug = pageData.slug || generateSlug(pageData.city);

  if (!citySlug) {
    throw new Error(`Cannot generate slug for page: ${JSON.stringify(pageData)}`);
  }

  // Service keyword (could be varied by variant type if needed)
  const service = 'urgence'; // or 'depannage', 'intervention', etc.

  // Build SEO filename
  // Format: electricien-{service}-{city-slug}-{zipcode}-{variant}.{format}
  const parts = [
    'electricien',
    service,
    citySlug,
    pageData.zipCode || '',
    variantType
  ].filter(Boolean); // Remove empty parts

  const filename = parts.join('-') + '.' + format;

  // Validate length (SEO best practice: < 60 chars for base name)
  const baseName = parts.join('-');
  if (baseName.length > 100) {
    console.warn(`Warning: Filename is long (${baseName.length} chars): ${filename}`);
  }

  return filename;
}

/**
 * Generate base SEO name (without variant/format suffix)
 * Useful for referencing in Hugo frontmatter
 * @param {object} pageData - Page data
 * @returns {string} - Base SEO name (e.g., "electricien-urgence-paris-18e-75018")
 */
export function generateSEOBaseName(pageData) {
  const citySlug = pageData.slug || generateSlug(pageData.city);
  const service = 'urgence';

  const parts = [
    'electricien',
    service,
    citySlug,
    pageData.zipCode || ''
  ].filter(Boolean);

  return parts.join('-');
}

/**
 * Generate all variants for a page
 * Returns object with all variant filenames
 * @param {object} pageData - Page data
 * @returns {object} - Object with variant names
 * @example
 * {
 *   hero: { jpg: "...", webp: "...", avif: "..." },
 *   og: { jpg: "...", webp: "...", avif: "..." },
 *   ...
 * }
 */
export function generateAllVariants(pageData) {
  const types = ['hero', 'og', 'featured', 'video'];
  const formats = ['jpg', 'webp', 'avif'];

  const variants = {};

  types.forEach(type => {
    variants[type] = {};
    formats.forEach(format => {
      variants[type][format] = generateSEOImageName(pageData, type, format);
    });
  });

  return variants;
}

/**
 * Generate Supabase storage path for SEO image
 * @param {string} siteDomain - Site domain (e.g., "allo-electricien.pro")
 * @param {string} variantType - Variant type (hero, og, featured, video)
 * @param {string} seoFilename - SEO filename
 * @returns {string} - Full storage path
 */
export function generateStoragePath(siteDomain, variantType, seoFilename) {
  return `${siteDomain}/${variantType}/${seoFilename}`;
}

/**
 * Parse SEO filename back to components
 * @param {string} filename - SEO filename
 * @returns {object} - Parsed components
 */
export function parseSEOFilename(filename) {
  // Example: electricien-urgence-paris-18e-75018-hero.jpg
  const match = filename.match(/^electricien-(\w+)-(.+)-(\d{5})-(\w+)\.(\w+)$/);

  if (!match) {
    return null;
  }

  return {
    service: match[1],
    citySlug: match[2],
    zipCode: match[3],
    variantType: match[4],
    format: match[5]
  };
}

/**
 * Validate SEO filename
 * @param {string} filename - Filename to validate
 * @returns {boolean} - True if valid
 */
export function isValidSEOFilename(filename) {
  return parseSEOFilename(filename) !== null;
}

export default {
  generateSlug,
  generateSEOImageName,
  generateSEOBaseName,
  generateAllVariants,
  generateStoragePath,
  parseSEOFilename,
  isValidSEOFilename
};
