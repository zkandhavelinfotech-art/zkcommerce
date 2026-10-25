const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('partial indexes do not contain time-dependent predicates', () => {
  const databaseDirectory = __dirname;
  const files = fs.readdirSync(databaseDirectory).filter((name) => name.endsWith('.sql'));

  for (const filename of files) {
    const sql = fs.readFileSync(path.join(databaseDirectory, filename), 'utf8');
    const indexStatements = sql.match(/CREATE(?: UNIQUE)? INDEX[\s\S]*?;/gi) || [];
    for (const statement of indexStatements) {
      const predicate = statement.match(/\bWHERE\b([\s\S]*)/i)?.[1] || '';
      assert.doesNotMatch(
        predicate,
        /\b(?:NOW\s*\(|CURRENT_DATE\b|CURRENT_TIMESTAMP\b)/i,
        `${filename} has a time-dependent partial-index predicate: ${statement}`
      );
    }
  }
});
