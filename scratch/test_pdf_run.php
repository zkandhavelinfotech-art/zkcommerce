<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['route'] = 'invoices/2/pdf';

// Run api.php
require __DIR__ . '/../zkc/api/services/php/api.php';

