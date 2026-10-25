-- ================================================================
-- ZKCommerce v4.1 -- MASTER DATABASE MIGRATION (Windows-safe)
-- Run via pgAdmin or run-migration-windows.bat
-- No emojis. Pure ASCII. UTF-8 safe.
-- ================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Drop all tables cleanly (safe on fresh DB)
DROP TABLE IF EXISTS whatsapp_templates    CASCADE;
DROP TABLE IF EXISTS blog_posts            CASCADE;
DROP TABLE IF EXISTS flash_sales           CASCADE;
DROP TABLE IF EXISTS abandoned_carts       CASCADE;
DROP TABLE IF EXISTS store_seo             CASCADE;
DROP TABLE IF EXISTS audit_log             CASCADE;
DROP TABLE IF EXISTS store_staff           CASCADE;
DROP TABLE IF EXISTS payouts               CASCADE;
DROP TABLE IF EXISTS returns               CASCADE;
DROP TABLE IF EXISTS campaign_recipients   CASCADE;
DROP TABLE IF EXISTS campaigns             CASCADE;
DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS warehouse_stock       CASCADE;
DROP TABLE IF EXISTS warehouses            CASCADE;
DROP TABLE IF EXISTS product_variants      CASCADE;
DROP TABLE IF EXISTS loyalty_points        CASCADE;
DROP TABLE IF EXISTS invoices              CASCADE;
DROP TABLE IF EXISTS cart_items            CASCADE;
DROP TABLE IF EXISTS carts                 CASCADE;
DROP TABLE IF EXISTS analytics_events      CASCADE;
DROP TABLE IF EXISTS shipping_rules        CASCADE;
DROP TABLE IF EXISTS notifications         CASCADE;
DROP TABLE IF EXISTS inventory_log         CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS wishlists             CASCADE;
DROP TABLE IF EXISTS reviews               CASCADE;
DROP TABLE IF EXISTS payments              CASCADE;
DROP TABLE IF EXISTS order_items           CASCADE;
DROP TABLE IF EXISTS orders                CASCADE;
DROP TABLE IF EXISTS coupons               CASCADE;
DROP TABLE IF EXISTS addresses             CASCADE;
DROP TABLE IF EXISTS product_images        CASCADE;
DROP TABLE IF EXISTS products              CASCADE;
DROP TABLE IF EXISTS categories            CASCADE;
DROP TABLE IF EXISTS stores                CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;

DROP VIEW IF EXISTS v_order_gst_summary CASCADE;
DROP VIEW IF EXISTS v_loyalty_balance   CASCADE;
DROP VIEW IF EXISTS v_low_stock         CASCADE;
DROP VIEW IF EXISTS v_platform_stats    CASCADE;
DROP VIEW IF EXISTS v_store_summary     CASCADE;

DROP FUNCTION IF EXISTS trigger_set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_product_rating()  CASCADE;

-- ================================================================
-- USERS
-- ================================================================
CREATE TABLE users (
  id                  BIGSERIAL    PRIMARY KEY,
  name                VARCHAR(160) NOT NULL,
  email               CITEXT       NOT NULL UNIQUE,
  phone               VARCHAR(20),
  password_hash       TEXT,
  role                VARCHAR(20)  NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('admin','merchant','customer')),
  store_id            BIGINT,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  email_verified      BOOLEAN      NOT NULL DEFAULT FALSE,
  google_id           VARCHAR(200),
  avatar_url          TEXT,
  reset_token         TEXT,
  reset_token_expires TIMESTAMPTZ,
  last_login          TIMESTAMPTZ,
  metadata            JSONB        NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);
CREATE INDEX idx_users_phone ON users(phone);

