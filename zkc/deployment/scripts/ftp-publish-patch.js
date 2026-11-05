/**
 * Smeram Naturals — GoDaddy FTP Incremental Patch Deployer (v1.0.15)
 * -----------------------------------------------------------------
 * Uploads ONLY the 16 recent changed files from today's release (~138 KB),
 * without re-uploading media, images, or unmodified files.
 *
 * Usage:
 *   node zkc/deployment/scripts/ftp-publish-patch.js --host=ftp.smeram-naturals.in --user=USER --pass=PASS
 *
 * Or interactive:
 *   node zkc/deployment/scripts/ftp-publish-patch.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  if (k && v) acc[k] = v;
  return acc;
}, {});

let host = args.host || process.env.GODADDY_FTP_HOST || 'ftp.smeram-naturals.in';
let user = args.user || process.env.GODADDY_FTP_USER || '';
let pass = args.pass || process.env.GODADDY_FTP_PASS || '';
let remoteDir = args.dir || process.env.GODADDY_FTP_DIR || '/httpdocs';

const patchDir = path.resolve(__dirname, '../smeram-patch-today-v1.0.15');

function prompt(question, isSecret = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('========================================================================');
  console.log('   SMERAM NATURALS - GODADDY LIVE SERVER PATCH DEPLOYMENT (TODAY)       ');
  console.log('   Version: v1.0.15 | Release: ' + new Date().toISOString().replace('T', ' ').slice(0, 19));
  console.log('   Customer Care WhatsApp: +91 75399 72026                              ');
  console.log('========================================================================\n');

  if (!fs.existsSync(patchDir)) {
    console.error('❌ Patch directory not found at:', patchDir);
    process.exit(1);
  }

  // List all files in patch
  function getAllFiles(dir, base = '') {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.join(base, ent.name).replace(/\\/g, '/');
      if (ent.isDirectory()) {
        results = results.concat(getAllFiles(full, rel));
      } else {
        const stats = fs.statSync(full);
        results.push({ full, rel, size: stats.size });
      }
    }
    return results;
  }

  const patchFiles = getAllFiles(patchDir);
  const totalKb = (patchFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1);

  console.log(`Auto Deployment Files List (${patchFiles.length} files, ${totalKb} KB total):`);
  console.log('------------------------------------------------------------------------');
  patchFiles.forEach((f, i) => {
    const kb = (f.size / 1024).toFixed(1);
    console.log(` ${String(i + 1).padStart(2, ' ')}. ${f.rel.padEnd(35, ' ')} (${kb.padStart(6, ' ')} KB)`);
  });
  console.log('------------------------------------------------------------------------\n');

  if (!user) {
    user = await prompt('Enter GoDaddy FTP Username: ');
  }
  if (!pass) {
    pass = await prompt('Enter GoDaddy FTP Password: ');
  }

  if (!user || !pass) {
    console.log('\n❌ FTP credentials not provided. Deployment aborted.');
    console.log('Alternative manual 1-click update:');
    console.log('  1. Open GoDaddy File Manager → httpdocs/');
    console.log('  2. Upload zkc/deployment/smeram-patch-today-v1.0.15.zip (138 KB)');
    console.log('  3. Click "Extract" to update all 16 files in 2 seconds!\n');
    process.exit(0);
  }

  console.log(`\nConnecting to FTP ftp://${host}${remoteDir} ...`);
  const psScriptPath = path.resolve(__dirname, '../upload-today-patch.ps1');
  const psCmd = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}" -FtpHost "${host}" -FtpUser "${user}" -FtpPass "${pass}" -RemoteDir "${remoteDir}"`;
  
  try {
    execSync(psCmd, { stdio: 'inherit' });
  } catch (err) {
    console.error('Upload script encountered an issue:', err.message);
  }
}

main();

