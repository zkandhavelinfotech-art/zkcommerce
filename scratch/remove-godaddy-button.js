const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'zkc', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc', 'clients', 'smeram', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'clients', 'smeram', 'merchant', 'index.html')
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  // Remove btnGoDaddyOrders line
  content = content.replace(/\s*<a class="btn-outline btn-sm" id="btnGoDaddyOrders"[^>]*>.*?<\/a>/g, '');
  fs.writeFileSync(f, content, 'utf8');
  console.log('Removed GoDaddy Orders button from:', f);
}

