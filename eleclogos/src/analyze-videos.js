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

// Directory containing videos
const VIDEO_DIR = path.join(__dirname, '..', 'elecvideos');

/**
 * Get video metadata using ffprobe
 */
async function analyzeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

      const stats = {
        filename: path.basename(videoPath),
        path: videoPath,
        format: metadata.format.format_name,
        duration: parseFloat(metadata.format.duration).toFixed(2),
        size: parseInt(metadata.format.size),
        sizeMB: (parseInt(metadata.format.size) / (1024 * 1024)).toFixed(2),
        bitrate: parseInt(metadata.format.bit_rate),
        bitrateMbps: (parseInt(metadata.format.bit_rate) / 1000000).toFixed(2),
        video: videoStream ? {
          codec: videoStream.codec_name,
          codecLong: videoStream.codec_long_name,
          profile: videoStream.profile,
          width: videoStream.width,
          height: videoStream.height,
          aspectRatio: videoStream.display_aspect_ratio,
          frameRate: eval(videoStream.r_frame_rate),
          pixelFormat: videoStream.pix_fmt,
          bitrate: videoStream.bit_rate ? parseInt(videoStream.bit_rate) : null,
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          codecLong: audioStream.codec_long_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels,
          channelLayout: audioStream.channel_layout,
          bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : null,
        } : null,
      };

      resolve(stats);
    });
  });
}

/**
 * Analyze audio levels using volumedetect filter
 */
