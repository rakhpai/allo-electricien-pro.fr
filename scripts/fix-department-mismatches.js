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
 * Extract expected department from postal code
 */
function getExpectedDepartment(postalCode) {
  if (!postalCode || typeof postalCode !== 'string') return null;

  if (postalCode.startsWith('75')) {
    return '75';
  }

  if (postalCode.startsWith('20')) {
    const code = parseInt(postalCode);
    if (code >= 20000 && code < 20200) return '2A';
    if (code >= 20200 && code < 20600) return '2B';
    return '20';
  }

  return postalCode.substring(0, 2);
}

/**
 * Update Hugo frontmatter
 */
async function updateHugoFrontmatter(slug, expectedDept) {
  const contentPath = path.join(__dirname, '..', 'content', slug, 'index.md');

  if (!fs.existsSync(contentPath)) {
    console.log(`  ⚠️  Hugo file not found: ${contentPath}`);
    return false;
  }

  let content = fs.readFileSync(contentPath, 'utf8');

  // Match the frontmatter department field
  const deptRegex = /^department:\s*["']?(\d+|null)["']?$/m;

  if (deptRegex.test(content)) {
    content = content.replace(deptRegex, `department: "${expectedDept}"`);
    fs.writeFileSync(contentPath, content, 'utf8');
    console.log(`  ✅ Updated Hugo frontmatter: ${slug}`);
    return true;
  } else {
    console.log(`  ⚠️  Department field not found in frontmatter: ${slug}`);
    return false;
  }
}

/**
 * Update Supabase data
 */
async function updateSupabaseData(pageId, expectedDept) {
  // Get current page data
  const { data: page, error: fetchError } = await supabase
    .from('pages')
    .select('data')
    .eq('id', pageId)
    .single();

  if (fetchError || !page) {
    console.log(`  ❌ Error fetching page: ${fetchError?.message}`);
    return false;
  }

  // Update the department in the data JSONB field
  const updatedData = {
    ...page.data,
    department: expectedDept
  };

  const { error: updateError } = await supabase
    .from('pages')
    .update({ data: updatedData })
    .eq('id', pageId);

  if (updateError) {
    console.log(`  ❌ Error updating Supabase: ${updateError.message}`);
    return false;
  }

  console.log(`  ✅ Updated Supabase record`);
  return true;
}

/**
 * Main fix function
 */
async function fixDepartmentMismatches() {
  console.log('🔧 FIXING DEPARTMENT MISMATCHES\n');
  console.log('='.repeat(80));

  // Read the mismatch report
  const reportPath = path.join(__dirname, '..', 'department-mismatches-report.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ Mismatch report not found. Please run validate-department-mismatches.js first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const mismatches = report.mismatches || [];

  console.log(`Found ${mismatches.length} mismatches to fix\n`);
  console.log('='.repeat(80));

  const results = {
    hugoUpdated: 0,
    supabaseUpdated: 0,
    hugoFailed: 0,
    supabaseFailed: 0,
    total: mismatches.length
  };

  for (let i = 0; i < mismatches.length; i++) {
    const mismatch = mismatches[i];
    console.log(`\n[${i + 1}/${mismatches.length}] ${mismatch.name} (${mismatch.slug})`);
    console.log(`  Current: ${mismatch.current_department} → Expected: ${mismatch.expected_department}`);

    // Update Hugo
    const hugoSuccess = await updateHugoFrontmatter(mismatch.slug, mismatch.expected_department);
    if (hugoSuccess) {
      results.hugoUpdated++;
    } else {
      results.hugoFailed++;
    }

    // Update Supabase
    const supabaseSuccess = await updateSupabaseData(mismatch.id, mismatch.expected_department);
    if (supabaseSuccess) {
      results.supabaseUpdated++;
    } else {
      results.supabaseFailed++;
    }
  }

  // Final report
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS');
  console.log('='.repeat(80));
  console.log(`Total mismatches: ${results.total}`);
  console.log(`Hugo updates: ${results.hugoUpdated} ✅  ${results.hugoFailed} ❌`);
  console.log(`Supabase updates: ${results.supabaseUpdated} ✅  ${results.supabaseFailed} ❌`);
  console.log('='.repeat(80));

  // Save results
  const resultsPath = path.join(__dirname, '..', 'department-fix-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${resultsPath}`);

  return results;
}

// Run fix
fixDepartmentMismatches()
  .then(results => {
    console.log('\n✅ Department mismatch fixes complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error during fixes:', error);
    process.exit(1);
  });
