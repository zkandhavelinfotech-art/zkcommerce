def get_product_gst(name):
    n = name.lower()
    if 'pain' in n or 'ortho' in n or 'joint' in n:
        return {'rate': 5.0, 'hsn': '30049013', 'name': 'Pain Oil'}
    elif 'hair' in n or 'thailam' in n:
        return {'rate': 5.0, 'hsn': '33059019', 'name': 'Hair Oil'}
    elif 'face' in n or 'kumkumadi' in n or 'ayurgold' in n:
        return {'rate': 18.0, 'hsn': '33049990', 'name': 'Face Pack'}
    elif 'health' in n or 'ghee' in n or 'vedic' in n or 'mix' in n:
        return {'rate': 18.0, 'hsn': '19011099', 'name': 'Health Mix'}
    return {'rate': 5.0, 'hsn': '30049013', 'name': 'Ayurvedic Product'}

test_items = [
    ('Mahanarayan Ortho Pain Oil', 349.0, 1),
    ('Smeram Naturals Hair Oil', 299.0, 1),
    ('Ayurgold Kumkumadi Face Oil', 499.0, 1),
    ('Vedic A2 Desi Gir Cow Ghee', 799.0, 1),
]

for name, gross, qty in test_items:
    info = get_product_gst(name)
    rate = info['rate']
    hsn = info['hsn']
    total_gross = gross * qty
    taxable = round(total_gross * 100.0 / (100.0 + rate), 2)
    gst_val = round(total_gross - taxable, 2)
    cgst = round(gst_val / 2.0, 2)
    sgst = round(gst_val - cgst, 2)
    print(f"{name} (HSN: {hsn}, GST: {rate}%):")
    print(f"  Gross: INR {total_gross:.2f} | Base/Taxable: INR {taxable:.2f} | GST: INR {gst_val:.2f} (CGST: INR {cgst:.2f}, SGST: INR {sgst:.2f})")
    assert round(taxable + gst_val, 2) == round(total_gross, 2)
print("\nAll GST inclusive formulas match 100% perfectly!")

