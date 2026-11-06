import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('invoices/(\\d+)/pdf')
print(repr(text[idx-30:idx+250]))

