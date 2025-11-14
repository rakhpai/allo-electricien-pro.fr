import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('SUPABASE STORAGE INVESTIGATION');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Check Supabase storage buckets and inventory files
 */
async function checkStorage() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const report = {
    timestamp: new Date().toISOString(),
    buckets: {},
    source_images: {
      expected: 342,
      found: 0,
      files: [],
      total_size: 0
    },
    processed_images: {
      found: 0,
      by_type: {},
      by_format: {},
      files: [],
      total_size: 0
    },
    logos: {
      found: 0,
      files: []
    }
  };

  console.log('Checking storage buckets...\n');

  // List all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('❌ Failed to list buckets:', bucketsError.message);
    process.exit(1);
  }

  console.log(`Found ${buckets.length} storage buckets:\n`);
  buckets.forEach(bucket => {
    console.log(`  • ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    report.buckets[bucket.name] = {
      public: bucket.public,
      created_at: bucket.created_at
    };
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SOURCE IMAGES BUCKET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check source-images bucket
  const { data: sourceFiles, error: sourceError } = await supabase.storage
    .from('source-images')
    .list('electrician', {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (sourceError) {
    console.log(`⚠️  Could not list source-images/electrician: ${sourceError.message}\n`);
  } else if (sourceFiles) {
    const imageFiles = sourceFiles.filter(f => f.name.match(/elec-\d{3}\.(jpg|jpeg|png)$/i));

    report.source_images.found = imageFiles.length;
    report.source_images.files = imageFiles.map(f => ({
      name: f.name,
      size: f.metadata?.size || 0,
      created_at: f.created_at
    }));
    report.source_images.total_size = imageFiles.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);

    console.log(`Found ${imageFiles.length} source images (expected: 342)\n`);

    if (imageFiles.length > 0) {
      console.log('Sample files:');
      imageFiles.slice(0, 5).forEach(f => {
        const sizeMB = ((f.metadata?.size || 0) / 1024 / 1024).toFixed(2);
        console.log(`  • ${f.name} (${sizeMB} MB)`);
      });
      console.log(`  ... and ${imageFiles.length - 5} more\n`);

      const avgSize = (report.source_images.total_size / imageFiles.length / 1024 / 1024).toFixed(2);
      const totalSizeGB = (report.source_images.total_size / 1024 / 1024 / 1024).toFixed(2);
      console.log(`Total size: ${totalSizeGB} GB (avg: ${avgSize} MB per image)\n`);
    }

    // Check for missing numbers
    const foundNumbers = imageFiles.map(f => {
      const match = f.name.match(/elec-(\d{3})/);
      return match ? parseInt(match[1]) : null;
    }).filter(n => n !== null).sort((a, b) => a - b);

    const missing = [];
    for (let i = 1; i <= 342; i++) {
      if (!foundNumbers.includes(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      console.log(`⚠️  Missing ${missing.length} source images:`);
      if (missing.length <= 20) {
        console.log(`   ${missing.map(n => `elec-${String(n).padStart(3, '0')}`).join(', ')}\n`);
      } else {
        console.log(`   ${missing.slice(0, 10).map(n => `elec-${String(n).padStart(3, '0')}`).join(', ')}, ... and ${missing.length - 10} more\n`);
      }
      report.source_images.missing = missing;
    } else {
      console.log('✅ All 342 source images present!\n');
    }
  }

  // Check logos
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LOGOS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: logoFiles, error: logoError } = await supabase.storage
    .from('source-images')
    .list('logos', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (!logoError && logoFiles) {
    const svgFiles = logoFiles.filter(f => f.name.endsWith('.svg'));
    report.logos.found = svgFiles.length;
    report.logos.files = svgFiles.map(f => f.name);

    console.log(`Found ${svgFiles.length} logo files (expected: 25)\n`);

    if (svgFiles.length > 0) {
      console.log('Logos:');
      svgFiles.forEach(f => {
        const sizeKB = ((f.metadata?.size || 0) / 1024).toFixed(1);
        console.log(`  • ${f.name} (${sizeKB} KB)`);
      });
      console.log('');
    }
  }

  // Check processed-images bucket
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PROCESSED IMAGES BUCKET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const variantTypes = ['hero', 'og', 'featured', 'video'];

  for (const variantType of variantTypes) {
    const { data: variantFiles, error: variantError } = await supabase.storage
      .from('processed-images')
      .list(`allo-electricien.pro/${variantType}`, {
        limit: 2000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (!variantError && variantFiles) {
      const count = variantFiles.filter(f => f.name.match(/\.(jpg|webp|avif)$/i)).length;
      report.processed_images.by_type[variantType] = count;
      report.processed_images.found += count;

      // Count by format
      ['jpg', 'webp', 'avif'].forEach(format => {
        const formatCount = variantFiles.filter(f => f.name.endsWith(`.${format}`)).length;
        report.processed_images.by_format[format] = (report.processed_images.by_format[format] || 0) + formatCount;
      });

      console.log(`${variantType.padEnd(10)}: ${count} files`);
    }
  }

  const totalExpected = 342 * 4 * 3; // 342 sources × 4 types × 3 formats = 4,104
  console.log(`\nTotal processed variants: ${report.processed_images.found} (expected: ${totalExpected})`);

  if (report.processed_images.found > 0) {
    console.log('\nBy format:');
    Object.entries(report.processed_images.by_format).forEach(([format, count]) => {
      console.log(`  ${format.toUpperCase()}: ${count}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Source Images:    ${report.source_images.found}/342 (${((report.source_images.found/342)*100).toFixed(1)}%)`);
  console.log(`Logos:            ${report.logos.found}/25 (${((report.logos.found/25)*100).toFixed(1)}%)`);
  console.log(`Processed Images: ${report.processed_images.found}/${totalExpected} (${((report.processed_images.found/totalExpected)*100).toFixed(1)}%)`);

  console.log('\nReadiness:');
  if (report.source_images.found === 342) {
    console.log('  ✅ Source images ready for processing');
  } else {
    console.log(`  ⚠️  Missing ${342 - report.source_images.found} source images`);
  }

  if (report.logos.found === 25) {
    console.log('  ✅ All logos uploaded');
  } else {
    console.log(`  ⚠️  Missing ${25 - report.logos.found} logos`);
  }

  if (report.processed_images.found === 0) {
    console.log('  ℹ️  No processed variants yet (ready to generate)');
  } else if (report.processed_images.found === totalExpected) {
    console.log('  ✅ All variants generated!');
  } else {
    console.log(`  ⏳ ${report.processed_images.found} variants generated, ${totalExpected - report.processed_images.found} remaining`);
  }

  // Save report
  const reportPath = path.resolve(__dirname, '../../storage-inventory-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved: storage-inventory-report.json\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

checkStorage().catch(error => {
  console.error('\n❌ Investigation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
