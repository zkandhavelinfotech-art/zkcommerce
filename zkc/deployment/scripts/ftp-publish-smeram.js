/**
 * Smeram Naturals — 1-Click GoDaddy Windows FTP Deployment Script
 * -------------------------------------------------------------
 * Usage:
 *   node deployment/scripts/ftp-publish-smeram.js --host=ftp.smeram-naturals.in --user=username --pass=password
 *
 * Or set in your .env:
 *   GODADDY_FTP_HOST=ftp.smeram-naturals.in
 *   GODADDY_FTP_USER=your_ftp_username
 *   GODADDY_FTP_PASS=your_ftp_password
 *   GODADDY_FTP_DIR=/httpdocs
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  if (k && v) acc[k] = v;
  return acc;
}, {});

const host = args.host || process.env.GODADDY_FTP_HOST || '';
const user = args.user || process.env.GODADDY_FTP_USER || '';
const pass = args.pass || process.env.GODADDY_FTP_PASS || '';
const remoteDir = args.dir || process.env.GODADDY_FTP_DIR || '/httpdocs';

console.log('=== SMERAM NATURALS — GODADDY FTP PUBLISHER ===\n');

if (!host || !user || !pass) {
  console.log('ℹ️  FTP Credentials not provided.');
  console.log('To publish automatically via FTP, run:');
  console.log('  node deployment/scripts/ftp-publish-smeram.js --host=ftp.smeram-naturals.in --user=YOUR_USER --pass=YOUR_PASS\n');
  console.log('Alternatively:');
  console.log('1. Open GoDaddy File Manager → httpdocs/');
  console.log('2. Upload deployment/smeram-godaddy-deploy.zip (4 MB)');
  console.log('3. Click "Extract" to deploy instantly!\n');
  process.exit(0);
}

const localBundleDir = path.resolve(__dirname, '../smeram-godaddy');
console.log(`📡 Connecting to FTP: ftp://${host}${remoteDir}`);
console.log(`📂 Source Directory: ${localBundleDir}`);

// Build PowerShell FTP upload script for zero-dependency execution
const psScript = `
$ftpHost = "${host}"
$ftpUser = "${user}"
$ftpPass = "${pass}"
$remoteBase = "${remoteDir}".TrimEnd('/')
$localDir = "${localBundleDir.replace(/\\/g, '\\\\')}"

function Upload-FtpFile($localFile, $remoteSubpath) {
    $remoteUri = "ftp://$ftpHost$remoteBase/$remoteSubpath"
    Write-Host "Uploading: $remoteSubpath ..."
    $req = [System.Net.FtpWebRequest]::Create($remoteUri)
    $req.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $req.UseBinary = $true
    $req.KeepAlive = $false
    
    $content = [System.IO.File]::ReadAllBytes($localFile)
    $req.ContentLength = $content.Length
    $stream = $req.GetRequestStream()
    $stream.Write($content, 0, $content.Length)
    $stream.Close()
    $res = $req.GetResponse()
    $res.Close()
}

# Upload files recursively
Get-ChildItem -Path $localDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($localDir.Length + 1).Replace('\\', '/')
    Upload-FtpFile $_.FullName $rel
}

Write-Host "✅ FTP Deployment completed successfully!"
`;

const psPath = path.join(__dirname, 'temp-ftp-upload.ps1');
fs.writeFileSync(psPath, psScript, 'utf8');

try {
  console.log('🚀 Uploading files to GoDaddy Windows hosting...');
  const output = execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { stdio: 'inherit' });
  console.log('\n🎉 Smeram Naturals is now live on https://smeram-naturals.in !');
} catch (err) {
  console.error('❌ FTP Upload error:', err.message);
} finally {
  if (fs.existsSync(psPath)) fs.unlinkSync(psPath);
}
