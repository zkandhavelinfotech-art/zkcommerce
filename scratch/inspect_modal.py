import re

path = 'zkc/merchant/products.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's inspect modal overlay start and end
modal_start = content.find('<div class="modal-overlay" id="editProductModal"')
modal_end = content.find('<!-- Modal Footer -->', modal_start)
modal_end = content.find('</div>\n  </div>\n</div>', modal_end) + len('</div>\n  </div>\n</div>')

print("Modal found:", modal_start != -1, modal_end != -1)

