-- ============================================================
--  CommercePro — Phase 1 DB Additions
--  Run: psql -U postgres -d commercepro -f database/phase1-additions.sql
--  Safe to run after schema.sql (uses IF NOT EXISTS everywhere)
-- ============================================================

-- ============================================================
--  1. CART + CART_ITEMS  (persistent server-side cart)
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
  id          BIGSERIAL     PRIMARY KEY,
  user_id     BIGINT        REFERENCES users(id) ON DELETE CASCADE,
  guest_token VARCHAR(64),                          -- for guest carts
  store_id    BIGINT        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  coupon_code VARCHAR(50),
  expires_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_owner CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user_store
  ON carts(user_id, store_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carts_guest
  ON carts(guest_token) WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carts_expires
  ON carts(expires_at);

CREATE TABLE IF NOT EXISTS cart_items (
  id          BIGSERIAL     PRIMARY KEY,
  cart_id     BIGINT        NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  BIGINT        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INT           NOT NULL DEFAULT 1 CHECK (quantity > 0),
  variant     JSONB         NOT NULL DEFAULT '{}',  -- {color, storage, size}
  unit_price  NUMERIC(12,2) NOT NULL,               -- price at time of adding
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, product_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- Auto-update cart updated_at when items change
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE carts SET updated_at = NOW() WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cart_item_ts ON cart_items;
CREATE TRIGGER trg_cart_item_ts
AFTER INSERT OR UPDATE OR DELETE ON cart_items
FOR EACH ROW EXECUTE FUNCTION update_cart_timestamp();

-- Cleanup expired guest carts (run as a cron job)
-- DELETE FROM carts WHERE expires_at < NOW() AND user_id IS NULL;

-- ============================================================
--  2. LOYALTY POINTS  (points ledger)
-- ============================================================
CREATE TYPE IF NOT EXISTS loyalty_tx_type AS ENUM (
  'earn_purchase', 'earn_review', 'earn_referral', 'earn_signup',
  'redeem', 'expire', 'adjust'
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id            BIGSERIAL         PRIMARY KEY,
  user_id       BIGINT            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id      BIGINT            REFERENCES stores(id) ON DELETE SET NULL,
  tx_type       loyalty_tx_type   NOT NULL,
  points        INT               NOT NULL,          -- positive = earn, negative = redeem/expire
  balance_after INT               NOT NULL,
  reference_id  BIGINT,                             -- order_id, review_id, etc.
  description   VARCHAR(200),
  expires_at    TIMESTAMPTZ,                        -- points can expire
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user    ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_store   ON loyalty_points(store_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_created ON loyalty_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_expires ON loyalty_points(expires_at)
  WHERE expires_at IS NOT NULL;

-- View: current balance per user
CREATE OR REPLACE VIEW v_loyalty_balance AS
SELECT
  user_id,
  SUM(points) AS balance,
  SUM(points) FILTER (WHERE points > 0)  AS total_earned,
  SUM(ABS(points)) FILTER (WHERE points < 0) AS total_redeemed,
  COUNT(*) FILTER (WHERE tx_type = 'earn_purchase') AS purchase_count
FROM loyalty_points
WHERE (expires_at IS NULL OR expires_at > NOW())
GROUP BY user_id;

-- Function: earn points on order
CREATE OR REPLACE FUNCTION earn_loyalty_points(
  p_user_id    BIGINT,
  p_store_id   BIGINT,
  p_order_id   BIGINT,
  p_order_total NUMERIC,
  p_rate       INT DEFAULT 1  -- 1 point per ₹1 spent
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_points     INT;
  v_balance    INT;
BEGIN
  v_points := FLOOR(p_order_total * p_rate);
  SELECT COALESCE(SUM(points), 0) INTO v_balance FROM loyalty_points WHERE user_id = p_user_id;
  INSERT INTO loyalty_points (user_id, store_id, tx_type, points, balance_after, reference_id, description, expires_at)
  VALUES (p_user_id, p_store_id, 'earn_purchase', v_points, v_balance + v_points, p_order_id,
          'Points earned on order #' || p_order_id,
          NOW() + INTERVAL '1 year');
  RETURN v_points;
END; $$;

-- Function: redeem points
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_user_id    BIGINT,
  p_points     INT,
  p_order_id   BIGINT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_balance FROM loyalty_points
  WHERE user_id = p_user_id AND (expires_at IS NULL OR expires_at > NOW());

  IF v_balance < p_points THEN RETURN FALSE; END IF;

  INSERT INTO loyalty_points (user_id, tx_type, points, balance_after, reference_id, description)
  VALUES (p_user_id, 'redeem', -p_points, v_balance - p_points, p_order_id,
          'Redeemed on order #' || p_order_id);
  RETURN TRUE;
END; $$;

-- ============================================================
--  3. INVOICES  (GST-compliant invoice ledger)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

CREATE TABLE IF NOT EXISTS invoices (
  id              BIGSERIAL     PRIMARY KEY,
  invoice_number  VARCHAR(30)   NOT NULL UNIQUE
                    DEFAULT ('INV-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0')),
  order_id        BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id        BIGINT        NOT NULL REFERENCES stores(id),

  -- Billing info (snapshot at invoice time)
  customer_name   VARCHAR(200)  NOT NULL,
  customer_email  VARCHAR(200),
  billing_address JSONB         NOT NULL,

  -- Store/seller info
  seller_name     VARCHAR(200)  NOT NULL,
  seller_gstin    VARCHAR(15),
  seller_address  JSONB,

  -- Amounts
  subtotal        NUMERIC(14,2) NOT NULL,
  discount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxable_amount  NUMERIC(14,2) NOT NULL,
  cgst_rate       NUMERIC(5,2)  NOT NULL DEFAULT 9.00,   -- 9%
  sgst_rate       NUMERIC(5,2)  NOT NULL DEFAULT 9.00,   -- 9%
  igst_rate       NUMERIC(5,2)  NOT NULL DEFAULT 0,      -- 18% for inter-state
  cgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_tax       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL,

  -- Line items (denormalised snapshot)
  line_items      JSONB         NOT NULL DEFAULT '[]',

  -- State
  is_cancelled    BOOLEAN       NOT NULL DEFAULT FALSE,
  cancelled_at    TIMESTAMPTZ,
  pdf_url         TEXT,                              -- S3 URL after PDF generation
  html_content    TEXT,                              -- cached HTML for fast re-render

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order   ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_store   ON invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number  ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- Auto-trigger invoice on order payment confirmation
CREATE OR REPLACE FUNCTION auto_create_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_order   RECORD;
  v_store   RECORD;
  v_items   JSONB;
  v_addr    JSONB;
  v_taxable NUMERIC;
  v_cgst    NUMERIC;
  v_sgst    NUMERIC;
BEGIN
  -- Only fire when payment_status flips to 'success'
  IF NEW.payment_status = 'success' AND OLD.payment_status != 'success' THEN
    SELECT * INTO v_order FROM orders WHERE id = NEW.id;
    SELECT * INTO v_store FROM stores WHERE id = v_order.store_id;

    -- Build line items JSON
    SELECT json_agg(json_build_object(
      'product_id', oi.product_id,
      'name', p.name, 'sku', p.sku,
      'qty', oi.quantity,
      'unit_price', oi.unit_price,
      'total', oi.total_price
    )) INTO v_items
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id;

    v_addr    := v_order.address;
    v_taxable := v_order.subtotal - v_order.discount;
    v_cgst    := ROUND(v_taxable * 0.09, 2);
    v_sgst    := ROUND(v_taxable * 0.09, 2);

    INSERT INTO invoices (
      order_id, store_id,
      customer_name, customer_email, billing_address,
      seller_name, seller_gstin, seller_address,
      subtotal, discount, shipping_fee, taxable_amount,
      cgst_amount, sgst_amount, total_tax, total_amount,
      line_items
    ) VALUES (
      v_order.id, v_order.store_id,
      COALESCE(v_addr->>'first_name','') || ' ' || COALESCE(v_addr->>'last_name',''),
      v_addr->>'email', v_addr,
      v_store.name, v_store.gstin, v_store.settings->'address',
      v_order.subtotal, v_order.discount, v_order.shipping_fee, v_taxable,
      v_cgst, v_sgst, v_cgst + v_sgst, v_order.total,
      COALESCE(v_items, '[]'::jsonb)
    )
    ON CONFLICT (order_id) DO NOTHING;  -- idempotent
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_invoice ON orders;
CREATE TRIGGER trg_auto_invoice
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION auto_create_invoice();

-- ============================================================
--  4. MISSING INDEXES  (referenced in Phase 1 API routes)
-- ============================================================

-- Wishlist fast lookup (user+product pair)
CREATE INDEX IF NOT EXISTS idx_wishlists_user_product
  ON wishlists(user_id, product_id);

-- Orders by customer (for account page)
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON orders(customer_id, created_at DESC);

-- Products full-text vector (for /api/search)
CREATE INDEX IF NOT EXISTS idx_products_fts_vector
  ON products USING gin(
    to_tsvector('english',
      name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, '')
    )
  );

-- Tags GIN (for tag-based search)
CREATE INDEX IF NOT EXISTS idx_products_tags_gin
  ON products USING gin(tags);

-- Analytics UTM tracking
CREATE INDEX IF NOT EXISTS idx_analytics_utm_source
  ON analytics_events(store_id, utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_utm_campaign
  ON analytics_events(store_id, utm_campaign, created_at DESC)
  WHERE utm_campaign IS NOT NULL;

-- Notification unread fast count
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = FALSE;

-- Loyalty points active balance
CREATE INDEX IF NOT EXISTS idx_loyalty_user_active
  ON loyalty_points(user_id, expires_at)
  WHERE expires_at IS NULL OR expires_at > NOW();

-- Invoice by order
CREATE INDEX IF NOT EXISTS idx_invoices_order_unique
  ON invoices(order_id);

-- ============================================================
--  5. CART API ROUTES (stored procedures for atomicity)
-- ============================================================

-- Get or create cart for a user/store combo
CREATE OR REPLACE FUNCTION get_or_create_cart(
  p_user_id  BIGINT,
  p_store_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_cart_id BIGINT;
BEGIN
  SELECT id INTO v_cart_id FROM carts
  WHERE user_id = p_user_id AND store_id = p_store_id
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    INSERT INTO carts (user_id, store_id)
    VALUES (p_user_id, p_store_id)
    RETURNING id INTO v_cart_id;
  ELSE
    -- Reset expiry on access
    UPDATE carts SET expires_at = NOW() + INTERVAL '30 days', updated_at = NOW()
    WHERE id = v_cart_id;
  END IF;

  RETURN v_cart_id;
END; $$;

-- Upsert cart item (add or update quantity)
CREATE OR REPLACE FUNCTION upsert_cart_item(
  p_cart_id    BIGINT,
  p_product_id BIGINT,
  p_quantity   INT,
  p_variant    JSONB DEFAULT '{}'
) RETURNS cart_items LANGUAGE plpgsql AS $$
DECLARE
  v_price  NUMERIC;
  v_result cart_items;
BEGIN
  SELECT COALESCE(sale_price, price) INTO v_price FROM products WHERE id = p_product_id;

  INSERT INTO cart_items (cart_id, product_id, quantity, variant, unit_price)
  VALUES (p_cart_id, p_product_id, p_quantity, p_variant, v_price)
  ON CONFLICT (cart_id, product_id, variant)
  DO UPDATE SET
    quantity   = CASE WHEN p_quantity = 0 THEN 0 ELSE p_quantity END,
    unit_price = v_price,
    updated_at = NOW()
  RETURNING * INTO v_result;

  -- Remove if quantity is 0
  IF p_quantity = 0 THEN
    DELETE FROM cart_items WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant = p_variant;
  END IF;

  RETURN v_result;
END; $$;

-- ============================================================
--  6. SEED LOYALTY POINTS for demo user
-- ============================================================
DO $$
DECLARE v_user_id BIGINT;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = 'merchant@demo.com';
  IF v_user_id IS NOT NULL THEN
    -- Only seed if no points exist
    IF NOT EXISTS (SELECT 1 FROM loyalty_points WHERE user_id = v_user_id) THEN
      INSERT INTO loyalty_points (user_id, tx_type, points, balance_after, description)
      VALUES
        (v_user_id, 'earn_signup',   200,  200,  'Welcome bonus points'),
        (v_user_id, 'earn_purchase', 1199, 1399, 'Points earned on order'),
        (v_user_id, 'earn_purchase', 500,  1899, 'Points earned on order'),
        (v_user_id, 'redeem',        -500, 1399, 'Redeemed at checkout'),
        (v_user_id, 'earn_purchase', 900,  2299, 'Points earned on order'),
        (v_user_id, 'earn_review',   100,  2399, 'Bonus for writing a review'),
        (v_user_id, 'earn_purchase', 1,    2400, 'Rounding bonus');
    END IF;
  END IF;
END $$;

-- ============================================================
--  7. UPDATED-AT TRIGGERS for new tables
-- ============================================================
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['carts', 'cart_items', 'invoices'] LOOP
    -- Drop if exists, then recreate
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at_%s ON %s', tbl, tbl);
    EXECUTE format('
      CREATE TRIGGER trg_updated_at_%s
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
--  8. VIEWS for Phase 1
-- ============================================================

-- Cart summary view (join items with product details)
CREATE OR REPLACE VIEW v_cart_summary AS
SELECT
  c.id         AS cart_id,
  c.user_id,
  c.store_id,
  c.coupon_code,
  COUNT(ci.id) AS item_count,
  SUM(ci.quantity) AS total_qty,
  SUM(ci.unit_price * ci.quantity) AS subtotal,
  c.updated_at AS last_updated
FROM carts c
LEFT JOIN cart_items ci ON ci.cart_id = c.id
GROUP BY c.id;

-- Invoice summary per store
CREATE OR REPLACE VIEW v_invoice_summary AS
SELECT
  store_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*)              AS invoice_count,
  SUM(total_amount)     AS total_billed,
  SUM(total_tax)        AS total_gst_collected,
  SUM(cgst_amount)      AS total_cgst,
  SUM(sgst_amount)      AS total_sgst
FROM invoices
WHERE is_cancelled = FALSE
GROUP BY store_id, DATE_TRUNC('month', created_at)
ORDER BY month DESC;

ANALYZE;

-- ============================================================
--  SUMMARY
-- ============================================================
-- Tables added:   carts, cart_items, loyalty_points, invoices
-- Sequences:      invoice_number_seq
-- Types:          loyalty_tx_type
-- Functions:      get_or_create_cart, upsert_cart_item,
--                 earn_loyalty_points, redeem_loyalty_points,
--                 update_cart_timestamp, auto_create_invoice
-- Triggers:       trg_cart_item_ts, trg_auto_invoice,
--                 trg_updated_at_carts/cart_items/invoices
-- Views:          v_loyalty_balance, v_cart_summary, v_invoice_summary
-- Indexes:        15 new indexes added
-- ============================================================
