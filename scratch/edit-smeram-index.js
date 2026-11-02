const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'zkc', 'clients', 'smeram', 'index.html'),
  path.join(__dirname, '..', 'zkc-build', 'clients', 'smeram', 'index.html')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  // 1. Update triggerActionBanner to respect show_cart_popup
  const oldTrigger = `function triggerActionBanner(productName, price, qty) {
  const b = document.getElementById('cartActionBanner');
  if (!b) return;`;

  const newTrigger = `function triggerActionBanner(productName, price, qty) {
  const showPopup = window.zkShowCartPopup !== undefined ? window.zkShowCartPopup : (localStorage.getItem('zk_show_cart_popup') !== 'false');
  if (!showPopup) return;
  const b = document.getElementById('cartActionBanner');
  if (!b) return;`;

  content = content.replace(oldTrigger, newTrigger);

  // 2. In syncCheckoutSettings: add fallback endpoints and support show_cart_popup, show_payment_selector, pay_button
  const oldSync = `  // Try to load from published storefront endpoint
  try {
    const res = await fetch('/api/storefront/smeram');
    if (res.ok) {
      const data = await res.json();
      if (data.theme_config && data.theme_config.checkout) {
        checkout = { ...checkout, ...data.theme_config.checkout };
      }
      if (data.theme_config && data.theme_config.announcement_enabled !== undefined) {
        localStorage.setItem('zk_announcement_enabled', String(data.theme_config.announcement_enabled));
        checkAnnouncementVisibility();
      }
    }
  } catch (_) {}`;

  const newSync = `  // Try to load from published storefront endpoint (Node or PHP fallback)
  try {
    const endpoints = ['/api/storefront/smeram', 'api.php?route=storefront/smeram', '../../api.php?route=storefront/smeram'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok) {
          const data = await res.json();
          if (data.theme_config && data.theme_config.checkout) {
            checkout = { ...checkout, ...data.theme_config.checkout };
          }
          if (data.theme_config && data.theme_config.announcement_enabled !== undefined) {
            localStorage.setItem('zk_announcement_enabled', String(data.theme_config.announcement_enabled));
            checkAnnouncementVisibility();
          }
          break;
        }
      } catch (_) {}
    }
  } catch (_) {}`;

  content = content.replace(oldSync, newSync);

  // 3. Add handlers for show_cart_popup, show_payment_selector, and pay_button inside syncCheckoutSettings
  const targetEndOfSync = `  // Apply COD visibility to payment method dropdown
  const paySelect = document.getElementById('payMethodSelect');
  if (paySelect) {
    const codOption = paySelect.querySelector('option[value="cod"]');
    const rzpOption = paySelect.querySelector('option[value="razorpay"]');
    if (codOption) {
      if (checkout.cod === false) {
        codOption.disabled = true;
        codOption.hidden = true;
        codOption.style.display = 'none';
        if (rzpOption) {
          rzpOption.selected = true;
          paySelect.value = 'razorpay';
        }
      } else {
        codOption.disabled = false;
        codOption.hidden = false;
        codOption.style.display = '';
      }
    }
  }`;

  const replacementEndOfSync = `  // 1. Show "View Cart" popup after Add to cart setting
  const showCartPopup = checkout.show_cart_popup !== undefined ? checkout.show_cart_popup !== false : (localStorage.getItem('zk_show_cart_popup') !== 'false');
  window.zkShowCartPopup = showCartPopup;

  // 2. Apply COD visibility & show_payment_selector to payment method dropdown
  const paySelect = document.getElementById('payMethodSelect');
  if (paySelect) {
    const codOption = paySelect.querySelector('option[value="cod"]');
    const rzpOption = paySelect.querySelector('option[value="razorpay"]');
    if (codOption) {
      if (checkout.cod === false) {
        codOption.disabled = true;
        codOption.hidden = true;
        codOption.style.display = 'none';
        if (rzpOption) {
          rzpOption.selected = true;
          paySelect.value = 'razorpay';
        }
      } else {
        codOption.disabled = false;
        codOption.hidden = false;
        codOption.style.display = '';
      }
    }
    // Show payment method choice in cart toggle
    const showPaymentChoice = checkout.show_payment_selector !== undefined ? checkout.show_payment_selector !== false : (localStorage.getItem('zk_show_payment_selector') !== 'false');
    const payTitle = paySelect.previousElementSibling;
    if (!showPaymentChoice) {
      paySelect.style.display = 'none';
      if (payTitle && payTitle.textContent && payTitle.textContent.toLowerCase().includes('payment')) {
        payTitle.style.display = 'none';
      }
      paySelect.value = (checkout.razorpay !== false) ? 'razorpay' : 'cod';
    } else {
      paySelect.style.display = '';
      if (payTitle && payTitle.textContent && payTitle.textContent.toLowerCase().includes('payment')) {
        payTitle.style.display = '';
      }
    }
  }

  // 3. Checkout button text & styling (Merchant portal -> Checkout & Payments)
  const pb = checkout.pay_button || (function() {
    try { return JSON.parse(localStorage.getItem('zk_pay_button') || 'null'); } catch(_) { return null; }
  })();
  const placeBtn = document.getElementById('placeOrderBtn');
  if (placeBtn && pb) {
    if (pb.text && pb.text.trim()) placeBtn.textContent = pb.text.trim();
    if (pb.font_family) placeBtn.style.fontFamily = \`'\${pb.font_family}', sans-serif\`;
    if (pb.font_size) placeBtn.style.fontSize = pb.font_size + 'px';
    if (pb.radius != null && pb.radius !== '') placeBtn.style.borderRadius = pb.radius + 'px';
    if (pb.bold !== undefined) placeBtn.style.fontWeight = pb.bold ? '800' : '600';
    if (pb.bg_color) placeBtn.style.backgroundColor = pb.bg_color;
    if (pb.text_color) placeBtn.style.color = pb.text_color;
  }`;

  content = content.replace(targetEndOfSync, replacementEndOfSync);

  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Updated:', file);
}

