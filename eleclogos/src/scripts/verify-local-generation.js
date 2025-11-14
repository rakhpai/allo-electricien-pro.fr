import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════');
console.log('VERIFY LOCAL GENERATION');
console.log('═══════════════════════════════════════════════════════════\n');

const CONFIG = {
  outputDir: path.resolve(__dirname, '../../generated/allo-electricien.pro'),
  variantTypes: ['hero', 'og', 'featured', 'video'],
  formats: ['jpg', 'webp', 'avif'],
  expectedTotal: 1366 * 4 * 3 // 16,392 files
};

async function verify() {
  console.log(`Checking directory: ${CONFIG.outputDir}\n`);

  const report = {
    timestamp: new Date().toISOString(),
    by_type: {},
    by_format: {},
    total_files: 0,
    total_size: 0,
    sample_files: [],
    issues: []
  };

  // Check each variant type directory
  for (const variantType of CONFIG.variantTypes) {
    const variantDir = path.join(CONFIG.outputDir, variantType);

    try {
      const files = await fs.readdir(variantDir);
      const imageFiles = files.filter(f => f.match(/\.(jpg|webp|avif)$/i));

      report.by_type[variantType] = imageFiles.length;
      report.total_files += imageFiles.length;

      // Count by format
      for (const format of CONFIG.formats) {
        const formatFiles = imageFiles.filter(f => f.endsWith(`.${format}`));
        report.by_format[format] = (report.by_format[format] || 0) + formatFiles.length;
      }

      // Get total size
      for (const file of imageFiles.slice(0, 100)) { // Sample first 100
        const filePath = path.join(variantDir, file);
        const stats = await fs.stat(filePath);
        report.total_size += stats.size;
      }

      // Sample files
      if (imageFiles.length > 0 && report.sample_files.length < 10) {
        const sample = imageFiles[0];
        const samplePath = path.join(variantDir, sample);
        const stats = await fs.stat(samplePath);
        report.sample_files.push({
          type: variantType,
          filename: sample,
          size: stats.size,
          size_kb: (stats.size / 1024).toFixed(1)
        });
      }

      console.log(`${variantType.padEnd(10)}: ${imageFiles.length} files`);

    } catch (error) {
      report.issues.push({
        type: variantType,
        error: error.message
      });
      console.log(`${variantType.padEnd(10)}: ERROR - ${error.message}`);
    }
  }

  console.log(`\nTotal: ${report.total_files} files\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('BY FORMAT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  Object.entries(report.by_format).forEach(([format, count]) => {
    const expected = 1366 * 4; // 1366 pages × 4 types
    const percent = ((count / expected) * 100).toFixed(1);
    console.log(`${format.toUpperCase().padEnd(6)}: ${count}/${expected} (${percent}%)`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SAMPLE FILES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  report.sample_files.forEach(f => {
    console.log(`${f.type.padEnd(10)}: ${f.filename} (${f.size_kb} KB)`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const completeness = ((report.total_files / CONFIG.expectedTotal) * 100).toFixed(1);
  const estimatedTotalGB = ((report.total_size / 100) * report.total_files / 1024 / 1024 / 1024).toFixed(2);

  console.log(`Files generated:    ${report.total_files}/${CONFIG.expectedTotal} (${completeness}%)`);
  console.log(`Estimated total size: ~${estimatedTotalGB} GB`);

  if (report.total_files === CONFIG.expectedTotal) {
    console.log('\n✅ All files generated successfully!');
  } else if (report.total_files > 0) {
    console.log(`\n⏳ Generation in progress (${completeness}% complete)`);
  } else {
    console.log('\n⚠️  No files found - generation not started');
  }

  if (report.issues.length > 0) {
    console.log(`\n⚠️  ${report.issues.length} issues found:`);
    report.issues.forEach(i => {
      console.log(`  • ${i.type}: ${i.error}`);
    });
  }

  // Save report
  const reportPath = path.resolve(__dirname, '../../local-generation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved: local-generation-report.json\n`);

  if (report.total_files === CONFIG.expectedTotal) {
    console.log('Next steps:');
    console.log('  1. ✅ Ready to upload to Supabase');
    console.log('  2. Run: node src/scripts/batch-upload-variants.js\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

verify().catch(error => {
  console.error('\n❌ Verification failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
