const fs = require('fs');
const path = require('path');

console.log('🎬 VTT Caption Generator for Allo-Électricien');
console.log('===============================================\n');

// Load video data
const videosDataPath = path.join(__dirname, '../data/commune_videos.json');
if (!fs.existsSync(videosDataPath)) {
  console.error('❌ Error: commune_videos.json not found at', videosDataPath);
  process.exit(1);
}

const videosData = JSON.parse(fs.readFileSync(videosDataPath, 'utf8'));
console.log(`✅ Loaded ${Object.keys(videosData).length} videos from commune_videos.json\n`);

// Output directory
const outputDir = path.join(__dirname, '../static/videos/captions');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`📁 Created output directory: ${outputDir}\n`);
}

// Simple sentence splitter (splits on . ! ?)
function splitIntoSentences(text) {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Generate VTT file from voiceover script
function generateVTT(slug, script) {
  const sentences = splitIntoSentences(script);

  let vttContent = 'WEBVTT\n\n';
  let currentTime = 0;

  sentences.forEach((sentence, index) => {
    const startTime = currentTime;

    // Estimate duration based on sentence length
    // Average French speaking rate: ~150 words/minute = 2.5 words/second
    // Rough estimate: 1 character ≈ 0.06 seconds
    const wordsCount = sentence.split(/\s+/).length;
    const duration = Math.max(2, wordsCount / 2.5); // Minimum 2 seconds per sentence
    const endTime = currentTime + duration;

    const startTimestamp = formatTimestamp(startTime);
    const endTimestamp = formatTimestamp(endTime);

    vttContent += `${index + 1}\n`;
    vttContent += `${startTimestamp} --> ${endTimestamp}\n`;
    vttContent += `${sentence}.\n\n`;

    currentTime = endTime;
  });

  return vttContent;
}

// Format seconds to VTT timestamp (00:00:00.000)
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Process all videos
let successCount = 0;
let skippedCount = 0;
let errorCount = 0;

console.log('Generating VTT files...\n');

Object.entries(videosData).forEach(([slug, data], index) => {
  const vttPath = path.join(outputDir, `${slug}.vtt`);

  // Check if VTT already exists
  if (fs.existsSync(vttPath)) {
    skippedCount++;
    if ((index + 1) % 100 === 0) {
      console.log(`⏩ Skipped ${skippedCount} existing files...`);
    }
    return;
  }

  if (data.voiceover_script) {
    try {
      const vttContent = generateVTT(slug, data.voiceover_script);
      fs.writeFileSync(vttPath, vttContent, 'utf8');
      successCount++;

      if (successCount % 50 === 0) {
        console.log(`✅ Generated ${successCount} VTT files...`);
      }
    } catch (error) {
      console.error(`❌ Error generating VTT for ${slug}:`, error.message);
      errorCount++;
    }
  } else {
    console.warn(`⚠️  No voiceover_script for ${slug}`);
    skippedCount++;
  }
});

// Summary
console.log('\n===============================================');
console.log('📊 Generation Summary:');
console.log(`   ✅ Successfully generated: ${successCount} files`);
console.log(`   ⏩ Skipped (already exist): ${skippedCount} files`);
console.log(`   ❌ Errors: ${errorCount} files`);
console.log(`   📁 Output directory: ${outputDir}`);
console.log('===============================================\n');

if (successCount > 0) {
  console.log('✨ VTT caption files generated successfully!');
  console.log('   Next steps:');
  console.log('   1. Review a few VTT files to check quality');
  console.log('   2. Run Hugo build to deploy');
  console.log('   3. Test video captions on a sample page\n');
}

process.exit(errorCount > 0 ? 1 : 0);
