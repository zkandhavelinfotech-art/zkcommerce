import re

index_path = 'zkc/merchant/index.html'
with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern for old ekartCard
start_marker = '<div class="card" id="ekartCard">'
end_marker = '<div class="card">\n          <h2 style="font-size:16px;margin:0 0 16px">Add Shipping Rate Rule</h2>'

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start != -1 and idx_end != -1:
    new_card = '''<div class="card" id="ekartCard">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
              <h2 style="font-size:16px;margin:0 0 4px">Ekart Shipping &amp; Webhook Integration</h2>
              <p style="font-size:13px;color:var(--muted);margin:0">Direct courier integration for AWB tracking, barcode labels, and automated WhatsApp delivery notifications.</p>
            </div>
            <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;padding:4px 10px;border-radius:12px;font-size:12px;border:1px solid #bae6fd">Client ID: EKART_6ad49aef2206ede3ee46d222</span>
          </div>

          <label class="legal-card" style="justify-content:flex-start;gap:10px;cursor:pointer;max-width:680px"><input type="checkbox" id="ekEnabled"><span><b>Enable Ekart shipping</b><br><small style="color:var(--muted)">When on, the <b>Shipments (Ekart)</b> page lets you scan AWBs, print labels and sync webhook tracking.</small></span></label>

          <div id="ekFields" style="margin-top:14px">
            <!-- Ekart Webhook Integration Parameters Box -->
            <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:16px;margin-bottom:18px">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:18px">⚡</span>
                  <div>
                    <h3 style="font-size:14px;font-weight:700;margin:0;color:#0f172a">Ekart Webhook Integration Details</h3>
                    <p style="font-size:12px;color:#64748b;margin:2px 0 0">Enter these exact parameters in your Ekart Developer / Webhooks dashboard:</p>
                  </div>
                </div>
                <span style="background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px">Active Endpoint</span>
              </div>

              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">
                <div style="grid-column:1/-1">
                  <label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;display:block;margin-bottom:4px">1. Webhook URL (Enter URL)</label>
                  <div style="display:flex;gap:6px">
                    <input id="ekWebhookUrlDisplay" readonly value="https://smeram-naturals.in/api.php?route=webhooks/ekart" style="font-family:monospace;font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;flex:1;font-weight:600" />
                    <button type="button" class="btn-subtle" onclick="navigator.clipboard.writeText('https://smeram-naturals.in/api.php?route=webhooks/ekart');alert('Webhook URL copied!');" style="padding:4px 12px;font-size:12px;font-weight:600;white-space:nowrap;background:#fff;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer">📋 Copy URL</button>
                  </div>
                </div>

                <div>
                  <label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;display:block;margin-bottom:4px">2. Secret (Enter Secret)</label>
                  <div style="display:flex;gap:6px">
                    <input id="ekWebhookSecretDisplay" readonly value="ek_sec_984f1801m1z6_smeram" style="font-family:monospace;font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;flex:1;font-weight:600" />
                    <button type="button" class="btn-subtle" onclick="navigator.clipboard.writeText('ek_sec_984f1801m1z6_smeram');alert('Webhook Secret copied!');" style="padding:4px 12px;font-size:12px;font-weight:600;white-space:nowrap;background:#fff;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer">📋 Copy Secret</button>
                  </div>
                </div>

                <div>
                  <label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;display:block;margin-bottom:4px">3. Alert Email</label>
                  <input readonly value="smeramindustries@gmail.com" style="width:100%;font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-weight:600" />
                </div>

                <div style="grid-column:1/-1">
                  <label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;display:block;margin-bottom:4px">4. Topics (Select Topics)</label>
                  <div style="display:flex;gap:6px">
                    <input id="ekWebhookTopicsDisplay" readonly value="shipment.created, shipment.pickup_completed, shipment.in_transit, shipment.out_for_delivery, shipment.delivered, shipment.rto" style="font-family:monospace;font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;flex:1" />
                    <button type="button" class="btn-subtle" onclick="navigator.clipboard.writeText('shipment.created, shipment.pickup_completed, shipment.in_transit, shipment.out_for_delivery, shipment.delivered, shipment.rto');alert('Topics copied!');" style="padding:4px 12px;font-size:12px;font-weight:600;white-space:nowrap;background:#fff;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer">📋 Copy Topics</button>
                  </div>
                  <small style="color:#64748b;font-size:11px;margin-top:4px;display:block">Select all listed topics or tick <b>"Select All"</b> in the Ekart dashboard to receive status updates.</small>
                </div>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group"><label>How AWBs are created</label>
                <select id="ekMode"><option value="api">Ekart API &amp; Webhooks — automated tracking &amp; status sync</option><option value="manual">Manual — book on Ekart portal, enter / scan AWB</option></select></div>
              <div class="form-group"><label>Courier name on labels</label><input id="ekCourier" placeholder="Ekart Logistics"></div>
              <div class="form-group" style="grid-column:1/-1"><label>Tracking link ({awb} is replaced)</label><input id="ekTrack" placeholder="https://ekartlogistics.com/shipmenttrack/{awb}"></div>
            </div>
            <details id="ekApiBox" style="margin:4px 0 10px"><summary style="cursor:pointer;font-size:13px;font-weight:700">Ekart API Credentials</summary>
              <div class="form-grid" style="margin-top:10px">
                <div class="form-group"><label>API base URL</label><input id="ekApiBase" placeholder="https://api.ekartlogistics.com"></div>
                <div class="form-group"><label>Client ID</label><input id="ekApiClient" value="EKART_6ad49aef2206ede3ee46d222"></div>
                <div class="form-group"><label>Merchant code</label><input id="ekApiMerchant" value="SMERAM"></div>
                <div class="form-group"><label>API key</label><input id="ekApiKey" type="password" placeholder="Leave blank to keep the saved key"></div>
              </div>
            </details>
          </div>
          <div id="ekStatus" style="font-size:13px;font-weight:600;margin:8px 0;min-height:18px"></div>
          <button class="btn-primary" id="btnSaveEkart">Save Ekart settings</button>
        </div>

        '''
    content = content[:idx_start] + new_card + content[idx_end:]
    print("Replaced ekartCard")
else:
    print("Markers not found:", idx_start, idx_end)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated merchant/index.html")

