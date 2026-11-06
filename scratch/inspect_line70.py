import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(70, 91):
    print(f'{i+1}: {lines[i]}', end='')

