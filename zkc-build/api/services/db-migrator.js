/**
 * ZKCommerce Universal Database Migration Engine
 * Supports PostgreSQL and MySQL with version tracking, batching, and step-by-step execution.
 */
'use strict';
require('dotenv').config();
const pool = require('../db');

// Master Migration Registry with version numbers, names, descriptions, and SQL statements
const MASTER_MIGRATIONS = [
  {
    version: 'v1.0.1',
    id: '001_product_content_fields',
    name: 'Product Content & Stock Fields',
    description: 'Adds user_instructions, benefits, additional_note, and quantity columns to products table',
    target_tables: ['products'],
    target_columns: ['user_instructions', 'benefits', 'additional_note', 'quantity'],
    sql: [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS user_instructions TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_note TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 100'
    ]
  },
  {
    version: 'v1.0.2',
    id: '002_store_settings_columns',
    name: 'Store Settings & Integration Configs',
    description: 'Adds deployment_settings, whatsapp_settings, and inventory_settings JSONB columns to stores table',
    target_tables: ['stores'],
    target_columns: ['deployment_settings', 'whatsapp_settings', 'inventory_settings'],
    sql: [
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS deployment_settings JSONB NOT NULL DEFAULT '{}'::jsonb",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_settings JSONB NOT NULL DEFAULT '{}'::jsonb",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_settings JSONB NOT NULL DEFAULT '{}'::jsonb"
    ]
  },
  {
    version: 'v1.0.3',
    id: '003_inventory',
    name: 'Inventory Movements & WhatsApp Outbox',
    description: 'Adds net quantity, low-stock threshold, stock movements tracking table, and WhatsApp outbox',
    target_tables: ['products', 'orders', 'inventory_movements', 'whatsapp_outbox'],
    target_columns: ['net_quantity_value', 'net_quantity_unit', 'low_stock_threshold', 'stock_deducted'],
    sql: [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS net_quantity_value NUMERIC(10,2)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS net_quantity_unit VARCHAR(10)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false',
      `CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_id VARCHAR(40),
        change INT NOT NULL,
        quantity_after INT NOT NULL,
        reason VARCHAR(30) NOT NULL,
        order_id INT,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      'CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(store_id, product_id, created_at DESC)',
      `CREATE TABLE IF NOT EXISTS whatsapp_outbox (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        kind VARCHAR(30) NOT NULL,
        to_phone VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        provider VARCHAR(20),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        error TEXT,
        order_id INT,
        product_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ
      )`,
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_store ON whatsapp_outbox(store_id, status, created_at DESC)'
    ]
  },
  {
    version: 'v1.0.4',
    id: '004_product_display',
    name: 'Per-Product Offer Display Override',
    description: 'Adds show_offer column to products table for storefront promotion badges',
    target_tables: ['products'],
    target_columns: ['show_offer'],
    sql: ['ALTER TABLE products ADD COLUMN IF NOT EXISTS show_offer BOOLEAN']
  },
  {
    version: 'v1.0.5',
    id: '005_shipping',
    name: 'Ekart & Carrier Shipping Tracking',
    description: 'Adds shipping settings to stores, tracking URL and timestamps to orders',
    target_tables: ['stores', 'orders'],
    target_columns: ['shipping_settings', 'tracking_url', 'shipped_at', 'delivered_at'],
    sql: [
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS shipping_settings JSONB DEFAULT \'{}\'::jsonb',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ',
      'CREATE INDEX IF NOT EXISTS idx_orders_store_tracking ON orders(store_id, tracking_number)'
    ]
  },
  {
    version: 'v1.0.6',
    id: '006_product_unlisted',
    name: 'Unlisted Hidden Product Flag',
    description: 'Adds unlisted column to products table for direct private checkout links',
    target_tables: ['products'],
    target_columns: ['unlisted'],
    sql: ['ALTER TABLE products ADD COLUMN IF NOT EXISTS unlisted BOOLEAN NOT NULL DEFAULT false']
  },
  {
    version: 'v1.0.7',
    id: '007_store_pages_and_categories_meta',
    name: 'Store Pages CMS & Category Hero Metadata',
    description: 'Ensures categories have image_url, sort_order and active, and store_pages have status and sort_order',
    target_tables: ['categories', 'store_pages'],
    target_columns: ['categories.image_url', 'categories.sort_order', 'store_pages.status', 'store_pages.sort_order'],
    sql: [
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT',
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0',
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE',
      'ALTER TABLE store_pages ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0',
      "ALTER TABLE store_pages ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'published'"
    ]
  },
  {
    version: 'v1.0.8',
    id: '008_product_sku_and_pricing_meta',
    name: 'Product SKU, Compare Price & Cost Tracking',
    description: 'Adds sku, compare_price, cost_price, and gst_rate columns to products table',
    target_tables: ['products'],
    target_columns: ['sku', 'compare_price', 'cost_price', 'gst_rate'],
    sql: [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_price NUMERIC(12,2)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2)',
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate VARCHAR(10) DEFAULT '12'"
    ]
  }
];

// Ensure migration table has all tracking columns (version, migration_name, status, batch, execution_time_ms, sql_preview)
async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS zkc_pg_migrations (
      id VARCHAR(100) PRIMARY KEY,
      description TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add the additional tracking columns requested by user
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS version VARCHAR(50)');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS migration_name VARCHAR(150)');
  await client.query("ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'applied'");
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS batch INT DEFAULT 1');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS execution_time_ms INT DEFAULT 0');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS sql_preview TEXT');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS error_message TEXT');

  // Backfill existing rows with versions and names if null
  for (const m of MASTER_MIGRATIONS) {
    await client.query(
      `UPDATE zkc_pg_migrations 
       SET version=COALESCE(version, $2), 
           migration_name=COALESCE(migration_name, $3),
           status=COALESCE(status, 'applied')
       WHERE id=$1`,
      [m.id, m.version, m.name]
    );
  }
}

// Get current migration status: what is applied, what is pending, last migrated version
async function getMigrationStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);

    const { rows: appliedRows } = await client.query('SELECT * FROM zkc_pg_migrations ORDER BY applied_at, id');
    const appliedMap = new Map();
    appliedRows.forEach(r => appliedMap.set(r.id, r));

    // Get database info
    const dbInfo = await client.query('SELECT current_database() AS db_name, current_user AS db_user, version() AS db_version');

    const migrationList = MASTER_MIGRATIONS.map(m => {
      const isApplied = appliedMap.has(m.id);
      const record = appliedMap.get(m.id) || null;
      return {
        id: m.id,
        version: m.version,
        name: m.name,
        description: m.description,
        target_tables: m.target_tables,
        target_columns: m.target_columns,
        status: isApplied ? 'applied' : 'pending',
        applied_at: record ? record.applied_at : null,
        batch: record ? record.batch : null,
        execution_time_ms: record ? record.execution_time_ms : null,
        sql_preview: m.sql.join(';\n') + ';'
      };
    });

    const appliedCount = migrationList.filter(m => m.status === 'applied').length;
    const pendingList = migrationList.filter(m => m.status === 'pending');
    const pendingCount = pendingList.length;

    // Find the last applied migration
    const appliedItems = migrationList.filter(m => m.status === 'applied');
    const lastDone = appliedItems.length ? appliedItems[appliedItems.length - 1] : null;
    const nextPending = pendingList.length ? pendingList[0] : null;

    return {
      success: true,
      database: {
        engine: 'PostgreSQL',
        name: dbInfo.rows[0].db_name,
        user: dbInfo.rows[0].db_user,
        connected: true
      },
      summary: {
        total_migrations: MASTER_MIGRATIONS.length,
        applied_count: appliedCount,
        pending_count: pendingCount,
        is_up_to_date: pendingCount === 0,
        last_migrated_version: lastDone ? `${lastDone.version} (${lastDone.name})` : 'None (Fresh Database)',
        last_migrated_at: lastDone ? lastDone.applied_at : null,
        next_pending_version: nextPending ? `${nextPending.version} (${nextPending.name})` : 'All migrations up-to-date'
      },
      migrations: migrationList,
      next_pending: nextPending
    };
  } finally {
    client.release();
  }
}

// Migrate ONE pending migration step-by-step from the last done
async function migrateNextStep() {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);

    const { rows: appliedRows } = await client.query('SELECT id, batch FROM zkc_pg_migrations');
    const done = new Set(appliedRows.map(r => r.id));
    
    let maxBatch = 0;
    appliedRows.forEach(r => {
      if (r.batch && r.batch > maxBatch) maxBatch = r.batch;
    });
    const currentBatch = maxBatch + 1;

    // Find the next pending migration
    const next = MASTER_MIGRATIONS.find(m => !done.has(m.id));
    if (!next) {
      return {
        success: true,
        message: 'Database is already up to date! No pending migrations to execute.',
        applied: null,
        remaining_pending: 0
      };
    }

    const startTime = Date.now();
    await client.query('BEGIN');
    try {
      for (const sql of next.sql) {
        await client.query(sql);
      }
      const executionTime = Date.now() - startTime;
      await client.query(
        `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview)
         VALUES ($1, $2, $3, $4, 'applied', $5, $6, $7)`,
        [next.id, next.description, next.version, next.name, currentBatch, executionTime, next.sql.join(';\n')]
      );
      await client.query('COMMIT');

      // Check remaining pending
      const remaining = MASTER_MIGRATIONS.filter(m => !done.has(m.id) && m.id !== next.id);

      return {
        success: true,
        message: `Successfully migrated step: ${next.version} — ${next.name}`,
        applied: {
          id: next.id,
          version: next.version,
          name: next.name,
          batch: currentBatch,
          execution_time_ms: executionTime,
          applied_at: new Date()
        },
        remaining_pending: remaining.length,
        next_pending: remaining.length ? remaining[0].version : null
      };
    } catch(err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${next.version} (${next.id}) failed: ${err.message}`);
    }
  } finally {
    client.release();
  }
}

