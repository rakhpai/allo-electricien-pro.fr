require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkVideosTable() {
  console.log('=== CHECKING VIDEOS TABLE IN SUPABASE ===\n');
  
  const { data, error, count } = await supabase
    .from('videos')
    .select('*', { count: 'exact' })
    .limit(10);

  if (error) {
    if (error.code === '42P01') {
      console.log('❌ VIDEOS TABLE DOES NOT EXIST\n');
      console.log('Error code: 42P01 (relation does not exist)');
    } else {
      console.log('❌ Error:', error.message);
      console.log('Code:', error.code);
    }
    return;
  }

  console.log('✓ VIDEOS TABLE EXISTS\n');
  console.log('Total rows:', count);
  
  if (data && data.length > 0) {
    console.log('\nColumns:');
    Object.keys(data[0]).forEach(key => {
      console.log('  -', key);
    });
    
    console.log('\nSample rows:');
    data.slice(0, 5).forEach((row, i) => {
      console.log('Row', i + 1, ':', JSON.stringify(row, null, 2));
    });
  } else {
    console.log('\n⚠ Table is EMPTY');
  }
}

checkVideosTable().catch(err => {
  console.error('Fatal error:', err);
});
