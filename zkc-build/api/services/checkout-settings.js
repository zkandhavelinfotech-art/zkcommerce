// Defaults keep promo code disabled by default until merchant enables it after adding coupon codes.
function checkoutSettings(themeConfig) {
  const c = (themeConfig && themeConfig.checkout) || {};
  const razorpay = c.razorpay !== false;
  // At least one payment method must stay available.
  const cod = c.cod !== false || !razorpay;
  const show_shipping_field = c.show_shipping_field !== false && c.show_shipping !== false;
  const show_whatsapp_order = c.show_whatsapp_order === true; // Disabled by default
  return { show_coupon: c.show_coupon === true, cod, razorpay, show_shipping_field, show_whatsapp_order };
}

const PAYMENT_LABELS = {
  cod: 'Cash on delivery',
  razorpay: 'Pay online via Razorpay (UPI, cards, netbanking)'
};

function enabledPaymentMethods(settings) {
  return ['cod', 'razorpay'].filter(m => settings[m]);
}

module.exports = { checkoutSettings, enabledPaymentMethods, PAYMENT_LABELS };
