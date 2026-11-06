import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/invoice.php', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'autoPrint', text)]
print('autoPrint matches:', matches)
for m in matches:
    print(text[m-20:m+80])

