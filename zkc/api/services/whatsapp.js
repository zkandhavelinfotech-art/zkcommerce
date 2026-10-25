// ─────────────────────────────────────────────────────────────
// ZKCommerce — WhatsApp Notification Engine
// Dispatches automated order & tracking notifications to Merchant & Customer
// Supports Gupshup, Meta WhatsApp Cloud API, Webhooks, and direct wa.me fallback
// ─────────────────────────────────────────────────────────────

function cleanPhoneNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  // If 10 digits (standard Indian mobile), prepend 91
  if (digits.length === 10) return '91' + digits;
  // If starts with 0 and 11 digits (e.g. 09876543210), strip 0 and prepend 91
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits;
}

function makeWhatsAppLink(phone, message) {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return null;
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
}

async function dispatchMessage({ to, message, context = 'notification' }) {
  const phone = cleanPhoneNumber(to);
  if (!phone) {
    return { success: false, reason: 'Invalid or missing phone number' };
  }

  const directUrl = makeWhatsAppLink(phone, message);
  let providerSent = false;
  let providerName = 'console_logger';

  // 1. Try Gupshup API if configured
  const gupshupKey = process.env.GUPSHUP_API_KEY;
  const gupshupSource = process.env.GUPSHUP_SOURCE_NUMBER;
  if (gupshupKey && gupshupSource && gupshupKey !== 'your_gupshup_key') {
    try {
      const response = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
        method: 'POST',
        headers: {
          'apikey': gupshupKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          channel: 'whatsapp',
          source: gupshupSource,
          destination: phone,
          message: JSON.stringify({ type: 'text', text: message }),
          'src.name': process.env.GUPSHUP_APP_NAME || 'ZKCommerce'
        })
      });
      if (response.ok) {
        providerSent = true;
        providerName = 'gupshup';
      }
    } catch (err) {
      console.warn('[WhatsApp] Gupshup dispatch failed:', err.message);
    }
  }

  // 2. Try Meta Cloud API if configured
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!providerSent && metaToken && metaPhoneId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { preview_url: true, body: message }
        })
      });
      if (response.ok) {
        providerSent = true;
        providerName = 'meta_cloud_api';
      }
    } catch (err) {
      console.warn('[WhatsApp] Meta Cloud dispatch failed:', err.message);
    }
  }

  // 3. Try Webhook if configured (Zapier, Make, n8n, etc.)
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message, context, timestamp: new Date().toISOString() })
      });
      if (!providerSent) {
        providerSent = true;
        providerName = 'webhook';
      }
    } catch (err) {
      console.warn('[WhatsApp] Webhook notification failed:', err.message);
    }
  }

  // Always log for transparency and local demo inspection
  console.log(`[WhatsApp Notification] 🚀 ${context.toUpperCase()} (${providerName}) to +${phone}:`);
  console.log(message);
  console.log(`[WhatsApp Link] 👉 ${directUrl}\n`);

  return {
    success: true,
    provider: providerName,
    providerSent,
    phone,
    directUrl
  };
}

async function sendOrderNotification({ order, store = {}, items = [], templates = null }) {
  const storeName = store.store_name || 'ZKCommerce Store';
  const orderNum = order.order_number || `#${order.id}`;
  const total = Number(order.total_amount || 0).toLocaleString('en-IN');
  const payMethod = order.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Paid Online (Razorpay)';

  let addressStr = 'Not provided';
  if (order.shipping_address) {
    const addr = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address || '{}') : order.shipping_address;
    addressStr = [addr.line1 || addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || 'Not specified';
  }

  const itemList = items && items.length ? items.map((x, i) => `${i + 1}. ${x.name || 'Item'} × ${x.quantity || 1} (₹${x.price})`).join('\n') : 'Items included in invoice';

  // 1. Message for Merchant
  // Merchant templates (order-messages.js) replace the built-in texts and choose the customer-care number.
  const tpl = templates && templates.enabled ? templates : null;
  const render = tpl ? require('./order-messages').render : null;
  const merchantPhone = (tpl && tpl.care_number) || store.whatsapp_number || store.phone || process.env.MERCHANT_ALERT_WHATSAPP;
  const merchantMessage = `🎉 *New Order Received — ${storeName}*
----------------------------------------
*Order Number:* ${orderNum}
*Customer:* ${order.customer_name || 'Guest'}
*Phone:* ${order.customer_phone || 'N/A'}
*Payment:* ${payMethod}
*Total Amount:* ₹${total}

*Order Items:*
${itemList}

*Delivery Address:*
${addressStr}
----------------------------------------
Log in to your Merchant Dashboard to fulfill this order and print the GST Tax Invoice.`;

  // 2. Message for Customer
  const customerPhone = order.customer_phone;
  const customerMessage = `🛍️ *Order Confirmed — ${storeName}*
----------------------------------------
Hello ${order.customer_name || 'Valued Customer'},

Thank you for your order! We have successfully received your request and our fulfillment team is preparing your package.

*Order ID:* ${orderNum}
*Total Amount:* ₹${total}
*Payment Method:* ${payMethod}
*Shipping To:* ${addressStr}

We will notify you on WhatsApp as soon as your parcel is handed over to our courier partner with live tracking details.

Need help? Reply directly to this chat or visit our store.`;

  const results = {};

  if (merchantPhone) {
    results.merchant = await dispatchMessage({
      to: merchantPhone,
      message: tpl ? render(tpl.care_template, { ...order, items }, store) : merchantMessage,
      context: 'merchant_new_order_alert'
    });
  }

  if (customerPhone) {
    results.customer = await dispatchMessage({
      to: customerPhone,
      message: tpl ? render(tpl.customer_template, { ...order, items }, store) : customerMessage,
      context: 'customer_order_confirmation'
    });
  }

  return results;
}

async function sendOrderTrackingNotification({ order, store = {} }) {
  const storeName = store.store_name || 'ZKCommerce Store';
  const orderNum = order.order_number || `#${order.id}`;
  const courier = order.courier || 'Our Courier Partner';
  const tracking = order.tracking_number || 'Tracking updated in system';

  const customerPhone = order.customer_phone;
  if (!customerPhone) return { success: false, reason: 'No customer phone' };

  const message = `🚚 *Your Order Has Shipped — ${storeName}*
----------------------------------------
Hello ${order.customer_name || 'Customer'},

Great news! Your order *${orderNum}* has been dispatched and is on its way to you.

*Courier Partner:* ${courier}
*Tracking / AWB Number:* ${tracking}
*Current Status:* In Transit

You can expect delivery within 3 to 5 business days. Thank you for shopping with ${storeName}!`;

  return await dispatchMessage({
    to: customerPhone,
    message,
    context: 'customer_shipment_tracking'
  });
}

async function sendTestNotification({ store = {}, targetPhone }) {
  const storeName = store.store_name || 'Smeram Naturals';
  const phone = targetPhone || store.whatsapp_number;
  if (!phone) throw new Error('No target WhatsApp phone number provided');

  const message = `🧪 *ZKCommerce WhatsApp Notification Test*
----------------------------------------
Store: *${storeName}*
Status: *Connected & Operational* ✅
Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Automated order alerts, payment confirmations, and courier tracking updates are configured to deliver to this WhatsApp channel.`;

  return await dispatchMessage({
    to: phone,
    message,
    context: 'whatsapp_diagnostic_test'
  });
}

module.exports = {
  cleanPhoneNumber,
  makeWhatsAppLink,
  sendOrderNotification,
  sendOrderTrackingNotification,
  sendTestNotification
};

