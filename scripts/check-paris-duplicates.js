import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParisDuplicates() {
  // Get the domain ID
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('domain', 'allo-electricien.pro')
    .single();

  console.log('Domain ID:', domain.id, '\n');

  // Count total pages
  const { count } = await supabase
    .from('pages')
    .select('*', { count: 'exact', head: true })
    .eq('domain_id', domain.id);

  console.log(`Total pages in database: ${count}\n`);

  // Look for Paris-related pages
  const { data: parisPages } = await supabase
    .from('pages')
    .select('id, url_path, data')
    .eq('domain_id', domain.id)
    .ilike('url_path', '%paris%')
    .order('url_path');

  console.log(`Paris-related pages found: ${parisPages.length}\n`);

  // Group them
  console.log('Paris pages:');
  parisPages.forEach(page => {
    const slug = page.url_path?.replace(/^\/|\/$/g, '');
    const cityName = page.data?.city_name || 'Unknown';
    console.log(`  ${slug} → ${cityName}`);
  });

  // Check for beauvais
  const { data: beauvaisPages } = await supabase
    .from('pages')
    .select('id, url_path, data')
    .eq('domain_id', domain.id)
    .ilike('url_path', '%beauvais%');

  if (beauvaisPages && beauvaisPages.length > 0) {
    console.log(`\n\nBeauvais pages found: ${beauvaisPages.length}`);
    beauvaisPages.forEach(page => {
      const slug = page.url_path?.replace(/^\/|\/$/g, '');
      const data = page.data || {};
      console.log(`  ${slug}`);
      console.log(`    City: ${data.city_name}`);
      console.log(`    Postal: ${data.zip_code}`);
      console.log(`    Dept: ${data.department}`);
    });
  }
}

checkParisDuplicates();