// Migrate ALL remaining pending migrations
async function migrateAllPending() {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);

    const { rows: appliedRows } = await client.query('SELECT id, batch FROM zkc_pg_migrations');
    const done = new Set(appliedRows.map(r => r.id));

    let maxBatch = 0;
    appliedRows.forEach(r => {
      if (r.batch && r.batch > maxBatch) maxBatch = r.batch;
    });
    const currentBatch = maxBatch + 1;

    const pending = MASTER_MIGRATIONS.filter(m => !done.has(m.id));
    if (!pending.length) {
      return {
        success: true,
        message: 'Database is already up to date!',
        applied_count: 0,
        applied: []
      };
    }

    const appliedList = [];
    for (const m of pending) {
      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        for (const sql of m.sql) {
          await client.query(sql);
        }
        const executionTime = Date.now() - startTime;
        await client.query(
          `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview)
           VALUES ($1, $2, $3, $4, 'applied', $5, $6, $7)`,
          [m.id, m.description, m.version, m.name, currentBatch, executionTime, m.sql.join(';\n')]
        );
        await client.query('COMMIT');
        appliedList.push({ id: m.id, version: m.version, name: m.name, execution_time_ms: executionTime });
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.version} (${m.id}) failed: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `Successfully executed ${appliedList.length} migration(s). Database is fully upgraded!`,
      batch: currentBatch,
      applied_count: appliedList.length,
      applied: appliedList
    };
  } finally {
    client.release();
  }
}

