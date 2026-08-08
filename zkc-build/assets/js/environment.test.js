const test = require('node:test');
const assert = require('node:assert/strict');
const env = require('./environment');

const location = (origin) => {
  const url = new URL(origin);
  return { origin: url.origin, protocol: url.protocol, host: url.host, hostname: url.hostname, search: url.search };
};

test('builds local and shared-environment storefront paths with a slug query', () => {
  assert.equal(
    env.storefrontUrl('Mangalam Textiles', location('http://localhost:8080'), 'local'),
    'http://localhost:8080/storefront/home.html?store=mangalam-textiles'
  );
  assert.equal(
    env.storefrontUrl('mangalam-textiles', location('https://staging.zkcommerce.in'), 'staging'),
    'https://staging.zkcommerce.in/storefront/home.html?store=mangalam-textiles'
  );
});

test('builds a production wildcard storefront URL', () => {
  assert.equal(
    env.storefrontUrl('Mangalam Textiles', location('https://app.zkcommerce.in'), 'production'),
    'https://mangalam-textiles.zkcommerce.in/'
  );
});

test('resolves query-string and production-subdomain store slugs', () => {
  assert.equal(env.storeSlug(location('http://localhost:8080/storefront/home.html?store=mangalam-textiles')), 'mangalam-textiles');
  assert.equal(env.storeSlug(location('https://mangalam-textiles.zkcommerce.in')), 'mangalam-textiles');
});
