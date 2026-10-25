/**
 * Runs the repo's node:test suites (`npm test`). The tests use Node's built-in runner, not Jest.
 * Only source folders are searched — zkc-build/ and dist/ are generated copies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['zkc', 'legacy/sprint-1-4'];
const SKIP = new Set(['node_modules', 'dist', 'zkc-build', 'deployment', 'uploads', '.git']);

function findTests(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findTests(full, out);
    else if (e.name.endsWith('.test.js')) out.push(path.relative(ROOT, full));
  }
  return out;
}

const files = DIRS.flatMap(d => findTests(path.join(ROOT, d)));
if (!files.length) { console.log('No test files found.'); process.exit(0); }
const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
