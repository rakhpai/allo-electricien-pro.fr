/**
 * CRO Variant Testing Suite
 *
 * Tests the complete CRO implementation including:
 * - Variant assignment logic
 * - Trust signal generation
 * - A/B testing utilities
 * - Database field population
 * - Copy generation for all variants
 */

import config, { validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import { getTrustSignals, getRecommendedIntroVariant, getUrgencyLevel } from './utils/trust-signals.js';
import { generateCompleteCopyPackage } from './templates/cro-copy.js';
import {
  introVariants,
  ctaVariants,
  descriptionVariants,
  trustBadgeVariants,
  getRecommendedVariantConfig,
  validateVariantConfig
} from './templates/ab-variants.js';
import {
  assignVariantDeterministic,
  assignVariantRandom,
  assignTestVariant,
  calculateConversionRate,
  calculateConfidenceInterval,
  calculateStatisticalSignificance,
  analyzeTestResults
} from './utils/ab-testing.js';
import { generateDualScripts } from './templates/audio-scripts.js';

/**
 * Test commune data samples
 */
const testCommunes = {
  small: {
    name: 'Fontenay-aux-Roses',
    code: '92032',
    department: '92',
    region: 'Île-de-France',
    population: 8500,
    phoneNumber: '06 44 64 71 75'
  },
  medium: {
    name: 'Boulogne-Billancourt',
    code: '92012',
    department: '92',
    region: 'Île-de-France',
    population: 35000,
    phoneNumber: '06 44 64 71 75'
  },
  large: {
    name: 'Paris',
    code: '75056',
    department: '75',
    region: 'Île-de-France',
    population: 2165423,
    phoneNumber: '06 44 64 71 75'
  }
};

/**
 * Test Results Tracker
 */
class TestResults {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  addTest(name, passed, details = {}) {
    this.tests.push({ name, passed, details });
    if (passed) {
      this.passed++;
    } else {
      this.failed++;
    }
  }

  getTotal() {
    return this.tests.length;
  }

  getSummary() {
    return {
      total: this.getTotal(),
      passed: this.passed,
      failed: this.failed,
      passRate: this.getTotal() > 0 ? ((this.passed / this.getTotal()) * 100).toFixed(2) + '%' : '0%'
    };
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('CRO VARIANT TEST SUITE RESULTS');
    console.log('='.repeat(80));

    this.tests.forEach((test, index) => {
      const status = test.passed ? '✓ PASS' : '✗ FAIL';
      const color = test.passed ? '\x1b[32m' : '\x1b[31m'; // Green or Red
      console.log(`\n${color}${index + 1}. ${status}\x1b[0m - ${test.name}`);

      if (test.details && Object.keys(test.details).length > 0) {
        console.log('   Details:', JSON.stringify(test.details, null, 2).split('\n').join('\n   '));
      }
    });

    const summary = this.getSummary();
    console.log('\n' + '='.repeat(80));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`\x1b[32mPassed: ${summary.passed}\x1b[0m`);
    console.log(`\x1b[31mFailed: ${summary.failed}\x1b[0m`);
    console.log(`Pass Rate: ${summary.passRate}`);
    console.log('='.repeat(80) + '\n');
  }
}

const results = new TestResults();

/**
 * Test 1: Trust Signal Generation
 */
