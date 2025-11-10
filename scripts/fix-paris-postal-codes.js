const fs = require('fs');
const path = require('path');

console.log('=== FIX PARIS ARRONDISSEMENT POSTAL CODES ===\n');

// Define the 19 Paris pages that need fixing
const parisPages = [
  { dir: 'paris-1er', from: '75101', to: '75001', arrond: '1er' },
  { dir: 'paris-2e', from: '75102', to: '75002', arrond: '2e' },
  { dir: 'paris-3e', from: '75103', to: '75003', arrond: '3e' },
  { dir: 'paris-4e', from: '75104', to: '75004', arrond: '4e' },
  { dir: 'paris-5e', from: '75105', to: '75005', arrond: '5e' },
  { dir: 'paris-6e', from: '75106', to: '75006', arrond: '6e' },
  { dir: 'paris-7e', from: '75107', to: '75007', arrond: '7e' },
  { dir: 'paris-8e', from: '75108', to: '75008', arrond: '8e' },
  { dir: 'paris-9e', from: '75109', to: '75009', arrond: '9e' },
  { dir: 'paris-10e', from: '75110', to: '75010', arrond: '10e' },
  { dir: 'paris-12e', from: '75112', to: '75012', arrond: '12e' },
  { dir: 'paris-13e', from: '75113', to: '75013', arrond: '13e' },
  { dir: 'paris-14e', from: '75114', to: '75014', arrond: '14e' },
  { dir: 'paris-15e', from: '75115', to: '75015', arrond: '15e' },
  { dir: 'paris-16e', from: '75116', to: '75016', arrond: '16e' },
  { dir: 'paris-17e', from: '75117', to: '75017', arrond: '17e' },
  { dir: 'paris-18e', from: '75118', to: '75018', arrond: '18e' },
  { dir: 'paris-19e', from: '75119', to: '75019', arrond: '19e' },
  { dir: 'paris-20e', from: '75120', to: '75020', arrond: '20e' }
];

const contentDir = path.join(__dirname, '..', 'content');
const results = {
  updated: [],
  notFound: [],
  errors: []
};

console.log(`Processing ${parisPages.length} Paris arrondissement pages...\n`);

parisPages.forEach((page, idx) => {
  const filePath = path.join(contentDir, page.dir, 'index.md');

  console.log(`${idx + 1}. ${page.dir} (${page.from} → ${page.to})`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found: ${filePath}`);
    results.notFound.push(page.dir);
    return;
  }

  try {
    // Read file
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if it has the incorrect postal code
    if (!content.includes(`zipCode: '${page.from}'`)) {
      console.log(`   ⚠️  Postal code '${page.from}' not found in file`);
      results.errors.push({ page: page.dir, reason: 'postal code not found' });
      return;
    }

    // Replace the postal code
    const updatedContent = content.replace(
      `zipCode: '${page.from}'`,
      `zipCode: '${page.to}'`
    );

    // Write back
    fs.writeFileSync(filePath, updatedContent, 'utf8');

    console.log(`   ✓ Updated: ${page.from} → ${page.to}`);
    results.updated.push(page.dir);

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    results.errors.push({ page: page.dir, reason: error.message });
  }
});

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`✅ Successfully updated: ${results.updated.length} files`);
if (results.notFound.length > 0) {
  console.log(`❌ Not found: ${results.notFound.length} files`);
  results.notFound.forEach(dir => console.log(`   - ${dir}`));
}
if (results.errors.length > 0) {
  console.log(`⚠️  Errors: ${results.errors.length} files`);
  results.errors.forEach(e => console.log(`   - ${e.page}: ${e.reason}`));
}

console.log('\n✅ Hugo content files updated!\n');

if (results.updated.length > 0) {
  console.log('Next steps:');
  console.log('1. Re-extract pages: node scripts/extract-pages-data.js');
  console.log('2. Re-import to Supabase: node scripts/import-pages-to-supabase.js');
  console.log('OR run the Supabase direct update script first\n');
}
