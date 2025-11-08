const fs = require('fs');
const path = require('path');

console.log('=== ANALYZE MISSING COMMUNES PRIORITIES ===\n');

// Load data files
const gapReport = JSON.parse(fs.readFileSync(path.join(__dirname, 'gap-report.json'), 'utf8'));
const communeElectricians = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commune_electricians.json'), 'utf8'));
const sitesData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sites.json'), 'utf8'));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('DATA LOADED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`Missing communes from Supabase: ${gapReport.missing_pages.length}`);
console.log(`Communes with electrician data: ${Object.keys(communeElectricians).length}`);
console.log(`Sites in sites.json: ${sitesData.sites.length}`);
console.log('');

// Create a set of slugs that have electrician data
const electricianSlugs = new Set(Object.keys(communeElectricians));

// Create a set of slugs that are in sites.json (from websites table)
const websiteSlugs = new Set(sitesData.sites.map(s => s.slug));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PRIORITY CATEGORIZATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const priorities = {
  critical: [],      // Has electrician data AND website entry
  high: [],          // Has electrician data but NO website entry
  medium: [],        // Has website entry but NO electrician data
  low: []            // Neither electrician data nor website entry
};

gapReport.missing_pages.forEach(commune => {
  const hasElectricians = electricianSlugs.has(commune.slug);
  const hasWebsite = websiteSlugs.has(commune.slug);

  if (hasElectricians && hasWebsite) {
    priorities.critical.push(commune);
  } else if (hasElectricians) {
    priorities.high.push(commune);
  } else if (hasWebsite) {
    priorities.medium.push(commune);
  } else {
    priorities.low.push(commune);
  }
});

console.log('Priority Breakdown:');
console.log(`  CRITICAL (has electricians + website):  ${priorities.critical.length} communes`);
console.log(`  HIGH (has electricians only):           ${priorities.high.length} communes`);
console.log(`  MEDIUM (has website only):              ${priorities.medium.length} communes`);
console.log(`  LOW (neither):                          ${priorities.low.length} communes`);
console.log(`  TOTAL:                                  ${gapReport.missing_pages.length} communes`);
console.log('');

// Breakdown by department for each priority level
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('DEPARTMENT BREAKDOWN BY PRIORITY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

function groupByDepartment(communes) {
  const byDept = {};
  communes.forEach(c => {
    if (!byDept[c.department]) byDept[c.department] = [];
    byDept[c.department].push(c);
  });
  return byDept;
}

const departments = ['75', '77', '78', '91', '92', '93', '94', '95'];

console.log('CRITICAL Priority by Department:');
const criticalByDept = groupByDepartment(priorities.critical);
departments.forEach(dept => {
  const count = criticalByDept[dept] ? criticalByDept[dept].length : 0;
  if (count > 0) console.log(`  ${dept}: ${count} communes`);
});
console.log('');

console.log('HIGH Priority by Department:');
const highByDept = groupByDepartment(priorities.high);
departments.forEach(dept => {
  const count = highByDept[dept] ? highByDept[dept].length : 0;
  if (count > 0) console.log(`  ${dept}: ${count} communes`);
});
console.log('');

// Show examples of critical priority communes
if (priorities.critical.length > 0) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CRITICAL PRIORITY COMMUNES (First 20)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  priorities.critical.slice(0, 20).forEach((c, i) => {
    const elecCount = communeElectricians[c.slug] ? communeElectricians[c.slug].length : 0;
    console.log(`${i + 1}. ${c.slug} (${c.name}, ${c.department}) - ${elecCount} electricians`);
  });
  console.log('');
}

// Show examples of high priority communes
if (priorities.high.length > 0) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('HIGH PRIORITY COMMUNES (First 20)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  priorities.high.slice(0, 20).forEach((c, i) => {
    const elecCount = communeElectricians[c.slug] ? communeElectricians[c.slug].length : 0;
    console.log(`${i + 1}. ${c.slug} (${c.name}, ${c.department}) - ${elecCount} electricians`);
  });
  console.log('');
}

// Save prioritized lists
const output = {
  generated_at: new Date().toISOString(),
  summary: {
    total_missing: gapReport.missing_pages.length,
    critical: priorities.critical.length,
    high: priorities.high.length,
    medium: priorities.medium.length,
    low: priorities.low.length
  },
  priorities: {
    critical: priorities.critical,
    high: priorities.high,
    medium: priorities.medium,
    low: priorities.low
  },
  department_breakdown: {
    critical: criticalByDept,
    high: highByDept,
    medium: groupByDepartment(priorities.medium),
    low: groupByDepartment(priorities.low)
  }
};

const outputPath = path.join(__dirname, 'prioritized-communes.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`✓ Saved prioritized communes to: prioritized-communes.json\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('RECOMMENDATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const phase1 = priorities.critical.length + priorities.high.length;
const phase2 = priorities.medium.length;
const phase3 = priorities.low.length;

console.log(`Phase 1 (CRITICAL + HIGH): ${phase1} communes with electrician data`);
console.log(`Phase 2 (MEDIUM):          ${phase2} communes with website data`);
console.log(`Phase 3 (LOW):             ${phase3} communes (optional)`);
console.log('');
console.log(`Total to create for full coverage: ${gapReport.missing_pages.length} communes\n`);
