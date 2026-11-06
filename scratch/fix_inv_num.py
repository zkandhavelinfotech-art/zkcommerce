import os

for path in [
    'zkc/api/services/php/invoice.php',
    'zkc/invoice.php',
    'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/invoice.php',
    'zkc/deployment/smeram-patch-today-v1.0.15/invoice.php'
]:
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('h($invoiceNumber)', 'h($invNum)')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Fixed", path)

