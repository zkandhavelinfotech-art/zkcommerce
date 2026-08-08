@echo off
chcp 65001 >nul
REM ZKCommerce v4.1 - Windows Database Migration (fixed path quoting)

echo.
echo ============================================
echo  ZKCommerce v4.1 - Database Setup (Windows)
echo ============================================
echo.

REM Find psql.exe
set PSQL=
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set "PSQL=C:\Program Files\PostgreSQL\16\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set "PSQL=C:\Program Files\PostgreSQL\15\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" set "PSQL=C:\Program Files\PostgreSQL\14\bin\psql.exe"

if "%PSQL%"=="" (
  echo ERROR: psql.exe not found.
  echo Add C:\Program Files\PostgreSQL\15\bin to your PATH then retry.
  pause
  exit /b 1
)

echo Found PostgreSQL.
echo.
set /p PGPASS=Enter your PostgreSQL password: 
set PGPASSWORD=%PGPASS%

REM Create database
echo.
echo [1/3] Creating database zkcommerce...
"%PSQL%" -U postgres -c "CREATE DATABASE zkcommerce;" 2>nul
echo       Done.

REM Run master SQL
echo.
echo [2/3] Running migration (tables, indexes, seed data)...
"%PSQL%" -U postgres -d zkcommerce -f "%~dp0zkcommerce-master.sql"
set MCODE=%errorlevel%

REM Verify with quoted path
echo.
echo [3/3] Verifying...
"%PSQL%" -U postgres -d zkcommerce -c "SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='public';" 2>nul
set VCODE=%errorlevel%

if %MCODE% equ 0 (
  echo.
  echo ============================================
  echo  SUCCESS - Database is ready!
  echo ============================================
  echo.
  echo  Tables created. Login credentials:
  echo    Admin:    admin@zkcommerce.in  / demo1234
  echo    Merchant: merchant@zkcommerce.in / demo1234
  echo    Customer: customer@zkcommerce.in / demo1234
  echo.
  echo  Next steps:
  echo  1. Edit .env - set DATABASE_URL
  echo  2. Run: npm run dev
  echo  3. Open: http://localhost:3000/health
  echo ============================================
) else (
  echo ERROR: Migration had issues. Check messages above.
)
echo.
pause
