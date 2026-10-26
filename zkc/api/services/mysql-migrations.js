// Versioned MySQL schema for PHP / Node.js deployments.
//
// Every database records the migrations it has run in `schema_migrations`, so each one runs exactly once
// whether it is applied through phpMyAdmin (guarded SQL) or migrate.php.
//
// To change the schema: APPEND a new entry. Never edit or reorder an entry that has shipped.
// A step is a SQL string, or a self-checking helper:
//   { addColumn: { table: 'orders', column: 'notes', definition: 'TEXT DEFAULT NULL' } }
//   { addIndex:  { table: 'orders', name: 'idx_orders_phone', columns: '`customer_phone`' } }
// Use the helpers for ALTERs so databases created by older full SQL files (which already have the column) are not broken.

const TABLE_OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const MIGRATIONS = [
  {
    id: '001_core_tables',
    version: '1.0.1',
    description: 'Stores, categories, products, orders and pages',
    steps: [
      `CREATE TABLE IF NOT EXISTS \`stores\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_name\` VARCHAR(150) NOT NULL,
  \`slug\` VARCHAR(100) NOT NULL UNIQUE,
  \`custom_domain\` VARCHAR(150) DEFAULT NULL,
  \`tagline\` VARCHAR(255) DEFAULT NULL,
  \`hero_headline\` VARCHAR(255) DEFAULT NULL,
  \`hero_subtext\` TEXT DEFAULT NULL,
  \`hero_cta_text\` VARCHAR(100) DEFAULT 'Shop now',
  \`primary_colour\` VARCHAR(20) DEFAULT '#ED6375',
  \`bg_colour\` VARCHAR(20) DEFAULT '#FFFFFF',
  \`accent_colour\` VARCHAR(20) DEFAULT '#A3B545',
  \`logo_url\` TEXT DEFAULT NULL,
  \`whatsapp_number\` VARCHAR(30) DEFAULT NULL,
  \`instagram_handle\` VARCHAR(100) DEFAULT NULL,
  \`address\` TEXT DEFAULT NULL,
  \`city\` VARCHAR(100) DEFAULT NULL,
  \`state\` VARCHAR(100) DEFAULT NULL,
  \`theme_config\` LONGTEXT DEFAULT NULL,
  \`status\` VARCHAR(30) DEFAULT 'published',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`categories\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`name\` VARCHAR(120) NOT NULL,
  \`slug\` VARCHAR(120) NOT NULL,
  \`image_url\` TEXT DEFAULT NULL,
  \`sort_order\` INT DEFAULT 0,
  \`active\` BOOLEAN DEFAULT TRUE,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_cat_store\` (\`store_id\`)
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`products\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`category_id\` BIGINT DEFAULT NULL,
  \`name\` VARCHAR(255) NOT NULL,
  \`slug\` VARCHAR(200) DEFAULT NULL,
  \`sku\` VARCHAR(100) DEFAULT NULL,
  \`price\` DECIMAL(12,2) NOT NULL,
  \`compare_price\` DECIMAL(12,2) DEFAULT NULL,
  \`cost_price\` DECIMAL(12,2) DEFAULT NULL,
  \`gst_rate\` VARCHAR(10) DEFAULT '12',
  \`product_size\` VARCHAR(60) DEFAULT NULL,
  \`offer_text\` VARCHAR(120) DEFAULT NULL,
  \`badge_text\` VARCHAR(60) DEFAULT NULL,
  \`description\` TEXT DEFAULT NULL,
  \`ingredients\` TEXT DEFAULT NULL,
  \`user_instructions\` TEXT DEFAULT NULL,
  \`benefits\` TEXT DEFAULT NULL,
  \`additional_note\` VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.',
  \`images\` LONGTEXT DEFAULT NULL,
  \`in_stock\` BOOLEAN DEFAULT TRUE,
  \`active\` BOOLEAN DEFAULT TRUE,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX \`idx_prod_store\` (\`store_id\`),
  INDEX \`idx_prod_cat\` (\`category_id\`)
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`orders\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`order_number\` VARCHAR(50) NOT NULL UNIQUE,
  \`customer_name\` VARCHAR(120) NOT NULL,
  \`customer_phone\` VARCHAR(30) NOT NULL,
  \`customer_email\` VARCHAR(120) DEFAULT NULL,
  \`shipping_address\` TEXT NOT NULL,
  \`city\` VARCHAR(100) DEFAULT NULL,
  \`state\` VARCHAR(100) DEFAULT NULL,
  \`pincode\` VARCHAR(20) DEFAULT NULL,
  \`items_json\` LONGTEXT NOT NULL,
  \`total_amount\` DECIMAL(12,2) NOT NULL,
  \`payment_method\` VARCHAR(30) DEFAULT 'cod',
  \`payment_status\` VARCHAR(30) DEFAULT 'pending',
  \`order_status\` VARCHAR(30) DEFAULT 'new',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`store_pages\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`title\` VARCHAR(150) NOT NULL,
  \`slug\` VARCHAR(150) NOT NULL,
  \`content\` LONGTEXT DEFAULT NULL,
  \`status\` VARCHAR(30) DEFAULT 'published',
  \`sort_order\` INT DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ${TABLE_OPTS}`
    ]
  },
  {
    id: '002_inquiries',
    version: '1.0.2',
    description: 'Contact form and restock requests',
    steps: [
      `CREATE TABLE IF NOT EXISTS \`inquiries\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`kind\` VARCHAR(30) NOT NULL DEFAULT 'contact',
  \`name\` VARCHAR(120) DEFAULT NULL,
  \`email\` VARCHAR(120) DEFAULT NULL,
  \`phone\` VARCHAR(30) DEFAULT NULL,
  \`message\` TEXT DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ${TABLE_OPTS}`
    ]
  },
  {
    id: '003_order_tracking',
    version: '1.0.3',
    description: 'Order updated_at, tracking number and store/date index for the order dashboard',
    steps: [
      { addColumn: { table: 'orders', column: 'updated_at', definition: 'DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP' } },
      { addColumn: { table: 'orders', column: 'tracking_number', definition: 'VARCHAR(80) DEFAULT NULL' } },
      { addIndex: { table: 'orders', name: 'idx_orders_store_created', columns: '`store_id`, `created_at`' } }
    ]
  },
  {
    id: '004_razorpay_payments',
    version: '1.0.4',
    description: 'Razorpay order / payment ids on orders for online payment',
    steps: [
      { addColumn: { table: 'orders', column: 'razorpay_order_id', definition: 'VARCHAR(64) DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'razorpay_payment_id', definition: 'VARCHAR(64) DEFAULT NULL' } },
      { addIndex: { table: 'orders', name: 'idx_orders_rzp_order', columns: '`razorpay_order_id`' } }
    ]
  },
  {
    id: '005_product_quantity',
    version: '1.0.5',
    description: 'Stock quantity per product',
    steps: [
      { addColumn: { table: 'products', column: 'quantity', definition: 'INT DEFAULT 100' } }
    ]
  },
  {
    id: '006_commerce',
    version: '1.0.6',
    description: 'Sizes and stock, coupons, shipping rates, GST totals, invoices, Ekart tracking and WhatsApp log',
    steps: [
      { addColumn: { table: 'products', column: 'variants', definition: 'LONGTEXT DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'net_quantity_value', definition: 'DECIMAL(10,2) DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'net_quantity_unit', definition: 'VARCHAR(10) DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'low_stock_threshold', definition: 'INT DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'show_offer', definition: 'TINYINT(1) DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'subtotal', definition: 'DECIMAL(12,2) DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'discount_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' } },
      { addColumn: { table: 'orders', column: 'gst_rate', definition: 'DECIMAL(5,2) NOT NULL DEFAULT 0' } },
      { addColumn: { table: 'orders', column: 'gst_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' } },
      { addColumn: { table: 'orders', column: 'shipping_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0' } },
      { addColumn: { table: 'orders', column: 'shipping_rate_id', definition: 'BIGINT DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'coupon_code', definition: 'VARCHAR(40) DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'stock_deducted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' } },
      { addColumn: { table: 'orders', column: 'paid_at', definition: 'DATETIME DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'courier', definition: 'VARCHAR(40) DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'tracking_url', definition: 'TEXT DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'shipped_at', definition: 'DATETIME DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'delivered_at', definition: 'DATETIME DEFAULT NULL' } },
      { addIndex: { table: 'orders', name: 'idx_orders_tracking', columns: '`store_id`, `tracking_number`' } },
      { addIndex: { table: 'orders', name: 'idx_orders_phone', columns: '`store_id`, `customer_phone`' } },
      `CREATE TABLE IF NOT EXISTS \`product_stock\` (
  \`store_id\` BIGINT NOT NULL,
  \`product_id\` BIGINT NOT NULL,
  \`variant_id\` VARCHAR(40) NOT NULL DEFAULT '',
  \`quantity\` INT NOT NULL DEFAULT 0,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`product_id\`, \`variant_id\`)
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`inventory_movements\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`product_id\` BIGINT NOT NULL,
  \`variant_id\` VARCHAR(40) NOT NULL DEFAULT '',
  \`delta\` INT NOT NULL,
  \`quantity_after\` INT NOT NULL,
  \`reason\` VARCHAR(20) NOT NULL,
  \`order_id\` BIGINT DEFAULT NULL,
  \`note\` VARCHAR(200) DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_mov_product\` (\`product_id\`, \`created_at\`)
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`coupons\` (
  \`id\` BIGINT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`code\` VARCHAR(40) NOT NULL,
  \`discount_type\` VARCHAR(10) NOT NULL,
  \`discount_value\` DECIMAL(10,2) NOT NULL,
  \`minimum_order\` INT NOT NULL DEFAULT 0,
  \`usage_limit\` INT DEFAULT NULL,
  \`used_count\` INT NOT NULL DEFAULT 0,
  \`starts_at\` DATETIME DEFAULT NULL,
  \`expires_at\` DATETIME DEFAULT NULL,
  \`active\` TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY \`uq_coupon_code\` (\`store_id\`, \`code\`)
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`shipping_rates\` (
  \`id\` BIGINT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`name\` VARCHAR(120) NOT NULL,
  \`rate\` INT NOT NULL DEFAULT 0,
  \`free_above\` INT DEFAULT NULL,
  \`postal_prefix\` VARCHAR(12) DEFAULT NULL,
  \`estimated_days\` VARCHAR(60) DEFAULT NULL,
  \`courier\` VARCHAR(60) DEFAULT NULL,
  \`active\` TINYINT(1) NOT NULL DEFAULT 1,
  INDEX \`idx_rates_store\` (\`store_id\`)
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`invoices\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`order_id\` BIGINT NOT NULL UNIQUE,
  \`invoice_number\` VARCHAR(50) NOT NULL UNIQUE,
  \`issued_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ${TABLE_OPTS}`,
      `CREATE TABLE IF NOT EXISTS \`whatsapp_outbox\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`kind\` VARCHAR(30) NOT NULL,
  \`to_phone\` VARCHAR(20) NOT NULL,
  \`message\` TEXT NOT NULL,
  \`provider\` VARCHAR(20) DEFAULT NULL,
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'pending',
  \`error\` TEXT DEFAULT NULL,
  \`order_id\` BIGINT DEFAULT NULL,
  \`product_id\` BIGINT DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`sent_at\` DATETIME DEFAULT NULL,
  INDEX \`idx_outbox_store\` (\`store_id\`, \`status\`, \`created_at\`)
) ${TABLE_OPTS}`
      // Older orders keep stock_deducted = 0: they predate stock tracking, so cancelling them puts nothing back.
    ]
  },
  {
    id: '007_store_pages_and_categories_meta',
    version: '1.0.7',
    description: 'Categories image, sort order and active status, and store pages sort order and status (v1.0.7)',
    steps: [
      { addColumn: { table: 'categories', column: 'image_url', definition: 'TEXT DEFAULT NULL' } },
      { addColumn: { table: 'categories', column: 'sort_order', definition: 'INT DEFAULT 0' } },
      { addColumn: { table: 'categories', column: 'active', definition: 'TINYINT(1) DEFAULT 1' } },
      { addColumn: { table: 'store_pages', column: 'sort_order', definition: 'INT DEFAULT 0' } },
      { addColumn: { table: 'store_pages', column: 'status', definition: "VARCHAR(30) DEFAULT 'published'" } }
    ]
  },
  {
    id: '008_product_sku_and_pricing_meta',
    version: '1.0.8',
    description: 'Product SKU, compare price, cost tracking and GST rate (v1.0.8)',
    steps: [
      { addColumn: { table: 'products', column: 'sku', definition: 'VARCHAR(100) DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'compare_price', definition: 'DECIMAL(12,2) DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'cost_price', definition: 'DECIMAL(12,2) DEFAULT NULL' } },
      { addColumn: { table: 'products', column: 'gst_rate', definition: "VARCHAR(10) DEFAULT '12'" } }
    ]
  }
];

const SCHEMA_TABLE_SQL = `CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
  \`id\` VARCHAR(100) NOT NULL PRIMARY KEY,
  \`description\` VARCHAR(255) DEFAULT NULL,
  \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ${TABLE_OPTS}`;

const sqlString = val => val == null ? 'NULL'
  : "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
const ident = name => {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid SQL identifier: ' + name);
  return '`' + name + '`';
};

// Normalise a step to { sql, check } where check (optional) says what must NOT exist yet.
function compileStep(step) {
  if (typeof step === 'string') return { sql: step };
  if (step.addColumn) {
    const { table, column, definition } = step.addColumn;
    return { sql: `ALTER TABLE ${ident(table)} ADD COLUMN ${ident(column)} ${definition}`, check: { kind: 'column', table, name: column } };
  }
  if (step.addIndex) {
    const { table, name, columns } = step.addIndex;
    return { sql: `ALTER TABLE ${ident(table)} ADD INDEX ${ident(name)} (${columns})`, check: { kind: 'index', table, name } };
  }
  throw new Error('Unknown migration step: ' + JSON.stringify(step));
}

function checkCondition(check) {
  if (!check) return '';
  const source = check.kind === 'column'
    ? `information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${sqlString(check.table)} AND COLUMN_NAME = ${sqlString(check.name)}`
    : `information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${sqlString(check.table)} AND INDEX_NAME = ${sqlString(check.name)}`;
  return ` AND (SELECT COUNT(*) FROM ${source}) = 0`;
}

// Plain SQL (phpMyAdmin / mysql CLI) that skips anything already applied, so the file is safe to import twice.
function guardedSql(migrations) {
  let sql = `-- Migration ledger\n${SCHEMA_TABLE_SQL};\n`;
  for (const m of migrations) {
    sql += `\n-- ── ${m.id}: ${m.description}\nSET @zkc_pending = (SELECT COUNT(*) = 0 FROM \`schema_migrations\` WHERE \`id\` = ${sqlString(m.id)});\n`;
    for (const step of m.steps.map(compileStep)) {
      sql += `SET @zkc_sql = IF(@zkc_pending${checkCondition(step.check)}, ${sqlString(step.sql)}, 'DO 0');\nPREPARE zkc_stmt FROM @zkc_sql; EXECUTE zkc_stmt; DEALLOCATE PREPARE zkc_stmt;\n`;
    }
    sql += `INSERT IGNORE INTO \`schema_migrations\` (\`id\`, \`description\`) VALUES (${sqlString(m.id)}, ${sqlString(m.description)});\n`;
  }
  return sql;
}

const latestId = () => MIGRATIONS[MIGRATIONS.length - 1].id;
const latestVersion = () => MIGRATIONS[MIGRATIONS.length - 1].version || '1.0.8';

// Migrations newer than `fromId` (all of them when fromId is empty or unknown).
function migrationsAfter(fromId) {
  const idx = MIGRATIONS.findIndex(m => m.id === fromId);
  return idx < 0 ? MIGRATIONS.slice() : MIGRATIONS.slice(idx + 1);
}

module.exports = { MIGRATIONS, SCHEMA_TABLE_SQL, compileStep, guardedSql, migrationsAfter, latestId, latestVersion, sqlString };
