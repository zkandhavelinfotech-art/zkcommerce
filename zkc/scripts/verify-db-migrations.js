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
  assert.strictEqual(mysqlMigrations.MIGRATIONS.length, 8, 'Expected 8 MySQL migrations');
  assert.strictEqual(mysqlMigrations.latestId(), '008_product_sku_and_pricing_meta', 'Latest ID must be 008');
  assert.strictEqual(mysqlMigrations.latestVersion(), '1.0.8', 'Latest version must be 1.0.8');

  const m7 = mysqlMigrations.MIGRATIONS.find(m => m.id === '007_store_pages_and_categories_meta');
  assert(m7, 'Migration 007 must exist');
  assert.strictEqual(m7.version, '1.0.7', 'Migration 007 version must be 1.0.7');

  const m8 = mysqlMigrations.MIGRATIONS.find(m => m.id === '008_product_sku_and_pricing_meta');
  assert(m8, 'Migration 008 must exist');
  assert.strictEqual(m8.version, '1.0.8', 'Migration 008 version must be 1.0.8');

  // Check columns in 008
  const cols008 = m8.steps.map(s => s.addColumn && s.addColumn.column).filter(Boolean);
  assert(cols008.includes('sku'), '008 must include sku');
  assert(cols008.includes('compare_price'), '008 must include compare_price');
  assert(cols008.includes('cost_price'), '008 must include cost_price');
  assert(cols008.includes('gst_rate'), '008 must include gst_rate');
  console.log('✅ MySQL Migrations registry passed (8 migrations, latest v1.0.8)');

  // Test 2: migrationsAfter delta logic
  console.log('\n--- Test 2: migrationsAfter Delta Logic ---');
  const deltaFrom7 = mysqlMigrations.migrationsAfter('007_store_pages_and_categories_meta');
  assert.strictEqual(deltaFrom7.length, 1, 'Expected exactly 1 migration after 007');
  assert.strictEqual(deltaFrom7[0].id, '008_product_sku_and_pricing_meta', 'Delta from 007 must be 008');

  const deltaFrom6 = mysqlMigrations.migrationsAfter('006_commerce');
  assert.strictEqual(deltaFrom6.length, 2, 'Expected exactly 2 migrations after 006');
  assert.strictEqual(deltaFrom6[0].id, '007_store_pages_and_categories_meta');
  assert.strictEqual(deltaFrom6[1].id, '008_product_sku_and_pricing_meta');

  const sqlDelta7 = mysqlMigrations.guardedSql(deltaFrom7);
  assert(sqlDelta7.includes('008_product_sku_and_pricing_meta'), 'SQL must mention 008');
  assert(sqlDelta7.includes('cost_price'), 'SQL must contain cost_price');
  assert(sqlDelta7.includes('gst_rate'), 'SQL must contain gst_rate');
  console.log('✅ Migration delta from v1.0.7 to v1.0.8 generated clean SQL with 008');

  // Test 3: PostgreSQL Startup Migrations
  console.log('\n--- Test 3: PostgreSQL Startup Migrations Registry ---');
  assert.strictEqual(pgMigrations.MIGRATIONS.length, 8, 'Expected 8 PG migrations in pg-migrations.js');
  assert(pgMigrations.MIGRATIONS.some(m => m.id === '007_store_pages_and_categories_meta'));
  assert(pgMigrations.MIGRATIONS.some(m => m.id === '008_product_sku_and_pricing_meta'));
  console.log('✅ PostgreSQL Startup Migrations registry passed');

  // Test 4: Live PostgreSQL Status
  console.log('\n--- Test 4: Live PostgreSQL Migration Status ---');
  const pgStatus = await getMigrationStatus();
  assert.strictEqual(pgStatus.summary.applied_count, 8, 'All 8 PG migrations must be applied');
  assert.strictEqual(pgStatus.summary.pending_count, 0, 'No pending PG migrations');
  assert.strictEqual(pgStatus.summary.is_up_to_date, true, 'PG must be up to date');
  assert(pgStatus.summary.last_migrated_version.includes('v1.0.8'), 'Last migrated version must be v1.0.8');
  console.log(`✅ Live PG Database: ${pgStatus.database.name} is fully at ${pgStatus.summary.last_migrated_version}`);

  // Test 5: Export DB Migration Package for Publish Portal
  console.log('\n--- Test 5: Publish Portal DB Migration Exporter ---');
  const mockStore = {
    id: 1,
    store_name: 'Smeram Naturals',
    slug: 'smeram-naturals',
    custom_domain: 'smeramnaturals.in',
    status: 'published'
  };

  const migrationRes = await exportDbMigration({
    store: mockStore,
    env: 'production',
    fromVersion: '1.0.7',
    fromSchema: '007_store_pages_and_categories_meta',
    toVersion: '1.0.8',
    includeSeed: true,
    products: [{ id: 1, name: 'Smeram Cold Pressed Coconut Oil', slug: 'coconut-oil', price: 299, cost_price: 180, gst_rate: '12', sku: 'SM-COC-01' }],
    categories: [{ id: 1, name: 'Natural Oils', slug: 'oils', image_url: '/assets/oils.png', sort_order: 1, active: true }],
    pages: [{ id: 1, title: 'About Us', slug: 'about-us', status: 'published', sort_order: 1 }]
  });

  assert(migrationRes.success, 'Migration export must succeed');
  assert.strictEqual(migrationRes.from_version, '1.0.7');
  assert.strictEqual(migrationRes.to_version, '1.0.8');
  assert.strictEqual(migrationRes.pending.length, 1);
  assert.strictEqual(migrationRes.pending[0].id, '008_product_sku_and_pricing_meta');

  // Check generated files on disk
  const sqlFile = path.join(migrationRes.export_dir, migrationRes.zip_name.replace('.zip', '.sql'));
  assert(fs.existsSync(sqlFile), 'SQL file must exist');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  assert(sqlContent.includes('008_product_sku_and_pricing_meta'), 'SQL must contain 008 migration');
  assert(sqlContent.includes('cost_price'), 'SQL must include cost_price column');
  assert(sqlContent.includes('gst_rate'), 'SQL must include gst_rate column');

  const migratePhp = path.join(migrationRes.export_dir, 'migrate.php');
  assert(fs.existsSync(migratePhp), 'migrate.php must exist');
  const phpContent = fs.readFileSync(migratePhp, 'utf8');
  assert(phpContent.includes('008_product_sku_and_pricing_meta'), 'migrate.php must contain 008 in plan');

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
