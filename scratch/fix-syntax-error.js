const fs = require('fs');
const path = require('path');

const dirs = [
  'c:/MAMP/htdocs/live/smeram-naturals/smeram-frontend-v1.0.1',
  'd:/ZK Software/Dev/zkcommerce/zkcommerce-v4.1.0-source/zkc/deployment/smeram-frontend',
  'd:/ZK Software/Dev/zkcommerce/zkcommerce-v4.1.0-source/zkc/deployment/smeram-godaddy-deploy',
  'd:/ZK Software/Dev/zkcommerce/zkcommerce-v4.1.0-source/zkc/deployment/smeram-godaddy'
];

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'smeram-backend-api' && entry.name !== 'smeram-backend-api-v1.0.4' && entry.name !== 'node_modules' && entry.name !== '.git') {
        processDir(fullPath);
      }
    } else if (entry.name.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Fix unescaped regex syntax error
      if (content.includes("replace(/^/?(api/)?/,'')")) {
        content = content.replace("replace(/^/?(api/)?/,'')", "indexOf('/api/')===0?ep.slice(5):(ep.indexOf('api/')===0?ep.slice(4):(ep.charAt(0)==='/'?ep.slice(1):ep))");
        changed = true;
      }
      if (content.includes("replace(/^\\/?(api\\/)?/,'')")) {
        content = content.replace("replace(/^\\/?(api\\/)?/,'')", "indexOf('/api/')===0?ep.slice(5):(ep.indexOf('api/')===0?ep.slice(4):(ep.charAt(0)==='/'?ep.slice(1):ep))");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed syntax error in: ' + fullPath);
      }
    }
  }
}

// Also create a dummy/fallback favicon.ico in smeram-frontend-v1.0.1 and deployment
dirs.forEach(d => {
  if (fs.existsSync(d)) {
    const favPath = path.join(d, 'favicon.ico');
    if (!fs.existsSync(favPath)) {
      // 1x1 transparent ICO header
      const icoBuf = Buffer.from([0,0,1,0,1,0,1,1,0,0,1,0,24,0,40,0,0,0,22,0,0,0,40,0,0,0,1,0,0,0,2,0,0,0,1,0,24,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
      try {
        fs.writeFileSync(favPath, icoBuf);
        console.log('Created favicon.ico in ' + d);
      } catch(e) {}
    }
  }
});

dirs.forEach(processDir);
console.log('Syntax error fix complete.');

