-- ============================================================
--  CommercePro — PostgreSQL Database Schema
--  Run: psql -U postgres -d commercepro -f schema.sql
-- ============================================================

-- Create database (run separately as superuser)
-- CREATE DATABASE commercepro;
-- \c commercepro

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text

-- ============================================================
--  ENUMS
-- ============================================================
CREATE TYPE user_role      AS ENUM ('admin','merchant','customer');
CREATE TYPE store_status   AS ENUM ('pending','active','suspended','closed');
CREATE TYPE store_plan     AS ENUM ('starter','growth','enterprise');
CREATE TYPE product_status AS ENUM ('active','draft','out_of_stock','deleted');
CREATE TYPE order_status   AS ENUM ('pending','confirmed','packed','shipped','delivered','returned','cancelled');
CREATE TYPE payment_status AS ENUM ('pending','success','failed','refunded');
CREATE TYPE payment_method AS ENUM ('razorpay','stripe','cashfree','paypal','cod','emi');
CREATE TYPE coupon_type    AS ENUM ('percentage','fixed','free_shipping','buy_x_get_y');
CREATE TYPE coupon_status  AS ENUM ('active','paused','expired','deleted');
CREATE TYPE review_status  AS ENUM ('pending','approved','rejected');
CREATE TYPE sub_status     AS ENUM ('trial','active','past_due','cancelled');

-- ============================================================
--  USERS
-- ============================================================
CREATE TABLE users (
  id                BIGSERIAL     PRIMARY KEY,
  first_name        VARCHAR(80)   NOT NULL,
  last_name         VARCHAR(80)   NOT NULL DEFAULT '',
  email             CITEXT        NOT NULL UNIQUE,
  password_hash     TEXT,                               -- NULL for social-only accounts
  phone             VARCHAR(20),
  avatar_url        TEXT,
  role              user_role     NOT NULL DEFAULT 'customer',
  email_verified    BOOLEAN       NOT NULL DEFAULT FALSE,
  phone_verified    BOOLEAN       NOT NULL DEFAULT FALSE,
  otp_code          VARCHAR(6),
  otp_expires_at    TIMESTAMPTZ,
  reset_token       TEXT,
  reset_token_expires TIMESTAMPTZ,
  google_id         TEXT          UNIQUE,
  last_login        TIMESTAMPTZ,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  metadata          JSONB         NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_phone    ON users(phone);
CREATE INDEX idx_users_google   ON users(google_id);

-- ============================================================
--  STORES
-- ============================================================
CREATE TABLE stores (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(120)  NOT NULL,
  slug            VARCHAR(120)  NOT NULL UNIQUE,
  tagline         VARCHAR(255),
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  domain          VARCHAR(255)  UNIQUE,
  theme           VARCHAR(80)   NOT NULL DEFAULT 'default',
  plan            store_plan    NOT NULL DEFAULT 'starter',
  status          store_status  NOT NULL DEFAULT 'pending',
  country         VARCHAR(3)    NOT NULL DEFAULT 'IND',
  currency        VARCHAR(3)    NOT NULL DEFAULT 'INR',
  timezone        VARCHAR(50)   NOT NULL DEFAULT 'Asia/Kolkata',
  gstin           VARCHAR(15),
  settings        JSONB         NOT NULL DEFAULT '{}',
  product_limit   INT           NOT NULL DEFAULT 100,
  approved_at     TIMESTAMPTZ,
  approved_by     BIGINT        REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_slug    ON stores(slug);
CREATE INDEX idx_stores_status  ON stores(status);
CREATE INDEX idx_stores_domain  ON stores(domain);

-- ============================================================
--  CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          BIGSERIAL     PRIMARY KEY,
  parent_id   BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
  name        VARCHAR(100)  NOT NULL,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  icon        VARCHAR(10),
  sort_order  INT           NOT NULL DEFAULT 0,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  meta_title  VARCHAR(160),
  meta_desc   VARCHAR(320),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug   ON categories(slug);

-- Seed default categories
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Electronics',             'electronics',          '💻', 1),
  ('Mobiles',                 'mobiles',              '📱', 2),
  ('Laptops',                 'laptops',              '💻', 3),
  ('Audio',                   'audio',                '🎧', 4),
  ('Cameras',                 'cameras',              '📷', 5),
  ('Wearables',               'wearables',            '⌚', 6),
  ('Gaming',                  'gaming',               '🎮', 7),
  ('Fashion & Apparel',       'fashion',              '👗', 8),
  ('Grocery & Food',          'grocery',              '🛒', 9),
  ('Beauty & Personal Care',  'beauty',               '💄', 10),
  ('Books & Stationery',      'books',                '📚', 11),
  ('Home & Furniture',        'home-furniture',       '🛋️', 12),
  ('Sports & Fitness',        'sports-fitness',       '⚽', 13),
  ('Toys & Baby',             'toys-baby',            '🧸', 14),
  ('Accessories',             'accessories',          '🔌', 15);

-- Set parent_id for subcategories
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug='electronics')
  WHERE slug IN ('mobiles','laptops','audio','cameras','wearables','gaming','accessories');

-- ============================================================
--  PRODUCTS
-- ============================================================
CREATE TABLE products (
  id              BIGSERIAL       PRIMARY KEY,
  store_id        BIGINT          NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id     BIGINT          REFERENCES categories(id) ON DELETE SET NULL,
  name            VARCHAR(255)    NOT NULL,
  slug            VARCHAR(255)    NOT NULL,
  description     TEXT,
  sku             VARCHAR(80)     NOT NULL,
  barcode         VARCHAR(80),
  price           NUMERIC(12,2)   NOT NULL CHECK (price >= 0),
  sale_price      NUMERIC(12,2)   CHECK (sale_price >= 0),
  cost_price      NUMERIC(12,2)   CHECK (cost_price >= 0),
  stock           INT             NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_alert INT             NOT NULL DEFAULT 10,
  brand           VARCHAR(100),
  tags            TEXT[],
  attributes      JSONB           NOT NULL DEFAULT '{}',  -- {"color":"Black","storage":"256GB"}
  variants        JSONB           NOT NULL DEFAULT '[]',  -- [{sku,price,stock,attributes}]
  weight_grams    INT,
  dimensions      JSONB,          -- {length, width, height, unit}
  is_digital      BOOLEAN         NOT NULL DEFAULT FALSE,
  status          product_status  NOT NULL DEFAULT 'active',
  meta_title      VARCHAR(160),
  meta_desc       VARCHAR(320),
  meta_keywords   TEXT[],
  avg_rating      NUMERIC(3,2)    NOT NULL DEFAULT 0,
  review_count    INT             NOT NULL DEFAULT 0,
  view_count      INT             NOT NULL DEFAULT 0,
  sales_count     INT             NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, sku)
);

