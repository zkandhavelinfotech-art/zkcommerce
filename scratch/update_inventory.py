path = 'zkc/merchant/inventory.html'

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

old_tbody_start = '<tbody>'
old_tbody_end = '</tbody>'

new_rows = """<tbody>
      <tr><td class="col-primary"><strong>Smeram Ortho Pain Relief Thailam</strong></td><td><code>SM-PO-100</code></td><td>Chennai Main</td><td>120</td><td>5</td><td><span class="badge badge-green">115</span></td><td><button class="btn btn-secondary btn-sm" onclick="toast.info('Stock adjusted')">Adjust</button></td></tr>
      <tr><td class="col-primary"><strong>Smeram Naturals Siddha Hair Oil</strong></td><td><code>SM-HO-200</code></td><td>Chennai Main</td><td>85</td><td>4</td><td><span class="badge badge-green">81</span></td><td><button class="btn btn-secondary btn-sm" onclick="toast.info('Stock adjusted')">Adjust</button></td></tr>
      <tr><td class="col-primary"><strong>Smeram Ayurgold Kumkumadi Face Glow Oil</strong></td><td><code>SM-FP-050</code></td><td>Chennai Main</td><td>65</td><td>2</td><td><span class="badge badge-green">63</span></td><td><button class="btn btn-secondary btn-sm" onclick="toast.info('Stock adjusted')">Adjust</button></td></tr>
      <tr><td class="col-primary"><strong>Smeram Vedic Health Mix &amp; Desi Ghee</strong></td><td><code>SM-HM-500</code></td><td>Chennai Main</td><td>50</td><td>3</td><td><span class="badge badge-green">47</span></td><td><button class="btn btn-secondary btn-sm" onclick="toast.info('Stock adjusted')">Adjust</button></td></tr>
    </tbody>"""

start_idx = html.find(old_tbody_start)
end_idx = html.find(old_tbody_end) + len(old_tbody_end)

if start_idx != -1 and end_idx != -1:
    html = html[:start_idx] + new_rows + html[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated inventory.html successfully!")

