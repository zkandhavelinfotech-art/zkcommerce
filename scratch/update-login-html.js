const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'zkc', 'auth', 'login.html'),
  path.join(__dirname, '..', 'zkc', 'clients', 'smeram', 'auth', 'login.html'),
  path.join(__dirname, '..', 'zkc-build', 'auth', 'login.html'),
  path.join(__dirname, '..', 'zkc-build', 'clients', 'smeram', 'auth', 'login.html')
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log('Skipping missing:', f);
    continue;
  }
  let content = fs.readFileSync(f, 'utf8');

  // Replace var API_BASE = ZK.api;
  content = content.replace(/var API_BASE = ZK\.api;/, `var localHost = ['localhost','127.0.0.1'].includes(location.hostname);
var localPage = localHost || location.protocol === 'file:';
var isLocalPort3000 = location.port === '3000';
var fallbackApi = localPage ? (isLocalPort3000 ? location.origin + '/api' : 'http://localhost:3000/api') : (location.origin + '/api');
var API_BASE = (typeof ZK !== 'undefined' && ZK && ZK.api) ? ZK.api : fallbackApi;`);

  // Ensure JSON parsing handles non-200 responses to show clear server error messages
  content = content.replace(
    /r = await fetch\(API_BASE\+'\/auth\/login',\{\s*method:'POST',headers:\{'Content-Type':'application\/json'\},\s*body:JSON\.stringify\(\{email:em,password:pw\}\)\s*\}\);\s*if \(r\.ok \|\| r\.status === 401\) \{\s*d = await r\.json\(\);\s*\}/,
    `r = await fetch(API_BASE+'/auth/login',{\n        method:'POST',headers:{'Content-Type':'application/json'},\n        body:JSON.stringify({email:em,password:pw})\n      });\n      d = await r.json().catch(function(){ return null; });`
  );

  fs.writeFileSync(f, content, 'utf8');
  console.log('Updated:', f);
}

