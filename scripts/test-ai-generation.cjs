#!/usr/bin/env node

/**
 * Simple test script to verify AI content generation is working
 * Tests the AI configuration and generates sample content
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const {
  anthropic,
  CONFIG,
  toProperCase,
  DEPARTMENT_NAMES,
  determineContentTheme,
  calculateCost
} = require('./ai-config.cjs');

// Test cities
const TEST_CITIES = ['versailles', 'paris', 'rueil-malmaison', 'meudon', 'bezons'];

async function testContentGeneration() {
  console.log('═'.repeat(80));
  console.log('  AI CONTENT GENERATION TEST');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Testing AI configuration and content generation...\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ERROR: ANTHROPIC_API_KEY not found in .env file');
    process.exit(1);
  } else {
    console.log('✅ API key found');
  }

  // Test reading a content file
  console.log('\n📁 Testing content file reading:');
  const testCity = TEST_CITIES[0];
  const contentPath = path.join(__dirname, '..', 'content', testCity, 'index.md');

  if (!fs.existsSync(contentPath)) {
    console.error(`❌ Content file not found: ${contentPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(contentPath, 'utf-8');
  const { data: frontmatter } = matter(fileContent);

  console.log(`✅ Successfully read ${testCity}/index.md`);
  console.log(`   City: ${frontmatter.city}`);
  console.log(`   Department: ${frontmatter.department}`);
  console.log(`   Zip: ${frontmatter.zipCode}`);

  // Test AI generation with a simple prompt
  console.log('\n🤖 Testing AI content generation:');

  try {
    const context = {
      city: toProperCase(frontmatter.city || testCity),
      department: frontmatter.department,
      department_name: DEPARTMENT_NAMES[frontmatter.department] || 'Île-de-France',
      zipCode: frontmatter.zipCode,
      content_theme: determineContentTheme(frontmatter.city, frontmatter.keyword)
    };

    console.log(`   Theme: ${context.content_theme}`);
    console.log(`   Generating test content...`);

    const prompt = `Generate a short SEO title for an electrician service page.
City: ${context.city}
Department: ${context.department}
Theme: ${context.content_theme}

Requirements:
- Length: 45-62 characters
- Include "Électricien" and city name
- Professional French language
- NO quotes or explanation

Return only the title.`;

    const message = await anthropic.messages.create({
      model: CONFIG.MODEL,
      max_tokens: 100,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const generatedTitle = message.content[0].text.trim();
    console.log(`\n✅ AI Generation successful!`);
    console.log(`   Generated title: "${generatedTitle}"`);
    console.log(`   Length: ${generatedTitle.length} characters`);
    console.log(`   Tokens used: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

    const cost = calculateCost(message.usage.input_tokens, message.usage.output_tokens, CONFIG.MODEL);
    console.log(`   Cost: $${cost.cost.toFixed(6)}`);

  } catch (error) {
    console.error(`\n❌ AI generation failed:`, error.message);
    process.exit(1);
  }

  // Test multiple cities
  console.log('\n📊 Testing batch generation for multiple cities:');

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const results = [];

  for (const citySlug of TEST_CITIES.slice(0, 3)) {
    const cityPath = path.join(__dirname, '..', 'content', citySlug, 'index.md');

    if (!fs.existsSync(cityPath)) {
      console.log(`   ⚠️  Skipping ${citySlug} (not found)`);
      continue;
    }

    const cityContent = fs.readFileSync(cityPath, 'utf-8');
    const { data: cityData } = matter(cityContent);

    console.log(`\n   Processing ${toProperCase(cityData.city || citySlug)}...`);

    try {
      const simplePrompt = `Create a 150-160 character meta description for an electrician in ${toProperCase(cityData.city || citySlug)} (${cityData.department}). Include "électricien", city name, and "☎ ${cityData.phone || '01 88 33 50 40'}". Professional French only.`;

      const response = await anthropic.messages.create({
        model: CONFIG.MODEL,
        max_tokens: 150,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: simplePrompt
        }]
      });

      const metaDesc = response.content[0].text.trim();

      console.log(`   ✓ Generated (${metaDesc.length} chars)`);
      console.log(`     "${metaDesc.substring(0, 80)}..."`);

      totalTokensIn += response.usage.input_tokens;
      totalTokensOut += response.usage.output_tokens;

      results.push({
        city: cityData.city,
        metaDescription: metaDesc,
        length: metaDesc.length
      });

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`   ✗ Failed: ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\n✅ All tests completed successfully!`);
  console.log(`\n📊 Statistics:`);
  console.log(`   Cities tested: ${results.length}`);
  console.log(`   Total input tokens: ${totalTokensIn}`);
  console.log(`   Total output tokens: ${totalTokensOut}`);

  const totalCost = calculateCost(totalTokensIn, totalTokensOut, CONFIG.MODEL);
  console.log(`   Total cost: $${totalCost.cost.toFixed(4)}`);
  console.log(`   Model used: ${CONFIG.MODEL}`);

  console.log(`\n💡 Next steps:`);
  console.log(`   1. Run full SEO generation: node scripts/regenerate-electricien-seo-content.cjs --dry-run`);
  console.log(`   2. Generate enhancements: node scripts/generate-electricien-enhancements.cjs --test --dry-run`);
  console.log(`   3. Generate service descriptions: node scripts/generate-electricien-services.cjs --test --dry-run`);
  console.log(`\n   Add --dry-run to test without database updates`);
  console.log(`   Add --test to process only a few items`);
  console.log(`   Remove flags to run in production mode`);
}

// Run the test
testContentGeneration().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});