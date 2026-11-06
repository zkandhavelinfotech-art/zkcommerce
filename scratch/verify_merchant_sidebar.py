with open('zkc/merchant/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

checks = [
    'navShipments',
    'invLowBadge',
    'group-catalog',
    'group-orders',
    'group-customers',
    'group-settings',
    'toggleNavGroup',
    'toggleAllNavGroups',
    'data-view="products"',
    'data-view="orders"',
    'data-view="packaging"',
    'data-view="invoices"',
    'data-view="shipping"'
]

for c in checks:
    assert c in text, f"Missing check: {c}"
    print(f"Verified: {c}")

print("\nALL MERCHANT SIDEBAR CHECKS PASSED SUCCESSFULLY!")

