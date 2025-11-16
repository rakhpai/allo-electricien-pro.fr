#!/usr/bin/env node

/**
 * Deploy allo-electricien.pro Hugo Site to Cloudflare Pages
 *
 * This script:
 * 1. Builds Hugo static site (content already generated)
 * 2. Creates/deploys to Cloudflare Pages project
 * 3. Configures custom domain (allo-electricien.pro)
 *
 * Usage:
 *   node scripts/cloudflare/deploy-pages.cjs [--skip-build]
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const HUGO_SITE_DIR = path.join(__dirname, '../..');
const PUBLIC_DIR = path.join(HUGO_SITE_DIR, 'public');
const PROJECT_NAME = 'allo-electricien-main';
const CUSTOM_DOMAIN = 'allo-electricien.pro';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '7dc41b0885c9c46256b04334123e972e';

// Parse command line arguments
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');

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
  log('  allo-electricien.pro Hugo Site Deployment to Cloudflare Pages', 'bright');
  log('='.repeat(70) + '\n', 'bright');

  try {
    // Step 1: Verify Hugo site directory
    logStep('1/6', 'Checking Hugo site directory...');
    if (!fs.existsSync(HUGO_SITE_DIR)) {
      logError(`Hugo site directory not found: ${HUGO_SITE_DIR}`);
      process.exit(1);
    }
    logSuccess(`Hugo site found: ${HUGO_SITE_DIR}`);

    // Step 2: Build Hugo site
    if (!skipBuild) {
      logStep('2/6', 'Building Hugo static site...');

      // Check if Hugo is installed
      try {
        const hugoVersion = exec('hugo version', { silent: true, cwd: HUGO_SITE_DIR });
        log(`Hugo version: ${hugoVersion.trim()}`, 'yellow');
      } catch (error) {
        logError('Hugo not found! Please install Hugo: https://gohugo.io/installation/');
        process.exit(1);
      }

      // Clean previous build to prevent deploying stale development builds
      if (fs.existsSync(PUBLIC_DIR)) {
        log('Cleaning previous build...', 'yellow');
        fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
        logSuccess('Previous build cleaned');
      }

      // Build the site for production
      exec('hugo --gc --minify --environment production', { cwd: HUGO_SITE_DIR });
      logSuccess('Hugo site built successfully');
    } else {
      logStep('2/6', 'Skipping Hugo build (--skip-build flag)');
    }

    // Step 3: Verify build output
    logStep('3/6', 'Verifying build output...');
    if (!fs.existsSync(PUBLIC_DIR)) {
      logError(`Build output directory not found: ${PUBLIC_DIR}`);
      logError('Run without --skip-build flag to build the site');
      process.exit(1);
    }

    const indexHtml = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      logError('index.html not found in build output!');
      process.exit(1);
    }

    // Get directory size
    const files = getAllFiles(PUBLIC_DIR);
    const totalSize = files.reduce((acc, file) => acc + fs.statSync(file).size, 0);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

    // Validate that this is a production build, not a development build
    const sampleHtml = fs.readFileSync(indexHtml, 'utf8');
    if (sampleHtml.includes('localhost:1313')) {
      logError('❌ Production build contains localhost URLs!');
      logError('This appears to be a development build from "hugo server".');
      logError('');
      logError('To fix:');
      logError('  1. Delete public/ directory: rm -rf public');
      logError('  2. Build for production: hugo --gc --minify --environment production');
      logError('  3. Redeploy: node scripts/cloudflare/deploy-pages.cjs');
      process.exit(1);
    }
    if (sampleHtml.includes('livereload.js')) {
      logError('❌ Production build contains livereload script!');
      logError('This is a development build, not suitable for production.');
      logError('Delete public/ and rebuild with: hugo --gc --minify --environment production');
      process.exit(1);
    }

    logSuccess(`Build output verified: ${files.length} files, ${sizeMB} MB`);

    // Step 4: Check Cloudflare credentials
    logStep('4/6', 'Checking Cloudflare credentials...');

    if (!CLOUDFLARE_ACCOUNT_ID || CLOUDFLARE_ACCOUNT_ID === 'YOUR_ACCOUNT_ID_HERE') {
      logError('CLOUDFLARE_ACCOUNT_ID not set!');
      logError('Set it in .env or this script will use default account ID');
      process.exit(1);
    }

    // Check if wrangler is configured
    try {
      exec('npx wrangler whoami', { silent: true });
      logSuccess('Wrangler authenticated');
    } catch (error) {
      logError('Wrangler not authenticated!');
      log('Run: npx wrangler login', 'yellow');
      process.exit(1);
    }

    // Step 5: Check if Pages project exists, create if not
    logStep('5/6', 'Checking Cloudflare Pages project...');

    let projectExists = false;
    try {
      const projectList = exec('npx wrangler pages project list', {
        silent: true,
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID }
      });

      if (projectList && projectList.includes(PROJECT_NAME)) {
        projectExists = true;
        logSuccess(`Project "${PROJECT_NAME}" already exists`);
      }
    } catch (error) {
      projectExists = false;
    }

    if (!projectExists) {
      log(`Creating new Pages project: ${PROJECT_NAME}...`, 'yellow');
      try {
        exec(`npx wrangler pages project create ${PROJECT_NAME} --production-branch main`, {
          env: { ...process.env, CLOUDFLARE_ACCOUNT_ID }
        });
        logSuccess('Project created successfully');
      } catch (error) {
        logWarning('Project creation failed or already exists, continuing...');
      }
    }

    // Step 6: Deploy to Cloudflare Pages
    logStep('6/6', 'Deploying to Cloudflare Pages...');
    log('This may take 3-5 minutes depending on site size (includes videos)...', 'yellow');

    const deployCommand = `npx wrangler pages deploy "${PUBLIC_DIR}" --project-name="${PROJECT_NAME}" --branch=main`;

    const deployOutput = exec(deployCommand, {
      stdio: 'pipe',
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID }
    });

    // Extract deployment URL
    const deploymentUrlMatch = deployOutput.match(/https:\/\/[\w-]+\.[\w-]+\.pages\.dev/);
    const pagesUrl = deploymentUrlMatch ? deploymentUrlMatch[0] : `https://${PROJECT_NAME}.pages.dev`;

    logSuccess('Deployment successful!\n');

    // Display deployment summary
    log('='.repeat(70), 'green');
    log('  DEPLOYMENT COMPLETE! 🚀', 'green');
    log('='.repeat(70), 'green');

    log('\n📊 Deployment Info:', 'bright');
    log(`   Project Name:  ${PROJECT_NAME}`, 'cyan');
    log(`   Pages URL:     ${pagesUrl}`, 'cyan');
    log(`   Custom Domain: ${CUSTOM_DOMAIN}`, 'cyan');
    log(`   Files:         ${files.length}`, 'cyan');
    log(`   Size:          ${sizeMB} MB`, 'cyan');
    log(`   Status:        Live ✅\n`, 'green');

    log('🌐 Access your site:', 'bright');
    log(`   Staging:       ${pagesUrl}`, 'cyan');
    log(`   Production:    https://${CUSTOM_DOMAIN}`, 'cyan');

    log('\n⚙️  Next Steps:', 'bright');
    log(`   1. Test the staging URL: ${pagesUrl}`, 'yellow');
    log(`   2. Deploy router and API workers:`, 'yellow');
    log(`      node scripts/cloudflare/deploy-all.cjs`, 'yellow');
    log(`   3. Verify routing works at https://${CUSTOM_DOMAIN}`, 'yellow');

    log('\n📝 Useful Commands:', 'bright');
    log(`   View logs:     npx wrangler pages deployment tail --project-name=${PROJECT_NAME}`, 'cyan');
    log(`   List deploys:  npx wrangler pages deployment list --project-name=${PROJECT_NAME}`, 'cyan');
    log(`   Rollback:      npx wrangler pages deployment list --project-name=${PROJECT_NAME} (then redeploy specific commit)`, 'cyan');

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

// Helper function to get all files recursively
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Run deployment
deploy().catch(error => {
  logError('Unexpected error during deployment:');
  console.error(error);
  process.exit(1);
});