-- ================================================================
-- STORES
-- ================================================================
CREATE TABLE stores (
  id            BIGSERIAL    PRIMARY KEY,
  user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  slug          VARCHAR(120) NOT NULL UNIQUE,
  tagline       VARCHAR(255),
  description   TEXT,
  logo_url      TEXT,
  banner_url    TEXT,
  theme         VARCHAR(80)  NOT NULL DEFAULT 'sunrise',
  primary_color VARCHAR(7)   NOT NULL DEFAULT '#FF6B00',
  plan          VARCHAR(20)  NOT NULL DEFAULT 'starter'
                  CHECK (plan IN ('starter','growth','enterprise')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('pending','active','suspended','closed')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  country       VARCHAR(3)   NOT NULL DEFAULT 'IND',
  currency      VARCHAR(3)   NOT NULL DEFAULT 'INR',
  timezone      VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
  gstin         VARCHAR(15),
  address       TEXT,
  whatsapp      VARCHAR(20),
  domain        VARCHAR(255),
  product_limit INT          NOT NULL DEFAULT 100,
  trial_ends_at TIMESTAMPTZ,
  settings      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_slug    ON stores(slug);
CREATE INDEX idx_stores_status  ON stores(status);

ALTER TABLE users ADD CONSTRAINT fk_users_store
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ================================================================
-- CATEGORIES
-- ================================================================
CREATE TABLE categories (
  id          BIGSERIAL    PRIMARY KEY,
  store_id    BIGINT       REFERENCES stores(id) ON DELETE CASCADE,
  parent_id   BIGINT       REFERENCES categories(id) ON DELETE SET NULL,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description TEXT,
  image_url   TEXT,
  icon        VARCHAR(50),
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_store  ON categories(store_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug   ON categories(slug);

-- ================================================================
-- PRODUCTS
-- ================================================================
CREATE TABLE products (
  id              BIGSERIAL      PRIMARY KEY,
  store_id        BIGINT         NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id     BIGINT         REFERENCES categories(id) ON DELETE SET NULL,
  name            VARCHAR(255)   NOT NULL,
  slug            VARCHAR(255),
  description     TEXT,
  sku             VARCHAR(100),
  barcode         VARCHAR(100),
  price           NUMERIC(12,2)  NOT NULL CHECK (price >= 0),
  mrp             NUMERIC(12,2),
  sale_price      NUMERIC(12,2),
  cost_price      NUMERIC(12,2),
  gst_rate        VARCHAR(3)     NOT NULL DEFAULT '12',
  stock           INT            NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_alert INT            NOT NULL DEFAULT 5,
  brand           VARCHAR(100),
  weight_kg       NUMERIC(8,3),
  is_cod          BOOLEAN        NOT NULL DEFAULT TRUE,
  is_featured     BOOLEAN        NOT NULL DEFAULT FALSE,
  is_digital      BOOLEAN        NOT NULL DEFAULT FALSE,
  status          VARCHAR(20)    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('published','draft','archived')),
  seo_title       VARCHAR(70),
  seo_desc        VARCHAR(170),
  tags            TEXT[],
  attributes      JSONB          NOT NULL DEFAULT '{}',
  avg_rating      NUMERIC(3,2)   NOT NULL DEFAULT 0,
  review_count    INT            NOT NULL DEFAULT 0,
  sales_count     INT            NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_store_id  ON products(store_id);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_status    ON products(store_id, status);
CREATE INDEX idx_products_slug      ON products(store_id, slug);
CREATE INDEX idx_products_featured  ON products(store_id, is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_fts ON products USING gin(
  to_tsvector('english',
    name || ' ' || COALESCE(description,'') || ' ' || COALESCE(brand,''))
);

-- ================================================================
-- PRODUCT IMAGES
-- ================================================================
CREATE TABLE product_images (
  id          BIGSERIAL   PRIMARY KEY,
  product_id  BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  alt_text    VARCHAR(200),
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);

-- ================================================================
-- PRODUCT VARIANTS
-- ================================================================
CREATE TABLE product_variants (
  id          BIGSERIAL    PRIMARY KEY,
  product_id  BIGINT       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        VARCHAR(200),
  sku         VARCHAR(100),
  attributes  JSONB        NOT NULL DEFAULT '{}',
  price       NUMERIC(12,2),
  stock       INT          NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pv_product ON product_variants(product_id);

-- ================================================================
-- ADDRESSES
-- ================================================================
CREATE TABLE addresses (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  line1       TEXT         NOT NULL,
  line2       TEXT,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  pincode     VARCHAR(10)  NOT NULL,
  country     VARCHAR(3)   NOT NULL DEFAULT 'IND',
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ================================================================
-- COUPONS
-- ================================================================
CREATE TABLE coupons (
  id             BIGSERIAL     PRIMARY KEY,
  store_id       BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code           VARCHAR(50)   NOT NULL,
  type           VARCHAR(30)   NOT NULL DEFAULT 'percentage'
                   CHECK (type IN ('percentage','fixed','free_shipping','bogo')),
  value          NUMERIC(10,2) NOT NULL,
  min_order      NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount   NUMERIC(12,2),
  max_uses       INT,
  used_count     INT           NOT NULL DEFAULT 0,
  per_user_limit INT           NOT NULL DEFAULT 1,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  description    TEXT,
  starts_at      TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, code)
);

CREATE INDEX idx_coupons_store  ON coupons(store_id);
CREATE INDEX idx_coupons_code   ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(store_id, code) WHERE is_active = TRUE;

-- ================================================================
-- ORDERS
-- ================================================================
CREATE TABLE orders (
  id                  BIGSERIAL     PRIMARY KEY,
  user_id             BIGINT        NOT NULL REFERENCES users(id),
  store_id            BIGINT        NOT NULL REFERENCES stores(id),
  address_id          BIGINT        REFERENCES addresses(id),
  coupon_id           BIGINT        REFERENCES coupons(id),
  status              VARCHAR(30)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending','processing','packed','shipped',
                          'delivered','cancelled','refunded',
                          'return_requested','return_approved','return_rejected'
                        )),
  payment_method      VARCHAR(30)   NOT NULL DEFAULT 'razorpay',
  payment_status      VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
  subtotal            NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  coupon_discount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  loyalty_discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total               NUMERIC(14,2) NOT NULL DEFAULT 0,
  razorpay_order_id   VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  awb_number          VARCHAR(100),
  courier             VARCHAR(80),
  tracking_url        TEXT,
  notes               TEXT,
  cancelled_reason    TEXT,
  invoice_url         TEXT,
  paid_at             TIMESTAMPTZ,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_store        ON orders(store_id);
CREATE INDEX idx_orders_user         ON orders(user_id);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_orders_payment      ON orders(payment_status);
CREATE INDEX idx_orders_created      ON orders(created_at DESC);
CREATE INDEX idx_orders_razorpay     ON orders(razorpay_order_id);
CREATE INDEX idx_orders_store_status ON orders(store_id, status, created_at DESC);

-- ================================================================
-- ORDER ITEMS
-- ================================================================
CREATE TABLE order_items (
  id           BIGSERIAL     PRIMARY KEY,
  order_id     BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   BIGINT        REFERENCES products(id) ON DELETE SET NULL,
  variant_id   BIGINT        REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name VARCHAR(255)  NOT NULL,
  sku          VARCHAR(100),
  quantity     INT           NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12,2) NOT NULL,
  gst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(14,2) NOT NULL,
  variant_data JSONB         NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ================================================================
-- PAYMENTS
-- ================================================================
CREATE TABLE payments (
  id                  BIGSERIAL     PRIMARY KEY,
  order_id            BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method              VARCHAR(30)   NOT NULL,
  amount              NUMERIC(14,2) NOT NULL,
  currency            VARCHAR(3)    NOT NULL DEFAULT 'INR',
  status              VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','success','failed','refunded')),
  razorpay_order_id   VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  gateway_payload     JSONB,
  refund_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_txn_id       VARCHAR(200),
  refunded_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order    ON payments(order_id);
CREATE INDEX idx_payments_razorpay ON payments(razorpay_payment_id);
CREATE INDEX idx_payments_status   ON payments(status);

-- ================================================================
-- REVIEWS
-- ================================================================
CREATE TABLE reviews (
  id           BIGSERIAL   PRIMARY KEY,
  product_id   BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id     BIGINT      REFERENCES orders(id),
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        VARCHAR(200),
  body         TEXT,
  images       JSONB       NOT NULL DEFAULT '[]',
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','flagged')),
  reply        TEXT,
  replied_at   TIMESTAMPTZ,
  moderated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id, status);
CREATE INDEX idx_reviews_user    ON reviews(user_id);

-- ================================================================
-- WISHLISTS
-- ================================================================
CREATE TABLE wishlists (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_wishlists_user    ON wishlists(user_id);
CREATE INDEX idx_wishlists_product ON wishlists(product_id);

-- ================================================================
-- INVENTORY LOG
-- ================================================================
CREATE TABLE inventory_log (
  id         BIGSERIAL   PRIMARY KEY,
  product_id BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id   BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  change     INT         NOT NULL,
  reason     VARCHAR(100),
  order_id   BIGINT      REFERENCES orders(id),
  created_by BIGINT      REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_product ON inventory_log(product_id);
CREATE INDEX idx_inventory_store   ON inventory_log(store_id);

-- ================================================================
-- SUBSCRIPTIONS
-- ================================================================
CREATE TABLE subscriptions (
  id                   BIGSERIAL    PRIMARY KEY,
  store_id             BIGINT       NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan                 VARCHAR(20)  NOT NULL,
  status               VARCHAR(20)  NOT NULL DEFAULT 'trial'
                         CHECK (status IN ('trial','active','past_due','cancelled')),
  amount               NUMERIC(10,2) NOT NULL,
  currency             VARCHAR(3)   NOT NULL DEFAULT 'INR',
  billing_cycle        VARCHAR(20)  NOT NULL DEFAULT 'monthly',
  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  gateway_sub_id       VARCHAR(200),
  cancel_at_period     BOOLEAN      NOT NULL DEFAULT FALSE,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_store  ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ================================================================
-- SUBSCRIPTION INVOICES
-- ================================================================
CREATE TABLE subscription_invoices (
  id              BIGSERIAL     PRIMARY KEY,
  store_id        BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id BIGINT        REFERENCES subscriptions(id),
  amount          NUMERIC(10,2) NOT NULL,
  currency        VARCHAR(3)    NOT NULL DEFAULT 'INR',
  status          VARCHAR(20)   NOT NULL DEFAULT 'paid',
  invoice_url     TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sub_invoices_store ON subscription_invoices(store_id);

-- ================================================================
-- ANALYTICS EVENTS
-- ================================================================
CREATE TABLE analytics_events (
  id          BIGSERIAL   PRIMARY KEY,
  store_id    BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type  VARCHAR(50) NOT NULL,
  entity_id   BIGINT,
  session_id  VARCHAR(100),
  user_id     BIGINT      REFERENCES users(id),
  device_type VARCHAR(20),
  utm_source  VARCHAR(100),
  utm_medium  VARCHAR(100),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_store   ON analytics_events(store_id);
CREATE INDEX idx_analytics_type    ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(store_id, created_at DESC);

-- ================================================================
-- SHIPPING RULES
-- ================================================================
CREATE TABLE shipping_rules (
  id              BIGSERIAL     PRIMARY KEY,
  store_id        BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name            VARCHAR(100)  NOT NULL,
  partner         VARCHAR(50),
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  flat_rate       NUMERIC(8,2)  NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_store ON shipping_rules(store_id);

-- ================================================================
-- NOTIFICATIONS
-- ================================================================
CREATE TABLE notifications (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(60)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  link       TEXT,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  metadata   JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user   ON notifications(user_id);
CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE is_read = FALSE;

-- ================================================================
-- CARTS
-- ================================================================
CREATE TABLE carts (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      REFERENCES users(id) ON DELETE CASCADE,
  store_id    BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  guest_token VARCHAR(64),
  coupon_code VARCHAR(50),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_carts_user_store
  ON carts(user_id, store_id) WHERE user_id IS NOT NULL;

-- ================================================================
-- CART ITEMS
-- ================================================================
CREATE TABLE cart_items (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    BIGINT      REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT      REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INT         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id, variant_id)
);

CREATE INDEX idx_cart_items_user    ON cart_items(user_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

-- ================================================================
-- LOYALTY POINTS
-- ================================================================
CREATE TABLE loyalty_points (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id    BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  points      INT         NOT NULL,
  type        VARCHAR(30) NOT NULL DEFAULT 'earned'
                CHECK (type IN ('earned','redeemed','expired','adjusted')),
  order_id    BIGINT      REFERENCES orders(id),
  description VARCHAR(200),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loyalty_user_store ON loyalty_points(user_id, store_id);
CREATE INDEX idx_loyalty_order      ON loyalty_points(order_id);

-- ================================================================
-- INVOICES
-- ================================================================
CREATE TABLE invoices (
  id             BIGSERIAL     PRIMARY KEY,
  order_id       BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id       BIGINT        NOT NULL REFERENCES stores(id),
  invoice_number VARCHAR(50)   NOT NULL UNIQUE,
  subtotal       NUMERIC(14,2) NOT NULL,
  cgst           NUMERIC(10,2) NOT NULL DEFAULT 0,
  sgst           NUMERIC(10,2) NOT NULL DEFAULT 0,
  igst           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL,
  pdf_url        TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_store ON invoices(store_id);

-- ================================================================
-- WAREHOUSES
-- ================================================================
CREATE TABLE warehouses (
  id         BIGSERIAL    PRIMARY KEY,
  store_id   BIGINT       NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  address    TEXT,
  city       VARCHAR(100),
  pincode    VARCHAR(10),
  is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warehouses_store ON warehouses(store_id);

-- ================================================================
-- WAREHOUSE STOCK
-- ================================================================
CREATE TABLE warehouse_stock (
  id           BIGSERIAL   PRIMARY KEY,
  warehouse_id BIGINT      NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id   BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock        INT         NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX idx_ws_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX idx_ws_product   ON warehouse_stock(product_id);

-- ================================================================
-- CAMPAIGNS
-- ================================================================
CREATE TABLE campaigns (
  id           BIGSERIAL    PRIMARY KEY,
  store_id     BIGINT       NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'email'
                 CHECK (type IN ('email','whatsapp','sms')),
  subject      VARCHAR(300),
  content      TEXT,
  audience     JSONB        NOT NULL DEFAULT '{}',
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','scheduled','sent','cancelled')),
  sent_count   INT          NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_store ON campaigns(store_id);

-- ================================================================
-- CAMPAIGN RECIPIENTS
-- ================================================================
CREATE TABLE campaign_recipients (
  id          BIGSERIAL   PRIMARY KEY,
  campaign_id BIGINT      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','sent','opened','clicked','bounced')),
  sent_at     TIMESTAMPTZ,
  opened_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX idx_cr_campaign ON campaign_recipients(campaign_id);

-- ================================================================
-- RETURNS
-- ================================================================
CREATE TABLE returns (
  id               BIGSERIAL    PRIMARY KEY,
  order_id         BIGINT       NOT NULL REFERENCES orders(id),
  store_id         BIGINT       NOT NULL REFERENCES stores(id),
  user_id          BIGINT       NOT NULL REFERENCES users(id),
  reason           VARCHAR(100) NOT NULL,
  description      TEXT,
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','picked_up','refunded')),
  refund_amount    NUMERIC(12,2),
  rejection_reason TEXT,
  pickup_awb       VARCHAR(50),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_returns_store ON returns(store_id);
CREATE INDEX idx_returns_order ON returns(order_id);

-- ================================================================
-- PAYOUTS
-- ================================================================
CREATE TABLE payouts (
  id                 BIGSERIAL     PRIMARY KEY,
  store_id           BIGINT        NOT NULL REFERENCES stores(id),
  amount             NUMERIC(12,2) NOT NULL,
  order_count        INT           NOT NULL DEFAULT 0,
  period_start       DATE,
  period_end         DATE,
  status             VARCHAR(20)   NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','settled','failed')),
  utr                VARCHAR(50),
  bank_account       VARCHAR(30),
  razorpay_payout_id VARCHAR(100),
  settled_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_store ON payouts(store_id);

-- ================================================================
-- STORE STAFF
-- ================================================================
CREATE TABLE store_staff (
  id           BIGSERIAL   PRIMARY KEY,
  store_id     BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(30) NOT NULL DEFAULT 'support'
                 CHECK (role IN ('owner','manager','warehouse','support','custom')),
  permissions  JSONB       NOT NULL DEFAULT '{}',
  invite_token VARCHAR(100),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','active','suspended')),
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  UNIQUE(store_id, user_id)
);

CREATE INDEX idx_staff_store ON store_staff(store_id);

-- ================================================================
-- AUDIT LOG
-- ================================================================
CREATE TABLE audit_log (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     BIGINT       REFERENCES users(id),
  store_id    BIGINT       REFERENCES stores(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   BIGINT,
  ip_address  INET,
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_store ON audit_log(store_id, created_at DESC);
CREATE INDEX idx_audit_user  ON audit_log(user_id,  created_at DESC);

-- ================================================================
-- STORE SEO
-- ================================================================
CREATE TABLE store_seo (
  id                  BIGSERIAL   PRIMARY KEY,
  store_id            BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
  title               VARCHAR(70),
  description         VARCHAR(170),
  keywords            TEXT,
  og_image_url        TEXT,
  google_analytics_id VARCHAR(20),
  facebook_pixel_id   VARCHAR(20),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- ABANDONED CARTS
-- ================================================================
CREATE TABLE abandoned_carts (
  id               BIGSERIAL     PRIMARY KEY,
  user_id          BIGINT        REFERENCES users(id) ON DELETE CASCADE,
  store_id         BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cart_data        JSONB         NOT NULL DEFAULT '{}',
  total            NUMERIC(12,2),
  recovery_sent_at TIMESTAMPTZ,
  recovered        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_abandoned_store ON abandoned_carts(store_id);

-- ================================================================
-- FLASH SALES
-- ================================================================
CREATE TABLE flash_sales (
  id           BIGSERIAL    PRIMARY KEY,
  store_id     BIGINT       NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         VARCHAR(200),
  discount_pct INT          NOT NULL CHECK (discount_pct BETWEEN 1 AND 90),
  starts_at    TIMESTAMPTZ  NOT NULL,
  ends_at      TIMESTAMPTZ  NOT NULL,
  product_ids  BIGINT[],
  is_active    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flash_store ON flash_sales(store_id);

-- ================================================================
-- BLOG POSTS
-- ================================================================
CREATE TABLE blog_posts (
  id           BIGSERIAL    PRIMARY KEY,
  store_id     BIGINT       NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  author_id    BIGINT       REFERENCES users(id),
  title        VARCHAR(300) NOT NULL,
  slug         VARCHAR(300),
  content      TEXT,
  excerpt      TEXT,
  cover_image  TEXT,
  seo_title    VARCHAR(70),
  seo_desc     VARCHAR(170),
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_store  ON blog_posts(store_id);
CREATE INDEX idx_blog_status ON blog_posts(store_id, status);

-- ================================================================
-- WHATSAPP TEMPLATES
-- ================================================================
CREATE TABLE whatsapp_templates (
  id          BIGSERIAL    PRIMARY KEY,
  store_id    BIGINT       REFERENCES stores(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(50)  NOT NULL,
  template_id VARCHAR(100),
  body        TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','stores','products','orders','payments',
    'coupons','reviews','subscriptions','campaigns','product_variants','cart_items'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_upd_%s ON %s;
       CREATE TRIGGER trg_upd_%s
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products SET
    avg_rating   = (
      SELECT COALESCE(ROUND(AVG(rating::NUMERIC), 2), 0)
      FROM reviews
      WHERE product_id = NEW.product_id AND status = 'approved'
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE product_id = NEW.product_id AND status = 'approved'
    )
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_rating ON reviews;
CREATE TRIGGER trg_product_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- ================================================================
-- VIEWS
-- ================================================================
CREATE OR REPLACE VIEW v_store_summary AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.plan,
  s.status,
  s.is_active,
  u.email  AS owner_email,
  u.phone  AS owner_phone,
  COUNT(DISTINCT p.id) AS product_count,
  COUNT(DISTINCT o.id) AS order_count,
  COALESCE(SUM(o.total)
    FILTER (WHERE o.status NOT IN ('cancelled','pending')), 0) AS total_gmv,
  COALESCE(ROUND(AVG(o.total)
    FILTER (WHERE o.status NOT IN ('cancelled','pending')), 2), 0) AS avg_order_value
FROM stores s
JOIN users u ON u.id = s.user_id
LEFT JOIN products p ON p.store_id = s.id AND p.status = 'published'
LEFT JOIN orders   o ON o.store_id = s.id
GROUP BY s.id, u.email, u.phone;

CREATE OR REPLACE VIEW v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM stores  WHERE is_active = TRUE)   AS active_stores,
  (SELECT COUNT(*) FROM users   WHERE role = 'customer')  AS total_customers,
  (SELECT COUNT(*) FROM orders)                           AS total_orders,
  (SELECT COALESCE(SUM(total), 0) FROM orders
   WHERE status NOT IN ('cancelled','pending'))            AS platform_gmv,
  (SELECT COUNT(*) FROM products WHERE status = 'published') AS active_products;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT
  p.id,
  p.name,
  p.sku,
  p.stock,
  p.low_stock_alert,
  s.id   AS store_id,
  s.name AS store_name,
  u.email AS merchant_email
FROM products p
JOIN stores s ON p.store_id = s.id
JOIN users  u ON s.user_id  = u.id
WHERE p.stock <= p.low_stock_alert
  AND p.status = 'published'
ORDER BY p.stock ASC;

CREATE OR REPLACE VIEW v_loyalty_balance AS
SELECT
  user_id,
  store_id,
  COALESCE(SUM(points), 0) AS balance,
  ROUND(COALESCE(SUM(points), 0) * 0.5, 2) AS worth_inr,
  CASE
    WHEN COALESCE(SUM(points), 0) >= 25000 THEN 'Gold'
    WHEN COALESCE(SUM(points), 0) >= 5000  THEN 'Silver'
    ELSE 'Bronze'
  END AS tier
FROM loyalty_points
GROUP BY user_id, store_id;

CREATE OR REPLACE VIEW v_order_gst_summary AS
SELECT
  store_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*)                         AS invoice_count,
  SUM(subtotal - discount)         AS taxable_value,
  SUM(gst_amount) / 2              AS total_cgst,
  SUM(gst_amount) / 2              AS total_sgst,
  SUM(total)                       AS total_revenue
FROM orders
WHERE status NOT IN ('cancelled','pending')
GROUP BY store_id, DATE_TRUNC('month', created_at);

-- ================================================================
-- SEED DATA
-- All accounts use password: demo1234
-- Bcrypt hash (12 rounds) of "demo1234"
-- ================================================================

INSERT INTO users
  (name, email, phone, password_hash, role, is_active, email_verified, created_at)
VALUES
  ('ZK Admin',
   'admin@zkcommerce.in',
   '9000012345',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsuQsBYhjaRm3.LMnMhJ0.c8Q4Bm',
   'admin', TRUE, TRUE, NOW()),

  ('Rajan Kumar',
   'merchant@zkcommerce.in',
   '9876543210',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsuQsBYhjaRm3.LMnMhJ0.c8Q4Bm',
   'merchant', TRUE, TRUE, NOW()),

  ('Priya Nair',
   'customer@zkcommerce.in',
   '9123456789',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsuQsBYhjaRm3.LMnMhJ0.c8Q4Bm',
   'customer', TRUE, TRUE, NOW());

-- Demo store
INSERT INTO stores
  (user_id, name, slug, tagline, plan, status, is_active,
   theme, primary_color, gstin, trial_ends_at, created_at)
SELECT
  id,
  'Rajan Textiles',
  'rajanTextiles',
  'Premium handloom textiles from Tamil Nadu',
  'growth', 'active', TRUE,
  'sunrise', '#FF6B00',
  '33AABCU9603R1ZX',
  NOW() + INTERVAL '30 days',
  NOW()
FROM users WHERE email = 'merchant@zkcommerce.in';

-- Link store back to merchant user
UPDATE users
SET store_id = (SELECT id FROM stores WHERE slug = 'rajanTextiles')
WHERE email = 'merchant@zkcommerce.in';

-- Store categories
INSERT INTO categories (store_id, name, slug, sort_order, is_active, created_at)
SELECT
  s.id,
  c.cat_name,
  c.cat_slug,
  c.sort_order,
  TRUE,
  NOW()
FROM stores s,
(VALUES
  ('Sarees',      'sarees',      1),
  ('Kurtas',      'kurtas',      2),
  ('Blouses',     'blouses',     3),
  ('Accessories', 'accessories', 4)
) AS c(cat_name, cat_slug, sort_order)
WHERE s.slug = 'rajanTextiles';

-- Demo products (fixed VALUES join)
INSERT INTO products
  (store_id, category_id, name, slug, price, mrp, gst_rate,
   stock, low_stock_alert, is_cod, status, is_featured, created_at)
VALUES
  ((SELECT id FROM stores WHERE slug='rajanTextiles'),
   (SELECT id FROM categories WHERE slug='sarees' AND store_id=(SELECT id FROM stores WHERE slug='rajanTextiles')),
   'Kanjivaram Silk Saree - Red', 'kanjivaram-silk-saree-red',
   12500, 15000, '5', 48, 5, TRUE, 'published', TRUE, NOW()),

  ((SELECT id FROM stores WHERE slug='rajanTextiles'),
   (SELECT id FROM categories WHERE slug='kurtas' AND store_id=(SELECT id FROM stores WHERE slug='rajanTextiles')),
   'Cotton Kurta Set - White', 'cotton-kurta-set-white',
   2199, 2800, '12', 32, 5, TRUE, 'published', FALSE, NOW()),

  ((SELECT id FROM stores WHERE slug='rajanTextiles'),
   (SELECT id FROM categories WHERE slug='accessories' AND store_id=(SELECT id FROM stores WHERE slug='rajanTextiles')),
   'Handloom Dupatta - Blue', 'handloom-dupatta-blue',
   890, 1200, '5', 64, 5, TRUE, 'published', FALSE, NOW()),

  ((SELECT id FROM stores WHERE slug='rajanTextiles'),
   (SELECT id FROM categories WHERE slug='blouses' AND store_id=(SELECT id FROM stores WHERE slug='rajanTextiles')),
   'Embroidered Blouse - Green', 'embroidered-blouse-green',
   1450, 1800, '12', 20, 5, TRUE, 'published', FALSE, NOW()),

  ((SELECT id FROM stores WHERE slug='rajanTextiles'),
   (SELECT id FROM categories WHERE slug='sarees' AND store_id=(SELECT id FROM stores WHERE slug='rajanTextiles')),
   'Banarasi Silk Saree - Gold', 'banarasi-silk-saree-gold',
   18000, 22000, '5', 12, 5, TRUE, 'published', TRUE, NOW());

-- Demo warehouse
INSERT INTO warehouses (store_id, name, city, pincode, is_primary, is_active)
SELECT id, 'Chennai Main Warehouse', 'Chennai', '600001', TRUE, TRUE
FROM stores WHERE slug = 'rajanTextiles';

-- Demo subscription
INSERT INTO subscriptions
  (store_id, plan, status, amount, trial_ends_at, current_period_end)
SELECT
  id, 'growth', 'trial', 799,
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days'
FROM stores WHERE slug = 'rajanTextiles';

ANALYZE;

-- ================================================================
-- COMPLETED
-- Tables : 30
-- Indexes: 45+
-- Views  : 5
-- Seed   : 3 users, 1 store, 4 categories, 5 products, 1 warehouse
--
-- LOGIN CREDENTIALS (password = demo1234 for all):
--   Admin:    admin@zkcommerce.in
--   Merchant: merchant@zkcommerce.in
--   Customer: customer@zkcommerce.in
-- ================================================================
