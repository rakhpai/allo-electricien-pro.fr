#!/usr/bin/env node

const fs = require('fs').promises;

const DEPT_60_SLUGS = [
  'beauvais',
  'chambly',
  'compiegne',
  'la-verriere',
  'margny-les-compiegne'
];

async function removeDept60FromSites() {
  const sitesPath = '/home/proalloelectrici/hugosource/data/sites.json';

  try {
    const data = await fs.readFile(sitesPath, 'utf8');
    const sitesData = JSON.parse(data);

    const before = sitesData.sites.length;

    // Remove department 60 cities
    sitesData.sites = sitesData.sites.filter(site => {
      return !DEPT_60_SLUGS.includes(site.citySlug || site.slug);
    });

    const after = sitesData.sites.length;
    const removed = before - after;

    // Update totals
    sitesData.total_sites = sitesData.sites.length;

    // Recalculate department stats
    const deptStats = {};
    sitesData.sites.forEach(site => {
      const dept = site.zipCode ? String(site.zipCode).substring(0, 2) : null;
      if (dept) {
        deptStats[dept] = (deptStats[dept] || 0) + 1;
      }
    });

    sitesData.stats = deptStats;

    // Remove 60 from departments array if present
    if (sitesData.departments && sitesData.departments.includes('60')) {
      sitesData.departments = sitesData.departments.filter(d => d !== '60');
    }

    // Write back
    await fs.writeFile(sitesPath, JSON.stringify(sitesData, null, 2));

    console.log(`✅ sites.json: Removed ${removed} entries`);
    console.log(`   Before: ${before} sites`);
    console.log(`   After: ${after} sites`);

    return { file: 'sites.json', removed, before, after };
  } catch (error) {
    console.error(`❌ Error processing sites.json:`, error.message);
    return { file: 'sites.json', error: error.message };
  }
}

async function removeDept60FromInterlinks() {
  const interlinksPath = '/home/proalloelectrici/hugosource/data/interlinks.json';

  try {
    const exists = await fs.access(interlinksPath).then(() => true).catch(() => false);
    if (!exists) {
      console.log('ℹ️  interlinks.json not found, skipping');
      return { file: 'interlinks.json', skipped: true };
    }

    const data = await fs.readFile(interlinksPath, 'utf8');
    const interlinks = JSON.parse(data);

    let removed = 0;

    // Remove entries where the slug is one of dept 60 cities
    Object.keys(interlinks).forEach(slug => {
      if (DEPT_60_SLUGS.includes(slug)) {
        delete interlinks[slug];
        removed++;
      }
    });

    // Remove references to dept 60 cities in nearby links
    Object.keys(interlinks).forEach(slug => {
      if (interlinks[slug].nearby) {
        const before = interlinks[slug].nearby.length;
        interlinks[slug].nearby = interlinks[slug].nearby.filter(nearby => {
          return !DEPT_60_SLUGS.includes(nearby.slug);
        });
        const after = interlinks[slug].nearby.length;
        if (before !== after) {
          console.log(`   Removed ${before - after} references from ${slug}`);
        }
      }
    });

    await fs.writeFile(interlinksPath, JSON.stringify(interlinks, null, 2));

    console.log(`✅ interlinks.json: Removed ${removed} main entries and references`);

    return { file: 'interlinks.json', removed };
  } catch (error) {
    console.error(`❌ Error processing interlinks.json:`, error.message);
    return { file: 'interlinks.json', error: error.message };
  }
}

async function removeDept60FromOtherFiles() {
  const files = [
    '/home/proalloelectrici/hugosource/data/electricien_profiles.json',
    '/home/proalloelectrici/hugosource/data/commune_electricians.json',
    '/home/proalloelectrici/hugosource/data/cities-by-department.json'
  ];

  const results = [];

  for (const filePath of files) {
    try {
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        console.log(`ℹ️  ${filePath.split('/').pop()} not found, skipping`);
        continue;
      }

      const data = await fs.readFile(filePath, 'utf8');
      let jsonData = JSON.parse(data);
      let removed = 0;

      // Handle different file structures
      if (Array.isArray(jsonData)) {
        const before = jsonData.length;
        jsonData = jsonData.filter(item => {
          const slug = item.slug || item.citySlug || item.commune_slug;
          return !DEPT_60_SLUGS.includes(slug);
        });
        removed = before - jsonData.length;
      } else if (typeof jsonData === 'object') {
        Object.keys(jsonData).forEach(key => {
          if (DEPT_60_SLUGS.includes(key)) {
            delete jsonData[key];
            removed++;
          }
        });
      }

      if (removed > 0) {
        await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
        console.log(`✅ ${filePath.split('/').pop()}: Removed ${removed} entries`);
      } else {
        console.log(`✅ ${filePath.split('/').pop()}: No dept 60 entries found`);
      }

      results.push({ file: filePath.split('/').pop(), removed });
    } catch (error) {
      console.error(`❌ Error processing ${filePath.split('/').pop()}:`, error.message);
      results.push({ file: filePath.split('/').pop(), error: error.message });
    }
  }

  return results;
}

async function main() {
  console.log('🗑️  Removing Department 60 References from Data Files');
  console.log('='.repeat(80));
  console.log();

  const results = {
    sites: await removeDept60FromSites(),
    interlinks: await removeDept60FromInterlinks(),
    otherFiles: await removeDept60FromOtherFiles()
  };

  console.log();
  console.log('✅ Data cleanup complete!');

  // Save report
  const reportPath = '/home/proalloelectrici/hugosource/dept-60-data-cleanup-report.json';
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Report saved to: ${reportPath}`);
}

main().catch(console.error);
