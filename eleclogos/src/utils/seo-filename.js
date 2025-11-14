import sanitize from 'sanitize-filename';

/**
 * SEO Filename Generator
 * Generates SEO-optimized filenames for electrician service videos
 * Format: electricien-{commune-slug}-{department}.{extension}
 */

/**
 * Generate a URL-friendly slug from commune name
 * @param {string} name - Commune name (e.g., "Boulogne-Billancourt", "Saint-Germain-en-Laye")
 * @returns {string} - URL slug (e.g., "boulogne-billancourt", "saint-germain-en-laye")
 */
export function generateSlug(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid name provided for slug generation');
  }

  return name
    .toLowerCase()
    // Remove accents and special characters
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove apostrophes
    .replace(/[']/g, '')
    // Keep only alphanumeric characters and hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate SEO-optimized filename for electrician video
 * Format: electricien-{commune-slug}-{department}.{extension}
 *
 * @param {Object} commune - Commune data
 * @param {string} commune.name - Commune name
 * @param {string} commune.department - Department number (e.g., '75', '92')
 * @param {string} extension - File extension (default: 'mp4')
 * @returns {string} - SEO filename
 *
 * @example
 * generateSEOFilename({ name: 'Boulogne-Billancourt', department: '92' })
 * // Returns: 'electricien-boulogne-billancourt-92.mp4'
 *
 * generateSEOFilename({ name: 'Saint-Germain-en-Laye', department: '78' }, 'webm')
 * // Returns: 'electricien-saint-germain-en-laye-78.webm'
 */
export function generateSEOFilename(commune, extension = 'mp4') {
  if (!commune || !commune.name || !commune.department) {
    throw new Error('Invalid commune data: name and department are required');
  }

  const slug = generateSlug(commune.name);
  const dept = String(commune.department).padStart(2, '0'); // Ensure 2 digits

  // Construct filename
  const filename = `electricien-${slug}-${dept}.${extension}`;

  // Sanitize for filesystem safety
  return sanitize(filename);
}

/**
 * Generate compressed version filename
 * @param {string} seoFilename - Original SEO filename
 * @returns {string} - Compressed filename
 *
 * @example
 * generateCompressedFilename('electricien-paris-75.mp4')
 * // Returns: 'electricien-paris-75-compressed.mp4'
 */
export function generateCompressedFilename(seoFilename) {
  if (!seoFilename) {
    throw new Error('SEO filename is required');
  }

  const parts = seoFilename.split('.');
  const extension = parts.pop();
  const basename = parts.join('.');

  return `${basename}-compressed.${extension}`;
}

/**
 * Generate format-specific filename
 * @param {string} seoFilename - Original SEO filename
 * @param {string} format - Target format (mp4, webm, etc.)
 * @returns {string} - Format-specific filename
 *
 * @example
 * generateFormatFilename('electricien-paris-75.mp4', 'webm')
 * // Returns: 'electricien-paris-75.webm'
 */
export function generateFormatFilename(seoFilename, format) {
  if (!seoFilename || !format) {
    throw new Error('SEO filename and format are required');
  }

  const parts = seoFilename.split('.');
  parts.pop(); // Remove extension
  const basename = parts.join('.');

  return `${basename}.${format}`;
}

/**
 * Get department directory name
 * @param {string} department - Department number
 * @returns {string} - Directory name (e.g., '75-Paris', '92-Hauts-de-Seine')
 */
export function getDepartmentDirectory(department) {
  const deptMap = {
    '75': '75-Paris',
    '77': '77-Seine-et-Marne',
    '78': '78-Yvelines',
    '91': '91-Essonne',
    '92': '92-Hauts-de-Seine',
    '93': '93-Seine-Saint-Denis',
    '94': '94-Val-de-Marne',
    '95': "95-Val-d'Oise",
  };

  const dept = String(department).padStart(2, '0');
  return deptMap[dept] || `${dept}-Unknown`;
}

/**
 * Generate complete file paths for all video formats
 * @param {Object} commune - Commune data
 * @param {string} baseDir - Base directory for video storage
 * @returns {Object} - Object with paths for all formats
 *
 * @example
 * generateFilePaths({ name: 'Paris', department: '75' }, 'videos-downloaded')
 * // Returns: {
 * //   directory: 'videos-downloaded/75-Paris',
 * //   original: 'videos-downloaded/75-Paris/electricien-paris-75.mp4',
 * //   compressed: 'videos-downloaded/75-Paris/electricien-paris-75-compressed.mp4',
 * //   webm: 'videos-downloaded/75-Paris/electricien-paris-75.webm',
 * //   seoFilename: 'electricien-paris-75.mp4'
 * // }
 */
export function generateFilePaths(commune, baseDir = 'videos-downloaded') {
  const seoFilename = generateSEOFilename(commune);
  const deptDir = getDepartmentDirectory(commune.department);
  const directory = `${baseDir}/${deptDir}`;

  return {
    directory,
    seoFilename,
    original: `${directory}/${seoFilename}`,
    compressed: `${directory}/${generateCompressedFilename(seoFilename)}`,
    webm: `${directory}/${generateFormatFilename(seoFilename, 'webm')}`,
  };
}

/**
 * Validate SEO filename format
 * @param {string} filename - Filename to validate
 * @returns {boolean} - True if valid
 */
export function isValidSEOFilename(filename) {
  // Pattern: electricien-{slug}-{dept}.{ext}
  const pattern = /^electricien-[a-z0-9-]+-\d{2}\.(mp4|webm)$/;
  return pattern.test(filename);
}

export default {
  generateSlug,
  generateSEOFilename,
  generateCompressedFilename,
  generateFormatFilename,
  getDepartmentDirectory,
  generateFilePaths,
  isValidSEOFilename,
};
