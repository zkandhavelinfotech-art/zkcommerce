const fs = require('fs');
const path = require('path');
const http = require('http');

let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log('✅ ' + msg);
  } else {
    console.error('❌ FAIL: ' + msg);
    failed++;
  }
}

// 1. auth/login.html
const authHtml = fs.readFileSync('auth/login.html', 'utf8');
assert(authHtml.includes('value="merchant@smeramnaturals.in"'), 'auth/login.html pre-fills merchant@smeramnaturals.in');
assert(authHtml.includes('value="demo1234"'), 'auth/login.html pre-fills demo1234');
assert(authHtml.includes('Smeram Naturals · Client Login'), 'auth/login.html demo-logins shows Smeram Naturals client login');
assert(!authHtml.includes('merchant@miliro.in'), 'auth/login.html does not show other client accounts in demo logins');
assert(authHtml.includes('../clients/smeram/merchant/index.html') || authHtml.includes('../merchant/index.html'), 'auth/login.html redirects to merchant portal');

// 2. clients/smeram/auth/login.html
const smeramAuthHtml = fs.readFileSync('clients/smeram/auth/login.html', 'utf8');
assert(smeramAuthHtml.includes('value="merchant@smeramnaturals.in"'), 'smeram auth/login.html pre-fills merchant@smeramnaturals.in');
assert(smeramAuthHtml.includes('value="demo1234"'), 'smeram auth/login.html pre-fills demo1234');
assert(smeramAuthHtml.includes('../merchant/index.html'), 'smeram auth/login.html redirects to merchant portal');

// 3. clients/smeram/merchant/index.html
const smeramMerchant = fs.readFileSync('clients/smeram/merchant/index.html', 'utf8');
assert(smeramMerchant.includes('smeram-logo.png'), 'smeram merchant portal includes smeram-logo.png in brand');
assert(smeramMerchant.includes('ZKCommerce') && smeramMerchant.includes('Smeram Naturals'), 'smeram merchant portal displays both brands');
assert(smeramMerchant.includes('id="btnLogoff"'), 'smeram merchant portal has top right log off button');
assert(smeramMerchant.includes('--bg: #fff5f7') || smeramMerchant.includes('--bg:#fff5f7'), 'smeram merchant portal has light pink theme variables');
assert(smeramMerchant.includes("location.href = '../index.html'"), 'smeram merchant logout redirects to client portal');

// 4. merchant/index.html
const rootMerchant = fs.readFileSync('merchant/index.html', 'utf8');
assert(rootMerchant.includes('smeram-logo.png'), 'root merchant portal includes smeram-logo.png in brand');
assert(rootMerchant.includes('id="btnLogoff"'), 'root merchant portal has top right log off button');
assert(rootMerchant.includes("location.href = '../clients/smeram/index.html'") || rootMerchant.includes("location.href = '../index.html'"), 'root merchant logout redirects to client portal for smeram');

// 5. store-builder/index.html
const sbHtml = fs.readFileSync('store-builder/index.html', 'utf8');
assert(sbHtml.includes('Featured Products Visibility'), 'store-builder has Featured Products Visibility in renderProperties');
assert(sbHtml.includes("toggleSection('Show Featured Products on Home Page'"), 'store-builder has Show Featured Products toggle');
assert(sbHtml.includes("key==='products'&&prop==='visible'"), 'store-builder setSectionProp handles products visible');
assert(sbHtml.includes("products_enabled:s[key].visible"), 'store-builder treeItem syncs products visibility');
assert(sbHtml.includes("products_enabled:cb.checked"), 'store-builder displaySettings syncs products visibility');
assert(sbHtml.includes("colors:['#ED6375','#FFF5F7','#A3B545']"), 'store-builder smeram preset uses light pink background');

// 6. clients/smeram/index.html
const storefront = fs.readFileSync('clients/smeram/index.html', 'utf8');
assert(storefront.includes('About Us'), 'storefront has About Us menu item');
assert(storefront.includes('Shop <span class="caret">▾</span>'), 'storefront has Shop ▾ menu item');
assert(storefront.includes('smd-subcats-col'), 'storefront Shop dropdown has sub category menu');
assert(storefront.includes('smd-prods-col'), 'storefront Shop dropdown has product menu');
assert(storefront.includes('Contact Us'), 'storefront has Contact Us menu item');
assert(!storefront.match(/<ul class="nav-links"[^>]*>[\s\S]*?All Products[\s\S]*?<\/ul>/i), 'storefront nav-links does NOT contain All Products');
assert(!storefront.includes('data-cat="all"'), 'storefront catTabs does NOT contain All Products tab');
assert(storefront.includes('#products" style="display:none"') || storefront.includes('#products{display:none}'), 'storefront hides products on home page');
assert(storefront.includes('background:#FFF9FA'), 'storefront body uses floral light pink background');

// 7. store-builder and merchant redirect files
assert(fs.existsSync('clients/smeram/store-builder/index.html'), 'clients/smeram/store-builder/index.html exists');
assert(fs.existsSync('merchant/client/store-builder/index.html'), 'merchant/client/store-builder/index.html exists');
assert(fs.existsSync('merchant/client/index.html'), 'merchant/client/index.html exists');

// 8. Test live storefront API endpoint
http.get('http://localhost:3000/api/storefront/smeram', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const tc = data.theme_config || data.store?.theme_config || {};
      assert(tc.announcement_enabled === false, 'API DB Smeram announcement_enabled is false');
      assert(tc.sections?.announcement?.visible === false, 'API DB Smeram sections.announcement.visible is false');
      assert(tc.sections?.products?.visible === false, 'API DB Smeram sections.products.visible is false');
      assert(tc.bg_colour === '#FFF5F7', 'API DB Smeram bg_colour is #FFF5F7');
      assert(tc.primary_colour === '#ED6375', 'API DB Smeram primary_colour is #ED6375');
      const menu = tc.sections?.nav?.menu || [];
      assert(menu.length === 3, 'API DB Smeram nav.menu has exactly 3 items');
      assert(menu[0]?.label === 'About Us', 'API DB nav.menu item 1 is About Us');
      assert(menu[1]?.label === 'Shop', 'API DB nav.menu item 2 is Shop');
      assert(menu[2]?.label === 'Contact Us', 'API DB nav.menu item 3 is Contact Us');
      console.log('\n--- VERIFICATION SUMMARY ---');
      if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED (0 FAILURES)!');
        process.exit(0);
      } else {
        console.error('💥 ' + failed + ' TESTS FAILED');
        process.exit(1);
      }
    } catch (e) {
      console.error('API Parse error:', e);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('HTTP request error:', e);
  process.exit(1);
});
