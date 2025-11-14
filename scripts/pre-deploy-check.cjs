const fs = require('fs');
const path = require('path');

console.log('=== PRE-DEPLOYMENT CHECKLIST ===\n');

const checks = {
  passed: [],
  warnings: [],
  errors: []
};

// Check 1: Public directory exists
console.log('1. Checking public directory...');
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  checks.passed.push('Public directory exists');
  console.log('   OK: public/ directory found\n');
} else {
  checks.errors.push('Public directory not found - run hugo build first');
  console.log('   ERROR: public/ directory not found\n');
}

// Check 2: Video sitemap exists
console.log('2. Checking video sitemap...');
const videoSitemap = path.join(publicDir, 'video_sitemap.xml');
if (fs.existsSync(videoSitemap)) {
  const stats = fs.statSync(videoSitemap);
  const sizeKB = (stats.size / 1024).toFixed(2);
  checks.passed.push('Video sitemap exists (' + sizeKB + ' KB)');
  console.log('   OK: video_sitemap.xml found (' + sizeKB + ' KB)\n');
} else {
  checks.errors.push('Video sitemap not found - run generate-video-sitemap.js');
  console.log('   ERROR: video_sitemap.xml not found\n');
}

// Check 3: Robots.txt exists
console.log('3. Checking robots.txt...');
const robotsTxt = path.join(publicDir, 'robots.txt');
if (fs.existsSync(robotsTxt)) {
  checks.passed.push('robots.txt exists');
  console.log('   OK: robots.txt found\n');
} else {
  checks.warnings.push('robots.txt not found');
  console.log('   WARNING: robots.txt not found\n');
}

// Check 4: Video data file exists
console.log('4. Checking video data...');
const videoData = path.join(__dirname, '..', 'data', 'commune_videos.json');
if (fs.existsSync(videoData)) {
  const data = JSON.parse(fs.readFileSync(videoData, 'utf8'));
  const videoCount = Object.keys(data).length;
  checks.passed.push('Video data file exists (' + videoCount + ' videos)');
  console.log('   OK: commune_videos.json found (' + videoCount + ' videos)\n');
} else {
  checks.errors.push('Video data not found - run export-videos-from-supabase.js');
  console.log('   ERROR: commune_videos.json not found\n');
}

// Check 5: Video files accessible
console.log('5. Checking video files...');
const videoSymlink = path.join(__dirname, '..', 'static', 'videos-downloaded');
if (fs.existsSync(videoSymlink)) {
  const stats = fs.lstatSync(videoSymlink);
  if (stats.isSymbolicLink()) {
    checks.passed.push('Video symlink exists');
    console.log('   OK: videos-downloaded symlink exists\n');
  } else {
    checks.warnings.push('videos-downloaded is not a symlink');
    console.log('   WARNING: videos-downloaded exists but is not a symlink\n');
  }
} else {
  checks.warnings.push('videos-downloaded symlink not found');
  console.log('   WARNING: videos-downloaded symlink not found\n');
}

// Check 6: Count pages
console.log('6. Counting generated pages...');
try {
  const contentDirs = fs.readdirSync(publicDir).filter(function(item) {
    const itemPath = path.join(publicDir, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
  });
  checks.passed.push('Generated ' + contentDirs.length + ' page directories');
  console.log('   OK: ' + contentDirs.length + ' page directories found\n');
} catch (error) {
  checks.warnings.push('Could not count pages: ' + error.message);
  console.log('   WARNING: Could not count pages\n');
}

// Check 7: Sitemap index
console.log('7. Checking sitemap index...');
const sitemapIndex = path.join(publicDir, 'sitemap_index.xml');
if (fs.existsSync(sitemapIndex)) {
  checks.passed.push('Sitemap index exists');
  console.log('   OK: sitemap_index.xml found\n');
} else {
  checks.warnings.push('sitemap_index.xml not found');
  console.log('   WARNING: sitemap_index.xml not found\n');
}

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60) + '\n');

console.log('PASSED (' + checks.passed.length + '):');
checks.passed.forEach(function(check) {
  console.log('  - ' + check);
});
console.log('');

if (checks.warnings.length > 0) {
  console.log('WARNINGS (' + checks.warnings.length + '):');
  checks.warnings.forEach(function(check) {
    console.log('  - ' + check);
  });
  console.log('');
}

if (checks.errors.length > 0) {
  console.log('ERRORS (' + checks.errors.length + '):');
  checks.errors.forEach(function(check) {
    console.log('  - ' + check);
  });
  console.log('');
  console.log('DEPLOYMENT BLOCKED: Please fix errors before deploying.\n');
  process.exit(1);
} else if (checks.warnings.length > 0) {
  console.log('DEPLOYMENT READY WITH WARNINGS\n');
  process.exit(0);
} else {
  console.log('ALL CHECKS PASSED - READY TO DEPLOY\n');
  process.exit(0);
}
