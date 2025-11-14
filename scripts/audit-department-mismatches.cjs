#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');

const VALID_IDF_DEPARTMENTS = ['75', '77', '78', '91', '92', '93', '94', '95'];
const CONTENT_DIR = '/home/proalloelectrici/hugosource/content';

async function getAllCityPages() {
  const allFiles = [];

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip certain directories
          if (['electricien', 'conseils', 'services', 'profile', 'profiles'].includes(entry.name)) {
            continue;
          }
          await scan(fullPath);
        } else if (entry.name === 'index.md' && dir !== CONTENT_DIR) {
          // This is a city page (not root index)
          allFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await scan(CONTENT_DIR);
  return allFiles;
}

async function auditPage(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const { data: frontmatter } = matter(content);

  const citySlug = path.basename(path.dirname(filePath));
  const department = frontmatter.department ? String(frontmatter.department).trim() : null;
  const postalCode = frontmatter.postal_code || frontmatter.postalCode || null;
  const title = frontmatter.title || citySlug;

  const issues = [];

  // Check if department exists and is valid
  if (!department || department === 'null' || department === '') {
    issues.push('missing_department');
  } else if (!VALID_IDF_DEPARTMENTS.includes(department)) {
    issues.push('outside_idf');
  }

  // Check postal code mismatch
  if (postalCode && department && department !== 'null') {
    const postalDept = String(postalCode).substring(0, 2);
    if (postalDept !== department) {
      issues.push('postal_code_mismatch');
    }
  }

  return {
    slug: citySlug,
    path: filePath,
    title,
    department,
    postalCode,
    issues,
    draft: frontmatter.draft || false
  };
}

async function main() {
  console.log('🔍 Starting comprehensive department audit...\n');

  const cityPages = await getAllCityPages();
  console.log(`Found ${cityPages.length} city pages to audit\n`);

  const results = {
    total: cityPages.length,
    valid: 0,
    outsideIDF: [],
    missingDepartment: [],
    postalCodeMismatch: [],
    draft: [],
    byDepartment: {}
  };

  for (const filePath of cityPages) {
    try {
      const audit = await auditPage(filePath);

      if (audit.draft) {
        results.draft.push(audit);
      }

      if (audit.issues.length === 0) {
        results.valid++;
      }

      if (audit.issues.includes('outside_idf')) {
        results.outsideIDF.push(audit);
      }

      if (audit.issues.includes('missing_department')) {
        results.missingDepartment.push(audit);
      }

      if (audit.issues.includes('postal_code_mismatch')) {
        results.postalCodeMismatch.push(audit);
      }

      // Count by department
      const dept = audit.department || 'null';
      if (!results.byDepartment[dept]) {
        results.byDepartment[dept] = [];
      }
      results.byDepartment[dept].push(audit);

    } catch (error) {
      console.error(`Error auditing ${filePath}:`, error.message);
    }
  }

  // Generate report
  console.log('📊 AUDIT RESULTS');
  console.log('='.repeat(80));
  console.log(`\nTotal pages: ${results.total}`);
  console.log(`Valid pages (IDF, no issues): ${results.valid}`);
  console.log(`Draft pages: ${results.draft.length}`);
  console.log(`\n🚨 ISSUES FOUND:`);
  console.log(`  • Outside Île-de-France: ${results.outsideIDF.length}`);
  console.log(`  • Missing department: ${results.missingDepartment.length}`);
  console.log(`  • Postal code mismatch: ${results.postalCodeMismatch.length}`);

  console.log(`\n📍 PAGES BY DEPARTMENT:`);
  const sortedDepts = Object.keys(results.byDepartment).sort();
  for (const dept of sortedDepts) {
    const count = results.byDepartment[dept].length;
    const isValid = VALID_IDF_DEPARTMENTS.includes(dept);
    const marker = isValid ? '✓' : '✗';
    console.log(`  ${marker} ${dept}: ${count} pages`);
  }

  // Detailed reports
  if (results.outsideIDF.length > 0) {
    console.log(`\n\n🚨 PAGES OUTSIDE ÎLE-DE-FRANCE (${results.outsideIDF.length}):`);
    console.log('='.repeat(80));
    for (const page of results.outsideIDF) {
      console.log(`\n  ${page.slug}`);
      console.log(`    Department: ${page.department}`);
      console.log(`    Postal Code: ${page.postalCode || 'N/A'}`);
      console.log(`    Path: ${page.path}`);
      console.log(`    Draft: ${page.draft}`);
    }
  }

  if (results.missingDepartment.length > 0) {
    console.log(`\n\n⚠️  PAGES WITH MISSING DEPARTMENT (${results.missingDepartment.length}):`);
    console.log('='.repeat(80));
    for (const page of results.missingDepartment) {
      console.log(`\n  ${page.slug}`);
      console.log(`    Department: ${page.department || 'MISSING'}`);
      console.log(`    Postal Code: ${page.postalCode || 'N/A'}`);
      console.log(`    Path: ${page.path}`);
    }
  }

  if (results.postalCodeMismatch.length > 0) {
    console.log(`\n\n⚠️  PAGES WITH POSTAL CODE MISMATCH (${results.postalCodeMismatch.length}):`);
    console.log('='.repeat(80));
    for (const page of results.postalCodeMismatch) {
      const postalDept = page.postalCode ? String(page.postalCode).substring(0, 2) : 'N/A';
      console.log(`\n  ${page.slug}`);
      console.log(`    Department in frontmatter: ${page.department}`);
      console.log(`    Department from postal code: ${postalDept}`);
      console.log(`    Postal Code: ${page.postalCode}`);
      console.log(`    Path: ${page.path}`);
    }
  }

  // Save JSON report
  const reportPath = '/home/proalloelectrici/hugosource/department-audit-report.json';
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n\n✅ Full report saved to: ${reportPath}`);

  // Save CSV for easy review
  const csvPath = '/home/proalloelectrici/hugosource/department-audit-report.csv';
  const csvLines = ['slug,department,postal_code,issues,draft,path'];

  for (const page of [...results.outsideIDF, ...results.missingDepartment, ...results.postalCodeMismatch]) {
    const row = [
      page.slug,
      page.department || '',
      page.postalCode || '',
      page.issues.join(';'),
      page.draft,
      page.path
    ].map(v => `"${v}"`).join(',');
    csvLines.push(row);
  }

  await fs.writeFile(csvPath, csvLines.join('\n'));
  console.log(`✅ CSV report saved to: ${csvPath}`);
}

main().catch(console.error);