CREATE INDEX idx_products_store_id    ON products(store_id);
CREATE INDEX idx_products_category    ON products(category_id);
CREATE INDEX idx_products_status      ON products(status);
CREATE INDEX idx_products_slug        ON products(store_id, slug);
CREATE INDEX idx_products_name_trgm   ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_tags        ON products USING gin(tags);

-- ============================================================
--  PRODUCT IMAGES
-- ============================================================
CREATE TABLE product_images (
  id          BIGSERIAL   PRIMARY KEY,
  product_id  BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  alt_text    VARCHAR(200),
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ============================================================
--  ADDRESSES
-- ============================================================
CREATE TABLE addresses (
  id            BIGSERIAL     PRIMARY KEY,
  user_id       BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(50)   NOT NULL DEFAULT 'Home',  -- Home / Work / Other
  first_name    VARCHAR(80)   NOT NULL,
  last_name     VARCHAR(80)   NOT NULL,
  phone         VARCHAR(20)   NOT NULL,
  line1         TEXT          NOT NULL,
  line2         TEXT,
  city          VARCHAR(100)  NOT NULL,
  state         VARCHAR(100)  NOT NULL,
  pincode       VARCHAR(10)   NOT NULL,
  country       VARCHAR(3)    NOT NULL DEFAULT 'IND',
  is_default    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ============================================================
--  COUPONS
-- ============================================================
CREATE TABLE coupons (
  id                BIGSERIAL     PRIMARY KEY,
  store_id          BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code              VARCHAR(50)   NOT NULL,
  type              coupon_type   NOT NULL DEFAULT 'percentage',
  value             NUMERIC(10,2) NOT NULL,            -- % or fixed ₹ amount
  min_order_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount      NUMERIC(12,2),                     -- cap for percentage coupons
  usage_limit       INT,                               -- NULL = unlimited
  used_count        INT           NOT NULL DEFAULT 0,
  per_user_limit    INT           NOT NULL DEFAULT 1,
  applicable_cats   BIGINT[],                          -- NULL = all categories
  applicable_prods  BIGINT[],                          -- NULL = all products
  status            coupon_status NOT NULL DEFAULT 'active',
  starts_at         TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, code)
);

CREATE INDEX idx_coupons_store  ON coupons(store_id);
CREATE INDEX idx_coupons_code   ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);

