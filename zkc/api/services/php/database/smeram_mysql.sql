-- ============================================================
-- Smeram Naturals — GoDaddy MySQL Database Schema
-- Compatible with MySQL 5.7 / 8.0 / MariaDB on GoDaddy Windows Hosting
-- ============================================================

CREATE TABLE IF NOT EXISTS `smeram_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(32) NOT NULL UNIQUE,
  `customer_name` VARCHAR(120) NOT NULL,
  `customer_phone` VARCHAR(20) NOT NULL,
  `customer_email` VARCHAR(120) NULL,
  `shipping_address` TEXT NOT NULL,
  `city` VARCHAR(60) NOT NULL,
  `state` VARCHAR(60) DEFAULT 'Tamil Nadu',
  `pincode` VARCHAR(10) NOT NULL,
  `items_json` TEXT NOT NULL COMMENT 'JSON array of ordered items, qty, price, size',
  `subtotal` DECIMAL(10,2) NOT NULL,
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
  `shipping_amount` DECIMAL(10,2) DEFAULT 0.00,
  `gst_amount` DECIMAL(10,2) DEFAULT 0.00,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `payment_method` ENUM('cod','razorpay','whatsapp') DEFAULT 'cod',
  `payment_status` ENUM('pending','paid','cod_confirmed') DEFAULT 'pending',
  `order_status` ENUM('new','processing','shipped','delivered','cancelled') DEFAULT 'new',
  `tracking_number` VARCHAR(60) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_order_phone` (`customer_phone`),
  INDEX `idx_order_status` (`order_status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `smeram_inquiries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(120) NULL,
  `product_name` VARCHAR(120) NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `smeram_products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(160) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `product_size` VARCHAR(60) NOT NULL,
  `offer_text` VARCHAR(120) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `compare_price` DECIMAL(10,2) NOT NULL,
  `image_url` VARCHAR(255) NOT NULL,
  `badge` VARCHAR(60) DEFAULT 'Authentic Siddha',
  `description` TEXT,
  `in_stock` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `smeram_products` (`name`, `category`, `product_size`, `offer_text`, `price`, `compare_price`, `image_url`, `badge`, `description`, `in_stock`)
VALUES
('Smeram Naturals Hair Oil', 'Hair Care Oil', '100 ml (Also in 200 ml)', '🎁 Launch Offer: Save ₹50 · 14% OFF', 299.00, 349.00, 'assets/themes/smeram/smeram-box-bottle.jpg', 'Sneha-Kalka-Drava', 'Double Boiled · Double Infused classical Siddha formulation with 11 pure botanical herbs for 100% dandruff control and natural hair volume growth.', 1),
('Mahanarayan Ortho Pain Oil', 'Joint Pain & Orthocare', '100 ml Bottle', '🎁 Relief Special: Save ₹101 · 22% OFF', 349.00, 450.00, 'assets/themes/smeram/ortho-pain.jpg', 'Fast Relief', 'Deep penetrating herbal warmth for knee stiffness, joint mobility, muscular strain, and cervical comfort. Contains Gandhapura and Shallaki.', 1),
('Ayurgold Kumkumadi Face Oil', 'Ayurgold Face Care', '30 ml Dropper Pack', '🎁 Festive Glow: Save ₹200 · 29% OFF', 499.00, 699.00, 'assets/themes/smeram/face-care.jpg', 'Ayurgold Radiance', 'Kashmiri Saffron, Sandalwood, and 24K Radiance botanical extracts for blemish reduction and luminous, youthful skin tone.', 1),
('Vedic A2 Desi Gir Cow Bilona Ghee', 'Health Foods', '500 ml Glass Jar', '🎁 Pure Vedic Offer: Save ₹200 · 20% OFF', 799.00, 999.00, 'assets/themes/smeram/health-foods.jpg', 'A2 Vedic Bilona', 'Hand-churned from curd of grass-fed native Indian Gir cows. Rich in natural aroma, gut-friendly butyric acid, and vital micronutrients.', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);
