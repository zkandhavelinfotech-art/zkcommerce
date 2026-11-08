import shutil, os

mamp_root = r"c:\MAMP\htdocs\live\smeram-naturals\smeram-frontend-v1.0.1"

files_to_sync = [
    ('zkc/api/services/php/api.php', os.path.join(mamp_root, 'api/services/php/api.php')),
    ('zkc/api/services/php/api.php', os.path.join(mamp_root, 'api.php')),
    ('zkc/merchant/index.html', os.path.join(mamp_root, 'merchant/index.html')),
    ('zkc/store-builder/index.html', os.path.join(mamp_root, 'store-builder/index.html')),
    ('zkc/update-password.php', os.path.join(mamp_root, 'update-password.php')),
    ('zkc/database/migration-mysql.sql', os.path.join(mamp_root, 'database/migration-mysql.sql')),
    ('zkc/database/migration-postgres.sql', os.path.join(mamp_root, 'database/migration-postgres.sql')),
    ('zkc/database/schema-mysql.sql', os.path.join(mamp_root, 'database/schema-mysql.sql')),
    ('zkc/database/schema-postgres.sql', os.path.join(mamp_root, 'database/schema-postgres.sql')),
    ('zkc/database/smeram_full_reset_and_seed.sql', os.path.join(mamp_root, 'database/smeram_full_reset_and_seed.sql')),
    ('zkc/database/smeram_full_reset_and_seed_postgres.sql', os.path.join(mamp_root, 'database/smeram_full_reset_and_seed_postgres.sql')),
    ('zkc/database/update-smeram-password.sql', os.path.join(mamp_root, 'database/update-smeram-password.sql')),
    ('zkc/database/migration-mysql.sql', os.path.join(mamp_root, 'api/services/php/database/migration-mysql.sql')),
    ('zkc/database/migration-postgres.sql', os.path.join(mamp_root, 'api/services/php/database/migration-postgres.sql')),
    ('zkc/database/schema-mysql.sql', os.path.join(mamp_root, 'api/services/php/database/schema-mysql.sql')),
    ('zkc/database/schema-postgres.sql', os.path.join(mamp_root, 'api/services/php/database/schema-postgres.sql')),
    ('zkc/database/smeram_full_reset_and_seed.sql', os.path.join(mamp_root, 'api/services/php/database/smeram_full_reset_and_seed.sql')),
    ('zkc/database/smeram_full_reset_and_seed_postgres.sql', os.path.join(mamp_root, 'api/services/php/database/smeram_full_reset_and_seed_postgres.sql')),
    ('zkc/database/update-smeram-password.sql', os.path.join(mamp_root, 'api/services/php/database/update-smeram-password.sql')),
]

for src, dst in files_to_sync:
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        print(f"Copied {src} -> {dst}")

print("MAMP sync complete!")
