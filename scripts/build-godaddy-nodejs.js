const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STAGING = path.join(os.tmpdir(), 'godaddy-staging-' + Date.now());
const ZIP_OUT = path.join(ROOT, 'deployment', 'godaddy-nodejs-release.zip');

console.log('--- Building Clean GoDaddy Node.js Production Release Bundle ---');

if (fs.existsSync(STAGING)) {
  fs.rmSync(STAGING, { recursive: true, force: true });
}
fs.mkdirSync(STAGING, { recursive: true });

function copyFile(srcRel, destRel) {
  const src = path.join(ROOT, srcRel);
  const dest = path.join(STAGING, destRel || srcRel);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('  + File:', destRel || srcRel);
}

function copyDirRecursive(srcDir, destDir, excludes) {
  excludes = excludes || ['node_modules', '.git', '.cache', 'temp', 'logs', 'deployment', 'godaddy-staging', 'downloads'];
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes.includes(entry.name)) continue;
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(s, d, excludes);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// 1. Copy root files
copyFile('app.js');
copyFile('server.js');
copyFile('package.json');
copyFile('.env.production.example', '.env.production');
copyFile('.env.production.example', '.env.example');
copyFile('zkc/database/schema-mysql.sql', 'schema-mysql.sql');
copyFile('zkc/database/migration-mysql.sql', 'migration-mysql.sql');

// .htaccess for Passenger
const htaccessContent = `PassengerEnabled on
PassengerAppType node
PassengerStartupFile app.js
PassengerAppRoot /home/USERNAME/zkcommerce
PassengerNodejs /home/USERNAME/nodevenv/zkcommerce/18/bin/node

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^$ http://127.0.0.1:3000/ [P,L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
</IfModule>
`;
fs.writeFileSync(path.join(STAGING, '.htaccess'), htaccessContent, 'utf8');
console.log('  + File: .htaccess');

// Standalone migrate-mysql.js
const migrateScript = 'require("dotenv").config({ path: ".env.production" });\n' +
  'require("dotenv").config();\n' +
  'const { initDatabase } = require("./zkc/api/services/db-boot");\n' +
  '(async () => {\n' +
  '  console.log("Running GoDaddy MySQL database migration...");\n' +
  '  try {\n' +
  '    const res = await initDatabase();\n' +
  '    console.log("Migration completed successfully!");\n' +
  '    console.log(JSON.stringify(res, null, 2));\n' +
  '    process.exit(0);\n' +
  '  } catch (err) {\n' +
  '    console.error("Migration failed:", err.message);\n' +
  '    process.exit(1);\n' +
  '  }\n' +
  '})();\n';
fs.writeFileSync(path.join(STAGING, 'migrate-mysql.js'), migrateScript, 'utf8');
console.log('  + File: migrate-mysql.js');

// 2. Copy zkc source folders
console.log('Copying zkc application modules...');
copyDirRecursive(path.join(ROOT, 'zkc', 'api'), path.join(STAGING, 'zkc', 'api'));
copyDirRecursive(path.join(ROOT, 'zkc', 'merchant'), path.join(STAGING, 'zkc', 'merchant'));
copyDirRecursive(path.join(ROOT, 'zkc', 'assets'), path.join(STAGING, 'zkc', 'assets'));
copyDirRecursive(path.join(ROOT, 'zkc', 'database'), path.join(STAGING, 'zkc', 'database'));
copyDirRecursive(path.join(ROOT, 'zkc', 'clients'), path.join(STAGING, 'zkc', 'clients'));
if (fs.existsSync(path.join(ROOT, 'zkc', 'storefront'))) {
  copyDirRecursive(path.join(ROOT, 'zkc', 'storefront'), path.join(STAGING, 'zkc', 'storefront'));
}

// 3. Create deployment directory if not exists
fs.mkdirSync(path.dirname(ZIP_OUT), { recursive: true });
if (fs.existsSync(ZIP_OUT)) {
  fs.unlinkSync(ZIP_OUT);
}

console.log('Compressing files into deployment/godaddy-nodejs-release.zip...');
try {
  const psCmd = 'powershell -NoProfile -Command "Compress-Archive -Path \'' + STAGING + '\\*\' -DestinationPath \'' + ZIP_OUT + '\' -Force"';
  execSync(psCmd, { stdio: 'inherit' });
  const stat = fs.statSync(ZIP_OUT);
  console.log('=====================================================');
  console.log('SUCCESS: GoDaddy release bundle generated!');
  console.log('  File: ' + ZIP_OUT);
  console.log('  Size: ' + (stat.size / (1024 * 1024)).toFixed(2) + ' MB');
  console.log('=====================================================');
} catch (e) {
  console.error('Error compressing archive:', e.message);
} finally {
  try { fs.rmSync(STAGING, { recursive: true, force: true }); } catch (_) {}
}
