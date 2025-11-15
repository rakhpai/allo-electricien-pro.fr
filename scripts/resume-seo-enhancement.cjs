#!/usr/bin/env node

/**
 * Resume SEO Enhancement
 * Detects and resumes interrupted SEO enhancement sessions
 */

const fs = require('fs');
const { spawn } = require('child_process');

const CHECKPOINT_FILE = 'checkpoint-seo-enhancement.json';

function main() {
  console.log('🔍 Checking for interrupted SEO enhancement session...\n');

  if (!fs.existsSync(CHECKPOINT_FILE)) {
    console.log('❌ No checkpoint file found.');
    console.log('   No interrupted session to resume.');
    console.log('');
    console.log('To start a new enhancement:');
    console.log('  node scripts/enhance-seo-comprehensive.cjs --test');
    return;
  }

  try {
    const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));

    console.log('📂 Found checkpoint:');
    console.log(`   Session ID: ${checkpoint.sessionId}`);
    console.log(`   Last update: ${checkpoint.lastUpdate}`);
    console.log(`   Progress: ${checkpoint.processed.successful}/${checkpoint.processed.total} successful`);
    console.log(`   Failed: ${checkpoint.processed.failed}`);
    console.log(`   Last processed: ${checkpoint.lastProcessedSlug}`);
    if (checkpoint.costs) {
      console.log(`   Cost so far: $${checkpoint.costs.cost.toFixed(4)}`);
    }
    console.log('');

    const remaining = checkpoint.processed.total - checkpoint.processed.successful - checkpoint.processed.failed;
    console.log(`📊 Status: ${remaining} pages remaining`);
    console.log('');
    console.log('⚠️  Note: The enhancement script will automatically skip already-processed pages');
    console.log('         by checking for the seoEnhanced field in frontmatter.');
    console.log('');
    console.log('🚀 To resume, run:');
    console.log('   node scripts/enhance-seo-comprehensive.cjs');
    console.log('');
    console.log('Or to continue with same parameters automatically, press Enter...');

    // Auto-resume after 5 seconds
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('', () => {
      rl.close();
      console.log('\n🔄 Resuming enhancement...\n');

      const child = spawn('node', ['scripts/enhance-seo-comprehensive.cjs'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('exit', (code) => {
        process.exit(code);
      });
    });

  } catch (err) {
    console.error('❌ Error reading checkpoint:', err.message);
    process.exit(1);
  }
}

main();
