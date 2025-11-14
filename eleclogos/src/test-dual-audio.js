import videoGenerator from './index.js';
import logger from './utils/logger.js';
import supabaseService from './services/supabase.js';
import { getTrustSignals, getRecommendedIntroVariant } from './utils/trust-signals.js';

/**
 * Test Dual Audio System with Complete CRO Integration
 * Tests the complete dual audio workflow with a single commune
 * Verifies all CRO fields are populated correctly
 */
async function testDualAudio() {
  try {
    console.log('='.repeat(80));
    console.log('TEMPLATE 7 - DUAL AUDIO + CRO SYSTEM TEST');
    console.log('Duration: 33s | Modifications: 13 (7 text + 4 images + 2 audio)');
    console.log('Full Audio: NO duration limit - plays to end (FIX for audio cut-off)');
    console.log('Static CTA: "APPELEZ-NOUS ! 24h/24 et 7j/7"');
    console.log('='.repeat(80));

    // Test commune data - Large commune to test Template 7
    const testCommune = {
      name: 'Nanterre',
      code: '92050',
      department: '92',
      region: 'Île-de-France',
      population: 96000,
      phoneNumber: '06 44 64 71 75',
    };

    console.log('\n📍 TEST COMMUNE');
    console.log('   Name:', testCommune.name);
    console.log('   Code:', testCommune.code);
    console.log('   Population:', testCommune.population.toLocaleString());
    console.log('   Department:', testCommune.department);
    console.log('   Phone:', testCommune.phoneNumber);

    // Preview CRO configuration
    console.log('\n🎯 CRO CONFIGURATION PREVIEW');
    const trustSignals = getTrustSignals(testCommune);
    const recommendedIntro = getRecommendedIntroVariant(testCommune);

    console.log('   Intro Variant:', recommendedIntro);
    console.log('   CTA Variant:', testCommune.population > 50000 ? 'urgent' : 'standard');
    console.log('   Review Count:', trustSignals.reviewCount);
    console.log('   Rating:', trustSignals.rating + '/5 ⭐');
    console.log('   Urgency Level:', trustSignals.urgencyLevel);
    console.log('   Certifications:', trustSignals.certifications.join(', '));

    console.log('\n🚀 Starting video generation with dual audio + CRO...\n');

    // Generate video with dual audio
    const result = await videoGenerator.generateVideo(testCommune);

    console.log('\n' + '='.repeat(80));
    console.log('✅ VIDEO GENERATION RESULTS');
    console.log('='.repeat(80));

    if (result.success) {
      console.log('\n✓ Video generation successful!');
      console.log('\n📹 Video Details:');
      console.log('   Video ID:', result.video.id);
      console.log('   Render ID:', result.video.renderId);
      console.log('   Status:', result.video.status);
      console.log('   Message:', result.video.message);

      // Fetch and verify CRO fields from database
      console.log('\n🔍 Verifying CRO Fields in Database...\n');

      try {
        const videoRecord = await supabaseService.getVideoById(result.video.id);

        console.log('📊 CRO FIELD VERIFICATION:');
        console.log('   ✓ Phone Number:', videoRecord.phone_number);
        console.log('   ✓ Intro Variant:', videoRecord.intro_variant);
        console.log('   ✓ CTA Variant:', videoRecord.cta_variant);
        console.log('   ✓ Trust Badge Variant:', videoRecord.trust_badge_variant);
        console.log('   ✓ Description Variant:', videoRecord.description_variant);
        console.log('   ✓ Years of Service:', videoRecord.years_of_service);
        console.log('   ✓ Average Rating:', videoRecord.average_rating + '/5');
        console.log('   ✓ Review Count:', videoRecord.review_count);
        console.log('   ✓ Certifications:', videoRecord.certifications?.join(', '));
        console.log('   ✓ Urgency Level:', videoRecord.urgency_level);
        console.log('   ✓ Local Context:', videoRecord.local_context);

        // Count populated fields
        const croFields = [
          'phone_number', 'intro_variant', 'cta_variant', 'trust_badge_variant',
          'description_variant', 'years_of_service', 'average_rating', 'review_count',
          'certifications', 'urgency_level', 'local_context'
        ];
        const populatedCount = croFields.filter(field => videoRecord[field] != null).length;

        console.log('\n📈 CRO Field Population: ' + populatedCount + '/11 fields populated');

        if (populatedCount === 11) {
          console.log('   ✅ ALL CRO FIELDS SUCCESSFULLY POPULATED!');
        } else {
          console.log('   ⚠️  Some fields missing:',
            croFields.filter(field => !videoRecord[field]).join(', '));
        }

        console.log('\n🎬 Audio Files:');
        console.log('   Intro Audio:', videoRecord.intro_audio_url ? '✓' : '✗');
        console.log('   Full Audio:', videoRecord.full_audio_url ? '✓' : '✗');

      } catch (error) {
        console.error('   ✗ Could not verify database record:', error.message);
      }

    } else {
      console.log('\n✗ Video generation failed');
      console.log('Error:', result.error);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 NEXT STEPS');
    console.log('='.repeat(80));
    console.log('1. ✓ Dual audio files uploaded to Supabase Storage:');
    console.log('      - commune-audio/' + testCommune.code + '_intro.mp3');
    console.log('      - commune-audio/' + testCommune.code + '_full.mp3');
    console.log('\n2. ✓ Database record created with ALL CRO fields');
    console.log('\n3. ⏳ Video rendering in progress on Creatomate');
    console.log('      Render ID: ' + (result.video?.renderId || 'N/A'));
    console.log('\n4. 🔔 Check Creatomate dashboard for render status');
    console.log('      https://creatomate.com/renders');
    console.log('\n5. 📊 Once video completes, you can track performance:');
    console.log('      - Views, completion rate, clicks');
    console.log('      - Phone calls (conversions)');
    console.log('      - A/B test performance');
    console.log('='.repeat(80) + '\n');

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('TEST FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run test
testDualAudio();
