#!/usr/bin/env node

/**
 * Deploy allo-electricien.pro API Worker to Cloudflare
 *
 * This script automates the deployment process:
 * 1. Installs dependencies if needed
 * 2. Validates configuration
 * 3. Deploys Worker to Cloudflare
 * 4. Verifies deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const WORKER_DIR = path.join(__dirname, '../../workers/allo-electricien-api');
const WORKER_NAME = 'allo-electricien-api';

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
  log('  allo-electricien.pro API Deployment Script', 'bright');
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
    const requiredFiles = ['package.json', 'wrangler.toml', 'index.js', '.dev.vars'];
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(WORKER_DIR, file)));

    if (missingFiles.length > 0) {
      logError(`Missing required files: ${missingFiles.join(', ')}`);
      process.exit(1);
    }
    logSuccess('All configuration files present');

    // Step 3: Check for node_modules
    logStep('3/7', 'Checking dependencies...');
    const nodeModulesExists = fs.existsSync(path.join(WORKER_DIR, 'node_modules'));

    if (!nodeModulesExists) {
      log('Installing dependencies...', 'yellow');
      exec('npm install');
      logSuccess('Dependencies installed');
    } else {
      logSuccess('Dependencies already installed');
    }

    // Step 4: Validate wrangler.toml configuration
    logStep('4/7', 'Validating wrangler configuration...');
    const wranglerConfig = fs.readFileSync(path.join(WORKER_DIR, 'wrangler.toml'), 'utf8');

    if (!wranglerConfig.includes('account_id')) {
      logError('Missing account_id in wrangler.toml');
      process.exit(1);
    }

    if (!wranglerConfig.includes('zone_id')) {
      logError('Missing zone_id in routes configuration');
      process.exit(1);
    }

    logSuccess('Wrangler configuration is valid');

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

    // Step 6: Deploy to Cloudflare
    logStep('6/7', 'Deploying to Cloudflare...');
    log('This may take a minute...', 'yellow');

    try {
      exec('npx wrangler deploy');
      logSuccess('Worker deployed successfully!');
    } catch (error) {
      logError('Deployment failed');
      console.error(error);
      process.exit(1);
    }

    // Step 7: Display deployment info
    logStep('7/7', 'Deployment Summary');

    log('\n' + '='.repeat(70), 'green');
    log('  DEPLOYMENT COMPLETE! 🚀', 'green');
    log('='.repeat(70), 'green');

    log('\n📊 Deployment Info:', 'bright');
    log(`   Worker Name:   ${WORKER_NAME}`, 'cyan');
    log(`   Domain:        allo-electricien.pro/api/*`, 'cyan');
    log(`   Status:        Deployed ✅`, 'green');

    log('\n🧪 Test your API:', 'bright');
    log('   Root:          https://allo-electricien.pro/', 'cyan');
    log('   Health check:  https://allo-electricien.pro/api/health', 'cyan');
    log('   Professionals: https://allo-electricien.pro/api/professionals', 'cyan');
    log('   Cities:        https://allo-electricien.pro/api/cities', 'cyan');
    log('   Videos:        https://allo-electricien.pro/api/videos', 'cyan');
    log('   Stats:         https://allo-electricien.pro/api/stats', 'cyan');

    log('\n📝 View logs:', 'bright');
    log('   cd workers/allo-electricien-api', 'cyan');
    log('   npx wrangler tail', 'cyan');

    log('\n🔐 To update production secrets:', 'bright');
    log('   cd workers/allo-electricien-api', 'cyan');
    log('   npx wrangler secret put SUPABASE_URL', 'cyan');
    log('   npx wrangler secret put SUPABASE_SERVICE_KEY', 'cyan');

    log('\n⚠️  Important Notes:', 'yellow');
    log('   1. Secrets are managed separately from code deployment', 'yellow');
    log('   2. .dev.vars is for local development only', 'yellow');
    log('   3. Production uses Cloudflare Worker secrets', 'yellow');
    log('   4. Update secrets after first deployment', 'yellow');

    log('\n📚 Next Steps:', 'bright');
    log('   1. Set production secrets (if first deployment)', 'cyan');
    log('   2. Test all API endpoints', 'cyan');
    log('   3. Monitor logs for errors', 'cyan');
    log('   4. Deploy router worker to enable routing', 'cyan');

    log('\n' + '='.repeat(70) + '\n', 'green');

  } catch (error) {
    logError('\n❌ Deployment failed with error:');
    console.error(error.message);

    if (error.message.includes('authentication') || error.message.includes('API token')) {
      log('\n💡 Authentication help:', 'yellow');
      log('   Run: npx wrangler login', 'cyan');
      log('   Or set CLOUDFLARE_API_TOKEN in .env', 'cyan');
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
