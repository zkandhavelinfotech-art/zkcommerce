import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/invoice.php', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Total lines in invoice.php:', len(lines))
for i in range(len(lines) - 80, len(lines)):
    print(f'{i+1}: {lines[i]}', end='')

