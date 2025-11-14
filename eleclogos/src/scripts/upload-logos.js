/**
 * Upload Logo Assets to Supabase Storage
 * Uploads SVG watermarks and brand assets from eleclogos/ to Supabase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cliProgress from 'cli-progress';
import { storageHelper } from '../utils/storage-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../..'),  // Points to /home/proalloelectrici/hugosource/eleclogos
  bucket: 'source-images',
  prefix: 'logos',
  concurrency: 3
};

/**
 * Scan logo directory for assets
 */
function scanLogoAssets() {
  console.log(`📂 Scanning logo directory: ${CONFIG.sourceDir}\n`);

  if (!fs.existsSync(CONFIG.sourceDir)) {
    throw new Error(`Logo directory not found: ${CONFIG.sourceDir}`);
  }

  const files = fs.readdirSync(CONFIG.sourceDir);

  // Filter for image files (SVG, PNG)
  const assetFiles = files.filter(file => {
    return file.match(/\.(svg|png)$/i);
  });

  console.log(`✓ Found ${assetFiles.length} logo assets:`);

  // Categorize files
  const logos = assetFiles.filter(f => f.includes('logo') || f.includes('icon'));
  const ctas = assetFiles.filter(f => f.includes('tel') || f.includes('cta') || f.includes('button'));
  const other = assetFiles.filter(f => !logos.includes(f) && !ctas.includes(f));

  console.log(`  - Logos: ${logos.length}`);
  console.log(`  - CTAs:  ${ctas.length}`);
  console.log(`  - Other: ${other.length}\n`);

  return {
    all: assetFiles.sort(),
    logos,
    ctas,
    other
  };
}

/**
 * Upload logo assets to Supabase Storage
 */
