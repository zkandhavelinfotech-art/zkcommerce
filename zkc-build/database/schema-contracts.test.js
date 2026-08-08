const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const phase2 = fs.readFileSync(path.join(__dirname, 'phase2-additions.sql'), 'utf8');
const phase3 = fs.readFileSync(path.join(__dirname, 'phase3-additions.sql'), 'utf8');

test('migration indexes use the ownership columns from the base schema', () => {
  assert.doesNotMatch(phase2, /ON\s+reviews\s*\(\s*store_id\b/i);
  assert.doesNotMatch(phase3, /ON\s+orders\s*\(\s*user_id\b/i);
  assert.doesNotMatch(phase3, /ON\s+cart_items\s*\(\s*user_id\b/i);
  assert.match(phase3, /ALTER TABLE categories[\s\S]*ADD COLUMN IF NOT EXISTS store_id/i);
});

test('phase three adds compatibility columns required by the API', () => {
  assert.match(phase3, /ALTER TABLE users[\s\S]*ADD COLUMN IF NOT EXISTS name/i);
  assert.match(phase3, /ALTER TABLE users[\s\S]*ADD COLUMN IF NOT EXISTS store_id/i);
  assert.match(phase3, /ALTER TABLE reviews[\s\S]*ADD COLUMN IF NOT EXISTS body/i);
});

test('changed reporting views are dropped before replacement', () => {
  for (const view of ['v_store_summary', 'v_platform_stats', 'v_low_stock', 'v_loyalty_balance']) {
    assert.match(phase3, new RegExp(`DROP VIEW IF EXISTS ${view}`));
  }
});

test('product statuses used by the API are added before phase three', () => {
  const preflight = fs.readFileSync(path.join(__dirname, 'phase3-preflight.sql'), 'utf8');
  assert.match(preflight, /ADD VALUE IF NOT EXISTS 'published'/);
  assert.match(preflight, /ADD VALUE IF NOT EXISTS 'archived'/);
});
