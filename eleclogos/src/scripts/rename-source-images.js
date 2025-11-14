/**
 * Rename Source Images
 * Renames Depositphotos_*.jpg files to elec-001.jpg through elec-342.jpg
 * Creates mapping file for reference and handles missing image
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { imageHelper } from '../utils/image-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../../elecphotos'),
  backupDir: path.join(__dirname, '../../elecphotos_backup'),
  expectedCount: 342,
  outputFormat: 'jpg',
  mappingPath: path.join(__dirname, '../data/depositphotos-to-elec-mapping.json'),
  dryRun: false // Set to true to preview without renaming
};

/**
 * Scan directory for Depositphotos files
 */
function scanDepositphotosFiles() {
  console.log(`📂 Scanning source directory: ${CONFIG.sourceDir}\n`);

  if (!fs.existsSync(CONFIG.sourceDir)) {
    throw new Error(`Source directory not found: ${CONFIG.sourceDir}`);
  }

  const files = fs.readdirSync(CONFIG.sourceDir);

  // Filter for Depositphotos images
  const depositphotosFiles = files.filter(file => {
    return file.match(/^Depositphotos_\d+.*\.(jpg|jpeg|png)$/i);
  });

  console.log(`✓ Found ${depositphotosFiles.length} Depositphotos images`);

  // Also check for any elec-XXX files that might already exist
  const elecFiles = files.filter(file => {
    return file.match(/^elec-\d{3}\.(jpg|jpeg|png)$/i);
  });

  if (elecFiles.length > 0) {
    console.log(`⚠️  Found ${elecFiles.length} files already in elec-XXX format`);
    console.log(`   These will be skipped to avoid conflicts\n`);
  }

  return {
    depositphotos: depositphotosFiles.sort(),
    existing: elecFiles.sort(),
    total: depositphotosFiles.length + elecFiles.length
  };
}

/**
 * Create mapping from Depositphotos to elec-XXX
 */
function createMapping(files) {
  console.log('\n📋 Creating Depositphotos → elec-XXX mapping...\n');

  const mapping = [];
  let elecNumber = 1;

  // Map Depositphotos files
  files.depositphotos.forEach((filename, index) => {
    // Skip elec numbers that already exist
    while (files.existing.some(f => f.startsWith(`elec-${String(elecNumber).padStart(3, '0')}`))) {
      console.log(`   Skipping elec-${String(elecNumber).padStart(3, '0')} (already exists)`);
      elecNumber++;
    }

    const newFilename = `elec-${String(elecNumber).padStart(3, '0')}.jpg`;

    mapping.push({
      original: filename,
      renamed: newFilename,
      elecNumber: elecNumber,
      index: index + 1
    });

    elecNumber++;
  });

  console.log(`✓ Created ${mapping.length} mappings`);

  // Check for gaps
  const assignedNumbers = mapping.map(m => m.elecNumber);
  const gaps = [];

  for (let i = 1; i <= CONFIG.expectedCount; i++) {
    const existsInMapping = assignedNumbers.includes(i);
    const existsInElecFiles = files.existing.some(f => f.startsWith(`elec-${String(i).padStart(3, '0')}`));

    if (!existsInMapping && !existsInElecFiles) {
      gaps.push(i);
    }
  }

  if (gaps.length > 0) {
    console.log(`\n⚠️  Missing elec numbers (${gaps.length}):`, gaps.join(', '));
  }

  return {
    mapping,
    gaps,
    totalAfterRename: mapping.length + files.existing.length
  };
}

/**
 * Save mapping to JSON file
 */
function saveMapping(mappingData, files) {
  console.log(`\n💾 Saving mapping to: ${CONFIG.mappingPath}\n`);

  const mappingFile = {
    created: new Date().toISOString(),
    source_directory: CONFIG.sourceDir,
    total_depositphotos_files: files.depositphotos.length,
    total_existing_elec_files: files.existing.length,
    total_after_rename: mappingData.totalAfterRename,
    expected_total: CONFIG.expectedCount,
    missing_count: mappingData.gaps.length,
    missing_numbers: mappingData.gaps,
    mappings: mappingData.mapping,
    existing_elec_files: files.existing
  };

  // Ensure directory exists
  const dir = path.dirname(CONFIG.mappingPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.mappingPath, JSON.stringify(mappingFile, null, 2), 'utf8');

  console.log('✓ Mapping saved successfully\n');

  return mappingFile;
}

