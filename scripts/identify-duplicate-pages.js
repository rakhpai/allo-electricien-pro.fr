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
 * Normalize a city name/slug for comparison
 * Removes apostrophes, hyphens, and converts to lowercase
 */
function normalizeCityName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['\u2019]/g, '') // Remove apostrophes
    .replace(/-/g, '') // Remove hyphens
    .replace(/\s+/g, '') // Remove spaces
    .normalize('NFD') // Normalize accents
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

/**
 * Determine which slug format to keep as canonical
 * Priority:
 * 1. For Paris: Keep "paris-1er" or "paris-8e" format (with 'er' or 'e')
 * 2. For apostrophes: Keep hyphenated version without apostrophe (e.g., "l-hay-les-roses")
 * 3. Shorter slugs are generally preferred
 */
function getCanonicalSlug(slugs) {
  // Check if this is a Paris arrondissement group
  const parisArrdt = slugs.find(s => /^paris-\d+(er|e)$/.test(s));
  if (parisArrdt) return parisArrdt;

  // Check for special "paris-ville"
  if (slugs.includes('paris') && slugs.length > 1) {
    // If we have both "paris" and "paris-ville", keep "paris"
    if (slugs.includes('paris-ville')) {
      return 'paris';
    }
  }

  // For apostrophe cities, prefer the hyphenated version
  // e.g., "l-hay-les-roses" over "l'hay-les-roses" or "lhay-les-roses"
  const hyphenatedWithL = slugs.find(s => s.startsWith('l-') && s.includes('-') && s.split('-').length > 2);
  if (hyphenatedWithL) return hyphenatedWithL;

  const hyphenatedWithD = slugs.find(s => /d-[a-z]/.test(s) && s.includes('-'));
  if (hyphenatedWithD) return hyphenatedWithD;

  // Otherwise, prefer shorter slugs
  return slugs.sort((a, b) => a.length - b.length)[0];
}

/**
 * Identify all duplicate pages
 */
async function identifyDuplicatePages() {
  console.log('🔍 Fetching domain ID for allo-electricien.pro...\n');

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

  // Get total count first
  const { count } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id);

  console.log(`Total pages to fetch: ${count}\n`);

  // Fetch all pages with pagination
  let allPages = [];
  const pageSize = 1000;
  let offset = 0;

  while (offset < count) {
    const { data: pageBatch, error } = await supabase
      .from('pages')
      .select('id, url_path, data, city_id')
      .eq('domain_id', domain.id)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('❌ Error fetching pages:', error);
      process.exit(1);
    }

    allPages = allPages.concat(pageBatch);
    offset += pageSize;
    console.log(`  Fetched ${allPages.length} / ${count} pages...`);
  }

  const pages = allPages;
  console.log(`\n✅ Fetched ${pages.length} pages\n`);
  console.log('🔍 Analyzing for duplicates...\n');

  // Group pages by normalized city name AND by Paris arrondissement pattern
  const cityGroups = new Map();

  for (const page of pages) {
    const data = page.data || {};
    const cityName = data.city_name || 'Unknown';
    const slug = page.url_path?.replace(/^\/|\/$/g, '') || 'unknown';

    // Check if this is a Paris arrondissement
    const parisMatch = slug.match(/^paris-(\d+)(e|er)?(-arrondissement)?$/);
    let normalizedName;

    if (parisMatch) {
      // Group Paris arrondissements by their number
      const arrondissementNum = parisMatch[1];
      normalizedName = `paris-arrondissement-${arrondissementNum}`;
    } else {
      // Normal city name normalization
      normalizedName = normalizeCityName(cityName);
    }

    if (!cityGroups.has(normalizedName)) {
      cityGroups.set(normalizedName, []);
    }

    cityGroups.get(normalizedName).push({
      id: page.id,
      slug: slug,
      city_name: cityName,
      postal_code: data.zip_code || data.postal_code,
      department: data.department,
      city_id: page.city_id,
      url: `https://allo-electricien.pro/${slug}/`
    });
  }

  // Find groups with duplicates
  const duplicateGroups = [];
  for (const [normalizedName, group] of cityGroups.entries()) {
    if (group.length > 1) {
      // Sort by slug to make canonical selection consistent
      group.sort((a, b) => a.slug.localeCompare(b.slug));

      const slugs = group.map(p => p.slug);
      const canonicalSlug = getCanonicalSlug(slugs);
      const canonical = group.find(p => p.slug === canonicalSlug);
      const duplicates = group.filter(p => p.slug !== canonicalSlug);

      duplicateGroups.push({
        normalized_name: normalizedName,
        city_name: group[0].city_name,
        canonical: canonical,
        duplicates: duplicates,
        total_count: group.length,
        all_slugs: slugs
      });
    }
  }

  // Sort by number of duplicates (descending)
  duplicateGroups.sort((a, b) => b.total_count - a.total_count);

  // Generate report
  console.log('📊 DUPLICATE DETECTION RESULTS');
  console.log('='.repeat(80));
  console.log(`Total pages analyzed: ${pages.length}`);
  console.log(`Unique cities: ${cityGroups.size}`);
  console.log(`Cities with duplicates: ${duplicateGroups.length}`);
  console.log(`Total duplicate pages: ${duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0)}`);
  console.log('='.repeat(80));
  console.log();

  // Display sample duplicate groups
  if (duplicateGroups.length > 0) {
    console.log('🚨 SAMPLE DUPLICATE GROUPS (first 10):');
    console.log('-'.repeat(80));
    duplicateGroups.slice(0, 10).forEach((group, idx) => {
      console.log(`\n${idx + 1}. ${group.city_name} (${group.total_count} pages)`);
      console.log(`   ✅ KEEP: ${group.canonical.slug}`);
      console.log(`   ❌ REMOVE:`);
      group.duplicates.forEach(dup => {
        console.log(`      - ${dup.slug} → redirect to ${group.canonical.slug}`);
      });
    });
    console.log('\n' + '-'.repeat(80));
  }

  // Save detailed CSV report
  const csvPath = path.join(__dirname, '..', 'duplicate-pages-report.csv');
  const csvRows = [];

  duplicateGroups.forEach(group => {
    group.duplicates.forEach(dup => {
      csvRows.push(
        `${dup.id},"${group.city_name}",${dup.slug},${group.canonical.slug},${dup.url},${group.canonical.url}`
      );
    });
  });

  const csvHeaders = 'ID,City Name,Duplicate Slug,Canonical Slug,Duplicate URL,Canonical URL\n';
  fs.writeFileSync(csvPath, csvHeaders + csvRows.join('\n'));
  console.log(`\n📄 Detailed CSV report saved to: ${csvPath}`);

  // Save JSON report
  const jsonPath = path.join(__dirname, '..', 'duplicate-pages-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    summary: {
      total_pages: pages.length,
      unique_cities: cityGroups.size,
      cities_with_duplicates: duplicateGroups.length,
      total_duplicate_pages: duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0),
      generated_at: new Date().toISOString()
    },
    duplicate_groups: duplicateGroups
  }, null, 2));

  console.log(`📄 Detailed JSON report saved to: ${jsonPath}`);

  // Generate redirect rules file
  const redirectsPath = path.join(__dirname, '..', 'redirects.txt');
  const redirectRules = duplicateGroups.flatMap(group =>
    group.duplicates.map(dup =>
      `/${dup.slug}  /${group.canonical.slug}  301`
    )
  );

  fs.writeFileSync(redirectsPath, redirectRules.join('\n'));
  console.log(`📄 Redirect rules saved to: ${redirectsPath}`);
  console.log(`   (${redirectRules.length} redirect rules generated)`);

  // Show breakdown by duplicate count
  console.log('\n📈 DUPLICATE GROUPS BY COUNT:');
  console.log('-'.repeat(80));
  const countBreakdown = {};
  duplicateGroups.forEach(g => {
    const count = g.total_count;
    countBreakdown[count] = (countBreakdown[count] || 0) + 1;
  });

  Object.entries(countBreakdown)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
    .forEach(([count, groupCount]) => {
      console.log(`  ${count} versions: ${groupCount} cities`);
    });

  return {
    duplicateGroups,
    totalPages: pages.length,
    uniqueCities: cityGroups.size
  };
}

// Run duplicate detection
identifyDuplicatePages()
  .then(result => {
    console.log('\n✅ Duplicate detection complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error during duplicate detection:', error);
    process.exit(1);
  });
