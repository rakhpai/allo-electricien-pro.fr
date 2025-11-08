require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== EXPORT VIDEOS FROM SUPABASE ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = TEST_MODE ? 10 : null;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Will only process ${TEST_LIMIT} videos\n`);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Slug mismatch mappings (video slugs → city slugs)
 * These handle apostrophe and special character differences
 */
const SLUG_MAPPINGS = {
  'letang-la-ville': 'l-etang-la-ville',
  'lisle-adam': 'l-isle-adam',
  'bois-darcy': 'bois-d-arcy',
  'saint-ouen-laumone': 'saint-ouen-l-aumone',
  'saint-cyr-lecole': 'saint-cyr-l-ecole',
  'ville-davray': 'ville-d-avray',
  'montfort-lamaury': 'montfort-l-amaury'
};

/**
 * Extract city slug from SEO filename
 * e.g., "electricien-paris-75.mp4" → "paris"
 */
function extractCitySlug(seoFilename) {
  if (!seoFilename) return null;

  // Remove extension and "electricien-" prefix
  const basename = seoFilename.replace(/\.(mp4|webm)$/i, '');
  const withoutPrefix = basename.replace(/^electricien-/, '');

  // Remove department suffix (e.g., "-75")
  const slug = withoutPrefix.replace(/-\d{2,3}(-compressed)?$/, '');

  // Apply slug mapping if exists
  return SLUG_MAPPINGS[slug] || slug;
}

/**
 * Convert seconds to ISO 8601 duration format
 * e.g., 32.96 → "PT32S"
 */
function secondsToISO8601Duration(seconds) {
  if (!seconds) return null;
  const roundedSeconds = Math.round(seconds);
  return `PT${roundedSeconds}S`;
}

/**
 * Ensure path starts with leading slash for absolute URL
 * e.g., "videos-downloaded/file.mp4" → "/videos-downloaded/file.mp4"
 */
function ensureLeadingSlash(path) {
  if (!path) return null;
  return path.startsWith('/') ? path : '/' + path;
}

/**
 * Transform video data to Hugo-compatible format
 */
function transformVideo(video) {
  const citySlug = extractCitySlug(video.seo_filename);

  // Parse video formats JSON
  let formats = {
    webm: null,
    mp4: null,
    compressed_mp4: null
  };

  if (video.video_formats && typeof video.video_formats === 'object') {
    formats.webm = video.video_formats.webm || null;
    formats.mp4 = video.video_formats.original || null;
    formats.compressed_mp4 = video.video_formats.compressed || null;
  }

  return {
    // City identification
    city_slug: citySlug,
    city_name: video.commune_name,
    department: video.commune_department,
    commune_code: video.commune_code,

    // Video files (absolute paths with leading slash)
    video_webm: ensureLeadingSlash(formats.webm),
    video_mp4: ensureLeadingSlash(formats.mp4),
    video_mp4_compressed: ensureLeadingSlash(formats.compressed_mp4),

    // Video metadata
    seo_filename: video.seo_filename,
    duration_seconds: video.duration,
    duration_iso: secondsToISO8601Duration(video.duration),

    // File sizes (in bytes)
    file_size_original: video.file_size_original,
    file_size_compressed: video.file_size_compressed,

    // Content
    voiceover_script: video.voiceover_script, // For SEO transcript

    // Audio URLs (Supabase storage)
    voiceover_audio_url: video.voiceover_audio_url,
    intro_audio_url: video.intro_audio_url,
    full_audio_url: video.full_audio_url,

    // Business info
    phone_number: video.phone_number,
    years_of_service: video.years_of_service,
    average_rating: video.average_rating,
    review_count: video.review_count,
    certifications: video.certifications,

    // Variants (for A/B testing context)
    intro_variant: video.intro_variant,
    cta_variant: video.cta_variant,

    // Dates
    created_at: video.created_at,
    render_completed_at: video.render_completed_at,

    // Status
    status: video.video_status,
    processing_status: video.processing_status
  };
}

/**
 * Main export function
 */
async function exportVideos() {
  const stats = {
    videos_fetched: 0,
    videos_exported: 0,
    slug_mappings_applied: 0,
    videos_without_city: 0,
    errors: []
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: FETCH VIDEOS FROM SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch all videos using pagination
  let videos = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('video_status', 'completed')  // Only completed videos
      .eq('downloaded', true)           // Only downloaded videos
      .order('commune_name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (videosError) {
      console.error('❌ Error fetching videos:', videosError.message);
      process.exit(1);
    }

    if (pageData && pageData.length > 0) {
      videos = videos.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
      console.log(`  Fetched page ${page}: ${pageData.length} videos (total: ${videos.length})`);
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✓ Found ${videos.length} videos in database\n`);
  stats.videos_fetched = videos.length;

  // Limit videos in test mode
  const videosToProcess = TEST_MODE ? videos.slice(0, TEST_LIMIT) : videos;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: TRANSFORM VIDEO DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const communeVideos = {};
  const videosByCitySlug = {};

  for (const video of videosToProcess) {
    try {
      const transformed = transformVideo(video);

      if (!transformed.city_slug) {
        stats.videos_without_city++;
        console.log(`  ⚠️  No city slug for: ${video.seo_filename}`);
        continue;
      }

      // Check if slug mapping was applied
      const originalSlug = extractCitySlug(video.seo_filename);
      if (SLUG_MAPPINGS[originalSlug]) {
        stats.slug_mappings_applied++;
        console.log(`  🔄 Mapped: ${originalSlug} → ${transformed.city_slug}`);
      }

      // Store video by city slug
      videosByCitySlug[transformed.city_slug] = transformed;
      stats.videos_exported++;

      if (stats.videos_exported <= 10 || stats.videos_exported % 50 === 0) {
        console.log(`  ✓ ${transformed.city_name} (${transformed.city_slug})`);
      }

    } catch (error) {
      stats.errors.push({
        video: video.seo_filename,
        city: video.commune_name,
        error: error.message
      });

      if (stats.errors.length <= 5) {
        console.log(`  ❌ ${video.commune_name}: ${error.message}`);
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: WRITE TO FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const outputPath = path.join(__dirname, '..', 'data', 'commune_videos.json');

  if (DRY_RUN) {
    console.log('📝 DRY RUN - Would write to:', outputPath);
    console.log(`   Sample data for first video: ${Object.keys(videosByCitySlug)[0]}`);
    console.log(JSON.stringify(videosByCitySlug[Object.keys(videosByCitySlug)[0]], null, 2));
  } else {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(videosByCitySlug, null, 2), 'utf8');
    console.log(`✓ Successfully wrote to: ${outputPath}`);

    // Get file size
    const fileStats = fs.statSync(outputPath);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);
    console.log(`  File size: ${fileSizeKB} KB`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EXPORT COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Statistics:');
  console.log(`  Videos fetched:            ${stats.videos_fetched}`);
  console.log(`  Videos exported:           ${stats.videos_exported}`);
  console.log(`  Slug mappings applied:     ${stats.slug_mappings_applied}`);
  console.log(`  Videos without city slug:  ${stats.videos_without_city}`);
  console.log(`  Errors:                    ${stats.errors.length}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`Errors (showing first 10 of ${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.city} (${err.video}): ${err.error}`);
    });

    // Save full error log
    const errorLogPath = path.join(__dirname, '..', 'video-export-errors.json');
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2));
    console.log(`\n  Full error log saved to: video-export-errors.json`);
  }

  console.log('');

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to write to file');
  }

  if (TEST_MODE) {
    console.log('💡 Run without --test flag to export all videos');
  }

  // Save export summary
  const summaryPath = path.join(__dirname, '..', 'video-export-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : (TEST_MODE ? 'test' : 'production'),
    stats: stats,
    slug_mappings: SLUG_MAPPINGS
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Export summary saved to: video-export-summary.json\n`);
}

// Run export
exportVideos().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
