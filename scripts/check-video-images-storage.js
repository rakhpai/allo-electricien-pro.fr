import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listVideoImages() {
  console.log('📦 Checking video images in Supabase storage...\n');

  const { data, error } = await supabase.storage
    .from('processed-images')
    .list('allo-electricien.pro/video', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${data.length} video image files:\n`);

  // Filter Paris-related images
  const parisImages = data.filter(file => file.name.includes('paris'));

  console.log('Paris video images:');
  parisImages.forEach(file => {
    console.log(`  ${file.name} (${(file.metadata?.size / 1024).toFixed(1)} KB)`);
  });

  // Check for different naming patterns
  console.log('\n📊 Image naming patterns found:');
  const patterns = {
    'with-urgence': parisImages.filter(f => f.name.includes('urgence')).length,
    'without-urgence': parisImages.filter(f => !f.name.includes('urgence')).length,
    'jpg': parisImages.filter(f => f.name.endsWith('.jpg')).length,
    'webp': parisImages.filter(f => f.name.endsWith('.webp')).length,
    'avif': parisImages.filter(f => f.name.endsWith('.avif')).length,
  };

  console.log(`  With 'urgence': ${patterns['with-urgence']}`);
  console.log(`  Without 'urgence': ${patterns['without-urgence']}`);
  console.log(`  JPG: ${patterns.jpg}`);
  console.log(`  WebP: ${patterns.webp}`);
  console.log(`  AVIF: ${patterns.avif}`);

  // List a few examples
  console.log('\n📝 Sample file names:');
  parisImages.slice(0, 10).forEach(file => {
    console.log(`  ${file.name}`);
  });
}

listVideoImages();
