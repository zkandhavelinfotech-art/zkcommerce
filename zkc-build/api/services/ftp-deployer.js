// FTP / FTPS connection test and folder upload for deployment packages.
// Uses basic-ftp so credentials never pass through a shell (passwords with $ ' " , work as-is).
const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');

async function connect(cfg) {
  const client = new ftp.Client(30000);
  await client.access({
    host: cfg.host,
    port: Number(cfg.port) || 21,
    user: cfg.user,
    password: cfg.password,
    secure: !!cfg.secure,
    // Shared hosts often present a certificate for the server name, not ftp.<your-domain>.
    secureOptions: { rejectUnauthorized: false }
  });
  return client;
}

function friendlyError(e) {
  const msg = String(e && e.message || e);
  if (/530/.test(msg)) return 'Login rejected (530). Check the FTP username and password — GoDaddy FTP users look like user@yourdomain.com.';
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return 'FTP host not found. Check the host name (e.g. ftp.yourdomain.com or the server IP).';
  if (/ECONNREFUSED/.test(msg)) return 'Connection refused. Check the FTP port (usually 21).';
  if (/ETIMEDOUT|Timeout/i.test(msg)) return 'Connection timed out. The host may block FTP from this network, or try toggling FTPS.';
  if (/550/.test(msg)) return 'Remote folder not accessible (550): ' + msg;
  return msg;
}

async function testConnection(cfg) {
  const client = await connect(cfg);
  try {
    const home = await client.pwd();
    let exists = true, entries = 0;
    try { entries = (await client.list(cfg.path)).length; } catch (_) { exists = false; }
    return { home, path: cfg.path, path_exists: exists, entries };
  } finally { client.close(); }
}

// Root-level files that stay local: SQL dumps, docs, ZIPs; plus .env files when skipEnv is set.
function shouldSkip(rel, isDir, skipEnv) {
  const top = rel.split('/')[0];
  if (isDir && rel === 'database') return true;
  if (!isDir && !rel.includes('/') && /\.(md|sql|zip)$/i.test(rel)) return true;
  if (!isDir && skipEnv && path.posix.basename(rel) === '.env') return true;
  return top === 'node_modules';
}

async function uploadDirectory(cfg, localDir, { skipEnv = false } = {}) {
  const client = await connect(cfg);
  let files = 0, bytes = 0;
  const base = cfg.path === '/' ? '' : cfg.path;
  async function walk(dir, rel) {
    const remoteDir = base + (rel ? '/' + rel : '') || '/';
    await client.ensureDir(remoteDir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? rel + '/' + entry.name : entry.name;
      if (shouldSkip(childRel, entry.isDirectory(), skipEnv)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, childRel);
      else {
        await client.uploadFrom(full, remoteDir.replace(/\/$/, '') + '/' + entry.name);
        files++;
        bytes += fs.statSync(full).size;
      }
    }
  }
  try {
    await walk(localDir, '');
    return { files, bytes, remote_path: cfg.path };
  } finally { client.close(); }
}

module.exports = { testConnection, uploadDirectory, friendlyError };
