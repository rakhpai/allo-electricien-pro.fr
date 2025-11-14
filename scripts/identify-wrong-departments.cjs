#!/usr/bin/env node

/**
 * IDENTIFY CITIES WITH WRONG DEPARTMENT DATA
 * ==========================================
 *
 * Analyzes interlinks.json to find cities whose department assignment
 * is likely wrong based on their interlinking patterns.
 *
 * Logic: If a city's links all go to a different department,
 * the city's department is probably wrong.
 *
 * Output: SQL commands to correct the department data
 *
 * Usage: node scripts/identify-wrong-departments.cjs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Load and analyze interlinks data
 */
async function analyzeWrongDepartments() {
  console.log('🔍 Analyzing wrong department assignments...\n');

  try {
    // Load interlinks data
    const interlinksPath = path.join(__dirname, '..', 'data', 'interlinks.json');
    const interlinksData = JSON.parse(fs.readFileSync(interlinksPath, 'utf8'));

    // Step 1: Build department map (what each city is listed as)
    console.log('📊 Building department map from current data...');
    const cityDepartments = {};

    Object.keys(interlinksData.by_city).forEach(slug => {
      const links = interlinksData.by_city[slug];
      links.forEach(link => {
        if (!cityDepartments[link.slug]) {
          cityDepartments[link.slug] = link.department;
        }
      });
    });

    console.log(`✅ Mapped ${Object.keys(cityDepartments).length} cities\n`);

    // Step 2: Analyze cross-department patterns
    console.log('🔍 Analyzing cross-department linking patterns...\n');

    const wrongDepartments = [];

    Object.keys(interlinksData.by_city).forEach(slug => {
      const links = interlinksData.by_city[slug];
      if (links.length === 0) return;

      const cityDept = cityDepartments[slug];
      if (!cityDept) return;

      // Count links by department
      const linkDeptCounts = {};
      links.forEach(link => {
        const dept = link.department;
        linkDeptCounts[dept] = (linkDeptCounts[dept] || 0) + 1;
      });

      // Calculate cross-department percentage
      const sameDeptCount = linkDeptCounts[cityDept] || 0;
      const crossDeptCount = links.length - sameDeptCount;
      const crossPct = (crossDeptCount / links.length * 100).toFixed(0);

      // If 75%+ of links go to another department, likely wrong
      if (crossPct >= 75) {
        // Find the most common department in links
        const mostCommonDept = Object.keys(linkDeptCounts).reduce((a, b) =>
          linkDeptCounts[a] > linkDeptCounts[b] ? a : b
        );

        wrongDepartments.push({
          slug: slug,
          currentDept: cityDept,
          inferredDept: mostCommonDept,
          totalLinks: links.length,
          sameDeptLinks: sameDeptCount,
          crossDeptLinks: crossDeptCount,
          crossPct: parseInt(crossPct),
          linksByDept: linkDeptCounts
        });
      }
    });

    // Sort by cross-percentage (worst first)
    wrongDepartments.sort((a, b) => b.crossPct - a.crossPct);

    // Step 3: Display results
    console.log('=' .repeat(80));
    console.log('CITIES WITH LIKELY WRONG DEPARTMENT ASSIGNMENT');
    console.log('=' .repeat(80));
    console.log(`\nFound ${wrongDepartments.length} cities with 75%+ cross-department links\n`);

    wrongDepartments.forEach((city, i) => {
      console.log(`${i + 1}. ${city.slug}`);
      console.log(`   Current dept: ${city.currentDept} (WRONG)`);
      console.log(`   Inferred dept: ${city.inferredDept} (based on ${city.linksByDept[city.inferredDept]}/${city.totalLinks} links)`);
      console.log(`   Cross-dept: ${city.crossDeptLinks}/${city.totalLinks} links (${city.crossPct}%)\n`);
    });

    // Step 4: Fetch page and location data from Supabase
    console.log('\n📡 Fetching page data from Supabase...');

    const { data: domain } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', 'allo-electricien.pro')
      .single();

    const slugs = wrongDepartments.map(c => `/${c.slug}`);

    const { data: pages } = await supabase
      .from('pages')
      .select('id, url_path, geographic_target_id, data')
      .eq('domain_id', domain.id)
      .in('url_path', slugs);

    console.log(`✅ Found ${pages.length} pages in database\n`);

    // Step 5: Generate SQL fix commands
    console.log('=' .repeat(80));
    console.log('SQL COMMANDS TO FIX DEPARTMENT DATA');
    console.log('=' .repeat(80));
    console.log('\n-- UPDATE geographic_locations table\n');

    const sqlCommands = [];
    const uniqueGeoIds = new Set();

    wrongDepartments.forEach(city => {
      const page = pages.find(p => p.url_path === `/${city.slug}`);
      if (!page || !page.geographic_target_id) return;

      uniqueGeoIds.add(page.geographic_target_id);

      sqlCommands.push({
        geoId: page.geographic_target_id,
        slug: city.slug,
        oldDept: city.currentDept,
        newDept: city.inferredDept
      });
    });

    // Generate UPDATE statements for geographic_locations
    console.log('-- Add department column if not exists');
    console.log('ALTER TABLE geographic_locations ADD COLUMN IF NOT EXISTS department VARCHAR(3);\n');

    console.log('-- Update department values');
    sqlCommands.forEach(cmd => {
      console.log(`UPDATE geographic_locations SET department = '${cmd.newDept}' WHERE id = '${cmd.geoId}'; -- ${cmd.slug} (was ${cmd.oldDept})`);
    });

    console.log('\n-- UPDATE pages table (data->department field)\n');
    sqlCommands.forEach(cmd => {
      console.log(`UPDATE pages SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{department}', '"${cmd.newDept}"') WHERE geographic_target_id = '${cmd.geoId}'; -- ${cmd.slug}`);
    });

    // Step 6: Save report
    const reportPath = path.join(__dirname, '..', 'department-corrections-report.json');
    const report = {
      generated_at: new Date().toISOString(),
      total_analyzed: Object.keys(interlinksData.by_city).length,
      cities_with_wrong_dept: wrongDepartments.length,
      threshold: '75% cross-department links',
      corrections: wrongDepartments,
      sql_commands: sqlCommands
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${reportPath}\n`);

    // Step 7: Summary statistics
    console.log('=' .repeat(80));
    console.log('SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total cities analyzed:         ${Object.keys(interlinksData.by_city).length}`);
    console.log(`Cities with wrong department:  ${wrongDepartments.length}`);
    console.log(`Geographic IDs to update:      ${uniqueGeoIds.size}`);
    console.log(`\nDepartment corrections needed:`);

    const deptChanges = {};
    sqlCommands.forEach(cmd => {
      const key = `${cmd.oldDept} → ${cmd.newDept}`;
      deptChanges[key] = (deptChanges[key] || 0) + 1;
    });

    Object.keys(deptChanges).sort().forEach(change => {
      console.log(`  ${change}: ${deptChanges[change]} cities`);
    });

    console.log('\n✨ Analysis complete!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  analyzeWrongDepartments();
}

module.exports = { analyzeWrongDepartments };
