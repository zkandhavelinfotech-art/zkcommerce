/**
 * ZKCommerce schema migration runner (Node.js only; no psql dependency).
 * Usage: node database/migrate.js [local|dev|development|test|staging|production]
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DEFAULT_SQL_FILES = [
  'schema.sql',
  'phase1-additions.sql',
  'phase2-additions.sql',
  'phase3-preflight.sql',
  'phase3-additions.sql'
];

const ENV_ALIASES = {
  local: 'development',
  dev: 'development',
  development: 'development',
  test: 'testing',
  testing: 'testing',
  stage: 'staging',
  staging: 'staging',
  prod: 'production',
  production: 'production'
};

function normalizeEnvironment(value = 'development') {
  const normalized = ENV_ALIASES[String(value).toLowerCase()];
  if (!normalized) {
    throw new Error(`Unknown environment "${value}". Use local, dev, testing, staging, or production.`);
  }
  return normalized;
}

function loadEnvironment(value) {
  const environment = normalizeEnvironment(value || 'development');
  const root = path.join(__dirname, '..');
  const envFile = path.join(root, 'deployment', 'environments', `.env.${environment}`);

  // Platform-provided variables remain authoritative. Environment-specific files
  // are optional local conveniences, with .env as the final fallback.
  if (fs.existsSync(envFile)) require('dotenv').config({ path: envFile });
  const fallback = path.join(root, '.env');
  if (fs.existsSync(fallback)) require('dotenv').config({ path: fallback });
  return environment;
}

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runMigrations(options = {}) {
  const environment = loadEnvironment(options.env || process.argv[2]);
  const connectionString = process.env.DIRECT_DATABASE_URL ||
    options.connectionString || process.env.DATABASE_URL;
  const logger = options.logger || console.log;
  const sqlFiles = options.sqlFiles || DEFAULT_SQL_FILES;
  const migrationsDirectory = options.migrationsDirectory || __dirname;
  const client = options.client || new Client({ connectionString });

  if (!connectionString && !options.client) {
    throw new Error('Set DIRECT_DATABASE_URL (recommended for Neon) or DATABASE_URL.');
  }
  if (connectionString && /-pooler\./i.test(connectionString)) {
    logger('[Warning] Migration URL uses Neon pooling; prefer DIRECT_DATABASE_URL with a non-pooler host.', 'WARN');
  }

  logger(`[Migration] Environment: ${environment}`);
  logger('[Migration] Connecting to PostgreSQL...');

  try {
    await client.connect();
    await client.query("SELECT pg_advisory_lock(hashtext('zkcommerce-schema-migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS zkcommerce_schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const filename of sqlFiles) {
      const filePath = path.join(migrationsDirectory, filename);
      if (!fs.existsSync(filePath)) throw new Error(`Migration file not found: ${filename}`);

      const sql = fs.readFileSync(filePath, 'utf8');
      const digest = checksum(sql);
      const applied = await client.query(
        'SELECT checksum FROM zkcommerce_schema_migrations WHERE filename = $1',
        [filename]
      );

      if (applied.rows.length) {
        if (applied.rows[0].checksum.trim() !== digest) {
          throw new Error(`Applied migration changed on disk: ${filename}`);
        }
        logger(`[Migration] Skipping ${filename} (already applied).`);
        continue;
      }

      logger(`[Migration] Applying ${filename}...`);
      await client.query('BEGIN');
      try {
        // Send the complete file through node-postgres. PostgreSQL then parses
        // PL/pgSQL dollar-quoted bodies correctly.
        await client.query(sql);
        await client.query(
          'INSERT INTO zkcommerce_schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, digest]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${filename}: ${error.message}`, { cause: error });
      }
      logger(`[Migration] Applied ${filename}.`);
    }
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(hashtext('zkcommerce-schema-migrations'))"); } catch (_) {}
    await client.end();
    logger('[Migration] Disconnected.');
  }
}

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error(`[Migration] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_SQL_FILES, checksum, loadEnvironment, normalizeEnvironment, runMigrations };
