const fs = require('fs');
const path = require('path');

function buildBundle() {
  console.log('=== BUILDING GODADDY WINDOWS BUNDLE FOR SMERAM-NATURALS.IN ===\n');

  const bundleDir = path.join(__dirname, '../smeram-godaddy');
  const assetTargetDir = path.join(bundleDir, 'assets/themes/smeram');
  fs.mkdirSync(assetTargetDir, { recursive: true });

  // 1. Copy assets
  const srcAssetsDir = path.join(__dirname, '../../assets/themes/smeram');
  const assetFiles = fs.readdirSync(srcAssetsDir);
  assetFiles.forEach(file => {
    fs.copyFileSync(path.join(srcAssetsDir, file), path.join(assetTargetDir, file));
  });
  console.log(`✅ Copied ${assetFiles.length} image assets to ${assetTargetDir}`);

  // 2. Read client index.html and normalize paths for GoDaddy httpdocs root
  const srcHtmlPath = path.join(__dirname, '../../clients/smeram/index.html');
  let html = fs.readFileSync(srcHtmlPath, 'utf8');

  // Replace ../../assets/ with assets/
  html = html.replace(/\.\.\/\.\.\/assets\/themes\/smeram\//g, 'assets/themes/smeram/');

  // Inject MySQL save call into handlePlaceOrder
  const targetSnippet = "const orderNum = 'SM-' + Math.floor(1000 + Math.random() * 9000);";
  const orderSaveSnippet = `const orderNum = 'SM-' + Math.floor(1000 + Math.random() * 9000);
  // Persist order into GoDaddy MySQL database
  fetch('order.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_number: orderNum,
      customer_name: name,
      customer_phone: phone,
      customer_email: fd.get('email') || '',
      shipping_address: address,
      city: city,
      pincode: pincode,
      payment_method: payMethod,
      total_amount: grandTotal,
      discount_amount: discountAmount,
      coupon_code: couponCode,
      items: cart.map(function(c) {
        var p = catalog.find(function(x) { return x.id === c.id; });
        return { id: p.id, name: p.name, size: p.size, qty: c.qty, price: p.price };
      })
    })
  }).then(function(r) { return r.json(); }).then(function(res) {
    console.log('MySQL Order Saved:', res);
  }).catch(function(err) {
    console.log('MySQL Note (Offline Mode):', err);
  });`;

  if (html.includes(targetSnippet)) {
    html = html.replace(targetSnippet, orderSaveSnippet);
    console.log('✅ Injected GoDaddy MySQL order recording into handlePlaceOrder()');
  }

  const destHtmlPath = path.join(bundleDir, 'index.html');
  fs.writeFileSync(destHtmlPath, html, 'utf8');
  console.log(`✅ Generated standalone root index.html (${html.length} bytes)`);

  // 3. Copy Merchant Admin Portal and Auth (excluding internal SaaS platform developer tools)
  const srcMerchantDir = path.join(__dirname, '../../merchant');
  const destMerchantDir = path.join(bundleDir, 'merchant');
  if (fs.existsSync(destMerchantDir)) {
    fs.rmSync(destMerchantDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destMerchantDir, { recursive: true });
  const EXCLUDED_DEV_FILES = [
    'db-migrations.html',
    'gap-analysis.html',
    'release-history.html',
    'architecture-guide.html',
    'release-gap-comparison.html',
    'dashboard.html'
  ];
  fs.cpSync(srcMerchantDir, destMerchantDir, {
    recursive: true,
    filter: (src) => !EXCLUDED_DEV_FILES.some(f => src.endsWith(f))
  });
  console.log(`✅ Copied client merchant portal to ${destMerchantDir} (internal SaaS dashboard & dev tools excluded)`);

  const srcAuthDir = path.join(__dirname, '../../auth');
  const destAuthDir = path.join(bundleDir, 'auth');
  fs.mkdirSync(destAuthDir, { recursive: true });
  fs.cpSync(srcAuthDir, destAuthDir, { recursive: true });

  const srcFullAssets = path.join(__dirname, '../../assets');
  const destFullAssets = path.join(bundleDir, 'assets');
  fs.cpSync(srcFullAssets, destFullAssets, { recursive: true });
  console.log(`✅ Bundled design system assets into ${destFullAssets}`);

  // 3. Create web.config for GoDaddy Windows IIS
  const webConfigContent = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <defaultDocument>
            <files>
                <clear />
                <add value="index.html" />
                <add value="index.php" />
            </files>
        </defaultDocument>
        <httpProtocol>
            <customHeaders>
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-Frame-Options" value="SAMEORIGIN" />
            </customHeaders>
        </httpProtocol>
        <staticContent>
            <remove fileExtension=".webp" />
            <mimeMap fileExtension=".webp" mimeType="image/webp" />
        </staticContent>
    </system.webServer>
</configuration>`;
  fs.writeFileSync(path.join(bundleDir, 'web.config'), webConfigContent, 'utf8');
  console.log('✅ Generated web.config for GoDaddy Windows IIS');

  console.log('\n======================================================');
  console.log('🎉 GODADDY WINDOWS BUNDLE GENERATION COMPLETE!');
  console.log(`Location: ${bundleDir}`);
  console.log('======================================================\n');
}

buildBundle();
