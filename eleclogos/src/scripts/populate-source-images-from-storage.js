import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import cliProgress from 'cli-progress';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('POPULATE SOURCE_IMAGES TABLE FROM STORAGE');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Populate source_images table from Supabase storage
 */
async function populateDatabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Step 1: List files in source-images bucket\n');

  // List all source images
  const { data: files, error: listError } = await supabase.storage
    .from('source-images')
    .list('electrician', {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (listError) {
    console.error('❌ Failed to list files:', listError.message);
    process.exit(1);
  }

  const imageFiles = files.filter(f => f.name.match(/^elec-\d{3}\.(jpg|jpeg|png)$/i));

  console.log(`Found ${imageFiles.length} source images\n`);

  console.log('Step 2: Extract metadata and populate database\n');

  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} | {filename}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  progressBar.start(imageFiles.length, 0, { filename: 'Starting...' });

  const results = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    errors: []
  };

  for (const file of imageFiles) {
    try {
      // Parse image number from filename
      const match = file.name.match(/elec-(\d{3})/);
      if (!match) {
        results.errors.push({ file: file.name, error: 'Cannot parse image number' });
        continue;
      }

      const imageNumber = parseInt(match[1]);

      // Check if already exists
      const { data: existing } = await supabase
        .from('source_images')
        .select('id')
        .eq('image_number', imageNumber)
        .single();

      if (existing) {
        results.skipped++;
        progressBar.update(results.processed + 1, { filename: file.name });
        results.processed++;
        continue;
      }

      // Download image to get metadata
      const { data: imageBlob, error: downloadError } = await supabase.storage
        .from('source-images')
        .download(`electrician/${file.name}`);

      if (downloadError) {
        results.errors.push({ file: file.name, error: downloadError.message });
        progressBar.update(results.processed + 1, { filename: file.name });
        results.processed++;
        continue;
      }

      // Get image metadata using Sharp
      const buffer = Buffer.from(await imageBlob.arrayBuffer());
      const metadata = await sharp(buffer).metadata();

      // Prepare database record
      const record = {
        filename: file.name,
        image_number: imageNumber,
        storage_path: `electrician/${file.name}`,
        storage_bucket: 'source-images',
        file_size: file.metadata?.size || buffer.length,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format || 'jpeg',
        mime_type: metadata.format === 'png' ? 'image/png' : 'image/jpeg',
        metadata: {
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha
        },
        uploaded_at: file.created_at || new Date().toISOString()
      };

      // Insert into database
      const { error: insertError } = await supabase
        .from('source_images')
        .insert([record]);

      if (insertError) {
        results.errors.push({ file: file.name, error: insertError.message });
      } else {
        results.inserted++;
      }

      results.processed++;
      progressBar.update(results.processed, { filename: file.name });

    } catch (error) {
      results.errors.push({ file: file.name, error: error.message });
      results.processed++;
      progressBar.update(results.processed, { filename: file.name });
    }
  }

  progressBar.stop();

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Processed: ${results.processed}`);
  console.log(`  Inserted:  ${results.inserted}`);
  console.log(`  Skipped:   ${results.skipped} (already exist)`);
  console.log(`  Errors:    ${results.errors.length}`);
  console.log('');

  if (results.errors.length > 0) {
    console.log('Errors:');
    results.errors.slice(0, 10).forEach(e => {
      console.log(`  • ${e.file}: ${e.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more\n`);
    }
  }

  // Verify final count
  const { count } = await supabase
    .from('source_images')
    .select('*', { count: 'exact', head: true });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total records in source_images table: ${count}`);

  if (count === 342) {
    console.log('\n✅ All 342 source images in database!');
  } else {
    console.log(`\n⚠️  Expected 342, found ${count}`);
  }

  console.log('\nNext steps:');
  console.log('  1. ✅ Ready to generate image variants');
  console.log('  2. Run: node src/scripts/generate-all-seo-variants-local.js\n');

  console.log('═══════════════════════════════════════════════════════════\n');
}

populateDatabase().catch(error => {
  console.error('\n❌ Population failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
