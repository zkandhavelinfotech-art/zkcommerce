with open('zkc/api/services/php/store_config.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_gst = """// GST
define('GST_ENABLED', false);
define('GST_RATE', 0);"""

new_gst = """// Billing Entity & GST details (Smeram Industries)
if (!defined('BILLING_NAME')) define('BILLING_NAME', 'Smeram Industries');
if (!defined('GSTIN')) define('GSTIN', '33DVRPR1801M1Z6');
if (!defined('GST_ENABLED')) define('GST_ENABLED', true);
if (!defined('GST_RATE')) define('GST_RATE', 5);"""

if old_gst in code:
    code = code.replace(old_gst, new_gst, 1)
    with open('zkc/api/services/php/store_config.php', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: store_config.php updated with Smeram Industries and GSTIN 33DVRPR1801M1Z6!")
else:
    print("ERROR: old_gst not found in store_config.php")

