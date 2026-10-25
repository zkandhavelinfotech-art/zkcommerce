const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { renderStore } = require('../store-renderer');
const migrationsLib = require('./mysql-migrations');
const { checkoutSettings } = require('./checkout-settings');
const orderMessages = require('./order-messages');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEPLOY_ROOT = path.join(REPO_ROOT, 'deployment');
const ENV_SUFFIX = { development: '-dev', stage: '-stage', preview: '-preview', production: '' };

function safeSlug(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
}

function escapeSqlString(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
}

const productQuantity = p => (p.quantity !== undefined && p.quantity !== null ? Number(p.quantity) : (p.stock !== undefined && p.stock !== null ? Number(p.stock) : 100)) || 0;

// Catalog data as idempotent upserts. Re-running refreshes rows; products no longer in the
// catalog are deactivated (not deleted) so old orders keep their references.
function mysqlSeedStatements(store, categories = [], products = [], pages = []) {
  const sid = Number(store.id);
  const out = [];
  out.push(`INSERT INTO \`stores\` (\`id\`, \`store_name\`, \`slug\`, \`custom_domain\`, \`tagline\`, \`hero_headline\`, \`hero_subtext\`, \`hero_cta_text\`, \`primary_colour\`, \`bg_colour\`, \`accent_colour\`, \`logo_url\`, \`whatsapp_number\`, \`instagram_handle\`, \`address\`, \`city\`, \`state\`, \`theme_config\`, \`status\`)
VALUES (${sid}, ${escapeSqlString(store.store_name)}, ${escapeSqlString(store.slug)}, ${escapeSqlString(store.custom_domain)}, ${escapeSqlString(store.tagline)}, ${escapeSqlString(store.hero_headline)}, ${escapeSqlString(store.hero_subtext)}, ${escapeSqlString(store.hero_cta_text)}, ${escapeSqlString(store.primary_colour)}, ${escapeSqlString(store.bg_colour)}, ${escapeSqlString(store.accent_colour)}, ${escapeSqlString(store.logo_url)}, ${escapeSqlString(store.whatsapp_number)}, ${escapeSqlString(store.instagram_handle)}, ${escapeSqlString(store.address)}, ${escapeSqlString(store.city)}, ${escapeSqlString(store.state)}, ${escapeSqlString(JSON.stringify(store.theme_config || {}))}, 'published')
ON DUPLICATE KEY UPDATE \`store_name\`=VALUES(\`store_name\`), \`custom_domain\`=VALUES(\`custom_domain\`), \`tagline\`=VALUES(\`tagline\`), \`hero_headline\`=VALUES(\`hero_headline\`), \`hero_subtext\`=VALUES(\`hero_subtext\`), \`hero_cta_text\`=VALUES(\`hero_cta_text\`), \`primary_colour\`=VALUES(\`primary_colour\`), \`bg_colour\`=VALUES(\`bg_colour\`), \`accent_colour\`=VALUES(\`accent_colour\`), \`logo_url\`=VALUES(\`logo_url\`), \`whatsapp_number\`=VALUES(\`whatsapp_number\`), \`instagram_handle\`=VALUES(\`instagram_handle\`), \`address\`=VALUES(\`address\`), \`city\`=VALUES(\`city\`), \`state\`=VALUES(\`state\`), \`theme_config\`=VALUES(\`theme_config\`)`);

  for (const c of categories) {
    out.push(`INSERT INTO \`categories\` (\`id\`, \`store_id\`, \`name\`, \`slug\`, \`image_url\`, \`sort_order\`, \`active\`)
VALUES (${Number(c.id)}, ${sid}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.slug)}, ${escapeSqlString(c.image_url)}, ${Number(c.sort_order || 0)}, ${c.active !== false ? 1 : 0})
ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`slug\`=VALUES(\`slug\`), \`image_url\`=VALUES(\`image_url\`), \`sort_order\`=VALUES(\`sort_order\`), \`active\`=VALUES(\`active\`)`);
  }

  for (const p of products) {
    const imgJson = Array.isArray(p.images) ? JSON.stringify(p.images) : (p.images ? JSON.stringify([p.images]) : '[]');
    out.push(`INSERT INTO \`products\` (\`id\`, \`store_id\`, \`category_id\`, \`name\`, \`slug\`, \`sku\`, \`price\`, \`compare_price\`, \`product_size\`, \`offer_text\`, \`badge_text\`, \`description\`, \`ingredients\`, \`user_instructions\`, \`benefits\`, \`additional_note\`, \`images\`, \`quantity\`, \`in_stock\`, \`active\`)
VALUES (${Number(p.id)}, ${sid}, ${p.category_id ? Number(p.category_id) : 'NULL'}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.slug)}, ${escapeSqlString(p.sku)}, ${Number(p.price || 0)}, ${p.compare_price ? Number(p.compare_price) : 'NULL'}, ${escapeSqlString(p.product_size || p.size)}, ${escapeSqlString(p.offer_text || p.offer)}, ${escapeSqlString(p.badge_text)}, ${escapeSqlString(p.description)}, ${escapeSqlString(p.ingredients)}, ${escapeSqlString(p.user_instructions)}, ${escapeSqlString(p.benefits)}, ${escapeSqlString(p.additional_note || 'Inclusive of GST and free shipping.')}, ${escapeSqlString(imgJson)}, ${productQuantity(p)}, ${p.in_stock !== false ? 1 : 0}, ${p.active !== false ? 1 : 0})
ON DUPLICATE KEY UPDATE \`category_id\`=VALUES(\`category_id\`), \`name\`=VALUES(\`name\`), \`slug\`=VALUES(\`slug\`), \`sku\`=VALUES(\`sku\`), \`price\`=VALUES(\`price\`), \`compare_price\`=VALUES(\`compare_price\`), \`product_size\`=VALUES(\`product_size\`), \`offer_text\`=VALUES(\`offer_text\`), \`badge_text\`=VALUES(\`badge_text\`), \`description\`=VALUES(\`description\`), \`ingredients\`=VALUES(\`ingredients\`), \`user_instructions\`=VALUES(\`user_instructions\`), \`benefits\`=VALUES(\`benefits\`), \`additional_note\`=VALUES(\`additional_note\`), \`images\`=VALUES(\`images\`), \`quantity\`=VALUES(\`quantity\`), \`in_stock\`=VALUES(\`in_stock\`), \`active\`=VALUES(\`active\`)`);
  }
  const productIds = products.map(p => Number(p.id)).filter(Boolean);
  out.push(`UPDATE \`products\` SET \`active\` = 0 WHERE \`store_id\` = ${sid}${productIds.length ? ` AND \`id\` NOT IN (${productIds.join(', ')})` : ''}`);

  for (const page of pages) {
    const contentJson = typeof page.content === 'object' ? JSON.stringify(page.content) : String(page.content || '');
    out.push(`INSERT INTO \`store_pages\` (\`id\`, \`store_id\`, \`title\`, \`slug\`, \`content\`, \`status\`, \`sort_order\`)
VALUES (${Number(page.id)}, ${sid}, ${escapeSqlString(page.title)}, ${escapeSqlString(page.slug)}, ${escapeSqlString(contentJson)}, ${escapeSqlString(page.status || 'published')}, ${Number(page.sort_order || 0)})
ON DUPLICATE KEY UPDATE \`title\`=VALUES(\`title\`), \`slug\`=VALUES(\`slug\`), \`content\`=VALUES(\`content\`), \`status\`=VALUES(\`status\`), \`sort_order\`=VALUES(\`sort_order\`)`);
  }
  const pageIds = pages.map(p => Number(p.id)).filter(Boolean);
  out.push(`UPDATE \`store_pages\` SET \`status\` = 'draft' WHERE \`store_id\` = ${sid}${pageIds.length ? ` AND \`id\` NOT IN (${pageIds.join(', ')})` : ''}`);
  return out;
}

function packageMarkerSql(version, env) {
  return `INSERT INTO \`schema_migrations\` (\`id\`, \`description\`) VALUES (${escapeSqlString('package-v' + version)}, ${escapeSqlString(`ZKCommerce package v${version} (${env})`)}) ON DUPLICATE KEY UPDATE \`applied_at\` = NOW()`;
}

/**
 * Full install / upgrade script: every migration (each skipped when already applied) + catalog seed.
 * Safe on an empty database and on one created by any earlier version.
 */
function generateMySqlSeed(store, categories = [], products = [], pages = [], { version = '', env = 'production' } = {}) {
  return `-- ============================================================
-- ${store.store_name} — MySQL install / upgrade${version ? ` (package v${version}, ${env})` : ''}
-- Target: GoDaddy / cPanel / MariaDB / MySQL 5.7+ / 8.0+
-- Generated: ${new Date().toISOString()}
-- Schema: ${migrationsLib.MIGRATIONS.length} migrations, latest ${migrationsLib.latestId()}
--
-- Safe to import into an EXISTING database: each migration is recorded in
-- \`schema_migrations\` and skipped when already applied. Catalog rows are upserted.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

${migrationsLib.guardedSql(migrationsLib.MIGRATIONS)}
-- ── Catalog data (${products.length} products, ${categories.length} categories, ${pages.length} pages)
${mysqlSeedStatements(store, categories, products, pages).join(';\n\n')};
${version ? `\n${packageMarkerSql(version, env)};\n` : ''}
SET FOREIGN_KEY_CHECKS = 1;
`;
}

/** Only the schema changes after `fromSchema` (+ optional catalog refresh), for an existing database. */
function generateMySqlMigration(store, { fromVersion, fromSchema, toVersion, env, includeSeed, categories = [], products = [], pages = [] }) {
  const pending = migrationsLib.migrationsAfter(fromSchema);
  return {
    pending,
    sql: `-- ============================================================
-- ${store.store_name} — MySQL migration ${fromVersion ? 'v' + fromVersion : 'fresh database'} → v${toVersion} (${env})
-- Generated: ${new Date().toISOString()}
-- Schema changes: ${pending.length ? pending.map(m => m.id).join(', ') : 'none'}
-- Catalog refresh: ${includeSeed ? 'yes' : 'no'}
--
-- Import with phpMyAdmin → Import, or: mysql -u USER -p DBNAME < this-file.sql
-- Safe to re-run: already-applied migrations are skipped (see table \`schema_migrations\`).
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

${pending.length ? migrationsLib.guardedSql(pending) : `${migrationsLib.SCHEMA_TABLE_SQL};\n-- No schema changes since ${fromVersion ? 'v' + fromVersion : 'the start'}.\n`}
${includeSeed ? `-- ── Catalog data (${products.length} products, ${categories.length} categories, ${pages.length} pages)\n${mysqlSeedStatements(store, categories, products, pages).join(';\n\n')};\n` : ''}
${packageMarkerSql(toVersion, env)};

SET FOREIGN_KEY_CHECKS = 1;
`
  };
}

