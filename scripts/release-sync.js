/**
 * zkc/ is the only place code is edited. zkc-build/ is what Railway / Vercel / the root server.js run,
 * and must be an exact copy of zkc/.
 *
 *   npm run release:sync    copy zkc/ → zkc-build/ (adds, updates, and removes files)
 *   npm run release:check   change nothing; exit 1 if zkc-build/ differs from zkc/ (pre-commit hook + CI)
 *
 * Only files git would track are mirrored, so node_modules, .env, uploads and built packages
 * (see .gitignore) never reach zkc-build/.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'zkc', DEST = 'zkc-build';
const check = process.argv.includes('--check');

// Files git tracks or would track (not ignored) under a folder, relative to that folder.
function gitFiles(dir) {
  if (!fs.existsSync(path.join(ROOT, dir))) return [];
  const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', dir], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean)
    .map(p => p.slice(dir.length + 1))
    .filter(rel => fs.existsSync(path.join(ROOT, dir, rel)));
}

const sameFile = (a, b) => {
  if (!fs.existsSync(b)) return false;
  const sa = fs.statSync(a), sb = fs.statSync(b);
  return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
};

const source = gitFiles(SRC);
const sourceSet = new Set(source);
const changed = [], removed = [];

for (const rel of source) {
  const from = path.join(ROOT, SRC, rel), to = path.join(ROOT, DEST, rel);
  if (sameFile(from, to)) continue;
  changed.push(rel);
  if (!check) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}
for (const rel of gitFiles(DEST)) {
  if (sourceSet.has(rel)) continue;
  removed.push(rel);
  if (!check) fs.rmSync(path.join(ROOT, DEST, rel), { force: true });
}

if (check) {
  if (!changed.length && !removed.length) { console.log(`✅ ${DEST}/ matches ${SRC}/ (${source.length} files)`); process.exit(0); }
  console.error(`❌ ${DEST}/ is out of date with ${SRC}/ — run: npm run release:sync`);
  for (const f of changed.slice(0, 20)) console.error('   changed: ' + f);
  for (const f of removed.slice(0, 20)) console.error('   extra:   ' + f);
  if (changed.length + removed.length > 40) console.error(`   … ${changed.length + removed.length - 40} more`);
  console.error(`   Edit files in ${SRC}/ only; ${DEST}/ is generated.`);
  process.exit(1);
}
console.log(`✅ ${DEST}/ synced from ${SRC}/: ${changed.length} copied/updated, ${removed.length} removed, ${source.length} files total`);