async function uploadAssets(assetFiles) {
  console.log(`☁️  Uploading ${assetFiles.all.length} assets to Supabase Storage...\n`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Upload |{bar}| {percentage}% | {value}/{total} | {filename}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(assetFiles.all.length, 0, { filename: 'Starting...' });

  const uploadResults = [];
  const errors = [];

  // Process files in batches
  for (let i = 0; i < assetFiles.all.length; i += CONFIG.concurrency) {
    const batch = assetFiles.all.slice(i, i + CONFIG.concurrency);

    const batchPromises = batch.map(async (filename) => {
      const filePath = path.join(CONFIG.sourceDir, filename);

      try {
        // Generate storage path
        const storagePath = `${CONFIG.prefix}/${filename}`;

        // Get file stats
        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();

        // Determine content type
        const contentType = ext === '.svg' ? 'image/svg+xml' : 'image/png';

        // Check if already exists
        const exists = await storageHelper.fileExists(CONFIG.bucket, storagePath);

        if (exists) {
          progressBar.update(i + 1, { filename });
          return {
            success: true,
            skipped: true,
            filename,
            storagePath
          };
        }

        // Upload to Supabase
        const result = await storageHelper.uploadFile(
          CONFIG.bucket,
          storagePath,
          filePath,
          {
            contentType,
            cacheControl: '31536000' // 1 year
          }
        );

        progressBar.update(i + 1, { filename });

        return {
          success: true,
          skipped: false,
          filename,
          storagePath,
          publicUrl: result.url,
          fileSize: stats.size,
          contentType
        };

      } catch (error) {
        console.error(`\n  ✗ Failed: ${filename} - ${error.message}`);
        errors.push({
          filename,
          error: error.message
        });

        return {
          success: false,
          filename,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    uploadResults.push(...batchResults);
  }

  progressBar.stop();

  const successful = uploadResults.filter(r => r.success && !r.skipped).length;
  const skipped = uploadResults.filter(r => r.skipped).length;
  const failed = uploadResults.filter(r => !r.success).length;

  console.log(`\n✓ Upload complete:`);
  console.log(`  Uploaded: ${successful}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(err => {
      console.log(`  - ${err.filename}: ${err.error}`);
    });
  }

  return uploadResults.filter(r => r.success);
}

/**
 * List uploaded logo assets
 */
function listAssetsByCategory(uploadResults) {
  console.log(`\n📋 Uploaded Assets by Category:\n`);

  const logos = uploadResults.filter(r =>
    r.filename.includes('logo') || r.filename.includes('icon')
  );

  const ctas = uploadResults.filter(r =>
    r.filename.includes('tel') || r.filename.includes('cta') || r.filename.includes('button')
  );

  const other = uploadResults.filter(r =>
    !logos.includes(r) && !ctas.includes(r)
  );

  console.log(`Logos (${logos.length}):`);
  logos.forEach(asset => {
    console.log(`  ✓ ${asset.filename}`);
    if (asset.publicUrl) {
      console.log(`    ${asset.publicUrl}`);
    }
  });

  console.log(`\nCTAs (${ctas.length}):`);
  ctas.forEach(asset => {
    console.log(`  ✓ ${asset.filename}`);
    if (asset.publicUrl) {
      console.log(`    ${asset.publicUrl}`);
    }
  });

  if (other.length > 0) {
    console.log(`\nOther (${other.length}):`);
    other.forEach(asset => {
      console.log(`  ✓ ${asset.filename}`);
      if (asset.publicUrl) {
        console.log(`    ${asset.publicUrl}`);
      }
    });
  }

  return { logos, ctas, other };
}

/**
 * Generate watermark config template
 */
function generateWatermarkConfig(categories) {
  console.log(`\n📝 Sample Watermark Configuration:\n`);

  // Find recommended logo and CTA
  const recommendedLogo = categories.logos.find(l => l.filename.includes('logoicon-9')) || categories.logos[0];
  const recommendedCta = categories.ctas.find(c => c.filename.includes('tel_3')) || categories.ctas[0];

  const config = {
    logo: {
      path: recommendedLogo ? `logos/${recommendedLogo.filename}` : 'logos/logoicon-9.svg',
      position: 'top-left',
      size: 240,
      opacity: 1.0
    },
    cta: {
      path: recommendedCta ? `logos/${recommendedCta.filename}` : 'logos/tel_3.svg',
      position: 'bottom-right',
      size: 1050,
      maxWidthPercent: 0.6,
      opacity: 1.0,
      dropShadow: true
    },
    brandColor: '#dc2626'
  };

  console.log(JSON.stringify(config, null, 2));

  console.log(`\n💡 Use this configuration in sites table for allo-electricien.pro\n`);

  return config;
}

/**
 * Verify logo assets
 */
async function verifyAssets() {
  console.log(`\n🔍 Verifying uploaded assets...\n`);

  try {
    const files = await storageHelper.listFiles(CONFIG.bucket, CONFIG.prefix);

    console.log(`✓ Found ${files.length} files in ${CONFIG.bucket}/${CONFIG.prefix}/`);

    // Calculate total storage
    const totalBytes = files.reduce((sum, file) => {
      return sum + (file.metadata?.size || 0);
    }, 0);

    console.log(`  Total size: ${(totalBytes / 1024).toFixed(2)} KB`);

    // List all files
    console.log(`\nFiles:`);
    files.forEach(file => {
      const size = file.metadata?.size ? `(${(file.metadata.size / 1024).toFixed(1)} KB)` : '';
      console.log(`  - ${file.name} ${size}`);
    });

    return files;

  } catch (error) {
    console.error('Verification error:', error.message);
    return [];
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  UPLOAD LOGO ASSETS TO SUPABASE STORAGE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Scan logo directory
    const assetFiles = scanLogoAssets();

    if (assetFiles.all.length === 0) {
      console.error('\n❌ No logo assets found to upload');
      process.exit(1);
    }

    // Step 2: Upload to Supabase Storage
    const uploadResults = await uploadAssets(assetFiles);

    if (uploadResults.length === 0) {
      console.error('\n❌ No assets were uploaded successfully');
      process.exit(1);
    }

    // Step 3: List by category
    const categories = listAssetsByCategory(uploadResults);

    // Step 4: Generate watermark config
    const watermarkConfig = generateWatermarkConfig(categories);

    // Step 5: Verify uploads
    await verifyAssets();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ LOGO ASSET UPLOAD COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Next steps:');
    console.log('1. Verify assets in Supabase Storage dashboard');
    console.log('2. Update sites table with watermark configuration');
    console.log('3. Test watermark application with image-processor service');
    console.log('4. Begin pre-generation process\n');

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { main as uploadLogos };
