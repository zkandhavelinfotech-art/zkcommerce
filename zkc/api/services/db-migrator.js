/**
 * ZKCommerce Universal Database Migration Engine
 * Supports PostgreSQL and MySQL with version tracking, batching, step-by-step, and selected-file execution.
 * Full audit history with success, pending, and failed error log diagnostics.
 */
'use strict';
require('dotenv').config();
const pool = require('../db');

// Master Migration Registry (All versions from v1.0.1 up to v1.0.26 / v4.10)
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
  },
  {
    version: 'v1.0.9',
    id: '009_order_payment_meta',
    name: 'Razorpay Signature & Payment Gateway Audit',
    description: 'Adds razorpay_signature and payment_gateway columns for verified online transactions and invoices',
    target_tables: ['orders'],
    target_columns: ['razorpay_signature', 'payment_gateway'],
    sql: [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_signature TEXT',
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(40) DEFAULT 'razorpay'"
    ]
  },
  {
    version: 'v1.0.10',
    id: '010_store_branding_and_announcements',
    name: 'Store Banner & Announcement Bar Config',
    description: 'Adds banner_url and announcement_enabled to stores table for complete store theme branding',
    target_tables: ['stores'],
    target_columns: ['banner_url', 'announcement_enabled'],
    sql: [
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS banner_url TEXT',
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS announcement_enabled BOOLEAN DEFAULT FALSE'
    ]
  },
  {
    version: 'v1.0.11',
    id: '011_packaging_manifests_and_awb',
    name: 'Ekart Logistics AWB & Packaging Manifests',
    description: 'Adds awb_number, delivery_status, courier_assigned_at, label_printed, and packaging_manifests table',
    target_tables: ['orders', 'packaging_manifests'],
    target_columns: ['awb_number', 'delivery_status', 'courier_assigned_at', 'label_printed', 'packaging_manifests'],
    sql: [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_number VARCHAR(100)',
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'unassigned'",
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_assigned_at TIMESTAMPTZ',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_printed BOOLEAN DEFAULT FALSE',
      `CREATE TABLE IF NOT EXISTS packaging_manifests (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        manifest_number VARCHAR(50) NOT NULL UNIQUE,
        carrier VARCHAR(50) DEFAULT 'Ekart Logistics',
        total_orders INT DEFAULT 0,
        order_ids TEXT,
        status VARCHAR(30) DEFAULT 'generated',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      'CREATE INDEX IF NOT EXISTS idx_manifests_store ON packaging_manifests(store_id, created_at DESC)'
    ]
  },
  {
    version: 'v1.0.12',
    id: '012_order_hold_synchronization',
    name: 'Order Hold Status & Ekart Dispatch Pause',
    description: 'Adds on_hold flag, hold_reason, and hold_at timestamp to sync order holds with courier dispatch',
    target_tables: ['orders'],
    target_columns: ['on_hold', 'hold_reason', 'hold_at'],
    sql: [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT FALSE',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_reason VARCHAR(255)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_at TIMESTAMPTZ'
    ]
  },
  {
    version: 'v1.0.13',
    id: '013_fiscal_year_statutory_invoices',
    name: 'Statutory Indian Fiscal Year Invoices (SMR/26-27/0001)',
    description: 'Adds fy_year, invoice_sequence, place_of_supply, hsn_summary_json, and creates smeram_invoices table',
    target_tables: ['invoices', 'smeram_invoices'],
    target_columns: ['invoices.fy_year', 'invoices.invoice_sequence', 'invoices.place_of_supply', 'invoices.hsn_summary_json'],
    sql: [
      'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fy_year VARCHAR(20)',
      'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_sequence INT',
      'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100)',
      "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hsn_summary_json JSONB DEFAULT '{}'::jsonb",
      `CREATE TABLE IF NOT EXISTS smeram_invoices (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL UNIQUE,
        invoice_number VARCHAR(100) NOT NULL UNIQUE,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    ]
  },
  {
    version: 'v1.0.14',
    id: '014_coupons_and_cart_promo_control',
    name: 'Cart Promo Code Box & Discount Rules Engine',
    description: 'Adds cart_promo_enabled to stores and creates coupons table with min-order and usage limits',
    target_tables: ['stores', 'coupons'],
    target_columns: ['stores.cart_promo_enabled', 'coupons'],
    sql: [
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS cart_promo_enabled BOOLEAN NOT NULL DEFAULT FALSE',
      `CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
        discount_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        min_order_amount NUMERIC(10,2) DEFAULT 0.00,
        max_discount NUMERIC(10,2),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      'CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons(store_id, code)'
    ]
  },
  {
    version: 'v1.0.26',
    id: '015_gst_audit_and_eway_bill',
    name: 'Statutory GST Tax Audit & E-Way Bill Advisory',
    description: 'Adds eway_bill_number, eway_bill_required to orders, and creates gst_settings table for statutory compliance',
    target_tables: ['orders', 'gst_settings'],
    target_columns: ['orders.eway_bill_number', 'orders.eway_bill_required', 'gst_settings'],
    sql: [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS eway_bill_number VARCHAR(50)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS eway_bill_required BOOLEAN DEFAULT FALSE',
      `CREATE TABLE IF NOT EXISTS gst_settings (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
        gstin VARCHAR(20),
        legal_name VARCHAR(150),
        trade_name VARCHAR(150),
        state_code VARCHAR(10) DEFAULT '33',
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    ]
  }
];

// Ensure migration table has all tracking columns
async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS zkc_pg_migrations (
      id VARCHAR(100) PRIMARY KEY,
      description TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS version VARCHAR(50)');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS migration_name VARCHAR(150)');
  await client.query("ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'applied'");
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS batch INT DEFAULT 1');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS execution_time_ms INT DEFAULT 0');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS sql_preview TEXT');
  await client.query('ALTER TABLE zkc_pg_migrations ADD COLUMN IF NOT EXISTS error_message TEXT');

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

