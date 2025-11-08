require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeVideoData() {
  console.log('=== VIDEO DATA ANALYSIS ===\n');
  
  // Get all videos
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('TOTAL VIDEOS IN SUPABASE:', videos.length);
  console.log('');

  // Status breakdown
  const statusCounts = {};
  videos.forEach(v => {
    const status = v.video_status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('VIDEO STATUS BREAKDOWN:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log('  ', status.padEnd(20), ':', count);
  });
  console.log('');

  // Downloaded videos
  const downloadedCount = videos.filter(v => v.downloaded === true).length;
  console.log('DOWNLOADED TO LOCAL:', downloadedCount);
  console.log('');

  // Department breakdown
  const deptCounts = {};
  videos.forEach(v => {
    const dept = v.commune_department || 'unknown';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  console.log('VIDEOS BY DEPARTMENT:');
  Object.entries(deptCounts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([dept, count]) => {
    console.log('  ', dept.padEnd(10), ':', count);
  });
  console.log('');

  // Format breakdown
  const withFormats = videos.filter(v => v.video_formats && typeof v.video_formats === 'object').length;
  console.log('VIDEOS WITH FORMAT INFO:', withFormats);
  
  if (withFormats > 0) {
    const sampleFormats = videos.find(v => v.video_formats);
    console.log('Sample formats available:', Object.keys(sampleFormats.video_formats).join(', '));
  }
  console.log('');

  // List cities with videos (slug format)
  console.log('CITIES WITH VIDEOS (first 50):');
  const citySlugs = videos
    .map(v => v.seo_filename ? v.seo_filename.replace('electricien-', '').replace(/\.(mp4|webm)$/, '').replace(/-\d+$/, '') : null)
    .filter(Boolean)
    .sort()
    .slice(0, 50);
  
  citySlugs.forEach(slug => console.log('  ', slug));
  console.log('');

  // File sizes
  const avgOriginal = videos
    .filter(v => v.file_size_original)
    .reduce((sum, v) => sum + v.file_size_original, 0) / videos.filter(v => v.file_size_original).length;
  
  const avgCompressed = videos
    .filter(v => v.file_size_compressed)
    .reduce((sum, v) => sum + v.file_size_compressed, 0) / videos.filter(v => v.file_size_compressed).length;

  console.log('AVERAGE FILE SIZES:');
  console.log('  Original MP4:  ', (avgOriginal / 1024 / 1024).toFixed(2), 'MB');
  console.log('  Compressed MP4:', (avgCompressed / 1024 / 1024).toFixed(2), 'MB');
  console.log('  Compression:   ', ((1 - avgCompressed / avgOriginal) * 100).toFixed(1), '% reduction');
}

analyzeVideoData().catch(err => console.error('Fatal:', err));
