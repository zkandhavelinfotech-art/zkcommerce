/**
 * ZKCommerce v4.1 — Vercel Static Build Script
 * Generates both 'dist' and 'zkc-build/dist' to satisfy all Vercel project configurations
 */
'use strict';

const fs = require('fs');
const path = require('path');

const zkcRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(zkcRoot, '..');

const targets = [
  path.join(repoRoot, 'dist'),
  path.join(zkcRoot, 'dist')
];

for (const output of targets) {
  try {
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output, { recursive: true });

    const directories = ['admin', 'assets', 'auth', 'merchant', 'storefront'];
    for (const dir of directories) {
      const src = path.join(zkcRoot, dir);
      if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(output, dir), { recursive: true });
      }
    }

    const files = [
      'index.html',
      'competitor-widget.html',
      'migrate.html',
      'manifest.json'
    ];
    for (const file of files) {
      const src = path.join(zkcRoot, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(output, file));
      }
    }

    console.log(`✅ Static site built successfully at: ${output}`);
  } catch (err) {
    console.error(`❌ Error building static output at ${output}:`, err.message);
  }
}
