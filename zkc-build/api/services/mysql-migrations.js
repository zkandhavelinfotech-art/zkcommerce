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
    description: 'Order updated_at, tracking number and store/date index for the order dashboard',
    steps: [
      { addColumn: { table: 'orders', column: 'updated_at', definition: 'DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP' } },
      { addColumn: { table: 'orders', column: 'tracking_number', definition: 'VARCHAR(80) DEFAULT NULL' } },
      { addIndex: { table: 'orders', name: 'idx_orders_store_created', columns: '`store_id`, `created_at`' } }
    ]
  },
  {
    id: '004_razorpay_payments',
    description: 'Razorpay order / payment ids on orders for online payment',
    steps: [
      { addColumn: { table: 'orders', column: 'razorpay_order_id', definition: 'VARCHAR(64) DEFAULT NULL' } },
      { addColumn: { table: 'orders', column: 'razorpay_payment_id', definition: 'VARCHAR(64) DEFAULT NULL' } },
      { addIndex: { table: 'orders', name: 'idx_orders_rzp_order', columns: '`razorpay_order_id`' } }
    ]
  },
  {
    id: '005_product_quantity',
    description: 'Stock quantity per product',
    steps: [
      { addColumn: { table: 'products', column: 'quantity', definition: 'INT DEFAULT 100' } }
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

// Migrations newer than `fromId` (all of them when fromId is empty or unknown).
function migrationsAfter(fromId) {
  const idx = MIGRATIONS.findIndex(m => m.id === fromId);
  return idx < 0 ? MIGRATIONS.slice() : MIGRATIONS.slice(idx + 1);
}

module.exports = { MIGRATIONS, SCHEMA_TABLE_SQL, compileStep, guardedSql, migrationsAfter, latestId, sqlString };
