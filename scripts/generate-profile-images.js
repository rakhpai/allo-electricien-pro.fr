#!/usr/bin/env node

/**
 * Profile Image Generator
 * Generates customized profile images for electrician profiles
 * - Uses existing hero images (1-342) as base
 * - Adds logo and phone number overlays
 * - Outputs 368x208 JPG images
 * - Uploads to Supabase profile-images bucket
 * - Updates avatar_url in database
 */

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration
const CONFIG = {
  outputWidth: 368,
  outputHeight: 208,
  format: 'jpg',
  quality: 85,
  buckets: {
    source: 'source-images',
    profiles: 'profile-images'
  },
  sourceImageCount: 342,
  logoPath: resolve(__dirname, '../static/eleclogos/logo_1c.svg')
};

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
 * Generate SEO-friendly filename for profile image
 */
function generateProfileFilename(profile) {
  const firstName = slugify(profile.first_name);
  const lastName = slugify(profile.last_name);
  const id = profile.id.split('-')[0];
  return `avatar-${firstName}-${lastName}-${id}.${CONFIG.format}`;
}

/**
 * Get a random source image number (1-342)
 */
function getRandomImageNumber() {
  return Math.floor(Math.random() * CONFIG.sourceImageCount) + 1;
}

/**
 * Fetch all electrician profiles with phone numbers
 */
async function fetchProfiles() {
  console.log('📥 Fetching electrician profiles...\n');

  const { data, error } = await supabase
    .from('electricien_profiles')
    .select(`
      id,
      first_name,
      last_name,
      specialty_primary,
      badge_color,
      phone_number_id,
      created_at
    `)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }

  // Fetch phone numbers separately to avoid join issues
  for (const profile of data) {
    if (profile.phone_number_id) {
      const { data: phoneData } = await supabase
        .from('phone_numbers')
        .select('phone_number_formatted, phone_number_raw')
        .eq('id', profile.phone_number_id)
        .single();

      profile.phone_number = phoneData;
    }
  }

  console.log(`✓ Found ${data.length} profiles\n`);
  return data;
}

/**
 * Download source image from Supabase
 */
