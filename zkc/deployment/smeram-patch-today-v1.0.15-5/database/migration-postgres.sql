-- ============================================================================
-- ZKCommerce: PostgreSQL Safe Cumulative Migration & Schema Patch
-- Target: PostgreSQL 14+ / Neon / Supabase / Railway / RDS
-- Safe on existing databases: preserves existing orders, customers and products!
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Schema Migrations Ledger
CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "id" VARCHAR(100) NOT NULL PRIMARY KEY,
  "description" VARCHAR(255) DEFAULT NULL,
  "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Merchants
CREATE TABLE IF NOT EXISTS "merchants" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "phone" VARCHAR(30) DEFAULT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" VARCHAR(30) DEFAULT 'merchant',
  "store_id" INT DEFAULT NULL,
  "reset_token" VARCHAR(255) DEFAULT NULL,
  "reset_token_expires" TIMESTAMPTZ DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stores
CREATE TABLE IF NOT EXISTS "stores" (
  "id" BIGSERIAL PRIMARY KEY,
  "merchant_id" INT DEFAULT NULL,
  "store_name" VARCHAR(150) NOT NULL,
  "slug" VARCHAR(100) NOT NULL UNIQUE,
  "custom_domain" VARCHAR(150) DEFAULT NULL,
  "tagline" VARCHAR(255) DEFAULT NULL,
  "hero_headline" VARCHAR(255) DEFAULT NULL,
  "hero_subtext" TEXT DEFAULT NULL,
  "hero_cta_text" VARCHAR(100) DEFAULT 'Shop now',
  "primary_colour" VARCHAR(20) DEFAULT '#ED6375',
  "bg_colour" VARCHAR(20) DEFAULT '#FFF5F7',
  "accent_colour" VARCHAR(20) DEFAULT '#A3B545',
  "logo_url" TEXT DEFAULT NULL,
  "whatsapp_number" VARCHAR(30) DEFAULT NULL,
  "instagram_handle" VARCHAR(100) DEFAULT NULL,
  "address" TEXT DEFAULT NULL,
  "city" VARCHAR(100) DEFAULT 'Chennai',
  "state" VARCHAR(100) DEFAULT 'Tamil Nadu',
  "gst_number" VARCHAR(30) DEFAULT '33DVRPR1801M1Z6',
  "theme_config" JSONB DEFAULT '{}'::jsonb,
  "published_snapshot" JSONB DEFAULT NULL,
  "deployment_settings" JSONB DEFAULT '{}'::jsonb,
  "whatsapp_settings" JSONB DEFAULT '{}'::jsonb,
  "status" VARCHAR(30) DEFAULT 'live',
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "published_snapshot" JSONB DEFAULT NULL;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "deployment_settings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "whatsapp_settings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "gst_number" VARCHAR(30) DEFAULT '33DVRPR1801M1Z6';

-- 4. Categories
CREATE TABLE IF NOT EXISTS "categories" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "image_url" TEXT DEFAULT NULL,
  "sort_order" INT DEFAULT 0,
  "active" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_cat_store_pg" ON "categories" ("store_id");
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_url" TEXT DEFAULT NULL;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order" INT DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT TRUE;

-- 5. Products
CREATE TABLE IF NOT EXISTS "products" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "category_id" BIGINT DEFAULT NULL,
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(200) DEFAULT NULL,
  "sku" VARCHAR(100) DEFAULT NULL,
  "price" NUMERIC(12,2) NOT NULL,
  "compare_price" NUMERIC(12,2) DEFAULT NULL,
  "cost_price" NUMERIC(12,2) DEFAULT NULL,
  "gst_rate" VARCHAR(10) DEFAULT '12',
  "hsn_code" VARCHAR(20) DEFAULT '30049011',
  "brand" VARCHAR(120) DEFAULT 'Smeram Naturals',
  "product_size" VARCHAR(60) DEFAULT '100 ml',
  "net_quantity_value" NUMERIC(10,2) DEFAULT 100.00,
  "net_quantity_unit" VARCHAR(20) DEFAULT 'ml',
  "quantity" INT NOT NULL DEFAULT 100,
  "low_stock_threshold" INT DEFAULT 15,
  "badge_text" VARCHAR(60) DEFAULT NULL,
  "offer_text" VARCHAR(120) DEFAULT NULL,
  "show_offer" VARCHAR(10) DEFAULT 'hide',
  "description" TEXT DEFAULT NULL,
  "ingredients" TEXT DEFAULT NULL,
  "user_instructions" TEXT DEFAULT NULL,
  "benefits" TEXT DEFAULT NULL,
  "additional_note" VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.',
  "images" JSONB DEFAULT '[]'::jsonb,
  "in_stock" BOOLEAN DEFAULT TRUE,
  "active" BOOLEAN DEFAULT TRUE,
  "featured" BOOLEAN DEFAULT FALSE,
  "variants" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_prod_store_pg" ON "products" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_prod_cat_pg" ON "products" ("category_id");

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(100) DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compare_price" NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cost_price" NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "gst_rate" VARCHAR(10) DEFAULT '12';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hsn_code" VARCHAR(20) DEFAULT '30049011';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" VARCHAR(120) DEFAULT 'Smeram Naturals';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_size" VARCHAR(60) DEFAULT '100 ml';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "net_quantity_value" NUMERIC(10,2) DEFAULT 100.00;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "net_quantity_unit" VARCHAR(20) DEFAULT 'ml';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "quantity" INT NOT NULL DEFAULT 100;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "low_stock_threshold" INT DEFAULT 15;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "badge_text" VARCHAR(60) DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "offer_text" VARCHAR(120) DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "show_offer" VARCHAR(10) DEFAULT 'hide';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ingredients" TEXT DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "user_instructions" TEXT DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "benefits" TEXT DEFAULT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "additional_note" VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "in_stock" BOOLEAN DEFAULT TRUE;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT TRUE;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN DEFAULT FALSE;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variants" JSONB DEFAULT '[]'::jsonb;

-- 6. Product Stock
CREATE TABLE IF NOT EXISTS "product_stock" (
  "store_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "variant_id" VARCHAR(40) NOT NULL DEFAULT '',
  "quantity" INT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("product_id", "variant_id")
);
CREATE INDEX IF NOT EXISTS "idx_stock_store_pg" ON "product_stock" ("store_id");

-- 7. Inventory Movements
CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "variant_id" VARCHAR(40) NOT NULL DEFAULT '',
  "delta" INT NOT NULL,
  "quantity_after" INT NOT NULL,
  "reason" VARCHAR(40) NOT NULL,
  "order_id" BIGINT DEFAULT NULL,
  "note" VARCHAR(255) DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_inv_store_pg" ON "inventory_movements" ("store_id");

-- 8. Orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL DEFAULT 2,
  "order_number" VARCHAR(50) NOT NULL UNIQUE,
  "customer_name" VARCHAR(120) NOT NULL,
  "customer_phone" VARCHAR(30) NOT NULL,
  "customer_email" VARCHAR(120) DEFAULT NULL,
  "shipping_address" TEXT NOT NULL,
  "city" VARCHAR(100) DEFAULT NULL,
  "state" VARCHAR(100) DEFAULT 'Tamil Nadu',
  "pincode" VARCHAR(20) DEFAULT NULL,
  "items_json" JSONB NOT NULL,
  "subtotal" NUMERIC(12,2) DEFAULT NULL,
  "total_amount" NUMERIC(12,2) NOT NULL,
  "discount_amount" NUMERIC(12,2) DEFAULT 0.00,
  "shipping_amount" NUMERIC(12,2) DEFAULT 0.00,
  "gst_amount" NUMERIC(12,2) DEFAULT 0.00,
  "gst_rate" NUMERIC(5,2) DEFAULT 12.00,
  "payment_method" VARCHAR(30) DEFAULT 'cod',
  "payment_status" VARCHAR(30) DEFAULT 'pending',
  "order_status" VARCHAR(30) DEFAULT 'new',
  "tracking_number" VARCHAR(80) DEFAULT NULL,
  "courier" VARCHAR(80) DEFAULT NULL,
  "tracking_url" TEXT DEFAULT NULL,
  "coupon_code" VARCHAR(50) DEFAULT NULL,
  "shipping_rate_id" BIGINT DEFAULT NULL,
  "payment_gateway" VARCHAR(40) DEFAULT 'cod',
  "razorpay_order_id" VARCHAR(64) DEFAULT NULL,
  "razorpay_payment_id" VARCHAR(64) DEFAULT NULL,
  "razorpay_signature" VARCHAR(255) DEFAULT NULL,
  "stock_deducted" BOOLEAN DEFAULT FALSE,
  "notes" TEXT DEFAULT NULL,
  "paid_at" TIMESTAMPTZ DEFAULT NULL,
  "shipped_at" TIMESTAMPTZ DEFAULT NULL,
  "delivered_at" TIMESTAMPTZ DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_order_store_pg" ON "orders" ("store_id");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_amount" NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "gst_amount" NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "gst_rate" NUMERIC(5,2) DEFAULT 12.00;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(30) DEFAULT 'cod';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(30) DEFAULT 'pending';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_status" VARCHAR(30) DEFAULT 'new';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" VARCHAR(80) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier" VARCHAR(80) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_url" TEXT DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_code" VARCHAR(50) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_rate_id" BIGINT DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_gateway" VARCHAR(40) DEFAULT 'cod';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "razorpay_order_id" VARCHAR(64) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" VARCHAR(64) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "razorpay_signature" VARCHAR(255) DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stock_deducted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipped_at" TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NULL;

-- 9. Legacy / client alias smeram_orders
CREATE TABLE IF NOT EXISTS "smeram_orders" (
  "id" SERIAL PRIMARY KEY,
  "store_id" INT DEFAULT 2,
  "order_number" VARCHAR(32) NOT NULL UNIQUE,
  "customer_name" VARCHAR(120) NOT NULL,
  "customer_phone" VARCHAR(20) NOT NULL,
  "customer_email" VARCHAR(120) NULL,
  "shipping_address" TEXT NOT NULL,
  "city" VARCHAR(60) NOT NULL,
  "state" VARCHAR(60) DEFAULT 'Tamil Nadu',
  "pincode" VARCHAR(10) NOT NULL,
  "items_json" TEXT NOT NULL,
  "subtotal" NUMERIC(10,2) NOT NULL,
  "discount_amount" NUMERIC(10,2) DEFAULT 0.00,
  "gst_rate" NUMERIC(5,2) DEFAULT 0.00,
  "gst_amount" NUMERIC(10,2) DEFAULT 0.00,
  "shipping_amount" NUMERIC(10,2) DEFAULT 0.00,
  "total_amount" NUMERIC(10,2) NOT NULL,
  "payment_method" VARCHAR(20) DEFAULT 'cod',
  "payment_status" VARCHAR(20) DEFAULT 'pending',
  "order_status" VARCHAR(20) DEFAULT 'new',
  "payment_id" VARCHAR(64) NULL,
  "tracking_number" VARCHAR(60) NULL,
  "courier" VARCHAR(60) NULL,
  "notes" TEXT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Order Items
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" BIGSERIAL PRIMARY KEY,
  "order_id" BIGINT NOT NULL,
  "product_id" BIGINT DEFAULT NULL,
  "product_name" VARCHAR(255) NOT NULL,
  "variant_id" VARCHAR(40) DEFAULT '',
  "quantity" INT NOT NULL DEFAULT 1,
  "unit_price" NUMERIC(12,2) NOT NULL,
  "total_price" NUMERIC(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_item_order_pg" ON "order_items" ("order_id");

-- 11. Coupons
CREATE TABLE IF NOT EXISTS "coupons" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "discount_type" VARCHAR(10) NOT NULL,
  "discount_value" NUMERIC(10,2) NOT NULL,
  "minimum_order" INT NOT NULL DEFAULT 0,
  "usage_limit" INT DEFAULT NULL,
  "used_count" INT NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMPTZ DEFAULT NULL,
  "expires_at" TIMESTAMPTZ DEFAULT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("store_id", "code")
);

-- 12. Shipping Rates
CREATE TABLE IF NOT EXISTS "shipping_rates" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "rate" INT NOT NULL DEFAULT 0,
  "free_above" INT DEFAULT NULL,
  "postal_prefix" VARCHAR(12) DEFAULT NULL,
  "estimated_days" VARCHAR(60) DEFAULT NULL,
  "courier" VARCHAR(60) DEFAULT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS "idx_rates_store_pg" ON "shipping_rates" ("store_id");

-- 13. Invoices
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "order_id" BIGINT NOT NULL UNIQUE,
  "invoice_number" VARCHAR(50) NOT NULL UNIQUE,
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Inquiries
CREATE TABLE IF NOT EXISTS "inquiries" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "kind" VARCHAR(30) NOT NULL DEFAULT 'contact',
  "name" VARCHAR(120) DEFAULT NULL,
  "email" VARCHAR(120) DEFAULT NULL,
  "phone" VARCHAR(30) DEFAULT NULL,
  "message" TEXT DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Legacy alias smeram_inquiries
CREATE TABLE IF NOT EXISTS "smeram_inquiries" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "phone" VARCHAR(20) NOT NULL,
  "email" VARCHAR(120) NULL,
  "product_name" VARCHAR(120) NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Store Pages
CREATE TABLE IF NOT EXISTS "store_pages" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "slug" VARCHAR(150) NOT NULL,
  "content" TEXT DEFAULT NULL,
  "status" VARCHAR(30) DEFAULT 'published',
  "sort_order" INT DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_pages_store_pg" ON "store_pages" ("store_id", "slug");

-- 17. WhatsApp Outbox
CREATE TABLE IF NOT EXISTS "whatsapp_outbox" (
  "id" BIGSERIAL PRIMARY KEY,
  "store_id" BIGINT NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "to_phone" VARCHAR(20) NOT NULL,
  "message" TEXT NOT NULL,
  "provider" VARCHAR(20) DEFAULT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "error" TEXT DEFAULT NULL,
  "order_id" BIGINT DEFAULT NULL,
  "product_id" BIGINT DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMPTZ DEFAULT NULL
);

-- 18. GST Settings
CREATE TABLE IF NOT EXISTS "gst_settings" (
  "store_id" BIGINT PRIMARY KEY,
  "gstin" VARCHAR(30) DEFAULT NULL,
  "state_code" VARCHAR(10) DEFAULT '33',
  "default_rate" NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Record migration entry
INSERT INTO "schema_migrations" ("id", "description")
VALUES ('010_modern_parity_postgres', 'PostgreSQL Parity with MySQL v1.0.12 schema and columns')
ON CONFLICT ("id") DO NOTHING;
