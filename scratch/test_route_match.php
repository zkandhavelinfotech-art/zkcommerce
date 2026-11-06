<?php
function testMatch($route, $method) {
    if (($route === 'admin/packaging' || $route === 'orders/packaging') && $method === 'GET') {
        return "MATCH: packaging";
    }
    if (($route === 'admin/mark-packed' || $route === 'orders/packaging/mark-packed') && $method === 'POST') {
        return "MATCH: mark-packed";
    }
    if (($route === 'admin/shipments' || $route === 'shipments/orders') && $method === 'GET') {
        return "MATCH: shipments";
    }
    if (($route === 'admin/awb' || preg_match('#^shipments/orders/(\d+)/awb#', $route)) && $method === 'PUT') {
        return "MATCH: awb";
    }
    return "404 NOT FOUND: $route";
}

echo testMatch('orders/packaging', 'GET') . "\n";
echo testMatch('orders/packaging/mark-packed', 'POST') . "\n";
echo testMatch('shipments/orders', 'GET') . "\n";
echo testMatch('shipments/orders/42/awb', 'PUT') . "\n";
echo testMatch('admin/packaging', 'GET') . "\n";