async function downloadSourceImage(imageNumber) {
  const imageName = `elec-${String(imageNumber).padStart(3, '0')}.jpg`;
  const storagePath = `electrician/${imageName}`;

  const { data, error } = await supabase.storage
    .from(CONFIG.buckets.source)
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download source image: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Create phone number overlay SVG
 */
function createPhoneOverlay(phoneNumber, width, height) {
  const fontSize = 24;
  const padding = 12;
  const bgHeight = fontSize + (padding * 2);
  const y = height - bgHeight - 10; // 10px from bottom

  return `
    <svg width="${width}" height="${height}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Background rectangle -->
      <rect
        x="0"
        y="${y}"
        width="${width}"
        height="${bgHeight}"
        fill="rgba(0, 0, 0, 0.75)"
        filter="url(#shadow)"
      />

      <!-- Phone number text -->
      <text
        x="${width / 2}"
        y="${y + bgHeight / 2 + fontSize / 3}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#ffffff"
        text-anchor="middle"
      >${phoneNumber}</text>
    </svg>
  `;
}

/**
 * Generate profile image with overlays
 */
async function generateProfileImage(profile, sourceImageBuffer) {
  try {
    const phoneNumber = profile.phone_number?.phone_number_formatted || '01 76 21 30 61';

    // Step 1: Resize source image to target dimensions
    let image = sharp(sourceImageBuffer)
      .resize(CONFIG.outputWidth, CONFIG.outputHeight, {
        fit: 'cover',
        position: 'center'
      });

    // Step 2: Create phone number overlay
    const phoneOverlaySvg = createPhoneOverlay(
      phoneNumber,
      CONFIG.outputWidth,
      CONFIG.outputHeight
    );
    const phoneOverlayBuffer = Buffer.from(phoneOverlaySvg);

    // Step 3: Composite phone overlay onto image
    image = image.composite([
      {
        input: phoneOverlayBuffer,
        top: 0,
        left: 0
      }
    ]);

    // Step 4: Add logo overlay (top-left corner)
    if (await fs.access(CONFIG.logoPath).then(() => true).catch(() => false)) {
      const logoBuffer = await sharp(CONFIG.logoPath)
        .resize(80, null, { withoutEnlargement: true })
        .png()
        .toBuffer();

      image = image.composite([
        {
          input: logoBuffer,
          top: 10,
          left: 10
        }
      ]);
    }

    // Step 5: Export as JPG
    const outputBuffer = await image
      .jpeg({ quality: CONFIG.quality, progressive: true })
      .toBuffer();

    return outputBuffer;

  } catch (error) {
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

/**
 * Upload image to Supabase and get public URL
 */
async function uploadProfileImage(profile, imageBuffer, filename) {
  const storagePath = `electricien-profiles/${profile.id}/${filename}`;

  // Upload the image
  const { data, error } = await supabase.storage
    .from(CONFIG.buckets.profiles)
    .upload(storagePath, imageBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 year
      upsert: true
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(CONFIG.buckets.profiles)
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

/**
 * Update profile avatar_url in database
 */
async function updateProfileAvatar(profileId, avatarUrl) {
  const { error } = await supabase
    .from('electricien_profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Process a single profile
 */
async function processProfile(profile, index, total) {
  const startTime = Date.now();
  const profileName = `${profile.first_name} ${profile.last_name}`;

  console.log(`[${index + 1}/${total}] Processing ${profileName}...`);

  try {
    // Step 1: Select random source image
    const imageNumber = getRandomImageNumber();
    console.log(`  ↳ Using source image #${imageNumber}`);

    // Step 2: Download source image
    const sourceImageBuffer = await downloadSourceImage(imageNumber);
    console.log(`  ↳ Downloaded source image`);

    // Step 3: Generate profile image
    const profileImageBuffer = await generateProfileImage(profile, sourceImageBuffer);
    console.log(`  ↳ Generated image (${(profileImageBuffer.length / 1024).toFixed(1)} KB)`);

    // Step 4: Upload to Supabase
    const filename = generateProfileFilename(profile);
    const publicUrl = await uploadProfileImage(profile, profileImageBuffer, filename);
    console.log(`  ↳ Uploaded to ${publicUrl}`);

    // Step 5: Update database
    await updateProfileAvatar(profile.id, publicUrl);
    console.log(`  ↳ Updated database`);

    const duration = Date.now() - startTime;
    console.log(`  ✅ Completed in ${duration}ms\n`);

    return {
      success: true,
      profile: profileName,
      imageNumber,
      publicUrl,
      fileSize: profileImageBuffer.length,
      duration
    };

  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}\n`);
    return {
      success: false,
      profile: profileName,
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎨 Profile Image Generator\n');
  console.log(`Configuration:`);
  console.log(`  - Output size: ${CONFIG.outputWidth}x${CONFIG.outputHeight}`);
  console.log(`  - Format: ${CONFIG.format.toUpperCase()}`);
  console.log(`  - Quality: ${CONFIG.quality}%`);
  console.log(`  - Bucket: ${CONFIG.buckets.profiles}\n`);

  try {
    // Fetch all profiles
    const profiles = await fetchProfiles();

    if (profiles.length === 0) {
      console.log('⚠️  No profiles found');
      return;
    }

    // Process each profile
    const results = [];
    for (let i = 0; i < profiles.length; i++) {
      const result = await processProfile(profiles[i], i, profiles.length);
      results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);

    if (successful.length > 0) {
      const totalSize = successful.reduce((sum, r) => sum + r.fileSize, 0);
      const avgSize = totalSize / successful.length;
      const totalDuration = successful.reduce((sum, r) => sum + r.duration, 0);
      const avgDuration = totalDuration / successful.length;

      console.log(`\n📈 Statistics:`);
      console.log(`  - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Avg size: ${(avgSize / 1024).toFixed(1)} KB`);
      console.log(`  - Total time: ${(totalDuration / 1000).toFixed(1)}s`);
      console.log(`  - Avg time: ${avgDuration.toFixed(0)}ms per image`);
    }

    if (failed.length > 0) {
      console.log(`\n❌ Failed profiles:`);
      failed.forEach(r => {
        console.log(`  - ${r.profile}: ${r.error}`);
      });
    }

    console.log('\n✅ Generation complete!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
