-- ============================================================
-- Smeram Naturals — Complete MySQL Database Reset & Seed Script
-- Target: GoDaddy Windows Hosting / cPanel / MariaDB / MySQL 5.7+ / 8.0+
-- Schema Version: v1.0.12 (Cumulative clean build)
--
-- How to run:
-- 1. In phpMyAdmin: Select database -> click "Import" or "SQL" -> Paste this file -> Go.
-- 2. In CLI: mysql -u USER -p DATABASE_NAME < smeram_full_reset_and_seed.sql
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. DROP ALL EXISTING TABLES CLEANLY ──
DROP TABLE IF EXISTS `whatsapp_outbox`;
DROP TABLE IF EXISTS `invoices`;
DROP TABLE IF EXISTS `smeram_inquiries`;
DROP TABLE IF EXISTS `inquiries`;
DROP TABLE IF EXISTS `shipping_rates`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `smeram_orders`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `inventory_movements`;
DROP TABLE IF EXISTS `product_stock`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `store_pages`;
DROP TABLE IF EXISTS `gst_settings`;
DROP TABLE IF EXISTS `stores`;
DROP TABLE IF EXISTS `merchants`;
DROP TABLE IF EXISTS `schema_migrations`;

-- ── 2. CREATE SCHEMA LEDGER & CORE TABLES ──

