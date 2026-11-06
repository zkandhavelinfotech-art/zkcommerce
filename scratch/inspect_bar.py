import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/invoice.php', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('<div class="bar">')
print(text[idx:idx+600])

