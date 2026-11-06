<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['route'] = 'orders/packaging';
$_GET['from'] = '2026-10-30';
$_GET['to'] = '2026-11-06';
$_GET['stage'] = 'ready';
$_GET['store_id'] = '2';

require __DIR__ . '/../zkc/api/services/php/api.php';

