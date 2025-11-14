import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════');
console.log('HUGO PAGES INVESTIGATION');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Scan Hugo content directory and extract page data
 */
async function checkHugoPages() {
  const contentDir = path.resolve(__dirname, '../../../content');

  if (!fs.existsSync(contentDir)) {
    console.error(`❌ Content directory not found: ${contentDir}`);
    process.exit(1);
  }

  console.log(`Scanning content directory: ${contentDir}\n`);

  const report = {
    timestamp: new Date().toISOString(),
    content_dir: contentDir,
    total_pages: 0,
    pages_with_complete_data: 0,
    pages_missing_data: [],
    sample_pages: [],
    data_completeness: {
      has_slug: 0,
      has_city: 0,
      has_zipCode: 0,
      has_department: 0,
      has_keyword: 0,
      has_coordinates: 0
    },
    pages: []
  };

  // Read all directories in content/
  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  const directories = entries.filter(e => e.isDirectory() && e.name !== '_index');

  console.log(`Found ${directories.length} page directories\n`);

  let processed = 0;
  let errors = 0;

  for (const dir of directories) {
    const indexPath = path.join(contentDir, dir.name, 'index.md');

    if (!fs.existsSync(indexPath)) {
      continue;
    }

    try {
      const fileContent = fs.readFileSync(indexPath, 'utf8');
      const { data: frontmatter } = matter(fileContent);

      processed++;

      const pageData = {
        slug: frontmatter.slug || dir.name,
        directory: dir.name,
        city: frontmatter.city || null,
        zipCode: frontmatter.zipCode || null,
        department: frontmatter.department || null,
        keyword: frontmatter.keyword || null,
        title: frontmatter.title || null,
        coordinates: frontmatter.coordinates || null,
        images: frontmatter.images || null
      };

      // Check data completeness
      const hasSlug = !!pageData.slug;
      const hasCity = !!pageData.city;
      const hasZipCode = !!pageData.zipCode;
      const hasDepartment = !!pageData.department;
      const hasKeyword = !!pageData.keyword;
      const hasCoordinates = !!pageData.coordinates;

      if (hasSlug) report.data_completeness.has_slug++;
      if (hasCity) report.data_completeness.has_city++;
      if (hasZipCode) report.data_completeness.has_zipCode++;
      if (hasDepartment) report.data_completeness.has_department++;
      if (hasKeyword) report.data_completeness.has_keyword++;
      if (hasCoordinates) report.data_completeness.has_coordinates++;

      const isComplete = hasCity && hasZipCode && hasDepartment;

      if (isComplete) {
        report.pages_with_complete_data++;
      } else {
        const missing = [];
        if (!hasCity) missing.push('city');
        if (!hasZipCode) missing.push('zipCode');
        if (!hasDepartment) missing.push('department');

        report.pages_missing_data.push({
          slug: pageData.slug,
          missing: missing
        });
      }

      // Add to sample (first 10)
      if (report.sample_pages.length < 10) {
        report.sample_pages.push(pageData);
      }

      // Add to full list
      report.pages.push(pageData);

      // Progress indicator
      if (processed % 200 === 0) {
        console.log(`  Processed ${processed}/${directories.length} pages...`);
      }

    } catch (error) {
      errors++;
      console.error(`  ⚠️  Error reading ${dir.name}/index.md: ${error.message}`);
    }
  }

  report.total_pages = processed;

  console.log(`\n✓ Processed ${processed} pages (${errors} errors)\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DATA COMPLETENESS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const total = report.total_pages;

  console.log('Field availability:');
  console.log(`  slug:        ${report.data_completeness.has_slug}/${total} (${((report.data_completeness.has_slug/total)*100).toFixed(1)}%)`);
  console.log(`  city:        ${report.data_completeness.has_city}/${total} (${((report.data_completeness.has_city/total)*100).toFixed(1)}%)`);
  console.log(`  zipCode:     ${report.data_completeness.has_zipCode}/${total} (${((report.data_completeness.has_zipCode/total)*100).toFixed(1)}%)`);
  console.log(`  department:  ${report.data_completeness.has_department}/${total} (${((report.data_completeness.has_department/total)*100).toFixed(1)}%)`);
  console.log(`  keyword:     ${report.data_completeness.has_keyword}/${total} (${((report.data_completeness.has_keyword/total)*100).toFixed(1)}%)`);
  console.log(`  coordinates: ${report.data_completeness.has_coordinates}/${total} (${((report.data_completeness.has_coordinates/total)*100).toFixed(1)}%)`);

  console.log(`\nComplete data (city + zipCode + department):`);
  console.log(`  ${report.pages_with_complete_data}/${total} pages (${((report.pages_with_complete_data/total)*100).toFixed(1)}%)\n`);

  if (report.pages_missing_data.length > 0) {
    console.log(`⚠️  ${report.pages_missing_data.length} pages missing required data:\n`);
    report.pages_missing_data.slice(0, 10).forEach(p => {
      console.log(`  • ${p.slug}: missing ${p.missing.join(', ')}`);
    });
    if (report.pages_missing_data.length > 10) {
      console.log(`  ... and ${report.pages_missing_data.length - 10} more\n`);
    }
  } else {
    console.log('✅ All pages have complete data for SEO naming!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SAMPLE PAGES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  report.sample_pages.slice(0, 5).forEach(page => {
    console.log(`${page.slug}:`);
    console.log(`  City: ${page.city || 'N/A'}`);
    console.log(`  Zip: ${page.zipCode || 'N/A'}`);
    console.log(`  Dept: ${page.department || 'N/A'}`);
    console.log(`  Keyword: ${page.keyword || 'N/A'}`);
    if (page.images) {
      console.log(`  Images: ${JSON.stringify(page.images)}`);
    }
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SEO FILENAME PREVIEW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Generate sample SEO filenames
  const samplePages = report.sample_pages.slice(0, 5);

  console.log('Example SEO filenames that will be generated:\n');

  samplePages.forEach(page => {
    if (page.city && page.zipCode) {
      const citySlug = page.city
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const seoBase = `electricien-urgence-${citySlug}-${page.zipCode}`;

      console.log(`${page.slug}:`);
      console.log(`  hero:     ${seoBase}-hero.jpg`);
      console.log(`  og:       ${seoBase}-og.webp`);
      console.log(`  featured: ${seoBase}-featured.avif`);
      console.log(`  video:    ${seoBase}-video.jpg`);
      console.log('');
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total pages: ${report.total_pages}`);
  console.log(`Pages ready for SEO naming: ${report.pages_with_complete_data} (${((report.pages_with_complete_data/total)*100).toFixed(1)}%)`);

  if (report.pages_with_complete_data === report.total_pages) {
    console.log('\n✅ All pages have required data for SEO image naming!');
  } else {
    console.log(`\n⚠️  ${report.pages_missing_data.length} pages need data completion`);
  }

  console.log('\nNext Steps:');
  if (report.pages_missing_data.length > 0) {
    console.log('  1. Review pages with missing data');
    console.log('  2. Complete frontmatter for those pages');
    console.log('  3. Or proceed with available pages only');
  } else {
    console.log('  1. ✅ Ready to create page-to-image mapping');
    console.log('  2. ✅ Ready to generate SEO filenames');
  }

  // Save full report
  const reportPath = path.resolve(__dirname, '../../page-inventory-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved: page-inventory-report.json`);
  console.log(`  (Full data for ${report.pages.length} pages)\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

checkHugoPages().catch(error => {
  console.error('\n❌ Investigation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
