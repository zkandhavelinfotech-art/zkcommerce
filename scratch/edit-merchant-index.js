const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'zkc', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc', 'clients', 'smeram', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'merchant', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'clients', 'smeram', 'merchant', 'index.html')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  const oldStorage = `        try {
          localStorage.setItem('zk_checkout_cod', String(codEnabled));
          localStorage.setItem('zk_show_shipping_field', String(showShipping));
          localStorage.setItem('zk_checkout_show_whatsapp_order', String(showWhatsapp));
          localStorage.setItem('zk_checkout_show_whatsapp', String(showWhatsapp));
        } catch(_) {}`;

  const newStorage = `        try {
          localStorage.setItem('zk_checkout_cod', String(codEnabled));
          localStorage.setItem('zk_show_shipping_field', String(showShipping));
          localStorage.setItem('zk_checkout_show_whatsapp_order', String(showWhatsapp));
          localStorage.setItem('zk_checkout_show_whatsapp', String(showWhatsapp));
          localStorage.setItem('zk_show_cart_popup', String(document.getElementById('coShowCartPopup').checked));
          localStorage.setItem('zk_show_payment_selector', String(document.getElementById('coShowPaymentSelector').checked));
          localStorage.setItem('zk_pay_button', JSON.stringify(readPayButton()));
        } catch(_) {}`;

  content = content.replace(oldStorage, newStorage);

  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Updated:', file);
}

