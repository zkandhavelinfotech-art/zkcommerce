// Defaults keep promo code disabled by default until merchant enables it after adding coupon codes.
function checkoutSettings(themeConfig) {
  const c = (themeConfig && themeConfig.checkout) || {};
  const razorpay = c.razorpay !== false;
  // At least one payment method must stay available.
  const cod = c.cod !== false || !razorpay;
  const show_shipping_field = c.show_shipping_field !== false && c.show_shipping !== false;
  const show_whatsapp_order = c.show_whatsapp_order === true; // Disabled by default
  // "Added to cart · View Cart →" popup after add to cart. On by default for existing stores.
  const show_cart_popup = c.show_cart_popup !== false;
  // Payment method dropdown in the cart. When hidden, the preferred enabled method is sent automatically.
  const show_payment_selector = c.show_payment_selector !== false;
  return { show_coupon: c.show_coupon === true, cod, razorpay, show_shipping_field, show_whatsapp_order, show_cart_popup, show_payment_selector, pay_button: payButton(c.pay_button) };
}

const PAYMENT_LABELS = {
  cod: 'Cash on delivery',
  razorpay: 'Pay online via Razorpay (UPI, cards, netbanking)'
};

// Fonts the storefront can load for the checkout button ('' = inherit the theme font).
const PAY_BUTTON_FONTS = ['', 'Inter', 'Poppins', 'Roboto', 'Playfair Display', 'Dancing Script', 'Georgia', 'Arial'];
const hexColor = v => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? String(v) : '');
const numberIn = (v, min, max) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(min, Math.min(max, Math.round(Number(v)))));

// Checkout submit button ("Place order" / "Pay Now"): merchant-editable text and style. Empty values keep the theme look.
function payButton(b) {
  b = b && typeof b === 'object' ? b : {};
  const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Place order';
  return {
    text,
    bg_color: hexColor(b.bg_color),
    text_color: hexColor(b.text_color),
    font_family: PAY_BUTTON_FONTS.includes(b.font_family) ? b.font_family : '',
    font_size: numberIn(b.font_size, 12, 28),
    radius: numberIn(b.radius, 0, 40),
    bold: b.bold !== false
  };
}

function enabledPaymentMethods(settings) {
  return ['cod', 'razorpay'].filter(m => settings[m]);
}

// Method used when the shopper is not shown a choice: online payment first, else cash on delivery.
function preferredPaymentMethod(settings) {
  return settings.razorpay ? 'razorpay' : 'cod';
}

module.exports = { checkoutSettings, enabledPaymentMethods, preferredPaymentMethod, payButton, PAY_BUTTON_FONTS, PAYMENT_LABELS };
