const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { renderStore } = require('../store-renderer');

function safeSlug(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
}

function escapeSqlString(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
}

function generateMySqlSeed(store, categories, products, pages) {
  let sql = `-- ============================================================
-- ${store.store_name} — MySQL Database Schema & Seed Data
-- Target: GoDaddy / cPanel / MariaDB / MySQL 5.7+ / 8.0+
-- Generated: ${new Date().toISOString()}
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. STORES
CREATE TABLE IF NOT EXISTS \`stores\` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS \`categories\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`name\` VARCHAR(120) NOT NULL,
  \`slug\` VARCHAR(120) NOT NULL,
  \`image_url\` TEXT DEFAULT NULL,
  \`sort_order\` INT DEFAULT 0,
  \`active\` BOOLEAN DEFAULT TRUE,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_cat_store\` (\`store_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS \`products\` (
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
  \`quantity\` INT DEFAULT 100,
  \`in_stock\` BOOLEAN DEFAULT TRUE,
  \`active\` BOOLEAN DEFAULT TRUE,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX \`idx_prod_store\` (\`store_id\`),
  INDEX \`idx_prod_cat\` (\`category_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ORDERS
CREATE TABLE IF NOT EXISTS \`orders\` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. STORE PAGES
CREATE TABLE IF NOT EXISTS \`store_pages\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`store_id\` BIGINT NOT NULL,
  \`title\` VARCHAR(150) NOT NULL,
  \`slug\` VARCHAR(150) NOT NULL,
  \`content\` LONGTEXT DEFAULT NULL,
  \`status\` VARCHAR(30) DEFAULT 'published',
  \`sort_order\` INT DEFAULT 0,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SEED DATA FOR STORE: ${store.store_name}
INSERT INTO \`stores\` (\`id\`, \`store_name\`, \`slug\`, \`custom_domain\`, \`tagline\`, \`hero_headline\`, \`hero_subtext\`, \`hero_cta_text\`, \`primary_colour\`, \`bg_colour\`, \`accent_colour\`, \`logo_url\`, \`whatsapp_number\`, \`instagram_handle\`, \`address\`, \`city\`, \`state\`, \`theme_config\`, \`status\`)
VALUES (${Number(store.id)}, ${escapeSqlString(store.store_name)}, ${escapeSqlString(store.slug)}, ${escapeSqlString(store.custom_domain)}, ${escapeSqlString(store.tagline)}, ${escapeSqlString(store.hero_headline)}, ${escapeSqlString(store.hero_subtext)}, ${escapeSqlString(store.hero_cta_text)}, ${escapeSqlString(store.primary_colour)}, ${escapeSqlString(store.bg_colour)}, ${escapeSqlString(store.accent_colour)}, ${escapeSqlString(store.logo_url)}, ${escapeSqlString(store.whatsapp_number)}, ${escapeSqlString(store.instagram_handle)}, ${escapeSqlString(store.address)}, ${escapeSqlString(store.city)}, ${escapeSqlString(store.state)}, ${escapeSqlString(JSON.stringify(store.theme_config || {}))}, 'published')
ON DUPLICATE KEY UPDATE \`store_name\`=VALUES(\`store_name\`), \`custom_domain\`=VALUES(\`custom_domain\`), \`theme_config\`=VALUES(\`theme_config\`);
\n`;

  // Categories seed
  if (categories && categories.length) {
    sql += `-- CATEGORIES SEED\n`;
    for (const c of categories) {
      sql += `INSERT INTO \`categories\` (\`id\`, \`store_id\`, \`name\`, \`slug\`, \`image_url\`, \`sort_order\`, \`active\`)
VALUES (${Number(c.id)}, ${Number(store.id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.slug)}, ${escapeSqlString(c.image_url)}, ${Number(c.sort_order || 0)}, ${c.active !== false ? 1 : 0})
ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`image_url\`=VALUES(\`image_url\`);\n`;
    }
    sql += '\n';
  }

  // Products seed
  if (products && products.length) {
    sql += `-- PRODUCTS SEED\n`;
    for (const p of products) {
      const imgJson = Array.isArray(p.images) ? JSON.stringify(p.images) : (p.images ? JSON.stringify([p.images]) : '[]');
      const qty = (p.quantity !== undefined && p.quantity !== null) ? Number(p.quantity) : (p.stock !== undefined ? Number(p.stock) : 100);
      sql += `INSERT INTO \`products\` (\`id\`, \`store_id\`, \`category_id\`, \`name\`, \`slug\`, \`sku\`, \`price\`, \`compare_price\`, \`product_size\`, \`offer_text\`, \`badge_text\`, \`description\`, \`ingredients\`, \`user_instructions\`, \`benefits\`, \`additional_note\`, \`images\`, \`quantity\`, \`in_stock\`, \`active\`)
VALUES (${Number(p.id)}, ${Number(store.id)}, ${p.category_id ? Number(p.category_id) : 'NULL'}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.slug)}, ${escapeSqlString(p.sku)}, ${Number(p.price || 0)}, ${p.compare_price ? Number(p.compare_price) : 'NULL'}, ${escapeSqlString(p.product_size || p.size)}, ${escapeSqlString(p.offer_text || p.offer)}, ${escapeSqlString(p.badge_text)}, ${escapeSqlString(p.description)}, ${escapeSqlString(p.ingredients)}, ${escapeSqlString(p.user_instructions)}, ${escapeSqlString(p.benefits)}, ${escapeSqlString(p.additional_note || 'Inclusive of GST and free shipping.')}, ${escapeSqlString(imgJson)}, ${qty}, ${p.in_stock !== false ? 1 : 0}, ${p.active !== false ? 1 : 0})
ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`price\`=VALUES(\`price\`), \`images\`=VALUES(\`images\`), \`quantity\`=VALUES(\`quantity\`), \`user_instructions\`=VALUES(\`user_instructions\`), \`benefits\`=VALUES(\`benefits\`);\n`;
    }
    sql += '\n';
  }

  // Store Pages seed
  if (pages && pages.length) {
    sql += `-- PAGES SEED\n`;
    for (const page of pages) {
      const contentJson = typeof page.content === 'object' ? JSON.stringify(page.content) : String(page.content || '');
      sql += `INSERT INTO \`store_pages\` (\`id\`, \`store_id\`, \`title\`, \`slug\`, \`content\`, \`status\`, \`sort_order\`)
VALUES (${Number(page.id)}, ${Number(store.id)}, ${escapeSqlString(page.title)}, ${escapeSqlString(page.slug)}, ${escapeSqlString(contentJson)}, ${escapeSqlString(page.status || 'published')}, ${Number(page.sort_order || 0)})
ON DUPLICATE KEY UPDATE \`title\`=VALUES(\`title\`), \`content\`=VALUES(\`content\`);\n`;
    }
  }

  sql += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;
  return sql;
}

