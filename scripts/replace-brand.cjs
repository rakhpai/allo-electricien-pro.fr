#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    if (content.includes('SOS Électricien Paris') || content.includes('SOS Electricien Paris')) {
      content = content.replace(/SOS Électricien Paris/g, 'ALLO ELECTRICIEN PRO');
      content = content.replace(/SOS Electricien Paris/g, 'ALLO ELECTRICIEN PRO');
      modified = true;
    }

    if (content.includes('SOS Électricien') || content.includes('SOS Electricien')) {
      content = content.replace(/SOS Électricien/g, 'ALLO ELECTRICIEN PRO');
      content = content.replace(/SOS Electricien/g, 'ALLO ELECTRICIEN PRO');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Updated: ${filePath}`);
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

function walkDirectory(dir, fileExt) {
  let filesModified = 0;

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      filesModified += walkDirectory(fullPath, fileExt);
    } else if (stat.isFile() && fileExt.includes(path.extname(fullPath))) {
      filesModified += replaceInFile(fullPath);
    }
  }

  return filesModified;
}

// Run replacement
console.log('🔍 Searching for "SOS Électricien" in layouts...\n');

const layoutsDir = path.join(__dirname, '..', 'layouts');
const filesModified = walkDirectory(layoutsDir, ['.html', '.toml']);

console.log(`\n✅ Complete! Modified ${filesModified} files.`);
