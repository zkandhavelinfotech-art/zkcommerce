path = 'zkc/api/services/php/api.php'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_fn = False
replaced = False

for i, line in enumerate(lines):
    if 'function zkcGetProducts(' in line:
        in_fn = True
        new_lines.append(line)
        new_lines.append("    if ($pdo) {\n")
        new_lines.append("        try {\n")
        new_lines.append("            $stmt = $pdo->prepare(\"SELECT p.*, c.name AS category_name FROM `products` p LEFT JOIN `categories` c ON c.id = p.category_id WHERE p.store_id = ? ORDER BY p.created_at DESC\");\n")
        new_lines.append("            $stmt->execute([$storeId]);\n")
        new_lines.append("            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];\n")
        new_lines.append("            if (!empty($rows)) {\n")
        new_lines.append("                return array_map(function($r) {\n")
        new_lines.append("                    $r['id'] = (int)$r['id'];\n")
        new_lines.append("                    $r['price'] = (float)$r['price'];\n")
        new_lines.append("                    $r['in_stock'] = (bool)($r['in_stock'] ?? 1);\n")
        new_lines.append("                    $r['active'] = (bool)($r['active'] ?? 1);\n")
        new_lines.append("                    return $r;\n")
        new_lines.append("                }, $rows);\n")
        new_lines.append("            }\n")
        new_lines.append("        } catch (Throwable $e) {}\n")
        new_lines.append("    }\n")
    elif in_fn:
        if '$defaults = [' in line:
            in_fn = False
            new_lines.append(line)
        # skip lines until $defaults
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Updated zkcGetProducts successfully!")

