/**
 * Copy Images to Hugo Script
 * Copies all generated images from Sharp output to Hugo static directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourcePath: 'C:\\Users\\rober\\elec\\sharp\\output',
  destPath: path.join(__dirname, '../static/images'),
  variants: ['hero', 'og', 'featured', 'video'],
  formats: ['jpg', 'webp', 'avif']
};

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy file with progress
 */
function copyFile(source, dest) {
  const dir = path.dirname(dest);
  ensureDir(dir);
  fs.copyFileSync(source, dest);
}

/**
 * Get directory size in bytes
 */
function getDirectorySize(dirPath) {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const files = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });

  for (const file of files) {
    if (file.isFile()) {
      const filePath = path.join(file.path || dirPath, file.name);
      try {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      } catch (err) {
        // Skip files that can't be accessed
      }
    }
  }

  return totalSize;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Count files in directory
 */
function countFiles(dirPath, extension = null) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let count = 0;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      count += countFiles(itemPath, extension);
    } else if (item.isFile()) {
      if (!extension || item.name.endsWith(extension)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Main copy function
 */
async function copyImagesToHugo() {
  console.log('🚀 Copying Images to Hugo Static Directory\n');

  // Check source directory exists
  if (!fs.existsSync(CONFIG.sourcePath)) {
    console.error('❌ Error: Source directory not found:', CONFIG.sourcePath);
    console.log('\nMake sure to run the Sharp image processor first:');
    console.log('  cd C:\\Users\\rober\\elec');
    console.log('  node sharp/process-images.js\n');
    process.exit(1);
  }

  // Count source files
  console.log('📊 Analyzing source directory...');
  const sourceFileCount = countFiles(CONFIG.sourcePath);
  const sourceSize = getDirectorySize(CONFIG.sourcePath);
  console.log(`   Files: ${sourceFileCount}`);
  console.log(`   Size:  ${formatBytes(sourceSize)}\n`);

  if (sourceFileCount === 0) {
    console.error('❌ Error: No files found in source directory');
    process.exit(1);
  }

  // Prepare destination
  console.log('📁 Preparing destination directory...');
  ensureDir(CONFIG.destPath);

  for (const variant of CONFIG.variants) {
    const variantPath = path.join(CONFIG.destPath, variant);
    ensureDir(variantPath);
  }

  console.log(`   Destination: ${CONFIG.destPath}\n`);

  // Copy files
  console.log('📦 Copying files...\n');

  let copied = 0;
  let skipped = 0;
  let errors = 0;
  let totalBytes = 0;

  const variantMapping = {
    'hero': 'hero',
    'og': 'og',
    'featured': 'featured',
    'videoThumb': 'video'  // Source uses 'videoThumb', destination uses 'video'
  };

  for (const [sourceVariant, destVariant] of Object.entries(variantMapping)) {
    const sourceDir = path.join(CONFIG.sourcePath, sourceVariant);

    if (!fs.existsSync(sourceDir)) {
      console.log(`   ⊘ Skipped ${sourceVariant} (directory not found)`);
      continue;
    }

    const destDir = path.join(CONFIG.destPath, destVariant);
    const files = fs.readdirSync(sourceDir);

    console.log(`   📂 ${sourceVariant} → ${destVariant}/`);

    for (const file of files) {
      try {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);

        // Check if file should be copied
        const ext = path.extname(file).substring(1);
        if (!CONFIG.formats.includes(ext)) {
          continue;
        }

        // Check if file already exists
        if (fs.existsSync(destPath)) {
          const sourceStats = fs.statSync(sourcePath);
          const destStats = fs.statSync(destPath);

          // Skip if destination is newer and same size
          if (destStats.mtime >= sourceStats.mtime && destStats.size === sourceStats.size) {
            skipped++;
            continue;
          }
        }

        // Copy file
        copyFile(sourcePath, destPath);
        const stats = fs.statSync(destPath);
        totalBytes += stats.size;
        copied++;

        // Log progress every 100 files
        if (copied % 100 === 0) {
          console.log(`      ✓ ${copied} files copied...`);
        }

      } catch (error) {
        console.error(`      ✗ Error copying ${file}:`, error.message);
        errors++;
      }
    }
  }

  console.log(`\n📊 Copy complete!`);
  console.log(`   Copied:  ${copied} files (${formatBytes(totalBytes)})`);
  console.log(`   Skipped: ${skipped} files (already up to date)`);
  console.log(`   Errors:  ${errors}\n`);

  // Verify destination
  console.log('✅ Verifying destination...');
  for (const variant of CONFIG.variants) {
    const variantPath = path.join(CONFIG.destPath, variant);
    const count = countFiles(variantPath);
    const size = getDirectorySize(variantPath);
    console.log(`   ${variant}/: ${count} files (${formatBytes(size)})`);
  }

  const totalDestSize = getDirectorySize(CONFIG.destPath);
  const totalDestFiles = countFiles(CONFIG.destPath);

  console.log(`   ---`);
  console.log(`   Total: ${totalDestFiles} files (${formatBytes(totalDestSize)})\n`);

  // Generate report
  const reportPath = path.join(__dirname, '../data/image-copy-report.json');
  ensureDir(path.dirname(reportPath));

  const report = {
    generated: new Date().toISOString(),
    source: CONFIG.sourcePath,
    destination: CONFIG.destPath,
    stats: {
      sourceFiles: sourceFileCount,
      sourceSize: sourceSize,
      copied: copied,
      skipped: skipped,
      errors: errors,
      totalBytes: totalBytes,
      destFiles: totalDestFiles,
      destSize: totalDestSize
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 Report saved to: ${reportPath}\n`);

  console.log('✅ Image copy complete!\n');
  console.log('Next steps:');
  console.log('1. Build Hugo site: cd C:\\Users\\rober\\allo-electricien.pro && hugo');
  console.log('2. Test locally: hugo server');
  console.log('3. Check images load correctly on pages\n');

  return { copied, skipped, errors };
}

// Run if called directly
if (process.argv[1].includes('copy-images-to-hugo')) {
  copyImagesToHugo().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { copyImagesToHugo };
