import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/invoice.php', 'r', encoding='utf-8') as f:
    text = f.read()

print('Length of invoice.php:', len(text))
print(text[:1500])

