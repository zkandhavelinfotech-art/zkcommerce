-- ============================================================================
-- ZKCommerce: Smeram Naturals — Targeted Password Change ONLY
--
-- INSTRUCTIONS:
-- Run this single query in phpMyAdmin (MySQL) or psql / Neon (PostgreSQL).
-- It ONLY changes the password for merchant@smeramnaturals.in to: Smeram2026!
-- It does NOT drop any tables, truncate data, or reset orders/products.
-- Hash: $2a$10$wYY5x8DqxIVBzHhuz6gEmugczJ3YyUHCaqszpKhxoMdjp4tzokilK
-- Compatible with both PHP password_verify() and Node.js bcryptjs.
-- ============================================================================

UPDATE merchants
SET password_hash = '$2a$10$wYY5x8DqxIVBzHhuz6gEmugczJ3YyUHCaqszpKhxoMdjp4tzokilK'
WHERE email = 'merchant@smeramnaturals.in' OR id = 2;

-- Verify updated account:
SELECT id, name, email, role, store_id 
FROM merchants 
WHERE email = 'merchant@smeramnaturals.in';
