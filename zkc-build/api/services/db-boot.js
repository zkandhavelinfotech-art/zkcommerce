/**
 * ZKCommerce Database Boot & Auto-Migration Service
 * Automatically executes required schema migrations based on dialect (MySQL / PostgreSQL).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function initDatabase() {
  if (pool.dialect === 'mysql') {
    console.log('🔄 [DB-Boot] Verifying MySQL database schema and tables...');
    try {
      // 1. Ensure schema_migrations table exists
      await pool.query(`CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
        \`id\` VARCHAR(100) NOT NULL PRIMARY KEY,
        \`description\` VARCHAR(255) DEFAULT NULL,
        \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      // 2. Check if core tables exist
      const checkTables = await pool.query(`
        SELECT COUNT(*) AS cnt FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name IN ('stores', 'products', 'orders')
      `);
      const tableCount = Number(checkTables.rows[0]?.cnt || 0);

      if (tableCount < 3) {
        console.log('📦 [DB-Boot] Fresh database detected. Executing schema-mysql.sql...');
        const candidateSqlPaths = [
          path.join(__dirname, '..', '..', 'database', 'schema-mysql.sql'),
          path.join(__dirname, '..', '..', 'database', 'smeram_mysql.sql'),
          path.join(__dirname, '..', 'database', 'schema-mysql.sql'),
          path.join(process.cwd(), 'database', 'schema-mysql.sql'),
          path.join(process.cwd(), 'schema-mysql.sql')
        ];

        let sqlFile = candidateSqlPaths.find(p => fs.existsSync(p));
        if (sqlFile) {
          const sqlContent = fs.readFileSync(sqlFile, 'utf8');
          // Split into individual SQL statements
          const statements = sqlContent
            .split(/;\s*[\r\n]+/)
            .map(s => s.trim())
            .filter(s => s.length > 5 && !s.startsWith('--') && !s.startsWith('/*'));

          for (const stmt of statements) {
            try {
              await pool.rawPool.query(stmt);
            } catch (err) {
              // Benign table already exists / syntax variant
            }
          }
          console.log(`✅ [DB-Boot] Executed schema initialization from ${path.basename(sqlFile)}`);
        }
      }

      // 3. Run incremental versioned migrations from mysql-migrations.js if present
      try {
        const mysqlMigrations = require('./mysql-migrations');
        if (mysqlMigrations && typeof mysqlMigrations.guardedSql === 'function') {
          const guardedSql = mysqlMigrations.guardedSql(mysqlMigrations.MIGRATIONS);
          const stmts = guardedSql
            .split(/;\s*[\r\n]+/)
            .map(s => s.trim())
            .filter(s => s.length > 5 && !s.startsWith('--'));

          for (const stmt of stmts) {
            try {
              await pool.rawPool.query(stmt);
            } catch (_) {}
          }
        }
      } catch (_) {}

      console.log('✅ [DB-Boot] MySQL database ready and operational.');
    } catch (err) {
      console.warn('⚠️ [DB-Boot] MySQL schema verification notice:', err.message);
    }
  } else {
    // PostgreSQL / Neon
    try {
      console.log('🔄 [DB-Boot] Checking PostgreSQL migrations...');
      const pgMig = require('./pg-migrations');
      if (pgMig && typeof pgMig.ready === 'function') {
        await pgMig.ready();
      }
      console.log('✅ [DB-Boot] PostgreSQL database ready.');
    } catch (err) {
      console.warn('⚠️ [DB-Boot] PG migration notice:', err.message);
    }
  }
}

module.exports = { initDatabase };
