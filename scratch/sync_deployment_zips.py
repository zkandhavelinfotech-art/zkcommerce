import shutil, os, zipfile

files_to_sync = [
    ('zkc/api/services/php/api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/api.php'),
    ('zkc/api/services/php/api.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api.php'),
    ('zkc/api/services/php/invoice.php', 'zkc/deployment/smeram-patch-today-v1.0.15/api/services/php/invoice.php'),
    ('zkc/api/services/php/invoice.php', 'zkc/deployment/smeram-patch-today-v1.0.15/invoice.php'),
    ('zkc/invoice.php', 'zkc/deployment/smeram-patch-today-v1.0.15/invoice.php'),
    ('zkc/merchant/products.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/products.html'),
    ('zkc/merchant/index.html', 'zkc/deployment/smeram-patch-today-v1.0.15/merchant/index.html'),
    ('zkc/store-builder/index.html', 'zkc/deployment/smeram-patch-today-v1.0.15/store-builder/index.html')
]

for src, dst in files_to_sync:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    print(f"Copied {src} -> {dst}")

# Rebuild smeram-patch-today-v1.0.15.zip
patch_dir = 'zkc/deployment/smeram-patch-today-v1.0.15'
patch_zip = 'zkc/deployment/smeram-patch-today-v1.0.15.zip'

with zipfile.ZipFile(patch_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(patch_dir):
        for f in files:
            full = os.path.join(root, f)
            arcname = os.path.relpath(full, patch_dir).replace('\\', '/')
            z.write(full, arcname)

print(f"Rebuilt {patch_zip}, size: {os.path.getsize(patch_zip)} bytes")

# Also copy into smeram-godaddy-deploy-v1.0.14 directory and rebuild full deploy zip
deploy_dir = 'zkc/deployment/smeram-godaddy-deploy-v1.0.14'
if os.path.exists(deploy_dir):
    for root, dirs, files in os.walk(patch_dir):
        for f in files:
            src_f = os.path.join(root, f)
            rel = os.path.relpath(src_f, patch_dir)
            dst_f = os.path.join(deploy_dir, rel)
            os.makedirs(os.path.dirname(dst_f), exist_ok=True)
            shutil.copy2(src_f, dst_f)

    deploy_zip = 'zkc/deployment/smeram-godaddy-deploy-v1.0.14.zip'
    with zipfile.ZipFile(deploy_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(deploy_dir):
            for f in files:
                full = os.path.join(root, f)
                arcname = os.path.relpath(full, deploy_dir).replace('\\', '/')
                z.write(full, arcname)
    print(f"Rebuilt {deploy_zip}, size: {os.path.getsize(deploy_zip)} bytes")
