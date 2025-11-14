import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Fetch Communes from Supabase geo_cities_idf Table
 * Retrieves top 500 IDF communes by population
 */

/**
 * Fetch top 500 communes from geo_cities_idf table
 * @param {number} limit - Number of communes to fetch (default: 500)
 * @param {Array<string>} excludeCodes - Commune codes to exclude (already exist)
 * @returns {Promise<Array>} - Array of commune objects
 */
export async function fetchCommunesFromSupabase(limit = 500, excludeCodes = []) {
  try {
    logger.info('Fetching communes from Supabase', {
      limit,
      excludeCodes: excludeCodes.length,
    });

    const supabase = createClient(config.supabase.url, config.supabase.anonKey);

    // IDF department codes
    const idfDepartments = [75, 77, 78, 91, 92, 93, 94, 95];

    // Query geo_cities_idf table - filter by IDF departments
    let query = supabase
      .from('geo_cities_idf')
      .select('*')
      .in('county_id', idfDepartments)
      .order('population', { ascending: false })
      .limit(limit + excludeCodes.length + 100); // Fetch extra to account for exclusions and filtering

    const { data, error} = await query;

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No communes found in geo_cities_idf table');
    }

    logger.info('Communes fetched from Supabase', {
      total: data.length,
    });

    // Transform to required format and filter exclusions
    // Use zipcode as code (5 digits like 92100)
    const communes = data
      .filter(row => {
        const code = row.zipcode;
        return code && !excludeCodes.includes(code);
      })
      .slice(0, limit)
      .map(row => ({
        name: row.city,
        code: row.zipcode,
        department: String(row.county_id).padStart(2, '0'),
        region: 'Île-de-France',
        population: parseInt(row.population) || 0,
        phoneNumber: '06 44 64 71 75', // Default phone number
      }));

    logger.info('Communes transformed', {
      count: communes.length,
      sample: communes.slice(0, 3).map(c => c.name),
    });

    return communes;

  } catch (error) {
    logger.error('Failed to fetch communes from Supabase', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Generate Paris arrondissements (20 videos)
 * @returns {Array} - Array of Paris arrondissement objects
 */
export function generateParisArrondissements() {
  const parisPopulation = 2165423; // Total Paris population
  const avgPopulation = Math.floor(parisPopulation / 20); // ~108k per arrondissement

  const arrondissements = [];

  for (let i = 1; i <= 20; i++) {
    const code = `751${String(i).padStart(2, '0')}`; // 75101 - 75120

    arrondissements.push({
      name: `Paris ${i}${i === 1 ? 'er' : 'e'}`,
      code: code,
      department: '75',
      region: 'Île-de-France',
      population: avgPopulation + Math.floor(Math.random() * 20000 - 10000), // Add some variation
      phoneNumber: '06 44 64 71 75',
    });
  }

  logger.info('Paris arrondissements generated', {
    count: arrondissements.length,
  });

  return arrondissements;
}

/**
 * Fetch all communes (500 IDF + 20 Paris arrondissements - excluded)
 * @param {Object} options - Options
 * @param {Array<string>} options.exclude - Commune codes to exclude
 * @param {boolean} options.includeParisArrondissements - Include Paris 1er-20e
 * @returns {Promise<Array>} - Complete commune list
 */
export async function fetchAllCommunes(options = {}) {
  const {
    exclude = ['92100', '92130'], // Boulogne (92100) and Issy (92130) by default - using zipcodes
    includeParisArrondissements = true,
  } = options;

  try {
    logger.info('Fetching all communes', {
      excludeCount: exclude.length,
      includeParisArrondissements,
    });

    // Fetch top 500 IDF communes
    const idfCommunes = await fetchCommunesFromSupabase(500, exclude);

    let allCommunes = [...idfCommunes];

    // Add Paris arrondissements
    if (includeParisArrondissements) {
      const parisArrondissements = generateParisArrondissements();
      allCommunes = [...allCommunes, ...parisArrondissements];
    }

    logger.info('All communes fetched', {
      total: allCommunes.length,
      idf: idfCommunes.length,
      paris: includeParisArrondissements ? 20 : 0,
      excluded: exclude.length,
    });

    return allCommunes;

  } catch (error) {
    logger.error('Failed to fetch all communes', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Save communes to JSON file
 * @param {Array} communes - Array of communes
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - File path
 */
export async function saveCommunesToJSON(communes, filename = 'communes-idf-500.json') {
  try {
    const dataDir = path.resolve('data');
    const filePath = path.join(dataDir, filename);

    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });

    // Write JSON file
    await fs.writeFile(
      filePath,
      JSON.stringify(communes, null, 2),
      'utf8'
    );

    logger.info('Communes saved to JSON', {
      filePath,
      count: communes.length,
    });

    return filePath;

  } catch (error) {
    logger.error('Failed to save communes to JSON', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Load communes from JSON file
 * @param {string} filename - Input filename
 * @returns {Promise<Array>} - Array of communes
 */
export async function loadCommunesFromJSON(filename = 'communes-idf-500.json') {
  try {
    const dataDir = path.resolve('data');
    const filePath = path.join(dataDir, filename);

    const content = await fs.readFile(filePath, 'utf8');
    const communes = JSON.parse(content);

    logger.info('Communes loaded from JSON', {
      filePath,
      count: communes.length,
    });

    return communes;

  } catch (error) {
    logger.warn('Failed to load communes from JSON', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get communes (fetch from Supabase or load from file)
 * @param {boolean} forceRefresh - Force refresh from Supabase
 * @returns {Promise<Array>} - Array of communes
 */
export async function getCommunes(forceRefresh = false) {
  try {
    // Try to load from file first (unless force refresh)
    if (!forceRefresh) {
      const cachedCommunes = await loadCommunesFromJSON();
      if (cachedCommunes && cachedCommunes.length > 0) {
        logger.info('Using cached communes from JSON file');
        return cachedCommunes;
      }
    }

    // Fetch fresh data from Supabase
    logger.info('Fetching fresh commune data from Supabase');
    const communes = await fetchAllCommunes();

    // Save to file for caching
    await saveCommunesToJSON(communes);

    return communes;

  } catch (error) {
    logger.error('Failed to get communes', {
      error: error.message,
    });
    throw error;
  }
}

export default {
  fetchCommunesFromSupabase,
  generateParisArrondissements,
  fetchAllCommunes,
  saveCommunesToJSON,
  loadCommunesFromJSON,
  getCommunes,
};
