#!/usr/bin/env node

/**
 * Deploy allo-electricien.pro Router Worker to Cloudflare
 *
 * This script automates the deployment process:
 * 1. Validates configuration
 * 2. Installs dependencies if needed
 * 3. Deploys Router Worker to Cloudflare
 * 4. Verifies deployment
 *
 * The router handles ALL traffic for allo-electricien.pro and routes:
 * - /api/* → allo-electricien-api Worker
 * - /* → allo-electricien-main Pages (Hugo site)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const WORKER_DIR = path.join(__dirname, '../../workers/allo-electricien-router');
const WORKER_NAME = 'allo-electricien-router';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: WORKER_DIR,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

// Main deployment function
async function deploy() {
  log('\n' + '='.repeat(70), 'bright');
  log('  allo-electricien.pro Router Worker Deployment Script', 'bright');
  log('='.repeat(70) + '\n', 'bright');

  try {
    // Step 1: Check if worker directory exists
    logStep('1/7', 'Checking worker directory...');
    if (!fs.existsSync(WORKER_DIR)) {
      logError(`Worker directory not found: ${WORKER_DIR}`);
      process.exit(1);
    }
    logSuccess('Worker directory found');

    // Step 2: Check if required files exist
    logStep('2/7', 'Validating configuration files...');
    const requiredFiles = ['package.json', 'wrangler.toml', 'index.js'];
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(WORKER_DIR, file)));

    if (missingFiles.length > 0) {
      logError(`Missing required files: ${missingFiles.join(', ')}`);
      process.exit(1);
    }
    logSuccess('All configuration files present');

    // Step 3: Validate wrangler.toml configuration
    logStep('3/7', 'Validating wrangler configuration...');
    const wranglerConfig = fs.readFileSync(path.join(WORKER_DIR, 'wrangler.toml'), 'utf8');

    if (!wranglerConfig.includes('account_id')) {
      logError('Missing account_id in wrangler.toml');
      process.exit(1);
    }

    if (!wranglerConfig.includes('zone_id')) {
      logError('Missing zone_id in routes configuration');
      process.exit(1);
    }

    if (!wranglerConfig.includes('pattern = "allo-electricien.pro')) {
      logWarning('Routes configuration may be incomplete');
    }

    logSuccess('Wrangler configuration is valid');

    // Step 4: Check for node_modules
    logStep('4/7', 'Checking dependencies...');
    const nodeModulesExists = fs.existsSync(path.join(WORKER_DIR, 'node_modules'));

    if (!nodeModulesExists) {
      log('Installing dependencies...', 'yellow');
      exec('npm install');
      logSuccess('Dependencies installed');
    } else {
      logSuccess('Dependencies already installed');
    }

    // Step 5: Check Wrangler CLI
    logStep('5/7', 'Checking Wrangler CLI...');
    try {
      const wranglerVersion = exec('npx wrangler --version', { silent: true });
      logSuccess(`Wrangler CLI found: ${wranglerVersion.trim()}`);
    } catch (error) {
      logError('Wrangler CLI not found');
      log('Installing Wrangler...', 'yellow');
      exec('npm install -g wrangler');
      logSuccess('Wrangler installed');
    }

    // Step 6: Validate index.js
    logStep('6/7', 'Validating router logic...');
    const indexJs = fs.readFileSync(path.join(WORKER_DIR, 'index.js'), 'utf8');

    if (!indexJs.includes('export default')) {
      logError('index.js missing default export');
      process.exit(1);
    }

    if (!indexJs.includes('async fetch')) {
      logError('index.js missing fetch handler');
      process.exit(1);
    }

    const apiWorkerUrl = indexJs.match(/API_WORKER_URL\s*=\s*['"]([^'"]+)['"]/);
    const pagesUrl = indexJs.match(/PAGES_URL\s*=\s*['"]([^'"]+)['"]/);

    if (apiWorkerUrl) {
      log(`API Worker URL: ${apiWorkerUrl[1]}`, 'yellow');
    }

    if (pagesUrl) {
      log(`Pages URL: ${pagesUrl[1]}`, 'yellow');
    }

    logSuccess('Router logic is valid');

    // Step 7: Deploy to Cloudflare
    logStep('7/7', 'Deploying to Cloudflare...');
    log('This may take a minute...', 'yellow');
    log('', 'reset');
    log('The router will handle ALL traffic for allo-electricien.pro:', 'yellow');
    log('  • /api/* → allo-electricien-api Worker', 'cyan');
    log('  • /* → allo-electricien-main Pages (Hugo site)', 'cyan');
    log('', 'reset');

    try {
      exec('npx wrangler deploy');
      logSuccess('Router Worker deployed successfully!');
    } catch (error) {
      logError('Deployment failed');
      console.error(error);
      process.exit(1);
    }

    // Display deployment summary
    log('\n' + '='.repeat(70), 'green');
    log('  DEPLOYMENT COMPLETE! 🚀', 'green');
    log('='.repeat(70), 'green');

    log('\n📊 Deployment Info:', 'bright');
    log(`   Worker Name:   ${WORKER_NAME}`, 'cyan');
    log(`   Domain:        allo-electricien.pro/* (ALL paths)`, 'cyan');
    log(`   Status:        Deployed ✅`, 'green');

    log('\n🔀 Routing Configuration:', 'bright');
    log('   allo-electricien.pro/api/*   → allo-electricien-api Worker (REST API)', 'cyan');
    log('   allo-electricien.pro/*       → allo-electricien-main Pages (Hugo static site)', 'cyan');

    log('\n🧪 Test your deployment:', 'bright');
    log('   Homepage:      https://allo-electricien.pro/', 'cyan');
    log('   City page:     https://allo-electricien.pro/paris/', 'cyan');
    log('   API health:    https://allo-electricien.pro/api/health', 'cyan');
    log('   API stats:     https://allo-electricien.pro/api/stats', 'cyan');

    log('\n📝 Useful commands:', 'bright');
    log('   View logs:     cd workers/allo-electricien-router && npx wrangler tail', 'cyan');
    log('   List deploys:  cd workers/allo-electricien-router && npx wrangler deployments list', 'cyan');
    log('   Rollback:      cd workers/allo-electricien-router && npx wrangler rollback [deployment-id]', 'cyan');

    log('\n⚠️  Important Notes:', 'yellow');
    log('   1. This router now handles ALL allo-electricien.pro traffic', 'yellow');
    log('   2. Make sure allo-electricien-main Pages is deployed first', 'yellow');
    log('   3. Make sure allo-electricien-api Worker is deployed and working', 'yellow');
    log('   4. Test thoroughly before considering this complete', 'yellow');
    log('   5. DNS should already be pointing to Cloudflare proxy IPs', 'yellow');

    log('\n📚 Next Steps:', 'bright');
    log('   1. Test all routes (homepage, city pages, API endpoints)', 'cyan');
    log('   2. Monitor logs for any errors: npx wrangler tail', 'cyan');
    log('   3. If issues occur, rollback or fix and redeploy', 'cyan');

    log('\n' + '='.repeat(70) + '\n', 'green');

  } catch (error) {
    logError('\n❌ Deployment failed with error:');
    console.error(error.message);

    if (error.message.includes('authentication') || error.message.includes('API token')) {
      log('\n💡 Authentication help:', 'yellow');
      log('   Run: npx wrangler login', 'cyan');
      log('   Or set CLOUDFLARE_API_TOKEN in .env', 'cyan');
    }

    if (error.message.includes('zone')) {
      log('\n💡 Zone configuration help:', 'yellow');
      log('   Check zone_id in wrangler.toml matches allo-electricien.pro zone', 'cyan');
      log('   Get zone ID from Cloudflare Dashboard → allo-electricien.pro → Overview', 'cyan');
    }

    process.exit(1);
  }
}

// Run deployment
deploy().catch(error => {
  logError('Unexpected error during deployment:');
  console.error(error);
  process.exit(1);
});
