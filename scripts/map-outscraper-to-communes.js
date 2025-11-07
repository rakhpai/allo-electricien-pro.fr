const fs = require('fs');
const path = require('path');

console.log('=== MAP OUTSCRAPER ELECTRICIANS TO COMMUNES ===\n');

// Haversine formula to calculate distance between two coordinates in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Load Outscraper data
const outscraperPath = path.join(__dirname, '..', 'Outscraper-electrician.json');
if (!fs.existsSync(outscraperPath)) {
  console.error('❌ Error: Outscraper-electrician.json not found');
  process.exit(1);
}

console.log('📊 Loading Outscraper electrician data...');
const allElectricians = JSON.parse(fs.readFileSync(outscraperPath, 'utf8'));
console.log(`   Total listings: ${allElectricians.length}`);

// Filter to only electricians with phone numbers
const electriciansWithPhone = allElectricians.filter(e => e.phone && e.phone.trim());
console.log(`   With phone numbers: ${electriciansWithPhone.length}`);
console.log('');

// Load commune data
const sitesPath = path.join(__dirname, '..', 'data', 'sites.json');
if (!fs.existsSync(sitesPath)) {
  console.error('❌ Error: data/sites.json not found');
  console.error('   Run "npm run data" first');
  process.exit(1);
}

console.log('🏘️  Loading commune data...');
const sitesData = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
console.log(`   Total communes: ${sitesData.total_sites}`);
console.log('');

// Process each commune
console.log('🔍 Finding 3 nearest electricians for each commune...\n');
const MAX_DISTANCE_KM = 10; // 10km radius
const mapping = {};
let totalMatches = 0;
let communesWithFull3 = 0;
let communesWithSome = 0;
let communesWithNone = 0;

sitesData.sites.forEach((commune, index) => {
  if (!commune.slug || !commune.coordinates) {
    return;
  }

  const communeLat = commune.coordinates.lat;
  const communeLng = commune.coordinates.lng;

  // Calculate distance to all electricians
  const distances = electriciansWithPhone.map(elec => ({
    electrician: elec,
    distance: calculateDistance(communeLat, communeLng, elec.latitude, elec.longitude)
  }));

  // Filter within 10km and sort by distance, then rating, then reviews
  const nearby = distances
    .filter(d => d.distance <= MAX_DISTANCE_KM)
    .sort((a, b) => {
      // Primary: distance
      if (Math.abs(a.distance - b.distance) > 0.1) {
        return a.distance - b.distance;
      }
      // Secondary: rating (descending)
      const ratingA = a.electrician.rating || 0;
      const ratingB = b.electrician.rating || 0;
      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }
      // Tertiary: review count (descending)
      const reviewsA = a.electrician.reviews || 0;
      const reviewsB = b.electrician.reviews || 0;
      return reviewsB - reviewsA;
    })
    .slice(0, 3);  // Take top 3

  // Build mapping
  if (nearby.length > 0) {
    mapping[commune.slug] = nearby.map(item => ({
      name: item.electrician.name,
      phone: item.electrician.phone,
      rating: item.electrician.rating || null,
      reviews: item.electrician.reviews || null,
      distance: Math.round(item.distance * 10) / 10, // Round to 1 decimal
      website: item.electrician.site || null,
      address: item.electrician.full_address || null,
      city: item.electrician.city,
      postal_code: item.electrician.postal_code
    }));

    totalMatches += nearby.length;
    if (nearby.length === 3) {
      communesWithFull3++;
    } else {
      communesWithSome++;
    }
  } else {
    communesWithNone++;
    mapping[commune.slug] = []; // Empty array for communes with no nearby electricians
  }

  // Progress indicator
  if ((index + 1) % 50 === 0 || (index + 1) === sitesData.total_sites) {
    console.log(`  Progress: ${index + 1}/${sitesData.total_sites} communes processed`);
  }
});

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ MAPPING COMPLETE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Statistics:');
console.log(`  Total electrician matches: ${totalMatches}`);
console.log(`  Communes with 3 listings: ${communesWithFull3}`);
console.log(`  Communes with 1-2 listings: ${communesWithSome}`);
console.log(`  Communes with 0 listings: ${communesWithNone}`);
console.log(`  Average per commune: ${(totalMatches / sitesData.total_sites).toFixed(1)}`);
console.log('');

// Save mapping
const outputPath = path.join(__dirname, '..', 'data', 'commune-electricians.json');
fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
console.log(`✓ Saved mapping to data/commune-electricians.json`);
console.log('');

// Show sample mappings
console.log('Sample mappings (first 3 communes with listings):\n');
let sampleCount = 0;
for (const [slug, electricians] of Object.entries(mapping)) {
  if (electricians.length > 0 && sampleCount < 3) {
    console.log(`${slug}:`);
    electricians.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.name} - ${e.distance}km - ${e.phone}${e.rating ? ` (${e.rating}★, ${e.reviews} avis)` : ''}`);
    });
    console.log('');
    sampleCount++;
  }
}

console.log('Next step: Update single.html template to display listings\n');
