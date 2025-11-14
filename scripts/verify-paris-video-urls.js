import https from 'https';

const testUrls = [
  'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/video/electricien-urgence-paris-1-75001-video.jpg',
  'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/video/electricien-urgence-paris-11-75011-video.jpg',
  'https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/video/electricien-urgence-paris-20-75020-video.jpg',
];

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve({ url, status: res.statusCode, size: res.headers['content-length'] });
      res.resume(); // Consume response data to free up memory
    }).on('error', (error) => {
      resolve({ url, status: 'ERROR', error: error.message });
    });
  });
}

async function main() {
  console.log('🔍 Verifying Paris video image URLs...\n');

  for (const url of testUrls) {
    const result = await checkUrl(url);
    const filename = url.split('/').pop();

    if (result.status === 200) {
      const sizeKB = (parseInt(result.size) / 1024).toFixed(1);
      console.log(`✅ ${filename}`);
      console.log(`   Status: ${result.status} | Size: ${sizeKB} KB`);
    } else {
      console.log(`❌ ${filename}`);
      console.log(`   Status: ${result.status || result.error}`);
    }
  }

  console.log('\n✅ Verification complete!');
}

main();
