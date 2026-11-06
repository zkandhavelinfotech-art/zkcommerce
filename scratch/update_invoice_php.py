with open('zkc/api/services/php/invoice.php', 'rb') as f:
    c = f.read()

target = b"if (session_status() !== PHP_SESSION_ACTIVE) @session_start();\r\nrequire_once __DIR__ . '/store_config.php';\r\nrequire_once __DIR__ . '/db_config.php';\r\nif (is_file(__DIR__ . '/whatsapp_config.php')) require_once __DIR__ . '/whatsapp_config.php';\r\nrequire_once __DIR__ . '/whatsapp_orders.php';\r\nrequire_once __DIR__ . '/commerce.php';"

replacement = b"""if (session_status() !== PHP_SESSION_ACTIVE) @session_start();
$dir = __DIR__;
if (!is_file($dir . '/store_config.php') && is_file($dir . '/api/services/php/store_config.php')) {
    $dir = $dir . '/api/services/php';
}
require_once $dir . '/store_config.php';
require_once $dir . '/db_config.php';
if (is_file($dir . '/whatsapp_config.php')) require_once $dir . '/whatsapp_config.php';
require_once $dir . '/whatsapp_orders.php';
require_once $dir . '/commerce.php';""".replace(b"\n", b"\r\n")

if target in c:
    c2 = c.replace(target, replacement, 1)
    with open('zkc/api/services/php/invoice.php', 'wb') as f:
        f.write(c2)
    with open('zkc/invoice.php', 'wb') as f:
        f.write(c2)
    with open('zkc/deployment/smeram-patch-today-v1.0.15/invoice.php', 'wb') as f:
        f.write(c2)
    with open('zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/invoice.php', 'wb') as f:
        f.write(c2)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND")
