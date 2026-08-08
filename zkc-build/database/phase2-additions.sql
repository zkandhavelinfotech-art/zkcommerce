-- ============================================================
--  CommercePro — Phase 2 DB Additions
--  Run: psql -U postgres -d commercepro -f database/phase2-additions.sql
--  Safe to run after schema.sql + phase1-additions.sql
-- ============================================================

-- ============================================================
--  1. PRODUCT VARIANTS  (relational, replaces JSONB array)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id           BIGSERIAL       PRIMARY KEY,
  product_id   BIGINT          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku          VARCHAR(100)    NOT NULL,
  attributes   JSONB           NOT NULL DEFAULT '{}', -- {color:"Black",storage:"256GB"}
  price        NUMERIC(12,2),                          -- NULL = inherit from product
  sale_price   NUMERIC(12,2),
  stock        INT             NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_at INT             NOT NULL DEFAULT 5,
  image_url    TEXT,
  barcode      VARCHAR(100),
  is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
  sort_order   SMALLINT        NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_pv_product   ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_pv_sku       ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_pv_attrs_gin ON product_variants USING gin(attributes);
CREATE INDEX IF NOT EXISTS idx_pv_active    ON product_variants(product_id, is_active)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_pv_updated_at ON product_variants;
CREATE TRIGGER trg_pv_updated_at
BEFORE UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Helper: total stock across all variants for a product
CREATE OR REPLACE FUNCTION product_total_stock(p_id BIGINT)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = p_id AND is_active = TRUE;
$$;

-- ============================================================
--  2. WAREHOUSES + WAREHOUSE_STOCK  (multi-location inventory)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id          BIGSERIAL     PRIMARY KEY,
  store_id    BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        VARCHAR(100)  NOT NULL,
  code        VARCHAR(20),                          -- short code e.g. MUM-HQ
  address     JSONB         NOT NULL DEFAULT '{}',
  city        VARCHAR(100),
  state       VARCHAR(100),
  pincode     VARCHAR(10),
  is_primary  BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wh_store    ON warehouses(store_id);
CREATE INDEX IF NOT EXISTS idx_wh_primary  ON warehouses(store_id, is_primary) WHERE is_primary = TRUE;