function generatePostgresSeed(store, categories, products, pages) {
  return `-- ============================================================
-- ${store.store_name} — PostgreSQL Schema & Seed Data
-- Target: Railway / Neon / Supabase / AWS RDS
-- Generated: ${new Date().toISOString()}
-- ============================================================

CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  store_name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  custom_domain VARCHAR(150),
  tagline VARCHAR(255),
  hero_headline VARCHAR(255),
  hero_subtext TEXT,
  hero_cta_text VARCHAR(100) DEFAULT 'Shop now',
  primary_colour VARCHAR(20) DEFAULT '#ED6375',
  bg_colour VARCHAR(20) DEFAULT '#FFFFFF',
  accent_colour VARCHAR(20) DEFAULT '#A3B545',
  logo_url TEXT,
  whatsapp_number VARCHAR(30),
  instagram_handle VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  theme_config JSONB DEFAULT '{}',
  published_snapshot JSONB DEFAULT NULL,
  status VARCHAR(30) DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(200),
  sku VARCHAR(100),
  price NUMERIC(12,2) NOT NULL,
  compare_price NUMERIC(12,2),
  product_size VARCHAR(60),
  offer_text VARCHAR(120),
  badge_text VARCHAR(60),
  description TEXT,
  ingredients TEXT,
  user_instructions TEXT,
  benefits TEXT,
  additional_note VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.',
  images JSONB DEFAULT '[]',
  quantity INT DEFAULT 100,
  in_stock BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  customer_email VARCHAR(120),
  shipping_address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  items_json JSONB NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(30) DEFAULT 'cod',
  payment_status VARCHAR(30) DEFAULT 'pending',
  order_status VARCHAR(30) DEFAULT 'new',
  tracking_number VARCHAR(80),
  razorpay_order_id VARCHAR(64),
  razorpay_payment_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_pages (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  content JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'published',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL DEFAULT 'contact',
  name VARCHAR(120),
  email VARCHAR(120),
  phone VARCHAR(30),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\n`;
}

function generateEnvFile(config) {
  const { provider, dbType, storeSlug, customDomain, dbHost, dbUser, dbPass, dbName, dbPort, env = 'production', razorpay, adminEmail } = config;
  const isMySql = dbType === 'mysql';
  const defaultDbUrl = isMySql
    ? `mysql://${dbUser || 'root'}:${dbPass || ''}@${dbHost || 'localhost'}:${dbPort || 3306}/${dbName || storeSlug}`
    : `postgres://${dbUser || 'postgres'}:${dbPass || 'password'}@${dbHost || 'localhost'}:${dbPort || 5432}/${dbName || storeSlug}?sslmode=require`;

  return `# ============================================================
# ZKCommerce Environment Configuration — ${env.toUpperCase()}
# Target Provider: ${String(provider || 'godaddy').toUpperCase()}
# Database Engine: ${String(dbType || 'mysql').toUpperCase()}
# Store: ${storeSlug}
# Generated: ${new Date().toISOString()}
# ============================================================

NODE_ENV=${env === 'development' ? 'development' : 'production'}
APP_ENV=${env}
PORT=3000

# ── Database Connection ──
DB_TYPE=${isMySql ? 'mysql' : 'postgres'}
DATABASE_URL=${defaultDbUrl}

# ── Store Domain & Routing ──
STORE_SLUG=${storeSlug}
CUSTOM_DOMAIN=${customDomain || ''}
STORE_BASE_DOMAIN=zkcommerce.in

# ── Security & Authentication ──
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
# Sign-in for the bundled Merchant admin (/merchant) and Store Builder (/store-builder). Change the password.
ADMIN_EMAIL=${adminEmail || 'admin@' + (customDomain || storeSlug + '.local')}
ADMIN_PASSWORD=${crypto.randomBytes(9).toString('base64url')}

# ── Payment Gateway (Razorpay) ──
RAZORPAY_MODE=${razorpay ? razorpay.mode : 'live'}
RAZORPAY_KEY_ID=${razorpay ? razorpay.key_id : 'rzp_live_CHANGE_ME'}
RAZORPAY_KEY_SECRET=${razorpay ? razorpay.key_secret : 'CHANGE_ME'}

# ── Notification & Contact ──
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=
`;
}

