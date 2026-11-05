with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="ekartCard"')
idx2 = text.find('id="shippingRateForm"')
print('--- EKART CARD HTML ---')
print(text[idx:idx2])

idx3 = text.find('function loadEkartSettings')
print('--- LOAD EKART SETTINGS JS ---')
print(text[idx3:idx3+1200])