DROP TRIGGER IF EXISTS trg_wh_updated_at ON warehouses;
CREATE TRIGGER trg_wh_updated_at
BEFORE UPDATE ON warehouses
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS warehouse_stock (
  id            BIGSERIAL     PRIMARY KEY,
  warehouse_id  BIGINT        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id    BIGINT        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id    BIGINT        REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity      INT           NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved      INT           NOT NULL DEFAULT 0 CHECK (reserved >= 0), -- reserved for pending orders
  low_stock_at  INT           NOT NULL DEFAULT 10,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ws_product   ON warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_ws_variant   ON warehouse_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_ws_low_stock ON warehouse_stock(product_id)
  WHERE quantity <= low_stock_at;

-- View: aggregated stock across all warehouses per product
CREATE OR REPLACE VIEW v_product_stock AS
SELECT
  ws.product_id,
  ws.variant_id,
  SUM(ws.quantity)              AS total_quantity,
  SUM(ws.reserved)              AS total_reserved,
  SUM(ws.quantity - ws.reserved) AS available,
  COUNT(DISTINCT ws.warehouse_id) AS warehouse_count,
  BOOL_OR(ws.quantity <= ws.low_stock_at) AS has_low_stock,
  BOOL_OR(ws.quantity = 0) AS has_stockout
FROM warehouse_stock ws
GROUP BY ws.product_id, ws.variant_id;

-- Seed: create default warehouses for existing stores
DO $$
DECLARE v_store_id BIGINT;
BEGIN
  FOR v_store_id IN SELECT id FROM stores LOOP
    INSERT INTO warehouses (store_id, name, code, city, state, pincode, is_primary)
    VALUES (v_store_id, 'Primary Warehouse', 'WH-01', 'Mumbai', 'Maharashtra', '400076', TRUE)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
--  3. EMAIL CAMPAIGNS + RECIPIENTS  (Marketing module)
-- ============================================================
CREATE TYPE IF NOT EXISTS campaign_channel  AS ENUM ('email', 'sms', 'whatsapp', 'push');
CREATE TYPE IF NOT EXISTS campaign_status   AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled');
CREATE TYPE IF NOT EXISTS recipient_status  AS ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed');

CREATE TABLE IF NOT EXISTS campaigns (
  id              BIGSERIAL         PRIMARY KEY,
  store_id        BIGINT            NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name            VARCHAR(200)      NOT NULL,
  channel         campaign_channel  NOT NULL DEFAULT 'email',
  subject         VARCHAR(300),                       -- email subject / SMS prefix
  preview_text    VARCHAR(200),
  body_html       TEXT,
  body_text       TEXT,
  segment         JSONB             NOT NULL DEFAULT '{}', -- {type:"all"|"new"|"loyal"|"custom"}
  status          campaign_status   NOT NULL DEFAULT 'draft',
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  total_recipients INT              NOT NULL DEFAULT 0,
  sent_count      INT               NOT NULL DEFAULT 0,
  open_count      INT               NOT NULL DEFAULT 0,
  click_count     INT               NOT NULL DEFAULT 0,
  bounce_count    INT               NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camp_store    ON campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_camp_status   ON campaigns(store_id, status);
CREATE INDEX IF NOT EXISTS idx_camp_sched    ON campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           BIGSERIAL        PRIMARY KEY,
  campaign_id  BIGINT           NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      BIGINT           REFERENCES users(id) ON DELETE SET NULL,
  email        VARCHAR(200),
  phone        VARCHAR(20),
  status       recipient_status NOT NULL DEFAULT 'pending',
  sent_at      TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  error_msg    TEXT,
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cr_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cr_user     ON campaign_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_cr_status   ON campaign_recipients(campaign_id, status);

DROP TRIGGER IF EXISTS trg_camp_updated_at ON campaigns;
CREATE TRIGGER trg_camp_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
--  4. SUBSCRIPTION INVOICES  (billing history)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id              BIGSERIAL       PRIMARY KEY,
  subscription_id BIGINT          REFERENCES subscriptions(id) ON DELETE SET NULL,
  store_id        BIGINT          NOT NULL REFERENCES stores(id),
  invoice_number  VARCHAR(30)     NOT NULL UNIQUE DEFAULT ('SUB-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0')),
  plan_name       VARCHAR(100)    NOT NULL,
  amount          NUMERIC(10,2)   NOT NULL,
  currency        VARCHAR(3)      NOT NULL DEFAULT 'INR',
  status          VARCHAR(20)     NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','failed','refunded','pending')),
  period_start    TIMESTAMPTZ     NOT NULL,
  period_end      TIMESTAMPTZ     NOT NULL,
  payment_method  VARCHAR(50),
  razorpay_id     VARCHAR(100),
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_inv_store ON subscription_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_sub_inv_sub   ON subscription_invoices(subscription_id);

-- ============================================================
--  5. MISSING INDEXES for Phase 2 API routes
-- ============================================================

-- Cart API: faster merge on login (guest_token lookup)
CREATE INDEX IF NOT EXISTS idx_carts_guest_token
  ON carts(guest_token)
  WHERE guest_token IS NOT NULL;

-- Product variants: attribute-based filtering (color, size)
CREATE INDEX IF NOT EXISTS idx_pv_color
  ON product_variants((attributes->>'color'))
  WHERE attributes ? 'color';

CREATE INDEX IF NOT EXISTS idx_pv_storage
  ON product_variants((attributes->>'storage'))
  WHERE attributes ? 'storage';

-- Campaigns: pending sends scheduler
CREATE INDEX IF NOT EXISTS idx_camps_scheduled_pending
  ON campaigns(scheduled_at, status)
  WHERE status = 'scheduled' AND scheduled_at <= NOW();

-- Warehouse stock: available quantity alert
CREATE INDEX IF NOT EXISTS idx_ws_available
  ON warehouse_stock(product_id, quantity)
  WHERE quantity = 0;

-- Reviews: pending moderation queue
CREATE INDEX IF NOT EXISTS idx_reviews_pending
  ON reviews(store_id, created_at DESC)
  WHERE status = 'pending';

-- ============================================================
--  6. UPDATED_AT TRIGGERS for new tables
-- ============================================================
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['product_variants','warehouses','campaigns'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at_%s ON %s', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_updated_at_%s BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
--  7. SEED DATA for demo
-- ============================================================

-- Seed product variants for demo product (id=1 assumed)
DO $$
DECLARE v_prod BIGINT;
BEGIN
  SELECT id INTO v_prod FROM products WHERE name ILIKE '%iPhone%' LIMIT 1;
  IF v_prod IS NOT NULL THEN
    INSERT INTO product_variants (product_id, sku, attributes, price, sale_price, stock)
    VALUES
      (v_prod, 'IP17P-NT-256', '{"color":"Natural Titanium","storage":"256GB"}', 89999, 84999, 8),
      (v_prod, 'IP17P-NT-512', '{"color":"Natural Titanium","storage":"512GB"}', 104999, 99999, 6),
      (v_prod, 'IP17P-BK-256', '{"color":"Black Titanium","storage":"256GB"}',   89999, 84999, 4),
      (v_prod, 'IP17P-BK-512', '{"color":"Black Titanium","storage":"512GB"}',  104999, 99999, 3),
      (v_prod, 'IP17P-WT-256', '{"color":"White Titanium","storage":"256GB"}',   89999, 84999, 2),
      (v_prod, 'IP17P-DT-256', '{"color":"Desert Titanium","storage":"256GB"}',  89999, 84999, 1)
    ON CONFLICT (product_id, sku) DO NOTHING;
  END IF;
END $$;

ANALYZE;

-- ============================================================
--  SUMMARY
-- ============================================================
-- Tables added:   product_variants, warehouses, warehouse_stock
--                 campaigns, campaign_recipients, subscription_invoices
-- Types:          campaign_channel, campaign_status, recipient_status
-- Functions:      product_total_stock
-- Views:          v_product_stock
-- Triggers:       trg_pv_updated_at, trg_wh_updated_at, trg_camp_updated_at
-- Indexes:        15 new indexes added
-- ============================================================
