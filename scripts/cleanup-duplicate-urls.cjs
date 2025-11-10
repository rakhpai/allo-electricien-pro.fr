#!/usr/bin/env node

/**
 * CLEANUP DUPLICATE URL ENTRIES
 * ==============================
 *
 * Identifies and removes duplicate page entries from Supabase pages table
 * where url_path contains apostrophes or other non-normalized variants.
 *
 * Keeps only the hyphenated normalized version (e.g., /saint-remy-l-honore/)
 * Deletes variants with apostrophes (e.g., /saint-remy-l'honore/)
 *
 * Usage: node scripts/cleanup-duplicate-urls.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Normalize URL by replacing apostrophes and special chars with hyphens
 * @param {string} url - URL path like "/saint-remy-l'honore/"
 * @returns {string} Normalized URL like "/saint-remy-l-honore/"
 */
function normalizeUrl(url) {
  if (!url) return url;
  // Replace both straight apostrophe (') and curly apostrophe (')
  // Also remove leading/trailing slashes for comparison
  return url
    .replace(/^\/|\/$/g, '')  // Remove leading/trailing slashes
    .replace(/['']/g, '-')    // Replace apostrophes with hyphens
    .toLowerCase();
}

/**
 * Main execution function
 */
async function cleanupDuplicates() {
  console.log('🚀 Starting duplicate URL cleanup...\n');

  try {
    // Step 1: Get domain ID for allo-electricien.pro
    console.log('📡 Fetching domain ID...');
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', 'allo-electricien.pro')
      .single();

    if (domainError || !domain) {
      throw new Error(`Domain not found: ${domainError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Domain ID: ${domain.id}\n`);

    // Step 2: Load all pages with pagination
    console.log('📡 Loading all pages from Supabase...');
    const allPages = [];
    let hasMorePages = true;
    let pageOffset = 0;
    const pageBatchSize = 1000;

    while (hasMorePages) {
      const { data: batch, error: batchError } = await supabase
        .from('pages')
        .select('id, url_path, page_type, city_id, data')
        .eq('domain_id', domain.id)
        .eq('page_type', 'city')
        .range(pageOffset, pageOffset + pageBatchSize - 1);

      if (batchError) {
        throw new Error(`Failed to load pages batch: ${batchError.message}`);
      }

      if (batch.length === 0) break;

      allPages.push(...batch);
      hasMorePages = batch.length === pageBatchSize;
      pageOffset += pageBatchSize;

      console.log(`   Loaded ${allPages.length} pages so far...`);
    }

    console.log(`✅ Loaded ${allPages.length} total pages\n`);

    // Step 3: Group pages by normalized URL
    console.log('🔄 Analyzing for duplicates...');
    const groupedByNormalizedUrl = {};

    for (const page of allPages) {
      const normalized = normalizeUrl(page.url_path);

      if (!groupedByNormalizedUrl[normalized]) {
        groupedByNormalizedUrl[normalized] = [];
      }

      groupedByNormalizedUrl[normalized].push(page);
    }

    // Step 4: Identify duplicates
    const duplicateGroups = [];
    let totalDuplicates = 0;

    for (const [normalizedUrl, pages] of Object.entries(groupedByNormalizedUrl)) {
      if (pages.length > 1) {
        duplicateGroups.push({
          normalized: normalizedUrl,
          pages: pages
        });
        totalDuplicates += pages.length - 1; // Count extras beyond the first
      }
    }

    console.log(`✅ Found ${duplicateGroups.length} URLs with duplicates (${totalDuplicates} duplicate entries)\n`);

    if (duplicateGroups.length === 0) {
      console.log('✨ No duplicates found! Database is clean.\n');
      return;
    }

    // Step 5: Display duplicates report
    console.log('📊 DUPLICATE ENTRIES REPORT:');
    console.log('━'.repeat(80));

    for (const group of duplicateGroups) {
      console.log(`\n🔍 Normalized URL: /${group.normalized}/`);
      console.log(`   Found ${group.pages.length} variants:`);

      group.pages.forEach((page, index) => {
        const hasApostrophe = /['']/.test(page.url_path);
        const marker = hasApostrophe ? '❌ [HAS APOSTROPHE]' : '✅ [NORMALIZED]';
        console.log(`   ${index + 1}. ${page.url_path} ${marker} (ID: ${page.id})`);
      });
    }

    console.log('\n' + '━'.repeat(80));

    // Step 6: Determine which entries to keep and which to delete
    console.log('\n🗑️  Preparing deletion list...');
    const toDelete = [];
    const toKeep = [];

    for (const group of duplicateGroups) {
      // Find the hyphenated (normalized) version
      const normalized = group.pages.find(p => !(/['']/.test(p.url_path)));

      if (normalized) {
        // Keep the normalized version, delete all others
        toKeep.push(normalized);
        const others = group.pages.filter(p => p.id !== normalized.id);
        toDelete.push(...others);
      } else {
        // No normalized version found, keep the first one and delete the rest
        console.log(`⚠️  Warning: No normalized version found for /${group.normalized}/, keeping first entry`);
        toKeep.push(group.pages[0]);
        toDelete.push(...group.pages.slice(1));
      }
    }

    console.log(`✅ Will keep ${toKeep.length} normalized entries`);
    console.log(`❌ Will delete ${toDelete.length} duplicate entries\n`);

    // Step 7: Display deletion plan
    console.log('📋 DELETION PLAN:');
    console.log('━'.repeat(80));

    toDelete.forEach((page, index) => {
      console.log(`${index + 1}. DELETE: ${page.url_path} (ID: ${page.id})`);
    });

    console.log('━'.repeat(80));
    console.log(`\nTotal entries to delete: ${toDelete.length}\n`);

    // Step 8: Execute deletions
    console.log('🔥 Executing deletions...');
    let successCount = 0;
    let errorCount = 0;

    for (const page of toDelete) {
      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('id', page.id);

      if (error) {
        console.error(`❌ Failed to delete ${page.url_path} (ID: ${page.id}): ${error.message}`);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`   Deleted ${successCount}/${toDelete.length} entries...`);
        }
      }
    }

    console.log(`\n✅ Deletion complete: ${successCount} deleted, ${errorCount} errors\n`);

    // Step 9: Final statistics
    console.log('📈 CLEANUP SUMMARY:');
    console.log('━'.repeat(80));
    console.log(`Original total pages:     ${allPages.length}`);
    console.log(`Duplicate groups found:   ${duplicateGroups.length}`);
    console.log(`Entries deleted:          ${successCount}`);
    console.log(`Entries kept:             ${allPages.length - successCount}`);
    console.log(`Errors encountered:       ${errorCount}`);
    console.log('━'.repeat(80));
    console.log('\n✨ Cleanup complete!\n');

    // Step 10: List URLs that were fixed
    if (successCount > 0) {
      console.log('🎉 FIXED URLS (now available only as hyphenated versions):');
      console.log('━'.repeat(80));

      const fixedUrls = new Set();
      toDelete.forEach(page => {
        if (/['']/.test(page.url_path)) {
          const normalized = page.url_path.replace(/['']/g, '-');
          fixedUrls.add(normalized);
        }
      });

      Array.from(fixedUrls).sort().forEach(url => {
        console.log(`✅ ${url}`);
      });

      console.log('━'.repeat(80));
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  cleanupDuplicates();
}

module.exports = { cleanupDuplicates };
