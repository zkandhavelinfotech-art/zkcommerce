const fs = require('fs');
const path = require('path');

const dirs = [
  'd:/ZK Software/Dev/zkcommerce/zkcommerce-v4.1.0-source/zkc/deployment/smeram-frontend',
  'd:/ZK Software/Dev/zkcommerce/zkcommerce-v4.1.0-source/zkc/deployment/smeram-godaddy-deploy'
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
    } else if (entry.name.endsWith('.html') && (fullPath.includes('products') || fullPath.includes('collections'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // 1. host.replaceChildren() safe fallback for mobile
      if (content.includes('host.replaceChildren();')) {
        content = content.replace('host.replaceChildren();', 'if(typeof host.replaceChildren===\'function\')host.replaceChildren();else host.innerHTML=\'\';');
        changed = true;
      }

      // 2. select.replaceChildren() safe fallback
      if (content.includes('select.replaceChildren(new Option(d.rates.length?')) {
        content = content.replace('select.replaceChildren(new Option(d.rates.length?\'Choose a shipping rate\':\'No shipping fee configured\',\'\'));', 'if(typeof select.replaceChildren===\'function\')select.replaceChildren(new Option(d.rates.length?\'Choose a shipping rate\':\'No shipping fee configured\',\'\'));else{select.innerHTML=\'\';select.add(new Option(d.rates.length?\'Choose a shipping rate\':\'No shipping fee configured\',\'\'));}');
        changed = true;
      }

      // 3. addCart calls openCheckout()
      if (content.includes('sessionStorage.setItem(\'zk_cart\',JSON.stringify(zkCart));drawCart();') && !content.includes('openCheckout();return true};')) {
        content = content.replace('sessionStorage.setItem(\'zk_cart\',JSON.stringify(zkCart));drawCart();', 'sessionStorage.setItem(\'zk_cart\',JSON.stringify(zkCart));drawCart();openCheckout();');
        changed = true;
      }

      // 4. zkAdd calls openCheckout()
      if (content.includes("Added to cart');return true};") && !content.includes("Added to cart');if(typeof openCheckout")) {
        content = content.replace("Added to cart');return true};", "Added to cart');if(typeof openCheckout==='function')openCheckout();return true};");
        changed = true;
      }

      // 5. openCart alias
      if (content.includes("classList.remove('open')};") && !content.includes("window.openCart=window.openCheckout")) {
        content = content.replace("classList.remove('open')};", "classList.remove('open')};window.openCart=window.openCheckout;window.closeCart=window.closeCheckout;");
        changed = true;
      }

      // 6. btn-quick-cart opens cart
      if (content.includes('class="btn-quick-cart" type="button" onclick="event.stopPropagation();zkAdd(')) {
        content = content.replace(/class="btn-quick-cart" type="button" onclick="event\.stopPropagation\(\);zkAdd\(([^)]+)\)"/g, 'class="btn-quick-cart" type="button" onclick="event.stopPropagation();if(zkAdd($1)&&typeof openCheckout===\'function\')openCheckout()"');
        changed = true;
      }

      // 7. btn-add-cart opens cart
      if (content.includes('class="btn-add-cart" onclick="zkAdd(')) {
        content = content.replace(/class="btn-add-cart" onclick="zkAdd\(([^)]+)\)"/g, 'class="btn-add-cart" onclick="if(zkAdd($1)&&typeof openCheckout===\'function\')openCheckout()"');
        changed = true;
      }

      // 8. zkQVAdd opens cart
      if (content.includes("cta.style.display='none'}}") && !content.includes("zkQVClose();openCheckout()")) {
        content = content.replace("cta.style.display='none'}}", "cta.style.display='none';if(typeof zkQVClose==='function')zkQVClose();if(typeof openCheckout==='function')openCheckout();}}");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

dirs.forEach(processDir);
console.log('Done updating product and collection pages.');