function testTrustSignals() {
  console.log('\n[TEST 1] Testing trust signal generation...');

  try {
    // Test all commune sizes
    Object.entries(testCommunes).forEach(([size, commune]) => {
      const signals = getTrustSignals(commune);

      // Verify required fields (urgencyLevel is separate from trust signals)
      const hasAllFields = signals.yearsOfService &&
                          signals.rating &&
                          signals.reviewCount &&
                          signals.certifications &&
                          signals.certifications.length > 0;

      results.addTest(
        `Trust signals for ${size} commune (${commune.name})`,
        hasAllFields,
        {
          population: commune.population,
          reviewCount: signals.reviewCount,
          rating: signals.rating,
          yearsOfService: signals.yearsOfService,
          certifications: signals.certifications
        }
      );

      // Verify review count scales with population
      if (size === 'small' && signals.reviewCount !== 50) {
        results.addTest(
          `Review count for small commune should be 50`,
          false,
          { actual: signals.reviewCount, expected: 50 }
        );
      } else if (size === 'medium' && signals.reviewCount !== 150) {
        results.addTest(
          `Review count for medium commune should be 150`,
          false,
          { actual: signals.reviewCount, expected: 150 }
        );
      } else if (size === 'large' && signals.reviewCount !== 300) {
        results.addTest(
          `Review count for large commune should be 300`,
          false,
          { actual: signals.reviewCount, expected: 300 }
        );
      }
    });

    console.log('✓ Trust signal tests completed');
  } catch (error) {
    results.addTest('Trust signal generation', false, { error: error.message });
    console.error('✗ Trust signal tests failed:', error.message);
  }
}

/**
 * Test 2: Variant Recommendations
 */
function testVariantRecommendations() {
  console.log('\n[TEST 2] Testing variant recommendations...');

  try {
    Object.entries(testCommunes).forEach(([size, commune]) => {
      const recommendedIntro = getRecommendedIntroVariant(commune);
      const recommendedConfig = getRecommendedVariantConfig(commune);

      // Verify variant exists
      const introExists = recommendedIntro in introVariants;
      const configValid = validateVariantConfig(recommendedConfig);

      results.addTest(
        `Variant recommendation for ${size} commune`,
        introExists && configValid,
        {
          recommendedIntro,
          recommendedConfig: {
            intro: recommendedConfig.intro,
            cta: recommendedConfig.cta,
            description: recommendedConfig.description
          }
        }
      );

      // Verify variant matches commune size expectations
      if (size === 'large' && recommendedIntro !== 'urgency') {
        results.addTest(
          `Large commune should recommend urgency variant`,
          false,
          { actual: recommendedIntro, expected: 'urgency' }
        );
      }

      if (size === 'small' && recommendedIntro !== 'local') {
        results.addTest(
          `Small commune should recommend local variant`,
          false,
          { actual: recommendedIntro, expected: 'local' }
        );
      }
    });

    console.log('✓ Variant recommendation tests completed');
  } catch (error) {
    results.addTest('Variant recommendations', false, { error: error.message });
    console.error('✗ Variant recommendation tests failed:', error.message);
  }
}

/**
 * Test 3: Copy Generation
 */
function testCopyGeneration() {
  console.log('\n[TEST 3] Testing CRO copy generation...');

  try {
    Object.entries(testCommunes).forEach(([size, commune]) => {
      const trustSignals = getTrustSignals(commune);

      // Test all description variants
      ['standard', 'urgent', 'local', 'professional'].forEach(variant => {
        try {
          const copyPackage = generateCompleteCopyPackage(commune, {
            phone: commune.phoneNumber,
            descriptionVariant: variant,
            ctaVariant: 'standard',
            trustBadgeVariant: 'all'
          });

          // Verify all required fields exist (Template 2: 7 active fields)
          const requiredFields = [
            'brandName',
            'cityUppercase',
            'cityNormal',
            'serviceCity',
            'searchKeywords',
            'postalCode',
            'phoneNumber'  // NEW in template 2
          ];

          // Legacy fields (kept for compatibility but not required in template 2)
          const legacyFields = ['description', 'resultTitle', 'ctaText', 'serviceHeadline'];

          const hasAllFields = requiredFields.every(field => copyPackage[field]);
          const hasLegacyFields = legacyFields.every(field => copyPackage[field]);
          const containsPhone = copyPackage.phoneNumber === commune.phoneNumber;
          const containsCity = copyPackage.cityNormal === commune.name;

          results.addTest(
            `Copy generation: ${size} commune, ${variant} variant (Template 2)`,
            hasAllFields && hasLegacyFields && containsPhone && containsCity,
            {
              variant,
              hasAllFields,
              hasLegacyFields,
              containsPhone,
              containsCity,
              phoneNumber: copyPackage.phoneNumber,
              sampleDescription: copyPackage.description.substring(0, 50) + '...'
            }
          );
        } catch (error) {
          results.addTest(
            `Copy generation: ${size} commune, ${variant} variant`,
            false,
            { error: error.message }
          );
        }
      });
    });

    console.log('✓ Copy generation tests completed');
  } catch (error) {
    results.addTest('Copy generation', false, { error: error.message });
    console.error('✗ Copy generation tests failed:', error.message);
  }
}

