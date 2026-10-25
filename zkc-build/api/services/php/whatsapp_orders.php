<?php
/**
 * WhatsApp order messages for the PHP + MySQL package (no WhatsApp Business API needed).
 * Copied as-is into every PHP deployment; settings come from store_config.php (WA_* constants).
 * Field names must match api/services/order-messages.js PLACEHOLDERS (the exporter checks this).
 */

// Order dates and the packaging date filter are Indian Standard Time.
date_default_timezone_set('Asia/Kolkata');

function zkcMoney($n) {
    $n = round((float)$n, 2);
    $int = (string)(int)floor($n);
    $dec = $n - floor($n);
    $last3 = substr($int, -3);
    $rest = substr($int, 0, -3);
    if ($rest !== '' && $rest !== false) $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest) . ',';
    return '₹' . ($rest ?: '') . $last3 . ($dec > 0 ? substr(number_format($dec, 2), 1) : '');
}

function zkcOrderItems($o) {
    if (isset($o['items']) && is_array($o['items'])) return $o['items'];
    $items = json_decode((string)($o['items_json'] ?? '[]'), true);
    return is_array($items) ? $items : [];
}

function zkcOrderFields($o) {
    $items = zkcOrderItems($o);
    $lines = [];
    $qty = 0;
    foreach ($items as $i => $x) {
        $q = (int)($x['quantity'] ?? 1);
        $qty += $q;
        $size = $x['size'] ?? ($x['product_size'] ?? '');
        $lines[] = ($i + 1) . '. ' . ($x['name'] ?? 'Item') . ($size ? ' (' . $size . ')' : '') . ' × ' . $q . ' — ' . zkcMoney(((float)($x['price'] ?? 0)) * $q);
    }
    $ts = strtotime((string)($o['created_at'] ?? 'now')) ?: time();
    return [
        'order_id'        => (string)($o['order_number'] ?? ('#' . ($o['id'] ?? ''))),
        'customer_name'   => (string)($o['customer_name'] ?? ''),
        'customer_phone'  => (string)($o['customer_phone'] ?? ''),
        'customer_email'  => (string)($o['customer_email'] ?? ''),
        'products'        => implode("\n", $lines),
        'product_names'   => implode(', ', array_filter(array_map(function ($x) { return $x['name'] ?? ''; }, $items))),
        'item_count'      => (string)$qty,
        'total'           => zkcMoney($o['total_amount'] ?? 0),
        'payment_method'  => (($o['payment_method'] ?? '') === 'cod') ? 'Cash on delivery' : 'Paid online (Razorpay)',
        'payment_status'  => (string)($o['payment_status'] ?? ''),
        'address'         => implode(', ', array_filter([$o['shipping_address'] ?? '', $o['city'] ?? '', $o['state'] ?? '', $o['pincode'] ?? ''])),
        'city'            => (string)($o['city'] ?? ''),
        'pincode'         => (string)($o['pincode'] ?? ''),
        'order_date'      => date('d M Y', $ts),
        'order_time'      => date('h:i a', $ts),
        'tracking_number' => (string)($o['tracking_number'] ?? ''),
        'store_name'      => defined('STORE_NAME') ? STORE_NAME : '',
    ];
}

function zkcRenderOrderMessage($template, $o) {
    $f = zkcOrderFields($o);
    return preg_replace_callback('/\{([a-z_]+)\}/', function ($m) use ($f) {
        return array_key_exists($m[1], $f) ? $f[$m[1]] : $m[0];
    }, (string)$template);
}

function zkcWhatsAppLink($phone, $text) {
    $d = preg_replace('/\D/', '', (string)$phone);
    if (strlen($d) === 10) $d = '91' . $d;
    elseif (strlen($d) === 11 && $d[0] === '0') $d = '91' . substr($d, 1);
    return strlen($d) >= 10 ? 'https://wa.me/' . $d . '?text=' . rawurlencode($text) : null;
}

/** ['care_url' => hand-off to customer care, 'customer_url' => message to the customer] */
function zkcOrderWhatsAppLinks($o) {
    if (!defined('WA_ENABLED') || !WA_ENABLED) return ['care_url' => null, 'customer_url' => null];
    return [
        'care_url'     => zkcWhatsAppLink(WA_CARE_NUMBER, zkcRenderOrderMessage(WA_CARE_TEMPLATE, $o)),
        'customer_url' => zkcWhatsAppLink($o['customer_phone'] ?? '', zkcRenderOrderMessage(WA_CUSTOMER_TEMPLATE, $o)),
    ];
}

/** Link the shopper's browser opens right after checkout / payment (null when hand-off is off). */
function zkcHandoffUrl($o) {
    if (!defined('WA_HANDOFF') || !WA_HANDOFF) return null;
    return zkcOrderWhatsAppLinks($o)['care_url'];
}
