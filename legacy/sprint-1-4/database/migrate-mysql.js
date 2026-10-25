/**
 * ZKCommerce v4.1 — MySQL Migration Runner
 * Executes database/schema-mysql.sql against the configured MySQL database.
 * Usage: node database/migrate-mysql.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL is not set.');
  console.error('Please configure your GoDaddy MySQL connection string in .env:');
  console.error('DATABASE_URL=mysql://username:password@localhost:3306/dbname');
  process.exit(1);
}

async function runMySQLMigration() {
  console.log('🔄 Connecting to MySQL database...');
  let connection;
  try {
    connection = await mysql.createConnection({
      uri: dbUrl,
      multipleStatements: true
    });
    console.log('✅ Connected to MySQL successfully.');

    const sqlPath = path.join(__dirname, 'schema-mysql.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Schema file not found at ${sqlPath}`);
    }

    console.log('📦 Executing schema-mysql.sql...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await connection.query(sql);

    console.log('🎉 MySQL database migration completed successfully! All tables created & seeded.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMySQLMigration();
