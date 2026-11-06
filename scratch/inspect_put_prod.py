import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("preg_match('#^products/(\\d+)$#', $route")
print(text[idx-50:idx+2500])

