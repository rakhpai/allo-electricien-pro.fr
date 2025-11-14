import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Paris pages with correct image slugs (without "e" suffix)
const PARIS_PAGES = {
  'paris': { imageSlug: 'paris', postalCode: '75001' },
  'paris-1er': { imageSlug: 'paris-1', postalCode: '75001' },
  'paris-2e': { imageSlug: 'paris-2', postalCode: '75002' },
  'paris-3e': { imageSlug: 'paris-3', postalCode: '75003' },
  'paris-4e': { imageSlug: 'paris-4', postalCode: '75004' },
  'paris-5e': { imageSlug: 'paris-5', postalCode: '75005' },
  'paris-6e': { imageSlug: 'paris-6', postalCode: '75006' },
  'paris-7e': { imageSlug: 'paris-7', postalCode: '75007' },
  'paris-8e': { imageSlug: 'paris-8', postalCode: '75008' },
  'paris-9e': { imageSlug: 'paris-9', postalCode: '75009' },
  'paris-10e': { imageSlug: 'paris-10', postalCode: '75010' },
  'paris-11e': { imageSlug: 'paris-11', postalCode: '75011' },
  'paris-12e': { imageSlug: 'paris-12', postalCode: '75012' },
  'paris-13e': { imageSlug: 'paris-13', postalCode: '75013' },
  'paris-14e': { imageSlug: 'paris-14', postalCode: '75014' },
  'paris-15e': { imageSlug: 'paris-15', postalCode: '75015' },
  'paris-16e': { imageSlug: 'paris-16', postalCode: '75016' },
  'paris-17e': { imageSlug: 'paris-17', postalCode: '75017' },
  'paris-18e': { imageSlug: 'paris-18', postalCode: '75018' },
  'paris-19e': { imageSlug: 'paris-19', postalCode: '75019' },
  'paris-20e': { imageSlug: 'paris-20', postalCode: '75020' }
};

const CDN_BASE = 'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/video';

/**
 * Generate video CDN paths for Sharp-generated images
 */
function generateVideoCdnPaths(imageSlug, postalCode) {
  const imageName = `electricien-urgence-${imageSlug}-${postalCode}-video`;

  return {
    avif: `${CDN_BASE}/${imageName}.avif`,
    webp: `${CDN_BASE}/${imageName}.webp`,
    jpg: `${CDN_BASE}/${imageName}.jpg`
  };
}

/**
 * Update Supabase page with corrected video CDN paths
 */
async function updatePageVideoData(pageSlug, imageSlug, postalCode) {
  // Get domain ID
  const { data: domain, error: domainError } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  if (domainError || !domain) {
    throw new Error(`Failed to get domain: ${domainError?.message}`);
  }

  // Find the page
  const { data: pages, error: findError } = await supabase
    .from('pages')
    .select('id, url_path, data')
    .eq('domain_id', domain.id)
    .eq('url_path', `/${pageSlug}`);

  if (findError) {
    throw new Error(`Failed to find page: ${findError.message}`);
  }

  if (!pages || pages.length === 0) {
    throw new Error(`Page not found: /${pageSlug}`);
  }

  const page = pages[0];
  const currentData = page.data || {};

  // Generate video CDN paths with correct slug
  const videoCdnPaths = generateVideoCdnPaths(imageSlug, postalCode);

  // Update data object
  const updatedData = {
    ...currentData,
    cdnImages: {
      ...(currentData.cdnImages || {}),
      video: videoCdnPaths
    },
    images: {
      ...(currentData.images || {}),
      video: `electricien-urgence-${imageSlug}-${postalCode}-video`
    }
  };

  // Update in database
  const { error: updateError } = await supabase
    .from('pages')
    .update({ data: updatedData })
    .eq('id', page.id);

  if (updateError) {
    throw new Error(`Failed to update page: ${updateError.message}`);
  }

  return { pageId: page.id, videoCdnPaths };
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 UPDATE PARIS PAGES VIDEO SLUGS IN SUPABASE');
  console.log('='.repeat(80));
  console.log('Updating to match Sharp-generated image names (paris-X format)');
  console.log('='.repeat(80));
  console.log();

  const results = {
    updated: 0,
    failed: 0,
    total: Object.keys(PARIS_PAGES).length,
    errors: []
  };

  let index = 1;
  for (const [pageSlug, config] of Object.entries(PARIS_PAGES)) {
    console.log(`[${index}/${results.total}] ${pageSlug} → ${config.imageSlug} (${config.postalCode})`);

    try {
      const result = await updatePageVideoData(pageSlug, config.imageSlug, config.postalCode);

      console.log(`  ✅ Updated page ${result.pageId}`);
      console.log(`  📹 Video URLs:`);
      console.log(`     JPG:  ${result.videoCdnPaths.jpg}`);

      results.updated++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ pageSlug, error: error.message });
    }

    console.log();
    index++;
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Paris pages: ${results.total}`);
  console.log(`✅ Updated: ${results.updated}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(80));

  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach(err => {
      console.log(`  - ${err.pageSlug}: ${err.error}`);
    });
  }

  console.log('\n✅ Database update complete!');
  console.log('\nNext: Verify video image URLs are accessible');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
