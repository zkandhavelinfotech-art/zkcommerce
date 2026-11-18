'use strict';

/**
 * Builds a repeatable code-only Smeram GoDaddy patch from the latest full bundle.
 * Media/uploads are intentionally excluded so future checkout, invoice, merchant,
 * and PHP fixes can be deployed without the old hard-coded v1.0.15 patch folder.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const deploymentDir = path.resolve(__dirname, '..');
const fullBundleDir = path.join(deploymentDir, 'smeram-godaddy');
const patchDir = path.join(deploymentDir, 'smeram-patch-current');
const zipPath = path.join(deploymentDir, 'smeram-patch-current.zip');

const codePaths = [
  'index.html',
  'api.php',
  'invoice.php',
  'order.php',
  'commerce.php',
  'whatsapp_orders.php',
  'web.config',
  '.htaccess',
  'api',
  'merchant',
  'store-builder'
];

function copyPath(relativePath) {
  const source = path.join(fullBundleDir, relativePath);
  if (!fs.existsSync(source)) return null;
  const destination = path.join(patchDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stat = fs.statSync(source);
  if (stat.isDirectory()) fs.cpSync(source, destination, { recursive: true });
  else fs.copyFileSync(source, destination);
  return relativePath;
}

function filesUnder(dir, root = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full, root) : [path.relative(root, full).replace(/\\/g, '/')];
  });
}

function main() {
  execFileSync(process.execPath, [path.join(__dirname, 'build-godaddy-bundle.js')], { stdio: 'inherit' });
  fs.rmSync(patchDir, { recursive: true, force: true });
  fs.mkdirSync(patchDir, { recursive: true });

  const copied = codePaths.map(copyPath).filter(Boolean);
  const manifest = {
    product: 'ZKCommerce / Smeram Naturals',
    type: 'code-only GoDaddy patch',
    built_at: new Date().toISOString(),
    source_bundle: 'smeram-godaddy',
    copied_paths: copied,
    files: filesUnder(patchDir)
  };
  fs.writeFileSync(path.join(patchDir, 'PATCH-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(patchDir, 'README-PATCH.txt'), [
    'Smeram Naturals code-only patch',
    '',
    'Upload/extract this archive into the GoDaddy httpdocs root.',
    'It updates storefront code, PHP APIs, invoice template, Merchant Portal, and Store Builder.',
    'It intentionally excludes product media, uploads, database credentials, and customer data.'
  ].join('\r\n'));

  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
  const ps = `Compress-Archive -Path '${patchDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
  console.log(`\nPatch ready: ${zipPath}`);
  console.log(`Files: ${manifest.files.length + 2} | Size: ${sizeMb} MB`);
}

main();
