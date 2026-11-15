/**
 * ZKCommerce Universal Database Adapter
 * Seamlessly supports:
 *  1. MySQL (GoDaddy cPanel / MariaDB / AWS RDS)
 *  2. PostgreSQL (Neon / Railway / Local Postgres)
 * 
 * Auto-detects dialect from connection URL or environment variables:
 *  - DB_DIALECT=mysql, DB_TYPE=mysql, or DATABASE_URL starting with mysql:// / mysql2://
 *  - Or DB_HOST set without a postgres:// URL
 * 
 * When running on MySQL, automatically translates PostgreSQL queries:
 *  - Converts positional placeholders $1, $2, $3 to ?
 *  - Strips PostgreSQL type casts (::int, ::text, etc.)
 *  - Rewrites COUNT(*) FILTER (WHERE ...) to SUM(CASE WHEN ... THEN 1 ELSE 0 END)
 *  - Replaces ILIKE with LIKE
 *  - Emulates RETURNING for INSERTs by querying the inserted row or returning the insertId
 *  - Standardizes response shape to { rows, rowCount, fields, insertId }
 */
'use strict';

const mysql = require('mysql2/promise');
const { Pool: PgPool } = require('pg');

const rawDbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || '';
const isMysql = Boolean(
  process.env.DB_DIALECT === 'mysql' ||
  process.env.DB_TYPE === 'mysql' ||
  rawDbUrl.startsWith('mysql://') ||
  rawDbUrl.startsWith('mysql2://') ||
  (process.env.DB_HOST && !rawDbUrl.startsWith('postgres://') && !rawDbUrl.startsWith('postgresql://'))
);

let poolInstance;

if (isMysql) {
  let mysqlConfig = {
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    decimalNumbers: true
  };

  if (rawDbUrl && (rawDbUrl.startsWith('mysql://') || rawDbUrl.startsWith('mysql2://'))) {
    mysqlConfig.uri = rawDbUrl.replace(/^mysql2:\/\//, 'mysql://');
  } else {
    mysqlConfig.host = process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost';
    mysqlConfig.user = process.env.DB_USER || process.env.MYSQL_USER || 'root';
    mysqlConfig.password = process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
    mysqlConfig.database = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'smeram_store';
    mysqlConfig.port = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
  }

  const rawMysqlPool = mysql.createPool(mysqlConfig);

  function translateSql(sqlText, params = []) {
    let queryStr = String(sqlText || '');
    let returningClause = null;

    // Detect and strip RETURNING clause
    const retMatch = queryStr.match(/\s+RETURNING\s+(.+)$/i);
    if (retMatch) {
      returningClause = retMatch[1].trim();
      queryStr = queryStr.replace(/\s+RETURNING\s+(.+)$/i, '');
    }

    // Rewrite COUNT(*) FILTER (WHERE condition) to SUM(CASE WHEN ... THEN 1 ELSE 0 END)
    queryStr = queryStr.replace(/COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi, 'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)');

    // Strip PostgreSQL ::type casts
    queryStr = queryStr.replace(/::[a-zA-Z0-9_]+/g, '');

    // Replace ILIKE with LIKE
    queryStr = queryStr.replace(/\bILIKE\b/gi, 'LIKE');

    // Convert $1, $2, $3 to ? while mapping parameters in exact sequence
    const effectiveParams = [];
    const hasPlaceholders = /\$([0-9]+)/.test(queryStr);
    if (hasPlaceholders) {
      queryStr = queryStr.replace(/\$([0-9]+)/g, (match, num) => {
        const idx = parseInt(num, 10) - 1;
        effectiveParams.push(params[idx]);
        return '?';
      });
    }

    return {
      sql: queryStr,
      params: effectiveParams.length > 0 ? effectiveParams : params,
      returning: returningClause
    };
  }

  poolInstance = {
    dialect: 'mysql',
    rawPool: rawMysqlPool,

    async query(sqlText, params = []) {
      const translated = translateSql(sqlText, params);

      try {
        const [result, fields] = await rawMysqlPool.query(translated.sql, translated.params);

        if (Array.isArray(result)) {
          return {
            rows: result,
            rowCount: result.length,
            fields: fields || []
          };
        } else {
          const affected = (result && result.affectedRows) || 0;
          const insertId = (result && result.insertId) || null;

          let rows = [];
          if (translated.returning && insertId) {
            try {
              const tableMatch = translated.sql.match(/INSERT\s+INTO\s+([`\w]+)/i);
              if (tableMatch) {
                const tbl = tableMatch[1];
                const [fetched] = await rawMysqlPool.query(`SELECT * FROM ${tbl} WHERE id = ? LIMIT 1`, [insertId]);
                if (Array.isArray(fetched) && fetched.length > 0) {
                  rows = fetched;
                }
              }
            } catch (_) {}
            if (rows.length === 0) {
              rows = [{ id: insertId }];
            }
          }

          return {
            rows,
            rowCount: affected,
            insertId,
            fields: fields || []
          };
        }
      } catch (err) {
        console.error('[MySQL Query Error]:', err.message);
        console.error('SQL:', translated.sql);
        console.error('Params:', translated.params);
        throw err;
      }
    },

    async end() {
      return rawMysqlPool.end();
    },

    on(event, handler) {
      return this;
    }
  };

  console.log(`[ZKCommerce DB] Initialized MySQL connection pool (${mysqlConfig.host || 'URI'}/${mysqlConfig.database || 'database'})`);
} else {
  // PostgreSQL (Neon / Railway / Supabase / Local)
  const pgPool = new PgPool({
    connectionString: rawDbUrl || 'postgresql://postgres:postgres@localhost:5432/zkcommerce',
    ssl: process.env.NODE_ENV === 'production' && !rawDbUrl.includes('localhost') ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pgPool.on('error', (err) => {
    console.error('[ZKCommerce DB] Unexpected PG pool error:', err.message);
  });

  poolInstance = pgPool;
  poolInstance.dialect = 'postgres';
  console.log('[ZKCommerce DB] Initialized PostgreSQL connection pool');
}

module.exports = poolInstance;
