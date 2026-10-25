// Merchant-controlled cart & checkout options, stored in theme_config.checkout and published with the snapshot.
// Defaults keep the original behaviour (discount box shown, COD + Razorpay offered).
function checkoutSettings(themeConfig) {
  const c = (themeConfig && themeConfig.checkout) || {};
  const razorpay = c.razorpay !== false;
  // At least one payment method must stay available.
  const cod = c.cod !== false || !razorpay;
  return { show_coupon: c.show_coupon !== false, cod, razorpay };
}

const PAYMENT_LABELS = {
  cod: 'Cash on delivery',
  razorpay: 'Pay online via Razorpay (UPI, cards, netbanking)'
};

function enabledPaymentMethods(settings) {
  return ['cod', 'razorpay'].filter(m => settings[m]);
}

module.exports = { checkoutSettings, enabledPaymentMethods, PAYMENT_LABELS };
