-- ═══════════════════════════════════════════════════════════════
-- ZKCommerce v4.1 — Phase 3 Database Additions
-- Sprint 1-4: Missing tables, indexes, RLS, performance
-- Run after schema.sql + phase1 + phase2
-- ═══════════════════════════════════════════════════════════════

-- ── MISSING COLUMNS ON EXISTING TABLES ───────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'sunrise',
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#FF6B00',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(15),
  ADD COLUMN IF NOT EXISTS gstin VARCHAR(15),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS gst_rate VARCHAR(3) DEFAULT '12',
  ADD COLUMN IF NOT EXISTS low_stock_alert INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS is_cod BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_title VARCHAR(70),
  ADD COLUMN IF NOT EXISTS seo_desc VARCHAR(170),
  ADD COLUMN IF NOT EXISTS slug VARCHAR(200),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS awb_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS courier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS loyalty_discount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

-- ── NEW TABLES ────────────────────────────────────────────────

-- Returns management
CREATE TABLE IF NOT EXISTS returns (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER REFERENCES orders(id),
  store_id     INTEGER REFERENCES stores(id),
  user_id      INTEGER REFERENCES users(id),
  reason       VARCHAR(100) NOT NULL,
  description  TEXT,
  status       VARCHAR(30) DEFAULT 'pending',
  refund_amount DECIMAL(10,2),
  rejection_reason TEXT,
  pickup_awb   VARCHAR(50),
  created_at   TIMESTAMP DEFAULT NOW(),
  resolved_at  TIMESTAMP
);

-- Merchant payouts
CREATE TABLE IF NOT EXISTS payouts (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id),
  amount       DECIMAL(12,2) NOT NULL,
  period_start DATE,
  period_end   DATE,
  order_count  INTEGER DEFAULT 0,
  status       VARCHAR(20) DEFAULT 'pending',
  utr          VARCHAR(50),
  bank_account VARCHAR(20),
  bank_ifsc    VARCHAR(11),
  razorpay_payout_id VARCHAR(100),
  settled_at   TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Store staff / team members
CREATE TABLE IF NOT EXISTS store_staff (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id),
  user_id      INTEGER REFERENCES users(id),
  role         VARCHAR(30) NOT NULL DEFAULT 'support',
  permissions  JSONB DEFAULT '{}',
  invite_token VARCHAR(100),
  status       VARCHAR(20) DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT NOW(),
  accepted_at  TIMESTAMP,
  UNIQUE(store_id, user_id)
);

-- Audit log (compliance + security)
CREATE TABLE IF NOT EXISTS audit_log (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  store_id     INTEGER REFERENCES stores(id),
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50),
  entity_id    INTEGER,
  ip_address   INET,
  user_agent   TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Store SEO settings
CREATE TABLE IF NOT EXISTS store_seo (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id) UNIQUE,
  title        VARCHAR(70),
  description  VARCHAR(170),
  keywords     TEXT,
  og_image_url TEXT,
  google_analytics_id VARCHAR(20),
  facebook_pixel_id   VARCHAR(20),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- Abandoned carts (for WhatsApp recovery — v5)
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  store_id     INTEGER REFERENCES stores(id),
  cart_data    JSONB NOT NULL,
  total        DECIMAL(10,2),
  recovery_sent_at TIMESTAMP,
  recovered    BOOLEAN DEFAULT false,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- Flash sales (v5)
CREATE TABLE IF NOT EXISTS flash_sales (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id),
  name         VARCHAR(200),
  discount_pct INTEGER NOT NULL,
  starts_at    TIMESTAMP NOT NULL,
  ends_at      TIMESTAMP NOT NULL,
  product_ids  INTEGER[],
  is_active    BOOLEAN DEFAULT false,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Blog posts (v5 SEO module)
