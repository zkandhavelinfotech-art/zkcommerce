/**
 * Test & verification script for ZKCommerce DB Migrations (v1.0.7 & v1.0.8)
 * and Publish Portal DB Migration download integration.
 */
'use strict';
require('dotenv').config();
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mysqlMigrations = require('../api/services/mysql-migrations');
const pgMigrations = require('../api/services/pg-migrations');
const { getMigrationStatus } = require('../api/services/db-migrator');
const { exportDbMigration } = require('../api/services/deployment-exporter');

async function runTests() {
  console.log('🧪 Starting DB Migration & Publish Portal Tests...\n');

  // Test 1: MySQL Migrations registry
  console.log('--- Test 1: MySQL Migrations Registry ---');
  assert.strictEqual(mysqlMigrations.MIGRATIONS.length, 9, 'Expected 9 MySQL migrations');
  assert.strictEqual(mysqlMigrations.latestId(), '009_order_payment_meta', 'Latest ID must be 009');
  assert.strictEqual(mysqlMigrations.latestVersion(), '1.0.9', 'Latest version must be 1.0.9');

  const m8 = mysqlMigrations.MIGRATIONS.find(m => m.id === '008_product_sku_and_pricing_meta');
  assert(m8, 'Migration 008 must exist');
  assert.strictEqual(m8.version, '1.0.8', 'Migration 008 version must be 1.0.8');

  const m9 = mysqlMigrations.MIGRATIONS.find(m => m.id === '009_order_payment_meta');
  assert(m9, 'Migration 009 must exist');
  assert.strictEqual(m9.version, '1.0.9', 'Migration 009 version must be 1.0.9');

  // Check columns in 009
  const cols009 = m9.steps.map(s => s.addColumn && s.addColumn.column).filter(Boolean);
  assert(cols009.includes('razorpay_signature'), '009 must include razorpay_signature');
  assert(cols009.includes('payment_gateway'), '009 must include payment_gateway');
  console.log('✅ MySQL Migrations registry passed (9 migrations, latest v1.0.9)');

  // Test 2: migrationsAfter delta logic
  console.log('\n--- Test 2: migrationsAfter Delta Logic ---');
  const deltaFrom8 = mysqlMigrations.migrationsAfter('008_product_sku_and_pricing_meta');
  assert.strictEqual(deltaFrom8.length, 1, 'Expected exactly 1 migration after 008');
  assert.strictEqual(deltaFrom8[0].id, '009_order_payment_meta', 'Delta from 008 must be 009');

  const deltaFrom7 = mysqlMigrations.migrationsAfter('007_store_pages_and_categories_meta');
  assert.strictEqual(deltaFrom7.length, 2, 'Expected exactly 2 migrations after 007');
  assert.strictEqual(deltaFrom7[0].id, '008_product_sku_and_pricing_meta');
  assert.strictEqual(deltaFrom7[1].id, '009_order_payment_meta');

  const sqlDelta8 = mysqlMigrations.guardedSql(deltaFrom8);
  assert(sqlDelta8.includes('009_order_payment_meta'), 'SQL must mention 009');
  assert(sqlDelta8.includes('razorpay_signature'), 'SQL must contain razorpay_signature');
  assert(sqlDelta8.includes('payment_gateway'), 'SQL must contain payment_gateway');
  console.log('✅ Migration delta from v1.0.8 to v1.0.9 generated clean SQL with 009');

  // Test 3: PostgreSQL Startup Migrations
  console.log('\n--- Test 3: PostgreSQL Startup Migrations Registry ---');
  assert.strictEqual(pgMigrations.MIGRATIONS.length, 9, 'Expected 9 PG migrations in pg-migrations.js');
  assert(pgMigrations.MIGRATIONS.some(m => m.id === '008_product_sku_and_pricing_meta'));
  assert(pgMigrations.MIGRATIONS.some(m => m.id === '009_order_payment_meta'));
  console.log('✅ PostgreSQL Startup Migrations registry passed');

  // Test 4: Live PostgreSQL Status
  console.log('\n--- Test 4: Live PostgreSQL Migration Status ---');
  const pgStatus = await getMigrationStatus();
  assert.strictEqual(pgStatus.summary.total_migrations, 9, 'Total migrations must be 9');
  console.log(`✅ Live PG Database: ${pgStatus.database.name} verified`);

  // Test 5: Export DB Migration Package for Publish Portal
  console.log('\n--- Test 5: Publish Portal DB Migration Exporter ---');
  const mockStore = {
    id: 1,
    store_name: 'Smeram Naturals',
    slug: 'smeram-naturals',
    custom_domain: 'smeranm-naturals.in',
    status: 'published'
  };

  const migrationRes = await exportDbMigration({
    store: mockStore,
    env: 'production',
    fromVersion: '1.0.8',
    fromSchema: '008_product_sku_and_pricing_meta',
    toVersion: '1.0.9',
    includeSeed: true,
    products: [{ id: 1, name: 'Smeram Cold Pressed Coconut Oil', slug: 'coconut-oil', price: 299, cost_price: 180, gst_rate: '12', sku: 'SM-COC-01' }],
    categories: [{ id: 1, name: 'Natural Oils', slug: 'oils', image_url: '/assets/oils.png', sort_order: 1, active: true }],
    pages: [{ id: 1, title: 'About Us', slug: 'about-us', status: 'published', sort_order: 1 }]
  });

  assert(migrationRes.success, 'Migration export must succeed');
  assert.strictEqual(migrationRes.from_version, '1.0.8');
  assert.strictEqual(migrationRes.to_version, '1.0.9');
  assert.strictEqual(migrationRes.pending.length, 1);
  assert.strictEqual(migrationRes.pending[0].id, '009_order_payment_meta');

  // Check generated files on disk
  const sqlFile = path.join(migrationRes.export_dir, migrationRes.zip_name.replace('.zip', '.sql'));
  assert(fs.existsSync(sqlFile), 'SQL file must exist');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  assert(sqlContent.includes('009_order_payment_meta'), 'SQL must contain 009 migration');
  assert(sqlContent.includes('razorpay_signature'), 'SQL must include razorpay_signature column');
  assert(sqlContent.includes('payment_gateway'), 'SQL must include payment_gateway column');

  const migratePhp = path.join(migrationRes.export_dir, 'migrate.php');
  assert(fs.existsSync(migratePhp), 'migrate.php must exist');
  const phpContent = fs.readFileSync(migratePhp, 'utf8');
  assert(phpContent.includes('009_order_payment_meta'), 'migrate.php must contain 009 in plan');

  assert(fs.existsSync(migrationRes.zip_path), 'Migration ZIP must exist');
  console.log(`✅ Publish Portal ZIP generated: ${migrationRes.zip_name} (${fs.statSync(migrationRes.zip_path).size} bytes)`);

  // Test 6: Check store-builder Publish Portal HTML
  console.log('\n--- Test 6: Store Builder Publish Portal HTML ---');
  const sbHtml = fs.readFileSync(path.join(__dirname, '..', 'store-builder', 'index.html'), 'utf8');
  assert(sbHtml.includes('renderMigrationPicker'), 'renderMigrationPicker function must exist');
  assert(sbHtml.includes('Database at'), 'Must include direct schema checkpoint options');
  assert(sbHtml.includes('downloadMigrationBtn'), 'downloadMigrationBtn must exist');
  console.log('✅ Store Builder Publish Portal UI verified');

  console.log('\n🎉 ALL 6 DB MIGRATION & PUBLISH PORTAL TESTS PASSED!\n');
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
