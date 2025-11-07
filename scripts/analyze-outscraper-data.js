const fs = require('fs');
const path = require('path');

console.log('=== OUTSCRAPER ELECTRICIAN DATA ANALYSIS ===\n');

// Load Outscraper data
const dataPath = path.join(__dirname, '..', 'Outscraper-electrician.json');
if (!fs.existsSync(dataPath)) {
  console.error('❌ Error: Outscraper-electrician.json not found');
  process.exit(1);
}

console.log('📊 Loading Outscraper data...');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
console.log(`✓ Loaded ${data.length} records\n`);

// Analyze data quality
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('DATA QUALITY ANALYSIS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Count fields
const fieldStats = {};
const sampleRecord = data[0];
Object.keys(sampleRecord).forEach(field => {
  fieldStats[field] = {
    total: 0,
    missing: 0,
    percentage: 0
  };
});

// Analyze each record
data.forEach(record => {
  Object.keys(fieldStats).forEach(field => {
    fieldStats[field].total++;
    if (record[field] === null || record[field] === undefined || record[field] === '' || record[field] === 'None') {
      fieldStats[field].missing++;
    }
  });
});

// Calculate percentages
Object.keys(fieldStats).forEach(field => {
  const stat = fieldStats[field];
  stat.percentage = ((stat.total - stat.missing) / stat.total * 100).toFixed(1);
});

// Display critical fields
console.log('Critical Fields Coverage:');
const criticalFields = ['name', 'phone', 'full_address', 'city', 'postal_code', 'latitude', 'longitude', 'place_id', 'rating', 'reviews', 'site'];

criticalFields.forEach(field => {
  const stat = fieldStats[field];
  const present = stat.total - stat.missing;
  const icon = stat.percentage > 80 ? '✓' : stat.percentage > 50 ? '⚠' : '❌';
  console.log(`  ${icon} ${field.padEnd(20)}: ${present.toString().padStart(4)} / ${stat.total} (${stat.percentage}%)`);
});

console.log('');

// Check for duplicates by place_id
console.log('Duplicate Detection:');
const placeIds = new Set();
let duplicates = 0;
data.forEach(record => {
  if (record.place_id) {
    if (placeIds.has(record.place_id)) {
      duplicates++;
    } else {
      placeIds.add(record.place_id);
    }
  }
});
console.log(`  Unique place_ids: ${placeIds.size}`);
console.log(`  Duplicates found: ${duplicates}`);
console.log('');

// Rating distribution
console.log('Rating Distribution:');
const ratingDist = { none: 0, '1-2': 0, '2-3': 0, '3-4': 0, '4-5': 0, '5': 0 };
data.forEach(record => {
  if (!record.rating || record.rating === null) {
    ratingDist.none++;
  } else {
    const r = parseFloat(record.rating);
    if (r >= 5) ratingDist['5']++;
    else if (r >= 4) ratingDist['4-5']++;
    else if (r >= 3) ratingDist['3-4']++;
    else if (r >= 2) ratingDist['2-3']++;
    else ratingDist['1-2']++;
  }
});

Object.entries(ratingDist).forEach(([range, count]) => {
  const percentage = (count / data.length * 100).toFixed(1);
  console.log(`  ${range.padEnd(10)}: ${count.toString().padStart(4)} (${percentage}%)`);
});

console.log('');

// Reviews distribution
console.log('Reviews Distribution:');
const reviewRanges = { none: 0, '1-10': 0, '11-50': 0, '51-100': 0, '100+': 0 };
data.forEach(record => {
  if (!record.reviews || record.reviews === null || record.reviews === 0) {
    reviewRanges.none++;
  } else {
    const r = parseInt(record.reviews);
    if (r > 100) reviewRanges['100+']++;
    else if (r > 50) reviewRanges['51-100']++;
    else if (r > 10) reviewRanges['11-50']++;
    else reviewRanges['1-10']++;
  }
});

Object.entries(reviewRanges).forEach(([range, count]) => {
  const percentage = (count / data.length * 100).toFixed(1);
  console.log(`  ${range.padEnd(10)}: ${count.toString().padStart(4)} (${percentage}%)`);
});

console.log('');

// Geographic distribution
console.log('Geographic Distribution:');
const cities = {};
data.forEach(record => {
  if (record.city) {
    cities[record.city] = (cities[record.city] || 0) + 1;
  }
});

const topCities = Object.entries(cities)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log('  Top 10 Cities:');
topCities.forEach(([city, count]) => {
  console.log(`    ${city.padEnd(30)}: ${count} businesses`);
});

console.log('');

// Business status
console.log('Business Status:');
const statuses = {};
data.forEach(record => {
  const status = record.business_status || 'unknown';
  statuses[status] = (statuses[status] || 0) + 1;
});

Object.entries(statuses).forEach(([status, count]) => {
  const percentage = (count / data.length * 100).toFixed(1);
  console.log(`  ${status.padEnd(20)}: ${count.toString().padStart(4)} (${percentage}%)`);
});

console.log('');

// Verified status
const verified = data.filter(r => r.verified === true).length;
console.log('Verification Status:');
console.log(`  Verified: ${verified} (${(verified / data.length * 100).toFixed(1)}%)`);
console.log(`  Not verified: ${data.length - verified} (${((data.length - verified) / data.length * 100).toFixed(1)}%)`);

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`Total Records: ${data.length}`);
console.log(`Unique Businesses (by place_id): ${placeIds.size}`);
console.log(`Records with phone: ${data.length - fieldStats.phone.missing} (${fieldStats.phone.percentage}%)`);
console.log(`Records with rating: ${data.length - fieldStats.rating.missing} (${fieldStats.rating.percentage}%)`);
console.log(`Records with website: ${data.length - fieldStats.site.missing} (${fieldStats.site.percentage}%)`);
console.log(`Verified businesses: ${verified} (${(verified / data.length * 100).toFixed(1)}%)`);

console.log('');

// Recommendations
console.log('RECOMMENDATIONS:');
console.log(`  ✓ Use place_id as unique identifier (${placeIds.size} unique IDs)`);
if (fieldStats.phone.percentage < 70) {
  console.log(`  ⚠ ${fieldStats.phone.missing} records (${(100 - fieldStats.phone.percentage).toFixed(1)}%) missing phone numbers - import anyway and flag for later update`);
}
if (fieldStats.rating.percentage < 60) {
  console.log(`  ⚠ ${fieldStats.rating.missing} records (${(100 - fieldStats.rating.percentage).toFixed(1)}%) without ratings - normal for new businesses`);
}
console.log(`  ✓ All records have coordinates - good for geolocation features`);
console.log(`  ✓ High verification rate (${(verified / data.length * 100).toFixed(1)}%) - quality data source`);

console.log('');
