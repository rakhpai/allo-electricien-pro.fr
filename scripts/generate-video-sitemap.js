require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== GENERATE VIDEO SITEMAP ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const BASE_URL = 'https://allo-electricien.pro/';
const VIDEO_SITEMAP_PATH = path.join(__dirname, '..', 'static', 'video_sitemap.xml');
const VIDEO_DATA_PATH = path.join(__dirname, '..', 'data', 'commune_videos.json');
const CONTENT_DIR = path.join(__dirname, '..', 'content');

if (DRY_RUN) {
  console.log('[DRY RUN MODE] No files will be written\n');
}

/**
 * Read city pages to get page URLs
 */
function getCityPages() {
  const cities = {};

  try {
    const contentDirs = fs.readdirSync(CONTENT_DIR);

    for (const dir of contentDirs) {
      const dirPath = path.join(CONTENT_DIR, dir);
      const stat = fs.statSync(dirPath);

      if (!stat.isDirectory()) continue;

      const indexPath = path.join(dirPath, 'index.md');
      if (fs.existsSync(indexPath)) {
        cities[dir] = {
          slug: dir,
          url: BASE_URL + dir + '/'
        };
      }
    }

    return cities;
  } catch (error) {
    console.error('Error reading content directory:', error.message);
    return {};
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format duration from seconds to ISO 8601 (if not already)
 */
function formatDuration(duration) {
  if (!duration) return null;

  // If already ISO 8601, return as is
  if (typeof duration === 'string' && duration.startsWith('PT')) {
    return duration;
  }

  // Convert seconds to ISO 8601
  const seconds = Math.round(parseFloat(duration));
  return 'PT' + seconds + 'S';
}

/**
 * Generate video sitemap XML
 */
function generateVideoSitemap() {
  const stats = {
    videos_found: 0,
    urls_generated: 0,
    errors: []
  };

  console.log('='.repeat(60));
  console.log('STEP 1: LOAD VIDEO DATA');
  console.log('='.repeat(60) + '\n');

  // Load video data
  let videoData = {};
  try {
    const videoDataRaw = fs.readFileSync(VIDEO_DATA_PATH, 'utf8');
    videoData = JSON.parse(videoDataRaw);
    stats.videos_found = Object.keys(videoData).length;
    console.log('Loaded ' + stats.videos_found + ' videos from data/commune_videos.json\n');
  } catch (error) {
    console.error('ERROR: Could not load video data:', error.message);
    console.error('Make sure to run: node scripts/export-videos-from-supabase.js first\n');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('STEP 2: LOAD CITY PAGES');
  console.log('='.repeat(60) + '\n');

  const cityPages = getCityPages();
  console.log('Found ' + Object.keys(cityPages).length + ' city pages\n');

  console.log('='.repeat(60));
  console.log('STEP 3: GENERATE SITEMAP XML');
  console.log('='.repeat(60) + '\n');

  // Start XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';

  // Iterate through videos
  for (const [slug, video] of Object.entries(videoData)) {
    try {
      // Check if city page exists
      if (!cityPages[slug]) {
        console.log('  WARNING: No page found for video: ' + slug);
        continue;
      }

      const pageUrl = cityPages[slug].url;
      const cityName = video.city_name || slug;
      const videoTitle = 'Électricien d\'urgence à ' + cityName;

      // Build thumbnail URL
      let thumbnailUrl = '';
      if (video.thumbnail_path) {
        thumbnailUrl = BASE_URL + video.thumbnail_path.replace(/^\//, '');
      } else {
        // Fallback to a generic thumbnail or hero image
        thumbnailUrl = BASE_URL + 'images/hero/' + slug + '-hero.jpg';
      }

      // Build video URL (prefer compressed MP4)
      let videoUrl = '';
      if (video.video_mp4_compressed) {
        videoUrl = BASE_URL + video.video_mp4_compressed.replace(/^\//, '');
      } else if (video.video_mp4) {
        videoUrl = BASE_URL + video.video_mp4.replace(/^\//, '');
      }

      // Description from voiceover script
      let description = video.voiceover_script ||
                       ('Découvrez les services d\'électricien à ' + cityName + '. Intervention rapide 24/7.');

      // Clean description (remove newlines, limit length)
      description = description.replace(/\n+/g, ' ').trim();
      if (description.length > 2000) {
        description = description.substring(0, 1997) + '...';
      }

      // Format upload date (ISO 8601)
      let uploadDate = video.created_at || new Date().toISOString();

      // Format duration
      let duration = formatDuration(video.duration_seconds || video.duration_iso);

      // Add URL entry
      xml += '  <url>\n';
      xml += '    <loc>' + escapeXml(pageUrl) + '</loc>\n';
      xml += '    <video:video>\n';
      xml += '      <video:thumbnail_loc>' + escapeXml(thumbnailUrl) + '</video:thumbnail_loc>\n';
      xml += '      <video:title>' + escapeXml(videoTitle) + '</video:title>\n';
      xml += '      <video:description>' + escapeXml(description) + '</video:description>\n';
      if (videoUrl) {
        xml += '      <video:content_loc>' + escapeXml(videoUrl) + '</video:content_loc>\n';
      }
      if (duration) {
        xml += '      <video:duration>' + duration.replace('PT', '').replace('S', '') + '</video:duration>\n';
      }
      xml += '      <video:publication_date>' + escapeXml(uploadDate) + '</video:publication_date>\n';
      xml += '      <video:family_friendly>yes</video:family_friendly>\n';
      xml += '      <video:requires_subscription>no</video:requires_subscription>\n';
      xml += '    </video:video>\n';
      xml += '  </url>\n';

      stats.urls_generated++;

      if (stats.urls_generated <= 5) {
        console.log('  OK: ' + slug + ' -> ' + pageUrl);
      } else if (stats.urls_generated % 50 === 0) {
        console.log('  Progress: ' + stats.urls_generated + ' URLs generated');
      }

    } catch (error) {
      stats.errors.push({
        slug: slug,
        error: error.message
      });
      console.log('  ERROR: ' + slug + ' - ' + error.message);
    }
  }

  // Close XML
  xml += '</urlset>\n';

  console.log('\n' + '='.repeat(60));
  console.log('STEP 4: WRITE SITEMAP FILE');
  console.log('='.repeat(60) + '\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would write to: ' + VIDEO_SITEMAP_PATH);
    console.log('[DRY RUN] Sitemap size: ' + (xml.length / 1024).toFixed(2) + ' KB');
    console.log('\nFirst 500 characters:');
    console.log(xml.substring(0, 500) + '...\n');
  } else {
    // Ensure static directory exists
    const staticDir = path.join(__dirname, '..', 'static');
    if (!fs.existsSync(staticDir)) {
      fs.mkdirSync(staticDir, { recursive: true });
    }

    // Write sitemap file
    fs.writeFileSync(VIDEO_SITEMAP_PATH, xml, 'utf8');
    console.log('SUCCESS: Written to ' + VIDEO_SITEMAP_PATH);

    // Get file size
    const fileStats = fs.statSync(VIDEO_SITEMAP_PATH);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);
    console.log('File size: ' + fileSizeKB + ' KB\n');
  }

  console.log('='.repeat(60));
  console.log('GENERATION COMPLETE');
  console.log('='.repeat(60) + '\n');

  console.log('Statistics:');
  console.log('  Videos in data file:  ' + stats.videos_found);
  console.log('  URLs generated:       ' + stats.urls_generated);
  console.log('  Errors:               ' + stats.errors.length);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors:');
    stats.errors.forEach(function(err) {
      console.log('  - ' + err.slug + ': ' + err.error);
    });
    console.log('');
  }

  if (DRY_RUN) {
    console.log('TIP: Run without --dry-run to write the sitemap file\n');
  } else {
    console.log('NEXT STEPS:');
    console.log('  1. Add reference to video sitemap in robots.txt');
    console.log('  2. Submit sitemap to Google Search Console');
    console.log('  3. URL: ' + BASE_URL + 'video_sitemap.xml\n');
  }

  // Save summary
  const summaryPath = path.join(__dirname, '..', 'video-sitemap-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'production',
    sitemap_path: VIDEO_SITEMAP_PATH,
    sitemap_url: BASE_URL + 'video_sitemap.xml',
    stats: stats
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('Summary saved to: video-sitemap-summary.json\n');
}

// Run generation
try {
  generateVideoSitemap();
} catch (error) {
  console.error('FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
