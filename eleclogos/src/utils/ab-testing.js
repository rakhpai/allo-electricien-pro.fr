/**
 * A/B Testing Utility
 *
 * Handles variant assignment, tracking, and performance analysis
 * for video CRO optimization.
 */

import crypto from 'crypto';
import {
  testConfigurations,
  getRecommendedVariantConfig,
  validateVariantConfig
} from '../templates/ab-variants.js';

/**
 * Assign variant to a commune deterministically
 * Uses commune code as seed for consistent assignment
 *
 * @param {string} communeCode - Unique commune identifier
 * @param {Array} variants - Array of variant configurations
 * @returns {Object} - Assigned variant
 */
export function assignVariantDeterministic(communeCode, variants) {
  if (!variants || variants.length === 0) {
    throw new Error('No variants provided for assignment');
  }

  // Hash commune code to get deterministic index
  const hash = crypto.createHash('md5').update(communeCode).digest('hex');
  const hashNumber = parseInt(hash.substring(0, 8), 16);
  const index = hashNumber % variants.length;

  return variants[index];
}

/**
 * Assign variant randomly
 * Use for true randomization across communes
 *
 * @param {Array} variants - Array of variant configurations
 * @returns {Object} - Assigned variant
 */
export function assignVariantRandom(variants) {
  if (!variants || variants.length === 0) {
    throw new Error('No variants provided for assignment');
  }

  const index = Math.floor(Math.random() * variants.length);
  return variants[index];
}

/**
 * Assign variant with weighted distribution
 * Use for gradual rollout or champion/challenger testing
 *
 * @param {Array} variantsWithWeights - Array of {variant, weight} objects
 * @returns {Object} - Assigned variant
 *
 * @example
 * assignVariantWeighted([
 *   { variant: controlVariant, weight: 0.7 },  // 70% traffic
 *   { variant: testVariant, weight: 0.3 }      // 30% traffic
 * ])
 */
export function assignVariantWeighted(variantsWithWeights) {
  if (!variantsWithWeights || variantsWithWeights.length === 0) {
    throw new Error('No variants provided for assignment');
  }

  // Validate weights sum to 1.0
  const totalWeight = variantsWithWeights.reduce((sum, v) => sum + v.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new Error(`Weights must sum to 1.0 (current sum: ${totalWeight})`);
  }

  const random = Math.random();
  let cumulativeWeight = 0;

  for (const { variant, weight } of variantsWithWeights) {
    cumulativeWeight += weight;
    if (random <= cumulativeWeight) {
      return variant;
    }
  }

  // Fallback (should never reach here with correct weights)
  return variantsWithWeights[0].variant;
}

/**
 * Get variant assignment for a specific test configuration
 *
 * @param {Object} commune - Commune data
 * @param {string} testName - Test configuration name (from testConfigurations)
 * @param {string} method - Assignment method: 'deterministic', 'random', 'recommended'
 * @returns {Object} - Test assignment with variant and metadata
 */
export function assignTestVariant(commune, testName, method = 'deterministic') {
  const testConfig = testConfigurations[testName];

  if (!testConfig) {
    throw new Error(`Test configuration '${testName}' not found`);
  }

  let assignedVariant;

  switch (method) {
    case 'deterministic':
      assignedVariant = assignVariantDeterministic(commune.code, testConfig.variants);
      break;

    case 'random':
      assignedVariant = assignVariantRandom(testConfig.variants);
      break;

    case 'recommended':
      // Use recommended config based on commune characteristics
      assignedVariant = getRecommendedVariantConfig(commune);
      break;

    default:
      throw new Error(`Unknown assignment method: ${method}`);
  }

  return {
    testName,
    variantId: assignedVariant.id,
    variant: assignedVariant,
    method,
    assignedAt: new Date().toISOString(),
    metadata: {
      communeCode: commune.code,
      communeName: commune.name,
      population: commune.population,
      testConfig: testConfig.name,
      hypothesis: testConfig.hypothesis
    }
  };
}

/**
 * Calculate conversion rate
 *
 * @param {number} conversions - Number of conversions
 * @param {number} views - Number of views
 * @returns {number} - Conversion rate (0-100)
 */
