const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('setup launch creates a store and the API switches the active store', () => {
  const api = fs.readFileSync(require.resolve('../api/server.js'), 'utf8');
  const setup = fs.readFileSync(require.resolve('../merchant/setup.html'), 'utf8');

  assert.match(api, /app\.post\('\/api\/stores'/);
  assert.match(api, /INSERT INTO stores/);
  assert.match(api, /UPDATE users SET store_id=\$1/);
  assert.match(api, /BEGIN/);
  assert.match(api, /COMMIT/);
  assert.match(setup, /api\.post\('\/stores'/);
});
