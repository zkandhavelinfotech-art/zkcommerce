import os

new_bar = """<div class="bar no-print">
  <a href="javascript:history.back()" class="btn btn-back">← Back</a>
  <div style="display:flex;gap:8px">
    <button type="button" id="btnDownloadPdf" class="btn btn-primary" onclick="downloadPdfDocument()">📥 Download PDF Document (.pdf)</button>
    <button type="button" class="btn btn-back" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
</div>"""

files = [
    'zkc/api/services/php/invoice.php',
    'zkc/invoice.php',
    'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/invoice.php',
    'zkc/deployment/smeram-patch-today-v1.0.15/invoice.php'
]

for p in files:
    if not os.path.exists(p):
        continue
    with open(p, 'rb') as f:
        data = f.read()

    # Search for <div class="bar"> to </div>
    idx1 = data.find(b'<div class="bar">')
    if idx1 != -1:
        idx2 = data.find(b'</div>', idx1)
        if idx2 != -1:
            end = idx2 + len(b'</div>')
            crlf_bar = new_bar.replace('\n', '\r\n').encode('utf-8')
            data2 = data[:idx1] + crlf_bar + data[end:]
            with open(p, 'wb') as f:
                f.write(data2)
            print(f"Updated bar in {p}")
        else:
            print(f"Could not find closing </div> in {p}")
    else:
        print(f"Could not find <div class=\"bar\"> in {p}")

