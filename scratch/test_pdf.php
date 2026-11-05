<?php
// Test zkcMakePdf from api.php
$lines = [
    'TAX INVOICE - Smeram Naturals',
    'Invoice Number: ZK-2-101    Date: 05 Nov 2026',
    'Order ID: #101',
    '--------------------------------------------------------------------------------',
    'BILL TO / SHIP TO:',
    'Name: Senthil Kumar',
    'Phone: +91 9876543210 | Email: senthil@example.com',
    'Address: 12 Bazaar Street, Madurai, Tamil Nadu 625001',
    '--------------------------------------------------------------------------------',
    'ITEMS ORDERED:',
    '1. Pure Herbal Hair Oil (200ml)  x1 @ INR 450.00 = INR 450.00',
    '--------------------------------------------------------------------------------',
    'TOTAL AMOUNT: INR 450.00',
    'Payment Mode: ONLINE (PAID) [Ref: pay_test123]'
];

function zkcMakePdf($lines) {
    $clean = function($s) {
        $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', (string)$s);
        $s = preg_replace('/[^\x20-\x7E]/', ' ', $s);
        $s = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $s);
        return substr($s, 0, 105);
    };
    $expanded = [];
    foreach ($lines as $line) {
        $text = (string)$line;
        if (strlen($text) <= 88) {
            $expanded[] = $text;
        } else {
            $chunks = str_split($text, 88);
            foreach ($chunks as $chk) $expanded[] = $chk;
        }
    }
    $pages = array_chunk($expanded, 42);
    if (empty($pages)) $pages = [['Invoice']];
    
    $objects = [
        1 => '<< /Type /Catalog /Pages 2 0 R >>',
        2 => '',
        3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    $pageRefs = [];
    $objIdx = 4;
    foreach ($pages as $index => $page) {
        $pageId = $objIdx;
        $contentId = $objIdx + 1;
        $objIdx += 2;
        $pageRefs[] = "{$pageId} 0 R";
        
        $streamLines = [];
        foreach ($page as $i => $line) {
            $fontSize = ($index === 0 && $i === 0) ? 15 : 10;
            $y = 790 - ($i * 17);
            $cleanText = $clean($line);
            $streamLines[] = "BT /F1 {$fontSize} Tf 48 {$y} Td ({$cleanText}) Tj ET";
        }
        $stream = implode("\n", $streamLines);
        $streamLen = strlen($stream);
        
        $objects[$pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {$contentId} 0 R >>";
        $objects[$contentId] = "<< /Length {$streamLen} >>\nstream\n{$stream}\nendstream";
    }
    $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $pageRefs) . '] /Count ' . count($pages) . ' >>';
    
    $out = "%PDF-1.4\n";
    $offsets = [0];
    ksort($objects);
    foreach ($objects as $id => $obj) {
        $offsets[$id] = strlen($out);
        $out .= "{$id} 0 obj\n{$obj}\nendobj\n";
    }
    $xref = strlen($out);
    $totalObjs = count($objects) + 1;
    $out .= "xref\n0 {$totalObjs}\n0000000000 65535 f \n";
    for ($i = 1; $i < $totalObjs; $i++) {
        $out .= sprintf("%010d 00000 n \n", $offsets[$i] ?? 0);
    }
    $out .= "trailer\n<< /Size {$totalObjs} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    return $out;
}

$pdf = zkcMakePdf($lines);
file_put_contents(__DIR__ . '/test_invoice.pdf', $pdf);
echo "PDF generated successfully!\n";
echo "Bytes: " . strlen($pdf) . "\n";
echo "Header: " . substr($pdf, 0, 15) . "\n";

