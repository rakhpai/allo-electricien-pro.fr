import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSEOBaseName } from '../utils/image-seo-namer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════');
console.log('PAGE-TO-IMAGE MAPPING GENERATOR');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Generate round-robin mapping of pages to source images
 */
async function generateMapping() {
  // Load page inventory
  const inventoryPath = path.resolve(__dirname, '../../page-inventory-report.json');
  const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));

  console.log(`Loaded ${inventory.pages.length} pages from inventory\n`);

  const totalPages = inventory.pages.length;
  const totalSourceImages = 342;
  const pagesPerImage = Math.ceil(totalPages / totalSourceImages);

  console.log('Distribution:');
  console.log(`  Total pages: ${totalPages}`);
  console.log(`  Source images: ${totalSourceImages}`);
  console.log(`  Pages per image (avg): ${pagesPerImage.toFixed(1)}`);
  console.log('');

  // Create mapping
  const mapping = {
    generated_at: new Date().toISOString(),
    total_pages: totalPages,
    total_source_images: totalSourceImages,
    pages_per_image: pagesPerImage,
    distribution: 'round-robin',
    mappings: {}
  };

  console.log('Generating mappings...\n');

  // Round-robin assignment
  inventory.pages.forEach((page, index) => {
    // Calculate source image number (1-342) using round-robin
    const imageNumber = (index % totalSourceImages) + 1;
    const imagePadded = String(imageNumber).padStart(3, '0');
    const sourceFilename = `elec-${imagePadded}.jpg`;

    // Generate SEO base name for this page
    const seoBaseName = generateSEOBaseName(page);

    // Store mapping
    mapping.mappings[page.slug] = {
      page_index: index,
      source_image_number: imageNumber,
      source_filename: sourceFilename,
      seo_base_name: seoBaseName,
      page_data: {
        slug: page.slug,
        city: page.city,
        zipCode: page.zipCode,
        department: page.department
      }
    };

    // Progress
    if ((index + 1) % 200 === 0) {
      console.log(`  Mapped ${index + 1}/${totalPages} pages...`);
    }
  });

  console.log(`  ✓ Mapped all ${totalPages} pages\n`);

  // Calculate statistics
  const imageUsage = {};
  Object.values(mapping.mappings).forEach(m => {
    const num = m.source_image_number;
    imageUsage[num] = (imageUsage[num] || 0) + 1;
  });

  const usageCounts = Object.values(imageUsage);
  const minUsage = Math.min(...usageCounts);
  const maxUsage = Math.max(...usageCounts);
  const avgUsage = (totalPages / totalSourceImages).toFixed(2);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DISTRIBUTION STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Image usage:');
  console.log(`  Min pages per image: ${minUsage}`);
  console.log(`  Max pages per image: ${maxUsage}`);
  console.log(`  Average pages per image: ${avgUsage}`);
  console.log('');

  // Sample mappings
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SAMPLE MAPPINGS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sampleSlugs = Object.keys(mapping.mappings).slice(0, 5);

  sampleSlugs.forEach(slug => {
    const m = mapping.mappings[slug];
    console.log(`${slug}:`);
    console.log(`  Source: ${m.source_filename} (image #${m.source_image_number})`);
    console.log(`  SEO base: ${m.seo_base_name}`);
    console.log('');
  });

  // Show which images are most used
  const topUsed = Object.entries(imageUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('Most used source images:');
  topUsed.forEach(([num, count]) => {
    const padded = String(num).padStart(3, '0');
    console.log(`  elec-${padded}.jpg: ${count} pages`);
  });
  console.log('');

  // Add statistics to mapping
  mapping.statistics = {
    min_usage: minUsage,
    max_usage: maxUsage,
    avg_usage: parseFloat(avgUsage),
    image_usage: imageUsage
  };

  // Save mapping
  const outputPath = path.resolve(__dirname, '../../page-to-image-mapping.json');
  await fs.writeFile(outputPath, JSON.stringify(mapping, null, 2));

  console.log('✓ Mapping saved: page-to-image-mapping.json');
  console.log(`  (${Object.keys(mapping.mappings).length} page mappings)\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ Mapping complete!');
  console.log(`   ${totalPages} pages mapped to ${totalSourceImages} source images`);
  console.log(`   Each image will serve ~${pagesPerImage} pages`);
  console.log('');

  console.log('Next steps:');
  console.log('  1. Populate source_images table in database');
  console.log('  2. Generate variants locally (16,392 files)');
  console.log('  3. Upload to Supabase CDN\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

generateMapping().catch(error => {
  console.error('\n❌ Mapping generation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
