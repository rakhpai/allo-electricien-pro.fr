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

// Paris pages with their correct postal codes
const PARIS_PAGES = {
  'paris': '75001',
  'paris-1er': '75001',
  'paris-2e': '75002',
  'paris-3e': '75003',
  'paris-4e': '75004',
  'paris-5e': '75005',
  'paris-6e': '75006',
  'paris-7e': '75007',
  'paris-8e': '75008',
  'paris-9e': '75009',
  'paris-10e': '75010',
  'paris-11e': '75011',
  'paris-12e': '75012',
  'paris-13e': '75013',
  'paris-14e': '75014',
  'paris-15e': '75015',
  'paris-16e': '75016',
  'paris-17e': '75017',
  'paris-18e': '75018',
  'paris-19e': '75019',
  'paris-20e': '75020'
};

const CDN_BASE = 'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/video';

/**
 * Generate video CDN paths for a slug
 */
function generateVideoCdnPaths(slug, postalCode) {
  const imageName = `electricien-urgence-${slug}-${postalCode}-video`;

  return {
    avif: `${CDN_BASE}/${imageName}.avif`,
    webp: `${CDN_BASE}/${imageName}.webp`,
    jpg: `${CDN_BASE}/${imageName}.jpg`
  };
}

/**
 * Update Supabase page with video CDN paths
 */
async function updatePageVideoData(slug, postalCode) {
  // Get domain ID first
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
    .eq('url_path', `/${slug}`);

  if (findError) {
    throw new Error(`Failed to find page: ${findError.message}`);
  }

  if (!pages || pages.length === 0) {
    throw new Error(`Page not found: /${slug}`);
  }

  const page = pages[0];
  const currentData = page.data || {};

  // Generate video CDN paths
  const videoCdnPaths = generateVideoCdnPaths(slug, postalCode);

  // Update data object
  const updatedData = {
    ...currentData,
    cdnImages: {
      ...(currentData.cdnImages || {}),
      video: videoCdnPaths
    },
    images: {
      ...(currentData.images || {}),
      video: `electricien-urgence-${slug}-${postalCode}-video`
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
  console.log('🔧 UPDATE PARIS PAGES VIDEO DATA IN SUPABASE');
  console.log('='.repeat(80));
  console.log();

  const results = {
    updated: 0,
    failed: 0,
    total: Object.keys(PARIS_PAGES).length,
    errors: []
  };

  let index = 1;
  for (const [slug, postalCode] of Object.entries(PARIS_PAGES)) {
    console.log(`[${index}/${results.total}] ${slug} (${postalCode})`);

    try {
      const result = await updatePageVideoData(slug, postalCode);

      console.log(`  ✅ Updated page ${result.pageId}`);
      console.log(`  📹 Video URLs:`);
      console.log(`     AVIF: ${result.videoCdnPaths.avif}`);
      console.log(`     WebP: ${result.videoCdnPaths.webp}`);
      console.log(`     JPG:  ${result.videoCdnPaths.jpg}`);

      results.updated++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ slug, error: error.message });
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
      console.log(`  - ${err.slug}: ${err.error}`);
    });
  }

  console.log('\n✅ Database update complete!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
