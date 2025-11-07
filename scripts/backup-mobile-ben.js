require('dotenv').config({ path: require('path').join(__dirname, '../../websites-supabase-project/.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backupMobileBen() {
  console.log('📦 Starting backup of mobile_ben phone numbers...\n');

  try {
    // Query all mobile_ben records
    const { data: records, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('source', 'mobile_ben')
      .order('id');

    if (error) {
      throw error;
    }

    console.log(`✅ Retrieved ${records.length} mobile_ben records`);

    // Create backup object with metadata
    const backup = {
      timestamp: new Date().toISOString(),
      total_records: records.length,
      records: records,
      statistics: {
        total: records.length,
        available: records.filter(r => r.status === 'available').length,
        in_use: records.filter(r => r.status === 'in_use').length,
        assigned: records.filter(r => r.assigned_to_website_id !== null).length,
        unassigned: records.filter(r => r.assigned_to_website_id === null).length
      }
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `mobile-ben-backup-${timestamp}.json`;
    const backupPath = path.join(__dirname, 'backups', filename);

    // Create backups directory if it doesn't exist
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Write backup file
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    console.log('\n📊 Backup Statistics:');
    console.log(`   Total records: ${backup.statistics.total}`);
    console.log(`   Available: ${backup.statistics.available}`);
    console.log(`   In use: ${backup.statistics.in_use}`);
    console.log(`   Assigned to websites: ${backup.statistics.assigned}`);
    console.log(`   Unassigned: ${backup.statistics.unassigned}`);
    console.log(`\n✅ Backup saved to: ${backupPath}`);

    return backupPath;

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

backupMobileBen();
