import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('async function loadInvoices(')
if idx == -1:
    idx = text.find('function loadInvoices(')
print('loadInvoices found at:', idx)
print(text[idx:idx+2500])

