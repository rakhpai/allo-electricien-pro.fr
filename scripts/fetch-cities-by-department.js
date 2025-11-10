require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== FETCH CITIES GROUPED BY DEPARTMENT ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Fetch and group cities by department
 */
async function fetchCitiesByDepartment() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: GET DOMAIN ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Find allo-electricien.pro domain
  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', 'allo-electricien.pro')
    .limit(1);

  if (domainsError || !domains || domains.length === 0) {
    console.error('❌ Could not find allo-electricien.pro domain');
    process.exit(1);
  }

  const domainId = domains[0].id;
  console.log(`✓ Found domain: ${domains[0].domain} (${domainId})\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: FETCH CITY PAGES FROM SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fetch all city pages (page_type = 'city')
  let pages = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('domain_id', domainId)
      .eq('page_type', 'city')
      .order('url_path')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pagesError) {
      console.error('❌ Error fetching pages:', pagesError.message);
      process.exit(1);
    }

    if (pageData && pageData.length > 0) {
      pages = pages.concat(pageData);
      page++;
      hasMore = pageData.length === pageSize;
      console.log(`  Fetched page ${page}: ${pageData.length} pages (total: ${pages.length})`);
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✓ Found ${pages.length} city pages in database\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: GROUP CITIES BY DEPARTMENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const departmentGroups = {};
  const targetDepartments = ['75', '77', '78', '91', '92', '93', '94', '95'];

  for (const page of pages) {
    const pageData = page.data || {};
    const department = pageData.department;

    // Only include target IDF departments
    if (!department || !targetDepartments.includes(department)) {
      continue;
    }

    if (!departmentGroups[department]) {
      departmentGroups[department] = {
        department,
        cities: []
      };
    }

    // Extract city info
    const citySlug = page.url_path === '/' ? '' : page.url_path.replace(/^\//, '').replace(/\/$/, '');

    departmentGroups[department].cities.push({
      name: pageData.city_name || page.title,
      slug: citySlug,
      url: page.url_path,
      zipCode: pageData.zip_code || null,
      priority: pageData.sitemap_priority || 0.5
    });
  }

  // Sort cities within each department by priority (high to low), then alphabetically
  for (const dept in departmentGroups) {
    departmentGroups[dept].cities.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.name.localeCompare(b.name, 'fr');
    });

    console.log(`  ${dept}: ${departmentGroups[dept].cities.length} cities`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: WRITE TO DATA FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const outputPath = path.join(__dirname, '..', 'data', 'cities-by-department.json');

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(departmentGroups, null, 2), 'utf8');
  console.log(`✓ Successfully wrote to: ${outputPath}`);

  // Get file size
  const fileStats = fs.statSync(outputPath);
  const fileSizeKB = (fileStats.size / 1024).toFixed(2);
  console.log(`  File size: ${fileSizeKB} KB`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FETCH COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Summary:');
  Object.entries(departmentGroups).forEach(([dept, data]) => {
    const topCities = data.cities.slice(0, 3).map(c => c.name).join(', ');
    console.log(`  ${dept} (${data.cities.length} cities): ${topCities}...`);
  });

  console.log(`\n✓ Data saved to: data/cities-by-department.json\n`);
}

// Run fetch
fetchCitiesByDepartment().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