CREATE TABLE IF NOT EXISTS blog_posts (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id),
  title        VARCHAR(300) NOT NULL,
  slug         VARCHAR(300) UNIQUE,
  content      TEXT,
  excerpt      TEXT,
  cover_image  TEXT,
  seo_title    VARCHAR(70),
  seo_desc     VARCHAR(170),
  status       VARCHAR(20) DEFAULT 'draft',
  author_id    INTEGER REFERENCES users(id),
  published_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- WhatsApp templates (v5)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id),
  name         VARCHAR(100) NOT NULL,
  type         VARCHAR(50) NOT NULL,
  template_id  VARCHAR(100),
  body         TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ── CRITICAL PERFORMANCE INDEXES ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_store_id     ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id      ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment      ON orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_products_store_id   ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status     ON products(store_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug       ON products(store_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_featured   ON products(store_id, is_featured) WHERE is_featured=true;
CREATE INDEX IF NOT EXISTS idx_products_search     ON products USING GIN(to_tsvector('english', name || ' ' || COALESCE(description,'')));

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_payments_order      ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay   ON payments(razorpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_cart_user           ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_product        ON cart_items(product_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_user_store  ON loyalty_points(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product     ON reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_analytics_store_dt  ON analytics_events(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_user      ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_campaigns_store     ON campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_store         ON store_staff(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_store         ON audit_log(store_id, created_at DESC);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_slug ON products(store_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Ensures merchants can only access their own data
-- Enable on all multi-tenant tables

ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_staff     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts      ENABLE ROW LEVEL SECURITY;

-- App user policy (set in connection: SET app.current_store_id = X)
DROP POLICY IF EXISTS merchant_products ON products;
CREATE POLICY merchant_products ON products
  USING (store_id = current_setting('app.current_store_id', true)::integer OR
         current_setting('app.role', true) = 'admin');

DROP POLICY IF EXISTS merchant_orders ON orders;
CREATE POLICY merchant_orders ON orders
  USING (store_id = current_setting('app.current_store_id', true)::integer OR
         user_id  = current_setting('app.current_user_id', true)::integer OR
         current_setting('app.role', true) = 'admin');

DROP POLICY IF EXISTS merchant_categories ON categories;
CREATE POLICY merchant_categories ON categories
  USING (store_id = current_setting('app.current_store_id', true)::integer OR
         current_setting('app.role', true) = 'admin');

-- ── USEFUL VIEWS ──────────────────────────────────────────────

CREATE OR REPLACE VIEW v_store_summary AS
SELECT
  s.id, s.name, s.slug, s.plan, s.is_active,
  u.email as owner_email,
  COUNT(DISTINCT p.id) as product_count,
  COUNT(DISTINCT o.id) as order_count,
  COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled','pending')), 0) as total_gmv,
  COALESCE(AVG(r.rating) FILTER (WHERE r.status='approved'), 0) as avg_rating
FROM stores s
JOIN users u ON u.id=s.user_id
LEFT JOIN products p ON p.store_id=s.id AND p.status='published'
LEFT JOIN orders o ON o.store_id=s.id
LEFT JOIN reviews r ON r.product_id IN (SELECT id FROM products WHERE store_id=s.id)
GROUP BY s.id, u.email;

CREATE OR REPLACE VIEW v_platform_stats AS
SELECT
  COUNT(DISTINCT s.id) as total_stores,
  COUNT(DISTINCT s.id) FILTER (WHERE s.is_active) as active_stores,
  COUNT(DISTINCT s.id) FILTER (WHERE s.trial_ends_at > NOW()) as trial_stores,
  COUNT(DISTINCT o.id) as total_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled','pending')), 0) as total_gmv,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role='customer') as total_customers
FROM stores s
LEFT JOIN orders o ON o.store_id=s.id
CROSS JOIN users u;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT p.id, p.name, p.stock, p.low_stock_alert, s.id as store_id, s.name as store_name
FROM products p
JOIN stores s ON s.id=p.store_id
WHERE p.stock <= p.low_stock_alert AND p.status='published';

CREATE OR REPLACE VIEW v_loyalty_balance AS
SELECT
  user_id, store_id,
  COALESCE(SUM(points), 0) as balance,
  COALESCE(SUM(points) * 0.5, 0) as worth_inr,
  CASE
    WHEN COALESCE(SUM(points),0) >= 25000 THEN 'Gold'
    WHEN COALESCE(SUM(points),0) >= 5000  THEN 'Silver'
    ELSE 'Bronze'
  END as tier
FROM loyalty_points
GROUP BY user_id, store_id;

CREATE OR REPLACE VIEW v_order_gst_summary AS
SELECT
  store_id,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as invoice_count,
  SUM(subtotal - discount) as taxable_value,
  SUM(gst_amount) / 2 as total_cgst,
  SUM(gst_amount) / 2 as total_sgst,
  SUM(total) as total_revenue
FROM orders
WHERE status NOT IN ('cancelled','pending')
GROUP BY store_id, DATE_TRUNC('month', created_at);

-- ── SEED DATA ─────────────────────────────────────────────────

-- Default admin user (change password immediately in production)
INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at)
VALUES (
  'ZKCommerce Admin',
  'admin@zkcommerce.in',
  '9000012345',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsGTiV.9k6L1G8mXKdT1jxR3eTxi', -- admin1234
  'admin',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Demo merchant
INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at)
VALUES (
  'Rajan Kumar',
  'merchant@zkcommerce.in',
  '9876543210',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsGTiV.9k6L1G8mXKdT1jxR3eTxi', -- demo1234
  'merchant',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Demo store for merchant
DO $$
DECLARE
  merchant_id INTEGER;
  store_id    INTEGER;
BEGIN
  SELECT id INTO merchant_id FROM users WHERE email='merchant@zkcommerce.in';
  IF merchant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stores WHERE user_id=merchant_id) THEN
    INSERT INTO stores (user_id, name, slug, plan, theme, primary_color, is_active, trial_ends_at, created_at)
    VALUES (merchant_id, 'Rajan Textiles', 'rajanTextiles', 'growth', 'sunrise', '#FF6B00', true, NOW()+INTERVAL'30 days', NOW())
    RETURNING id INTO store_id;
    UPDATE users SET store_id=store_id WHERE id=merchant_id;
    -- Demo categories
    INSERT INTO categories (store_id, name, slug, sort_order, created_at) VALUES
    (store_id, 'Sarees',      'sarees',      1, NOW()),
    (store_id, 'Kurtas',      'kurtas',      2, NOW()),
    (store_id, 'Blouses',     'blouses',     3, NOW()),
    (store_id, 'Accessories', 'accessories', 4, NOW());
  END IF;
END $$;
