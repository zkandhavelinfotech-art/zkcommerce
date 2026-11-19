'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkoutSettings } = require('./checkout-settings');
const { renderStore } = require('../store-renderer');
const { customerOptedIn } = require('./wa-sender');

function renderCheckout(checkout) {
  return renderStore({
    store: { id: 2, slug: 'smeram', store_name: 'Smeram Naturals' },
    theme_config: { checkout },
    products: []
  });
}

test('both enabled payment methods always force a visible shopper choice', () => {
  const settings = checkoutSettings({ checkout: { cod: true, razorpay: true, show_payment_selector: false } });
  assert.equal(settings.show_payment_selector, true);

  const html = renderCheckout({ cod: true, razorpay: true, show_payment_selector: false, pay_button: { text: 'Pay Now' } });
  assert.match(html, /type="radio" name="payment_method" value="razorpay" checked/);
  assert.match(html, /type="radio" name="payment_method" value="cod"/);
  assert.match(html, /Choose payment method/);
  assert.match(html, /id="zkPayButton"[^>]*>Pay Now<\/button>/);
  assert.ok(html.indexOf('value="razorpay" checked') < html.indexOf('value="cod"'));
  assert.match(html, /\.zkc-payment-option\{display:grid!important;grid-template-columns:20px minmax\(0,1fr\)!important/);
  assert.match(html, /class="zkc-payment-copy"/);
});

test('online-only checkout submits Razorpay and renders the online action', () => {
  const html = renderCheckout({ cod: false, razorpay: true });
  assert.match(html, /type="hidden" name="payment_method" value="razorpay"/);
  assert.match(html, /id="zkPayButton"[^>]*>Pay Now<\/button>/);
  assert.match(html, /checkout\.razorpay\.com\/v1\/checkout\.js/);
});

test('COD-only checkout submits COD, confirms the order, and does not load Razorpay', () => {
  const html = renderCheckout({ cod: true, razorpay: false });
  assert.match(html, /type="hidden" name="payment_method" value="cod"/);
  assert.match(html, /id="zkPayButton"[^>]*>Confirm Order<\/button>/);
  assert.match(html, /Order Confirmed - Cash on Delivery/);
  assert.match(html, /Amount due on delivery/);
  assert.doesNotMatch(html, /checkout\.razorpay\.com\/v1\/checkout\.js/);
});

test('generated checkout JavaScript compiles', () => {
  const html = renderCheckout({ cod: true, razorpay: true });
  const scripts = html.split('<script>').slice(1).map(part => part.split('</script>')[0]);
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test('checkout renders responsive shipping validation and the built-in free-shipping rate', () => {
  const html = renderCheckout({ cod: true, razorpay: true, show_shipping_field: true });
  assert.match(html, /<form id="checkoutForm"[^>]*novalidate>/);
  assert.match(html, /class="zkc-address-grid"/);
  assert.match(html, /data-error-for="pincode"/);
  assert.match(html, /class="zkc-checkout-alert"[^>]*hidden/);
  assert.match(html, /@media\(max-width:520px\)/);
  assert.match(html, /name="shipping_rate_id"[^>]*value="inclusive_gst_free_shipping"/);
  assert.match(html, /select\.value==='inclusive_gst_free_shipping'/);
});

test('WhatsApp updates are optional, backend-driven, and never open a shopper tab', () => {
  const html = renderCheckout({ cod: true, razorpay: true });
  assert.match(html, /type="checkbox" name="whatsapp_opt_in" value="1"/);
  assert.match(html, /whatsapp_opt_in:whatsappOptIn/);
  assert.match(html, /send confirmation and delivery tracking automatically through our WhatsApp Business service/);
  assert.doesNotMatch(html, /confCustomerWaBtn|confMerchantWaBtn|whatsapp_handoff_url/);
  assert.doesNotMatch(html, /window\.open\(handoffUrl|https:\/\/wa\.me/);
});

test('customer WhatsApp notifications require recorded order consent', () => {
  assert.equal(customerOptedIn(null), false);
  assert.equal(customerOptedIn({ shipping_address: { whatsapp_opt_in: false } }), false);
  assert.equal(customerOptedIn({ shipping_address: { whatsapp_opt_in: true } }), true);
  assert.equal(customerOptedIn({ shipping_address: '{"whatsapp_opt_in":true}' }), true);
  assert.equal(customerOptedIn({ whatsapp_opt_in: 1 }), true);
});

test('legacy Smeram publish template cannot redirect checkout to WhatsApp', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../clients/smeram/index.html'), 'utf8');
  assert.match(html, /name="whatsapp_opt_in" value="1"/);
  assert.match(html, /const autoRedirectSetting = false/);
  assert.match(html, /whatsapp_opt_in: whatsappOptIn/);
  assert.doesNotMatch(html, /window\.open\(waUrl|window\.location\.href = waUrl/);
});

test('invoice downloads use the branded invoice template instead of the legacy API document', () => {
  const html = renderCheckout({ cod: true, razorpay: true });
  const phpApi = fs.readFileSync(path.join(__dirname, 'php/api.php'), 'utf8');
  const merchant = fs.readFileSync(path.join(__dirname, '../../merchant/index.html'), 'utf8');
  assert.match(html, /invoiceBackend \+ 'invoice\.php\?id=' \+ encodeURIComponent\(orderIdParam\) \+ '&download=1'/);
  assert.doesNotMatch(html, /id="confInvoiceLink"[^>]*\sdownload(?:\s|>)/);
  assert.match(phpApi, /Use the branded GST invoice template for every browser PDF request/);
  assert.match(merchant, /class="order-action-grid"/);
  assert.match(merchant, /data-label="Actions"/);
  assert.doesNotMatch(merchant, /href="\.\.\/api\.php\?route=invoices\/\$\{i\.id\}\/pdf/);
});

test('GoDaddy patch builder is reusable and no longer targets the fixed v1.0.15 folder', () => {
  const builder = fs.readFileSync(path.join(__dirname, '../../deployment/scripts/build-godaddy-patch.js'), 'utf8');
  const uploader = fs.readFileSync(path.join(__dirname, '../../deployment/scripts/ftp-publish-patch.js'), 'utf8');
  assert.match(builder, /smeram-patch-current/);
  assert.match(builder, /'invoice\.php'/);
  assert.match(uploader, /smeram-patch-current/);
  assert.doesNotMatch(uploader, /const patchDir = .*smeram-patch-today-v1\.0\.15/);
});

test('WhatsApp updates from viewcart are disabled by default in checkout settings', () => {
  const { checkoutSettings } = require('./checkout-settings');
  const defaults = checkoutSettings({});
  assert.equal(defaults.show_whatsapp_updates, false, 'WhatsApp updates must be false by default');
  
  const enabled = checkoutSettings({ checkout: { show_whatsapp_updates: true } });
  assert.equal(enabled.show_whatsapp_updates, true, 'WhatsApp updates must be true when merchant enables it');
});