// Standalone Node.js server for the "nodejs" package: storefront APIs (checkout, Razorpay, contact) plus the
// bundled merchant admin / Store Builder APIs. Merchant routes require the admin sign-in (ADMIN_EMAIL / ADMIN_PASSWORD).
function generateStandaloneServerJs(store, dbType, checkout = checkoutSettings(store.theme_config)) {
  return `/**
 * Standalone Production Server for ${store.store_name}
 * Compatible with GoDaddy (cPanel Node.js Selector / Passenger), Railway, and VPS
 */
'use strict';
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const STORE_ID = ${Number(store.id)};
// Store Builder → Settings → Shopping cart & checkout (baked in at build time).
const CHECKOUT = ${JSON.stringify(checkout)};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static assets, pre-rendered frontend, and client admin
app.use('/assets', express.static(path.join(__dirname, '..', 'static', 'assets')));
app.use('/merchant', express.static(path.join(__dirname, '..', 'static', 'merchant')));
app.use('/store-builder', express.static(path.join(__dirname, '..', 'static', 'store-builder')));
app.use('/auth', express.static(path.join(__dirname, '..', 'static', 'auth')));
app.use(express.static(path.join(__dirname, '..', 'static')));

// Database connection
const db = require('./db');

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', store: '${store.slug}', time: new Date() }));

// ── Merchant sign-in (single admin from .env) ──
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); return next(); }
  catch (_) { return res.status(401).json({ error: 'Please sign in' }); }
}
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const expected = Buffer.from(String(process.env.ADMIN_PASSWORD || '')), given = Buffer.from(String(password || ''));
  const emailOk = String(email || '').trim().toLowerCase() === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET || !emailOk || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: 1, role: 'merchant', store_id: STORE_ID }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, merchant: { email: process.env.ADMIN_EMAIL, store_id: STORE_ID } });
});

// ── STORE & BUILDER APIS (admin) ──
app.get('/api/stores', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]);
    res.json({ stores: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stores/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    res.json({ store: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stores/:id/builder', requireAdmin, async (req, res) => {
  try {
    const [sRes, pRes, cRes, pgRes] = await Promise.all([
      db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]),
      db.query('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 ORDER BY p.id DESC', [STORE_ID]),
      db.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order, name', [STORE_ID]),
      db.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order, id', [STORE_ID])
    ]);
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    res.json({
      store: sRes.rows[0],
      products: pRes.rows,
      categories: cRes.rows,
      pages: pgRes.rows,
      payments: { razorpay_configured: !!(keyId && process.env.RAZORPAY_KEY_SECRET && !/CHANGE_ME/.test(keyId)), razorpay_mode: /^rzp_live_/.test(keyId) ? 'live' : 'test' }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/stores/:id/draft', requireAdmin, async (req, res) => {
  try {
    const { theme_config, store_fields } = req.body;
    const f = store_fields || {};
    const tc = typeof theme_config === 'object' ? JSON.stringify(theme_config) : theme_config;
    await db.query(
      'UPDATE stores SET theme_config=COALESCE($2, theme_config), primary_colour=COALESCE($3, primary_colour), accent_colour=COALESCE($4, accent_colour), hero_cta_text=COALESCE($5, hero_cta_text), tagline=COALESCE($6, tagline), updated_at=NOW() WHERE id=$1',
      [STORE_ID, tc, f.primary_colour, f.accent_colour, f.hero_cta_text, f.tagline]
    );
    const { rows } = await db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]);
    res.json({ store: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PRODUCTS APIS (WITH QUANTITY & STOCK) ──
app.get('/api/products', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 ORDER BY p.id DESC',
      [STORE_ID]
    );
    res.json({ products: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM products WHERE id=$1 AND store_id=$2', [req.params.id, STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { name, price, compare_price, sku, description, ingredients, user_instructions, benefits, additional_note, images, category_id, stock, quantity } = req.body;
    const finalQty = (quantity !== undefined && quantity !== null) ? Number(quantity) : (stock !== undefined ? Number(stock) : 100);
    const inStock = finalQty > 0;
    const imgJson = Array.isArray(images) ? JSON.stringify(images) : (images ? JSON.stringify([images]) : '[]');
    await db.query(
      'INSERT INTO products (store_id, category_id, name, price, compare_price, sku, description, ingredients, user_instructions, benefits, additional_note, images, quantity, in_stock, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)',
      [STORE_ID, category_id || null, name, Number(price || 0), compare_price ? Number(compare_price) : null, sku || null, description || '', ingredients || '', user_instructions || null, benefits || null, additional_note || 'Inclusive of GST and free shipping.', imgJson, finalQty, inStock]
    );
    const { rows } = await db.query('SELECT * FROM products WHERE store_id=$1 ORDER BY id DESC LIMIT 1', [STORE_ID]);
    res.status(201).json({ product: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, price, compare_price, description, user_instructions, benefits, additional_note, category_id, stock, quantity } = req.body;
    const finalQty = quantity !== undefined ? Number(quantity) : (stock !== undefined ? Number(stock) : undefined);
    const inStock = finalQty !== undefined ? (finalQty > 0) : undefined;
    await db.query(
      'UPDATE products SET name=COALESCE($3, name), price=COALESCE($4, price), compare_price=COALESCE($5, compare_price), description=COALESCE($6, description), user_instructions=COALESCE($7, user_instructions), benefits=COALESCE($8, benefits), additional_note=COALESCE($9, additional_note), category_id=COALESCE($10, category_id), quantity=COALESCE($11, quantity), in_stock=COALESCE($12, in_stock), updated_at=NOW() WHERE id=$1 AND store_id=$2',
      [req.params.id, STORE_ID, name, price, compare_price, description, user_instructions, benefits, additional_note, category_id, finalQty, inStock]
    );
    const { rows } = await db.query('SELECT * FROM products WHERE id=$1 AND store_id=$2', [req.params.id, STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CATEGORIES APIS ──
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=true) AS product_count FROM categories c WHERE c.store_id=$1 ORDER BY c.sort_order, c.name',
      [STORE_ID]
    );
    res.json({ categories: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    const { name, slug, image_url, sort_order } = req.body;
    await db.query('INSERT INTO categories (store_id, name, slug, image_url, sort_order, active) VALUES ($1,$2,$3,$4,$5,true)', [STORE_ID, name, slug, image_url || null, sort_order || 0]);
    const { rows } = await db.query('SELECT * FROM categories WHERE store_id=$1 AND slug=$2 ORDER BY id DESC LIMIT 1', [STORE_ID, slug]);
    res.status(201).json({ category: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug, image_url, sort_order } = req.body;
    await db.query('UPDATE categories SET name=COALESCE($3,name), slug=COALESCE($4,slug), image_url=COALESCE($5,image_url), sort_order=COALESCE($6,sort_order) WHERE id=$1 AND store_id=$2', [req.params.id, STORE_ID, name, slug, image_url, sort_order]);
    const { rows } = await db.query('SELECT * FROM categories WHERE id=$1 AND store_id=$2', [req.params.id, STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ category: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PAGES APIS ──
app.get('/api/stores/:id/pages', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order, id', [STORE_ID]);
    res.json({ pages: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stores/:id/pages', requireAdmin, async (req, res) => {
  try {
    const { title, slug, content = {}, status = 'published', sort_order = 0 } = req.body;
    const contentVal = typeof content === 'object' ? JSON.stringify(content) : content;
    await db.query('INSERT INTO store_pages (store_id, title, slug, content, status, sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [STORE_ID, title, slug, contentVal, status, sort_order]);
    const { rows } = await db.query('SELECT * FROM store_pages WHERE store_id=$1 AND slug=$2 ORDER BY id DESC LIMIT 1', [STORE_ID, slug]);
    res.status(201).json({ page: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/stores/:id/pages/:pageId', requireAdmin, async (req, res) => {
  try {
    const { title, slug, content, status, sort_order } = req.body;
    const contentVal = content !== undefined ? (typeof content === 'object' ? JSON.stringify(content) : content) : null;
    await db.query('UPDATE store_pages SET title=COALESCE($3,title), slug=COALESCE($4,slug), content=COALESCE($5,content), status=COALESCE($6,status), sort_order=COALESCE($7,sort_order) WHERE id=$1 AND store_id=$2', [req.params.pageId, STORE_ID, title, slug, contentVal, status, sort_order]);
    const { rows } = await db.query('SELECT * FROM store_pages WHERE id=$1 AND store_id=$2', [req.params.pageId, STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Page not found' });
    res.json({ page: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/stores/:id/pages/:pageId', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM store_pages WHERE id=$1 AND store_id=$2', [req.params.pageId, STORE_ID]);
    res.json({ deleted: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ORDERS (admin) ──
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM orders WHERE store_id=$1 ORDER BY id DESC LIMIT 50', [STORE_ID]);
    res.json({ orders: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Manual order entry from the admin.
app.post('/api/orders', requireAdmin, async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, shipping_address, items, total_amount, payment_method } = req.body;
    const orderNumber = 'ORD-' + Date.now();
    await db.query('INSERT INTO orders (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, items_json, total_amount, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [STORE_ID, orderNumber, customer_name, customer_phone, customer_email || '', shipping_address, JSON.stringify(items || []), total_amount || 0, payment_method || 'cod']);
    res.json({ success: true, order_number: orderNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Storefront API — same routes the pre-rendered pages call (public) ──
app.get('/api/storefront/:slug/shipping-rates', (req, res) => res.json({ rates: [] }));

app.post('/api/storefront/:slug/checkout', async (req, res) => {
  try {
    const { customer = {}, address = {}, items = [], coupon_code } = req.body || {};
    if (!customer.name || !customer.phone || !address.line1) return res.status(400).json({ error: 'Name, phone and delivery address are required.' });
    const payMethod = req.body.payment_method === 'razorpay' ? 'razorpay' : 'cod';
    if (!CHECKOUT[payMethod]) return res.status(400).json({ error: payMethod === 'cod' ? 'Cash on delivery is not available for this store. Please pay online.' : 'Online payment is not available for this store.' });
    if (coupon_code) return res.status(400).json({ error: CHECKOUT.show_coupon ? 'Coupon codes are not available on this site yet.' : 'Discount codes are not available for this store.' });
    const lines = [];
    let total = 0;
    for (const item of items) {
      const qty = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1));
      const { rows } = await db.query('SELECT id, name, price, product_size FROM products WHERE id=$1 AND store_id=$2 AND active=true AND in_stock=true', [Number(item.product_id) || 0, STORE_ID]);
      if (!rows.length) return res.status(400).json({ error: 'A product in your cart is no longer available.' });
      lines.push({ product_id: rows[0].id, name: rows[0].name, size: rows[0].product_size, quantity: qty, price: Number(rows[0].price) });
      total += qty * Number(rows[0].price);
    }
    if (!lines.length) return res.status(400).json({ error: 'Your cart is empty.' });
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
    // COD orders are confirmed now; Razorpay orders stay 'pending' until the payment is verified.
    await db.query('INSERT INTO orders (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, total_amount, payment_method, payment_status, order_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [STORE_ID, orderNumber, customer.name, customer.phone, customer.email || '', address.line1, address.city || '', address.state || '', address.pincode || '', JSON.stringify(lines), total, payMethod, payMethod === 'cod' ? 'cod' : 'unpaid', payMethod === 'cod' ? 'new' : 'pending']);
    const { rows: [created] } = await db.query('SELECT id FROM orders WHERE order_number=$1', [orderNumber]);
    res.json({ order_id: created.id, order_number: orderNumber, total, next: payMethod === 'cod' ? 'confirmed' : 'razorpay_checkout' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notify/:slug/:kind(contact|notify)', async (req, res) => {
  try {
    const b = req.body || {};
    await db.query('INSERT INTO inquiries (store_id, kind, name, email, phone, message) VALUES ($1,$2,$3,$4,$5,$6)', [STORE_ID, req.params.kind, b.name || null, b.email || null, b.phone || null, b.message || b.product_label || null]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupons/validate/:slug', (req, res) => res.status(400).json({ valid: false, error: 'Coupon codes are not available on this site yet.' }));

// ── Razorpay (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env) ──
async function razorpay(method, apiPath, payload) {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw Object.assign(new Error('Online payment is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).'), { status: 503 });
  const r = await fetch('https://api.razorpay.com/v1/' + apiPath, {
    method, body: payload ? JSON.stringify(payload) : undefined,
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64') }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('Razorpay: ' + ((data.error && data.error.description) || 'HTTP ' + r.status)), { status: 502 });
  return data;
}
const paise = amount => Math.round(Number(amount) * 100);
const fail = (res, err) => res.status(err.status || 500).json({ error: err.message });

app.use('/api/payments', (req, res, next) => CHECKOUT.razorpay ? next() : res.status(400).json({ error: 'Online payment is not available for this store.' }));

app.post('/api/payments/razorpay/order', async (req, res) => {
  try {
    const { rows: [order] } = await db.query("SELECT id, order_number, total_amount, payment_status FROM orders WHERE id=$1 AND store_id=$2 AND payment_method='razorpay'", [Number(req.body.order_id) || 0, STORE_ID]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['unpaid', 'failed'].includes(order.payment_status)) return res.status(409).json({ error: 'This payment has already started or finished. Please place the order again.' });
    const rzp = await razorpay('POST', 'orders', { amount: paise(order.total_amount), currency: 'INR', receipt: order.order_number, notes: { order_id: String(order.id) } });
    await db.query("UPDATE orders SET razorpay_order_id=$1, payment_status='processing' WHERE id=$2", [rzp.id, order.id]);
    res.json({ razorpay_order_id: rzp.id, amount: rzp.amount, currency: 'INR', key: process.env.RAZORPAY_KEY_ID });
  } catch (err) { fail(res, err); }
});

app.post('/api/payments/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !process.env.RAZORPAY_KEY_SECRET) return res.status(400).json({ error: 'Payment verification details are incomplete' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
    if (String(razorpay_signature || '').length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)))) return res.status(400).json({ error: 'Invalid payment signature' });
    const { rows: [order] } = await db.query('SELECT id, total_amount, payment_status FROM orders WHERE id=$1 AND store_id=$2 AND razorpay_order_id=$3', [Number(order_id) || 0, STORE_ID, razorpay_order_id]);
    if (!order) return res.status(404).json({ error: 'Pending order not found for this payment' });
    if (order.payment_status === 'paid') return res.json({ message: 'Payment already verified', order_id: order.id });
    const payment = await razorpay('GET', 'payments/' + encodeURIComponent(razorpay_payment_id));
    if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== paise(order.total_amount) || payment.currency !== 'INR') return res.status(400).json({ error: 'Payment does not match the order amount' });
    if (payment.status !== 'captured') return res.status(409).json({ error: 'Payment is not captured yet. Please retry or contact the store.' });
    await db.query("UPDATE orders SET payment_status='paid', order_status='new', razorpay_payment_id=$1 WHERE id=$2", [razorpay_payment_id, order.id]);
    res.json({ message: 'Payment verified', order_id: order.id });
  } catch (err) { fail(res, err); }
});

app.post('/api/payments/razorpay/failure', async (req, res) => {
  try {
    await db.query("UPDATE orders SET payment_status='failed' WHERE id=$1 AND store_id=$2 AND razorpay_order_id=$3 AND payment_status<>'paid'", [Number(req.body.order_id) || 0, STORE_ID, String(req.body.razorpay_order_id || '')]);
    res.json({ recorded: true, retryable: true });
  } catch (err) { fail(res, err); }
});

// Fallback to static index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'static', 'index.html'));
});

app.listen(PORT, () => {
  console.log('✅ ' + ${JSON.stringify(String(store.store_name || 'Store'))} + ' running on port ' + PORT);
  console.log('   🛍️ Storefront:   http://localhost:' + PORT + '/');
  console.log('   💼 Client Admin: http://localhost:' + PORT + '/merchant/  (sign in with ADMIN_EMAIL / ADMIN_PASSWORD from .env)');
  console.log('   🎨 StoreBuilder: http://localhost:' + PORT + '/store-builder/');
});
`;
}

function generatePackageJson(store, dbType) {
  return JSON.stringify({
    name: `${safeSlug(store.slug)}-storefront`,
    version: '1.0.0',
    description: `Production bundle for ${store.store_name}`,
    main: 'server.js',
    scripts: {
      start: 'node server.js'
    },
    engines: { node: '>=18' },
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5',
      helmet: '^7.1.0',
      dotenv: '^16.3.1',
      jsonwebtoken: '^9.0.2',
      ...(dbType === 'mysql' ? { mysql2: '^3.6.5' } : { pg: '^8.11.3' })
    }
  }, null, 2);
}

function generateApacheHtaccess() {
  return `# Apache / cPanel / GoDaddy URL Rewrite & Passenger Node.js Configuration
PassengerAppRoot "/home/username/public_html/api"
PassengerBaseURI "/"
PassengerNodejs "/home/username/nodevenv/api/20/bin/node"
PassengerAppType node
PassengerStartupFile server.js

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Allow direct access to existing files & static assets
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Route API requests to Node.js backend
  RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P,L]

  # Route all other routes to static index.html
  RewriteRule ^(.*)$ /index.html [L]
</IfModule>
`;
}

