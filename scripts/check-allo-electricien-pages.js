require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('=== CHECK ALLO-ELECTRICIEN.PRO PAGES IN SUPABASE ===\n');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Main check function
 */
async function checkAlloElectricienPages() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: FIND ALLO-ELECTRICIEN.PRO DOMAIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Try to find the domains table
  const { data: domains, error: domainsError } = await supabase
    .from('domains')
    .select('*')
    .ilike('domain', '%allo-electricien%');

  if (domainsError) {
    console.log('⚠️  Could not query domains table:', domainsError.message);
    console.log('   Attempting to search pages directly by URL...\n');
  } else if (domains && domains.length > 0) {
    console.log(`✓ Found ${domains.length} matching domain(s):`);
    domains.forEach(d => {
      console.log(`  - ${d.domain} (ID: ${d.id})`);
    });
    console.log('');
  } else {
    console.log('⚠️  No matching domains found in domains table\n');
  }

  const domainId = domains && domains.length > 0 ? domains[0].id : null;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: COUNT ALLO-ELECTRICIEN.PRO PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Count pages by URL pattern
  const { count: urlCount, error: urlCountError } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .ilike('url', '%allo-electricien.pro%');

  if (urlCountError) {
    console.error('❌ Error counting pages by URL:', urlCountError.message);
  } else {
    console.log(`✓ Pages matching 'allo-electricien.pro' in URL: ${urlCount || 0}`);
  }

  // If we have a domain_id, count by that too
  if (domainId) {
    const { count: domainCount, error: domainCountError } = await supabase
      .from('pages')
      .select('*', { count: 'exact', head: true })
      .eq('domain_id', domainId);

    if (domainCountError) {
      console.error('❌ Error counting pages by domain_id:', domainCountError.message);
    } else {
      console.log(`✓ Pages with domain_id '${domainId}': ${domainCount || 0}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: FETCH SAMPLE ALLO-ELECTRICIEN.PRO PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: samplePages, error: sampleError } = await supabase
    .from('pages')
    .select('*')
    .ilike('url', '%allo-electricien.pro%')
    .limit(10);

  if (sampleError) {
    console.error('❌ Error fetching sample pages:', sampleError.message);
  } else if (samplePages && samplePages.length > 0) {
    console.log(`✓ Found ${samplePages.length} sample pages:\n`);
    samplePages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.url_path || page.url}`);
      console.log(`   Title: ${page.title || 'N/A'}`);
      console.log(`   City ID: ${page.city_id || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('❌ No allo-electricien.pro pages found in the database!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: ANALYZE HUGO CONTENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const contentDir = path.join(__dirname, '..', 'content');
  let hugoPages = [];

  if (fs.existsSync(contentDir)) {
    const entries = fs.readdirSync(contentDir, { withFileTypes: true });
    const directories = entries.filter(entry => entry.isDirectory());

    console.log(`✓ Found ${directories.length} directories in content/`);

    // Sample first 10
    console.log('\nSample Hugo pages:');
    directories.slice(0, 10).forEach((dir, index) => {
      console.log(`${index + 1}. ${dir.name}`);
    });

    hugoPages = directories.map(d => d.name);
  } else {
    console.log('⚠️  Content directory not found');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const summary = {
    domain_id: domainId,
    pages_in_supabase: urlCount || 0,
    pages_in_hugo: hugoPages.length,
    gap: hugoPages.length - (urlCount || 0),
    domain_found: domains && domains.length > 0,
    timestamp: new Date().toISOString()
  };

  console.log('Summary:');
  console.log(`  Domain found in database:         ${summary.domain_found ? 'Yes' : 'No'}`);
  console.log(`  Domain ID:                        ${summary.domain_id || 'N/A'}`);
  console.log(`  Pages in Supabase:                ${summary.pages_in_supabase}`);
  console.log(`  Pages in Hugo content/:           ${summary.pages_in_hugo}`);
  console.log(`  Gap (pages to add):               ${summary.gap}`);

  // Save report
  const reportPath = path.join(__dirname, 'allo-electricien-pages-check.json');
  const report = {
    summary,
    sample_pages: samplePages || [],
    domains: domains || [],
    hugo_pages_sample: hugoPages.slice(0, 20)
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved to: scripts/allo-electricien-pages-check.json`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (summary.gap > 0) {
    console.log('💡 Next step: Import Hugo pages to Supabase');
    console.log(`   Need to add ${summary.gap} pages for allo-electricien.pro`);
  } else if (summary.gap === 0) {
    console.log('✓ All Hugo pages are already in Supabase!');
  } else {
    console.log('⚠️  More pages in Supabase than in Hugo content/');
  }

  console.log('');
}

// Run check
checkAlloElectricienPages().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