// Get current migration status: what is applied, what is pending, what failed
async function getMigrationStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);

    const { rows: appliedRows } = await client.query('SELECT * FROM zkc_pg_migrations ORDER BY applied_at ASC, id ASC');
    const appliedMap = new Map();
    appliedRows.forEach(r => appliedMap.set(r.id, r));

    const dbInfo = await client.query('SELECT current_database() AS db_name, current_user AS db_user, version() AS db_version');

    const migrationList = MASTER_MIGRATIONS.map(m => {
      const record = appliedMap.get(m.id) || null;
      let status = 'pending';
      if (record) {
        status = record.status === 'failed' ? 'failed' : 'applied';
      }
      return {
        id: m.id,
        version: m.version,
        name: m.name,
        description: m.description,
        target_tables: m.target_tables,
        target_columns: m.target_columns,
        status: status,
        applied_at: record ? record.applied_at : null,
        batch: record ? record.batch : null,
        execution_time_ms: record ? record.execution_time_ms : null,
        error_message: record ? record.error_message : null,
        sql_preview: m.sql.join(';\n') + ';'
      };
    });

    const appliedCount = migrationList.filter(m => m.status === 'applied').length;
    const pendingList = migrationList.filter(m => m.status === 'pending');
    const failedList = migrationList.filter(m => m.status === 'failed');
    const pendingCount = pendingList.length;

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
        failed_count: failedList.length,
        is_up_to_date: pendingCount === 0 && failedList.length === 0,
        last_migrated_version: lastDone ? `${lastDone.version} (${lastDone.name})` : 'None (Fresh Database)',
        last_migrated_at: lastDone ? lastDone.applied_at : null,
        next_pending_version: nextPending ? `${nextPending.version} (${nextPending.name})` : 'All migrations up-to-date'
      },
      migrations: migrationList,
      next_pending: nextPending,
      failed_migrations: failedList
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

    const { rows: appliedRows } = await client.query("SELECT id, batch FROM zkc_pg_migrations WHERE status='applied'");
    const done = new Set(appliedRows.map(r => r.id));
    
    let maxBatch = 0;
    appliedRows.forEach(r => {
      if (r.batch && r.batch > maxBatch) maxBatch = r.batch;
    });
    const currentBatch = maxBatch + 1;

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
        `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
         VALUES ($1, $2, $3, $4, 'applied', $5, $6, $7, NULL)
         ON CONFLICT (id) DO UPDATE SET status='applied', batch=EXCLUDED.batch, execution_time_ms=EXCLUDED.execution_time_ms, error_message=NULL, applied_at=NOW()`,
        [next.id, next.description, next.version, next.name, currentBatch, executionTime, next.sql.join(';\n')]
      );
      await client.query('COMMIT');

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
      try {
        await client.query(
          `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
           VALUES ($1, $2, $3, $4, 'failed', $5, 0, $6, $7)
           ON CONFLICT (id) DO UPDATE SET status='failed', error_message=EXCLUDED.error_message`,
          [next.id, next.description, next.version, next.name, currentBatch, next.sql.join(';\n'), err.message]
        );
      } catch (_) {}
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

    const { rows: appliedRows } = await client.query("SELECT id, batch FROM zkc_pg_migrations WHERE status='applied'");
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
          `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
           VALUES ($1, $2, $3, $4, 'applied', $5, $6, $7, NULL)
           ON CONFLICT (id) DO UPDATE SET status='applied', batch=EXCLUDED.batch, execution_time_ms=EXCLUDED.execution_time_ms, error_message=NULL, applied_at=NOW()`,
          [m.id, m.description, m.version, m.name, currentBatch, executionTime, m.sql.join(';\n')]
        );
        await client.query('COMMIT');
        appliedList.push({ id: m.id, version: m.version, name: m.name, execution_time_ms: executionTime });
      } catch (err) {
        await client.query('ROLLBACK');
        try {
          await client.query(
            `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
             VALUES ($1, $2, $3, $4, 'failed', $5, 0, $6, $7)
             ON CONFLICT (id) DO UPDATE SET status='failed', error_message=EXCLUDED.error_message`,
            [m.id, m.description, m.version, m.name, currentBatch, m.sql.join(';\n'), err.message]
          );
        } catch (_) {}
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

// Migrate SPECIFIC migration by ID or version
async function migrateSpecific(migrationId) {
  const target = MASTER_MIGRATIONS.find(m => m.id === migrationId || m.version === migrationId);
  if (!target) throw new Error(`Migration ${migrationId} not found in registry`);

  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);

    const startTime = Date.now();
    await client.query('BEGIN');
    try {
      for (const sql of target.sql) {
        await client.query(sql);
      }
      const executionTime = Date.now() - startTime;
      await client.query(
        `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
         VALUES ($1, $2, $3, $4, 'applied', 999, $5, $6, NULL)
         ON CONFLICT (id) DO UPDATE SET status='applied', execution_time_ms=EXCLUDED.execution_time_ms, error_message=NULL, applied_at=NOW()`,
        [target.id, target.description, target.version, target.name, executionTime, target.sql.join(';\n')]
      );
      await client.query('COMMIT');
      return { success: true, message: `Successfully applied ${target.version} (${target.name})`, target, execution_time_ms: executionTime };
    } catch (err) {
      await client.query('ROLLBACK');
      try {
        await client.query(
          `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
           VALUES ($1, $2, $3, $4, 'failed', 999, 0, $5, $6)
           ON CONFLICT (id) DO UPDATE SET status='failed', error_message=EXCLUDED.error_message`,
          [target.id, target.description, target.version, target.name, target.sql.join(';\n'), err.message]
        );
      } catch (_) {}
      throw new Error(`Failed to apply ${target.version}: ${err.message}`);
    }
  } finally {
    client.release();
  }
}