/**
 * Create backup of source directory
 */
function createBackup() {
  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN: Skipping backup creation\n');
    return false;
  }

  console.log(`\n💼 Creating backup directory: ${CONFIG.backupDir}\n`);

  if (fs.existsSync(CONFIG.backupDir)) {
    console.log('⚠️  Backup directory already exists. Skipping backup creation.');
    console.log('   Delete the backup directory if you want a fresh backup.\n');
    return false;
  }

  try {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });

    // Copy all files to backup
    const files = fs.readdirSync(CONFIG.sourceDir);
    let copiedCount = 0;

    for (const file of files) {
      const sourcePath = path.join(CONFIG.sourceDir, file);
      const backupPath = path.join(CONFIG.backupDir, file);

      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, backupPath);
        copiedCount++;
      }
    }

    console.log(`✓ Backed up ${copiedCount} files\n`);
    return true;

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    return false;
  }
}

/**
 * Rename files according to mapping
 */
function renameFiles(mappingData) {
  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be renamed\n');
    console.log('Preview of renames:\n');
    mappingData.mapping.slice(0, 10).forEach(m => {
      console.log(`   ${m.original} → ${m.renamed}`);
    });
    if (mappingData.mapping.length > 10) {
      console.log(`   ... and ${mappingData.mapping.length - 10} more\n`);
    }
    return { success: 0, failed: 0 };
  }

  console.log(`\n🔄 Renaming ${mappingData.mapping.length} files...\n`);

  let success = 0;
  let failed = 0;
  const errors = [];

  for (const item of mappingData.mapping) {
    const oldPath = path.join(CONFIG.sourceDir, item.original);
    const newPath = path.join(CONFIG.sourceDir, item.renamed);

    try {
      // Check if source exists
      if (!fs.existsSync(oldPath)) {
        throw new Error('Source file not found');
      }

      // Check if destination already exists
      if (fs.existsSync(newPath)) {
        throw new Error('Destination file already exists');
      }

      // Rename the file
      fs.renameSync(oldPath, newPath);

      success++;

      // Progress update every 50 files
      if (success % 50 === 0) {
        console.log(`   Progress: ${success}/${mappingData.mapping.length}`);
      }

    } catch (error) {
      failed++;
      errors.push({
        original: item.original,
        renamed: item.renamed,
        error: error.message
      });
      console.error(`   ✗ Failed: ${item.original} → ${item.renamed}: ${error.message}`);
    }
  }

  console.log(`\n✓ Rename complete:`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed:  ${failed}\n`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log('❌ Errors:');
    errors.forEach(err => {
      console.log(`   ${err.original}: ${err.error}`);
    });
    console.log();
  }

  return { success, failed, errors };
}

/**
 * Handle missing images
 */
function handleMissingImages(mappingFile) {
  if (mappingFile.missing_count === 0) {
    console.log('✅ No missing images - complete set of 342!\n');
    return;
  }

  console.log(`\n⚠️  Handling ${mappingFile.missing_count} missing image(s)...\n`);

  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN: Would create placeholder(s) for:', mappingFile.missing_numbers.join(', '));
    return;
  }

  // Option: Duplicate elec-001 for missing numbers
  const sourceFile = path.join(CONFIG.sourceDir, 'elec-001.jpg');

  if (!fs.existsSync(sourceFile)) {
    console.log('❌ Cannot create placeholders: elec-001.jpg not found');
    return;
  }

  for (const missingNumber of mappingFile.missing_numbers) {
    const placeholderFile = path.join(CONFIG.sourceDir, `elec-${String(missingNumber).padStart(3, '0')}.jpg`);

    try {
      fs.copyFileSync(sourceFile, placeholderFile);
      console.log(`   ✓ Created placeholder: elec-${String(missingNumber).padStart(3, '0')}.jpg`);
    } catch (error) {
      console.error(`   ✗ Failed to create placeholder for ${missingNumber}:`, error.message);
    }
  }

  console.log();
}

/**
 * Verify rename results
 */
function verifyRename() {
  console.log('🔍 Verifying rename results...\n');

  const files = fs.readdirSync(CONFIG.sourceDir);

  const elecFiles = files.filter(file => {
    return file.match(/^elec-\d{3}\.(jpg|jpeg|png)$/i);
  }).sort();

  console.log(`✓ Found ${elecFiles.length} files in elec-XXX format\n`);

  // Check for complete sequence
  const gaps = [];
  for (let i = 1; i <= CONFIG.expectedCount; i++) {
    const filename = `elec-${String(i).padStart(3, '0')}.jpg`;
    if (!elecFiles.includes(filename)) {
      gaps.push(i);
    }
  }

  if (gaps.length === 0) {
    console.log('✅ Perfect! Complete sequence 1-342 with no gaps\n');
  } else {
    console.log(`⚠️  Missing ${gaps.length} files:`, gaps.slice(0, 20).join(', '));
    if (gaps.length > 20) {
      console.log(`   ... and ${gaps.length - 20} more\n`);
    }
  }

  // Calculate total size
  let totalBytes = 0;
  for (const file of elecFiles) {
    const filePath = path.join(CONFIG.sourceDir, file);
    const stats = fs.statSync(filePath);
    totalBytes += stats.size;
  }

  console.log(`📊 Total size: ${imageHelper.formatFileSize(totalBytes)}\n`);

  return {
    totalFiles: elecFiles.length,
    gaps,
    totalBytes
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RENAME SOURCE IMAGES: DEPOSITPHOTOS → ELEC-XXX');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Source directory: ${CONFIG.sourceDir}`);
  console.log(`Expected count: ${CONFIG.expectedCount} images`);
  console.log(`Dry run mode: ${CONFIG.dryRun ? 'YES (preview only)' : 'NO (will rename)'}\n`);

  try {
    // Step 1: Scan files
    const files = scanDepositphotosFiles();

    if (files.depositphotos.length === 0 && files.existing.length === 0) {
      console.error('\n❌ No image files found in source directory');
      process.exit(1);
    }

    if (files.depositphotos.length === 0) {
      console.log('\n✅ All files already in elec-XXX format');
      console.log(`   Total: ${files.existing.length} files\n`);

      // Verify completeness
      await verifyRename();
      return;
    }

    // Step 2: Create mapping
    const mappingData = createMapping(files);

    // Step 3: Save mapping
    const mappingFile = saveMapping(mappingData, files);

    // Step 4: Create backup (if not dry run)
    if (!CONFIG.dryRun) {
      createBackup();
    }

    // Step 5: Rename files
    const renameResult = renameFiles(mappingData);

    if (CONFIG.dryRun) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  DRY RUN COMPLETE - NO FILES RENAMED');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('To perform actual rename, set CONFIG.dryRun = false\n');
      return;
    }

    if (renameResult.success === 0) {
      console.error('\n❌ No files were renamed successfully');
      process.exit(1);
    }

    // Step 6: Handle missing images
    handleMissingImages(mappingFile);

    // Step 7: Verify results
    const verification = verifyRename();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ RENAME COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Results:');
    console.log(`  Renamed: ${renameResult.success} files`);
    console.log(`  Failed:  ${renameResult.failed} files`);
    console.log(`  Total elec-XXX files: ${verification.totalFiles}`);
    console.log(`  Missing: ${verification.gaps.length} files`);
    console.log(`  Total size: ${imageHelper.formatFileSize(verification.totalBytes)}\n`);

    console.log('Next steps:');
    console.log('1. Review mapping file: data/depositphotos-to-elec-mapping.json');
    console.log('2. Verify renamed files in elecphotos/ directory');
    console.log('3. Run upload-source-images.js to upload to Supabase');
    console.log('4. Backup directory preserved at: elecphotos_backup/\n');

  } catch (error) {
    console.error('\n❌ Rename failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Check for --dry-run flag
  if (process.argv.includes('--dry-run')) {
    CONFIG.dryRun = true;
  }

  // Check for --execute flag
  if (process.argv.includes('--execute')) {
    CONFIG.dryRun = false;
  }

  main();
}

export { main as renameSourceImages };
