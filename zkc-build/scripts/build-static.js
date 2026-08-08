/** Build the Vercel static artifact without publishing API or database source. */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error(`Refusing to clean unexpected output path: ${output}`);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const directory of ['admin', 'assets', 'auth', 'merchant', 'storefront']) {
  fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
}
for (const filename of ['index.html', 'competitor-widget.html', 'migrate.html']) {
  fs.copyFileSync(path.join(root, filename), path.join(output, filename));
}

console.log(`Static site built at ${output}`);
