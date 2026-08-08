#!/bin/bash
# ZKCommerce v4.1 - Open Frontend (Mac/Linux)
# Run: bash open-frontend.sh

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "ZKCommerce Frontend Launcher"
echo "============================="
echo "1. Marketing page"
echo "2. Login"
echo "3. Merchant dashboard"
echo "4. Setup wizard"
echo "5. Customer storefront"
echo "6. Admin panel"
echo "7. Gap analysis report"
echo "8. Release status"
echo "9. Open all key pages"
echo ""
read -p "Enter number (1-9): " CHOICE

OPEN="open"  # Mac
which xdg-open > /dev/null 2>&1 && OPEN="xdg-open"  # Linux

case $CHOICE in
  1) $OPEN "$DIR/index.html" ;;
  2) $OPEN "$DIR/auth/login.html" ;;
  3) $OPEN "$DIR/merchant/dashboard.html" ;;
  4) $OPEN "$DIR/merchant/setup.html" ;;
  5) $OPEN "$DIR/storefront/home.html" ;;
  6) $OPEN "$DIR/admin/dashboard.html" ;;
  7) $OPEN "$DIR/admin/gap-analysis-full.html" ;;
  8) $OPEN "$DIR/admin/release-status.html" ;;
  9)
    $OPEN "$DIR/index.html"
    sleep 0.5
    $OPEN "$DIR/auth/login.html"
    sleep 0.5
    $OPEN "$DIR/merchant/dashboard.html"
    sleep 0.5
    $OPEN "$DIR/storefront/home.html"
    sleep 0.5
    $OPEN "$DIR/admin/dashboard.html"
    ;;
esac

echo ""
echo "API running at: http://localhost:3000"
echo "Health check:   http://localhost:3000/health"
