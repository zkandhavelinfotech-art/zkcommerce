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

  // Path normalization for root httpdocs
  html = html.replace(/\.\.\/\.\.\/assets\/themes\/smeram\//g, 'assets/themes/smeram/');


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

  // 4. Copy PHP API endpoints
  const phpDir = path.join(__dirname, '../../api/services/php');
  if (fs.existsSync(phpDir)) {
    const phpFiles = fs.readdirSync(phpDir).filter(f => f.endsWith('.php'));
    phpFiles.forEach(f => {
      const targetPath = path.join(bundleDir, f);
      // Don't overwrite existing db_config.php if user already configured credentials
      if (f === 'db_config.php' && fs.existsSync(targetPath)) return;
      fs.copyFileSync(path.join(phpDir, f), targetPath);
    });
    console.log(`✅ Copied ${phpFiles.length} PHP backend endpoints to ${bundleDir}`);
  }

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
