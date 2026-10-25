// ─────────────────────────────────────────────────────────────
// ZKCommerce — Default Standard eCommerce Pages Scaffolder
// Auto-generates standard statutory & company pages for stores
// ─────────────────────────────────────────────────────────────
const pool = require('../db');

function getStandardTemplates(storeInfo = {}) {
  const storeName = storeInfo.store_name || 'Our Store';
  const email = storeInfo.email || storeInfo.merchant_email || 'support@zkcommerce.in';
  const phone = storeInfo.whatsapp_number || storeInfo.phone || storeInfo.merchant_phone || '+91 75399 72026';
  const address = [storeInfo.address, storeInfo.city, storeInfo.state].filter(Boolean).join(', ') || 'India';

  return [
    {
      title: 'About Us',
      slug: 'about-us',
      sort_order: 1,
      status: 'published',
      content: {
        body: `Welcome to ${storeName}.\n\nWe are committed to delivering the highest quality products crafted with pure integrity, authentic care, and verified standards. Founded on the principles of consumer trust and transparency, our mission is to make natural, effective, and dependable products accessible directly to your doorstep.\n\nEvery formulation and item in our catalog is carefully curated, tested, and inspected to ensure uncompromised quality. We partner directly with ethical producers and master craftsmen to guarantee authenticity in every single package.\n\nThank you for choosing ${storeName}. We are proud to be part of your daily routine and wellness journey.`
      }
    },
    {
      title: 'Contact Us',
      slug: 'contact-us',
      sort_order: 2,
      status: 'published',
      content: {
        body: `We are here to help you. If you have questions about our products, need assistance with your order, or want to discuss a bulk purchase, please reach out to our team.\n\nStore: ${storeName}\nCustomer Support Email: ${email}\nPhone / WhatsApp: ${phone}\nOperating Address: ${address}\n\nCustomer Support Hours:\nMonday to Saturday: 9:00 AM – 6:00 PM IST\nClosed on Sundays and National Holidays.\n\nWe respond to all inquiries within 24 business hours.`
      }
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      sort_order: 3,
      status: 'published',
      content: {
        body: `At ${storeName}, we respect your personal privacy and are dedicated to protecting any personal information you share with us.\n\nInformation We Collect:\nWhen you browse our catalog, make a purchase, or contact our support team, we may collect your name, shipping address, billing address, phone number, email address, and payment method details.\n\nHow We Use Your Information:\n1. To process, fulfill, and deliver your orders accurately.\n2. To communicate order confirmations, tracking details, and shipment updates via WhatsApp, SMS, or email.\n3. To improve our customer service, catalog offerings, and store browsing experience.\n4. To comply with statutory tax (GST) and accounting requirements under Indian law.\n\nData Security:\nWe do not store complete debit/credit card numbers or CVVs on our servers. All online payment transactions are processed securely through RBI-compliant, PCI-DSS certified payment gateways such as Razorpay. We do not sell, rent, or trade your personal data with third-party marketers.`
      }
    },
    {
      title: 'Terms of Service',
      slug: 'terms-of-service',
      sort_order: 4,
      status: 'published',
      content: {
        body: `By browsing, accessing, or placing an order on ${storeName}, you agree to be bound by the following terms and conditions:\n\n1. Product Information & Pricing:\nAll product descriptions, specifications, and prices displayed on our website are subject to availability and may be revised without prior notice. In the event of a technical pricing error, we reserve the right to cancel affected orders and issue a full refund.\n\n2. Order Acceptance:\nPlacing an item in your shopping cart does not reserve the price or inventory until checkout is completed. We reserve the right to refuse or cancel any order for reasons including suspected fraudulent activity, unauthorized payment attempts, or non-serviceable postal pincodes.\n\n3. Intellectual Property:\nAll trademarks, brand logos, product descriptions, imagery, and design elements featured on this store are the exclusive property of ${storeName} or its licensors and may not be reproduced without written consent.\n\n4. Governing Law:\nThese terms shall be governed by and construed in accordance with the laws of India, and any disputes shall be subject to the exclusive jurisdiction of the competent courts in ${storeInfo.city || storeInfo.state || 'Chennai, Tamil Nadu'}.`
      }
    },
    {
      title: 'Refund & Cancellation Policy',
      slug: 'refund-policy',
      sort_order: 5,
      status: 'published',
      content: {
        body: `We take immense pride in the quality of every product dispatched from ${storeName}. Your satisfaction is our top priority.\n\nDamaged, Defective, or Incorrect Items:\nIf your parcel arrives damaged, leaking, broken, or with missing items, please notify our team within 48 hours of delivery by sending photos or unboxing video footage to ${email} or via WhatsApp at ${phone}.\n\nOnce verified, we will arrange a free replacement or initiate a full refund to your original payment method.\n\nOrder Cancellation:\nYou may cancel an order free of charge before it has been dispatched from our fulfillment facility. Once an order is in transit or out for delivery, cancellations are not permitted.\n\nRefund Timelines:\nApproved refunds are credited to the original payment source (UPI, Card, Net Banking) within 5 to 7 working days, subject to your issuing bank's clearing timelines. For COD orders, approved refunds are transferred via direct UPI or NEFT bank transfer upon receiving your verified bank account details.`
      }
    },
    {
      title: 'Shipping & Delivery Policy',
      slug: 'shipping-policy',
      sort_order: 6,
      status: 'published',
      content: {
        body: `At ${storeName}, we are committed to prompt and reliable delivery across all serviceable pincodes in India.\n\nProcessing Time:\nAll verified orders are processed, packed, and handed over to our courier partners within 24 to 48 business hours of confirmation.\n\nDelivery Timeframe:\n- Metro Cities: Estimated delivery in 2 to 4 business days.\n- Rest of India: Estimated delivery in 3 to 6 business days.\n- Remote and Northeast regions: Estimated delivery in 5 to 8 business days.\n\nShipping Charges:\nShipping fees (if applicable) are calculated and clearly shown at checkout before you make payment. Orders qualifying for our promotional Free Shipping threshold will automatically receive free delivery.\n\nLive Tracking:\nAs soon as your package is dispatched, we send an automated notification containing your courier partner name (e.g. Delhivery, BlueDart, ST Courier) and live tracking number to your registered WhatsApp number and email.`
      }
    }
  ];
}

async function scaffoldDefaultPages(storeId, storeInfo = {}) {
  const templates = getStandardTemplates(storeInfo);
  const created = [];

  for (const page of templates) {
    const { rows } = await pool.query(
      `INSERT INTO store_pages (store_id, title, slug, content, status, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (store_id, slug) DO NOTHING
       RETURNING *`,
      [storeId, page.title, page.slug, JSON.stringify(page.content), page.status, page.sort_order]
    );
    if (rows.length) created.push(rows[0]);
  }

  return created;
}

module.exports = {
  getStandardTemplates,
  scaffoldDefaultPages
};

