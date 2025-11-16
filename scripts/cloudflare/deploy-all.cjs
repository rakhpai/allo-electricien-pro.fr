#!/usr/bin/env node

/**
 * Complete allo-electricien.pro Stack Deployment
 *
 * This script orchestrates the full deployment of allo-electricien.pro:
 * 1. Build and deploy Hugo static site to Cloudflare Pages
 * 2. Deploy API Worker
 * 3. Deploy Router Worker to handle traffic routing
 *
 * Usage:
 *   node scripts/cloudflare/deploy-all.cjs [options]
 *
 * Options:
 *   --skip-build       Skip Hugo build (use existing public/)
 *   --skip-pages       Skip Pages deployment
 *   --skip-api         Skip API Worker deployment
 *   --skip-router      Skip Router Worker deployment
 *   --pages-only       Deploy only Pages (shortcut for --skip-api --skip-router)
 *   --workers-only     Deploy only Workers (shortcut for --skip-pages)
 */

const { execSync } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const skipPages = args.includes('--skip-pages') || args.includes('--workers-only');
const skipApi = args.includes('--skip-api');
const skipRouter = args.includes('--skip-router');

const pagesOnly = args.includes('--pages-only');
const workersOnly = args.includes('--workers-only');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(message) {
  log('\n' + '='.repeat(70), 'bright');
  log(`  ${message}`, 'bright');
  log('='.repeat(70) + '\n', 'bright');
}

function logStep(step, total, message) {
  log(`\n[${step}/${total}] ${message}`, 'magenta');
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

function exec(command, description) {
  try {
    log(`\n→ ${description}...`, 'cyan');
    execSync(command, {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit',
      encoding: 'utf8'
    });
    logSuccess(`${description} completed`);
    return true;
  } catch (error) {
    logError(`${description} failed`);
    throw error;
  }
}

// Main deployment function
async function deployAll() {
  const startTime = Date.now();

  logSection('Complete allo-electricien.pro Stack Deployment');

  log('Deployment Configuration:', 'bright');
  log(`  Hugo Build:         ${!skipBuild && !workersOnly ? '✓ Enabled' : '✗ Skipped'}`, skipBuild || workersOnly ? 'yellow' : 'green');
  log(`  Pages Deployment:   ${!skipPages ? '✓ Enabled' : '✗ Skipped'}`, skipPages ? 'yellow' : 'green');
  log(`  API Worker:         ${!skipApi && !pagesOnly ? '✓ Enabled' : '✗ Skipped'}`, skipApi || pagesOnly ? 'yellow' : 'green');
  log(`  Router Worker:      ${!skipRouter && !pagesOnly ? '✓ Enabled' : '✗ Skipped'}`, skipRouter || pagesOnly ? 'yellow' : 'green');

  try {
    let stepNum = 1;
    const totalSteps = [!skipPages, !skipApi && !pagesOnly, !skipRouter && !pagesOnly].filter(Boolean).length;

    // Step: Deploy Pages
    if (!skipPages) {
      logStep(stepNum++, totalSteps, 'Deploy Hugo Site to Cloudflare Pages');
      const pagesFlags = [];
      if (skipBuild) pagesFlags.push('--skip-build');

      exec(
        `node scripts/cloudflare/deploy-pages.cjs ${pagesFlags.join(' ')}`,
        'Building and deploying Hugo static site (with videos)'
      );

      log('\n⏳ Waiting for Pages deployment to propagate (10 seconds)...', 'yellow');
      await sleep(10000);
      logSuccess('Wait complete');
    }

    // Step: Deploy API Worker
    if (!skipApi && !pagesOnly) {
      logStep(stepNum++, totalSteps, 'Deploy API Worker');
      exec(
        'node scripts/cloudflare/deploy-api.cjs',
        'Deploying API Worker'
      );
    }

    // Step: Deploy Router Worker
    if (!skipRouter && !pagesOnly) {
      logStep(stepNum++, totalSteps, 'Deploy Router Worker');
      exec(
        'node scripts/cloudflare/deploy-router.cjs',
        'Deploying Router Worker'
      );
    }

    // Deployment Complete!
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    logSection('DEPLOYMENT COMPLETE! 🚀');

    log('📊 Deployment Summary:', 'bright');
    log(`   Duration:        ${duration}s`, 'cyan');
    log(`   Status:          Success ✅`, 'green');
    log('', 'reset');

    log('🌐 Your allo-electricien.pro Stack:', 'bright');
    log('   Production URL:  https://allo-electricien.pro', 'cyan');
    log('   Staging URL:     https://allo-electricien-main.pages.dev', 'cyan');
    log('   API Endpoint:    https://allo-electricien.pro/api/', 'cyan');
    log('', 'reset');

    log('🔀 Routing Architecture:', 'bright');
    log('   allo-electricien.pro/*    → allo-electricien-router Worker', 'cyan');
    log('   ├─ /api/*                 → allo-electricien-api Worker (REST API)', 'cyan');
    log('   └─ /* (all else)          → allo-electricien-main Pages (Hugo site)', 'cyan');
    log('', 'reset');

    log('🧪 Test Commands:', 'bright');
    log('   # Homepage', 'cyan');
    log('   curl https://allo-electricien.pro/', 'cyan');
    log('', 'reset');
    log('   # City page', 'cyan');
    log('   curl https://allo-electricien.pro/paris/', 'cyan');
    log('', 'reset');
    log('   # API health', 'cyan');
    log('   curl https://allo-electricien.pro/api/health', 'cyan');
    log('', 'reset');
    log('   # API stats', 'cyan');
    log('   curl https://allo-electricien.pro/api/stats', 'cyan');
    log('', 'reset');

    log('📝 Monitoring:', 'bright');
    log('   View router logs:  cd workers/allo-electricien-router && npx wrangler tail', 'cyan');
    log('   View API logs:     cd workers/allo-electricien-api && npx wrangler tail', 'cyan');
    log('   Pages analytics:   https://dash.cloudflare.com → Workers & Pages → allo-electricien-main', 'cyan');
    log('', 'reset');

    log('⚠️  Post-Deployment Checklist:', 'yellow');
    log('   □ Test homepage loads correctly', 'yellow');
    log('   □ Test city pages load correctly', 'yellow');
    log('   □ Test video playback', 'yellow');
    log('   □ Test API endpoints respond', 'yellow');
    log('   □ Check router logs for errors', 'yellow');
    log('   □ Verify DNS is resolving correctly', 'yellow');
    log('   □ Test on mobile devices', 'yellow');
    log('   □ Monitor for 24 hours', 'yellow');
    log('', 'reset');

    log('='.repeat(70) + '\n', 'green');

  } catch (error) {
    logError('\n❌ Deployment failed!');
    console.error(error.message);

    log('\n💡 Troubleshooting:', 'yellow');
    log('   1. Check error message above', 'cyan');
    log('   2. Verify all prerequisites are met', 'cyan');
    log('   3. Check Cloudflare authentication (npx wrangler whoami)', 'cyan');
    log('   4. Verify account_id and zone_id in wrangler.toml files', 'cyan');
    log('   5. Check deployment logs in Cloudflare Dashboard', 'cyan');
    log('', 'reset');

    log('📚 Get Help:', 'yellow');
    log('   - Review worker README files', 'cyan');
    log('   - Check Cloudflare Workers documentation', 'cyan');
    log('   - Verify Hugo installation and version', 'cyan');
    log('', 'reset');

    process.exit(1);
  }
}

// Helper function for async sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run deployment
deployAll().catch(error => {
  logError('Unexpected error during deployment:');
  console.error(error);
  process.exit(1);
});
