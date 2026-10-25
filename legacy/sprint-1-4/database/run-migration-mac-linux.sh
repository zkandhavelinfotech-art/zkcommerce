#!/bin/bash
# ZKCommerce v4.1 — Mac/Linux Database Migration
# Run: bash database/run-migration-mac-linux.sh

echo ""
echo "============================================"
echo " ZKCommerce v4.1 - Database Setup"
echo "============================================"
echo ""

# Detect connection string
if [ -n "$DATABASE_URL" ]; then
  CONN="$DATABASE_URL"
  echo "Using DATABASE_URL from environment"
else
  # Try common defaults
  if psql -U postgres -c '\q' 2>/dev/null; then
    CONN="postgresql://postgres@localhost:5432/zkcommerce"
    BASE="postgresql://postgres@localhost:5432"
  elif psql -c '\q' 2>/dev/null; then
    CONN="postgresql://localhost/zkcommerce"
    BASE="postgresql://localhost"
  else
    echo "Enter your PostgreSQL connection details:"
    read -p "Username (default: postgres): " PGUSER
    PGUSER=${PGUSER:-postgres}
    read -sp "Password (leave blank if none): " PGPASS
    echo ""
    if [ -n "$PGPASS" ]; then
      CONN="postgresql://$PGUSER:$PGPASS@localhost:5432/zkcommerce"
      BASE="postgresql://$PGUSER:$PGPASS@localhost:5432"
    else
      CONN="postgresql://$PGUSER@localhost:5432/zkcommerce"
      BASE="postgresql://$PGUSER@localhost:5432"
    fi
  fi
fi

# Create database
echo "Step 1: Creating database 'zkcommerce'..."
psql "$BASE/postgres" -c "CREATE DATABASE zkcommerce;" 2>/dev/null && \
  echo "  OK: Database created." || \
  echo "  INFO: Database may already exist, continuing..."

# Run master migration
echo ""
echo "Step 2: Running master migration..."
echo "  (30 tables, 45+ indexes, seed data — takes ~10 seconds)"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql "$CONN" -f "$SCRIPT_DIR/zkcommerce-master.sql"

if [ $? -eq 0 ]; then
  echo ""
  echo "============================================"
  echo " SUCCESS! Database is ready."
  echo "============================================"
  echo ""
  echo " Login credentials (password: demo1234):"
  echo "   Admin:    admin@zkcommerce.in"
  echo "   Merchant: merchant@zkcommerce.in"
  echo "   Customer: customer@zkcommerce.in"
  echo ""
  echo " Update your .env:"
  echo "   DATABASE_URL=$CONN"
  echo ""
  echo " Then start the API:"
  echo "   npm run dev"
  echo "============================================"
else
  echo ""
  echo "ERROR: Migration failed. See errors above."
  echo "Common fixes:"
  echo "  1. Make sure PostgreSQL is running"
  echo "  2. Check username/password"
  echo "  3. Try: createdb zkcommerce then rerun"
fi
