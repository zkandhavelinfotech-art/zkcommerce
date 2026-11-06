import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('zkc/api/services/php/api.php', 'r', encoding='utf-8') as f:
    text = f.read()

pos = 38859 + 1800
print(text[pos:pos+1500])

