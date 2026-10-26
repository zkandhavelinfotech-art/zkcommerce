// Per-store, per-environment deployment settings (DB, FTP, domain, package versions).
// Secrets are encrypted at rest with a key derived from JWT_SECRET and never returned to the browser.
const crypto = require('crypto');
const pool = require('../db');

const ENVIRONMENTS = ['development', 'stage', 'preview', 'production'];
const TECHNOLOGIES = ['php', 'nodejs', 'static'];

let columnReady = null;
function ensureColumn() {
  if (!columnReady) {
    // Column comes from pg-migrations (002_store_settings_columns).
    columnReady = require('./pg-migrations').ready().catch(e => { columnReady = null; throw e; });
  }
  return columnReady;
}

function key() {
  return crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'zkcommerce-deploy')).digest();
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return 'enc:' + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function decrypt(value) {
  if (!value || !String(value).startsWith('enc:')) return value || '';
  try {
    const raw = Buffer.from(String(value).slice(4), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch (_) { return ''; }
}

function normalizeEnv(env) {
  const e = String(env || '').toLowerCase();
  if (e === 'dev') return 'development';
  if (e === 'prod') return 'production';
  if (e === 'staging') return 'stage';
  return ENVIRONMENTS.includes(e) ? e : null;
}

// Collapse duplicate slashes, force a leading slash, drop the trailing one.
function normalizeRemotePath(p) {
  const clean = ('/' + String(p || '/public_html').trim()).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return clean || '/';
}
function normalizeFtpHost(h) {
  return String(h || '').trim().replace(/^s?ftps?:\/\//i, '').replace(/\/.*$/, '');
}

async function loadSettings(storeId, merchantId) {
  await ensureColumn();
  const { rows } = await pool.query('SELECT id, slug, custom_domain, deployment_settings FROM stores WHERE id=$1 AND merchant_id=$2', [storeId, merchantId]);
  if (!rows.length) return null;
  const s = rows[0].deployment_settings || {};
  s.environments = s.environments || {};
  s.versions = s.versions || {};
  return { store: rows[0], settings: s };
}

async function persist(storeId, settings) {
  await pool.query('UPDATE stores SET deployment_settings=$2::jsonb, updated_at=NOW() WHERE id=$1', [storeId, JSON.stringify(settings)]);
}

// Settings with secrets decrypted, for server-side use only.
function resolvedEnv(settings, env) {
  const e = settings.environments[env] || {};
  return {
    custom_domain: e.custom_domain || '',
    technology: e.technology || null,
    provider: e.provider || null,
    db: e.db ? { ...e.db, password: decrypt(e.db.password) } : null,
    ftp: e.ftp ? { ...e.ftp, password: decrypt(e.ftp.password) } : null,
    payments: e.payments ? { key_id: e.payments.key_id || '', key_secret: decrypt(e.payments.key_secret) } : null
  };
}

// Packages built before migrations were tracked shipped tables up to 002_inquiries.
const PRE_TRACKING_SCHEMA = '002_inquiries';

// Newest first. Falls back to last_package for environments built before build history existed.
function buildHistory(e) {
  const builds = Array.isArray(e.builds) ? e.builds.slice() : [];
  if (e.last_package && !builds.some(b => b.version === e.last_package.version && b.technology === e.last_package.technology)) {
    builds.push({ ...e.last_package, schema: e.last_package.schema || PRE_TRACKING_SCHEMA });
  }
  return builds.map(b => ({ version: b.version, technology: b.technology, schema: b.schema || PRE_TRACKING_SCHEMA, built_at: b.built_at, zip_name: b.zip_name }))
    .sort((a, b) => String(b.built_at).localeCompare(String(a.built_at)));
}

// Browser-safe view: passwords replaced by a has_password flag.
function publicView(settings) {
  const environments = {};
  for (const env of ENVIRONMENTS) {
    const e = settings.environments[env] || {};
    environments[env] = {
      custom_domain: e.custom_domain || '',
      technology: e.technology || null,
      provider: e.provider || null,
      db: e.db ? { ...e.db, password: undefined, has_password: !!e.db.password } : null,
      ftp: e.ftp ? { ...e.ftp, password: undefined, has_password: !!e.ftp.password } : null,
      payments: e.payments ? { key_id: e.payments.key_id || '', has_secret: !!e.payments.key_secret } : null,
      ftp_tested_at: e.ftp_tested_at || null,
      last_package: e.last_package || null,
      builds: buildHistory(e),
      last_migration: e.last_migration || null
    };
  }
  return { active_env: settings.active_env || 'production', environments, versions: settings.versions };
}

function mergeSecretBlock(existing, incoming, fields) {
  const next = { ...(existing || {}) };
  for (const f of fields) if (incoming[f] !== undefined) next[f] = incoming[f];
  if (incoming.password) next.password = encrypt(incoming.password);
  return next;
}

async function saveEnvironment(storeId, merchantId, env, body) {
  const loaded = await loadSettings(storeId, merchantId);
  if (!loaded) return null;
  const { settings } = loaded;
  const current = settings.environments[env] || {};
  if (body.db) {
    const db = body.db;
    if (db.type && !['mysql', 'postgres'].includes(db.type)) throw Object.assign(new Error('Database type must be mysql or postgres'), { status: 400 });
    if (db.port !== undefined && db.port !== '' && !(Number(db.port) > 0 && Number(db.port) < 65536)) throw Object.assign(new Error('Database port must be 1-65535'), { status: 400 });
    current.db = mergeSecretBlock(current.db, { ...db, port: db.port ? Number(db.port) : undefined }, ['type', 'host', 'port', 'name', 'user']);
  }
  if (body.ftp) {
    const ftp = body.ftp;
    const host = normalizeFtpHost(ftp.host);
    if (!host || !ftp.user) throw Object.assign(new Error('FTP host and username are required'), { status: 400 });
    if (!ftp.password && !(current.ftp && current.ftp.password)) throw Object.assign(new Error('FTP password is required'), { status: 400 });
    const changed = !current.ftp || current.ftp.host !== host || current.ftp.user !== ftp.user || !!ftp.password;
    current.ftp = mergeSecretBlock(current.ftp, {
      host, user: String(ftp.user).trim(), password: ftp.password,
      port: Number(ftp.port) || 21, path: normalizeRemotePath(ftp.path), secure: !!ftp.secure
    }, ['host', 'user', 'port', 'path', 'secure']);
    if (changed) current.ftp_tested_at = null;
  }
  if (body.payments) {
    const keyId = String(body.payments.key_id || '').trim();
    if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) throw Object.assign(new Error('Razorpay key id looks like rzp_live_xxxx or rzp_test_xxxx'), { status: 400 });
    current.payments = { ...(current.payments || {}), key_id: keyId };
    if (body.payments.key_secret) current.payments.key_secret = encrypt(String(body.payments.key_secret).trim());
    if (!keyId) delete current.payments.key_secret;
  }
  if (body.custom_domain !== undefined) current.custom_domain = String(body.custom_domain || '').trim().toLowerCase();
  if (body.technology !== undefined && TECHNOLOGIES.includes(body.technology)) current.technology = body.technology;
  if (body.provider !== undefined) current.provider = String(body.provider || '');
  settings.environments[env] = current;
  settings.active_env = env;
  await persist(storeId, settings);
  return publicView(settings);
}

function bumpVersion(v) {
  const parts = String(v || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[parts.length - 1] += 1;
  return parts.join('.');
}
function nextVersion(settings, env, technology) {
  const last = settings.versions[`${env}:${technology}`];
  return last ? bumpVersion(last) : '1.0.1';
}

module.exports = {
  ENVIRONMENTS, TECHNOLOGIES, normalizeEnv, normalizeRemotePath, normalizeFtpHost,
  loadSettings, persist, resolvedEnv, publicView, saveEnvironment, nextVersion, encrypt, decrypt, buildHistory
};
