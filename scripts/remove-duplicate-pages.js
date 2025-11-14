import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Remove Hugo content directory
 */
function removeHugoContent(slug) {
  const contentPath = path.join(__dirname, '..', 'content', slug);

  if (!fs.existsSync(contentPath)) {
    console.log(`  ⚠️  Hugo directory not found: ${slug}`);
    return false;
  }

  try {
    fs.rmSync(contentPath, { recursive: true, force: true });
    console.log(`  ✅ Removed Hugo directory: ${slug}`);
    return true;
  } catch (error) {
    console.log(`  ❌ Error removing Hugo directory: ${error.message}`);
    return false;
  }
}

/**
 * Remove Supabase page record
 */
async function removeSupabasePage(pageId, slug) {
  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', pageId);

  if (error) {
    console.log(`  ❌ Error removing from Supabase: ${error.message}`);
    return false;
  }

  console.log(`  ✅ Removed from Supabase: ${slug}`);
  return true;
}

/**
 * Update interlinks.json to remove references to deleted pages
 */
function updateInterlinks(duplicateSlugs, canonicalMap) {
  const interlinksPath = path.join(__dirname, '..', 'data', 'interlinks.json');

  if (!fs.existsSync(interlinksPath)) {
    console.log('  ⚠️  interlinks.json not found');
    return false;
  }

  try {
    const interlinks = JSON.parse(fs.readFileSync(interlinksPath, 'utf8'));
    let modified = false;

    // Remove interlinks for duplicate slugs and replace with canonical
    for (const [duplicateSlug, canonicalSlug] of Object.entries(canonicalMap)) {
      if (interlinks[duplicateSlug]) {
        delete interlinks[duplicateSlug];
        modified = true;
        console.log(`  Removed interlink: ${duplicateSlug}`);
      }

      // Replace references in other interlinks
      for (const [key, value] of Object.entries(interlinks)) {
        if (Array.isArray(value)) {
          const updated = value.map(link =>
            link === duplicateSlug ? canonicalSlug : link
          );
          if (JSON.stringify(updated) !== JSON.stringify(value)) {
            interlinks[key] = updated;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      fs.writeFileSync(interlinksPath, JSON.stringify(interlinks, null, 2));
      console.log(`  ✅ Updated interlinks.json`);
      return true;
    } else {
      console.log(`  ℹ️  No changes needed in interlinks.json`);
      return true;
    }
  } catch (error) {
    console.log(`  ❌ Error updating interlinks: ${error.message}`);
    return false;
  }
}

/**
 * Create Hugo redirect rules (_redirects file)
 */
function createRedirectsFile(redirectRules) {
  const publicPath = path.join(__dirname, '..', 'public');
  const redirectsPath = path.join(publicPath, '_redirects');

  // Create public directory if it doesn't exist
  if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
  }

  // Read existing redirects if any
  let existingRedirects = '';
  if (fs.existsSync(redirectsPath)) {
    existingRedirects = fs.readFileSync(redirectsPath, 'utf8');
  }

  // Append new redirects
  const newRedirects = redirectRules.join('\n');
  const allRedirects = existingRedirects ? `${existingRedirects}\n${newRedirects}` : newRedirects;

  fs.writeFileSync(redirectsPath, allRedirects);
  console.log(`  ✅ Updated _redirects file with ${redirectRules.length} rules`);

  return true;
}

/**
 * Main removal function
 */
async function removeDuplicatePages(dryRun = true) {
  console.log('🗑️  REMOVING DUPLICATE PAGES\n');
  console.log('='.repeat(80));

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made');
    console.log('='.repeat(80));
  }

  // Read the duplicate report
  const reportPath = path.join(__dirname, '..', 'duplicate-pages-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ Duplicate report not found. Please run identify-duplicate-pages.js first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const duplicateGroups = report.duplicate_groups || [];

  // Flatten all duplicates
  const allDuplicates = [];
  const canonicalMap = {};
  const redirectRules = [];

  duplicateGroups.forEach(group => {
    group.duplicates.forEach(dup => {
      allDuplicates.push({
        ...dup,
        canonical_slug: group.canonical.slug
      });
      canonicalMap[dup.slug] = group.canonical.slug;
      redirectRules.push(`/${dup.slug}  /${group.canonical.slug}  301`);
    });
  });

  console.log(`Found ${allDuplicates.length} duplicate pages to remove\n`);
  console.log('='.repeat(80));

  const results = {
    hugoRemoved: 0,
    supabaseRemoved: 0,
    hugoFailed: 0,
    supabaseFailed: 0,
    total: allDuplicates.length,
    dryRun: dryRun
  };

  for (let i = 0; i < allDuplicates.length; i++) {
    const dup = allDuplicates[i];
    console.log(`\n[${i + 1}/${allDuplicates.length}] ${dup.city_name} (${dup.slug})`);
    console.log(`  Will redirect to: ${dup.canonical_slug}`);

    if (!dryRun) {
      // Remove Hugo content
      const hugoSuccess = removeHugoContent(dup.slug);
      if (hugoSuccess) {
        results.hugoRemoved++;
      } else {
        results.hugoFailed++;
      }

      // Remove from Supabase
      const supabaseSuccess = await removeSupabasePage(dup.id, dup.slug);
      if (supabaseSuccess) {
        results.supabaseRemoved++;
      } else {
        results.supabaseFailed++;
      }
    } else {
      console.log(`  [DRY RUN] Would remove Hugo directory: content/${dup.slug}/`);
      console.log(`  [DRY RUN] Would remove from Supabase: ${dup.id}`);
    }
  }

  // Update interlinks
  if (!dryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 Updating interlinks.json...\n');
    updateInterlinks(canonicalMap, canonicalMap);
  }

  // Create redirects file
  if (!dryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('📝 Creating redirect rules...\n');
    createRedirectsFile(redirectRules);
  }

  // Final report
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS');
  console.log('='.repeat(80));
  console.log(`Total duplicates: ${results.total}`);
  if (!dryRun) {
    console.log(`Hugo removals: ${results.hugoRemoved} ✅  ${results.hugoFailed} ❌`);
    console.log(`Supabase removals: ${results.supabaseRemoved} ✅  ${results.supabaseFailed} ❌`);
  } else {
    console.log(`Would remove: ${results.total} pages`);
  }
  console.log('='.repeat(80));

  // Save results
  const resultsPath = path.join(__dirname, '..', 'duplicate-removal-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${resultsPath}`);

  if (dryRun) {
    console.log('\n💡 To actually perform the removal, run with --no-dry-run flag');
  }

  return results;
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--no-dry-run');

// Run removal
removeDuplicatePages(dryRun)
  .then(results => {
    console.log('\n✅ Duplicate removal process complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error during removal:', error);
    process.exit(1);
  });