function generateVercelJson() {
  return JSON.stringify({
    version: 2,
    routes: [
      { src: "/assets/(.*)", dest: "/assets/$1" },
      { src: "/(.*)", dest: "/index.html" }
    ]
  }, null, 2);
}

function generateRailwayConfig() {
  return `[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node api/server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
`;
}

const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const safeDirName = value => /^[a-z0-9._-]+$/i.test(String(value || '')) && !String(value).includes('..');
const phpString = value => "'" + String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

// Every URL the storefront links to, as [output file relative to the site root, render options].
// Pages are written as folder/index.html so /products/x resolves on plain Apache/IIS hosting without rewrites.
function storefrontRoutes(products, categories, pages) {
  const routes = [['index.html', { template: 'home', showContact: true }]];
  const collectionSlugs = new Set();
  for (const c of categories) { const s = c.slug || slugify(c.name); if (safeDirName(s)) collectionSlugs.add(s); }
  for (const p of products) { const s = slugify(p.category_name || p.category); if (safeDirName(s)) collectionSlugs.add(s); }
  for (const s of collectionSlugs) routes.push([`collections/${s}/index.html`, { template: 'collection', collection: s, showContact: true }]);
  for (const p of products) if (safeDirName(p.slug)) routes.push([`products/${p.slug}/index.html`, { template: 'product', product: p, showContact: true }]);
  for (const pg of pages) if (safeDirName(pg.slug)) routes.push([`page/${pg.slug}/index.html`, { template: 'page', page: pg, showContact: false }]);
  return routes;
}

function injectHead(html, snippet) {
  if (!snippet) return html;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + snippet) : snippet + html;
}

// Routes the storefront's fetch('/api/...') calls to api.php?route=... so no URL rewrite module is needed.
// prefix = path from the page back to the site root ("" or "../../"), so a subfolder install works too.
function phpFetchShim(prefix = '') {
  return `<script>(function(){var f=window.fetch;window.fetch=function(u,o){if(typeof u==='string'&&u.indexOf('/api/')===0){var q=u.indexOf('?'),r=q<0?u.slice(5):u.slice(5,q);u=${JSON.stringify(prefix)}+'api.php?route='+encodeURIComponent(r)+(q<0?'':'&'+u.slice(q+1))}return f.call(this,u,o)}})();</script>`;
}

// Static hosting has no backend: checkout and contact forms hand off to WhatsApp instead.
function staticFetchShim(store, products) {
  const catalog = {};
  for (const p of products) catalog[p.id] = { n: p.name, p: Number(p.price) || 0 };
  const wa = String(store.whatsapp_number || '').replace(/\D/g, '');
  return `<script>(function(){var f=window.fetch,C=${JSON.stringify(catalog).replace(/</g, '\\u003c')},W=${JSON.stringify(wa)};function J(b,s){return Promise.resolve(new Response(JSON.stringify(b),{status:s||200,headers:{'Content-Type':'application/json'}}))}window.fetch=function(u,o){if(typeof u!=='string'||u.indexOf('/api/')!==0)return f.call(this,u,o);var b={};try{b=JSON.parse(o&&o.body||'{}')}catch(e){}if(/\\/shipping-rates/.test(u))return J({rates:[]});if(/\\/checkout$/.test(u)){var n='WEB-'+String(Date.now()).slice(-6),t=0,l=(b.items||[]).map(function(i){var p=C[i.product_id]||{n:'Item '+i.product_id,p:0};t+=p.p*i.quantity;return '- '+p.n+' x '+i.quantity});var a=b.address||{},c=b.customer||{};var m='New order '+n+'\\n'+l.join('\\n')+'\\nTotal: Rs.'+t+'\\n\\n'+(c.name||'')+' / '+(c.phone||'')+'\\n'+[a.line1,a.city,a.state,a.pincode].filter(Boolean).join(', ');if(W)window.open('https://wa.me/'+W+'?text='+encodeURIComponent(m),'_blank');return J({order_number:n,next:'confirmed'})}if(/\\/notify\\//.test(u)){if(W)window.open('https://wa.me/'+W+'?text='+encodeURIComponent(Object.keys(b).map(function(k){return k+': '+b[k]}).join('\\n')),'_blank');return J({ok:true})}return J({error:'This feature needs the PHP or Node.js package'},400)}})();</script>`;
}

