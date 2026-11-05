path = 'zkc/merchant/products-add.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

target1 = """    <div class="field-group" style="margin-bottom:12px"><label class="field-label">Cost price (₹)</label><input type="number" class="field" id="pcost" placeholder="8000"></div>
    <div class="field-group" style="margin-bottom:12px"><label class="field-label">GST rate</label><select class="field" id="grate" onchange="calcG()"><option value="0">0%</option><option value="5">5% — Textiles</option><option value="12" selected>12% — Fashion</option><option value="18">18% — Electronics</option><option value="28">28% — Luxury</option></select></div>
    <div id="gbox" style="display:none;background:var(--zk-pale);border-radius:9px;padding:12px;font-size:12px"><div style="font-weight:700;color:var(--zk-indigo);margin-bottom:7px">GST breakdown</div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Taxable</span><span id="gtx" style="font-weight:700">—</span></div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>CGST</span><span id="gcg" style="font-weight:700">—</span></div><div style="display:flex;justify-content:space-between"><span>SGST</span><span id="gsg" style="font-weight:700">—</span></div></div>"""

replacement1 = """    <div class="field-group" style="margin-bottom:12px"><label class="field-label">Cost price (₹)</label><input type="number" class="field" id="pcost" placeholder="250"></div>
    <div class="field-group" style="margin-bottom:12px"><label class="field-label">HSN / SAC Code *</label><input type="text" class="field" id="phsn" placeholder="30049013" value="30049013" style="font-weight:600"></div>
    <div class="field-group" style="margin-bottom:12px"><label class="field-label">GST rate (%) *</label><select class="field" id="grate" onchange="calcG()"><option value="5" selected>5% — Pain Oil &amp; Hair Oil (Ayurvedic/Siddha)</option><option value="18">18% — Face Pack &amp; Health Mix (Cosmetics/Food)</option><option value="0">0% — Nil / Exempted</option><option value="12">12% — Standard Goods</option><option value="28">28% — Luxury Goods</option></select></div>
    <div id="gbox" style="display:none;background:#F0FDF4;border:1px solid #86EFAC;border-radius:9px;padding:12px;font-size:12px"><div style="font-weight:700;color:#166534;margin-bottom:7px">🧾 Smeram Inclusive GST Breakdown</div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Taxable Base Value</span><span id="gtx" style="font-weight:700;color:#1E40AF">—</span></div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>CGST (Rate / 2)</span><span id="gcg" style="font-weight:700;color:#059669">—</span></div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>SGST (Rate / 2)</span><span id="gsg" style="font-weight:700;color:#059669">—</span></div><div style="display:flex;justify-content:space-between;border-top:1px dashed #BBF7D0;padding-top:4px"><span>Total GST Amount</span><span id="gtot" style="font-weight:800;color:#059669">—</span></div></div>"""

target2 = "function calcG(){const p=parseFloat(document.getElementById('sprice').value)||0;const r=parseFloat(document.getElementById('grate').value)/100;if(p>0){const b=p/(1+r);const t=(p-b)/2;document.getElementById('gtx').textContent=fmt.inr(b,2);document.getElementById('gcg').textContent=fmt.inr(t,2);document.getElementById('gsg').textContent=fmt.inr(t,2);document.getElementById('gbox').style.display='block';}}"

replacement2 = "function calcG(){const p=parseFloat(document.getElementById('sprice').value)||0;const r=parseFloat(document.getElementById('grate').value)||5;if(p>0){const b=Math.round(p*10000/(100+r))/100;const tot=Math.round((p-b)*100)/100;const t=Math.round((tot/2)*100)/100;document.getElementById('gtx').textContent=fmt.inr(b,2);document.getElementById('gcg').textContent=fmt.inr(t,2);document.getElementById('gsg').textContent=fmt.inr(t,2);if(document.getElementById('gtot'))document.getElementById('gtot').textContent=fmt.inr(tot,2);document.getElementById('gbox').style.display='block';}}"

c = c.replace(target1.replace('\r\n', '\n'), replacement1)
c = c.replace(target1, replacement1)
c = c.replace(target2, replacement2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated products-add.html successfully!")

