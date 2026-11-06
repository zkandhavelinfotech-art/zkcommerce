import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(85, 115):
    print(f'{i+1}: {lines[i]}', end='')

