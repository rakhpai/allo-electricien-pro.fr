import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Directories
const VIDEO_DIR = path.join(__dirname, '..', 'elecvideos');
const OUTPUT_DIR = path.join(VIDEO_DIR, 'normalized');
const BACKUP_DIR = path.join(VIDEO_DIR, 'originals');

// Processing settings for optimal Creatomate & Social Media compatibility
const SETTINGS = {
  // Video settings
  videoCodec: 'libx264',
  videoBitrate: '6000k', // 6 Mbps - good balance of quality/size
  preset: 'medium', // Encoding speed vs compression (slow = better compression)
  crf: 23, // Constant Rate Factor (18-28, lower = higher quality, 23 = good default)
  profile: 'high', // H.264 profile
  level: '4.0', // H.264 level
  pixelFormat: 'yuv420p', // Most compatible pixel format

  // Audio settings (for videos with audio)
  audioCodec: 'aac',
  audioBitrate: '128k',
  audioSampleRate: 48000,
  audioChannels: 2,

  // Size and format
  size: '1920x1080', // Maintain 1080p
  format: 'mp4',

  // Optimization flags
  movflags: '+faststart', // Enable streaming (moov atom at start)
};

/**
 * Check if video has audio stream
 */
async function hasAudio(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        resolve(false);
        return;
      }
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve(!!audioStream);
    });
  });
}

/**
 * Get file size in MB
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2);
  } catch (err) {
    return 0;
  }
}

/**
 * Process a single video file
 */
async function processVideo(inputPath, outputPath) {
  const hasAudioStream = await hasAudio(inputPath);

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      // Video settings
      .videoCodec(SETTINGS.videoCodec)
      .videoBitrate(SETTINGS.videoBitrate)
      .size(SETTINGS.size)
      .fps(25) // Standardize to 25fps
      .outputOptions([
        `-preset ${SETTINGS.preset}`,
        `-crf ${SETTINGS.crf}`,
        `-profile:v ${SETTINGS.profile}`,
        `-level ${SETTINGS.level}`,
        `-pix_fmt ${SETTINGS.pixelFormat}`,
        `-movflags ${SETTINGS.movflags}`,
      ]);

    // Audio settings - only if video has audio
    if (hasAudioStream) {
      command
        .audioCodec(SETTINGS.audioCodec)
        .audioBitrate(SETTINGS.audioBitrate)
        .audioFrequency(SETTINGS.audioSampleRate)
        .audioChannels(SETTINGS.audioChannels)
        .audioFilters([
          'loudnorm=I=-16:TP=-1.5:LRA=11', // Normalize audio to -16 LUFS
        ]);
    } else {
      // No audio - ensure output has no audio track
      command.noAudio();
    }

    // Output format
    command
      .format(SETTINGS.format)
      .output(outputPath);

    // Progress reporting
    command.on('start', (commandLine) => {
      console.log('  ├─ FFmpeg command:', commandLine.substring(0, 100) + '...');
    });

    command.on('progress', (progress) => {
      if (progress.percent) {
        process.stdout.write(`\r  ├─ Progress: ${progress.percent.toFixed(1)}%`);
      }
    });

    command.on('end', () => {
      process.stdout.write('\r  ├─ Progress: 100.0%\n');
      resolve();
    });

    command.on('error', (err) => {
      console.error('\n  └─ ❌ Error:', err.message);
      reject(err);
    });

    // Start processing
    command.run();
  });
}

/**
 * Main processing function
 */