/**
 * Test 4: A/B Testing Logic
 */
function testABTestingLogic() {
  console.log('\n[TEST 4] Testing A/B testing logic...');

  try {
    const testVariants = [
      { id: 'variant_a', intro: 'urgency' },
      { id: 'variant_b', intro: 'local' }
    ];

    // Test deterministic assignment
    const commune = testCommunes.medium;
    const assigned1 = assignVariantDeterministic(commune.code, testVariants);
    const assigned2 = assignVariantDeterministic(commune.code, testVariants);

    results.addTest(
      'Deterministic variant assignment consistency',
      assigned1.id === assigned2.id,
      { variant: assigned1.id }
    );

    // Test test assignment
    const testAssignment = assignTestVariant(commune, 'urgency_test', 'deterministic');

    results.addTest(
      'Test variant assignment structure',
      testAssignment.testName === 'urgency_test' &&
      testAssignment.variantId &&
      testAssignment.metadata,
      {
        testName: testAssignment.testName,
        variantId: testAssignment.variantId
      }
    );

    console.log('✓ A/B testing logic tests completed');
  } catch (error) {
    results.addTest('A/B testing logic', false, { error: error.message });
    console.error('✗ A/B testing logic tests failed:', error.message);
  }
}

/**
 * Test 5: Statistical Calculations
 */
function testStatisticalCalculations() {
  console.log('\n[TEST 5] Testing statistical calculations...');

  try {
    // Test conversion rate
    const conversionRate = calculateConversionRate(10, 100);
    results.addTest(
      'Conversion rate calculation',
      conversionRate === 10,
      { conversions: 10, views: 100, rate: conversionRate }
    );

    // Test confidence interval
    const ci = calculateConfidenceInterval(10, 100, 0.95);
    results.addTest(
      'Confidence interval calculation',
      ci.rate === 10 && ci.lower < ci.rate && ci.upper > ci.rate,
      { rate: ci.rate, lower: ci.lower.toFixed(2), upper: ci.upper.toFixed(2) }
    );

    // Test statistical significance
    const variantA = { conversions: 15, views: 100 }; // 15% conversion
    const variantB = { conversions: 5, views: 100 };  // 5% conversion

    const significance = calculateStatisticalSignificance(variantA, variantB);

    results.addTest(
      'Statistical significance calculation',
      significance.pValue !== undefined && significance.zScore !== undefined,
      {
        pValue: significance.pValue,
        zScore: significance.zScore,
        significant: significance.significant
      }
    );

    console.log('✓ Statistical calculation tests completed');
  } catch (error) {
    results.addTest('Statistical calculations', false, { error: error.message });
    console.error('✗ Statistical calculation tests failed:', error.message);
  }
}

/**
 * Test 6: Dual Audio Scripts
 */
