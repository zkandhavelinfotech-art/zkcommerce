/**
 * ZKCommerce v4.1 — Dual Database Adapter
 * Seamlessly supports both MySQL (GoDaddy / cPanel) and PostgreSQL (Neon / Supabase / AWS)
 */
'use strict';

const dbUrl = process.env.DATABASE_URL || '';
const isMySQL = dbUrl.startsWith('mysql://') || dbUrl.startsWith('mysql2://') || process.env.DB_TYPE === 'mysql';

let db = null;

if (!dbUrl) {
  console.warn('⚠️  Database: Not configured. (Set DATABASE_URL to your GoDaddy MySQL or PostgreSQL connection string)');
  // Fallback safe client so the server boots cleanly without crashing
  db = {
    type: 'none',
    query: async (sql, params) => {
      return { rows: [], rowCount: 0 };
    },
    on: () => {},
    getClient: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {}
    })
  };
} else if (isMySQL) {
  const mysql = require('mysql2/promise');
  console.log('🗄️  Database Driver: MySQL / MariaDB (GoDaddy)');

  let pool;
  try {
    pool = mysql.createPool(dbUrl);
  } catch (e) {
    console.error('Failed to initialize MySQL pool:', e.message);
  }

  db = {
    type: 'mysql',
    pool,
    on: () => {},
    query: async (sql, params = []) => {
      if (!pool) return { rows: [], rowCount: 0 };
      // Adapt PostgreSQL $1, $2 placeholders to MySQL ?
      const mysqlSql = sql.replace(/\$(\d+)/g, '?');
      const [results] = await pool.query(mysqlSql, params);
      const rows = Array.isArray(results) ? results : (results ? [results] : []);
      return { rows, rowCount: rows.length };
    },
    getClient: async () => {
      if (!pool) {
        return {
          query: async () => ({ rows: [], rowCount: 0 }),
          release: () => {}
        };
      }
      const connection = await pool.getConnection();
      return {
        query: async (sql, params = []) => {
          const mysqlSql = sql.replace(/\$(\d+)/g, '?');
          const [results] = await connection.query(mysqlSql, params);
          const rows = Array.isArray(results) ? results : (results ? [results] : []);
          return { rows, rowCount: rows.length };
        },
        release: () => connection.release()
      };
    }
  };
} else {
  const { Pool } = require('pg');
  console.log('🗄️  Database Driver: PostgreSQL');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' && !dbUrl.includes('localhost') ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });

  pool.on('error', (err) => console.error('Unexpected Postgres DB error', err));
  db = pool;
  db.type = 'postgres';
}

module.exports = db;
