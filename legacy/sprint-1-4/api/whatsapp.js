/**
 * ZKCommerce WhatsApp Integration — Gupshup
 * Sprint 3: Order alerts, COD OTP, shipping updates
 */
'use strict';

const https = require('https');

const GUPSHUP_API = 'api.gupshup.io';
const API_KEY     = process.env.GUPSHUP_API_KEY;
const APP_NAME    = process.env.GUPSHUP_APP_NAME || 'ZKCommerce';
const FROM        = process.env.WHATSAPP_FROM;

async function sendWA(to, message) {
  if (!API_KEY) { console.log('[WA stub]', to, message.substring(0, 60)); return; }
  const phone = to.replace(/[^0-9]/g, '');
  const body  = new URLSearchParams({
    channel:  'whatsapp',
    source:   FROM,
    destination: phone,
    message:  JSON.stringify({ type: 'text', text: message }),
    'src.name': APP_NAME,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GUPSHUP_API,
      path:     '/sm/api/v1/msg',
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded', apikey: API_KEY },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const WA = {
  // Order placed — to customer
  async orderPlaced(phone, { orderNo, storeName, total, paymentMethod }) {
    return sendWA(phone,
      `✅ *Order Confirmed!*\n\n` +
      `Order: *${orderNo}*\n` +
      `Store: ${storeName}\n` +
      `Amount: *₹${total}*\n` +
      `Payment: ${paymentMethod.toUpperCase()}\n\n` +
      `We'll notify you when your order ships. 🚚`
    );
  },

  // Order shipped — to customer
  async orderShipped(phone, { orderNo, awb, courier, deliveryDate }) {
    return sendWA(phone,
      `📦 *Your order is shipped!*\n\n` +
      `Order: *${orderNo}*\n` +
      `Courier: ${courier}\n` +
      `AWB: *${awb}*\n` +
      `Expected delivery: *${deliveryDate}*\n\n` +
      `Track at: https://track.delhivery.com/p/#${awb}`
    );
  },

  // COD OTP verification
  async codOTP(phone, { orderNo, otp }) {
    return sendWA(phone,
      `🔐 *COD Order Verification*\n\n` +
      `Order: ${orderNo}\n` +
      `Your OTP: *${otp}*\n\n` +
      `Share this OTP with the delivery agent to accept your order.\n` +
      `Valid for 10 minutes. Do NOT share with anyone else.`
    );
  },

  // New order alert — to merchant
  async newOrderMerchant(phone, { orderNo, customerName, total, items }) {
    return sendWA(phone,
      `🛒 *New Order Received!*\n\n` +
      `Order: *${orderNo}*\n` +
      `Customer: ${customerName}\n` +
      `Items: ${items}\n` +
      `Amount: *₹${total}*\n\n` +
      `Login to dispatch: https://app.zkcommerce.in/merchant/orders.html`
    );
  },

  // Abandoned cart recovery — v5 feature
  async abandonedCart(phone, { storeName, productName, cartValue, discountCode }) {
    return sendWA(phone,
      `🛍️ *You left something behind!*\n\n` +
      `Hi! You left *${productName}* in your cart at ${storeName}.\n\n` +
      `Use code *${discountCode}* for 10% off — valid 24 hours only!\n\n` +
      `Complete your purchase: https://zkcommerce.in`
    );
  },

  // Low stock alert — to merchant
  async lowStock(phone, { productName, stock, storeName }) {
    return sendWA(phone,
      `⚠️ *Low Stock Alert*\n\n` +
      `Product: *${productName}*\n` +
      `Remaining stock: *${stock} units*\n\n` +
      `Update inventory: https://app.zkcommerce.in/merchant/inventory.html`
    );
  },
};

module.exports = WA;
