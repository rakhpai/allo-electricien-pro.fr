import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

dotenv.config();

console.log('=== GENERATE MULTI-ASPECT-RATIO PROFILE IMAGES ===\n');

//Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10; // Number of profiles to process in test mode

// Image specifications
const ASPECT_RATIOS = {
  '1x1': { width: 900, height: 900, description: 'Square' },
  '4x3': { width: 1200, height: 900, description: 'Landscape' },
  '16x9': { width: 1600, height: 900, description: 'Wide' }
};

// Gradient colors for professional backgrounds
const GRADIENT_COLORS = [
  { start: '#1e3a8a', end: '#3b82f6' }, // Blue gradient
  { start: '#1e40af', end: '#60a5fa' }, // Light blue
  { start: '#0c4a6e', end: '#0ea5e9' }, // Sky blue
  { start: '#115e59', end: '#14b8a6' }, // Teal
  { start: '#1e293b', end: '#475569' }  // Slate
];

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Slugify text for filenames
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error(`   ❌ Error downloading image: ${error.message}`);
    return null;
  }
}

/**
 * Create gradient background
 */
async function createGradientBackground(width, height, gradientIndex) {
  const gradient = GRADIENT_COLORS[gradientIndex % GRADIENT_COLORS.length];

  // Create SVG gradient
  const svg = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${gradient.start};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradient.end};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad1)" />
    </svg>
  `;

  return Buffer.from(svg);
}

/**
 * Generate multi-aspect-ratio images from source avatar
 */
async function generateAspectRatios(sourceBuffer, profile, profileIndex) {
  const results = {};
  const firstName = slugify(profile.first_name || '');
  const lastName = slugify(profile.last_name || '');
  const shortId = profile.id.split('-')[0];

  console.log(`   Generating aspect ratios for ${profile.first_name} ${profile.last_name}...`);

  for (const [ratio, dimensions] of Object.entries(ASPECT_RATIOS)) {
    try {
      let finalBuffer;

      if (ratio === '1x1') {
        // For square, just resize the avatar
        finalBuffer = await sharp(sourceBuffer)
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();

        console.log(`      ✓ ${ratio} (${dimensions.description}): ${dimensions.width}×${dimensions.height}`);
      } else {
        // For landscape/wide, create background with centered avatar

        // First create the gradient background
        const gradientSVG = await createGradientBackground(
          dimensions.width,
          dimensions.height,
          profileIndex
        );

        const background = await sharp(gradientSVG)
          .resize(dimensions.width, dimensions.height)
          .toBuffer();

        // Calculate avatar size (60% of height for better proportion)
        const avatarHeight = Math.round(dimensions.height * 0.6);
        const avatarWidth = avatarHeight; // Keep it square

        // Resize avatar to fit
        const resizedAvatar = await sharp(sourceBuffer)
          .resize(avatarWidth, avatarHeight, {
            fit: 'cover',
            position: 'center'
          })
          .toBuffer();

        // Add slight shadow to avatar for depth
        const avatarWithShadow = await sharp(resizedAvatar)
          .extend({
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .toBuffer();

        // Composite avatar on center of background
        finalBuffer = await sharp(background)
          .composite([{
            input: avatarWithShadow,
            gravity: 'center'
          }])
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();

        console.log(`      ✓ ${ratio} (${dimensions.description}): ${dimensions.width}×${dimensions.height} with gradient`);
      }

      results[ratio] = {
        buffer: finalBuffer,
        filename: `avatar-${firstName}-${lastName}-${shortId}-${ratio}.jpg`,
        size: finalBuffer.length
      };

    } catch (error) {
      console.error(`      ✗ Failed to generate ${ratio}: ${error.message}`);
      results[ratio] = null;
    }
  }

  return results;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToSupabase(buffer, storagePath) {
  if (DRY_RUN) {
    console.log(`      📝 DRY RUN - Would upload to: ${storagePath}`);
    return `https://example.com/dry-run/${storagePath}`;
  }

  try {
    const { error } = await supabase.storage
      .from('profile-images')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1 year
        upsert: true // Overwrite if exists
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (error) {
    console.error(`      ✗ Upload failed: ${error.message}`);
    return null;
  }
}

/**
 * Update database with new image URLs
 */
