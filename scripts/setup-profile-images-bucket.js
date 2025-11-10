#!/usr/bin/env node

/**
 * Setup Profile Images Bucket
 * Creates the profile-images storage bucket in Supabase
 * Run this ONCE before generating profile images
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (try root first, then eleclogos)
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupBucket() {
  console.log('🔧 Setting up profile-images bucket...\n');

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw listError;
    }

    const bucketExists = buckets.some(b => b.name === 'profile-images');

    if (bucketExists) {
      console.log('✓ Bucket "profile-images" already exists');
      return;
    }

    // Create the bucket
    const { data, error } = await supabase.storage.createBucket('profile-images', {
      public: true,
      fileSizeLimit: 2097152, // 2MB
      allowedMimeTypes: ['image/jpeg', 'image/webp', 'image/avif', 'image/png']
    });

    if (error) {
      throw error;
    }

    console.log('✅ Successfully created "profile-images" bucket');
    console.log('   - Public access: enabled');
    console.log('   - File size limit: 2MB');
    console.log('   - Allowed types: JPEG, WebP, AVIF, PNG\n');

  } catch (error) {
    console.error('❌ Failed to setup bucket:', error.message);
    console.log('\n📝 Manual Setup Instructions:');
    console.log('   1. Go to Supabase Dashboard → Storage');
    console.log('   2. Click "New Bucket"');
    console.log('   3. Name: profile-images');
    console.log('   4. Public bucket: Yes');
    console.log('   5. File size limit: 2MB');
    console.log('   6. Allowed MIME types: image/jpeg, image/webp, image/avif, image/png');
    process.exit(1);
  }
}

setupBucket();
