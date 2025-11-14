import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://gxrlkvobbbemidojwqcs.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract expected department from postal code
 * French postal codes: first 2 digits = department (with special cases)
 */
function getExpectedDepartment(postalCode) {
  if (!postalCode || typeof postalCode !== 'string') return null;

  // Handle Paris special cases (75001-75020)
  if (postalCode.startsWith('75')) {
    return '75';
  }

  // Handle Corsica special cases
  if (postalCode.startsWith('20')) {
    const code = parseInt(postalCode);
    if (code >= 20000 && code < 20200) return '2A'; // Corse-du-Sud
    if (code >= 20200 && code < 20600) return '2B'; // Haute-Corse
    return '20'; // Generic
  }

  // Standard: first 2 digits
  return postalCode.substring(0, 2);
}

/**
 * Validate all pages and identify department mismatches
 */
async function validateDepartmentMismatches() {
  console.log('🔍 Fetching domain ID for allo-electricien.pro...\n');

  // Get the domain ID for allo-electricien.pro
  const { data: domain, error: domainError } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  if (domainError || !domain) {
    console.error('❌ Error fetching domain:', domainError);
    process.exit(1);
  }

  console.log(`✅ Found domain ID: ${domain.id}\n`);
  console.log('🔍 Fetching all pages from Supabase...\n');

  const { data: pages, error } = await supabase
    .from('pages')
    .select('id, url_path, data, city_id')
    .eq('domain_id', domain.id);

  if (error) {
    console.error('❌ Error fetching pages:', error);
    process.exit(1);
  }

  console.log(`✅ Fetched ${pages.length} pages\n`);

  const mismatches = [];
  const validPages = [];
  const missingData = [];

  for (const page of pages) {
    const data = page.data || {};
    const cityName = data.city_name || data.commune || 'Unknown';
    const postalCode = data.zip_code || data.postal_code || data.code_postal;
    const department = data.department || data.departement;
    const slug = page.url_path?.replace(/^\/|\/$/g, '') || 'unknown';

    // Skip if missing critical data
    if (!postalCode || !department) {
      missingData.push({
        id: page.id,
        name: cityName,
        slug: slug,
        postal_code: postalCode || 'MISSING',
        department: department || 'MISSING',
        issue: 'Missing postal code or department',
        url: `https://allo-electricien.pro/${slug}/`
      });
      continue;
    }

    const expectedDept = getExpectedDepartment(postalCode);
    const currentDept = department.toString();

    if (expectedDept !== currentDept) {
      mismatches.push({
        id: page.id,
        name: cityName,
        slug: slug,
        postal_code: postalCode,
        current_department: currentDept,
        expected_department: expectedDept,
        city_id: page.city_id,
        url: `https://allo-electricien.pro/${slug}/`
      });
    } else {
      validPages.push(page);
    }
  }

  // Generate report
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(60));
  console.log(`Total pages analyzed: ${pages.length}`);
  console.log(`✅ Valid pages: ${validPages.length}`);
  console.log(`❌ Mismatches found: ${mismatches.length}`);
  console.log(`⚠️  Missing data: ${missingData.length}`);
  console.log('='.repeat(60));
  console.log();

  // Display sample mismatches
  if (mismatches.length > 0) {
    console.log('🚨 SAMPLE MISMATCHES (first 10):');
    console.log('-'.repeat(60));
    mismatches.slice(0, 10).forEach(m => {
      console.log(`${m.name} (${m.postal_code})`);
      console.log(`  Current: ${m.current_department} → Expected: ${m.expected_department}`);
      console.log(`  URL: ${m.url}`);
      console.log();
    });
  }

  // Save detailed CSV report
  const csvPath = path.join(__dirname, '..', 'department-mismatches-report.csv');
  const csvHeaders = 'ID,Name,Slug,Postal Code,Current Department,Expected Department,City ID,URL\n';
  const csvRows = mismatches.map(m =>
    `${m.id},"${m.name}",${m.slug},${m.postal_code},${m.current_department},${m.expected_department},${m.city_id || ''},${m.url}`
  ).join('\n');

  fs.writeFileSync(csvPath, csvHeaders + csvRows);
  console.log(`📄 Detailed CSV report saved to: ${csvPath}`);

  // Save JSON report
  const jsonPath = path.join(__dirname, '..', 'department-mismatches-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    summary: {
      total_pages: pages.length,
      valid_pages: validPages.length,
      mismatches: mismatches.length,
      missing_data: missingData.length,
      generated_at: new Date().toISOString()
    },
    mismatches,
    missing_data: missingData
  }, null, 2));

  console.log(`📄 Detailed JSON report saved to: ${jsonPath}`);
  console.log();

  // Show department breakdown
  const deptCounts = {};
  mismatches.forEach(m => {
    const key = `${m.current_department} → ${m.expected_department}`;
    deptCounts[key] = (deptCounts[key] || 0) + 1;
  });

  console.log('📈 MISMATCHES BY DEPARTMENT TRANSITION:');
  console.log('-'.repeat(60));
  Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
      console.log(`${key}: ${count} pages`);
    });

  return {
    mismatches,
    missingData,
    validPages: validPages.length,
    totalPages: pages.length
  };
}

// Run validation
validateDepartmentMismatches()
  .then(result => {
    console.log('\n✅ Validation complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error during validation:', error);
    process.exit(1);
  });