// Exported sites must work at the domain root AND in a subfolder (e.g. public_html/published/),
// so root-absolute URLs ("/products/x", "/assets/y") become relative to the page's own folder.
const SITE_DIRS = 'assets|products|collections|page';
function relativizeUrls(html, prefix) {
  const dirLink = rest => (/^(products|collections|page)\/[^/?#]+$/.test(rest) ? rest + '/' : rest);
  return html
    // href="/", href="/#products", href="/products/x", src="/assets/..."
    .replace(/(\s(?:href|src|action)=")\/(?!\/)([^"]*)"/g, (m, attr, rest) => attr + (rest === '' ? (prefix || './') : prefix + dirLink(rest)) + '"')
    // CSS url('/assets/...'), url("/assets/..."), url(/assets/...)
    .replace(/url\((['"]?)\/(?!\/)/g, (m, q) => 'url(' + q + prefix)
    // JS / JSON strings, e.g. the quick-view data: "/assets/...", '/products/...'
    .replace(new RegExp(`(["'])\\/(${SITE_DIRS})\\/`, 'g'), (m, q, dir) => q + prefix + dir + '/');
}

function renderSite(snapshot, routes, siteDir, shim) {
  const htmls = [];
  for (const [rel, opts] of routes) {
    const prefix = '../'.repeat(rel.split('/').length - 1);
    const raw = renderStore(snapshot, { ...opts, basePath: '' });
    const pageShim = typeof shim === 'function' ? shim(prefix) : shim;
    const file = path.join(siteDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, relativizeUrls(injectHead(raw, pageShim), prefix), 'utf8');
    htmls.push(raw); // asset scan reads the original /assets/... references
  }
  return htmls;
}

// Copy only the /assets/... files the rendered pages reference, not the whole uploads tree.
function copyReferencedAssets(htmls, siteDir) {
  const refs = new Set();
  for (const html of htmls) for (const m of html.matchAll(/\/assets\/[A-Za-z0-9._\/-]+/g)) refs.add(m[0].replace(/[.]+$/, ''));
  let copied = 0;
  const missing = [];
  for (const ref of refs) {
    if (ref.includes('..')) continue;
    const src = path.join(REPO_ROOT, ref);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) { missing.push(ref); continue; }
    const dest = path.join(siteDir, ref);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
  }
  return { copied, missing };
}

// ZIP with forward-slash entry names (PowerShell 5.1 Compress-Archive writes backslashes, which break on Linux cPanel).
function zipDirectory(srcDir, zipPath) {
  const src = path.resolve(srcDir);
  const dst = path.resolve(zipPath);
  if (process.platform === 'win32') {
    const ps1 = path.join(os.tmpdir(), `zkc-zip-${crypto.randomBytes(4).toString('hex')}.ps1`);
    fs.writeFileSync(ps1, `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$src = $env:ZKC_ZIP_SRC; $dst = $env:ZKC_ZIP_DST
if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
$zip = [System.IO.Compression.ZipFile]::Open($dst, 'Create')
try {
  Get-ChildItem -LiteralPath $src -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\\', '/').Replace('\\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, 'Optimal')
  }
} finally { $zip.Dispose() }
`, 'utf8');
    try {
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], { env: { ...process.env, ZKC_ZIP_SRC: src, ZKC_ZIP_DST: dst }, stdio: 'pipe' });
    } finally { fs.rmSync(ps1, { force: true }); }
  } else {
    fs.rmSync(dst, { force: true });
    execFileSync('zip', ['-qr', dst, '.'], { cwd: src, stdio: 'pipe' });
  }
  return dst;
}

// ── PHP + MySQL (GoDaddy / cPanel / Plesk) bundle ──────────────────────────
function generateStoreConfigPhp(store, env, version, checkout = checkoutSettings(store.theme_config), wa = orderMessages.normalize(null, store)) {
  return `<?php
// ${store.store_name} — store identity and checkout options for api.php and admin-orders.php (${env}, v${version}).
define('STORE_ID', ${Number(store.id)});
define('STORE_SLUG', ${phpString(store.slug)});
define('STORE_NAME', ${phpString(store.store_name)});
define('STORE_ENV', ${phpString(env)});
define('PACKAGE_VERSION', ${phpString(version)});
// "From" address on packaging labels.
define('STORE_ADDRESS', ${phpString(store.address || '')});
define('STORE_CITY', ${phpString(store.city || '')});
define('STORE_STATE', ${phpString(store.state || '')});
define('STORE_PHONE', ${phpString(store.whatsapp_number || '')});
// Set in Store Builder → Settings → Shopping cart & checkout.
define('CHECKOUT_COD', ${checkout.cod ? 'true' : 'false'});
define('CHECKOUT_RAZORPAY', ${checkout.razorpay ? 'true' : 'false'});
define('CHECKOUT_COUPON', ${checkout.show_coupon ? 'true' : 'false'});
// Set in Store Builder → Settings → WhatsApp order messages ({fields} are filled per order).
define('WA_ENABLED', ${wa.enabled ? 'true' : 'false'});
define('WA_HANDOFF', ${wa.customer_handoff ? 'true' : 'false'});
define('WA_CARE_NUMBER', ${phpString(wa.care_number || '')});
define('WA_CARE_LABEL', ${phpString(wa.care_label || '')});
define('WA_CARE_TEMPLATE', ${phpString(wa.care_template || '')});
define('WA_CUSTOMER_TEMPLATE', ${phpString(wa.customer_template || '')});
`;
}

function generatePaymentConfigPhp(store, env, rzp) {
  return `<?php
// ${store.store_name} — Razorpay keys (${env}, ${rzp.mode} mode). Keep this file private; it is blocked from the web.
define('RAZORPAY_KEY_ID', ${phpString(rzp.key_id)});
define('RAZORPAY_KEY_SECRET', ${phpString(rzp.key_secret)});
`;
}

// PHP copies of the order-message fields (api/services/php/whatsapp_orders.php) must cover every JS placeholder.
const PHP_DIR = path.join(__dirname, 'php');
function assertPhpPlaceholdersInSync() {
  const php = fs.readFileSync(path.join(PHP_DIR, 'whatsapp_orders.php'), 'utf8');
  const missing = Object.keys(orderMessages.PLACEHOLDERS).filter(k => !php.includes(`'${k}'`));
  if (missing.length) throw new Error('Add these fields to api/services/php/whatsapp_orders.php zkcOrderFields(): ' + missing.join(', '));
}

// packaging.php = the dashboard's packaging page, behind the admin-orders.php login, talking to api.php.
function generatePackagingPhp() {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'merchant', 'packaging.html'), 'utf8');
  return `<?php
session_start();
require_once __DIR__ . '/store_config.php';
if (($_SESSION['zkc_admin'] ?? null) !== STORE_ID) { header('Location: admin-orders.php?next=packaging'); exit; }
?>
` + html.replace('</head>', '<script>window.ZKC_PACKAGING_PHP = true;</script>\n</head>');
}

function generateDbConfigPhp(store, db, adminKey, env) {
  return `<?php
/**
 * ${store.store_name} — MySQL configuration (${env})
 * Generated by ZKCommerce ${new Date().toISOString()}
 * In GoDaddy cPanel / Plesk: create the database + user, import database/${safeSlug(store.slug)}_mysql.sql, then confirm the values below.
 */

define('DB_HOST', ${phpString(db.host || 'localhost')});
define('DB_PORT', ${Number(db.port) || 3306});
define('DB_NAME', ${phpString(db.name || '')});
define('DB_USER', ${phpString(db.user || '')});
define('DB_PASS', ${phpString(db.password || '')});
define('ADMIN_SECRET_KEY', ${phpString(adminKey)});   // Password for admin-orders.php

function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    try {
        $port = defined('DB_PORT') ? DB_PORT : 3306;
        $dsn = "mysql:host=" . DB_HOST . ";port=" . $port . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        error_log("[DB Error] " . $e->getMessage());
        return null;
    }
}
`;
}

function generateApiPhp() {
  return `<?php
/**
 * Storefront API for PHP + MySQL hosting.
 * The storefront's fetch('/api/...') calls are routed here as api.php?route=... by a small script in each page.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';
if (is_file(__DIR__ . '/payment_config.php')) require_once __DIR__ . '/payment_config.php';
require_once __DIR__ . '/whatsapp_orders.php';
require_once __DIR__ . '/packaging_api.php';
if (!defined('CHECKOUT_COD')) define('CHECKOUT_COD', true);
if (!defined('CHECKOUT_RAZORPAY')) define('CHECKOUT_RAZORPAY', false);
if (!defined('CHECKOUT_COUPON')) define('CHECKOUT_COUPON', false);

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$route  = trim($_GET['route'] ?? '', '/');
$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = $_POST;

$pdo = getDbConnection();
if ($route === 'health') respond(['status' => $pdo ? 'ok' : 'error', 'db' => $pdo ? 'connected' : 'disconnected', 'store' => STORE_SLUG, 'env' => STORE_ENV, 'version' => PACKAGE_VERSION]);
if (!$pdo) respond(['error' => 'The store database is not reachable. Check db_config.php.'], 503);
// Store order times in IST (DATETIME defaults follow the session time zone).
try { $pdo->exec("SET time_zone = '+05:30'"); } catch (Exception $e) { /* keep the server default */ }

// Merchant tools (packaging labels), behind the admin-orders.php login.
if (strpos($route, 'admin/') === 0) zkcHandleAdminRoute($pdo, $route, $method, $body);

if (preg_match('#^storefront/[^/]+/shipping-rates$#', $route)) respond(['rates' => []]);

if (preg_match('#^storefront/[^/]+/checkout$#', $route) && $method === 'POST') {
    $customer = $body['customer'] ?? [];
    $address  = $body['address'] ?? [];
    $name  = trim($customer['name'] ?? '');
    $phone = trim($customer['phone'] ?? '');
    $email = trim($customer['email'] ?? '');
    $line1 = trim($address['line1'] ?? '');
    if ($name === '' || $phone === '' || $line1 === '') respond(['error' => 'Name, phone and delivery address are required.'], 400);
    // Merchant checkout settings (store_config.php) are enforced here, not only in the page.
    $payMethod = ($body['payment_method'] ?? 'cod') === 'razorpay' ? 'razorpay' : 'cod';
    if ($payMethod === 'cod' && !CHECKOUT_COD) respond(['error' => 'Cash on delivery is not available for this store. Please pay online.'], 400);
    if ($payMethod === 'razorpay' && !CHECKOUT_RAZORPAY) respond(['error' => 'Online payment is not available for this store.'], 400);
    if (!empty($body['coupon_code'])) respond(['error' => CHECKOUT_COUPON ? 'Coupon codes are not available on this site yet.' : 'Discount codes are not available for this store.'], 400);

    $items = [];
    $total = 0;
    $find = $pdo->prepare('SELECT id, name, price, product_size FROM products WHERE id = ? AND store_id = ? AND active = 1 AND in_stock = 1');
    foreach (($body['items'] ?? []) as $item) {
        $qty = max(1, min(99, (int)($item['quantity'] ?? 1)));
        $find->execute([(int)($item['product_id'] ?? 0), STORE_ID]);
        $p = $find->fetch();
        if (!$p) respond(['error' => 'A product in your cart is no longer available.'], 400);
        $items[] = ['product_id' => (int)$p['id'], 'name' => $p['name'], 'size' => $p['product_size'], 'quantity' => $qty, 'price' => (float)$p['price']];
        $total += $qty * (float)$p['price'];
    }
    if (!$items) respond(['error' => 'Your cart is empty.'], 400);

    $orderNumber = 'ORD-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    // COD orders are confirmed now; Razorpay orders stay 'pending' until the payment is verified.
    $insert = $pdo->prepare('INSERT INTO orders (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, city, state, pincode, items_json, total_amount, payment_method, payment_status, order_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $insert->execute([STORE_ID, $orderNumber, $name, $phone, $email, $line1, $address['city'] ?? '', $address['state'] ?? '', $address['pincode'] ?? '', json_encode($items, JSON_UNESCAPED_UNICODE), $total, $payMethod, $payMethod === 'cod' ? 'cod' : 'unpaid', $payMethod === 'cod' ? 'new' : 'pending']);
    $orderId = (int)$pdo->lastInsertId();
    // COD is confirmed now, so hand the order to customer care on WhatsApp; Razorpay does this after payment.
    $handoff = $payMethod === 'cod' ? zkcHandoffUrl(['order_number' => $orderNumber, 'customer_name' => $name, 'customer_phone' => $phone, 'customer_email' => $email, 'shipping_address' => $line1, 'city' => $address['city'] ?? '', 'state' => $address['state'] ?? '', 'pincode' => $address['pincode'] ?? '', 'items' => $items, 'total_amount' => $total, 'payment_method' => 'cod', 'payment_status' => 'cod', 'created_at' => date('Y-m-d H:i:s')]) : null;
    respond(['order_id' => $orderId, 'order_number' => $orderNumber, 'total' => $total, 'next' => $payMethod === 'cod' ? 'confirmed' : 'razorpay_checkout', 'whatsapp_handoff_url' => $handoff]);
}

if (preg_match('#^notify/[^/]+/(contact|notify)$#', $route, $m) && $method === 'POST') {
    $insert = $pdo->prepare('INSERT INTO inquiries (store_id, kind, name, email, phone, message) VALUES (?,?,?,?,?,?)');
    $insert->execute([STORE_ID, $m[1], $body['name'] ?? null, $body['email'] ?? null, $body['phone'] ?? null, $body['message'] ?? ($body['product_label'] ?? null)]);
    respond(['ok' => true]);
}

if (preg_match('#^coupons/validate/#', $route)) respond(['valid' => false, 'error' => 'Coupon codes are not available on this site yet.'], 400);

// ── Razorpay ─────────────────────────────────────────────
function razorpayRequest($httpMethod, $path, $payload = null) {
    $id = defined('RAZORPAY_KEY_ID') ? RAZORPAY_KEY_ID : '';
    $secret = defined('RAZORPAY_KEY_SECRET') ? RAZORPAY_KEY_SECRET : '';
    if ($id === '' || $secret === '') respond(['error' => 'Online payment is not configured. Add Razorpay keys to payment_config.php.'], 503);
    if (!function_exists('curl_init')) respond(['error' => 'The PHP curl extension is required for online payment.'], 503);
    $ch = curl_init('https://api.razorpay.com/v1/' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => $id . ':' . $secret, CURLOPT_TIMEOUT => 25, CURLOPT_CUSTOMREQUEST => $httpMethod, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    $data = json_decode((string)$raw, true);
    if ($raw === false || $status >= 400 || !is_array($data)) respond(['error' => 'Razorpay: ' . (($data['error']['description'] ?? '') ?: ($curlError ?: 'request failed (HTTP ' . $status . ')'))], 502);
    return $data;
}
function paise($amount) { return (int)round((float)$amount * 100); }

if (preg_match('#^payments/#', $route) && !CHECKOUT_RAZORPAY) respond(['error' => 'Online payment is not available for this store.'], 400);

if ($route === 'payments/razorpay/order' && $method === 'POST') {
    $stmt = $pdo->prepare("SELECT id, order_number, total_amount, payment_status FROM orders WHERE id = ? AND store_id = ? AND payment_method = 'razorpay'");
    $stmt->execute([(int)($body['order_id'] ?? 0), STORE_ID]);
    $order = $stmt->fetch();
    if (!$order) respond(['error' => 'Order not found'], 404);
    if (!in_array($order['payment_status'], ['unpaid', 'failed'], true)) respond(['error' => 'This payment has already started or finished. Please place the order again.'], 409);
    $rzp = razorpayRequest('POST', 'orders', ['amount' => paise($order['total_amount']), 'currency' => 'INR', 'receipt' => $order['order_number'], 'notes' => ['order_id' => (string)$order['id']]]);
    $pdo->prepare("UPDATE orders SET razorpay_order_id = ?, payment_status = 'processing' WHERE id = ?")->execute([$rzp['id'], $order['id']]);
    respond(['razorpay_order_id' => $rzp['id'], 'amount' => $rzp['amount'], 'currency' => 'INR', 'key' => RAZORPAY_KEY_ID]);
}

if ($route === 'payments/razorpay/verify' && $method === 'POST') {
    $rzpOrderId = (string)($body['razorpay_order_id'] ?? '');
    $paymentId  = (string)($body['razorpay_payment_id'] ?? '');
    $signature  = (string)($body['razorpay_signature'] ?? '');
    if ($rzpOrderId === '' || $paymentId === '' || !defined('RAZORPAY_KEY_SECRET')) respond(['error' => 'Payment verification details are incomplete'], 400);
    if (!hash_equals(hash_hmac('sha256', $rzpOrderId . '|' . $paymentId, RAZORPAY_KEY_SECRET), $signature)) respond(['error' => 'Invalid payment signature'], 400);
    $stmt = $pdo->prepare("SELECT id, total_amount, payment_status FROM orders WHERE id = ? AND store_id = ? AND razorpay_order_id = ?");
    $stmt->execute([(int)($body['order_id'] ?? 0), STORE_ID, $rzpOrderId]);
    $order = $stmt->fetch();
    if (!$order) respond(['error' => 'Pending order not found for this payment'], 404);
    if ($order['payment_status'] === 'paid') respond(['message' => 'Payment already verified', 'order_id' => (int)$order['id']]);
    $payment = razorpayRequest('GET', 'payments/' . rawurlencode($paymentId));
    if (($payment['order_id'] ?? '') !== $rzpOrderId || (int)($payment['amount'] ?? 0) !== paise($order['total_amount']) || ($payment['currency'] ?? '') !== 'INR') respond(['error' => 'Payment does not match the order amount'], 400);
    if (($payment['status'] ?? '') !== 'captured') respond(['error' => 'Payment is not captured yet. Please retry or contact the store.'], 409);
    $pdo->prepare("UPDATE orders SET payment_status = 'paid', order_status = 'new', razorpay_payment_id = ? WHERE id = ?")->execute([$paymentId, $order['id']]);
    $paid = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $paid->execute([$order['id']]);
    respond(['message' => 'Payment verified', 'order_id' => (int)$order['id'], 'whatsapp_handoff_url' => zkcHandoffUrl($paid->fetch() ?: [])]);
}

if ($route === 'payments/razorpay/failure' && $method === 'POST') {
    $pdo->prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND store_id = ? AND razorpay_order_id = ? AND payment_status <> 'paid'")
        ->execute([(int)($body['order_id'] ?? 0), STORE_ID, (string)($body['razorpay_order_id'] ?? '')]);
    respond(['recorded' => true, 'retryable' => true]);
}

respond(['error' => 'Route not found', 'route' => $route], 404);
`;
}

function generateAdminOrdersPhp() {
  return `<?php
/**
 * Merchant order dashboard for PHP + MySQL hosting. Password: ADMIN_SECRET_KEY in db_config.php.
 */
session_start();
require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';

$error = '';
$message = '';
$statuses = ['pending', 'new', 'processing', 'shipped', 'delivered', 'cancelled'];

if (isset($_POST['login_pass'])) {
    if (hash_equals((string)ADMIN_SECRET_KEY, (string)$_POST['login_pass'])) {
        $_SESSION['zkc_admin'] = STORE_ID;
        if (($_GET['next'] ?? '') === 'packaging') { header('Location: packaging.php'); exit; }
    }
    else $error = 'Invalid password.';
}
if (isset($_GET['logout'])) { session_destroy(); header('Location: admin-orders.php'); exit; }

$isLoggedIn = ($_SESSION['zkc_admin'] ?? null) === STORE_ID;
$pdo = getDbConnection();
if ($isLoggedIn && !$pdo) $error = 'Could not connect to MySQL. Check db_config.php.';

if ($isLoggedIn && $pdo && ($_POST['action'] ?? '') === 'update_status' && in_array($_POST['new_status'] ?? '', $statuses, true)) {
    $stmt = $pdo->prepare('UPDATE orders SET order_status = ? WHERE id = ? AND store_id = ?');
    $stmt->execute([$_POST['new_status'], (int)$_POST['order_id'], STORE_ID]);
    $message = 'Order updated to ' . strtoupper($_POST['new_status']);
}

$orders = [];
$revenue = 0;
if ($isLoggedIn && $pdo) {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE store_id = ? ORDER BY id DESC LIMIT 200');
    $stmt->execute([STORE_ID]);
    $orders = $stmt->fetchAll();
    // Revenue counts only money that is in or due: COD orders and paid online orders.
    foreach ($orders as $o) if ($o['order_status'] !== 'cancelled' && in_array($o['payment_status'], ['cod', 'paid', 'pending'], true)) $revenue += (float)$o['total_amount'];
}
function h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h(STORE_NAME) ?> — Orders</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:20px}
.wrap{max-width:1200px;margin:0 auto}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:16px}
.head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}h1{font-size:20px;margin:0}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:top}
th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}.err{color:#b91c1c}.ok{color:#15803d}
input,select,button{font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px}button{background:#0f172a;color:#fff;cursor:pointer}
.scroll{overflow-x:auto}
</style></head><body><div class="wrap">
<?php if (!$isLoggedIn): ?>
  <div class="card" style="max-width:380px;margin:60px auto"><h1><?= h(STORE_NAME) ?> — Orders</h1>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <form method="post"><p><input type="password" name="login_pass" placeholder="Admin password" required style="width:100%"></p><button>Sign in</button></form></div>
<?php else: ?>
  <div class="card head"><h1><?= h(STORE_NAME) ?> — Orders <small style="color:#64748b">(<?= h(STORE_ENV) ?> · v<?= h(PACKAGE_VERSION) ?>)</small></h1>
  <div><?= count($orders) ?> orders · ₹<?= number_format($revenue, 2) ?> · <a href="packaging.php"><b>📦 Packaging labels</b></a> · <a href="?logout=1">Sign out</a></div></div>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <?php if ($message): ?><p class="ok"><?= h($message) ?></p><?php endif; ?>
  <div class="card scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Address</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
  <?php foreach ($orders as $o): $items = json_decode($o['items_json'], true) ?: []; ?>
    <tr><td><strong><?= h($o['order_number']) ?></strong><br><small><?= h($o['created_at']) ?></small></td>
    <td><?= h($o['customer_name']) ?><br><?= h($o['customer_phone']) ?><br><small><?= h($o['customer_email']) ?></small></td>
    <td><?= h($o['shipping_address']) ?><br><?= h(trim($o['city'] . ', ' . $o['state'] . ' ' . $o['pincode'], ', ')) ?></td>
    <td><?php foreach ($items as $i): ?><?= h($i['name'] ?? '') ?> × <?= (int)($i['quantity'] ?? 1) ?><br><?php endforeach; ?></td>
    <td>₹<?= number_format((float)$o['total_amount'], 2) ?></td>
    <td><?= h(strtoupper($o['payment_method'])) ?><br><small class="<?= $o['payment_status'] === 'paid' ? 'ok' : ($o['payment_status'] === 'failed' ? 'err' : '') ?>"><?= h($o['payment_status']) ?></small></td>
    <td><form method="post"><input type="hidden" name="action" value="update_status"><input type="hidden" name="order_id" value="<?= (int)$o['id'] ?>">
    <select name="new_status" onchange="this.form.submit()"><?php foreach ($statuses as $s): ?><option value="<?= $s ?>" <?= $o['order_status'] === $s ? 'selected' : '' ?>><?= ucfirst($s) ?></option><?php endforeach; ?></select></form></td></tr>
  <?php endforeach; ?>
  <?php if (!$orders): ?><tr><td colspan="7">No orders yet.</td></tr><?php endif; ?>
  </tbody></table></div>
<?php endif; ?>
</div></body></html>
`;
}

/**
 * Browser-run migration tool: applies pending schema migrations (and optionally the catalog seed)
 * against the live MySQL database, using the same ledger as the SQL files.
 */
function generateMigratePhp(seedStatements, version, env) {
  const plan = {
    version, env,
    migrations: migrationsLib.MIGRATIONS.map(m => ({ id: m.id, description: m.description, steps: m.steps.map(migrationsLib.compileStep) })),
    seed: seedStatements
  };
  return `<?php
/**
 * Database migration tool — open /migrate.php, sign in with ADMIN_SECRET_KEY (db_config.php).
 * Applies only migrations not yet recorded in \`schema_migrations\`. Package v${version} (${env}).
 */
session_start();
require_once __DIR__ . '/store_config.php';
require_once __DIR__ . '/db_config.php';

$planJson = <<<'ZKCPLAN'
${JSON.stringify(plan)}
ZKCPLAN;
$plan = json_decode($planJson, true);

function h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

$error = '';
$log = [];
if (isset($_POST['login_pass'])) {
    if (hash_equals((string)ADMIN_SECRET_KEY, (string)$_POST['login_pass'])) $_SESSION['zkc_admin'] = STORE_ID;
    else $error = 'Invalid password.';
}
$isLoggedIn = ($_SESSION['zkc_admin'] ?? null) === STORE_ID;
$pdo = $isLoggedIn ? getDbConnection() : null;
if ($isLoggedIn && !$pdo) $error = 'Could not connect to MySQL. Check db_config.php.';

function stepAlreadyDone($pdo, $check) {
    if (!$check) return false;
    $sql = $check['kind'] === 'column'
        ? 'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        : 'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$check['table'], $check['name']]);
    return (int)$stmt->fetchColumn() > 0;
}

$applied = [];
if ($pdo) {
    $pdo->exec(${phpString(migrationsLib.SCHEMA_TABLE_SQL)});
    if (($_POST['action'] ?? '') === 'migrate') {
        foreach ($plan['migrations'] as $m) {
            $done = $pdo->prepare('SELECT COUNT(*) FROM schema_migrations WHERE id = ?');
            $done->execute([$m['id']]);
            if ((int)$done->fetchColumn() > 0) continue;
            try {
                foreach ($m['steps'] as $step) {
                    if (stepAlreadyDone($pdo, $step['check'] ?? null)) continue;
                    $pdo->exec($step['sql']);
                }
                $pdo->prepare('INSERT INTO schema_migrations (id, description) VALUES (?, ?)')->execute([$m['id'], $m['description']]);
                $log[] = 'Applied ' . $m['id'];
            } catch (PDOException $e) {
                $error = 'Migration ' . $m['id'] . ' failed: ' . $e->getMessage();
                break;
            }
        }
        if (!$error && !empty($_POST['seed'])) {
            try {
                $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
                foreach ($plan['seed'] as $sql) $pdo->exec($sql);
                $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
                $log[] = 'Catalog data refreshed (' . count($plan['seed']) . ' statements)';
            } catch (PDOException $e) { $error = 'Catalog refresh failed: ' . $e->getMessage(); }
        }
        if (!$error) {
            $pdo->prepare('INSERT INTO schema_migrations (id, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE applied_at = NOW()')
                ->execute(['package-v' . $plan['version'], 'ZKCommerce package v' . $plan['version'] . ' (' . $plan['env'] . ')']);
            if (!$log) $log[] = 'Database is already up to date.';
        }
    }
    foreach ($pdo->query('SELECT id, applied_at FROM schema_migrations ORDER BY applied_at, id') as $row) $applied[$row['id']] = $row['applied_at'];
}
$pending = array_values(array_filter($plan['migrations'], function ($m) use ($applied) { return !isset($applied[$m['id']]); }));
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h(STORE_NAME) ?> — Database migration</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:20px}
.wrap{max-width:860px;margin:0 auto}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:16px}
h1{font-size:20px;margin:0 0 6px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:8px;border-bottom:1px solid #f1f5f9;text-align:left}
.err{color:#b91c1c}.ok{color:#15803d}.pending{color:#b45309;font-weight:700}input,button{font:inherit;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px}button{background:#0f172a;color:#fff;cursor:pointer}
</style></head><body><div class="wrap">
<?php if (!$isLoggedIn): ?>
  <div class="card" style="max-width:380px;margin:60px auto"><h1>Database migration</h1>
  <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
  <form method="post"><p><input type="password" name="login_pass" placeholder="Admin password" required style="width:100%"></p><button>Sign in</button></form></div>
<?php else: ?>
  <div class="card"><h1><?= h(STORE_NAME) ?> — Database migration</h1>
  <div>Package <strong>v<?= h($plan['version']) ?></strong> (<?= h($plan['env']) ?>) · database <strong><?= h(DB_NAME) ?></strong> · <?= count($pending) ?> pending</div></div>
  <?php if ($error): ?><p class="err card"><?= h($error) ?></p><?php endif; ?>
  <?php foreach ($log as $line): ?><p class="ok"><?= h($line) ?></p><?php endforeach; ?>
  <div class="card"><table><thead><tr><th>Migration</th><th>Description</th><th>Status</th></tr></thead><tbody>
  <?php foreach ($plan['migrations'] as $m): ?>
    <tr><td><?= h($m['id']) ?></td><td><?= h($m['description']) ?></td>
    <td><?= isset($applied[$m['id']]) ? '<span class="ok">Applied ' . h($applied[$m['id']]) . '</span>' : '<span class="pending">Pending</span>' ?></td></tr>
  <?php endforeach; ?>
  </tbody></table></div>
  <form method="post" class="card"><input type="hidden" name="action" value="migrate">
    <label><input type="checkbox" name="seed" value="1" checked> Also refresh catalog data (products, categories, pages) — orders and inquiries are never touched</label>
    <p><button><?= $pending ? 'Apply ' . count($pending) . ' pending migration(s)' : 'Re-run (nothing pending)' ?></button></p>
    <small>Back up the database first (phpMyAdmin → Export) for production.</small>
  </form>
<?php endif; ?>
</div></body></html>
`;
}

function generateWebConfig() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <defaultDocument>
            <files>
                <clear />
                <add value="index.html" />
                <add value="index.php" />
            </files>
        </defaultDocument>
        <security>
            <requestFiltering>
                <hiddenSegments>
                    <add segment="database" />
                    <add segment="store_config.php" />
                    <add segment="payment_config.php" />
                </hiddenSegments>
            </requestFiltering>
        </security>
        <httpProtocol>
            <customHeaders>
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-Frame-Options" value="SAMEORIGIN" />
            </customHeaders>
        </httpProtocol>
        <staticContent>
            <remove fileExtension=".webp" />
            <mimeMap fileExtension=".webp" mimeType="image/webp" />
        </staticContent>
    </system.webServer>
</configuration>
`;
}

function generatePhpHtaccess() {
  return `# Apache / cPanel (Linux GoDaddy hosting). Windows/Plesk hosting uses web.config instead.
DirectoryIndex index.html index.php
Options -Indexes
RedirectMatch 404 ^/database(/|$)
<FilesMatch "^(store|payment)_config\\.php$">
  Require all denied
</FilesMatch>
<IfModule mod_mime.c>
  AddType image/webp .webp
</IfModule>
`;
}

function generatePhpReadme(store, env, version, dbName, zipName, assets) {
  const slug = safeSlug(store.slug);
  return `# ${store.store_name} — PHP + MySQL Deployment (GoDaddy)

**Environment:** ${env.toUpperCase()}  ·  **Version:** v${version}  ·  **Generated:** ${new Date().toISOString()}
**Package:** \`${zipName}\`

| File / Folder | Purpose |
|---|---|
| \`index.html\`, \`products/\`, \`collections/\`, \`page/\` | Pre-rendered storefront pages (relative links: works at the domain root or in a subfolder) |
| \`assets/\` | Images used by the storefront (${assets.copied} files) |
| \`api.php\` | Checkout (COD / Razorpay), contact and restock API (saves into MySQL) |
| \`admin-orders.php\` | Password-protected order dashboard |
| \`packaging.php\` | Delivery-address labels (A4 / 4×6), Ekart CSV, mark as packed — same login |
| \`migrate.php\` | Password-protected database upgrade tool (applies pending migrations) |
| \`db_config.php\` | MySQL credentials + admin password |
| \`store_config.php\` | Store id / version + checkout options + WhatsApp templates (blocked from the web) |
| \`payment_config.php\` | Razorpay key id + secret (blocked from the web; needs the PHP curl extension) |
| \`whatsapp_orders.php\`, \`packaging_api.php\` | Helpers for WhatsApp order messages and packaging |
| \`database/${slug}_mysql.sql\` | Install / upgrade script — safe on new or existing databases (not uploaded by FTP) |
| \`web.config\` / \`.htaccess\` | IIS (Windows/Plesk) and Apache (Linux/cPanel) settings |

## Go live
1. **MySQL** — create database \`${dbName || slug + '_db'}\` and a user in cPanel/Plesk, then in phpMyAdmin → Import → \`database/${slug}_mysql.sql\`.
2. **db_config.php** — confirm host, name, user and password (the Store Builder fills these from the saved Database settings).
3. **Upload** — use *Upload via FTP* in the Store Builder, or upload this ZIP in File Manager to the domain's web root and Extract.
4. **Check** — open \`https://<your-domain>/api.php?route=health\` → \`"db":"connected"\`, then place a test order and see it in \`/admin-orders.php\`.

## Upgrading an existing database
Schema changes ship as numbered migrations (latest: \`${migrationsLib.latestId()}\`). Each database records what it has run in the
\`schema_migrations\` table, so nothing runs twice and orders are never touched. Pick one:
- **Browser:** after uploading, open \`https://<your-domain>/migrate.php\`, sign in with the admin password, click *Apply*.
- **phpMyAdmin:** import \`database/${slug}_mysql.sql\` again, or the smaller *DB Migration* download from the Store Builder
  (only the changes since the version you deployed).
Back up first: phpMyAdmin → Export.
${assets.missing.length ? `\n> Missing assets (referenced but not found locally):\n${assets.missing.map(m => '> - ' + m).join('\n')}\n` : ''}`;
}

// ── Node.js bundle ─────────────────────────────────────────────────────────
function generateDualDbJs() {
  return `// pg / mysql2 adapter with a pg-style query(sql, params) -> { rows } interface.
'use strict';
const isMySql = (process.env.DB_TYPE || '').toLowerCase() === 'mysql' || /^mysql:/i.test(process.env.DATABASE_URL || '');
let query;
if (isMySql) {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool(process.env.DATABASE_URL);
  query = async (sql, params = []) => {
    const [rows] = await pool.query(sql.replace(/\\$\\d+/g, '?'), params);
    return { rows: Array.isArray(rows) ? rows : [], insertId: rows.insertId };
  };
} else {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false });
  query = (sql, params) => pool.query(sql, params);
}
module.exports = { query, isMySql };
`;
}

function generateNodeReadme(store, env, version, dbType, zipName) {
  return `# ${store.store_name} — Node.js Deployment

**Environment:** ${env.toUpperCase()}  ·  **Version:** v${version}  ·  **Database:** ${dbType.toUpperCase()}  ·  **Package:** \`${zipName}\`

- \`static/\` — pre-rendered storefront + referenced assets, plus the Merchant admin (\`/merchant\`), Store Builder (\`/store-builder\`) and sign-in (\`/auth\`)
- \`api/\` — Express server (\`npm install && npm start\`) serving \`static/\`, the checkout / Razorpay / contact APIs and the merchant APIs
- \`database/\` — MySQL (install / upgrade, migration-safe) and PostgreSQL schema + seed, with product stock quantity
- \`.env\` — environment settings (FTP upload skips .env files; set them in your host's Node.js app settings)

GoDaddy cPanel: *Setup Node.js App* → application root \`api\`, startup file \`server.js\`, then Run NPM Install.
Railway: \`railway up\` from this folder. Vercel: output directory \`static\`.

## Merchant admin & Store Builder
Sign in at \`/auth/login.html\` with **ADMIN_EMAIL** / **ADMIN_PASSWORD** from \`.env\` (change the password before going live).
All product, category, page, theme and order APIs require that sign-in; the storefront checkout APIs are public.
- Merchant dashboard: \`https://<your-domain>/merchant/\`
- Visual Store Builder: \`https://<your-domain>/store-builder/\`
`;
}

function generateStaticReadme(store, env, version, zipName) {
  return `# ${store.store_name} — Static Deployment

**Environment:** ${env.toUpperCase()}  ·  **Version:** v${version}  ·  **Package:** \`${zipName}\`

Pure HTML storefront with no server code. Checkout and contact forms send the order to WhatsApp (${store.whatsapp_number || 'set a WhatsApp number in Store settings'}).
Upload everything to the web root (GoDaddy File Manager, FTP, GitHub Pages, Netlify or Vercel).
`;
}

function readExistingAdminKey(dir) {
  const file = path.join(dir, 'db_config.php');
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/define\('ADMIN_SECRET_KEY',\s*'((?:[^'\\]|\\.)*)'\)/);
  return m ? m[1].replace(/\\(.)/g, '$1') : null;
}