async function updateDatabaseImageURLs(profileId, imageURLs) {
  if (DRY_RUN) {
    console.log(`      📝 DRY RUN - Would update database for profile ${profileId}`);
    return true;
  }

  try {
    const { error } = await supabase
      .from('electricien_profiles')
      .update({
        avatar_url: imageURLs['1x1'], // Keep backward compatibility
        // Note: You may need to add these columns to your database first
        // avatar_url_1x1: imageURLs['1x1'],
        // avatar_url_4x3: imageURLs['4x3'],
        // avatar_url_16x9: imageURLs['16x9']
      })
      .eq('id', profileId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`      ✗ Database update failed: ${error.message}`);
    return false;
  }
}

/**
 * Process a single profile
 */
async function processProfile(profile, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${profile.first_name} ${profile.last_name}`);
  console.log(`   ID: ${profile.id}`);
  console.log(`   Current avatar: ${profile.avatar_url}`);

  // Download source avatar
  const sourceBuffer = await downloadImage(profile.avatar_url);
  if (!sourceBuffer) {
    console.log(`   ⚠️  Skipping - could not download source image`);
    return {
      success: false,
      profile_id: profile.id,
      error: 'Failed to download source image'
    };
  }

  // Generate all aspect ratios
  const aspectRatioImages = await generateAspectRatios(sourceBuffer, profile, index);

  // Upload to Supabase
  const imageURLs = {};
  let uploadSuccess = true;

  for (const [ratio, imageData] of Object.entries(aspectRatioImages)) {
    if (!imageData) {
      uploadSuccess = false;
      continue;
    }

    const storagePath = `electricien-profiles/${profile.id}/${imageData.filename}`;
    const publicUrl = await uploadToSupabase(imageData.buffer, storagePath);

    if (publicUrl) {
      imageURLs[ratio] = publicUrl;
      const sizeKB = (imageData.size / 1024).toFixed(1);
      console.log(`      ✓ Uploaded ${ratio}: ${sizeKB} KB`);
    } else {
      uploadSuccess = false;
      console.log(`      ✗ Failed to upload ${ratio}`);
    }
  }

  // Update database
  if (uploadSuccess && Object.keys(imageURLs).length === 3) {
    const dbUpdated = await updateDatabaseImageURLs(profile.id, imageURLs);

    if (dbUpdated) {
      console.log(`   ✅ Complete - All 3 aspect ratios generated and uploaded`);
      return {
        success: true,
        profile_id: profile.id,
        imageURLs: imageURLs
      };
    }
  }

  return {
    success: false,
    profile_id: profile.id,
    error: 'Failed to upload or update database'
  };
}

/**
 * Main function
 */
async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be uploaded\n');
  }

  if (TEST_MODE) {
    console.log(`🧪 TEST MODE - Processing only ${TEST_LIMIT} profiles\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: FETCH PROFILES FROM DATABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: profiles, error } = await supabase
    .from('electricien_profiles')
    .select('id, first_name, last_name, avatar_url')
    .order('created_at');

  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
    process.exit(1);
  }

  console.log(`✓ Found ${profiles.length} profiles in database\n`);

  // Apply test mode limit
  const profilesToProcess = TEST_MODE
    ? profiles.slice(0, TEST_LIMIT)
    : profiles;

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('STEP 2: GENERATE & UPLOAD MULTI-ASPECT IMAGES');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Processing ${profilesToProcess.length} profiles...\n`);

  const results = {
    success: [],
    failed: [],
    totalProcessed: 0,
    totalImages: 0,
    totalSizeBytes: 0
  };

  // Process each profile
  for (let i = 0; i < profilesToProcess.length; i++) {
    const result = await processProfile(profilesToProcess[i], i, profilesToProcess.length);
    results.totalProcessed++;

    if (result.success) {
      results.success.push(result);
      results.totalImages += 3; // 3 aspect ratios per profile
    } else {
      results.failed.push(result);
    }

    // Small delay to avoid rate limiting
    if (!DRY_RUN && i < profilesToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const successRate = (results.success.length / results.totalProcessed * 100).toFixed(1);

  console.log(`Total profiles processed:  ${results.totalProcessed}`);
  console.log(`Successful:                ${results.success.length} (${successRate}%)`);
  console.log(`Failed:                    ${results.failed.length}`);
  console.log(`Total images generated:    ${results.totalImages}`);

  if (results.failed.length > 0) {
    console.log('\n⚠️  Failed profiles:');
    results.failed.forEach(f => {
      console.log(`   - ${f.profile_id}: ${f.error}`);
    });
  }

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run flag to actually upload images');
  } else {
    console.log('\n✅ Image generation complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Re-run export script to update JSON with new image URLs');
    console.log('   2. Verify images are accessible in Supabase Storage');
    console.log('   3. Proceed with profile page generation');
  }
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
