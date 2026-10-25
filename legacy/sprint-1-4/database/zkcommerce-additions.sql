-- ================================================================
-- ZKCommerce v4.1 -- MISSING ADDITIONS
-- Run this AFTER zkcommerce-master.sql on a fresh database.
-- Adds: ENUMs, sequence, functions, extra views from phase1+2
-- Safe to run multiple times (IF NOT EXISTS throughout)
-- ================================================================

--  ENUMS (from original schema) 
-- These add type safety. Master uses VARCHAR; these add ENUMs.
-- Skipped safely if already created.
DO $$ BEGIN
  CREATE TYPE loyalty_tx_type AS ENUM ('earn','redeem','adjust','expire','refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_channel AS ENUM ('email','sms','whatsapp','push');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft','scheduled','sending','sent','paused','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE recipient_status AS ENUM ('pending','sent','delivered','opened','clicked','bounced','unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

--  INVOICE NUMBER SEQUENCE 
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

--  FUNCTIONS (from phase1) 
-- Function: update_cart_timestamp
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE carts SET updated_at = NOW() WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN NEW;
END; $$;

-- Function: earn_loyalty_points
CREATE OR REPLACE FUNCTION earn_loyalty_points(
  p_user_id    BIGINT,
  p_store_id   BIGINT,
  p_order_id   BIGINT,
  p_order_total NUMERIC,
  p_rate       INT DEFAULT 1  -- 1 point per 1 spent
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

-- Function: redeem_loyalty_points
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

-- Function: auto_create_invoice
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

-- Function: get_or_create_cart
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

-- Function: upsert_cart_item
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

--  FUNCTIONS (from phase2) 
-- Function: product_total_stock
CREATE OR REPLACE FUNCTION product_total_stock(p_id BIGINT)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = p_id AND is_active = TRUE;
$$;

--  VIEWS (from phase1) 

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

-- Function: earn points on order;

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

-- Invoice summary per store;

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

--  VIEWS (from phase2) 

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

--  EXTRA INDEXES (from phase2) 
CREATE INDEX IF NOT EXISTS idx_pv_attrs_gin ON product_variants USING gin(attributes);
CREATE INDEX IF NOT EXISTS idx_pv_active    ON product_variants(product_id, is_active)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ws_available ON warehouse_stock(product_id, quantity)
  WHERE quantity = 0;
CREATE INDEX IF NOT EXISTS idx_reviews_pending ON reviews(store_id, created_at DESC)
  WHERE status = 'pending';

ANALYZE;

-- ================================================================
-- DONE. All missing additions applied.
-- Functions added: earn_loyalty_points, redeem_loyalty_points,
--   auto_create_invoice, get_or_create_cart, upsert_cart_item,
--   update_cart_timestamp, product_total_stock, log_inventory_change
-- Views added: v_loyalty_balance, v_cart_summary,
--   v_invoice_summary, v_product_stock
-- Types added: loyalty_tx_type, campaign_channel,
--   campaign_status, recipient_status
-- Sequence added: invoice_number_seq
-- ================================================================
