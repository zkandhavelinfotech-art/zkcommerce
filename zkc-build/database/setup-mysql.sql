-- =====================================================================
-- ZKCommerce v4.1 — MySQL Complete Setup Script (GoDaddy & Local)
-- Creates Database, User, Permissions, Tables & Seed Data
-- =====================================================================

-- 1. CREATE DATABASE
CREATE DATABASE IF NOT EXISTS `zkcommerce_db` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 2. CREATE USER & GRANT PRIVILEGES
-- Database: zkcommerce_db
-- Username: zkc_user
-- Password: ZkCommercePass2026!
CREATE USER IF NOT EXISTS 'zkc_user'@'localhost' IDENTIFIED BY 'ZkCommercePass2026!';
GRANT ALL PRIVILEGES ON `zkcommerce_db`.* TO 'zkc_user'@'localhost';

-- Also allow connection from any host (useful for external cPanel access)
CREATE USER IF NOT EXISTS 'zkc_user'@'%' IDENTIFIED BY 'ZkCommercePass2026!';
GRANT ALL PRIVILEGES ON `zkcommerce_db`.* TO 'zkc_user'@'%';

FLUSH PRIVILEGES;

-- 3. SELECT DATABASE
USE `zkcommerce_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 4. TABLES CREATION

-- USERS
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `first_name` VARCHAR(80) DEFAULT '',
  `last_name` VARCHAR(80) DEFAULT '',
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` TEXT DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `role` ENUM('admin','merchant','customer') NOT NULL DEFAULT 'customer',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `phone_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `otp_code` VARCHAR(6) DEFAULT NULL,
  `otp_expires_at` DATETIME DEFAULT NULL,
  `reset_token` VARCHAR(100) DEFAULT NULL,
  `reset_token_expires` DATETIME DEFAULT NULL,
  `google_id` VARCHAR(100) DEFAULT NULL,
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- STORES
CREATE TABLE IF NOT EXISTS `stores` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) UNIQUE,
  `plan` ENUM('starter','growth','enterprise') NOT NULL DEFAULT 'starter',
  `status` ENUM('pending','active','suspended','closed') NOT NULL DEFAULT 'active',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `theme` VARCHAR(50) DEFAULT 'sunrise',
  `primary_color` VARCHAR(7) DEFAULT '#FF6B00',
  `logo_url` TEXT DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `whatsapp` VARCHAR(15) DEFAULT NULL,
  `gstin` VARCHAR(15) DEFAULT NULL,
  `trial_ends_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CATEGORIES
CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRODUCTS
CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `category_id` BIGINT DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(200) DEFAULT NULL,
  `sku` VARCHAR(60) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `mrp` DECIMAL(12,2) DEFAULT NULL,
  `cost_price` DECIMAL(12,2) DEFAULT NULL,
  `gst_rate` VARCHAR(10) DEFAULT '12',
  `stock` INT NOT NULL DEFAULT 0,
  `low_stock_alert` INT DEFAULT 5,
  `image_url` TEXT DEFAULT NULL,
  `weight_kg` DECIMAL(6,2) DEFAULT 0.5,
  `is_cod` BOOLEAN DEFAULT TRUE,
  `is_featured` BOOLEAN DEFAULT FALSE,
  `status` ENUM('active','draft','out_of_stock','published','deleted') NOT NULL DEFAULT 'published',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_products_store` (`store_id`),
  INDEX `idx_products_status` (`status`),
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ADDRESSES
CREATE TABLE IF NOT EXISTS `addresses` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `line1` VARCHAR(255) NOT NULL,
  `line2` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `pincode` VARCHAR(20) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `is_default` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ORDERS
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `user_id` BIGINT DEFAULT NULL,
  `address_id` BIGINT DEFAULT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL,
  `status` ENUM('pending','confirmed','packed','shipped','delivered','returned','cancelled','processing') NOT NULL DEFAULT 'pending',
  `payment_status` ENUM('pending','paid','success','failed','refunded') NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(50) DEFAULT 'razorpay',
  `razorpay_order_id` VARCHAR(100) DEFAULT NULL,
  `razorpay_payment_id` VARCHAR(100) DEFAULT NULL,
  `awb_number` VARCHAR(50) DEFAULT NULL,
  `courier` VARCHAR(50) DEFAULT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `shipped_at` DATETIME DEFAULT NULL,
  `delivered_at` DATETIME DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_store` (`store_id`),
  INDEX `idx_orders_user` (`user_id`),
  INDEX `idx_orders_rzp` (`razorpay_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT DEFAULT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(60) DEFAULT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `gst_amount` DECIMAL(12,2) DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PAYMENTS
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `method` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `razorpay_order_id` VARCHAR(100) DEFAULT NULL,
  `razorpay_payment_id` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INVOICES
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `gst_amount` DECIMAL(12,2) NOT NULL,
  `total` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- COUPONS
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `type` ENUM('percentage','fixed','free_shipping') NOT NULL DEFAULT 'percentage',
  `value` DECIMAL(10,2) NOT NULL,
  `min_order_amount` DECIMAL(10,2) DEFAULT 0.00,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`store_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CARTS & ITEMS
CREATE TABLE IF NOT EXISTS `carts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT DEFAULT NULL,
  `guest_token` VARCHAR(64) DEFAULT NULL,
  `store_id` BIGINT NOT NULL,
  `coupon_code` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `cart_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. DEFAULT SEED DATA
INSERT IGNORE INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`)
VALUES (1, 'ZKCommerce Admin', 'admin@zkcommerce.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsGTiV.9k6L1G8mXKdT1jxR3eTxi', 'admin', 1);

INSERT IGNORE INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`)
VALUES (2, 'Rajan Kumar', 'merchant@zkcommerce.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TsGTiV.9k6L1G8mXKdT1jxR3eTxi', 'merchant', 1);

INSERT IGNORE INTO `stores` (`id`, `user_id`, `name`, `slug`, `plan`, `status`, `is_active`)
VALUES (1, 2, 'Rajan Textiles', 'rajanTextiles', 'growth', 'active', 1);

INSERT IGNORE INTO `products` (`id`, `store_id`, `name`, `price`, `stock`, `status`)
VALUES 
(1, 1, 'Kanjivaram Pure Silk Saree', 12500.00, 25, 'published'),
(2, 1, 'Banarasi Brocade Silk Kurta', 4800.00, 30, 'published'),
(3, 1, 'Handwoven Tussar Saree', 6900.00, 15, 'published'),
(4, 1, 'Linen Cotton Casual Shirt', 1899.00, 50, 'published'),
(5, 1, 'Embroidered Velvet Shawl', 3200.00, 20, 'published');

SET FOREIGN_KEY_CHECKS = 1;

-- Output confirmation
SELECT 'ZKCommerce MySQL database setup complete!' AS Status;