async function analyzeAudioLevels(videoPath) {
  return new Promise((resolve, reject) => {
    let audioData = {
      meanVolume: null,
      maxVolume: null,
    };

    ffmpeg(videoPath)
      .audioFilters('volumedetect')
      .outputOptions(['-f', 'null'])
      .output('-')
      .on('error', (err) => {
        // Even on "error", volumedetect outputs to stderr, so we may have partial data
        resolve(audioData);
      })
      .on('stderr', (stderrLine) => {
        // Parse volumedetect output
        if (stderrLine.includes('mean_volume:')) {
          const match = stderrLine.match(/mean_volume:\s*([-\d.]+)\s*dB/);
          if (match) audioData.meanVolume = parseFloat(match[1]);
        }
        if (stderrLine.includes('max_volume:')) {
          const match = stderrLine.match(/max_volume:\s*([-\d.]+)\s*dB/);
          if (match) audioData.maxVolume = parseFloat(match[1]);
        }
      })
      .on('end', () => {
        resolve(audioData);
      })
      .run();
  });
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main analysis function
 */
async function analyzeAllVideos() {
  console.log('🎬 Video Analysis Tool');
  console.log('='.repeat(80));
  console.log();

  try {
    // Find all video files
    const files = await fs.readdir(VIDEO_DIR);
    const videoFiles = files.filter(f =>
      /\.(mp4|mov|avi|mkv|webm)$/i.test(f)
    );

    if (videoFiles.length === 0) {
      console.log('❌ No video files found in', VIDEO_DIR);
      return;
    }

    console.log(`📁 Found ${videoFiles.length} video files\n`);

    const results = [];
    let totalSize = 0;

    for (let i = 0; i < videoFiles.length; i++) {
      const filename = videoFiles[i];
      const videoPath = path.join(VIDEO_DIR, filename);

      console.log(`[${i + 1}/${videoFiles.length}] Analyzing: ${filename}`);

      try {
        const metadata = await analyzeVideo(videoPath);
        console.log('  ├─ Getting audio levels...');
        const audioLevels = await analyzeAudioLevels(videoPath);

        metadata.audioLevels = audioLevels;
        results.push(metadata);
        totalSize += metadata.size;

        console.log(`  ├─ Format: ${metadata.format.toUpperCase()}`);
        console.log(`  ├─ Duration: ${metadata.duration}s`);
        console.log(`  ├─ Size: ${metadata.sizeMB} MB`);
        console.log(`  ├─ Video: ${metadata.video.codec.toUpperCase()} ${metadata.video.width}x${metadata.video.height} @ ${metadata.video.frameRate.toFixed(2)}fps`);
        console.log(`  ├─ Audio: ${metadata.audio ? metadata.audio.codec.toUpperCase() : 'None'} ${metadata.audio ? metadata.audio.sampleRate + 'Hz' : ''}`);
        console.log(`  └─ Audio Levels: Mean ${audioLevels.meanVolume}dB, Max ${audioLevels.maxVolume}dB`);
        console.log();
      } catch (err) {
        console.log(`  └─ ❌ Error: ${err.message}\n`);
      }
    }

    // Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log();
    console.log(`Total videos analyzed: ${results.length}`);
    console.log(`Total size: ${formatBytes(totalSize)} (${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
    console.log();

    // Format analysis
    const formats = {};
    const videoCodecs = {};
    const audioCodecs = {};
    const resolutions = {};

    results.forEach(r => {
      formats[r.format] = (formats[r.format] || 0) + 1;
      if (r.video) {
        videoCodecs[r.video.codec] = (videoCodecs[r.video.codec] || 0) + 1;
        const res = `${r.video.width}x${r.video.height}`;
        resolutions[res] = (resolutions[res] || 0) + 1;
      }
      if (r.audio) {
        audioCodecs[r.audio.codec] = (audioCodecs[r.audio.codec] || 0) + 1;
      }
    });

    console.log('📦 Formats:');
    Object.entries(formats).forEach(([format, count]) => {
      console.log(`  - ${format.toUpperCase()}: ${count} file(s)`);
    });
    console.log();

    console.log('🎥 Video Codecs:');
    Object.entries(videoCodecs).forEach(([codec, count]) => {
      console.log(`  - ${codec.toUpperCase()}: ${count} file(s)`);
    });
    console.log();

    console.log('🔊 Audio Codecs:');
    Object.entries(audioCodecs).forEach(([codec, count]) => {
      console.log(`  - ${codec.toUpperCase()}: ${count} file(s)`);
    });
    console.log();

    console.log('📐 Resolutions:');
    Object.entries(resolutions).forEach(([res, count]) => {
      console.log(`  - ${res}: ${count} file(s)`);
    });
    console.log();

    // Audio level analysis
    const audioLevels = results
      .filter(r => r.audioLevels.meanVolume !== null)
      .map(r => r.audioLevels.meanVolume);

    if (audioLevels.length > 0) {
      const avgMeanVolume = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
      const minVolume = Math.min(...audioLevels);
      const maxVolume = Math.max(...audioLevels);

      console.log('🔉 Audio Level Statistics:');
      console.log(`  - Average mean volume: ${avgMeanVolume.toFixed(2)} dB`);
      console.log(`  - Range: ${minVolume.toFixed(2)} dB to ${maxVolume.toFixed(2)} dB`);
      console.log(`  - Variation: ${(maxVolume - minVolume).toFixed(2)} dB`);
      console.log();
    }

    // Recommendations
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(80));
    console.log();

    const needsConversion = results.filter(r => r.format !== 'mp4' || r.video.codec !== 'h264');
    if (needsConversion.length > 0) {
      console.log(`⚠️  ${needsConversion.length} video(s) need format conversion to MP4/H.264`);
    }

    const hasAudioVariation = audioLevels.length > 0 && (Math.max(...audioLevels) - Math.min(...audioLevels)) > 3;
    if (hasAudioVariation) {
      console.log(`⚠️  Audio levels vary by more than 3dB - normalization recommended`);
    }

    const largFiles = results.filter(r => r.size > 100 * 1024 * 1024); // > 100MB
    if (largFiles.length > 0) {
      console.log(`⚠️  ${largFiles.length} video(s) are larger than 100MB - compression recommended`);
    }

    console.log();
    console.log('✅ Target specs for Creatomate & Social Media:');
    console.log('  - Container: MP4');
    console.log('  - Video Codec: H.264 (High profile)');
    console.log('  - Audio Codec: AAC (128kbps, 48kHz, stereo)');
    console.log('  - Resolution: 1920x1080');
    console.log('  - Bitrate: 5-8 Mbps');
    console.log('  - Audio: Normalized to -16 LUFS');
    console.log();

    // Save detailed report to JSON
    const reportPath = path.join(__dirname, '..', 'video-analysis-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Run analysis
analyzeAllVideos();
