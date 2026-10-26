const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function buildApiBundle() {
  console.log('=== BUILDING DEDICATED PHP API & SWAGGER PACKAGE FOR SMERAM-NATURALS.IN ===\n');

  const version = '1.0.12';
  const apiBundleDir = path.join(__dirname, '../smeram-api');
  if (fs.existsSync(apiBundleDir)) {
    fs.rmSync(apiBundleDir, { recursive: true, force: true });
  }
  fs.mkdirSync(apiBundleDir, { recursive: true });

  const phpSrcDir = path.join(__dirname, '../../api/services/php');

  // 1. Copy all PHP endpoints
  const phpFiles = [
    'api.php',
    'db_config.php',
    'db_config.example.php',
    'test-db.php',
    'order.php',
    'payment_config.php',
    'payment_config.example.php',
    'store_config.php',
    'whatsapp_orders.php',
    'commerce.php',
    'packaging_api.php',
    'admin-orders.php',
    'admin_common.php',
    'invoice.php',
    'stock.php',
    'coupons.php',
    'customers.php'
  ];

  let copiedPhp = 0;
  phpFiles.forEach(f => {
    const src = path.join(phpSrcDir, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(apiBundleDir, f));
      copiedPhp++;
    } else {
      // Check in deployment/smeram-godaddy
      const altSrc = path.join(__dirname, '../smeram-godaddy', f);
      if (fs.existsSync(altSrc)) {
        fs.copyFileSync(altSrc, path.join(apiBundleDir, f));
        copiedPhp++;
      }
    }
  });
  console.log(`✅ Copied ${copiedPhp} PHP endpoints & utilities into ${apiBundleDir}`);

  // 2. Copy Swagger UI & OpenAPI Specification
  const swaggerSrc = path.join(phpSrcDir, 'swagger.html');
  const openapiSrc = path.join(phpSrcDir, 'openapi.json');
  if (fs.existsSync(swaggerSrc)) {
    fs.copyFileSync(swaggerSrc, path.join(apiBundleDir, 'swagger.html'));
    console.log(`✅ Bundled Swagger UI console (swagger.html)`);
  }
  if (fs.existsSync(openapiSrc)) {
    fs.copyFileSync(openapiSrc, path.join(apiBundleDir, 'openapi.json'));
    console.log(`✅ Bundled OpenAPI 3.0 specification (openapi.json)`);
  }

  // 3. Copy MySQL schema seed
  const sqlSrc = path.join(__dirname, '../smeram-godaddy/smeram_mysql.sql');
  if (fs.existsSync(sqlSrc)) {
    fs.copyFileSync(sqlSrc, path.join(apiBundleDir, 'smeram_mysql.sql'));
    console.log(`✅ Bundled MySQL schema migration (smeram_mysql.sql)`);
  }

  // 4. Create api/ gateway for /api/* requests
  const gatewayDir = path.join(apiBundleDir, 'api');
  fs.mkdirSync(gatewayDir, { recursive: true });
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
  fs.writeFileSync(path.join(gatewayDir, 'index.php'), apiIndexPhp, 'utf8');
  console.log(`✅ Created API gateway: ${path.join(gatewayDir, 'index.php')}`);

  // 5. Create web.config for IIS Windows Hosting
  const webConfig = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <defaultDocument>
            <files>
                <clear />
                <add value="index.html" />
                <add value="index.php" />
                <add value="swagger.html" />
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
    </system.webServer>
</configuration>`;
  fs.writeFileSync(path.join(apiBundleDir, 'web.config'), webConfig, 'utf8');

  // 6. Create .htaccess for Apache / cPanel Linux Hosting
  const htaccess = `# ZKCommerce PHP API Routing
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^api/(.*)$ api.php?route=$1 [QSA,L]
</IfModule>
`;
  fs.writeFileSync(path.join(apiBundleDir, '.htaccess'), htaccess, 'utf8');

  // 7. Write Quick Deploy Instructions
  const readmeContent = `# ZKCommerce Standalone API Package (v${version})

This package contains **only the backend API, Swagger UI, and Database tools** for **smeram-naturals.in**.
You can upload this directly to GoDaddy without re-uploading storefront images or HTML.

## Contents
- \`api.php\` — Main REST API routing (checkout, orders, auth, payments, merchant)
- \`db_config.php\` — MySQL database credentials configuration
- \`test-db.php\` — Visual database connection test console (open in browser: \`https://smeram-naturals.in/test-db.php\`)
- \`swagger.html\` — Interactive Swagger UI testing console (\`https://smeram-naturals.in/swagger.html\`)
- \`openapi.json\` — Complete OpenAPI 3.0 specification
- \`order.php\` — Direct order receiver (supports both \`orders\` and \`smeram_orders\`)
- \`payment_config.php\` — Razorpay API credentials
- \`smeram_mysql.sql\` — MySQL database schema
- \`web.config\` & \`.htaccess\` — Server routing rules for IIS and Apache

## Quick Deployment Steps (1 Minute)
1. In GoDaddy cPanel or File Manager, navigate to \`public_html\` (or \`httpdocs\`).
2. Upload and extract \`smeram-api-v${version}.zip\` directly into the root folder.
3. Open \`https://smeram-naturals.in/test-db.php\` to verify database connection.
4. Open \`https://smeram-naturals.in/swagger.html\` to test all API endpoints!
`;
  fs.writeFileSync(path.join(apiBundleDir, 'README-API-DEPLOY.md'), readmeContent, 'utf8');

  // 8. Create ZIP archive
  const zipName = `smeram-api-v${version}.zip`;
  const zipPath = path.join(__dirname, '../', zipName);
  const latestZipPath = path.join(__dirname, '../smeram-api.zip');

  console.log('\nCreating ZIP archive...');
  try {
    // Use PowerShell Compress-Archive for reliable Windows zip creation
    const psCmd = `Compress-Archive -Path '${apiBundleDir}\\*' -DestinationPath '${zipPath}' -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });
    fs.copyFileSync(zipPath, latestZipPath);
    const stats = fs.statSync(zipPath);
    console.log(`✅ Generated Standalone API ZIP: ${zipPath} (${Math.round(stats.size / 1024)} KB)`);
  } catch (err) {
    console.warn('Compress-Archive warning:', err.message);
  }

  console.log('\n======================================================');
  console.log('🎉 STANDALONE API & SWAGGER PACKAGE GENERATION COMPLETE!');
  console.log(`Directory: ${apiBundleDir}`);
  console.log(`ZIP Package: ${zipPath}`);
  console.log('======================================================\n');
}

buildApiBundle();
