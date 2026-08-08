@echo off
REM ZKCommerce v4.1 - Open Frontend in Browser (Windows)
REM Double-click this file from the zkc-build folder

echo Opening ZKCommerce frontend pages...
echo.
echo Pick which page to open:
echo.
echo [1] Marketing landing page (index.html)
echo [2] Login page (auth/login.html)
echo [3] Merchant dashboard (merchant/dashboard.html)
echo [4] Store setup wizard (merchant/setup.html)
echo [5] Customer storefront (storefront/home.html)
echo [6] Admin panel (admin/dashboard.html)
echo [7] Gap analysis report (admin/gap-analysis-full.html)
echo [8] Release status report (admin/release-status.html)
echo [9] Open ALL key pages
echo.
set /p CHOICE=Enter number (1-9):

if "%CHOICE%"=="1" start "" "index.html"
if "%CHOICE%"=="2" start "" "auth\login.html"
if "%CHOICE%"=="3" start "" "merchant\dashboard.html"
if "%CHOICE%"=="4" start "" "merchant\setup.html"
if "%CHOICE%"=="5" start "" "storefront\home.html"
if "%CHOICE%"=="6" start "" "admin\dashboard.html"
if "%CHOICE%"=="7" start "" "admin\gap-analysis-full.html"
if "%CHOICE%"=="8" start "" "admin\release-status.html"
if "%CHOICE%"=="9" (
  start "" "index.html"
  timeout /t 1 >nul
  start "" "auth\login.html"
  timeout /t 1 >nul
  start "" "merchant\dashboard.html"
  timeout /t 1 >nul
  start "" "storefront\home.html"
  timeout /t 1 >nul
  start "" "admin\dashboard.html"
)

echo.
echo Pages opened in your default browser.
echo.
echo API should be running at http://localhost:3000
echo Test it: http://localhost:3000/health
echo.
pause