function generatePostgresSeed(store, categories, products, pages) {
  let sql = `-- ============================================================
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
\n`;
  return sql;
}

function generateEnvFile(config) {
  const { provider, dbType, storeSlug, customDomain, dbHost, dbUser, dbPass, dbName, dbPort } = config;
  const isMySql = dbType === 'mysql';
  const defaultDbUrl = isMySql
    ? `mysql://${dbUser || 'root'}:${dbPass || ''}@${dbHost || 'localhost'}:${dbPort || 3306}/${dbName || storeSlug}`
    : `postgres://${dbUser || 'postgres'}:${dbPass || 'password'}@${dbHost || 'localhost'}:${dbPort || 5432}/${dbName || storeSlug}?sslmode=require`;

  return `# ============================================================
# ZKCommerce v4.1 Production Environment Configuration
# Target Provider: ${String(provider || 'godaddy').toUpperCase()}
# Database Engine: ${String(dbType || 'mysql').toUpperCase()}
# Store: ${storeSlug}
# Generated: ${new Date().toISOString()}
# ============================================================

NODE_ENV=production
PORT=3000

# ── Database Connection ──
DB_TYPE=${isMySql ? 'mysql' : 'postgres'}
DATABASE_URL=${defaultDbUrl}

# ── Store Domain & Routing ──
STORE_SLUG=${storeSlug}
CUSTOM_DOMAIN=${customDomain || ''}
STORE_BASE_DOMAIN=zkcommerce.in

# ── Security & Authentication ──
JWT_SECRET=${require('crypto').randomBytes(32).toString('hex')}

# ── Payment Gateway (Razorpay) ──
RAZORPAY_MODE=live
RAZORPAY_KEY_ID=rzp_live_CHANGE_ME
RAZORPAY_KEY_SECRET=CHANGE_ME

# ── Notification & Contact ──
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=
`;
}

