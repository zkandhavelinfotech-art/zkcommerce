import subprocess

cmd = [
    r"C:\MAMP\bin\php\php8.2.14\php.exe",
    "-r",
    """
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_GET['route'] = 'products';
    require 'zkc/api/services/php/api.php';
    """
]

res = subprocess.run(cmd, capture_output=True, text=True, errors='ignore')
print("Status:", res.returncode)
print("Output:", res.stdout[:800])
if res.stderr:
    print("Stderr:", res.stderr)

