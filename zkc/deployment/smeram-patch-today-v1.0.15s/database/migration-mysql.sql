-- ============================================================================
-- ZKCommerce: MySQL Safe Cumulative Migration & Schema Patch
-- Target: GoDaddy / cPanel / MariaDB / MySQL 5.7+ / 8.0+
-- Safe on existing databases: preserves existing orders, customers and products!
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Schema Migrations Ledger
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `description` VARCHAR(255) DEFAULT NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Merchants
CREATE TABLE IF NOT EXISTS `merchants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(30) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(30) DEFAULT 'merchant',
  `store_id` INT DEFAULT NULL,
  `reset_token` VARCHAR(255) DEFAULT NULL,
  `reset_token_expires` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Stores
CREATE TABLE IF NOT EXISTS `stores` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `merchant_id` INT DEFAULT NULL,
  `store_name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `custom_domain` VARCHAR(150) DEFAULT NULL,
  `tagline` VARCHAR(255) DEFAULT NULL,
  `hero_headline` VARCHAR(255) DEFAULT NULL,
  `hero_subtext` TEXT DEFAULT NULL,
  `hero_cta_text` VARCHAR(100) DEFAULT 'Shop now',
  `primary_colour` VARCHAR(20) DEFAULT '#ED6375',
  `bg_colour` VARCHAR(20) DEFAULT '#FFF5F7',
  `accent_colour` VARCHAR(20) DEFAULT '#A3B545',
  `logo_url` TEXT DEFAULT NULL,
  `whatsapp_number` VARCHAR(30) DEFAULT NULL,
  `instagram_handle` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT 'Chennai',
  `state` VARCHAR(100) DEFAULT 'Tamil Nadu',
  `gst_number` VARCHAR(30) DEFAULT '33DVRPR1801M1Z6',
  `theme_config` LONGTEXT DEFAULT NULL,
  `published_snapshot` LONGTEXT DEFAULT NULL,
  `deployment_settings` LONGTEXT DEFAULT NULL,
  `whatsapp_settings` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'live',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Categories
CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `image_url` TEXT DEFAULT NULL,
  `sort_order` INT DEFAULT 0,
  `active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cat_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Products
CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `category_id` BIGINT DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(200) DEFAULT NULL,
  `sku` VARCHAR(100) DEFAULT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `compare_price` DECIMAL(12,2) DEFAULT NULL,
  `cost_price` DECIMAL(12,2) DEFAULT NULL,
  `gst_rate` VARCHAR(10) DEFAULT '12',
  `hsn_code` VARCHAR(20) DEFAULT '30049011',
  `brand` VARCHAR(120) DEFAULT 'Smeram Naturals',
  `product_size` VARCHAR(60) DEFAULT '100 ml',
  `net_quantity_value` DECIMAL(10,2) DEFAULT 100.00,
  `net_quantity_unit` VARCHAR(20) DEFAULT 'ml',
  `quantity` INT NOT NULL DEFAULT 100,
  `low_stock_threshold` INT DEFAULT 15,
  `badge_text` VARCHAR(60) DEFAULT NULL,
  `offer_text` VARCHAR(120) DEFAULT NULL,
  `show_offer` VARCHAR(10) DEFAULT 'hide',
  `description` TEXT DEFAULT NULL,
  `ingredients` TEXT DEFAULT NULL,
  `user_instructions` TEXT DEFAULT NULL,
  `benefits` TEXT DEFAULT NULL,
  `additional_note` VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.',
  `images` LONGTEXT DEFAULT NULL,
  `in_stock` TINYINT(1) DEFAULT 1,
  `active` TINYINT(1) DEFAULT 1,
  `featured` TINYINT(1) DEFAULT 0,
  `variants` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_prod_store` (`store_id`),
  INDEX `idx_prod_cat` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Product Stock
