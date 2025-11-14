#!/usr/bin/env node

const data = require('../data/interlinks.json');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('VERIFICATION: DEPARTMENT FILTERING');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Build department map (what each city is listed as)
const cityDepartments = {};
Object.keys(data.by_city).forEach(slug => {
  const links = data.by_city[slug];
  links.forEach(link => {
    if (!cityDepartments[link.slug]) {
      cityDepartments[link.slug] = link.department;
    }
  });
});

// Check for cross-department links
let crossDeptLinks = 0;
let totalLinks = 0;
const citiesWithCrossDept = [];

Object.keys(data.by_city).forEach(slug => {
  const links = data.by_city[slug];
  if (links.length === 0) return;

  const cityDept = cityDepartments[slug];
  if (!cityDept) return;

  let cityHasCrossDept = false;
  links.forEach(link => {
    totalLinks++;
    if (link.department !== cityDept) {
      crossDeptLinks++;
      cityHasCrossDept = true;
    }
  });

  if (cityHasCrossDept) {
    citiesWithCrossDept.push(slug);
  }
});

console.log('Results:');
console.log(`  Total cities: ${Object.keys(data.by_city).length}`);
console.log(`  Total links: ${totalLinks}`);
console.log(`  Cross-department links: ${crossDeptLinks}`);
console.log(`  Cities with cross-dept links: ${citiesWithCrossDept.length}`);

if (crossDeptLinks > 0) {
  console.log('\n⚠️  WARNING: Still found cross-department links!');
  console.log('\nExamples:');

  for (let i = 0; i < Math.min(5, citiesWithCrossDept.length); i++) {
    const slug = citiesWithCrossDept[i];
    const cityDept = cityDepartments[slug];
    const links = data.by_city[slug];

    console.log(`\n${slug} (dept ${cityDept}):`);
    links.forEach((link, j) => {
      const mark = link.department !== cityDept ? ' ❌ CROSS-DEPT' : '';
      console.log(`  ${j+1}. ${link.city} (${link.department}) - ${link.distance_km}km${mark}`);
    });
  }
} else {
  console.log('\n✅ SUCCESS: No cross-department links found!');
  console.log('   All cities now only link to communes in same department.');
}

// Sample check: Versailles
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('SAMPLE: VERSAILLES (Dept 78)');
console.log('═══════════════════════════════════════════════════════════════════\n');

const versailles = data.by_city['versailles'];
if (versailles) {
  versailles.forEach((link, i) => {
    console.log(`  ${i+1}. ${link.city} (${link.department}) - ${link.distance_km}km`);
  });

  const depts = [...new Set(versailles.map(l => l.department))];
  console.log(`\n  Departments in links: ${depts.join(', ')}`);
  console.log(`  ✅ All links in same department: ${depts.length === 1 && depts[0] === '78'}`);
}

console.log('\n═══════════════════════════════════════════════════════════════════\n');
