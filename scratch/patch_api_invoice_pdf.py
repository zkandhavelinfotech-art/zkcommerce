path = 'zkc/api/services/php/api.php'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """if (preg_match('#^invoices/(\\\\d+)/pdf$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $_GET['id'] = $orderId;
    if (is_file(__DIR__ . '/invoice.php')) {
        require __DIR__ . '/invoice.php';
        exit;
    }
    respond(['error' => 'Invoice template not found'], 404);
}"""

# In raw text, backslash d is just single backslash
raw_target = "if (preg_match('#^invoices/(\\d+)/pdf$#', $route, $m) && $method === 'GET') {\n    $orderId = (int)$m[1];\n    $_GET['id'] = $orderId;\n    if (is_file(__DIR__ . '/invoice.php')) {\n        require __DIR__ . '/invoice.php';\n        exit;\n    }\n    respond(['error' => 'Invoice template not found'], 404);\n}"

replacement = """if (preg_match('#^invoices/(\\d+)/pdf/?$#', $route, $m) && $method === 'GET') {
    $orderId = (int)$m[1];
    $_GET['id'] = $orderId;
    if (!isset($_GET['print'])) $_GET['print'] = '1';
    
    $candidates = [
        __DIR__ . '/invoice.php',
        __DIR__ . '/api/services/php/invoice.php',
        dirname(__DIR__) . '/invoice.php',
        dirname(__DIR__) . '/services/php/invoice.php',
        dirname(dirname(__DIR__)) . '/invoice.php',
        dirname(dirname(__DIR__)) . '/api/services/php/invoice.php',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/invoice.php',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/api/services/php/invoice.php'
    ];
    $foundFile = null;
    foreach ($candidates as $cand) {
        if (!empty($cand) && is_file($cand) && filesize($cand) > 1000) {
            $foundFile = $cand;
            break;
        }
    }
    if (!$foundFile) {
        foreach ($candidates as $cand) {
            if (!empty($cand) && is_file($cand)) {
                $foundFile = $cand;
                break;
            }
        }
    }
    if ($foundFile) {
        require $foundFile;
        exit;
    }
    respond(['error' => 'Invoice template not found'], 404);
}"""

content_norm = content.replace('\r\n', '\n')
if raw_target in content_norm:
    content_norm = content_norm.replace(raw_target, replacement)
    print("Successfully replaced invoices/:id/pdf route handler")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_norm)
else:
    print("Could not find raw_target")
