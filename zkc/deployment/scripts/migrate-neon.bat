@echo off
REM ZKCommerce v4.1 - Neon Migration (Windows, no psql needed)
REM Usage: deployment\scripts\migrate-neon.bat "postgresql://..."
REM Or set DATABASE_URL in .env and just double-click this file

echo.
echo ============================================
echo  ZKCommerce v4.1 - Neon Database Migration
echo  No psql required - pure Node.js
echo ============================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found.
  echo Go to https://nodejs.org and install version 20 LTS
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

REM Install packages if needed
if not exist node_modules (
  echo [INFO] Installing npm packages...
  npm install
)
echo [OK] packages ready
echo.

REM Run migration
if "%1"=="" (
  echo [INFO] Using DATABASE_URL from .env file
  node deployment\scripts\neon-migrate.js
) else (
  echo [INFO] Using URL from command line argument
  node deployment\scripts\neon-migrate.js %1
)

if %errorlevel% equ 0 (
  echo.
  echo ============================================
  echo  SUCCESS - Database is ready!
  echo ============================================
  echo.
  echo Login credentials (password: demo1234):
  echo   Admin:    admin@zkcommerce.in
  echo   Merchant: merchant@zkcommerce.in
  echo   Customer: customer@zkcommerce.in
  echo.
  echo Next: npm run dev
) else (
  echo.
  echo [ERROR] Migration failed. See errors above.
)
echo.
pause
