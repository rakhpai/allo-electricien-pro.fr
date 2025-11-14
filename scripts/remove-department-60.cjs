#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { createClient } = require('@supabase/supabase-js');

const DEPT_60_PAGES = [
  'beauvais',
  'chambly',
  'compiegne',
  'la-verriere',
  'margny-les-compiegne'
];

const SUPABASE_URL = 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZGJxemdyY3Flbm9wZXlqd2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU0NzE3OSwiZXhwIjoyMDc0MTIzMTc5fQ.0IauaVj0RMA1RzSTOOnvAJQ1HMXl2UPqwRSLWSMXEGk';

async function setPageToDraft(slug) {
  const filePath = `/home/proalloelectrici/hugosource/content/${slug}/index.md`;

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const { data: frontmatter, content: body } = matter(content);

    // Set draft to true
    frontmatter.draft = true;

    // Recreate the file
    const newContent = matter.stringify(body, frontmatter);
    await fs.writeFile(filePath, newContent);

    console.log(`✅ Set ${slug} to draft`);
    return { slug, success: true, action: 'set_to_draft' };
  } catch (error) {
    console.error(`❌ Error setting ${slug} to draft:`, error.message);
    return { slug, success: false, error: error.message };
  }
}

async function checkDatabase(slug) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Check pages table
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', slug);

    if (pagesError) throw pagesError;

    // Check sites/domains table
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*')
      .eq('url_slug', slug);

    if (sitesError) throw sitesError;

    return {
      slug,
      inPages: pages && pages.length > 0,
      pagesCount: pages ? pages.length : 0,
      pagesData: pages || [],
      inSites: sites && sites.length > 0,
      sitesCount: sites ? sites.length : 0,
      sitesData: sites || []
    };
  } catch (error) {
    console.error(`❌ Error checking database for ${slug}:`, error.message);
    return { slug, error: error.message };
  }
}

async function updateDatabaseStatus(slug, dbCheck) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const results = { slug, actions: [] };

  try {
    // Update pages table if records exist
    if (dbCheck.inPages) {
      const { error: pagesError } = await supabase
        .from('pages')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('slug', slug);

      if (pagesError) {
        results.actions.push({ table: 'pages', success: false, error: pagesError.message });
      } else {
        results.actions.push({ table: 'pages', success: true, count: dbCheck.pagesCount });
      }
    }

    // Update sites table if records exist
    if (dbCheck.inSites) {
      const { error: sitesError } = await supabase
        .from('sites')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('url_slug', slug);

      if (sitesError) {
        results.actions.push({ table: 'sites', success: false, error: sitesError.message });
      } else {
        results.actions.push({ table: 'sites', success: true, count: dbCheck.sitesCount });
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Error updating database for ${slug}:`, error.message);
    return { slug, error: error.message };
  }
}

async function main() {
  console.log('🗑️  Removing Department 60 Pages');
  console.log('='.repeat(80));
  console.log(`\nProcessing ${DEPT_60_PAGES.length} pages...\n`);

  const results = {
    contentUpdates: [],
    databaseChecks: [],
    databaseUpdates: []
  };

  // Step 1: Set pages to draft
  console.log('📝 Step 1: Setting pages to draft status...\n');
  for (const slug of DEPT_60_PAGES) {
    const result = await setPageToDraft(slug);
    results.contentUpdates.push(result);
  }

  // Step 2: Check database
  console.log('\n\n🔍 Step 2: Checking database for references...\n');
  for (const slug of DEPT_60_PAGES) {
    const dbCheck = await checkDatabase(slug);
    results.databaseChecks.push(dbCheck);

    console.log(`\n  ${slug}:`);
    console.log(`    Pages table: ${dbCheck.inPages ? `✓ Found (${dbCheck.pagesCount} records)` : '✗ Not found'}`);
    console.log(`    Sites table: ${dbCheck.inSites ? `✓ Found (${dbCheck.sitesCount} records)` : '✗ Not found'}`);
  }

  // Step 3: Update database
  console.log('\n\n💾 Step 3: Updating database records...\n');
  for (const dbCheck of results.databaseChecks) {
    if (dbCheck.inPages || dbCheck.inSites) {
      const updateResult = await updateDatabaseStatus(dbCheck.slug, dbCheck);
      results.databaseUpdates.push(updateResult);

      console.log(`\n  ${dbCheck.slug}:`);
      for (const action of updateResult.actions || []) {
        if (action.success) {
          console.log(`    ✅ ${action.table}: Updated ${action.count} records to inactive/draft`);
        } else {
          console.log(`    ❌ ${action.table}: ${action.error}`);
        }
      }
    } else {
      console.log(`  ${dbCheck.slug}: No database records to update`);
    }
  }

  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(80));

  const draftSuccess = results.contentUpdates.filter(r => r.success).length;
  console.log(`\n✅ Content files set to draft: ${draftSuccess}/${DEPT_60_PAGES.length}`);

  const dbPagesTotal = results.databaseChecks.filter(r => r.inPages).length;
  const dbSitesTotal = results.databaseChecks.filter(r => r.inSites).length;
  console.log(`📄 Database records found:`);
  console.log(`   - Pages table: ${dbPagesTotal} cities`);
  console.log(`   - Sites table: ${dbSitesTotal} cities`);

  const dbUpdatesSuccess = results.databaseUpdates.filter(r =>
    r.actions && r.actions.every(a => a.success)
  ).length;
  console.log(`💾 Database records updated: ${dbUpdatesSuccess}`);

  // Save detailed results
  const reportPath = '/home/proalloelectrici/hugosource/dept-60-removal-report.json';
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Detailed report saved to: ${reportPath}`);

  console.log('\n✨ Department 60 pages have been set to draft and database updated!');
}

main().catch(console.error);
