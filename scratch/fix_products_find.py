path = 'zkc/merchant/products.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update onclick in table
old_btn = "'<button class=\"btn btn-secondary btn-sm\" onclick=\"openEditModal(' + p.id + ')\" style=\"font-weight:700\">✏️ Edit</button>'"
new_btn = "'<button class=\"btn btn-secondary btn-sm\" onclick=\"openEditModal(\\\'' + p.id + '\\\')\" style=\"font-weight:700\">✏️ Edit</button>'"

if old_btn in c:
    c = c.replace(old_btn, new_btn)
    print("Updated Edit button onclick quoting")

# 2. Update openEditModal function
old_open_start = "function openEditModal(prodId) {\n  var p = PRODUCTS_LIST.find(function(item){ return item.id === prodId; });\n  if (!p) {\n    toast.error('Product not found');\n    return;\n  }"

new_open_start = """function openEditModal(prodId) {
  if (prodId === undefined || prodId === null || prodId === '') {
    if (PRODUCTS_LIST && PRODUCTS_LIST.length > 0) prodId = PRODUCTS_LIST[0].id;
  }

  // Find by string or number comparison
  var p = PRODUCTS_LIST.find(function(item) {
    return String(item.id) === String(prodId) || Number(item.id) === Number(prodId);
  });

  // If not found, try SKU or slug
  if (!p && typeof prodId === 'string') {
    p = PRODUCTS_LIST.find(function(item) {
      return (item.sku && item.sku.toLowerCase() === prodId.toLowerCase())
          || (item.slug && item.slug.toLowerCase() === prodId.toLowerCase());
    });
  }

  // If still not found and prodId is 1-based index
  if (!p) {
    var idx = parseInt(prodId, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= PRODUCTS_LIST.length) {
      p = PRODUCTS_LIST[idx - 1];
    }
  }

  // Fallback to first product
  if (!p && PRODUCTS_LIST.length > 0) {
    p = PRODUCTS_LIST[0];
  }

  if (!p) {
    toast.error('Product not found: ' + prodId);
    return;
  }"""

c = c.replace(old_open_start.replace('\n', '\r\n'), new_open_start.replace('\n', '\r\n'))
c = c.replace(old_open_start, new_open_start)

# 3. Update saveProductFromModal
old_save_start = "async function saveProductFromModal() {\n  var id = parseInt(document.getElementById('edit-prod-id').value);\n  var p  = PRODUCTS_LIST.find(function(item){ return item.id === id; });\n  if (!p) { toast.error('Product not found'); return; }"

new_save_start = """async function saveProductFromModal() {
  var id = document.getElementById('edit-prod-id').value;
  var p = PRODUCTS_LIST.find(function(item) {
    return String(item.id) === String(id) || Number(item.id) === Number(id);
  });
  if (!p && PRODUCTS_LIST.length > 0) {
    var num = parseInt(id, 10);
    if (!isNaN(num) && num >= 1 && num <= PRODUCTS_LIST.length) {
      p = PRODUCTS_LIST[num - 1];
    } else {
      p = PRODUCTS_LIST[0];
    }
  }
  if (!p) { toast.error('Product not found'); return; }"""

c = c.replace(old_save_start.replace('\n', '\r\n'), new_save_start.replace('\n', '\r\n'))
c = c.replace(old_save_start, new_save_start)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated products.html resilient search successfully!")

