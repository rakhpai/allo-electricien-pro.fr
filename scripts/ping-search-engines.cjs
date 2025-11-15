const https = require('https');
const http = require('http');

console.log('=== PING SEARCH ENGINES ===\n');

const BASE_URL = 'https://allo-electricien.pro/';
const sitemaps = [
  BASE_URL + 'sitemap.xml',
  BASE_URL + 'video_sitemap.xml'
];

// Ping Google
function pingGoogle(sitemapUrl) {
  return new Promise(function(resolve, reject) {
    const pingUrl = 'https://www.google.com/ping?sitemap=' + encodeURIComponent(sitemapUrl);

    console.log('Pinging Google for: ' + sitemapUrl);

    https.get(pingUrl, function(res) {
      if (res.statusCode === 200) {
        console.log('  SUCCESS: Google pinged successfully\n');
        resolve({ service: 'Google', sitemap: sitemapUrl, success: true });
      } else {
        console.log('  WARNING: Google returned status ' + res.statusCode + '\n');
        resolve({ service: 'Google', sitemap: sitemapUrl, success: false, status: res.statusCode });
      }
    }).on('error', function(err) {
      console.log('  ERROR: ' + err.message + '\n');
      reject({ service: 'Google', sitemap: sitemapUrl, error: err.message });
    });
  });
}

// Ping Bing
function pingBing(sitemapUrl) {
  return new Promise(function(resolve, reject) {
    const pingUrl = 'https://www.bing.com/ping?sitemap=' + encodeURIComponent(sitemapUrl);

    console.log('Pinging Bing for: ' + sitemapUrl);

    https.get(pingUrl, function(res) {
      if (res.statusCode === 200) {
        console.log('  SUCCESS: Bing pinged successfully\n');
        resolve({ service: 'Bing', sitemap: sitemapUrl, success: true });
      } else {
        console.log('  WARNING: Bing returned status ' + res.statusCode + '\n');
        resolve({ service: 'Bing', sitemap: sitemapUrl, success: false, status: res.statusCode });
      }
    }).on('error', function(err) {
      console.log('  ERROR: ' + err.message + '\n');
      reject({ service: 'Bing', sitemap: sitemapUrl, error: err.message });
    });
  });
}

// Main function
async function pingAllSitemaps() {
  const results = [];

  console.log('Pinging search engines for ' + sitemaps.length + ' sitemaps...\n');

  for (const sitemap of sitemaps) {
    try {
      // Ping Google
      const googleResult = await pingGoogle(sitemap);
      results.push(googleResult);

      // Wait 1 second between pings
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Ping Bing
      const bingResult = await pingBing(sitemap);
      results.push(bingResult);

      // Wait 1 second between sitemaps
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      results.push(error);
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter(function(r) { return r.success === true; }).length;
  const failed = results.filter(function(r) { return r.success === false || r.error; }).length;

  console.log('Total pings sent: ' + results.length);
  console.log('Successful: ' + successful);
  console.log('Failed: ' + failed);
  console.log('');

  console.log('NEXT STEPS:');
  console.log('  1. Monitor indexing in Google Search Console');
  console.log('  2. Monitor indexing in Bing Webmaster Tools');
  console.log('  3. Check for video rich snippets in 7-14 days');
  console.log('  4. Submit sitemaps manually if pings failed\n');
}

// Run
pingAllSitemaps().catch(function(error) {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
