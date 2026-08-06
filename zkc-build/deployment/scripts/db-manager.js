/**
 * ZKCommerce v4.1 -- Database Manager
 * Usage: node deployment/scripts/db-manager.js <command> [environment]
 * Commands: create | migrate | seed | backup | restore | reset | status | rollback
 */
'use strict';

const { execSync, spawnSync } = require('child_process');
const path   = require('path');
const fs     = require('fs');
const { Client } = require('pg');

const cmd = process.argv[2];
const env = process.argv[3] || process.env.NODE_ENV || 'development';

// Load env
const envFile = path.join(__dirname, '../environments', `.env.${env}`);
if (fs.existsSync(envFile)) require('dotenv').config({ path: envFile });
else require('dotenv').config();

const DB_URL = process.env.DATABASE_URL;
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg, level) {
  const line = `[${new Date().toISOString()}] [${(level||'INFO').toUpperCase()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'database.log'), line + '\n');
}

function die(msg) {
  log(msg, 'ERROR');
  process.exit(1);
}

async function getClient() {
  if (!DB_URL) die('DATABASE_URL not set. Check your .env file.');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  return client;
}

// Confirm destructive operations in production
function confirmProd(action) {
  if (env === 'production') {
    const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(function(resolve) {
      readline.question(
        `\x1b[31mWARNING: You are about to ${action} in PRODUCTION.\nType "yes I understand" to continue: \x1b[0m`,
        function(answer) {
          readline.close();
          if (answer !== 'yes I understand') {
            log(`${action} cancelled by user`, 'WARN');
            process.exit(0);
          }
          resolve();
        }
      );
    });
  }
}

// ── COMMANDS ─────────────────────────────────────────────────

async function cmdStatus() {
  log(`Checking database status [${env}]`);
  const client = await getClient();
  try {
    const ver = await client.query('SELECT version()');
    log('PostgreSQL: ' + ver.rows[0].version.split(',')[0]);
    const tables = await client.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'");
    log('Tables: ' + tables.rows[0].count);
    const users = await client.query('SELECT COUNT(*) FROM users');
    log('Users: ' + users.rows[0].count);
    const stores = await client.query('SELECT COUNT(*) FROM stores');
    log('Stores: ' + stores.rows[0].count);
    const orders = await client.query('SELECT COUNT(*) FROM orders');
    log('Orders: ' + orders.rows[0].count);
    const products = await client.query('SELECT COUNT(*) FROM products');
    log('Products: ' + products.rows[0].count);
    log('Database status: HEALTHY', 'INFO');
  } catch(e) {
    die('Status check failed: ' + e.message);
  } finally {
    await client.end();
  }
}

async function cmdCreate() {
  log(`Creating database [${env}]`);
  const urlParts = DB_URL.match(/\/\/(.+):(.+)@(.+):(\d+)\/(.+)/);
  if (!urlParts) die('Could not parse DATABASE_URL');
  const dbName = urlParts[5].split('?')[0];
  const adminUrl = DB_URL.replace('/' + dbName, '/postgres');
  const admin = new Client({ connectionString: adminUrl });
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    log(`Database "${dbName}" created`);
  } catch(e) {
    if (e.message.includes('already exists')) {
      log(`Database "${dbName}" already exists`);
    } else {
      die('Create failed: ' + e.message);
    }
  } finally {
    await admin.end();
  }
}

async function cmdMigrate() {
  log(`Running migration [${env}]`);
  const sqlFiles = [
    'database/schema.sql',
    'database/phase1-additions.sql',
    'database/phase2-additions.sql',
    'database/phase3-additions.sql',
  ];
  const client = await getClient();
  for (const sqlFile of sqlFiles) {
    const fullPath = path.join(process.cwd(), sqlFile);
    if (!fs.existsSync(fullPath)) {
      log(`Skipping ${sqlFile} (not found)`, 'WARN');
      continue;
    }
    log(`Running ${sqlFile}...`);
    const sql = fs.readFileSync(fullPath, 'utf8');
    try {
      await client.query(sql);
      log(`${sqlFile} -- OK`);
    } catch(e) {
      log(`${sqlFile} -- ERROR: ${e.message}`, 'ERROR');
    }
  }
  await client.end();
  log('Migration complete');
}

async function cmdBackup() {
  log(`Starting database backup [${env}]`);
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(backupDir, `zkcommerce-${env}-${ts}.sql`);
  const urlParts = DB_URL.match(/\/\/(.+):(.+)@(.+):(\d+)\/(.+)/);
  if (!urlParts) die('Could not parse DATABASE_URL');
  const [,user, pass, host, port, dbName] = urlParts;
  const env2 = { ...process.env, PGPASSWORD: pass };
  const result = spawnSync('pg_dump', [
    '-h', host, '-p', port, '-U', user, '-d', dbName.split('?')[0],
    '--no-password', '-f', file, '--format=plain', '--clean'
  ], { env: env2, stdio: 'inherit' });
  if (result.status === 0) {
    const size = fs.statSync(file).size;
    log(`Backup saved: ${file} (${Math.round(size/1024)}KB)`);
    // Keep only last 10 backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('zkcommerce-' + env))
      .sort().reverse();
    if (backups.length > 10) {
      backups.slice(10).forEach(f => {
        fs.unlinkSync(path.join(backupDir, f));
        log(`Removed old backup: ${f}`);
      });
    }
  } else {
    die('pg_dump failed. Is pg_dump in PATH?');
  }
}

async function cmdReset() {
  if (env === 'production') {
    await confirmProd('RESET (DELETE ALL DATA)');
  }
  log(`Resetting database [${env}] -- ALL DATA WILL BE LOST`, 'WARN');
  await cmdCreate();
  await cmdMigrate();
  log('Database reset complete');
}

async function cmdSeed() {
  log(`Running seed data [${env}]`);
  const client = await getClient();
  try {
    const count = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(count.rows[0].count) >= 3) {
      log('Seed data already present (3+ users). Skipping.');
    } else {
      log('Seed data is part of zkcommerce-master.sql migration. Run migrate first.');
    }
  } catch(e) {
    die('Seed failed: ' + e.message);
  } finally {
    await client.end();
  }
}

// ── ROUTER ───────────────────────────────────────────────────
const commands = {
  status:   cmdStatus,
  create:   cmdCreate,
  migrate:  cmdMigrate,
  backup:   cmdBackup,
  reset:    cmdReset,
  seed:     cmdSeed,
};

if (!cmd || !commands[cmd]) {
  console.log('\nUsage: node deployment/scripts/db-manager.js <command> [environment]');
  console.log('\nCommands:');
  Object.keys(commands).forEach(c => console.log('  ' + c));
  console.log('\nEnvironments: development | testing | staging | production');
  process.exit(0);
}

log(`DB Manager: ${cmd} [${env}]`);
commands[cmd]().catch(e => die(e.message));
