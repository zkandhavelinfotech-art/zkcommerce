-- ZKCommerce v4.3.0 — Core schema (PostgreSQL 15 / Neon)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS merchants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150), email VARCHAR(255) UNIQUE, phone VARCHAR(20) UNIQUE,
  password_hash TEXT, role VARCHAR(20) DEFAULT 'merchant',
  store_id INT, reset_token TEXT, reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  merchant_id INT REFERENCES merchants(id) ON DELETE CASCADE,
  store_name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  custom_domain VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'draft',          -- draft | published | live | suspended
  theme_name VARCHAR(50) DEFAULT 'dark-navy',
  primary_colour VARCHAR(9) DEFAULT '#1688E8',
  bg_colour VARCHAR(9) DEFAULT '#06152B',
  accent_colour VARCHAR(9) DEFAULT '#A6D900',
  logo_url TEXT, hero_image_url TEXT,
  tagline TEXT, hero_headline TEXT, hero_subtext TEXT, hero_cta_text VARCHAR(60),
  whatsapp_number VARCHAR(20), instagram_handle VARCHAR(60),
  city VARCHAR(80), state VARCHAR(80), address TEXT, gst_number VARCHAR(20),
  razorpay_key_id VARCHAR(60),
  theme_config JSONB DEFAULT '{}'::jsonb,       -- section settings from the Store Builder
  published_snapshot JSONB DEFAULT NULL,        -- immutable public config/pages/products snapshot
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL, slug VARCHAR(120), image_url TEXT,
  sort_order INT DEFAULT 0, active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL, slug VARCHAR(200), sku VARCHAR(100), description TEXT, ingredients TEXT,
  price INT NOT NULL, compare_price INT,
  images JSONB DEFAULT '[]'::jsonb, variants JSONB DEFAULT '[]'::jsonb,
  in_stock BOOLEAN DEFAULT true, active BOOLEAN DEFAULT true, featured BOOLEAN DEFAULT false,
  badge_text VARCHAR(40),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  order_number VARCHAR(40) UNIQUE,
  customer_name VARCHAR(150), customer_email VARCHAR(255), customer_phone VARCHAR(20),
  shipping_address JSONB, items JSONB,
  subtotal INT, gst_amount INT, total_amount INT,
  payment_method VARCHAR(20), status VARCHAR(20) DEFAULT 'pending',
  razorpay_order_id TEXT, razorpay_payment_id TEXT, razorpay_signature TEXT, paid_at TIMESTAMPTZ,
  tracking_number VARCHAR(60), courier VARCHAR(60), coupon_code VARCHAR(40),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY, order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id), quantity INT, price INT
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  phone VARCHAR(20) PRIMARY KEY, otp VARCHAR(6), expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notify_requests (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  email VARCHAR(255), product_label VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  order_id INT UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL, issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL, discount_type VARCHAR(12) NOT NULL CHECK(discount_type IN ('percent','fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK(discount_value > 0), minimum_order INT DEFAULT 0,
  usage_limit INT, used_count INT DEFAULT 0, starts_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(store_id,code)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(150), phone VARCHAR(20), email VARCHAR(255), reason VARCHAR(40), message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_pages (
  id SERIAL PRIMARY KEY, store_id INT REFERENCES stores(id) ON DELETE CASCADE,
  title VARCHAR(150), slug VARCHAR(150), content JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'draft', sort_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(store_id, slug)
);

-- v4.3 merchant operations modules
CREATE TABLE IF NOT EXISTS store_staff (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL, email VARCHAR(255) NOT NULL, role VARCHAR(40) NOT NULL DEFAULT 'operator',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id,email)
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL, channel VARCHAR(30) NOT NULL DEFAULT 'email', subject VARCHAR(200),
  content TEXT NOT NULL DEFAULT '', audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','sent','cancelled')),
  scheduled_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL, email VARCHAR(255) NOT NULL, code VARCHAR(40) NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK(commission_percent BETWEEN 0 AND 100),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(store_id,code), UNIQUE(store_id,email)
);
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id SERIAL PRIMARY KEY, affiliate_id INT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id INT UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  order_amount NUMERIC(12,2) NOT NULL DEFAULT 0, commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','paid','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_subscriptions (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL, customer_name VARCHAR(150),
  customer_email VARCHAR(255) NOT NULL, quantity INT NOT NULL DEFAULT 1 CHECK(quantity > 0),
  interval_unit VARCHAR(12) NOT NULL CHECK(interval_unit IN ('week','month','year')),
  interval_count INT NOT NULL DEFAULT 1 CHECK(interval_count > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','cancelled','expired')),
  next_billing_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flash_sales (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL, product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount_percent NUMERIC(5,2) NOT NULL CHECK(discount_percent > 0 AND discount_percent <= 100),
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL, slug VARCHAR(220) NOT NULL, excerpt TEXT, body TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT, status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id,slug)
);

CREATE TABLE IF NOT EXISTS gst_settings (
  store_id INT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  gstin VARCHAR(20), state_code VARCHAR(2), default_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(default_rate BETWEEN 0 AND 100),
  enabled BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL, name VARCHAR(150), points INT NOT NULL DEFAULT 0 CHECK(points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id,email)
);
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id SERIAL PRIMARY KEY, account_id INT NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  points_delta INT NOT NULL CHECK(points_delta <> 0), reason VARCHAR(200) NOT NULL,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL, customer_name VARCHAR(150) NOT NULL,
  customer_email VARCHAR(255), rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title VARCHAR(200), body TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_seo (
  store_id INT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  title VARCHAR(200), description VARCHAR(320), canonical_url TEXT, og_image_url TEXT,
  robots VARCHAR(40) NOT NULL DEFAULT 'index,follow', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cron_runs (
  id BIGSERIAL PRIMARY KEY, job_name VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb, ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_store ON store_staff(store_id,active);
CREATE INDEX IF NOT EXISTS idx_campaign_store ON marketing_campaigns(store_id,status);
CREATE INDEX IF NOT EXISTS idx_affiliate_store ON affiliates(store_id,status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_due ON recurring_subscriptions(status,next_billing_at);
CREATE INDEX IF NOT EXISTS idx_flash_sales_window ON flash_sales(store_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_blog_public ON blog_posts(store_id,status,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_public ON product_reviews(store_id,product_id,status,created_at DESC);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS published_snapshot JSONB DEFAULT NULL;
-- Per-environment deploy settings (DB / FTP / domain / package versions); secrets are AES-GCM encrypted.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS deployment_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
-- WhatsApp order message templates + customer-care number (api/services/order-messages.js).
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE store_pages ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE store_pages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_failure TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_amount INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_rate_id INT;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS inbox_status VARCHAR(20) NOT NULL DEFAULT 'unread';
ALTER TABLE notify_requests ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE notify_requests ADD COLUMN IF NOT EXISTS inbox_status VARCHAR(20) NOT NULL DEFAULT 'unread';

CREATE TABLE IF NOT EXISTS store_shipping_rates (
  id SERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  rate INT NOT NULL DEFAULT 0 CHECK(rate >= 0),
  free_above INT CHECK(free_above IS NULL OR free_above >= 0),
  postal_prefix VARCHAR(12),
  estimated_days VARCHAR(40),
  courier VARCHAR(80) NOT NULL DEFAULT 'Manual fulfillment',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_store ON store_shipping_rates(store_id,active);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate VARCHAR(10) DEFAULT '12';
CREATE INDEX IF NOT EXISTS idx_orders_store   ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_domain  ON stores(custom_domain);

-- One-time backfill for v4.1 stores already marked published/live.
UPDATE stores s SET published_snapshot = jsonb_build_object(
  'version',1,
  'published_at',COALESCE(s.published_at,NOW()),
  'store',jsonb_build_object(
    'store_name',s.store_name,'slug',s.slug,'custom_domain',s.custom_domain,'tagline',s.tagline,
    'hero_headline',s.hero_headline,'hero_subtext',s.hero_subtext,'hero_cta_text',s.hero_cta_text,
    'primary_colour',s.primary_colour,'bg_colour',s.bg_colour,'accent_colour',s.accent_colour,'logo_url',s.logo_url
  ),
  'theme_config',COALESCE(s.theme_config,'{}'::jsonb),
  'products',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.featured DESC,p.created_at DESC) FROM products p WHERE p.store_id=s.id AND p.active=true),'[]'::jsonb),
  'pages',COALESCE((SELECT jsonb_agg(to_jsonb(pg) ORDER BY pg.sort_order,pg.id) FROM store_pages pg WHERE pg.store_id=s.id AND pg.status='published'),'[]'::jsonb)
)
WHERE s.status IN ('published','live') AND s.published_snapshot IS NULL;
