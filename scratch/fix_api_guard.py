path = 'zkc/api/services/php/api.php'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '// For routes requiring the database, verify connection' in line:
        new_lines.append(line)
        new_lines.append("$dbOptionalRoutes = ['orders/whatsapp-settings', 'whatsapp/sender', 'whatsapp/sender/test', 'stores/templates', 'products'];\n")
        new_lines.append("$isProductRoute = ($route === 'products' || preg_match('#^products/#', $route) || preg_match('#^stores/(\\\\d+)/products#', $route));\n")
        new_lines.append("if (!$pdo && !in_array($route, $dbOptionalRoutes) && !$isProductRoute) {\n")
        skip = True
    elif skip:
        if '$connErr =' in line:
            new_lines.append(line)
            skip = False
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Fixed api.php lines successfully!')

