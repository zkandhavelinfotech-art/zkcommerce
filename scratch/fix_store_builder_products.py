path = 'zkc/store-builder/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the table header in renderProducts
old_th = "<th>Product</th><th>Category</th><th>Size</th><th>Stock Qty</th><th>SKU</th><th>Price</th><th>Status</th><th>Stock Status</th><th></th>"
new_th = "<th>Product</th><th>Category</th><th>Size</th><th>Stock Qty</th><th>SKU</th><th>Price</th><th>Status</th><th>Stock Status</th><th style=\"text-align:right\">Actions</th>"

if old_th in content:
    content = content.replace(old_th, new_th)
    print("Updated table header in store-builder")
else:
    print("old_th not found")

# 2. Add sticky styling for productTable Actions column and modal-foot sticky
sb_css = '''
/* Sticky Product Actions in Store Builder */
#productTable {
  overflow-x: auto;
  max-width: 100%;
}
#productTable table {
  min-width: 950px;
  width: 100%;
  border-collapse: collapse;
}
#productTable th, #productTable td {
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
}
#productTable th:last-child,
#productTable td:last-child {
  position: sticky;
  right: 0;
  background: #ffffff;
  box-shadow: -4px 0 8px rgba(0,0,0,0.06);
  z-index: 2;
  text-align: right;
  white-space: nowrap;
}
#productTable thead th:last-child {
  background: #f8fafc;
  z-index: 3;
}
.modal.modal-lg {
  max-height: 90vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
.modal.modal-lg .modal-body {
  overflow-y: auto !important;
  flex: 1 !important;
}
.modal.modal-lg .modal-foot {
  position: sticky !important;
  bottom: 0 !important;
  background: #fff !important;
  border-top: 1px solid #e2e8f0 !important;
  z-index: 10 !important;
  flex-shrink: 0 !important;
}
'''

if '#productTable th:last-child' not in content:
    content = content.replace('</style>', sb_css + '\n</style>', 1)
    print("Added Store Builder table and sticky modal footer styles")

# 3. Enhance openProduct with try-catch and safe element checks
old_open_start = "function openProduct(p){editingProduct=p||null;const f=document.getElementById('productForm');f.reset();renderCategories();f.elements.id.value=p?.id||'';"
new_open_start = "function openProduct(p){try{editingProduct=p||null;const f=document.getElementById('productForm');if(!f)return;f.reset();if(typeof renderCategories==='function')renderCategories();if(f.elements.id)f.elements.id.value=p?.id||'';"

if old_open_start in content:
    content = content.replace(old_open_start, new_open_start)
    print("Enhanced openProduct start")
else:
    print("old_open_start not found")

# Also wrap the end of openProduct with catch
old_open_end = "document.getElementById('productModalTitle').textContent=p?'Edit Product and Product details':'Add Product';document.getElementById('productModal').classList.add('open')}"
new_open_end = "const titleEl=document.getElementById('productModalTitle');if(titleEl)titleEl.textContent=p?'Edit Product and Product details':'Add Product';const m=document.getElementById('productModal');if(m)m.classList.add('open')}catch(err){console.error('Error in openProduct:',err);const m=document.getElementById('productModal');if(m)m.classList.add('open')}}"

if old_open_end in content:
    content = content.replace(old_open_end, new_open_end)
    print("Enhanced openProduct end with try-catch")
else:
    print("old_open_end not found")

# Also ensure data-edit-product matching compares both String and Number
old_click = "host.querySelectorAll('[data-edit-product]').forEach(b=>b.onclick=()=>openProduct(products.find(p=>String(p.id)===b.dataset.editProduct)));"
new_click = "host.querySelectorAll('[data-edit-product]').forEach(b=>b.onclick=()=>openProduct(products.find(p=>String(p.id)===String(b.dataset.editProduct)||Number(p.id)===Number(b.dataset.editProduct))));"

if old_click in content:
    content = content.replace(old_click, new_click)
    print("Updated data-edit-product button click matcher")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("zkc/store-builder/index.html updated successfully")

