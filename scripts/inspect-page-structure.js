import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPageStructure() {
  // Get the domain ID
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  console.log('Domain ID:', domain.id, '\n');

  // Get a few sample pages
  const { data: pages } = await supabase
    .from('pages')
    .select('*')
    .eq('domain_id', domain.id)
    .limit(5);

  console.log('Sample pages structure:\n');
  pages.forEach((page, idx) => {
    console.log(`\n=== Page ${idx + 1} ===`);
    console.log('Fields available:');
    console.log(Object.keys(page));
    console.log('\nFull page object:');
    console.log(JSON.stringify(page, null, 2));
  });

  // Try to find a page with bagneux in the slug
  const { data: bagneux } = await supabase
    .from('pages')
    .select('*')
    .eq('domain_id', domain.id)
    .ilike('url_path', '%bagneux%')
    .limit(1);

  if (bagneux && bagneux.length > 0) {
    console.log('\n\n=== BAGNEUX PAGE ===');
    console.log(JSON.stringify(bagneux[0], null, 2));
  }
}

inspectPageStructure();