function testDualAudioScripts() {
  console.log('\n[TEST 6] Testing dual audio script generation...');

  try {
    Object.entries(testCommunes).forEach(([size, commune]) => {
      const recommendedIntro = getRecommendedIntroVariant(commune);

      // Generate dual scripts
      const dualScripts = generateDualScripts(commune, { introVariant: recommendedIntro });

      // Verify structure
      const hasIntro = dualScripts.intro && dualScripts.intro.script;
      const hasFull = dualScripts.full && dualScripts.full.script;
      const hasCombined = dualScripts.combined && dualScripts.combined.totalDuration;

      // Verify intro duration
      const introDurationValid = dualScripts.intro.duration >= 3 && dualScripts.intro.duration <= 5;

      // Verify full duration
      const fullDurationValid = dualScripts.full.duration >= 30 && dualScripts.full.duration <= 35;

      results.addTest(
        `Dual audio scripts for ${size} commune`,
        hasIntro && hasFull && hasCombined && introDurationValid && fullDurationValid,
        {
          introDuration: dualScripts.intro.duration,
          fullDuration: dualScripts.full.duration,
          totalDuration: dualScripts.combined.totalDuration,
          introVariant: recommendedIntro,
          introPreview: dualScripts.intro.script.substring(0, 50) + '...',
          fullPreview: dualScripts.full.script.substring(0, 50) + '...'
        }
      );
    });

    console.log('✓ Dual audio script tests completed');
  } catch (error) {
    results.addTest('Dual audio scripts', false, { error: error.message });
    console.error('✗ Dual audio script tests failed:', error.message);
  }
}

/**
 * Test 7: Complete CRO Field Population
 */
function testCROFieldPopulation() {
  console.log('\n[TEST 7] Testing complete CRO field population...');

  try {
    Object.entries(testCommunes).forEach(([size, commune]) => {
      // Generate all CRO data
      const trustSignals = getTrustSignals(commune);
      const urgencyLevel = getUrgencyLevel(commune);
      const recommendedIntroVariant = getRecommendedIntroVariant(commune);
      const ctaVariant = commune.population > 50000 ? 'urgent' : 'standard';
      const descriptionVariant = recommendedIntroVariant === 'urgency' ? 'urgent' : 'standard';

      // Simulate video record data
      const videoData = {
        commune_name: commune.name,
        commune_code: commune.code,
        commune_department: commune.department,
        commune_region: commune.region,
        commune_population: commune.population,

        // CRO Fields
        phone_number: commune.phoneNumber,
        intro_variant: recommendedIntroVariant,
        cta_variant: ctaVariant,
        trust_badge_variant: 'all',
        description_variant: descriptionVariant,
        years_of_service: trustSignals.yearsOfService,
        average_rating: trustSignals.rating,
        review_count: trustSignals.reviewCount,
        certifications: trustSignals.certifications,
        urgency_level: urgencyLevel,
        local_context: commune.population < 10000 ? 'Votre électricien de quartier' : 'Service électrique professionnel'
      };

      // Verify all CRO fields are populated
      const croFields = [
        'phone_number',
        'intro_variant',
        'cta_variant',
        'trust_badge_variant',
        'description_variant',
        'years_of_service',
        'average_rating',
        'review_count',
        'certifications',
        'urgency_level',
        'local_context'
      ];

      const allFieldsPopulated = croFields.every(field => videoData[field] !== undefined && videoData[field] !== null);

      results.addTest(
        `CRO field population for ${size} commune`,
        allFieldsPopulated,
        {
          missingFields: croFields.filter(field => !videoData[field]),
          sampleFields: {
            phone_number: videoData.phone_number,
            intro_variant: videoData.intro_variant,
            cta_variant: videoData.cta_variant,
            review_count: videoData.review_count,
            urgency_level: videoData.urgency_level
          }
        }
      );
    });

    console.log('✓ CRO field population tests completed');
  } catch (error) {
    results.addTest('CRO field population', false, { error: error.message });
    console.error('✗ CRO field population tests failed:', error.message);
  }
}

/**
 * Main test execution
 */
async function runTests() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('STARTING CRO VARIANT TEST SUITE');
    console.log('='.repeat(80));

    // Run all tests
    testTrustSignals();
    testVariantRecommendations();
    testCopyGeneration();
    testABTestingLogic();
    testStatisticalCalculations();
    testDualAudioScripts();
    testCROFieldPopulation();

    // Print summary
    results.printSummary();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export default runTests;
