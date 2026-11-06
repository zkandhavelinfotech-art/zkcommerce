path = 'zkc/api/services/php/api.php'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_ensure = """function zkcEnsureOrderColumns($pdo, $tbl) {
    static $ensured = [];
    if (!empty($ensured[$tbl])) return;"""

new_ensure = """function zkcEnsureOrderColumns($pdo, $tbl) {
    if (!$pdo) return;
    static $ensured = [];
    if (!empty($ensured[$tbl])) return;"""

old_get_orders = """function zkcGetOrdersTable($pdo) {
    static $tbl = null;
    if ($tbl !== null) return $tbl;
    try {
        $pdo->query("SELECT 1 FROM `orders` LIMIT 1");"""

new_get_orders = """function zkcGetOrdersTable($pdo) {
    if (!$pdo) return 'orders';
    static $tbl = null;
    if ($tbl !== null) return $tbl;
    try {
        $pdo->query("SELECT 1 FROM `orders` LIMIT 1");"""

content_norm = content.replace('\r\n', '\n')
content_norm = content_norm.replace(old_ensure.replace('\r\n', '\n'), new_ensure.replace('\r\n', '\n'))
content_norm = content_norm.replace(old_get_orders.replace('\r\n', '\n'), new_get_orders.replace('\r\n', '\n'))

with open(path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("Updated zkcEnsureOrderColumns and zkcGetOrdersTable with safe null checks")