function technologyFor(options) {
  if (['php', 'nodejs', 'static'].includes(options.technology)) return options.technology;
  if (options.provider === 'railway') return 'nodejs';
  if (options.provider === 'vercel' || options.provider === 'github') return 'static';
  return 'php';
}

/**
 * Build a deployment package for one environment and technology.
 * php    → deployment/<slug>-godaddy-deploy[-env]/      zip: deployment/<slug>-godaddy-deploy[-env]-v<version>.zip
 * nodejs → deployment/published/<slug>[-env]/            zip: deployment/published/<slug>[-env]-nodejs-v<version>.zip
 * static → deployment/published/<slug>-static[-env]/     zip: deployment/published/<slug>-static[-env]-v<version>.zip
 */
async function exportStoreDeployment({ store, themeConfig, products = [], categories = [], pages = [], options = {} }) {
  const technology = technologyFor(options);
  const env = ENV_SUFFIX[options.env] !== undefined ? options.env : 'production';
  const provider = options.provider || 'godaddy';
  const version = options.version || '1.0.1';
  const db = options.db || {};
  const dbType = technology === 'php' ? 'mysql' : (db.type || options.db_type || (provider === 'godaddy' ? 'mysql' : 'postgres'));
  // Non-production builds must not inherit the live store's domain.
  const customDomain = (options.custom_domain !== undefined ? options.custom_domain : env === 'production' ? store.custom_domain : '') || '';
  const slug = safeSlug(store.slug || 'store');
  const suffix = ENV_SUFFIX[env];
  const checkout = checkoutSettings(themeConfig || store.theme_config);
  const livePages = pages.filter(p => p.status !== 'draft');

  let exportDir, siteDir, zipPath;
  if (technology === 'php') {
    exportDir = path.join(DEPLOY_ROOT, `${slug}-godaddy-deploy${suffix}`);
    siteDir = exportDir;
    zipPath = path.join(DEPLOY_ROOT, `${slug}-godaddy-deploy${suffix}-v${version}.zip`);
  } else if (technology === 'nodejs') {
    exportDir = path.join(DEPLOY_ROOT, 'published', `${slug}${suffix}`);
    siteDir = path.join(exportDir, 'static');
    zipPath = path.join(DEPLOY_ROOT, 'published', `${slug}${suffix}-nodejs-v${version}.zip`);
  } else {
    exportDir = path.join(DEPLOY_ROOT, 'published', `${slug}-static${suffix}`);
    siteDir = exportDir;
    zipPath = path.join(DEPLOY_ROOT, 'published', `${slug}-static${suffix}-v${version}.zip`);
  }
  const zipName = path.basename(zipPath);
  fs.mkdirSync(siteDir, { recursive: true });
  // Drop pages from the previous build so deleted products and pages do not linger.
  for (const d of ['products', 'collections', 'page']) fs.rmSync(path.join(siteDir, d), { recursive: true, force: true });

  const snapshot = {
    store: { ...store, custom_domain: customDomain },
    theme_config: themeConfig || store.theme_config || {},
    products, categories, pages: livePages
  };
  const shim = technology === 'php' ? phpFetchShim : technology === 'static' ? staticFetchShim(store, products) : '';
  const htmls = renderSite(snapshot, storefrontRoutes(products, categories, livePages), siteDir, shim);
  const assets = copyReferencedAssets(htmls, siteDir);
  const mysqlSql = generateMySqlSeed(store, categories, products, livePages, { version, env });
  const versionInfo = `${store.store_name}\nenvironment=${env}\ntechnology=${technology}\nversion=${version}\nbuilt=${new Date().toISOString()}\n`;
  fs.writeFileSync(path.join(exportDir, 'VERSION.txt'), versionInfo, 'utf8');

  if (technology === 'php') {
    const dbDir = path.join(exportDir, 'database');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, `${slug}_mysql.sql`), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(exportDir, 'store_config.php'), generateStoreConfigPhp(store, env, version, checkout, options.whatsapp || undefined), 'utf8');
    // Razorpay keys: write when known, otherwise keep a hand-edited file, otherwise leave blank placeholders.
    const rzp = options.razorpay || {};
    if (rzp.key_id && rzp.key_secret) fs.writeFileSync(path.join(exportDir, 'payment_config.php'), generatePaymentConfigPhp(store, env, rzp), 'utf8');
    else if (!fs.existsSync(path.join(exportDir, 'payment_config.php'))) fs.writeFileSync(path.join(exportDir, 'payment_config.php'), generatePaymentConfigPhp(store, env, { key_id: '', key_secret: '', mode: 'not configured' }), 'utf8');
    // Keep a hand-edited db_config.php when no database settings were saved for this environment.
    const hasDb = !!(db.name && db.user);
    if (hasDb || !fs.existsSync(path.join(exportDir, 'db_config.php'))) {
      const adminKey = readExistingAdminKey(exportDir) || crypto.randomBytes(9).toString('base64url');
      fs.writeFileSync(path.join(exportDir, 'db_config.php'), generateDbConfigPhp(store, db, adminKey, env), 'utf8');
    }
    fs.writeFileSync(path.join(exportDir, 'api.php'), generateApiPhp(), 'utf8');
    // WhatsApp order messages + packaging labels (shared helpers are real PHP files, copied verbatim).
    assertPhpPlaceholdersInSync();
    for (const helper of ['whatsapp_orders.php', 'packaging_api.php']) fs.copyFileSync(path.join(PHP_DIR, helper), path.join(exportDir, helper));
    fs.writeFileSync(path.join(exportDir, 'packaging.php'), generatePackagingPhp(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'migrate.php'), generateMigratePhp(mysqlSeedStatements(store, categories, products, livePages), version, env), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'admin-orders.php'), generateAdminOrdersPhp(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'web.config'), generateWebConfig(), 'utf8');
    fs.writeFileSync(path.join(exportDir, '.htaccess'), generatePhpHtaccess(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'README-DEPLOY.md'), generatePhpReadme(store, env, version, db.name, zipName, assets), 'utf8');
  } else if (technology === 'nodejs') {
    const apiDir = path.join(exportDir, 'api');
    const dbDir = path.join(exportDir, 'database');
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(dbDir, { recursive: true });
    // Bundled Merchant admin, Store Builder and sign-in pages (served by api/server.js).
    for (const folder of ['merchant', 'store-builder', 'auth']) {
      const src = path.join(REPO_ROOT, folder);
      if (!fs.existsSync(src)) continue;
      try { fs.cpSync(src, path.join(siteDir, folder), { recursive: true }); }
      catch (e) { console.warn(`[deploy] Could not copy ${folder}:`, e.message); }
    }
    fs.writeFileSync(path.join(apiDir, 'server.js'), generateStandaloneServerJs(store, dbType, checkout), 'utf8');
    fs.writeFileSync(path.join(apiDir, 'package.json'), generatePackageJson(store, dbType), 'utf8');
    fs.writeFileSync(path.join(apiDir, 'db.js'), generateDualDbJs(), 'utf8');
    const envContent = generateEnvFile({
      provider, dbType, env, storeSlug: slug, customDomain, razorpay: options.razorpay,
      dbHost: db.host, dbUser: db.user, dbPass: db.password, dbName: db.name, dbPort: db.port
    });
    fs.writeFileSync(path.join(exportDir, '.env'), envContent, 'utf8');
    fs.writeFileSync(path.join(apiDir, '.env'), envContent, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'seed-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-postgres.sql'), generatePostgresSeed(store, categories, products, livePages), 'utf8');
    fs.writeFileSync(path.join(siteDir, '.htaccess'), generateApacheHtaccess(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'vercel.json'), generateVercelJson(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'railway.toml'), generateRailwayConfig(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'README-DEPLOY.md'), generateNodeReadme(store, env, version, dbType, zipName), 'utf8');
  } else {
    fs.writeFileSync(path.join(exportDir, 'vercel.json'), JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'README-DEPLOY.md'), generateStaticReadme(store, env, version, zipName), 'utf8');
  }

  let zipError = null;
  try { zipDirectory(exportDir, zipPath); }
  catch (e) { zipError = String(e.stderr || e.message).trim(); console.warn('[deploy] Could not create ZIP:', zipError); }

  return {
    success: true,
    technology, env, version, provider, dbType, customDomain, slug,
    export_dir: exportDir,
    upload_dir: exportDir,
    zip_path: zipError ? null : zipPath,
    zip_name: zipName,
    zip_error: zipError,
    pages_rendered: htmls.length,
    assets_copied: assets.copied,
    assets_missing: assets.missing,
    checkout,
    razorpay_mode: technology === 'php' ? ((options.razorpay || {}).key_id ? (options.razorpay.mode || 'test') : 'not configured') : null,
    schema: migrationsLib.latestId(),
    built_at: new Date().toISOString(),
    download_url: `/api/stores/${store.id}/deployment-zip?file=${encodeURIComponent(zipName)}`
  };
}