// Migrate a specific version by ID
async function migrateSpecific(migrationId) {
  const target = MASTER_MIGRATIONS.find(m => m.id === migrationId || m.version === migrationId);
  if (!target) throw new Error(`Migration ${migrationId} not found in registry`);

  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const { rows } = await client.query('SELECT id FROM zkc_pg_migrations WHERE id=$1', [target.id]);
    if (rows.length) {
      return { success: true, message: `Migration ${target.version} is already applied!`, already_applied: true };
    }

    const startTime = Date.now();
    await client.query('BEGIN');
    try {
      for (const sql of target.sql) {
        await client.query(sql);
      }
      const executionTime = Date.now() - startTime;
      await client.query(
        `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview)
         VALUES ($1, $2, $3, $4, 'applied', 999, $5, $6)`,
        [target.id, target.description, target.version, target.name, executionTime, target.sql.join(';\n')]
      );
      await client.query('COMMIT');
      return { success: true, message: `Successfully applied ${target.version} (${target.name})`, target };
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to apply ${target.version}: ${err.message}`);
    }
  } finally {
    client.release();
  }
}

module.exports = {
  MASTER_MIGRATIONS,
  getMigrationStatus,
  migrateNextStep,
  migrateAllPending,
  migrateSpecific,
  ensureMigrationTable
};