export function calculateConversionRate(conversions, views) {
  if (views === 0) return 0;
  return (conversions / views) * 100;
}

/**
 * Calculate confidence interval for conversion rate
 * Uses Wilson score interval for better accuracy with small samples
 *
 * @param {number} conversions - Number of conversions
 * @param {number} views - Number of views
 * @param {number} confidenceLevel - Confidence level (default 0.95 for 95%)
 * @returns {Object} - {lower, upper, rate}
 */
export function calculateConfidenceInterval(conversions, views, confidenceLevel = 0.95) {
  if (views === 0) {
    return { lower: 0, upper: 0, rate: 0 };
  }

  const rate = conversions / views;

  // Z-score for confidence level (1.96 for 95%, 2.58 for 99%)
  const zScore = confidenceLevel === 0.99 ? 2.58 : 1.96;

  // Wilson score interval
  const denominator = 1 + (zScore ** 2) / views;
  const center = rate + (zScore ** 2) / (2 * views);
  const margin = zScore * Math.sqrt((rate * (1 - rate) / views) + (zScore ** 2) / (4 * views ** 2));

  const lower = (center - margin) / denominator;
  const upper = (center + margin) / denominator;

  return {
    lower: Math.max(0, lower * 100),
    upper: Math.min(100, upper * 100),
    rate: rate * 100
  };
}

/**
 * Calculate statistical significance between two variants
 * Uses two-proportion z-test
 *
 * @param {Object} variantA - {conversions, views}
 * @param {Object} variantB - {conversions, views}
 * @returns {Object} - {significant, pValue, zScore, confidenceLevel}
 */
export function calculateStatisticalSignificance(variantA, variantB) {
  const p1 = variantA.conversions / variantA.views;
  const p2 = variantB.conversions / variantB.views;

  // Pooled proportion
  const pooledP = (variantA.conversions + variantB.conversions) / (variantA.views + variantB.views);

  // Standard error
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / variantA.views + 1 / variantB.views));

  // Z-score
  const zScore = (p1 - p2) / se;

  // P-value (two-tailed test)
  // Approximation using standard normal distribution
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  // Determine significance at different confidence levels
  const significant95 = pValue < 0.05; // 95% confidence
  const significant99 = pValue < 0.01; // 99% confidence

  let confidenceLevel = 0;
  if (significant99) confidenceLevel = 99;
  else if (significant95) confidenceLevel = 95;

  return {
    significant: significant95,
    pValue: pValue.toFixed(4),
    zScore: zScore.toFixed(4),
    confidenceLevel,
    interpretation: getSignificanceInterpretation(pValue, p1, p2)
  };
}

/**
 * Normal cumulative distribution function approximation
 * @private
 */
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Get human-readable interpretation of significance test
 * @private
 */
function getSignificanceInterpretation(pValue, rate1, rate2) {
  if (pValue >= 0.05) {
    return 'No significant difference detected. Continue testing or increase sample size.';
  }

  const winner = rate1 > rate2 ? 'Variant A' : 'Variant B';
  const lift = Math.abs(((rate1 - rate2) / rate2) * 100).toFixed(1);

  if (pValue < 0.01) {
    return `${winner} is statistically better with ${lift}% lift (99% confidence).`;
  }

  return `${winner} is statistically better with ${lift}% lift (95% confidence).`;
}

/**
 * Calculate minimum sample size needed for test
 *
 * @param {number} baselineRate - Expected baseline conversion rate (0-1)
 * @param {number} minimumDetectableEffect - Minimum effect to detect (e.g., 0.1 for 10% lift)
 * @param {number} power - Statistical power (default 0.8)
 * @param {number} alpha - Significance level (default 0.05)
 * @returns {number} - Minimum sample size per variant
 */
export function calculateSampleSize(baselineRate, minimumDetectableEffect, power = 0.8, alpha = 0.05) {
  // Z-scores
  const zAlpha = 1.96; // for alpha = 0.05 (two-tailed)
  const zBeta = 0.84;  // for power = 0.8

  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minimumDetectableEffect);

  const numerator = Math.pow(zAlpha * Math.sqrt(2 * baselineRate * (1 - baselineRate)) +
                             zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);

  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}

