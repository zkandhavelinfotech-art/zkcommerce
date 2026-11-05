import re

path = 'zkc/merchant/products.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove duplicate modal (from m2 to script_pos)
m1 = content.find('id="editProductModal"')
m2 = content.find('id="editProductModal"', m1 + 10)
script_idx = content.find('<script', m2)

if m2 != -1 and script_idx != -1:
    # Find the separator comment before m2
    comment_marker = '<!-- ═══════════════════════════════════════════════════════════════ -->'
    cut_start = content.rfind(comment_marker, m1, m2)
    if cut_start == -1:
        cut_start = m2
    content = content[:cut_start] + content[script_idx:]
    print("Removed duplicate modal from products.html")
else:
    print("Could not find second modal")

# 2. Add proper .zk-table-wrap, .zk-table and sticky Actions column styles to <style>
table_css = '''
/* Responsive Product Table & Sticky Actions */
.zk-table-wrap {
  overflow-x: auto;
  max-width: 100%;
  border: 1px solid var(--zk-border);
  border-radius: 12px;
  background: #fff;
  margin-top: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  -webkit-overflow-scrolling: touch;
}
.zk-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}
.zk-table th, .zk-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--zk-border);
  vertical-align: middle;
}
.zk-table th:last-child,
.zk-table td:last-child {
  position: sticky;
  right: 0;
  background: #ffffff;
  box-shadow: -5px 0 10px rgba(0,0,0,0.05);
  z-index: 2;
  text-align: right;
  white-space: nowrap;
}
.zk-table thead th:last-child {
  background: #f8fafc;
  z-index: 3;
}
.modal-footer {
  padding: 16px 28px;
  border-top: 1px solid var(--zk-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  position: sticky;
  bottom: 0;
  z-index: 20;
  flex-shrink: 0;
}
'''

if '.zk-table-wrap' not in content:
    content = content.replace('.modal-footer {', table_css + '\n/* original footer */\n.modal-footer-orig {')
    print("Added table_css and sticky modal footer")

# 3. Fix p.category_name crash in renderProductsTable
old_cat_icon = "(p.category_name.includes('Hair') ? '🌿' : (p.category_name.includes('Joint') || p.category_name.includes('Pain') ? '🩹' : (p.category_name.includes('Skin') || p.category_name.includes('Face') ? '✨' : '🌾')))"
new_cat_icon = "((String(p.category_name||'')).includes('Hair') ? '🌿' : ((String(p.category_name||'')).includes('Joint') || (String(p.category_name||'')).includes('Pain') ? '🩹' : ((String(p.category_name||'')).includes('Skin') || (String(p.category_name||'')).includes('Face') ? '✨' : '🌾')))"

if old_cat_icon in content:
    content = content.replace(old_cat_icon, new_cat_icon)
    print("Fixed safe category_name check")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("zkc/merchant/products.html updated successfully")
