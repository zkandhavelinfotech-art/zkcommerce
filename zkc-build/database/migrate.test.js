const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeEnvironment, runMigrations } = require('./migrate');

test('normalizes launcher environment aliases', () => {
  assert.equal(normalizeEnvironment('local'), 'development');
  assert.equal(normalizeEnvironment('dev'), 'development');
  assert.equal(normalizeEnvironment('stage'), 'staging');
  assert.equal(normalizeEnvironment('prod'), 'production');
  assert.throws(() => normalizeEnvironment('preview'), /Unknown environment/);
});

test('sends dollar-quoted PostgreSQL migration files without splitting them', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zkcommerce-migrate-'));
  const sql = 'CREATE FUNCTION answer() RETURNS int LANGUAGE plpgsql AS $$ BEGIN RETURN 42; END; $$;';
  fs.writeFileSync(path.join(directory, '001.sql'), sql);
  const queries = [];
  const client = {
    connect: async () => {},
    end: async () => {},
    query: async (text, values) => {
      queries.push({ text, values });
      if (/^SELECT checksum/.test(text)) return { rows: [] };
      return { rows: [] };
    }
  };

  await runMigrations({
    env: 'dev', client, logger: () => {},
    sqlFiles: ['001.sql'], migrationsDirectory: directory
  });

  assert.equal(queries.filter((query) => query.text === sql).length, 1);
});
