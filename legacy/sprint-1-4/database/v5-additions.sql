-- ================================================================
-- ZKCommerce v5.0 -- Database Additions
-- Run AFTER zkcommerce-master.sql and zkcommerce-additions.sql
-- New tables and indexes for v5.0 features
-- ================================================================

-- ── Tally ERP sync log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tally_sync_log (
  id          BIGSERIAL   PRIMARY KEY,
  store_id    BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sync_type   VARCHAR(30) NOT NULL DEFAULT 'orders',
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  records     INT         NOT NULL DEFAULT 0,
  error_msg   TEXT,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tally_store ON tally_sync_log(store_id, synced_at DESC);

-- ── Meta (Instagram/Facebook) catalogue ──────────────────────
CREATE TABLE IF NOT EXISTS meta_catalogue_items (
  id            BIGSERIAL   PRIMARY KEY,
  store_id      BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id    BIGINT      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  meta_item_id  VARCHAR(100),
  catalogue_id  VARCHAR(100),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_synced   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_meta_store ON meta_catalogue_items(store_id);

-- ── BNPL transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bnpl_transactions (
  id          BIGSERIAL   PRIMARY KEY,
  order_id    BIGINT      NOT NULL REFERENCES orders(id),
  provider    VARCHAR(30) NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  reference   VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bnpl_order ON bnpl_transactions(order_id);

-- ── Affiliate / influencer ────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliates (
  id            BIGSERIAL   PRIMARY KEY,
  store_id      BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id       BIGINT      REFERENCES users(id),
  name          VARCHAR(160) NOT NULL,
  email         VARCHAR(200),
  phone         VARCHAR(20),
  ref_code      VARCHAR(20)  NOT NULL UNIQUE,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  total_sales   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_payout  NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliates_store ON affiliates(store_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_ref   ON affiliates(ref_code);

-- ── Subscription plans (recurring orders) ────────────────────
CREATE TABLE IF NOT EXISTS recurring_orders (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id        BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id      BIGINT      NOT NULL REFERENCES products(id),
  quantity        INT         NOT NULL DEFAULT 1,
  frequency_days  INT         NOT NULL DEFAULT 30,
  next_order_date DATE        NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  address_id      BIGINT      REFERENCES addresses(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_user  ON recurring_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_store ON recurring_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next  ON recurring_orders(next_order_date) WHERE status='active';

-- ── Courier rate cache ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courier_rates (
  id           BIGSERIAL   PRIMARY KEY,
  courier      VARCHAR(50) NOT NULL,
  from_zone    VARCHAR(10),
  to_zone      VARCHAR(10),
  weight_upto  NUMERIC(8,3),
  rate         NUMERIC(8,2) NOT NULL,
  cod_charge   NUMERIC(6,2) NOT NULL DEFAULT 0,
  effective_dt DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SEO keyword tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_keywords (
  id          BIGSERIAL   PRIMARY KEY,
  store_id    BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  keyword     VARCHAR(200) NOT NULL,
  position    INT,
  impressions INT         NOT NULL DEFAULT 0,
  clicks      INT         NOT NULL DEFAULT 0,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seo_store ON seo_keywords(store_id, checked_at DESC);

-- ── Add indexes for v5 query patterns ────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_store_created
  ON orders(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_store_featured
  ON products(store_id, is_featured, status)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_abandoned_not_recovered
  ON abandoned_carts(store_id, updated_at)
  WHERE recovered = false;

CREATE INDEX IF NOT EXISTS idx_flash_active
  ON flash_sales(store_id, starts_at, ends_at)
  WHERE is_active = true;

ANALYZE;

-- ================================================================
-- v5.0 DB additions complete
-- New tables: tally_sync_log, meta_catalogue_items, bnpl_transactions,
--             affiliates, recurring_orders, courier_rates, seo_keywords
-- New indexes: 4 performance indexes for v5 query patterns
-- ================================================================