async function processAllVideos() {
  console.log('🎬 Video Processing & Normalization');
  console.log('='.repeat(80));
  console.log();
  console.log('⚙️  Processing Settings:');
  console.log(`  - Output format: MP4 (H.264 + AAC)`);
  console.log(`  - Resolution: 1920x1080 @ 25fps`);
  console.log(`  - Video bitrate: ${SETTINGS.videoBitrate} (CRF ${SETTINGS.crf})`);
  console.log(`  - Audio: ${SETTINGS.audioCodec} ${SETTINGS.audioBitrate} @ ${SETTINGS.audioSampleRate}Hz (normalized to -16 LUFS)`);
  console.log(`  - Optimization: Fast start enabled for streaming`);
  console.log();

  try {
    // Find all video files
    const files = await fs.readdir(VIDEO_DIR);
    const videoFiles = files.filter(f =>
      /\.(mp4|mov|avi|mkv|webm)$/i.test(f) && !f.startsWith('.')
    );

    if (videoFiles.length === 0) {
      console.log('❌ No video files found in', VIDEO_DIR);
      return;
    }

    console.log(`📁 Found ${videoFiles.length} video files to process\n`);

    const results = [];
    let totalOriginalSize = 0;
    let totalProcessedSize = 0;

    for (let i = 0; i < videoFiles.length; i++) {
      const filename = videoFiles[i];
      const inputPath = path.join(VIDEO_DIR, filename);

      // Change extension to .mp4
      const outputFilename = filename.replace(/\.(mp4|mov|avi|mkv|webm)$/i, '.mp4');
      const outputPath = path.join(OUTPUT_DIR, outputFilename);

      console.log(`\n[${i + 1}/${videoFiles.length}] Processing: ${filename}`);

      try {
        // Get original file size
        const originalSize = parseFloat(await getFileSize(inputPath));
        totalOriginalSize += originalSize;

        console.log(`  ├─ Original size: ${originalSize} MB`);

        // Check if video has audio
        const hasAudioStream = await hasAudio(inputPath);
        console.log(`  ├─ Audio track: ${hasAudioStream ? 'Yes (will normalize)' : 'No (background video)'}`);

        // Process video
        await processVideo(inputPath, outputPath);

        // Get processed file size
        const processedSize = parseFloat(await getFileSize(outputPath));
        totalProcessedSize += processedSize;

        const savings = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
        const savedSize = (originalSize - processedSize).toFixed(2);

        console.log(`  ├─ Processed size: ${processedSize} MB`);
        console.log(`  └─ ✅ Saved ${savedSize} MB (${savings}% reduction)`);

        results.push({
          filename,
          outputFilename,
          originalSize,
          processedSize,
          savings: parseFloat(savings),
          savedSize: parseFloat(savedSize),
          hasAudio: hasAudioStream,
        });

      } catch (err) {
        console.log(`  └─ ❌ Failed: ${err.message}`);
        results.push({
          filename,
          error: err.message,
        });
      }
    }

    // Generate summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(80));
    console.log();

    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    console.log(`✅ Successfully processed: ${successful.length}/${videoFiles.length} videos`);
    if (failed.length > 0) {
      console.log(`❌ Failed: ${failed.length} video(s)`);
      failed.forEach(f => console.log(`   - ${f.filename}: ${f.error}`));
    }
    console.log();

    if (successful.length > 0) {
      console.log(`📦 Original total size: ${totalOriginalSize.toFixed(2)} MB`);
      console.log(`📦 Processed total size: ${totalProcessedSize.toFixed(2)} MB`);
      console.log(`💾 Total space saved: ${(totalOriginalSize - totalProcessedSize).toFixed(2)} MB`);
      console.log(`📉 Average reduction: ${((totalOriginalSize - totalProcessedSize) / totalOriginalSize * 100).toFixed(1)}%`);
      console.log();

      // Per-file breakdown
      console.log('📋 Per-File Results:');
      successful.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.filename}`);
        console.log(`     → ${r.outputFilename}`);
        console.log(`     Size: ${r.originalSize} MB → ${r.processedSize} MB (${r.savings}% reduction)`);
        console.log(`     Audio: ${r.hasAudio ? 'Normalized' : 'None (silent background)'}`);
      });
      console.log();

      console.log('📁 Processed videos saved to:');
      console.log(`   ${OUTPUT_DIR}`);
      console.log();
    }

    // Save detailed report
    const reportPath = path.join(__dirname, '..', 'video-processing-report.json');
    await fs.writeFile(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      settings: SETTINGS,
      totalOriginalSize,
      totalProcessedSize,
      totalSaved: totalOriginalSize - totalProcessedSize,
      percentReduction: ((totalOriginalSize - totalProcessedSize) / totalOriginalSize * 100).toFixed(1),
      results,
    }, null, 2));

    console.log(`📄 Detailed report saved to: ${reportPath}`);
    console.log();
    console.log('✅ All done! Your videos are optimized for Creatomate and social media.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Run processing
processAllVideos();