/**
 * DB-only upgrade package for an existing MySQL database:
 * deployment/db-migrations/<slug>[-env]-db-migration-v<from>-to-v<to>.zip with the .sql, migrate.php and a README.
 * fromSchema is the last migration the deployed version shipped with (empty = fresh database).
 */
async function exportDbMigration({ store, products = [], categories = [], pages = [], env = 'production', fromVersion, fromSchema, toVersion, includeSeed = true, whatsapp = null }) {
  const slug = safeSlug(store.slug || 'store');
  const livePages = pages.filter(p => p.status !== 'draft');
  const base = `${slug}${ENV_SUFFIX[env] || ''}-db-migration-v${fromVersion || '0'}-to-v${toVersion}`;
  const outDir = path.join(DEPLOY_ROOT, 'db-migrations', base);
  const zipPath = path.join(DEPLOY_ROOT, 'db-migrations', base + '.zip');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const { sql, pending } = generateMySqlMigration(store, { fromVersion, fromSchema, toVersion, env, includeSeed, categories, products, pages: livePages });
  fs.writeFileSync(path.join(outDir, base + '.sql'), sql, 'utf8');
  fs.writeFileSync(path.join(outDir, 'migrate.php'), generateMigratePhp(mysqlSeedStatements(store, categories, products, livePages), toVersion, env), 'utf8');
  fs.writeFileSync(path.join(outDir, 'store_config.php'), generateStoreConfigPhp(store, env, toVersion, undefined, whatsapp || undefined), 'utf8');
  fs.writeFileSync(path.join(outDir, 'README.md'), `# ${store.store_name} — database upgrade ${fromVersion ? 'v' + fromVersion : '(fresh)'} → v${toVersion} (${env})

Schema changes: ${pending.length ? pending.map(m => `\`${m.id}\` (${m.description})`).join(', ') : 'none'}
Catalog refresh: ${includeSeed ? 'included (products, categories, pages are upserted; orders and inquiries untouched)' : 'not included'}

**Back up first:** phpMyAdmin → select the database → Export → Go.

Option A — phpMyAdmin: select the database → Import → \`${base}.sql\` → Go.
Option B — browser: upload \`migrate.php\` and \`store_config.php\` next to \`db_config.php\` on the site, open
\`https://<your-domain>/migrate.php\`, sign in with ADMIN_SECRET_KEY and click Apply.

Both are safe to re-run: every change is recorded in the \`schema_migrations\` table and skipped next time.
`, 'utf8');

  let zipError = null;
  try { zipDirectory(outDir, zipPath); }
  catch (e) { zipError = String(e.stderr || e.message).trim(); }
  return {
    success: !zipError, env, from_version: fromVersion || null, to_version: toVersion,
    pending: pending.map(m => ({ id: m.id, description: m.description })),
    include_seed: includeSeed,
    export_dir: outDir, zip_path: zipError ? null : zipPath, zip_name: base + '.zip', zip_error: zipError,
    built_at: new Date().toISOString()
  };
}

module.exports = {
  exportStoreDeployment,
  exportDbMigration,
  generateEnvFile,
  generateMySqlSeed,
  generatePostgresSeed,
  DEPLOY_ROOT
};