// Migrate SELECTED migrations by array of IDs
async function migrateSelected(ids) {
  const targetIds = Array.isArray(ids) ? ids : [ids];
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);

    const targets = MASTER_MIGRATIONS.filter(m => targetIds.includes(m.id) || targetIds.includes(m.version));
    if (!targets.length) {
      return { success: false, message: 'No valid migrations selected to execute.', results: [] };
    }

    const { rows: appliedRows } = await client.query("SELECT id, batch FROM zkc_pg_migrations WHERE status='applied'");
    let maxBatch = 0;
    appliedRows.forEach(r => { if (r.batch && r.batch > maxBatch) maxBatch = r.batch; });
    const currentBatch = maxBatch + 1;

    const results = [];
    let hasFailure = false;

    for (const m of targets) {
      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        for (const sql of m.sql) {
          await client.query(sql);
        }
        const executionTime = Date.now() - startTime;
        await client.query(
          `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
           VALUES ($1, $2, $3, $4, 'applied', $5, $6, $7, NULL)
           ON CONFLICT (id) DO UPDATE SET status='applied', batch=EXCLUDED.batch, execution_time_ms=EXCLUDED.execution_time_ms, error_message=NULL, applied_at=NOW()`,
          [m.id, m.description, m.version, m.name, currentBatch, executionTime, m.sql.join(';\n')]
        );
        await client.query('COMMIT');
        results.push({ id: m.id, version: m.version, name: m.name, status: 'success', execution_time_ms: executionTime, statements: m.sql.length });
      } catch (err) {
        await client.query('ROLLBACK');
        hasFailure = true;
        try {
          await client.query(
            `INSERT INTO zkc_pg_migrations (id, description, version, migration_name, status, batch, execution_time_ms, sql_preview, error_message)
             VALUES ($1, $2, $3, $4, 'failed', $5, 0, $6, $7)
             ON CONFLICT (id) DO UPDATE SET status='failed', error_message=EXCLUDED.error_message`,
            [m.id, m.description, m.version, m.name, currentBatch, m.sql.join(';\n'), err.message]
          );
        } catch (_) {}
        results.push({ id: m.id, version: m.version, name: m.name, status: 'failed', error: err.message });
        break;
      }
    }

    return {
      success: !hasFailure,
      message: hasFailure ? `Migration batch encountered an error.` : `Successfully executed ${results.length} selected migration(s).`,
      results,
      applied_count: results.filter(r => r.status === 'success').length,
      failed_count: results.filter(r => r.status === 'failed').length
    };
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
  migrateSelected
};
