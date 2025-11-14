import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eedbqzgrcqenopeyjwjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listParisVideoImages() {
  console.log('📦 Listing Paris video images in Supabase storage...\n');

  const { data, error } = await supabase.storage
    .from('processed-images')
    .list('allo-electricien.pro/video', {
      limit: 200,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Total files in video folder: ${data.length}\n`);

  // Filter Paris-related images
  const parisImages = data.filter(file =>
    file.name.includes('paris') && !file.name.includes('parisis')
  );

  console.log(`Paris video images found: ${parisImages.length}\n`);

  if (parisImages.length === 0) {
    console.log('❌ NO PARIS VIDEO IMAGES FOUND IN STORAGE');
    console.log('\nThis means the Sharp system did NOT generate video variants for Paris pages.');
    console.log('Only hero, og, and featured variants were generated.\n');
    return;
  }

  // Group by arrondissement
  const groups = {};
  parisImages.forEach(file => {
    const match = file.name.match(/paris-(\d+|1er)?-(\d{5})/);
    if (match) {
      const key = match[1] || 'main';
      if (!groups[key]) groups[key] = [];
      groups[key].push(file.name);
    } else if (file.name.includes('paris-75001')) {
      if (!groups['main']) groups['main'] = [];
      groups['main'].push(file.name);
    }
  });

  console.log('📊 Paris video images by arrondissement:\n');
  Object.keys(groups).sort().forEach(key => {
    console.log(`${key === 'main' ? 'Paris (main)' : `Paris ${key}`}: ${groups[key].length} files`);
    groups[key].slice(0, 3).forEach(name => {
      console.log(`  - ${name}`);
    });
    if (groups[key].length > 3) {
      console.log(`  ... and ${groups[key].length - 3} more`);
    }
  });

  // Check for specific patterns
  console.log('\n📋 Checking for expected file patterns:\n');
  const tests = [
    'electricien-urgence-paris-1-75001-video.jpg',
    'electricien-urgence-paris-11-75011-video.jpg',
    'electricien-urgence-paris-20-75020-video.jpg',
  ];

  tests.forEach(testFile => {
    const found = parisImages.some(f => f.name === testFile);
    console.log(`${found ? '✅' : '❌'} ${testFile}`);
  });
}

listParisVideoImages();
