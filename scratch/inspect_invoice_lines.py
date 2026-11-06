import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/invoice.php', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(30, min(120, len(lines))):
    print(f'{i+1}: {lines[i]}', end='')

