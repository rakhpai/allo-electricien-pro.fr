require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function crossReference() {
  console.log('=== CROSS-REFERENCE: VIDEOS vs CITY PAGES ===\n');
  
  // Get all videos from Supabase
  const { data: videos } = await supabase
    .from('videos')
    .select('seo_filename, commune_name, local_storage_path, video_formats');

  // Get all city directories
  const contentDir = path.join(__dirname, '..', 'content');
  const cityDirs = fs.readdirSync(contentDir)
    .filter(name => {
      const fullPath = path.join(contentDir, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort();

  // Extract city slugs from videos
  const videoSlugs = new Set(
    videos.map(v => {
      if (!v.seo_filename) return null;
      return v.seo_filename
        .replace('electricien-', '')
        .replace(/\.(mp4|webm)$/, '')
        .replace(/-\d+$/, '');
    })
    .filter(Boolean)
  );

  console.log('TOTAL CITY PAGES:', cityDirs.length);
  console.log('TOTAL VIDEOS:', videos.length);
  console.log('UNIQUE CITY SLUGS WITH VIDEOS:', videoSlugs.size);
  console.log('');

  // Find cities WITHOUT videos
  const citiesWithoutVideos = cityDirs.filter(slug => !videoSlugs.has(slug));
  
  console.log('CITIES WITHOUT VIDEOS:', citiesWithoutVideos.length);
  console.log('');
  console.log('List (first 100):');
  citiesWithoutVideos.slice(0, 100).forEach(city => console.log('  -', city));
  console.log('');

  // Find videos WITHOUT city pages
  const videosWithoutCityPage = [];
  videoSlugs.forEach(slug => {
    if (!cityDirs.includes(slug)) {
      videosWithoutCityPage.push(slug);
    }
  });

  if (videosWithoutCityPage.length > 0) {
    console.log('VIDEOS WITHOUT CITY PAGES:', videosWithoutCityPage.length);
    videosWithoutCityPage.slice(0, 50).forEach(slug => console.log('  -', slug));
  } else {
    console.log('✓ All videos have corresponding city pages');
  }
  console.log('');

  // Matching stats
  const matchingCities = cityDirs.filter(slug => videoSlugs.has(slug)).length;
  const coverage = ((matchingCities / cityDirs.length) * 100).toFixed(1);
  
  console.log('COVERAGE STATISTICS:');
  console.log('  Cities with videos:    ', matchingCities);
  console.log('  Cities without videos: ', citiesWithoutVideos.length);
  console.log('  Coverage percentage:   ', coverage + '%');
}

crossReference().catch(err => console.error('Fatal:', err));
