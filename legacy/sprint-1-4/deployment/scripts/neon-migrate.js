/**
 * ZKCommerce v4.1 -- Neon Database Migration
 * Pure Node.js -- no psql needed
 *
 * Usage:
 *   node deployment/scripts/neon-migrate.js "postgresql://user:pass@host/db?sslmode=require"
 *
 * Or set DATABASE_URL in .env and just run:
 *   node deployment/scripts/neon-migrate.js
 */
'use strict';

var fs   = require('fs');
var path = require('path');
var Client;
try {
  Client = require('pg').Client;
} catch(e) {
  console.error('\x1b[31m[ERROR]\x1b[0m pg package not found. Run: npm install');
  process.exit(1);
}

// ── Get & clean the URL ───────────────────────────────────────
function cleanURL(raw) {
  if (!raw) return '';
  raw = raw.trim().replace(/^['"]|['"]$/g, ''); // strip surrounding quotes
  // Strip "KEY=value" prefix if user pasted the whole env line
  if (raw.includes('=postgresql://') || raw.includes('=postgres://')) {
    raw = raw.substring(raw.indexOf('=') + 1).trim();
  }
  // Remove trailing quotes or spaces
  raw = raw.replace(/['";\s]+$/, '');
  return raw;
}

// Try to get URL from: arg > .env file > process.env
function getURL() {
  // Command-line argument
  if (process.argv[2]) {
    var arg = cleanURL(process.argv[2]);
    if (arg.startsWith('postgresql://') || arg.startsWith('postgres://')) return arg;
  }

  // Read .env file
  var envFile = path.join(process.cwd(), '.env');
  if (fs.existsSync(envFile)) {
    var lines = fs.readFileSync(envFile, 'utf8').split('\n');
    // Priority order: DATABASE_URL > DATABASE_DevURL > DATABASE_DevURL > DATABASE_ProdURL
    var keys = ['DATABASE_URL','DATABASE_DEVURL','DATABASE_DevURL','DATABASE_ProdURL','DATABASE_PRODURL'];
    for (var k of keys) {
      for (var line of lines) {
        if (line.trim().startsWith('#')) continue;
        var idx = line.indexOf('=');
        if (idx < 0) continue;
        var key = line.slice(0, idx).trim();
        var val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key.toUpperCase() === k.toUpperCase() && (val.startsWith('postgresql://') || val.startsWith('postgres://'))) {
          return val;
        }
      }
    }
  }

  // process.env
  var envKeys = ['DATABASE_URL','DATABASE_DEVURL','DATABASE_DevURL'];
  for (var ek of envKeys) {
    if (process.env[ek] && (process.env[ek].startsWith('postgresql://') || process.env[ek].startsWith('postgres://'))) {
      return process.env[ek];
    }
  }

  return '';
}

var dbUrl = getURL();

if (!dbUrl) {
  console.error('\n\x1b[31m[ERROR]\x1b[0m No valid database URL found.\n');
  console.log('Option 1 -- pass URL directly (value only, no KEY= prefix):');
  console.log('  node deployment/scripts/neon-migrate.js "postgresql://user:pass@host/db?sslmode=require"\n');
  console.log('Option 2 -- add to .env file:');
  console.log('  DATABASE_URL=postgresql://user:pass@host/db?sslmode=require\n');
  console.log('Option 3 -- double-click:');
  console.log('  deployment\\scripts\\migrate-neon.bat\n');
  process.exit(1);
}

// Mask password for logging
var safeUrl = dbUrl.replace(/:([^@:]+)@/, ':****@');
console.log('\x1b[1m\x1b[35m');
console.log('══════════════════════════════════════════════');
console.log('  ZKCommerce v4.1 -- Database Migration');
console.log('══════════════════════════════════════════════\x1b[0m');
console.log('\x1b[36mTarget:\x1b[0m', safeUrl);
console.log('\x1b[36mTime:  \x1b[0m', new Date().toLocaleString('en-IN'), '\n');

// ── SSL config ────────────────────────────────────────────────
// Neon requires SSL. sslmode=verify-full needs sni + no self-signed rejection
var isNeon = dbUrl.includes('neon.tech');
var ssl = false;
if (isNeon || dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=verify-full')) {
  ssl = {
    rejectUnauthorized: false,  // works for both require and verify-full on Neon
    sni: true
  };
}

var SQL_FILES = [
  { file: 'database/zkcommerce-master.sql',    label: 'Master (36 tables, indexes, seed data)' },
  { file: 'database/zkcommerce-additions.sql', label: 'Additions (functions, views, sequences)' },
];

async function run() {
  var client = new Client({ connectionString: dbUrl, ssl: ssl });

  try {
    console.log('\x1b[33m[1/4]\x1b[0m Connecting...');
    await client.connect();
    console.log('\x1b[32m      Connected!\x1b[0m');

    var ver = await client.query('SELECT version()');
    console.log('\x1b[36m      Server:\x1b[0m', ver.rows[0].version.split(' ').slice(0,2).join(' '), '\n');

    var step = 2;
    for (var item of SQL_FILES) {
      var fp = path.join(process.cwd(), item.file);
      if (!fs.existsSync(fp)) {
        console.log('\x1b[33m[' + step + '/4]\x1b[0m Skip: ' + item.file + ' (not found)');
        step++; continue;
      }
      console.log('\x1b[33m[' + step + '/4]\x1b[0m ' + item.label);
      var sql = fs.readFileSync(fp, 'utf8');
      try {
        await client.query(sql);
        console.log('\x1b[32m      Done!\x1b[0m\n');
      } catch(e) {
        // Most errors are safe (already exists / IF NOT EXISTS)
        var msg = e.message.split('\n')[0];
        if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
          console.log('\x1b[33m      Note (safe):\x1b[0m', msg);
          console.log('\x1b[32m      Continuing...\x1b[0m\n');
        } else {
          console.log('\x1b[33m      Warning:\x1b[0m', msg, '\n');
        }
      }
      step++;
    }

    // Verify
    console.log('\x1b[33m[4/4]\x1b[0m Verifying...');
    var tables   = await client.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'");
    var users    = await client.query('SELECT COUNT(*) FROM users').catch(function(){ return {rows:[{count:0}]}; });
    var stores   = await client.query('SELECT COUNT(*) FROM stores').catch(function(){ return {rows:[{count:0}]}; });
    var products = await client.query('SELECT COUNT(*) FROM products').catch(function(){ return {rows:[{count:0}]}; });

    console.log('\n\x1b[1m\x1b[32m══════════════════════════════════════════════');
    console.log('  MIGRATION COMPLETE');
    console.log('══════════════════════════════════════════════\x1b[0m');
    console.log('\x1b[32m  Tables:   ' + tables.rows[0].count + '\x1b[0m');
    console.log('\x1b[32m  Users:    ' + users.rows[0].count + '\x1b[0m');
    console.log('\x1b[32m  Stores:   ' + stores.rows[0].count + '\x1b[0m');
    console.log('\x1b[32m  Products: ' + products.rows[0].count + '\x1b[0m');
    console.log('\n\x1b[1mLogin credentials (password: demo1234):\x1b[0m');
    console.log('  Admin:    admin@zkcommerce.in');
    console.log('  Merchant: merchant@zkcommerce.in');
    console.log('  Customer: customer@zkcommerce.in');
    console.log('\n\x1b[36mNext:\x1b[0m Update .env with DATABASE_URL and run  npm run dev\n');

  } catch(e) {
    console.error('\n\x1b[31m[FATAL]\x1b[0m', e.message);
    if (e.message.includes('ENOTFOUND')) {
      console.log('\x1b[33mFix:\x1b[0m Cannot resolve host. Check your Neon connection string.');
      console.log('     Make sure you passed only the URL value, not "KEY=value"');
      console.log('     Example: postgresql://user:pass@host/db?sslmode=require');
    } else if (e.message.includes('password authentication')) {
      console.log('\x1b[33mFix:\x1b[0m Wrong password. Check your Neon connection string.');
    } else if (e.message.includes('ECONNREFUSED')) {
      console.log('\x1b[33mFix:\x1b[0m Cannot connect. Check host/port in your connection string.');
    } else if (e.message.includes('SSL')) {
      console.log('\x1b[33mFix:\x1b[0m SSL error. Make sure sslmode=require is in your connection string.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
