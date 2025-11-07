#!/bin/bash
set -e

echo "=== DEPLOY ALLO-ELECTRICIEN.PRO TO VPS ==="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build Hugo site
echo "🏗️  Building Hugo site..."
hugo --minify

if [ ! -d "public" ]; then
    echo "❌ Error: public/ directory not found after build"
    exit 1
fi

echo "✓ Build complete"
echo ""

# Deploy to VPS via tar + scp + ssh
echo "📦 Deploying to VPS..."
echo "   Host: ${DEPLOY_HOST}"
echo "   Port: ${DEPLOY_PORT}"
echo "   User: ${DEPLOY_USER}"
echo "   Path: ${DEPLOY_PUBLIC_PATH}"
echo ""

tar czf public.tar.gz -C public .
scp public.tar.gz web:/tmp/
ssh web "cd ${DEPLOY_PUBLIC_PATH} && rm -rf * && tar xzf /tmp/public.tar.gz && rm /tmp/public.tar.gz"
rm public.tar.gz

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ DEPLOYMENT SUCCESSFUL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Site deployed to: https://allo-electricien.pro"
    echo ""
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
