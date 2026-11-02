const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'zkc', 'api', 'services', 'php', 'api.php'),
  path.join(__dirname, '..', 'zkc-build', 'api', 'services', 'php', 'api.php')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  // Insert helper function before route checks if not already present
  if (!content.includes('function zkcGetThemeConfig(')) {
    const helperCode = `function zkcGetThemeConfig() {
    $themeConfigFile = __DIR__ . '/store_theme_config.json';
    $saved = [];
    if (is_file($themeConfigFile)) {
        $saved = json_decode(file_get_contents($themeConfigFile), true) ?: [];
    }
    $defaultCheckout = [
        'cod' => defined('CHECKOUT_COD') ? CHECKOUT_COD : true,
        'razorpay' => defined('CHECKOUT_RAZORPAY') ? CHECKOUT_RAZORPAY : true,
        'show_coupon' => defined('CHECKOUT_COUPON') ? CHECKOUT_COUPON : false,
        'show_shipping_field' => true,
        'show_whatsapp_order' => false,
        'show_cart_popup' => true,
        'show_payment_selector' => true,
        'pay_button' => [
            'text' => 'Place order',
            'font_family' => '',
            'font_size' => null,
            'radius' => null,
            'bold' => true,
            'bg_color' => '',
            'text_color' => ''
        ]
    ];
    $savedCheckout = $saved['checkout'] ?? [];
    $saved['checkout'] = array_merge($defaultCheckout, is_array($savedCheckout) ? $savedCheckout : []);
    return $saved;
}
`;
    content = content.replace("// 1. Check query parameter route", helperCode + "\n// 1. Check query parameter route");
  }

  // In stores/(\d+)/builder: use zkcGetThemeConfig()
  content = content.replace(
    /'theme_config' => \[\s*'checkout' => \[\s*'cod' => defined\('CHECKOUT_COD'\) \? CHECKOUT_COD : false,\s*'razorpay' => defined\('CHECKOUT_RAZORPAY'\) \? CHECKOUT_RAZORPAY : true,\s*'show_coupon' => defined\('CHECKOUT_COUPON'\) \? CHECKOUT_COUPON : false,\s*'show_shipping_field' => true,\s*'show_whatsapp_order' => false\s*\]\s*\]/g,
    `'theme_config' => zkcGetThemeConfig()`
  );

  // In storefront/([^/]+): use zkcGetThemeConfig()
  content = content.replace(
    /'theme_config' => \[\s*'checkout' => \[\s*'cod' => defined\('CHECKOUT_COD'\) \? CHECKOUT_COD : false,\s*'razorpay' => defined\('CHECKOUT_RAZORPAY'\) \? CHECKOUT_RAZORPAY : true,/g,
    `'theme_config' => zkcGetThemeConfig(),\n            '_old_checkout' => [`
  );

  // In stores/(\d+)/(draft|publish): handle PUT draft and save merged theme_config
  const oldDraftRoute = `// Draft & Publish
if (preg_match('#^stores/(\\d+)/(draft|publish)$#', $route)) {
    respond(['success' => true]);
}`;
  const newDraftRoute = `// Draft & Publish
if (preg_match('#^stores/(\\d+)/draft$#', $route) && $method === 'PUT') {
    $themeConfigFile = __DIR__ . '/store_theme_config.json';
    $existing = zkcGetThemeConfig();
    $incoming = is_array($body['theme_config'] ?? null) ? $body['theme_config'] : [];
    $existingCheckout = $existing['checkout'] ?? [];
    $incomingCheckout = is_array($incoming['checkout'] ?? null) ? $incoming['checkout'] : [];
    $mergedCheckout = array_merge($existingCheckout, $incomingCheckout);
    $merged = array_merge($existing, $incoming);
    $merged['checkout'] = $mergedCheckout;
    @file_put_contents($themeConfigFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    respond(['success' => true, 'theme_config' => $merged]);
}
if (preg_match('#^stores/(\\d+)/(draft|publish)$#', $route)) {
    respond(['success' => true]);
}`;

  content = content.replace(oldDraftRoute, newDraftRoute);

  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Updated:', file);
}

