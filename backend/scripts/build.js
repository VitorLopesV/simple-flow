const fs = require('fs');
const path = require('path');

// Compile TypeScript
const { execSync } = require('child_process');
execSync('tsc -p tsconfig.json', { stdio: 'inherit' });

// Remove dist/src directory
const distSrcPath = path.join(__dirname, '../dist/src');
if (fs.existsSync(distSrcPath)) {
  fs.rmSync(distSrcPath, { recursive: true, force: true });
  console.log('Removed dist/src');
}

// Copy api/index.js to dist root
const srcFile = path.join(__dirname, '../dist/api/index.js');
const destFile = path.join(__dirname, '../dist/index.js');
if (fs.existsSync(srcFile)) {
  fs.copyFileSync(srcFile, destFile);
  console.log('Copied api/index.js to dist/index.js');
}
