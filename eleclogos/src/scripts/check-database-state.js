import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('DATABASE STATE INVESTIGATION');
console.log('═══════════════════════════════════════════════════════════\n');

/**
 * Check database tables and records
 */
async function checkDatabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const report = {
    timestamp: new Date().toISOString(),
    tables: {},
    sites: [],
    summary: {}
  };

  const tables = [
    { name: 'sites', key_field: 'domain' },
    { name: 'source_images', key_field: 'filename' },
    { name: 'image_variants', key_field: 'variant_type' },
    { name: 'image_usage', key_field: 'page_id' },
    { name: 'image_generation_queue', key_field: 'status' },
    { name: 'image_statistics', key_field: 'stat_date' }
  ];

  console.log('Checking database tables...\n');

  for (const table of tables) {
    console.log(`━━━ ${table.name.toUpperCase()} ━━━\n`);

    // Count total records
    const { count, error: countError } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`  ❌ Error: ${countError.message}\n`);
      report.tables[table.name] = {
        exists: false,
        error: countError.message
      };
      continue;
    }

    report.tables[table.name] = {
      exists: true,
      count: count || 0
    };

    console.log(`  ✓ Table exists`);
    console.log(`  Records: ${count || 0}\n`);

    // Get sample data for specific tables
    if (table.name === 'sites' && count > 0) {
      const { data: sites } = await supabase
        .from('sites')
        .select('*')
        .limit(5);

      if (sites) {
        report.sites = sites;
        console.log('  Sites configured:');
        sites.forEach(site => {
          console.log(`    • ${site.domain} (${site.active ? 'active' : 'inactive'})`);
          console.log(`      Name: ${site.name}`);
          if (site.watermark_config) {
            console.log(`      Logo: ${site.watermark_config.logo?.path || 'not set'}`);
            console.log(`      CTA: ${site.watermark_config.cta?.path || 'not set'}`);
          }
        });
        console.log('');
      }
    }

    if (table.name === 'source_images' && count > 0) {
      const { data: samples } = await supabase
        .from('source_images')
        .select('image_number, filename, width, height, file_size, format')
        .order('image_number')
        .limit(5);

      if (samples) {
        console.log('  Sample source images:');
        samples.forEach(img => {
          const sizeMB = ((img.file_size || 0) / 1024 / 1024).toFixed(2);
          console.log(`    • #${img.image_number}: ${img.filename} (${img.width}×${img.height}, ${sizeMB} MB)`);
        });
        console.log('');
      }

      // Get statistics
      const { data: stats } = await supabase
        .from('source_images')
        .select('image_number')
        .order('image_number');

      if (stats) {
        const numbers = stats.map(s => s.image_number).sort((a, b) => a - b);
        const missing = [];
        for (let i = 1; i <= 342; i++) {
          if (!numbers.includes(i)) {
            missing.push(i);
          }
        }

        report.tables[table.name].image_numbers = {
          min: numbers[0],
          max: numbers[numbers.length - 1],
          missing: missing
        };

        if (missing.length > 0) {
          console.log(`  ⚠️  Missing image numbers: ${missing.length}`);
          if (missing.length <= 10) {
            console.log(`     ${missing.join(', ')}\n`);
          } else {
            console.log(`     ${missing.slice(0, 10).join(', ')}, ... and ${missing.length - 10} more\n`);
          }
        } else {
          console.log('  ✅ All image numbers 1-342 present\n');
        }
      }
    }

    if (table.name === 'image_variants' && count > 0) {
      // Get breakdown by variant type
      const { data: byType } = await supabase
        .from('image_variants')
        .select('variant_type')
        .limit(10000);

      if (byType) {
        const typeCounts = {};
        byType.forEach(v => {
          typeCounts[v.variant_type] = (typeCounts[v.variant_type] || 0) + 1;
        });

        console.log('  By variant type:');
        Object.entries(typeCounts).forEach(([type, count]) => {
          console.log(`    ${type.padEnd(10)}: ${count}`);
        });
        console.log('');

        report.tables[table.name].by_type = typeCounts;
      }

      // Get breakdown by format
      const { data: byFormat } = await supabase
        .from('image_variants')
        .select('format')
        .limit(10000);

      if (byFormat) {
        const formatCounts = {};
        byFormat.forEach(v => {
          formatCounts[v.format] = (formatCounts[v.format] || 0) + 1;
        });

        console.log('  By format:');
        Object.entries(formatCounts).forEach(([format, count]) => {
          console.log(`    ${format.toUpperCase().padEnd(10)}: ${count}`);
        });
        console.log('');

        report.tables[table.name].by_format = formatCounts;
      }
    }

    if (table.name === 'image_usage' && count > 0) {
      const { data: samples } = await supabase
        .from('image_usage')
        .select('page_id, page_url, variant_id')
        .limit(5);

      if (samples) {
        console.log('  Sample page assignments:');
        samples.forEach(u => {
          console.log(`    • ${u.page_url || u.page_id}`);
        });
        console.log('');
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sitesCount = report.tables.sites?.count || 0;
  const sourcesCount = report.tables.source_images?.count || 0;
  const variantsCount = report.tables.image_variants?.count || 0;
  const usageCount = report.tables.image_usage?.count || 0;

  console.log('Table Status:');
  tables.forEach(t => {
    const status = report.tables[t.name];
    if (status.exists) {
      console.log(`  ✓ ${t.name.padEnd(25)}: ${status.count} records`);
    } else {
      console.log(`  ❌ ${t.name.padEnd(25)}: Missing or error`);
    }
  });

  console.log('\nData Readiness:');

  if (sitesCount > 0) {
    console.log('  ✅ Sites configured');
  } else {
    console.log('  ⚠️  No sites configured');
  }

  if (sourcesCount === 342) {
    console.log('  ✅ All 342 source images in database');
  } else if (sourcesCount > 0) {
    console.log(`  ⏳ ${sourcesCount}/342 source images in database`);
  } else {
    console.log('  ℹ️  No source images in database yet (need to populate from storage)');
  }

  const expectedVariants = 342 * 4 * 3; // 4,104 for base system, or 16,404 for per-page
  if (variantsCount === expectedVariants) {
    console.log(`  ✅ All ${expectedVariants} variants generated`);
  } else if (variantsCount > 0) {
    console.log(`  ⏳ ${variantsCount} variants generated`);
  } else {
    console.log('  ℹ️  No variants generated yet (ready to generate)');
  }

  if (usageCount > 0) {
    console.log(`  ✓ ${usageCount} page-to-image assignments`);
  } else {
    console.log('  ℹ️  No page assignments yet');
  }

  report.summary = {
    sites_count: sitesCount,
    sources_count: sourcesCount,
    sources_complete: sourcesCount === 342,
    variants_count: variantsCount,
    variants_expected: expectedVariants,
    usage_count: usageCount,
    ready_for_generation: sitesCount > 0 && sourcesCount === 342 && variantsCount === 0
  };

  console.log('\nNext Steps:');
  if (!report.tables.sites?.exists) {
    console.log('  1. Run database migration (create tables)');
  } else if (sitesCount === 0) {
    console.log('  1. Create site configuration');
  } else if (sourcesCount === 0) {
    console.log('  1. Populate source_images table from Supabase storage');
  } else if (sourcesCount < 342) {
    console.log(`  1. Complete source_images table (${342 - sourcesCount} missing)`);
  } else if (variantsCount === 0) {
    console.log('  1. ✅ Ready to generate variants!');
  } else {
    console.log(`  1. Continue variant generation (${variantsCount}/${expectedVariants} complete)`);
  }

  // Save report
  const reportPath = path.resolve(__dirname, '../../database-state-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report saved: database-state-report.json\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

checkDatabase().catch(error => {
  console.error('\n❌ Investigation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