/**
 * Determine if test has reached statistical significance
 *
 * @param {Object} testResults - Performance data for all variants
 * @returns {Object} - {ready, winner, analysis}
 */
export function analyzeTestResults(testResults) {
  const variants = Object.values(testResults);

  if (variants.length < 2) {
    return {
      ready: false,
      reason: 'Need at least 2 variants to compare'
    };
  }

  // Sort by conversion rate
  const sorted = variants.sort((a, b) => b.conversionRate - a.conversionRate);

  const leader = sorted[0];
  const challenger = sorted[1];

  // Check if we have enough data
  const minSampleSize = 100; // Minimum views per variant
  if (leader.views < minSampleSize || challenger.views < minSampleSize) {
    return {
      ready: false,
      reason: `Need at least ${minSampleSize} views per variant (Leader: ${leader.views}, Challenger: ${challenger.views})`
    };
  }

  // Calculate significance
  const significance = calculateStatisticalSignificance(
    { conversions: leader.conversions, views: leader.views },
    { conversions: challenger.conversions, views: challenger.views }
  );

  return {
    ready: significance.significant,
    winner: significance.significant ? leader.variantId : null,
    significance,
    leaderData: {
      variantId: leader.variantId,
      conversionRate: leader.conversionRate,
      views: leader.views,
      conversions: leader.conversions,
      confidenceInterval: calculateConfidenceInterval(leader.conversions, leader.views)
    },
    challengerData: {
      variantId: challenger.variantId,
      conversionRate: challenger.conversionRate,
      views: challenger.views,
      conversions: challenger.conversions,
      confidenceInterval: calculateConfidenceInterval(challenger.conversions, challenger.views)
    },
    recommendation: significance.significant
      ? `Deploy ${leader.variantId} as winner`
      : 'Continue testing - no significant difference yet'
  };
}

/**
 * Create test assignment record for database
 *
 * @param {string} videoId - Video UUID
 * @param {Object} assignment - Test assignment from assignTestVariant()
 * @returns {Object} - Database record format
 */
export function createTestAssignmentRecord(videoId, assignment) {
  return {
    video_id: videoId,
    test_name: assignment.testName,
    variant_group: assignment.variantId,
    metadata: {
      method: assignment.method,
      variant_config: assignment.variant,
      commune_code: assignment.metadata.communeCode,
      commune_name: assignment.metadata.communeName,
      population: assignment.metadata.population,
      assigned_at: assignment.assignedAt
    }
  };
}

/**
 * Format performance metrics for database
 *
 * @param {string} videoId - Video UUID
 * @param {Object} metrics - Performance metrics
 * @returns {Object} - Database record format
 */
export function createPerformanceRecord(videoId, metrics) {
  return {
    video_id: videoId,
    views: metrics.views || 0,
    unique_viewers: metrics.uniqueViewers || 0,
    completion_rate: metrics.completionRate || null,
    avg_watch_time: metrics.avgWatchTime || null,
    clicks: metrics.clicks || 0,
    click_through_rate: metrics.clicks && metrics.views
      ? calculateConversionRate(metrics.clicks, metrics.views)
      : null,
    phone_calls: metrics.phoneCalls || 0,
    conversion_rate: metrics.phoneCalls && metrics.views
      ? calculateConversionRate(metrics.phoneCalls, metrics.views)
      : null,
    source: metrics.source || null,
    medium: metrics.medium || null,
    campaign: metrics.campaign || null,
    date: metrics.date || new Date().toISOString().split('T')[0]
  };
}

export default {
  assignVariantDeterministic,
  assignVariantRandom,
  assignVariantWeighted,
  assignTestVariant,
  calculateConversionRate,
  calculateConfidenceInterval,
  calculateStatisticalSignificance,
  calculateSampleSize,
  analyzeTestResults,
  createTestAssignmentRecord,
  createPerformanceRecord
};
