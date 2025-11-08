require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('=== QUERY ALL IDF COMMUNES FROM SUPABASE ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// IDF departments
const IDF_DEPARTMENTS = ['75', '77', '78', '91', '92', '93', '94', '95'];

/**
 * Extract department code from postal code
 */
function getDepartmentFromPostal(postalCodes) {
  if (!postalCodes || postalCodes.length === 0) return null;

  // Get first postal code
  const firstPostal = Array.isArray(postalCodes) ? postalCodes[0] : postalCodes;

  // Extract department (first 2 or 3 digits)
  if (firstPostal.startsWith('75')) return '75'; // Paris
  if (firstPostal.startsWith('77')) return '77'; // Seine-et-Marne
  if (firstPostal.startsWith('78')) return '78'; // Yvelines
  if (firstPostal.startsWith('91')) return '91'; // Essonne
  if (firstPostal.startsWith('92')) return '92'; // Hauts-de-Seine
  if (firstPostal.startsWith('93')) return '93'; // Seine-Saint-Denis
  if (firstPostal.startsWith('94')) return '94'; // Val-de-Marne
  if (firstPostal.startsWith('95')) return '95'; // Val-d'Oise

  return null;
}

/**
 * Get all existing Hugo pages
 */
function getExistingHugoPages() {
  const contentDir = path.join(__dirname, '..', 'content');

  if (!fs.existsSync(contentDir)) {
    return [];
  }

  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  const slugs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  return slugs;
}

/**
 * Main query function
 */
async function queryAllIDFCommunes() {
  const stats = {
    total_geographic_locations: 0,
    idf_communes: 0,
    existing_hugo_pages: 0,
    missing_pages: 0,
    extra_pages: 0,
    by_department: {}
  };

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: FETCH ALL GEOGRAPHIC LOCATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Fetch all geographic locations with pagination
    let allLocations = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error } = await supabase
        .from('geographic_locations')
        .select('*')
        .order('slug')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        throw new Error(`Error fetching geographic_locations: ${error.message}`);
      }

      if (pageData && pageData.length > 0) {
        allLocations = allLocations.concat(pageData);
        page++;
        hasMore = pageData.length === pageSize;
        console.log(`  Fetched page ${page}: ${pageData.length} locations (total: ${allLocations.length})`);
      } else {
        hasMore = false;
      }
    }

    stats.total_geographic_locations = allLocations.length;
    console.log(`\n✓ Found ${allLocations.length} total geographic locations\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: FILTER IDF COMMUNES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Filter for IDF communes
    const idfCommunes = allLocations.filter(location => {
      const dept = getDepartmentFromPostal(location.postal_codes);
      return dept && IDF_DEPARTMENTS.includes(dept);
    });

    stats.idf_communes = idfCommunes.length;
    console.log(`✓ Found ${idfCommunes.length} IDF communes\n`);

    // Group by department
    const byDepartment = {};
    IDF_DEPARTMENTS.forEach(dept => {
      byDepartment[dept] = [];
    });

    idfCommunes.forEach(commune => {
      const dept = getDepartmentFromPostal(commune.postal_codes);
      if (dept && byDepartment[dept]) {
        byDepartment[dept].push(commune);
      }
    });

    console.log('Distribution by department:');
    IDF_DEPARTMENTS.forEach(dept => {
      const count = byDepartment[dept].length;
      stats.by_department[dept] = count;
      console.log(`  ${dept}: ${count} communes`);
    });
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: COMPARE WITH EXISTING HUGO PAGES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const existingPages = getExistingHugoPages();
    stats.existing_hugo_pages = existingPages.length;
    console.log(`✓ Found ${existingPages.length} existing Hugo pages\n`);

    // Create sets for comparison
    const existingSet = new Set(existingPages);
    const idfSet = new Set(idfCommunes.map(c => c.slug));

    // Find missing pages (in Supabase but not in Hugo)
    const missingPages = idfCommunes.filter(c => !existingSet.has(c.slug));
    stats.missing_pages = missingPages.length;

    // Find extra pages (in Hugo but not in Supabase IDF communes)
    const extraPages = existingPages.filter(slug => !idfSet.has(slug));
    stats.extra_pages = extraPages.length;

    console.log('Gap Analysis:');
    console.log(`  Missing pages (in Supabase, not in Hugo): ${missingPages.length}`);
    console.log(`  Extra pages (in Hugo, not in Supabase IDF): ${extraPages.length}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: SAVE RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Save all IDF communes
    const idfCommunesPath = path.join(__dirname, 'idf-communes-complete.json');
    fs.writeFileSync(idfCommunesPath, JSON.stringify(idfCommunes, null, 2));
    console.log(`✓ Saved all IDF communes to: idf-communes-complete.json`);

    // Save missing pages list
    const missingPagesPath = path.join(__dirname, 'missing-pages.json');
    fs.writeFileSync(missingPagesPath, JSON.stringify(missingPages, null, 2));
    console.log(`✓ Saved missing pages to: missing-pages.json`);

    // Save gap report
    const gapReport = {
      generated_at: new Date().toISOString(),
      stats: stats,
      missing_pages: missingPages.map(c => ({
        slug: c.slug,
        name: c.name,
        postal_codes: c.postal_codes,
        department: getDepartmentFromPostal(c.postal_codes),
        latitude: c.latitude,
        longitude: c.longitude,
        insee_code: c.insee_code
      })),
      extra_pages: extraPages
    };

    const gapReportPath = path.join(__dirname, 'gap-report.json');
    fs.writeFileSync(gapReportPath, JSON.stringify(gapReport, null, 2));
    console.log(`✓ Saved gap report to: gap-report.json`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total geographic locations in Supabase: ${stats.total_geographic_locations}`);
    console.log(`IDF communes in Supabase: ${stats.idf_communes}`);
    console.log(`Existing Hugo pages: ${stats.existing_hugo_pages}`);
    console.log(`Missing pages to create: ${stats.missing_pages}`);
    console.log(`Extra pages (not in IDF list): ${stats.extra_pages}`);
    console.log('');

    if (missingPages.length > 0) {
      console.log('First 20 missing communes:');
      missingPages.slice(0, 20).forEach((c, i) => {
        const dept = getDepartmentFromPostal(c.postal_codes);
        console.log(`  ${i + 1}. ${c.slug} (${c.name}, ${dept})`);
      });
      console.log('');
    }

    console.log('✅ Query complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run query
queryAllIDFCommunes();
