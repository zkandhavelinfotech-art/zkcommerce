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
