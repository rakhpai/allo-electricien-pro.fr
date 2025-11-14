const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('=== GENERATE ELECTRICIAN PROFILE PAGES ===\n');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No files will be written\n');
}

if (TEST_MODE) {
  console.log(`🧪 TEST MODE - Processing only ${TEST_LIMIT} profiles\n`);
}

/**
 * Slugify text for URLs
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate profile page content
 */
function generateProfilePage(profile) {
  const firstName = slugify(profile.first_name || '');
  const lastName = slugify(profile.last_name || '');
  const shortId = profile.id.split('-')[0];
  const slug = `${firstName}-${lastName}-${shortId}`;

  // Build SEO-optimized title and description
  const title = `${profile.first_name} ${profile.last_name} - Électricien ${profile.specialty_primary} | Île-de-France`;
  const description = profile.bio_short || `Électricien professionnel spécialisé en ${profile.specialty_primary}. ${profile.years_experience} ans d'expérience. Note ${profile.rating}/5 avec ${profile.review_count} avis. Devis gratuit.`;

  // Keywords for SEO
  const keywords = [
    `électricien ${profile.first_name} ${profile.last_name}`,
    `${profile.specialty_primary}`,
    ...profile.service_tags,
    'électricien Île-de-France',
    'dépannage électrique'
  ];

  // Build frontmatter
  const frontmatter = {
    // Basic info
    title: title,
    slug: slug,
    type: 'profile',
    layout: 'profile',

    // SEO
    description: description.substring(0, 160), // Meta description limit
    keywords: keywords,

    // Profile data
    profile_id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    specialty: profile.specialty_primary,
    specialty_badge: profile.specialty_badge,
    badge_color: profile.badge_color,
    bio: profile.bio_short,
    services: profile.service_tags,

    // Contact
    phone: profile.phone_display,
    phone_href: profile.phone_href,
    available_24_7: profile.is_available_24_7,

    // Ratings & Experience
    rating: profile.rating,
    review_count: profile.review_count,
    years_experience: profile.years_experience,
    price_range: profile.price_range,

    // Images
    images: profile.images || {
      square: profile.avatar_url,
      landscape: profile.avatar_url,
      wide: profile.avatar_url
    },
    avatar_url: profile.avatar_url,

    // Location
    coverage_zones: profile.coverage_zones,
    address: profile.address || null,
    geo: profile.geo || null,

    // Profile URL (for schema)
    profile_url: profile.profile_url,

    // Meta
    draft: false,
    sitemap: {
      priority: 0.6,
      changefreq: 'monthly'
    },

    // Open Graph
    og: {
      title: `${profile.first_name} ${profile.last_name} - Électricien ${profile.specialty_primary}`,
      description: description.substring(0, 200),
      image: profile.images?.square || profile.avatar_url,
      type: 'profile'
    }
  };

  // Build markdown content (layout handles all display)
  const content = `---
${yaml.dump(frontmatter, { lineWidth: -1, noRefs: true })}---
`;

  return {
    slug: slug,
    frontmatter: frontmatter,
    content: content,
    filePath: path.join('content', 'profiles', slug, 'index.md')
  };
}

/**
 * Write profile page to disk
 */
function writeProfilePage(profileData) {
  const fullPath = path.join(__dirname, '..', profileData.filePath);
  const dir = path.dirname(fullPath);

  // Create directory
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(fullPath, profileData.content, 'utf8');
  return fullPath;
}

/**
 * Main function
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: LOAD PROFILE DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const dataPath = path.join(__dirname, '..', 'data', 'electricien_profiles.json');

  if (!fs.existsSync(dataPath)) {
    console.error('❌ Error: electricien_profiles.json not found');
    console.error(`   Expected at: ${dataPath}`);
    console.error('   Run export-electricien-profiles-enhanced.cjs first');
    process.exit(1);
  }

  const profilesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  if (!profilesData.all_profiles || !Array.isArray(profilesData.all_profiles)) {
    console.error('❌ Error: Invalid profile data structure');
    process.exit(1);
  }

  const allProfiles = profilesData.all_profiles;
  console.log(`✓ Loaded ${allProfiles.length} profiles from JSON\n`);

  // Apply test mode limit
  const profilesToProcess = TEST_MODE
    ? allProfiles.slice(0, TEST_LIMIT)
    : allProfiles;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: GENERATE PROFILE PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Generating pages for ${profilesToProcess.length} profiles...\n`);

  const results = {
    success: [],
    errors: [],
    totalProcessed: 0
  };

  for (let i = 0; i < profilesToProcess.length; i++) {
    const profile = profilesToProcess[i];
    const profileName = `${profile.first_name} ${profile.last_name}`;

    try {
      const profileData = generateProfilePage(profile);

      if (DRY_RUN) {
        console.log(`[${i + 1}/${profilesToProcess.length}] 📝 ${profileName}`);
        console.log(`   Would create: ${profileData.filePath}`);
        console.log(`   Slug: ${profileData.slug}`);
      } else {
        const filePath = writeProfilePage(profileData);
        console.log(`[${i + 1}/${profilesToProcess.length}] ✓ ${profileName}`);
        console.log(`   Created: ${profileData.filePath}`);
      }

      results.success.push({
        profile_id: profile.id,
        name: profileName,
        slug: profileData.slug,
        path: profileData.filePath
      });

      results.totalProcessed++;

    } catch (error) {
      console.log(`[${i + 1}/${profilesToProcess.length}] ✗ ${profileName}`);
      console.log(`   Error: ${error.message}`);

      results.errors.push({
        profile_id: profile.id,
        name: profileName,
        error: error.message
      });
    }
  }

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const successRate = (results.success.length / results.totalProcessed * 100).toFixed(1);

  console.log(`Total profiles processed:  ${results.totalProcessed}`);
  console.log(`Successful:                ${results.success.length} (${successRate}%)`);
  console.log(`Failed:                    ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    results.errors.forEach(e => {
      console.log(`   - ${e.name}: ${e.error}`);
    });
  }

  // Write report
  if (!DRY_RUN) {
    const reportPath = path.join(__dirname, 'profile-pages-generation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n📝 Report saved to: profile-pages-generation-report.json`);
  }

  // Sample URLs
  if (results.success.length > 0) {
    console.log('\n📄 Sample profile pages:');
    results.success.slice(0, 5).forEach(r => {
      console.log(`   - ${r.name}: /profiles/${r.slug}/`);
    });
    if (results.success.length > 5) {
      console.log(`   ... and ${results.success.length - 5} more`);
    }
  }

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run flag to create files');
  } else {
    console.log('\n✅ Profile page generation complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Create profile page layout template (layouts/profile/single.html)');
    console.log('   2. Create profile shortcodes (hero, services, coverage, cta)');
    console.log('   3. Test Hugo build');
    console.log('   4. Deploy to production');
  }
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
