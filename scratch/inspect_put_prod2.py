import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("preg_match('#^products/(\\\\d+)$#', $route")
if idx == -1:
    idx = text.find("products/(\\d+)")
print('idx:', idx)
print(text[idx-50:idx+2500])
