<?php
// Smeram Naturals — WhatsApp sender configuration.
if (!defined('WA_PROVIDER')) define('WA_PROVIDER', 'none');
if (!defined('ZKWA_BASE_URL')) define('ZKWA_BASE_URL', '');
if (!defined('ZKWA_API_KEY')) define('ZKWA_API_KEY', '');
if (!defined('ZKWA_PHONE_NUMBER_ID')) define('ZKWA_PHONE_NUMBER_ID', '');
if (!defined('GUPSHUP_APP_NAME')) define('GUPSHUP_APP_NAME', '');
if (!defined('GUPSHUP_SOURCE_NUMBER')) define('GUPSHUP_SOURCE_NUMBER', '');
if (!defined('GUPSHUP_API_KEY')) define('GUPSHUP_API_KEY', '');
// Approved Meta templates per message type ({name, language, variables: "{a}|{b}"}) and which types send automatically.
if (!defined('WA_TEMPLATES')) define('WA_TEMPLATES', '{"order_confirmation":{"name":"","language":"en","variables":""},"care_alert":{"name":"","language":"en","variables":""},"low_stock":{"name":"","language":"en","variables":""},"order_shipped":{"name":"","language":"en","variables":""},"order_delivered":{"name":"","language":"en","variables":""}}');
if (!defined('WA_AUTO')) define('WA_AUTO', '{"order_confirmation":true,"care_alert":true,"low_stock":true,"order_shipped":true,"order_delivered":true}');