CREATE TABLE IF NOT EXISTS `product_stock` (
  `store_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` VARCHAR(40) NOT NULL DEFAULT '',
  `quantity` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`, `variant_id`),
  INDEX `idx_stock_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Inventory Movements
CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` VARCHAR(40) NOT NULL DEFAULT '',
  `delta` INT NOT NULL,
  `quantity_after` INT NOT NULL,
  `reason` VARCHAR(40) NOT NULL,
  `order_id` BIGINT DEFAULT NULL,
  `note` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mov_product` (`product_id`, `created_at`),
  INDEX `idx_mov_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Orders (Core Standard)
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL DEFAULT 2,
  `order_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_name` VARCHAR(120) NOT NULL,
  `customer_phone` VARCHAR(30) NOT NULL,
  `customer_email` VARCHAR(120) DEFAULT NULL,
  `shipping_address` TEXT NOT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT 'Tamil Nadu',
  `pincode` VARCHAR(20) DEFAULT NULL,
  `items_json` LONGTEXT NOT NULL,
  `subtotal` DECIMAL(12,2) DEFAULT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `discount_amount` DECIMAL(12,2) DEFAULT 0.00,
  `shipping_amount` DECIMAL(12,2) DEFAULT 0.00,
  `gst_amount` DECIMAL(12,2) DEFAULT 0.00,
  `gst_rate` DECIMAL(5,2) DEFAULT 12.00,
  `payment_method` VARCHAR(30) DEFAULT 'cod',
  `payment_status` VARCHAR(30) DEFAULT 'pending',
  `order_status` VARCHAR(30) DEFAULT 'new',
  `tracking_number` VARCHAR(80) DEFAULT NULL,
  `courier` VARCHAR(80) DEFAULT NULL,
  `tracking_url` TEXT DEFAULT NULL,
  `coupon_code` VARCHAR(50) DEFAULT NULL,
  `shipping_rate_id` BIGINT DEFAULT NULL,
  `payment_gateway` VARCHAR(40) DEFAULT 'cod',
  `razorpay_order_id` VARCHAR(64) DEFAULT NULL,
  `razorpay_payment_id` VARCHAR(64) DEFAULT NULL,
  `razorpay_signature` VARCHAR(255) DEFAULT NULL,
  `stock_deducted` TINYINT(1) DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `shipped_at` DATETIME DEFAULT NULL,
  `delivered_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_store` (`store_id`, `created_at`),
  INDEX `idx_orders_status` (`store_id`, `order_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Smeram Orders (GoDaddy Direct Order Compatibility)
CREATE TABLE IF NOT EXISTS `smeram_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` INT DEFAULT 2,
  `order_number` VARCHAR(32) NOT NULL UNIQUE,
  `customer_name` VARCHAR(120) NOT NULL,
  `customer_phone` VARCHAR(20) NOT NULL,
  `customer_email` VARCHAR(120) NULL,
  `shipping_address` TEXT NOT NULL,
  `city` VARCHAR(60) NOT NULL,
  `state` VARCHAR(60) DEFAULT 'Tamil Nadu',
  `pincode` VARCHAR(10) NOT NULL,
  `items_json` TEXT NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
  `gst_rate` DECIMAL(5,2) DEFAULT 0.00,
  `gst_amount` DECIMAL(10,2) DEFAULT 0.00,
  `shipping_amount` DECIMAL(10,2) DEFAULT 0.00,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `payment_method` VARCHAR(20) DEFAULT 'cod',
  `payment_status` VARCHAR(20) DEFAULT 'pending',
  `order_status` VARCHAR(20) DEFAULT 'new',
  `payment_id` VARCHAR(64) NULL,
  `tracking_number` VARCHAR(60) NULL,
  `courier` VARCHAR(60) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Order Items
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT DEFAULT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_id` VARCHAR(40) DEFAULT '',
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `total_price` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_items_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Coupons
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` BIGINT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `discount_type` VARCHAR(10) NOT NULL,
  `discount_value` DECIMAL(10,2) NOT NULL,
  `minimum_order` INT NOT NULL DEFAULT 0,
  `usage_limit` INT DEFAULT NULL,
  `used_count` INT NOT NULL DEFAULT 0,
  `starts_at` DATETIME DEFAULT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_coupon_code` (`store_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Shipping Rates
CREATE TABLE IF NOT EXISTS `shipping_rates` (
  `id` BIGINT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `rate` INT NOT NULL DEFAULT 0,
  `free_above` INT DEFAULT NULL,
  `postal_prefix` VARCHAR(12) DEFAULT NULL,
  `estimated_days` VARCHAR(60) DEFAULT NULL,
  `courier` VARCHAR(60) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  INDEX `idx_rates_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL UNIQUE,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Inquiries
CREATE TABLE IF NOT EXISTS `inquiries` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `kind` VARCHAR(30) NOT NULL DEFAULT 'contact',
  `name` VARCHAR(120) DEFAULT NULL,
  `email` VARCHAR(120) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_inquiries_store` (`store_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Legacy alias smeram_inquiries
CREATE TABLE IF NOT EXISTS `smeram_inquiries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(120) NULL,
  `product_name` VARCHAR(120) NULL,
  `message` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Store Pages
CREATE TABLE IF NOT EXISTS `store_pages` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'published',
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_pages_store_slug` (`store_id`, `slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. WhatsApp Outbox
CREATE TABLE IF NOT EXISTS `whatsapp_outbox` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `kind` VARCHAR(30) NOT NULL,
  `to_phone` VARCHAR(20) NOT NULL,
  `message` TEXT NOT NULL,
  `provider` VARCHAR(20) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `error` TEXT DEFAULT NULL,
  `order_id` BIGINT DEFAULT NULL,
  `product_id` BIGINT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` DATETIME DEFAULT NULL,
  INDEX `idx_outbox_store` (`store_id`, `status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. GST Settings
CREATE TABLE IF NOT EXISTS `gst_settings` (
  `store_id` BIGINT PRIMARY KEY,
  `gstin` VARCHAR(30) DEFAULT NULL,
  `state_code` VARCHAR(10) DEFAULT '33',
  `default_rate` DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safe column additions using Stored Procedure
DROP PROCEDURE IF EXISTS _zkc_add_col;
DELIMITER ;;
CREATE PROCEDURE _zkc_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN col_def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
    PREPARE stmt FROM @s;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END;;
DELIMITER ;

CALL _zkc_add_col('products', 'sku', 'VARCHAR(100) DEFAULT NULL');
CALL _zkc_add_col('products', 'compare_price', 'DECIMAL(12,2) DEFAULT NULL');
CALL _zkc_add_col('products', 'cost_price', 'DECIMAL(12,2) DEFAULT NULL');
CALL _zkc_add_col('products', 'gst_rate', 'VARCHAR(10) DEFAULT "12"');
CALL _zkc_add_col('products', 'hsn_code', 'VARCHAR(20) DEFAULT "30049011"');
CALL _zkc_add_col('products', 'brand', 'VARCHAR(120) DEFAULT "Smeram Naturals"');
CALL _zkc_add_col('products', 'product_size', 'VARCHAR(60) DEFAULT "100 ml"');
CALL _zkc_add_col('products', 'net_quantity_value', 'DECIMAL(10,2) DEFAULT 100.00');
CALL _zkc_add_col('products', 'net_quantity_unit', 'VARCHAR(20) DEFAULT "ml"');
CALL _zkc_add_col('products', 'quantity', 'INT NOT NULL DEFAULT 100');
CALL _zkc_add_col('products', 'low_stock_threshold', 'INT DEFAULT 15');
CALL _zkc_add_col('products', 'badge_text', 'VARCHAR(60) DEFAULT NULL');
CALL _zkc_add_col('products', 'offer_text', 'VARCHAR(120) DEFAULT NULL');
CALL _zkc_add_col('products', 'show_offer', 'VARCHAR(10) DEFAULT "hide"');
CALL _zkc_add_col('products', 'description', 'TEXT DEFAULT NULL');
CALL _zkc_add_col('products', 'ingredients', 'TEXT DEFAULT NULL');
CALL _zkc_add_col('products', 'user_instructions', 'TEXT DEFAULT NULL');
CALL _zkc_add_col('products', 'benefits', 'TEXT DEFAULT NULL');
CALL _zkc_add_col('products', 'additional_note', 'VARCHAR(255) DEFAULT "Inclusive of GST and free shipping."');
CALL _zkc_add_col('products', 'variants', 'LONGTEXT DEFAULT NULL');

CALL _zkc_add_col('orders', 'subtotal', 'DECIMAL(12,2) DEFAULT NULL');
CALL _zkc_add_col('orders', 'discount_amount', 'DECIMAL(12,2) DEFAULT 0.00');
CALL _zkc_add_col('orders', 'shipping_amount', 'DECIMAL(12,2) DEFAULT 0.00');
CALL _zkc_add_col('orders', 'gst_amount', 'DECIMAL(12,2) DEFAULT 0.00');
CALL _zkc_add_col('orders', 'gst_rate', 'DECIMAL(5,2) DEFAULT 12.00');
CALL _zkc_add_col('orders', 'tracking_number', 'VARCHAR(80) DEFAULT NULL');
CALL _zkc_add_col('orders', 'courier', 'VARCHAR(80) DEFAULT NULL');
CALL _zkc_add_col('orders', 'tracking_url', 'TEXT DEFAULT NULL');
CALL _zkc_add_col('orders', 'coupon_code', 'VARCHAR(50) DEFAULT NULL');
CALL _zkc_add_col('orders', 'shipping_rate_id', 'BIGINT DEFAULT NULL');
CALL _zkc_add_col('orders', 'payment_gateway', 'VARCHAR(40) DEFAULT "cod"');
CALL _zkc_add_col('orders', 'razorpay_order_id', 'VARCHAR(64) DEFAULT NULL');
CALL _zkc_add_col('orders', 'razorpay_payment_id', 'VARCHAR(64) DEFAULT NULL');
CALL _zkc_add_col('orders', 'razorpay_signature', 'VARCHAR(255) DEFAULT NULL');
CALL _zkc_add_col('orders', 'stock_deducted', 'TINYINT(1) DEFAULT 0');

CALL _zkc_add_col('stores', 'published_snapshot', 'LONGTEXT DEFAULT NULL');
CALL _zkc_add_col('stores', 'deployment_settings', 'LONGTEXT DEFAULT NULL');
CALL _zkc_add_col('stores', 'whatsapp_settings', 'LONGTEXT DEFAULT NULL');

DROP PROCEDURE IF EXISTS _zkc_add_col;

INSERT INTO `schema_migrations` (`id`, `description`, `applied_at`)
VALUES ('010_modern_parity_mysql', 'MySQL Cumulative Parity Patch with full 18 tables', NOW())
ON DUPLICATE KEY UPDATE `applied_at` = NOW();

SET FOREIGN_KEY_CHECKS = 1;