-- Migration ledger
CREATE TABLE `schema_migrations` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `description` VARCHAR(255) DEFAULT NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Merchants / Admin Logins
CREATE TABLE `merchants` (
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

-- Stores
CREATE TABLE `stores` (
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
  `bg_colour` VARCHAR(20) DEFAULT '#FFFFFF',
  `accent_colour` VARCHAR(20) DEFAULT '#A3B545',
  `logo_url` TEXT DEFAULT NULL,
  `whatsapp_number` VARCHAR(30) DEFAULT NULL,
  `instagram_handle` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `gst_number` VARCHAR(30) DEFAULT NULL,
  `theme_config` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'published',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories
CREATE TABLE `categories` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `image_url` TEXT DEFAULT NULL,
  `sort_order` INT DEFAULT 0,
  `active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cat_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products
CREATE TABLE `products` (
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
  `product_size` VARCHAR(60) DEFAULT NULL,
  `offer_text` VARCHAR(120) DEFAULT NULL,
  `badge_text` VARCHAR(60) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `ingredients` TEXT DEFAULT NULL,
  `user_instructions` TEXT DEFAULT NULL,
  `benefits` TEXT DEFAULT NULL,
  `additional_note` VARCHAR(255) DEFAULT 'Inclusive of GST and free shipping.',
  `images` LONGTEXT DEFAULT NULL,
  `quantity` INT DEFAULT 100,
  `in_stock` TINYINT(1) DEFAULT 1,
  `active` TINYINT(1) DEFAULT 1,
  `featured` TINYINT(1) DEFAULT 0,
  `variants` LONGTEXT DEFAULT NULL,
  `net_quantity_value` DECIMAL(10,2) DEFAULT NULL,
  `net_quantity_unit` VARCHAR(10) DEFAULT NULL,
  `low_stock_threshold` INT DEFAULT NULL,
  `show_offer` TINYINT(1) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_prod_store` (`store_id`),
  INDEX `idx_prod_cat` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product Stock
CREATE TABLE `product_stock` (
  `store_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `variant_id` VARCHAR(40) NOT NULL DEFAULT '',
  `quantity` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`, `variant_id`),
  INDEX `idx_stock_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inventory Movements
CREATE TABLE `inventory_movements` (
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
  INDEX `idx_mov_product` (`product_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders (Core Standard)
CREATE TABLE `orders` (
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
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `gst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping_rate_id` BIGINT DEFAULT NULL,
  `coupon_code` VARCHAR(50) DEFAULT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(30) DEFAULT 'cod',
  `payment_status` VARCHAR(30) DEFAULT 'pending',
  `payment_gateway` VARCHAR(40) DEFAULT 'razorpay',
  `order_status` VARCHAR(30) DEFAULT 'new',
  `razorpay_order_id` VARCHAR(64) DEFAULT NULL,
  `razorpay_payment_id` VARCHAR(64) DEFAULT NULL,
  `razorpay_signature` VARCHAR(255) DEFAULT NULL,
  `stock_deducted` TINYINT(1) NOT NULL DEFAULT 0,
  `paid_at` DATETIME DEFAULT NULL,
  `tracking_number` VARCHAR(80) DEFAULT NULL,
  `courier` VARCHAR(60) DEFAULT NULL,
  `tracking_url` TEXT DEFAULT NULL,
  `shipped_at` DATETIME DEFAULT NULL,
  `delivered_at` DATETIME DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_store_created` (`store_id`, `created_at`),
  INDEX `idx_orders_phone` (`store_id`, `customer_phone`),
  INDEX `idx_orders_rzp_order` (`razorpay_order_id`),
  INDEX `idx_orders_tracking` (`store_id`, `tracking_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Smeram Orders (GoDaddy Direct Order Compatibility)
CREATE TABLE `smeram_orders` (
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
  `shipping_rate_id` INT NULL,
  `coupon_code` VARCHAR(50) NULL,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `payment_method` VARCHAR(30) DEFAULT 'cod',
  `payment_status` VARCHAR(30) DEFAULT 'pending',
  `order_status` VARCHAR(30) DEFAULT 'new',
  `razorpay_order_id` VARCHAR(64) NULL,
  `razorpay_payment_id` VARCHAR(64) NULL,
  `razorpay_signature` VARCHAR(255) NULL,
  `courier` VARCHAR(60) NULL,
  `tracking_number` VARCHAR(60) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_smeram_orders_phone` (`customer_phone`),
  INDEX `idx_smeram_orders_status` (`order_status`),
  INDEX `idx_smeram_orders_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Items
CREATE TABLE `order_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT DEFAULT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `variant_id` VARCHAR(40) DEFAULT '',
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `total_price` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_item_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coupons
CREATE TABLE `coupons` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
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

-- Shipping Rates
CREATE TABLE `shipping_rates` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
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

-- Invoices
CREATE TABLE `invoices` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL UNIQUE,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inquiries
CREATE TABLE `inquiries` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `kind` VARCHAR(30) NOT NULL DEFAULT 'contact',
  `name` VARCHAR(120) DEFAULT NULL,
  `email` VARCHAR(120) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `smeram_inquiries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(120) NULL,
  `product_name` VARCHAR(120) NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Store Pages
CREATE TABLE `store_pages` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `status` VARCHAR(30) DEFAULT 'published',
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pages_store` (`store_id`, `slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WhatsApp Outbox
CREATE TABLE `whatsapp_outbox` (
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

-- GST Settings
CREATE TABLE `gst_settings` (
  `store_id` BIGINT PRIMARY KEY,
  `gstin` VARCHAR(30) DEFAULT NULL,
  `state_code` VARCHAR(10) DEFAULT '33',
  `default_rate` DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 3. SEED INITIAL DATA ──

-- Merchants (password: demo1234)
INSERT INTO `merchants` (`id`, `name`, `email`, `phone`, `password_hash`, `role`, `store_id`) VALUES
(1, 'ZKCommerce Product Owner', 'admin@zkcommerce.in', '+91 90000 00001', '$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS', 'admin', NULL),
(2, 'Smeram Store Owner', 'merchant@smeramnaturals.in', '+91 75399 72026', '$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS', 'merchant', 2),
(3, 'Miliro Store Owner', 'merchant@miliro.in', '+91 44 75399 72026', '$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS', 'merchant', 1),
(4, 'Demo Store Owner', 'merchant@zkdemo.in', '+91 90000 00002', '$2a$12$Oxy6/jhpllDdPnQTRzFi3ObAhOukEaTNFWqI7nO/Q8eo7Eouz3gDS', 'merchant', 3);

-- Smeram Naturals Store
INSERT INTO `stores` (`id`, `merchant_id`, `store_name`, `slug`, `custom_domain`, `tagline`, `hero_headline`, `hero_subtext`, `hero_cta_text`, `primary_colour`, `bg_colour`, `accent_colour`, `logo_url`, `whatsapp_number`, `instagram_handle`, `address`, `city`, `state`, `theme_config`, `status`)
VALUES (2, 2, 'Smeram Naturals', 'smeram', 'smeram-naturals.in',
  'Authentic Siddha & Ayurvedic wellness', 'Shop by Ayurvedic Category',
  'Authentic Siddha formulations, Ayurgold face care, orthocare and Vedic health foods.',
  'Buy Now — ₹349', '#ED6375', '#FFF5F7', '#A3B545',
  '/assets/themes/smeram/smeram-logo.png', '+91 75399 72026', '@smeramnaturals',
  '22/13 Rajaveedhi Street, Choolaimedu', 'Chennai', 'Tamil Nadu',
  '{"design":"smeram","template_id":"smeram-natural","style_preset":"smeram","primary_colour":"#ED6375","bg_colour":"#FFF5F7","accent_colour":"#A3B545","logo_url":"/assets/themes/smeram/smeram-logo.png","sections":{"nav":{"menu":[{"page":"about-us","type":"page","label":"About Us"},{"type":"shop","label":"Shop"},{"type":"contact","label":"Contact Us"}]},"why":{"text":"Centuries of documented Siddha knowledge blended with clinical hygiene. Smeram Industries produces uncompromised natural formulations without synthetic shortcuts.","nav_label":"Why Smeram Naturals"},"hero":{"image":""},"products":{"visible":false},"announcement":{"visible":false}},"section_order":["trust","hero","products","why","ingredients","reviews","contact"],"fields":{"hero_h1":"Shop by Ayurvedic Category","why_tag":"Siddha Formulation Excellence","ann_show":false,"ann_text":"🌿 Smeram Naturals · Sneha-Kalka-Drava Siddha Formulation · Free Shipping Above ₹399 Across India","hero_sub":"🌸 Siddha & Ayurvedic Formulations","nav_logo":"/assets/themes/smeram/smeram-logo.png","body_font":"Inter","hero_desc":"Choose from our pure Siddha hair care oils, joint mobility remedies, Ayurgold face care, and Vedic health foods. Click any category box below to explore products.","hero_font":"Playfair Display","why_heading":"Why Smeram Naturals?","contact_email":"smeramindustries@gmail.com","contact_phone":"91-44-75399 72026","products_heading":"All Products","footer_text":"Smeram Industries — Traditional Siddha Formulation Hair Oils & Authentic Ayurvedic Wellness crafted with double boiled infusion.","trust_items":["VEGAN","CRUELTY FREE","ECOFRIENDLY","NATURAL"],"why_items":["🏺 Sneha-Kalka-Drava Method — The authentic classical Siddha procedure where herbal paste (Kalka) is gently decocted into virgin cold-pressed oil (Sneha) with pure botanical juice (Drava).","🔥 Double Boiled & Double Infused — Two-stage low-heat simmering ensures maximum phytonutrient extraction without denaturing fragile herbs.","🌿 13 Documented Herbs — Ratanjot, Jadamanshi, Lemongrass, Jal Brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag and Bhringraj in virgin coconut oil.","✨ 100% Dandruff Control — Soothes flaking, eliminates itchy fungus and purifies scalp follicles to stimulate thick new hair regrowth.","🚫 Zero Harmful Chemicals — 0% mineral oil, no liquid paraffin, no silicones, parabens or synthetic fragrance.","🏭 Choolaimedu, Chennai Origin — Manufactured and marketed by Smeram Industries in Chennai with complete batch traceability."],"ingredients_heading":"The 13 Classical Medicinal Herbs","ingredients_items":["Cold Pressed Virgin Coconut Oil — Pure medium-chain triglycerides that penetrate directly into the hair cortex.","Ratanjot Roots — Cooling root that prevents premature greying and gives the rich natural reddish hue.","Jadamanshi Roots — Calms nervous tension and reduces stress-induced hair fall.","Vettiver — Cools the head and balances excess body heat.","Lemongrass — Natural antifungal that clears stubborn dandruff.","Jal Brahmi — Strengthens micro-capillaries supplying hair bulbs.","Jalapippali — Soothes scalp infections and stimulates dormant roots.","Amla — Rich in Vitamin C; strengthens roots and delays greying.","Henna — Conditions cuticles and balances scalp pH.","Curry Leaves — Prevents thinning and restores natural lustre.","Hibiscus — Adds bounce, volume and silky softness.","Gudrisag — Cooling greens that boost hair density.","Bhringraj — The King of Hair; re-energises dormant follicles."]},"checkout":{"cod":false,"razorpay":true,"show_coupon":false}}',
  'published');

-- Categories
INSERT INTO `categories` (`id`, `store_id`, `name`, `slug`, `image_url`, `sort_order`, `active`) VALUES
(3, 2, 'Hair Care Oil', 'hair-care-oil', '/assets/themes/smeram/smeram-box-bottle.jpg', 1, 1),
(1, 2, 'Joint Pain & Orthocare', 'joint-pain-orthocare', '/assets/themes/smeram/ortho-pain.jpg', 2, 1),
(4, 2, 'Ayurgold Face Care', 'ayurgold-face-care', '/assets/themes/smeram/face-care.jpg', 3, 1),
(2, 2, 'Health Foods', 'health-foods', '/assets/themes/smeram/health-foods.jpg', 4, 1);

-- Products
INSERT INTO `products` (`id`, `store_id`, `category_id`, `name`, `slug`, `sku`, `price`, `compare_price`, `cost_price`, `gst_rate`, `product_size`, `offer_text`, `badge_text`, `description`, `ingredients`, `user_instructions`, `benefits`, `additional_note`, `images`, `quantity`, `in_stock`, `active`, `variants`) VALUES
(2, 2, 3, 'Smeram Naturals Hair Oil', 'siddha-hair-oil-100ml', 'SN-HO-101', 349.00, 353.00, 180.00, '12',
 '100 ml', 'Special Introductory Offer - Save ₹50', 'Sneha - Kalka - Drava Method',
 'Double Boiled · Double Infused classical Siddha formulation with 11 pure botanical herbs for 100% dandruff control and natural hair volume growth.',
 'Cold pressed virgin coconut oil, Ratanjot roots, jadamanshi roots, vettiver, lemongrass, Jal brahmi, Jalapippali, Amla, Henna, Curry leaves, Hibiscus, Gudrisag and Bhringaraj.',
 'Take 5-10 ml of Smeram Herbal Hair Oil. Warm gently between palms and apply directly to scalp and roots. Massage gently with circular fingertip motions for 10 minutes to stimulate blood circulation.',
 '• Prevents hair fall and stimulates healthy hair growth.\n• 100% Dandruff control & soothing itchy scalp.\n• Prevents premature greying of hair.\n• Body cooling properties, relieves stress and cures insomnia.',
 'Inclusive of GST and free shipping.',
 '["/assets/themes/smeram/smeram-box-bottle.jpg","/assets/themes/smeram/smeram-bottles-pair.jpg","/assets/themes/smeram/smeram-bottle-single.jpg","/assets/themes/smeram/smeram-label.jpg"]',
 100, 1, 1, '[]'),

(4, 2, 1, 'Smeram Naturals - Virali Thailam Ortho Joint Pain Oil', 'ortho-pain-oil', 'SN-JPO-101', 379.00, 450.00, 200.00, '12',
 '100 ml', 'Relief Special Offer', 'Fast Relief',
 'Use in all types of sprains, aches, knee pain, frozen shoulders, spinal cord back pain and diabetic foot nerve pains.',
 'Bone joint leaves (elumbotti ilai), Hopseed bush (virali ilai), Balloon vine (modakathan), Veldi grape (pirandai/hadjod), Jadamanshi roots, Vettiver, Mahua, Castor and Neem oils.',
 'Take 5 ml of virali thailam in a spoon, slightly heat it and gently apply on affected joints/parts.',
 'Pain relief in all vata disorders. Strong bones and ligament support. Fast penetrating anti-inflammatory herbal relief.',
 'Inclusive of GST and free shipping.',
 '["/assets/themes/smeram/ortho-pain.jpg"]',
 100, 1, 1, '[]'),

(5, 2, 4, 'Smeram Naturals - Ayurgold Face pack', 'ayurgold-kumkumadi-oil', 'SN-FP-101', 349.00, 499.00, 160.00, '12',
 'Net weight - 100 grams', 'Festive Radiance Offer', 'Ayurgold Radiance',
 'Pure herbal face pack for clearing dark spots, tanning, and restoring natural golden skin glow.',
 'Red sanders, Manjistha, Sandalwood, wild turmeric, lodhra, licorice, nutgrass, vettiver, rose petals, maghilampoo and multani mitti.',
 'Take 1-2 teaspoons of Smeram Ayurgold face pack, mix with warm rose water or milk. Apply evenly on clean face for 20 minutes before rinsing with cool water.',
 'Removes excessive oil and surface impurities. Clears acne and blemishes. Restores glowing luminous complexion.',
 'Inclusive of GST and free shipping.',
 '["/assets/themes/smeram/face-care.jpg"]',
 100, 1, 1, '[]'),

(6, 2, 2, 'Smeram Naturals - Health Mix with Nuts.', 'health-a2-ghee', 'SN-HM-101', 378.00, 564.00, 210.00, '12',
 'Net weight - 450.00 grams', 'Pure Nutrition Special', '100% Pure',
 'Nutrient-dense traditional multi-grain porridge mix bringing together sprouted grains, millets, legumes, nuts, and seeds.',
 '100% Pure Sprouted ragi, pearl millet, black kavuni rice, corn, sorghum, green moong dhal, white chickpeas, roasted gram, almonds, cashew, flax seeds, pumpkin seeds and cardamom.',
 'Take 2 tablespoons of Smeram health mix powder, boil in 200 ml of water or milk for 3 minutes. Add jaggery/honey for healthy breakfast.',
 'Rich in complex carbohydrates, plant protein, dietary fiber, calcium, iron, and gut-friendly micronutrients.',
 'Inclusive of GST and free shipping.',
 '["/assets/themes/smeram/health-foods.jpg"]',
 100, 1, 1, '[]'),

(7, 2, NULL, 'Payment Test ₹1 (do not ship)', 'payment-test-1', 'ZK-PAYTEST-1', 1.00, NULL, NULL, '12',
 '1 Unit', NULL, 'Test Mode',
 'Internal item for testing live Razorpay online checkout transactions.',
 NULL, NULL, 'Internal system test item.', 'Do not ship.', '[]',
 10, 1, 1, '[]');

-- Product Stock Levels
INSERT INTO `product_stock` (`store_id`, `product_id`, `variant_id`, `quantity`) VALUES
(2, 2, '', 100),
(2, 4, '', 100),
(2, 5, '', 100),
(2, 6, '', 100),
(2, 7, '', 10);

-- Shipping Rates
INSERT INTO `shipping_rates` (`id`, `store_id`, `name`, `rate`, `free_above`, `estimated_days`, `courier`, `active`) VALUES
(1, 2, 'Free Delivery (Orders ₹399+)', 0, 399, '2-4 business days', 'ST Courier / Delhivery', 1),
(2, 2, 'Standard Express Courier', 50, NULL, '2-3 business days', 'ST Courier / Professional', 1);

-- Coupons
INSERT INTO `coupons` (`id`, `store_id`, `code`, `discount_type`, `discount_value`, `minimum_order`, `active`) VALUES
(1, 2, 'WELCOME10', 'percent', 10.00, 299, 1),
(2, 2, 'LAUNCH50', 'fixed', 50.00, 349, 1);

-- Store Pages
INSERT INTO `store_pages` (`store_id`, `title`, `slug`, `content`, `status`, `sort_order`) VALUES
(2, 'About Us', 'about-us', '{"body":"Welcome to Smeram Naturals.\\n\\nWe produce authentic Siddha & Ayurvedic formulations using time-honored traditional methods. Centered on the classical Sneha-Kalka-Drava procedure, our flagship hair oils and herbal remedies are crafted in small batches in Chennai, Tamil Nadu.\\n\\nEvery batch is slow-simmered, double boiled, and double infused with 13 hand-selected medicinal herbs to preserve maximum phytonutrient efficacy. 100% plant-based, vegan, cruelty-free, and chemical-free."}', 'published', 1),
(2, 'Contact Us', 'contact-us', '{"body":"Customer Support & Inquiries — Smeram Naturals\\n\\nOperating Address:\\nSmeram Industries\\n22/13 Rajaveedhi Street, Choolaimedu, Chennai, Tamil Nadu - 600094\\n\\nEmail: smeramindustries@gmail.com\\nPhone / WhatsApp: +91 75399 72026\\n\\nSupport Hours: Monday to Saturday, 9:00 AM – 6:00 PM IST."}', 'published', 2),
(2, 'Privacy Policy', 'privacy-policy', '{"body":"Privacy Policy — Smeram Naturals\\n\\nYour privacy is paramount to us. We collect customer details (name, shipping address, contact phone, and email) solely to process your orders, provide dispatch tracking alerts via WhatsApp, and improve our services.\\n\\nAll online payment transactions are processed securely via RBI-licensed payment gateways (Razorpay) using 256-bit SSL encryption. We never sell, rent, or trade your personal data with third-party marketers."}', 'published', 3),
(2, 'Terms of Service', 'terms-of-service', '{"body":"Terms of Service — Smeram Naturals\\n\\nBy placing an order on our store, you confirm that you have read and agreed to these terms. All prices are listed in Indian Rupees (INR) and are inclusive of statutory GST where applicable.\\n\\nOrders are accepted subject to product availability and delivery serviceability. We reserve the right to cancel orders with incorrect information or suspected fraud."}', 'published', 4),
(2, 'Refund & Cancellation Policy', 'refund-policy', '{"body":"Refund & Return Policy — Smeram Naturals\\n\\nIf you receive a damaged, leaking, or defective bottle, please inform our support team within 48 hours of receipt at smeramindustries@gmail.com or via WhatsApp at +91 75399 72026 with unboxing photo/video evidence.\\n\\nWe will promptly ship a free replacement or issue a full refund to your original payment method within 5–7 business days."}', 'published', 5),
(2, 'Shipping & Delivery Policy', 'shipping-policy', '{"body":"Shipping Policy — Smeram Naturals\\n\\nOrders are dispatched within 24 to 48 hours via leading domestic courier partners (ST Courier, Delhivery, Professional Couriers).\\n\\nStandard delivery time:\\n- Tamil Nadu & South India: 2 to 3 business days.\\n- Rest of India: 3 to 6 business days.\\n\\nFree shipping applies on orders above ₹399 across India. Live tracking information is automatically sent to your WhatsApp number upon parcel handover."}', 'published', 6);

-- GST Settings
INSERT INTO `gst_settings` (`store_id`, `gstin`, `state_code`, `default_rate`, `enabled`) VALUES
(2, '33AAAAA0000A1Z5', '33', 12.00, 1);

-- Historical Schema Migrations Ledger
INSERT INTO `schema_migrations` (`id`, `description`, `applied_at`) VALUES
('001_core_tables', 'Stores, categories, products, orders and pages', NOW()),
('002_inquiries', 'Contact form and restock requests', NOW()),
('003_order_tracking', 'Order updated_at, tracking number and store/date index for the order dashboard', NOW()),
('004_razorpay_payments', 'Razorpay order / payment ids on orders for online payment', NOW()),
('005_product_quantity', 'Stock quantity per product', NOW()),
('006_commerce', 'Sizes and stock, coupons, shipping rates, GST totals, invoices, Ekart tracking and WhatsApp log', NOW()),
('007_store_pages_and_categories_meta', 'Categories image, sort order and active status, and store pages sort order and status (v1.0.7)', NOW()),
('008_product_sku_and_pricing_meta', 'Product SKU, compare price, cost tracking and GST rate (v1.0.8)', NOW()),
('009_order_payment_meta', 'Razorpay signature, payment gateway and invoice audit tracking (v1.0.9)', NOW()),
('package-v1.0.12', 'ZKCommerce package v1.0.12 (production)', NOW());

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SUCCESS: Database reset, tables created, and Smeram Naturals seeded!
-- ============================================================
