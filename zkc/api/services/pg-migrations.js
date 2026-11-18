// Tracked PostgreSQL migrations for the main ZKCommerce database, run once at server start.
// Each migration runs in a transaction and is recorded in zkc_pg_migrations, so it runs exactly once.
// To change the schema: APPEND an entry (never edit one that has shipped). Keep statements idempotent
// (IF NOT EXISTS) so databases that already got a column from older runtime code are not broken.
const pool = require('../db');

const MIGRATIONS = [
  {
    id: '001_product_content_fields',
    description: 'Product instructions, benefits, note and stock quantity (moved from products.js)',
    sql: [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS user_instructions TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_note TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 100'
    ]
  },
  {
    id: '002_store_settings_columns',
    description: 'Per-store deployment, WhatsApp and inventory settings',
    sql: [
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS deployment_settings JSONB NOT NULL DEFAULT '{}'::jsonb",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_settings JSONB NOT NULL DEFAULT '{}'::jsonb",
      "ALTER TABLE stores ADD COLUMN IF NOT EXISTS inventory_settings JSONB NOT NULL DEFAULT '{}'::jsonb"
    ]
  },
  {
    id: '003_inventory',
    description: 'Net quantity, low-stock threshold, stock movements, order stock flag, WhatsApp outbox',
    sql: [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS net_quantity_value NUMERIC(10,2)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS net_quantity_unit VARCHAR(10)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER',
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
    id: '004_product_display',
    description: 'Per-product offer display override (NULL = follow the store setting)',
    sql: ['ALTER TABLE products ADD COLUMN IF NOT EXISTS show_offer BOOLEAN']
  },
  {
    id: '005_shipping',
    description: 'Ekart shipping settings, tracking link and shipped/delivered times on orders',
    sql: [
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS shipping_settings JSONB',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ',
      'CREATE INDEX IF NOT EXISTS idx_orders_store_tracking ON orders(store_id, tracking_number)'
    ]
  },
  {
    id: '006_product_unlisted',
    description: 'Hidden (link-only) products: sold from their own page, left out of listings and search',
    sql: ['ALTER TABLE products ADD COLUMN IF NOT EXISTS unlisted BOOLEAN NOT NULL DEFAULT false']
  },
  {
    id: '007_store_pages_and_categories_meta',
    description: 'Ensures categories have image_url, sort_order and active, and store_pages have status and sort_order (v1.0.7)',
    sql: [
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT',
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0',
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE',
      'ALTER TABLE store_pages ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0',
      "ALTER TABLE store_pages ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'published'"
    ]
  },
  {
    id: '008_product_sku_and_pricing_meta',
    description: 'Adds sku, compare_price, cost_price, and gst_rate columns to products table (v1.0.8)',
    sql: [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_price NUMERIC(12,2)',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2)',
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate VARCHAR(10) DEFAULT '12'"
    ]
  },
  {
    id: '009_order_payment_meta',
    description: 'Adds payment_gateway column to orders table (v1.0.9)',
    sql: [
      "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(40) DEFAULT 'razorpay'"
    ]
  },
  {
    id: '010_store_branding_and_announcements',
    description: 'Store banner and announcement bar settings (v1.0.10)',
    sql: [
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS banner_url TEXT',
      'ALTER TABLE stores ADD COLUMN IF NOT EXISTS announcement_enabled BOOLEAN DEFAULT FALSE'
    ]
  },
  {
    id: '011_packaging_manifests_and_awb',
    description: 'Ekart Logistics AWB and packaging manifests table (v1.0.11)',
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
    id: '012_order_hold_synchronization',
    description: 'Order hold status and Ekart courier pause (v1.0.12)',
    sql: [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT FALSE',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_reason VARCHAR(255)',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_at TIMESTAMPTZ'
    ]
  },
  {
    id: '013_fiscal_year_statutory_invoices',
    description: 'Statutory Indian Fiscal Year sequential invoices SMR/26-27/0001 (v1.0.13)',
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
    id: '014_coupons_and_cart_promo_control',
    description: 'Cart promo code box and discount coupons rules (v1.0.14)',
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
    id: '015_gst_audit_and_eway_bill',
    description: 'Statutory GST Tax Audit & E-Way Bill Advisory (v1.0.26 / v4.10)',
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

let running = null;

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS zkc_pg_migrations (
      id VARCHAR(100) PRIMARY KEY, description TEXT, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const { rows } = await client.query('SELECT id FROM zkc_pg_migrations');
    const done = new Set(rows.map(r => r.id));
    const applied = [];
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query('BEGIN');
      try {
        for (const sql of m.sql) await client.query(sql);
        await client.query('INSERT INTO zkc_pg_migrations (id, description) VALUES ($1, $2)', [m.id, m.description]);
        await client.query('COMMIT');
        applied.push(m.id);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.id} failed: ${e.message}`);
      }
    }
    if (applied.length) console.log('[ZKCommerce] Applied database migrations:', applied.join(', '));
    return applied;
  } finally {
    client.release();
  }
}

// Start once; callers that need the new columns await ready().
function ready() {
  if (!running) running = runMigrations().catch(e => { running = null; throw e; });
  return running;
}

module.exports = { MIGRATIONS, ready };
