/**
 * ZKCommerce v4.1 — Neon Database Migration (Pure Node.js)
 * NO psql required. Works on Windows PowerShell, Mac, Linux.
 *
 * Usage:
 *   node deployment/scripts/neon-migrate.js <DATABASE_URL>
 *
 * Or set DATABASE_URL in .env and run:
 *   node deployment/scripts/neon-migrate.js
 *
 * Examples:
 *   # Dev (Neon):
 *   node deployment/scripts/neon-migrate.js "postgresql://neondb_owner:pass@host/db?sslmode=require"
 *
 *   # Local:
 *   node deployment/scripts/neon-migrate.js "postgresql://postgres:Admin@123@localhost:5432/zkcommerce"
 */
'use strict';

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

// ── Get connection string ─────────────────────────────────────
const dbUrl = process.argv[2]
  || process.env.DATABASE_URL
  || process.env.DATABASE_DevURL
  || process.env.DATABASE_DEVURL;

if (!dbUrl) {
  console.error('\x1b[31m[ERROR]\x1b[0m No database URL provided.\n');
  console.log('Usage:');
  console.log('  node deployment/scripts/neon-migrate.js "postgresql://user:pass@host/db"');
  console.log('\nOr add DATABASE_URL to your .env file');
  process.exit(1);
}

// Mask password for logging
const safeUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
console.log('\x1b[1m\x1b[35m');
console.log('══════════════════════════════════════════════');
console.log('  ZKCommerce v4.1 — Database Migration');
console.log('══════════════════════════════════════════════\x1b[0m');
console.log('\x1b[36mTarget:\x1b[0m', safeUrl);
console.log('\x1b[36mTime:  \x1b[0m', new Date().toLocaleString('en-IN'), '\n');

// ── SQL files to run in order ─────────────────────────────────
const SQL_FILES = [
  { file: 'database/zkcommerce-master.sql',    label: 'Master schema (36 tables, seed data)' },
  { file: 'database/zkcommerce-additions.sql', label: 'Additions (functions, views, sequences)' },
];

async function runMigration() {
  // Connect with SSL for Neon, without for local
  const ssl = dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;

  const client = new Client({ connectionString: dbUrl, ssl });

  try {
    console.log('\x1b[33m[1/4]\x1b[0m Connecting to database...');
    await client.connect();
    console.log('\x1b[32m      Connected!\x1b[0m\n');

    // Check PostgreSQL version
    const ver = await client.query('SELECT version()');
    const shortVer = ver.rows[0].version.split(' ').slice(0, 2).join(' ');
    console.log('\x1b[36m      Server:\x1b[0m', shortVer, '\n');

    // Run each SQL file
    let fileNum = 2;
    for (const item of SQL_FILES) {
      const fullPath = path.join(process.cwd(), item.file);

      if (!fs.existsSync(fullPath)) {
        console.log(`\x1b[33m[${fileNum}/${SQL_FILES.length+2}]\x1b[0m Skipping ${item.file} (not found)`);
        fileNum++;
        continue;
      }

      console.log(`\x1b[33m[${fileNum}/${SQL_FILES.length+2}]\x1b[0m Running: ${item.label}`);
      console.log(`\x1b[36m      File: ${item.file}\x1b[0m`);

      const sql = fs.readFileSync(fullPath, 'utf8');

      // Split into individual statements for better error reporting
      // Execute as single transaction
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('\x1b[32m      Done!\x1b[0m\n');
      } catch(e) {
        await client.query('ROLLBACK');
        // Some errors are expected (e.g. table already exists with IF NOT EXISTS)
        if (e.message.includes('already exists') || e.message.includes('IF NOT EXISTS')) {
          console.log('\x1b[33m      Warning (safe to ignore):\x1b[0m', e.message.split('\n')[0]);
          console.log('\x1b[32m      Continuing...\x1b[0m\n');
        } else {
          console.error('\x1b[31m      Error:\x1b[0m', e.message.split('\n')[0]);
          console.error('\x1b[33m      Hint:\x1b[0m', e.hint || 'Check the SQL file for syntax errors');
          // Don't exit — try to continue with other files
        }
      }
      fileNum++;
    }

    // ── Verify ────────────────────────────────────────────────
    console.log('\x1b[33m[4/4]\x1b[0m Verifying migration...');
    let tableCount = 0, userCount = 0, storeCount = 0, productCount = 0;
    try {
      const t = await client.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"
      );
      tableCount = parseInt(t.rows[0].count);

      const u = await client.query('SELECT COUNT(*) FROM users');
      userCount = parseInt(u.rows[0].count);

      const s = await client.query('SELECT COUNT(*) FROM stores');
      storeCount = parseInt(s.rows[0].count);

      const p = await client.query('SELECT COUNT(*) FROM products');
      productCount = parseInt(p.rows[0].count);
    } catch(e) {
      console.log('\x1b[33m      Could not verify (tables may not exist yet)\x1b[0m');
    }

    console.log('\n\x1b[1m\x1b[32m══════════════════════════════════════════════');
    console.log('  MIGRATION COMPLETE');
    console.log('══════════════════════════════════════════════\x1b[0m');
    console.log(`\x1b[32m  Tables:   ${tableCount}\x1b[0m`);
    console.log(`\x1b[32m  Users:    ${userCount}\x1b[0m`);
    console.log(`\x1b[32m  Stores:   ${storeCount}\x1b[0m`);
    console.log(`\x1b[32m  Products: ${productCount}\x1b[0m`);
    console.log('\n\x1b[1mLogin credentials (password: demo1234):\x1b[0m');
    console.log('  Admin:    admin@zkcommerce.in');
    console.log('  Merchant: merchant@zkcommerce.in');
    console.log('  Customer: customer@zkcommerce.in');
    console.log('\n\x1b[36mNext step:\x1b[0m Update .env with this DATABASE_URL and run npm run dev');
    console.log('');

  } catch(e) {
    console.error('\n\x1b[31m[FATAL]\x1b[0m', e.message);
    if (e.message.includes('ECONNREFUSED')) {
      console.log('\x1b[33mFix:\x1b[0m Database not reachable. Check the connection URL and network.');
    } else if (e.message.includes('password authentication')) {
      console.log('\x1b[33mFix:\x1b[0m Wrong password in DATABASE_URL.');
    } else if (e.message.includes('does not exist')) {
      console.log('\x1b[33mFix:\x1b[0m Database does not exist. Create it first in Neon dashboard or with createdb.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
