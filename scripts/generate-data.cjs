require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function generateData() {
  console.log('=== GENERATE ALLO-ELECTRICIEN.PRO DATA ===\n');
  console.log('📊 Fetching sites from Supabase...\n');

  try {
    // Fetch all allo-electricien.pro sites
    const { data: sites, error } = await supabase
      .from('websites')
      .select(`
        id, full_domain, subdomain, city, zip, department_code,
        keyword, title, meta_description, company_name_primary,
        phone, phone_formatted, latitude, longitude, address, niche, kw_source
      `)
      .eq('domain', 'allo-electricien.pro')
      .order('city');

    if (error) {
      throw new Error(`Error fetching websites: ${error.message}`);
    }

    console.log(`✓ Found ${sites.length} sites\n`);

    // Filter out invalid entries (missing required fields)
    console.log('🔍 Validating site data...\n');
    const invalidSites = [];
    const validSites = sites.filter(site => {
      const isValid = site.subdomain &&
                      site.city &&
                      site.department_code &&
                      site.zip;

      if (!isValid) {
        invalidSites.push({
          id: site.id,
          subdomain: site.subdomain || 'null',
          city: site.city || 'null',
          department: site.department_code || 'null',
          zip: site.zip || 'null',
          company: site.company_name_primary || 'N/A'
        });
      }

      return isValid;
    });

    if (invalidSites.length > 0) {
      console.log(`⚠️  Skipped ${invalidSites.length} invalid site(s):\n`);
      invalidSites.forEach((site, i) => {
        console.log(`  ${i + 1}. ID: ${site.id}`);
        console.log(`     Subdomain: ${site.subdomain}`);
        console.log(`     City: ${site.city}`);
        console.log(`     Department: ${site.department}`);
        console.log(`     Zip: ${site.zip}`);
        console.log(`     Company: ${site.company}\n`);
      });
    }

    console.log(`✓ ${validSites.length} valid sites (${invalidSites.length} skipped)\n`);

    // Group by department for filtering
    const byDepartment = {};
    validSites.forEach(site => {
      const dept = site.department_code;
      if (!byDepartment[dept]) {
        byDepartment[dept] = [];
      }
      byDepartment[dept].push(site);
    });

    // Calculate statistics
    const stats = {
      total: validSites.length,
      departments: Object.keys(byDepartment).sort(),
      departmentCounts: {}
    };

    Object.keys(byDepartment).forEach(dept => {
      stats.departmentCounts[dept] = byDepartment[dept].length;
    });

    console.log('Department Distribution:');
    Object.entries(stats.departmentCounts).forEach(([dept, count]) => {
      console.log(`  ${dept}: ${count} sites`);
    });
    console.log('');

    // Transform data for Hugo
    const output = {
      generated_at: new Date().toISOString(),
      total_sites: validSites.length,
      departments: stats.departments,
      stats: stats.departmentCounts,
      sites: validSites.map(site => ({
        id: site.id,
        slug: site.subdomain,
        name: site.company_name_primary || 'Électricien',
        city: site.city,
        citySlug: site.subdomain,
        zipCode: site.zip,
        department: site.department_code,
        keyword: site.keyword,
        title: site.title,
        metaDescription: site.meta_description,
        phone: site.phone_formatted || site.phone || '06 44 64 48 24',
        phoneRaw: (site.phone || site.phone_formatted || '0644644824').replace(/[^0-9]/g, ''),
        url: `https://allo-electricien.pro/${site.subdomain}/`,
        fullDomain: site.full_domain,
        niche: site.niche,
        kwSource: site.kw_source,
        coordinates: {
          lat: site.latitude || 48.8566,
          lng: site.longitude || 2.3522
        }
      }))
    };

    // Write to data/sites.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = path.join(dataDir, 'sites.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`✓ Generated data/sites.json (${validSites.length} sites)\n`);

    // Also save a copy to scripts for backup
    const backupPath = path.join(__dirname, 'sites-manifest.json');
    fs.writeFileSync(backupPath, JSON.stringify(output, null, 2));
    console.log(`✓ Backup saved to scripts/sites-manifest.json\n`);

    // Show sample data
    console.log('=== SAMPLE DATA (First 5 sites) ===\n');
    output.sites.slice(0, 5).forEach((site, i) => {
      console.log(`${i + 1}. ${site.slug}`);
      console.log(`   City: ${site.city} (${site.zipCode})`);
      console.log(`   Keyword: ${site.keyword}`);
      console.log(`   Company: ${site.name}`);
      console.log(`   Phone: ${site.phone}`);
      console.log(`   URL: ${site.url}`);
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DATA GENERATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Total sites: ${output.total_sites}`);
    console.log(`Departments: ${output.departments.join(', ')}`);
    console.log('\nNext step: npm run content\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

generateData();
