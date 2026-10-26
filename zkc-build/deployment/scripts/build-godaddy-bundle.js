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

  const srcStoreBuilderDir = path.join(__dirname, '../../store-builder');
  const destStoreBuilderDir = path.join(bundleDir, 'store-builder');
  if (fs.existsSync(srcStoreBuilderDir)) {
    fs.mkdirSync(destStoreBuilderDir, { recursive: true });
    fs.cpSync(srcStoreBuilderDir, destStoreBuilderDir, { recursive: true });
    console.log(`✅ Bundled Store Builder into ${destStoreBuilderDir}`);
  }

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

  // 5. Create api/ gateway for /api/* requests on GoDaddy
  const apiDir = path.join(bundleDir, 'api');
  fs.mkdirSync(apiDir, { recursive: true });
  const apiIndexPhp = `<?php
/**
 * API Gateway for /api/* on GoDaddy PHP hosting.
 * Routes directly to api.php with route parameter.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$route = trim($_GET['route'] ?? '', '/');
if ($route === '') {
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $route = trim(preg_replace('#^.*?/api/?#', '', $uriPath), '/');
}
if (!empty($route)) {
    $_GET['route'] = $route;
}

require_once __DIR__ . '/../api.php';
`;
  fs.writeFileSync(path.join(apiDir, 'index.php'), apiIndexPhp, 'utf8');

  // 6. Create web.config for GoDaddy Windows IIS with URL Rewrite
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
        <rewrite>
            <rules>
                <rule name="ZKCommerce API Routing" stopProcessing="true">
                    <match url="^api/(.*)$" />
                    <action type="Rewrite" url="api.php?route={R:1}" />
                </rule>
            </rules>
        </rewrite>
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
  console.log('✅ Generated web.config with API rewrite rules for GoDaddy Windows IIS');

  console.log('\n======================================================');
  console.log('🎉 GODADDY WINDOWS BUNDLE GENERATION COMPLETE!');
  console.log(`Location: ${bundleDir}`);
  console.log('======================================================\n');
}

buildBundle();
