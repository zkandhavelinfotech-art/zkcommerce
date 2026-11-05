with open('zkc/api/services/php/packaging_api.php', 'r', encoding='utf-8') as f:
    code = f.read().replace('\r\n', '\n')

old_dates = """        $today = date('Y-m-d');
        $from = zkcDateParam($_GET['from'] ?? '', $today);
        $to = zkcDateParam($_GET['to'] ?? '', $from);"""

new_dates = """        $today = date('Y-m-d');
        $last7 = date('Y-m-d', strtotime('-7 days'));
        $from = zkcDateParam($_GET['from'] ?? '', $last7);
        $to = zkcDateParam($_GET['to'] ?? '', $today);"""

if old_dates in code:
    code = code.replace(old_dates, new_dates, 1)
    with open('zkc/api/services/php/packaging_api.php', 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS: packaging_api.php updated to default last 7 days!")
else:
    print("ERROR: old_dates not found in packaging_api.php")