function generateStandaloneServerJs(store, dbType) {
  return `/**
 * Standalone Production Server for ${store.store_name}
 * Compatible with GoDaddy (cPanel Node.js Selector / Passenger), Railway, and VPS
 */
'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const STORE_ID = ${Number(store.id)};

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

// ── STORE & BUILDER APIS ──
app.get('/api/stores', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]);
    res.json({ stores: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stores/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Store not found' });
    res.json({ store: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stores/:id/builder', async (req, res) => {
  try {
    const [sRes, pRes, cRes, pgRes] = await Promise.all([
      db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]),
      db.query('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 ORDER BY p.id DESC', [STORE_ID]),
      db.query('SELECT * FROM categories WHERE store_id=$1 ORDER BY sort_order, name', [STORE_ID]),
      db.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order, id', [STORE_ID])
    ]);
    res.json({
      store: sRes.rows[0],
      products: pRes.rows,
      categories: cRes.rows,
      pages: pgRes.rows,
      payments: { razorpay_configured: false, razorpay_mode: 'test' }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/stores/:id/draft', async (req, res) => {
  try {
    const { theme_config, store_fields } = req.body;
    const f = store_fields || {};
    const tc = typeof theme_config === 'object' ? JSON.stringify(theme_config) : theme_config;
    await db.query(
      \`UPDATE stores SET 
        theme_config=COALESCE($2, theme_config),
        primary_colour=COALESCE($3, primary_colour),
        accent_colour=COALESCE($4, accent_colour),
        hero_cta_text=COALESCE($5, hero_cta_text),
        tagline=COALESCE($6, tagline),
        updated_at=NOW()
      WHERE id=$1\`,
      [STORE_ID, tc, f.primary_colour, f.accent_colour, f.hero_cta_text, f.tagline]
    );
    const { rows } = await db.query('SELECT * FROM stores WHERE id=$1', [STORE_ID]);
    res.json({ store: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PRODUCTS APIS (WITH QUANTITY & STOCK) ──
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.store_id=$1 ORDER BY p.id DESC',
      [STORE_ID]
    );
    res.json({ products: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM products WHERE id=$1 AND store_id=$2', [req.params.id, STORE_ID]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, compare_price, cost_price, sku, description, ingredients, user_instructions, benefits, additional_note, images, category_id, stock, quantity } = req.body;
    const finalQty = (quantity !== undefined && quantity !== null) ? Number(quantity) : (stock !== undefined ? Number(stock) : 100);
    const inStock = finalQty > 0;
    const imgJson = Array.isArray(images) ? JSON.stringify(images) : (images ? JSON.stringify([images]) : '[]');
    const { rows } = await db.query(
      \`INSERT INTO products (store_id, category_id, name, price, compare_price, sku, description, ingredients, user_instructions, benefits, additional_note, images, quantity, in_stock, active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true) RETURNING *\`,
      [STORE_ID, category_id || null, name, Number(price || 0), compare_price ? Number(compare_price) : null, sku || null, description || '', ingredients || '', user_instructions || null, benefits || null, additional_note || 'Inclusive of GST and free shipping.', imgJson, finalQty, inStock]
    );
    res.status(201).json({ product: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, price, compare_price, description, user_instructions, benefits, additional_note, category_id, stock, quantity } = req.body;
    const finalQty = quantity !== undefined ? Number(quantity) : (stock !== undefined ? Number(stock) : undefined);
    const inStock = finalQty !== undefined ? (finalQty > 0) : undefined;
    const { rows } = await db.query(
      \`UPDATE products SET 
        name=COALESCE($3, name),
        price=COALESCE($4, price),
        compare_price=COALESCE($5, compare_price),
        description=COALESCE($6, description),
        user_instructions=COALESCE($7, user_instructions),
        benefits=COALESCE($8, benefits),
        additional_note=COALESCE($9, additional_note),
        category_id=COALESCE($10, category_id),
        quantity=COALESCE($11, quantity),
        in_stock=COALESCE($12, in_stock),
        updated_at=NOW()
      WHERE id=$1 AND store_id=$2 RETURNING *\`,
      [req.params.id, STORE_ID, name, price, compare_price, description, user_instructions, benefits, additional_note, category_id, finalQty, inStock]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CATEGORIES APIS ──
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await db.query(
      \`SELECT c.*, COUNT(p.id)::int AS product_count 
       FROM categories c 
       LEFT JOIN products p ON p.category_id=c.id AND p.active=true 
       WHERE c.store_id=$1 GROUP BY c.id ORDER BY c.sort_order, c.name\`,
      [STORE_ID]
    );
    res.json({ categories: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, slug, image_url, sort_order } = req.body;
    const { rows } = await db.query(
      'INSERT INTO categories (store_id, name, slug, image_url, sort_order, active) VALUES ($1,$2,$3,$4,$5,true) RETURNING *',
      [STORE_ID, name, slug, image_url || null, sort_order || 0]
    );
    res.status(201).json({ category: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, slug, image_url, sort_order } = req.body;
    const { rows } = await db.query(
      'UPDATE categories SET name=COALESCE($3,name), slug=COALESCE($4,slug), image_url=COALESCE($5,image_url), sort_order=COALESCE($6,sort_order) WHERE id=$1 AND store_id=$2 RETURNING *',
      [req.params.id, STORE_ID, name, slug, image_url, sort_order]
    );
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ category: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PAGES APIS ──
app.get('/api/stores/:id/pages', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM store_pages WHERE store_id=$1 ORDER BY sort_order, id', [STORE_ID]);
    res.json({ pages: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stores/:id/pages', async (req, res) => {
  try {
    const { title, slug, content={}, status='published', sort_order=0 } = req.body;
    const contentVal = typeof content === 'object' ? JSON.stringify(content) : content;
    const { rows } = await db.query(
      'INSERT INTO store_pages (store_id, title, slug, content, status, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [STORE_ID, title, slug, contentVal, status, sort_order]
    );
    res.status(201).json({ page: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/stores/:id/pages/:pageId', async (req, res) => {
  try {
    const { title, slug, content, status, sort_order } = req.body;
    const contentVal = content !== undefined ? (typeof content === 'object' ? JSON.stringify(content) : content) : null;
    const { rows } = await db.query(
      'UPDATE store_pages SET title=COALESCE($3,title), slug=COALESCE($4,slug), content=COALESCE($5,content), status=COALESCE($6,status), sort_order=COALESCE($7,sort_order) WHERE id=$1 AND store_id=$2 RETURNING *',
      [req.params.pageId, STORE_ID, title, slug, contentVal, status, sort_order]
    );
    if (!rows.length) return res.status(404).json({ error: 'Page not found' });
    res.json({ page: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/stores/:id/pages/:pageId', async (req, res) => {
  try {
    await db.query('DELETE FROM store_pages WHERE id=$1 AND store_id=$2', [req.params.pageId, STORE_ID]);
    res.json({ deleted: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ORDERS API ──
app.get('/api/orders', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM orders WHERE store_id=$1 ORDER BY id DESC LIMIT 50', [STORE_ID]);
    res.json({ orders: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, shipping_address, items, total_amount, payment_method } = req.body;
    const orderNumber = 'ORD-' + Date.now();
    const itemsJson = JSON.stringify(items || []);
    const q = 'INSERT INTO orders (store_id, order_number, customer_name, customer_phone, customer_email, shipping_address, items_json, total_amount, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)';
    await db.query(q, [STORE_ID, orderNumber, customer_name, customer_phone, customer_email || '', shipping_address, itemsJson, total_amount || 0, payment_method || 'cod']);
    res.json({ success: true, order_number: orderNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to static index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'static', 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`✅ \${'${store.store_name}'} running on port \${PORT}\`);
  console.log(\`   🛍️ Storefront:   http://localhost:\${PORT}/\`);
  console.log(\`   💼 Client Admin: http://localhost:\${PORT}/merchant/dashboard.html\`);
  console.log(\`   🎨 StoreBuilder: http://localhost:\${PORT}/store-builder/\`);
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
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5',
      helmet: '^7.1.0',
      dotenv: '^16.3.1',
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

async function exportStoreDeployment({ store, themeConfig, products, categories, pages, options = {} }) {
  const provider = options.provider || 'godaddy';
  const dbType = options.db_type || (provider === 'godaddy' ? 'mysql' : 'postgres');
  const customDomain = options.custom_domain || store.custom_domain || '';
  const slug = safeSlug(store.slug || 'store');

  const baseDirs = [
    path.join('D:\\ZK Software\\Stage\\zkcommerce\\zkcommerce-v4-complete', 'deployment', 'published', slug),
    path.join('D:\\ZK Software\\Dev\\zkcommerce\\zkcommerce-v4.1.0-source\\zkc', 'deployment', 'published', slug)
  ];

  const results = [];

  for (const exportDir of baseDirs) {
    fs.mkdirSync(exportDir, { recursive: true });
    const staticDir = path.join(exportDir, 'static');
    const apiDir = path.join(exportDir, 'api');
    const dbDir = path.join(exportDir, 'database');

    fs.mkdirSync(staticDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(dbDir, { recursive: true });

    // 1. Render Static HTML
    const snapshot = {
      store: { ...store, custom_domain: customDomain },
      theme_config: themeConfig || store.theme_config || {},
      products: products || [],
      categories: categories || [],
      pages: pages || []
    };

    const homeHtml = renderStore(snapshot, { template: 'home', showContact: true });
    fs.writeFileSync(path.join(staticDir, 'index.html'), homeHtml, 'utf8');

    // Render category collection pages
    if (categories && categories.length) {
      const colDir = path.join(staticDir, 'collections');
      fs.mkdirSync(colDir, { recursive: true });
      for (const cat of categories) {
        const catHtml = renderStore(snapshot, { template: 'collection', collection: cat.name, showContact: true });
        fs.writeFileSync(path.join(colDir, `${safeSlug(cat.slug || cat.name)}.html`), catHtml, 'utf8');
      }
    }

    // Render individual product pages
    if (products && products.length) {
      const prodDir = path.join(staticDir, 'products');
      fs.mkdirSync(prodDir, { recursive: true });
      for (const prod of products) {
        const prodHtml = renderStore(snapshot, { template: 'product', product: prod, showContact: true });
        fs.writeFileSync(path.join(prodDir, `${safeSlug(prod.slug || prod.name)}.html`), prodHtml, 'utf8');
      }
    }

    // 2. Copy Assets, Merchant Client Admin, StoreBuilder, and Auth directories
    const devSourceRoot = 'D:\\ZK Software\\Dev\\zkcommerce\\zkcommerce-v4.1.0-source\\zkc';
    for (const folder of ['assets', 'merchant', 'store-builder', 'auth']) {
      const src = path.join(devSourceRoot, folder);
      const dst = path.join(staticDir, folder);
      if (fs.existsSync(src)) {
        try {
          fs.cpSync(src, dst, { recursive: true });
        } catch (e) {
          console.warn(`Export cp warning (${folder}):`, e.message);
        }
      }
    }

    // 3. Backend API files
    fs.writeFileSync(path.join(apiDir, 'server.js'), generateStandaloneServerJs(store, dbType), 'utf8');
    fs.writeFileSync(path.join(apiDir, 'package.json'), generatePackageJson(store, dbType), 'utf8');
    
    // Copy dual DB driver
    const dbSource = path.join('D:\\ZK Software\\Stage\\zkcommerce\\zkcommerce-v4-complete\\zkc-build\\api', 'db.js');
    if (fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, path.join(apiDir, 'db.js'));
    }

    // 4. .env file
    const envContent = generateEnvFile({
      provider,
      dbType,
      storeSlug: slug,
      customDomain,
      dbHost: options.db_host,
      dbUser: options.db_user,
      dbPass: options.db_password,
      dbName: options.db_name,
      dbPort: options.db_port
    });
    fs.writeFileSync(path.join(exportDir, '.env'), envContent, 'utf8');
    fs.writeFileSync(path.join(apiDir, '.env'), envContent, 'utf8');

    // 5. Database SQL schemas
    const mysqlSql = generateMySqlSeed(store, categories, products, pages);
    const postgresSql = generatePostgresSeed(store, categories, products, pages);
    fs.writeFileSync(path.join(dbDir, 'schema-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'seed-mysql.sql'), mysqlSql, 'utf8');
    fs.writeFileSync(path.join(dbDir, 'schema-postgres.sql'), postgresSql, 'utf8');

    // 6. Provider configs
    fs.writeFileSync(path.join(staticDir, '.htaccess'), generateApacheHtaccess(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'vercel.json'), generateVercelJson(), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'railway.toml'), generateRailwayConfig(), 'utf8');

    // 7. README-DEPLOY.md
    const readme = `# Deployment Package: ${store.store_name}

**Target Provider:** ${provider.toUpperCase()}
**Database:** ${dbType.toUpperCase()}
**Generated:** ${new Date().toISOString()}

---

## 📁 Package Contents

- **\`static/\`**: Pre-rendered, ultra-fast static HTML storefront + client admin dashboard + StoreBuilder + assets.
  - **Storefront**: \`/index.html\`, \`/collections/\`, \`/products/\`
  - **Merchant Client Admin**: \`/merchant/dashboard.html\`, \`/merchant/products.html\` (with Stock & Quantity), \`/merchant/categories.html\`, \`/merchant/pages.html\`, \`/merchant/themes.html\`
  - **Visual StoreBuilder**: \`/store-builder/\`
- **\`api/\`**: Standalone production Node.js API server for processing orders, WhatsApp notifications, payment webhooks, and merchant CRUD operations.
- **\`database/\`**: Complete SQL schema & seed files for MySQL (phpMyAdmin) and PostgreSQL with stock quantity columns and seeds.
- **\`.env\`**: Configured environment file with connection strings and production secrets.

---

## 🚀 Quick Deployment Guide

### Option 1: GoDaddy / cPanel / Shared Hosting
1. Upload all contents of \`static/\` to your \`public_html/\` folder via cPanel File Manager or FTP.
2. In cPanel, open **phpMyAdmin**, select your database, and click **Import** -> select \`database/seed-mysql.sql\`.
3. (Optional for dynamic API) In cPanel **Setup Node.js App**, create an app pointing to the \`api/\` directory and run \`npm install\`.
4. Point DNS: Set A Record \`@\` to your server IP, and CNAME \`www\` to your domain.

### Option 2: Vercel
1. Run \`vercel --prod\` inside this folder, or import the GitHub repository into Vercel.
2. Output Directory: \`static\`.
3. Set environment variables in Vercel Project Settings from \`.env\`.

### Option 3: Railway / Docker / VPS
1. Run \`railway up\` or \`docker build -t ${slug}-store .\`.
2. Connect your MySQL or PostgreSQL database.

---

## 💼 Merchant Client Admin & StoreBuilder (Shopify / WordPress Model)

On your custom hosting deployment, manage your autonomous store directly:
- **Merchant Dashboard**: \`http://your-domain.com/merchant/dashboard.html\`
- **Products & Stock Quantity**: \`http://your-domain.com/merchant/products.html\`
- **Categories & Hero Cards**: \`http://your-domain.com/merchant/categories.html\`
- **Content Pages & Legal Policies**: \`http://your-domain.com/merchant/pages.html\`
- **Themes & Customizer**: \`http://your-domain.com/merchant/themes.html\`
- **Live Visual Customizer**: \`http://your-domain.com/store-builder/\`
`;
    fs.writeFileSync(path.join(exportDir, 'README-DEPLOY.md'), readme, 'utf8');

    // 8. Create ZIP archive using PowerShell
    const zipPath = path.join(path.dirname(exportDir), `${slug}-deployment.zip`);
    try {
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${exportDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'ignore' });
      console.log('✅ Created deployment ZIP at:', zipPath);
    } catch (e) {
      console.warn('Could not compress ZIP:', e.message);
    }

    results.push({ exportDir, zipPath });
  }

  return {
    success: true,
    provider,
    dbType,
    customDomain,
    slug,
    export_dir: results[0].exportDir,
    zip_path: results[0].zipPath,
    download_url: `/api/stores/${store.id}/deployment-zip`
  };
}

module.exports = {
  exportStoreDeployment,
  generateEnvFile,
  generateMySqlSeed,
  generatePostgresSeed
};