-- ============================================================
--  ORDERS
-- ============================================================
CREATE TABLE orders (
  id                BIGSERIAL       PRIMARY KEY,
  order_number      VARCHAR(30)     NOT NULL UNIQUE,  -- ORD-1736294812
  store_id          BIGINT          NOT NULL REFERENCES stores(id),
  customer_id       BIGINT          REFERENCES users(id),
  guest_email       CITEXT,                           -- for guest checkout
  guest_phone       VARCHAR(20),
  subtotal          NUMERIC(14,2)   NOT NULL,
  discount          NUMERIC(14,2)   NOT NULL DEFAULT 0,
  shipping_fee      NUMERIC(10,2)   NOT NULL DEFAULT 0,
  tax               NUMERIC(10,2)   NOT NULL DEFAULT 0,
  total             NUMERIC(14,2)   NOT NULL,
  coupon_code       VARCHAR(50),
  coupon_discount   NUMERIC(10,2)   NOT NULL DEFAULT 0,
  address           JSONB           NOT NULL,         -- snapshot at time of order
  payment_method    payment_method  NOT NULL DEFAULT 'razorpay',
  payment_status    payment_status  NOT NULL DEFAULT 'pending',
  status            order_status    NOT NULL DEFAULT 'pending',
  tracking_number   VARCHAR(100),
  tracking_url      TEXT,
  shipping_partner  VARCHAR(80),
  notes             TEXT,
  cancelled_reason  TEXT,
  invoice_url       TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_store      ON orders(store_id);
CREATE INDEX idx_orders_customer   ON orders(customer_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_created    ON orders(created_at DESC);
CREATE INDEX idx_orders_number     ON orders(order_number);

-- ============================================================
--  ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id            BIGSERIAL     PRIMARY KEY,
  order_id      BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    BIGINT        REFERENCES products(id) ON DELETE SET NULL,
  product_name  VARCHAR(255)  NOT NULL,   -- snapshot
  sku           VARCHAR(80),
  quantity      INT           NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL,
  sale_price    NUMERIC(12,2),
  total_price   NUMERIC(14,2) NOT NULL,
  variant       JSONB         NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================
--  PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id              BIGSERIAL       PRIMARY KEY,
  order_id        BIGINT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gateway         payment_method  NOT NULL,
  amount          NUMERIC(14,2)   NOT NULL,
  currency        VARCHAR(3)      NOT NULL DEFAULT 'INR',
  status          payment_status  NOT NULL DEFAULT 'pending',
  txn_id          VARCHAR(200),       -- gateway transaction ID
  gateway_order_id VARCHAR(200),      -- e.g. Razorpay order_id
  gateway_payload JSONB,              -- full webhook payload
  refund_amount   NUMERIC(14,2)   NOT NULL DEFAULT 0,
  refund_txn_id   VARCHAR(200),
  refunded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order  ON payments(order_id);
CREATE INDEX idx_payments_txn    ON payments(txn_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================
--  REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id            BIGSERIAL       PRIMARY KEY,
  product_id    BIGINT          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id      BIGINT          REFERENCES orders(id),
  rating        SMALLINT        NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text   TEXT,
  images        JSONB           NOT NULL DEFAULT '[]',
  helpful_count INT             NOT NULL DEFAULT 0,
  status        review_status   NOT NULL DEFAULT 'pending',
  reply         TEXT,           -- merchant reply
  replied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)   -- one review per product per user
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user    ON reviews(user_id);
CREATE INDEX idx_reviews_status  ON reviews(status);

-- ============================================================
--  WISHLISTS
-- ============================================================
CREATE TABLE wishlists (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_wishlists_user    ON wishlists(user_id);
CREATE INDEX idx_wishlists_product ON wishlists(product_id);

-- ============================================================
--  INVENTORY LOG
-- ============================================================
CREATE TABLE inventory_log (
  id            BIGSERIAL   PRIMARY KEY,
  product_id    BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id      BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  change_type   VARCHAR(30) NOT NULL,  -- 'sale','restock','adjustment','return'
  quantity      INT         NOT NULL,  -- positive = added, negative = deducted
  prev_stock    INT         NOT NULL,
  new_stock     INT         NOT NULL,
  reference_id  BIGINT,               -- order_id or manual entry
  notes         TEXT,
  created_by    BIGINT      REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_product ON inventory_log(product_id);
CREATE INDEX idx_inventory_store   ON inventory_log(store_id);

-- ============================================================
--  SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  id                BIGSERIAL   PRIMARY KEY,
  store_id          BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan              store_plan  NOT NULL,
  status            sub_status  NOT NULL DEFAULT 'trial',
  amount            NUMERIC(10,2) NOT NULL,
  currency          VARCHAR(3)  NOT NULL DEFAULT 'INR',
  billing_cycle     VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly / yearly
  trial_ends_at     TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  gateway_sub_id    VARCHAR(200),     -- Razorpay subscription ID
  cancel_at_period  BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_store  ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================================
--  ANALYTICS EVENTS
-- ============================================================
CREATE TABLE analytics_events (
  id          BIGSERIAL   PRIMARY KEY,
  store_id    BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type  VARCHAR(50) NOT NULL,   -- 'page_view','product_view','add_to_cart','purchase'
  session_id  VARCHAR(100),
  user_id     BIGINT      REFERENCES users(id),
  product_id  BIGINT      REFERENCES products(id),
  order_id    BIGINT      REFERENCES orders(id),
  page_url    TEXT,
  referrer    TEXT,
  utm_source  VARCHAR(100),
  utm_medium  VARCHAR(100),
  utm_campaign VARCHAR(100),
  device_type VARCHAR(20),  -- 'mobile','tablet','desktop'
  country     VARCHAR(3),
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_store   ON analytics_events(store_id);
CREATE INDEX idx_analytics_type    ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);

-- ============================================================
--  SHIPPING RULES
-- ============================================================
CREATE TABLE shipping_rules (
  id              BIGSERIAL     PRIMARY KEY,
  store_id        BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name            VARCHAR(100)  NOT NULL,
  partner         VARCHAR(50),          -- 'delhivery','bluedart','dtdc','self'
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_order_value NUMERIC(12,2),
  min_weight_grams INT,
  max_weight_grams INT,
  flat_rate       NUMERIC(8,2)  NOT NULL DEFAULT 0,  -- 0 = free
  zones           TEXT[],               -- ['IN-MH','IN-DL'] or ['ALL']
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_store ON shipping_rules(store_id);

-- ============================================================
--  NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id          BIGSERIAL     PRIMARY KEY,
  user_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(60)   NOT NULL,   -- 'order_update','low_stock','new_review','payment_failed'
  title       VARCHAR(200)  NOT NULL,
  body        TEXT,
  link        TEXT,
  is_read     BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata    JSONB         NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user   ON notifications(user_id);
CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE is_read = FALSE;

-- ============================================================
--  TRIGGERS — auto update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users','stores','products','orders','payments','coupons','reviews','subscriptions'] LOOP
    EXECUTE format('
      CREATE TRIGGER trg_updated_at_%s
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
--  TRIGGER — auto update product avg_rating
-- ============================================================
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products SET
    avg_rating   = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved'),
    review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved')
  WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_product_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- ============================================================
--  TRIGGER — auto log inventory changes
-- ============================================================
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO inventory_log (product_id, store_id, change_type, quantity, prev_stock, new_stock)
    VALUES (NEW.id, NEW.store_id,
      CASE WHEN NEW.stock > OLD.stock THEN 'restock' ELSE 'sale' END,
      NEW.stock - OLD.stock, OLD.stock, NEW.stock);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_inventory_log
AFTER UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION log_inventory_change();

-- ============================================================
--  VIEWS — handy pre-built queries
-- ============================================================

-- Store dashboard summary
CREATE OR REPLACE VIEW v_store_summary AS
SELECT
  s.id                  AS store_id,
  s.name                AS store_name,
  s.plan,
  s.status,
  COUNT(DISTINCT p.id)  AS total_products,
  COUNT(DISTINCT o.id)  AS total_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0) AS total_revenue,
  COALESCE(AVG(o.total) FILTER (WHERE o.status != 'cancelled'), 0) AS avg_order_value,
  COUNT(DISTINCT o.customer_id)  AS unique_customers
FROM stores s
LEFT JOIN products p ON p.store_id = s.id AND p.status != 'deleted'
LEFT JOIN orders   o ON o.store_id = s.id
GROUP BY s.id;

-- Platform-wide admin view
CREATE OR REPLACE VIEW v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM stores  WHERE status = 'active')   AS active_stores,
  (SELECT COUNT(*) FROM users   WHERE role = 'customer')   AS total_customers,
  (SELECT COUNT(*) FROM orders)                            AS total_orders,
  (SELECT COALESCE(SUM(total),0) FROM orders WHERE status != 'cancelled') AS platform_gmv,
  (SELECT COUNT(*) FROM stores WHERE status = 'pending')   AS pending_approvals,
  (SELECT COUNT(*) FROM products WHERE status = 'active')  AS active_products;

-- Low stock report
CREATE OR REPLACE VIEW v_low_stock AS
SELECT
  p.id, p.name, p.sku, p.stock, p.low_stock_alert,
  s.id AS store_id, s.name AS store_name,
  u.email AS merchant_email
FROM products p
JOIN stores s ON p.store_id = s.id
JOIN users  u ON s.user_id  = u.id
WHERE p.stock <= p.low_stock_alert AND p.status = 'active'
ORDER BY p.stock ASC;

-- ============================================================
--  SEED DATA — Super Admin
-- ============================================================
-- Password: admin1234  (bcrypt hash)
INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified) VALUES
('Super', 'Admin', 'admin@commercepro.in',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsuQsBYhjaRm3.LMnMhJ0.c8Q4Bm',
 'admin', TRUE);

-- Demo merchant
INSERT INTO users (first_name, last_name, email, password_hash, role, email_verified, phone) VALUES
('Rahul', 'Kumar', 'merchant@demo.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsuQsBYhjaRm3.LMnMhJ0.c8Q4Bm',
 'merchant', TRUE, '9876543210');

-- Demo store
INSERT INTO stores (user_id, name, slug, tagline, plan, status, approved_at)
VALUES (
  (SELECT id FROM users WHERE email = 'merchant@demo.com'),
  'TechZone', 'techzone', 'India''s best tech deals',
  'growth', 'active', NOW()
);

-- Demo products
INSERT INTO products (store_id, category_id, name, slug, sku, price, sale_price, stock, brand, status)
SELECT
  s.id,
  c.id,
  p.name, p.slug, p.sku, p.price, p.sale_price, p.stock, p.brand, 'active'
FROM stores s, (VALUES
  ('iPhone 17 Pro 256GB',  'iphone-17-pro',   'IP17P-256',  89999, 84999,  24, 'Apple',   (SELECT id FROM categories WHERE slug='mobiles')),
  ('MacBook Air M4 8GB',   'macbook-air-m4',  'MBA-M4-8',  119900,  NULL,   5, 'Apple',   (SELECT id FROM categories WHERE slug='laptops')),
  ('Sony WH-1000XM6',      'sony-wh-1000xm6', 'SONY-WH6',  19990, 17990,  48, 'Sony',    (SELECT id FROM categories WHERE slug='audio')),
  ('Galaxy S25 Ultra 512GB','galaxy-s25-ultra','SAM-S25U',  111999,104999,   0, 'Samsung', (SELECT id FROM categories WHERE slug='mobiles')),
  ('Apple Watch Ultra 3',  'apple-watch-u3',  'APL-WU3',   89900, 84900,   8, 'Apple',   (SELECT id FROM categories WHERE slug='wearables'))
) AS p(name, slug, sku, price, sale_price, stock, brand, cat_id)
JOIN categories c ON c.id = p.cat_id
WHERE s.slug = 'techzone';

-- ============================================================
--  INDEXES FOR PERFORMANCE TUNING
-- ============================================================
-- Composite indexes for common query patterns
CREATE INDEX idx_orders_store_status_date ON orders(store_id, status, created_at DESC);
CREATE INDEX idx_products_store_status    ON products(store_id, status);
CREATE INDEX idx_order_items_order_prod   ON order_items(order_id, product_id);
CREATE INDEX idx_analytics_store_type_date ON analytics_events(store_id, event_type, created_at DESC);

-- Partial index for pending approvals (frequent admin query)
CREATE INDEX idx_stores_pending ON stores(created_at DESC) WHERE status = 'pending';

-- Partial index for active coupons
CREATE INDEX idx_coupons_active ON coupons(store_id, code) WHERE status = 'active';

-- Full text search on products
CREATE INDEX idx_products_fts ON products USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description,'') || ' ' || COALESCE(brand,''))
);

ANALYZE;

-- ============================================================
--  DONE
-- ============================================================
-- Tables created: users, stores, categories, products, product_images,
--   addresses, coupons, orders, order_items, payments, reviews,
--   wishlists, inventory_log, subscriptions, analytics_events,
--   shipping_rules, notifications
-- Views: v_store_summary, v_platform_stats, v_low_stock
-- Triggers: updated_at, product rating, inventory log
-- Seed: admin + demo merchant + TechZone store + 5 products
