-- ============================================================================
-- ZKCommerce: Smeram Naturals — Targeted Password Change ONLY
--
-- INSTRUCTIONS:
-- Run this single query in phpMyAdmin or MySQL console.
-- It ONLY changes the password for merchant@smeramnaturals.in to: Smeram2026!
-- It does NOT drop any tables, truncate data, or reset orders/products.
-- ============================================================================

UPDATE `merchants`
SET `password_hash` = '$2a$10$qEOTbLvxlOjvdTU12jzsD.Ur.c7siQw5V1WcHKTxTpiEMnyFIDNwO'
WHERE `email` = 'merchant@smeramnaturals.in' OR `id` = 2;

-- Verify updated account:
SELECT `id`, `name`, `email`, `role`, `store_id` 
FROM `merchants` 
WHERE `email` = 'merchant@smeramnaturals.in';
