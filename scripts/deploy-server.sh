#!/usr/bin/env sh
set -e

cd "$(dirname "$0")/.."

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Removing old .next build (prevents stale chunk 404/400)..."
rm -rf .next

echo "Building production bundle..."
npm run build

echo "Restarting app on port 3000..."
npm run stop:3000 || true
npm run start

echo ""
echo "Deploy complete. Verify: curl -s http://127.0.0.1:3000/build-info.json"
echo "Then open /reports in browser — chunk URLs must return HTTP 200."
