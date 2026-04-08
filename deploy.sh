#!/bin/bash
# ─── Farroway Production Deployment Script ─────────────
set -e

echo "🌾 Farroway Deployment"
echo "========================"

# 1. Install dependencies
echo "[1/6] Installing frontend dependencies..."
npm ci --production=false

echo "[2/6] Installing server dependencies..."
cd server && npm ci && cd ..

# 3. Build frontend
echo "[3/6] Building frontend for production..."
npx vite build

# 4. Generate Prisma client
echo "[4/6] Generating Prisma client..."
cd server && npx prisma generate

# 5. Run database migrations
echo "[5/6] Running database migrations..."
npx prisma migrate deploy

# 6. Seed database (optional — remove for existing deployments)
echo "[6/6] Seeding database..."
node prisma/seed.js

echo ""
echo "✅ Deployment complete!"
echo "Start the server with: cd server && NODE_ENV=production node src/server.js"
echo "The app will be available at http://localhost:${PORT:-4000}"
