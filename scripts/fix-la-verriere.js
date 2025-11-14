import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLaVerriere() {
  const pageId = '300fd4ee-0a07-4c28-97d6-830120f73793';

  // Get current page
  const { data: page } = await supabase
    .from('pages')
    .select('data')
    .eq('id', pageId)
    .single();

  console.log('Current department:', page.data.department);

  // Update department
  const updatedData = {
    ...page.data,
    department: '60'
  };

  const { error } = await supabase
    .from('pages')
    .update({ data: updatedData })
    .eq('id', pageId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Updated La Verriere department from 78 to 60');
  }
}

fixLaVerriere();
