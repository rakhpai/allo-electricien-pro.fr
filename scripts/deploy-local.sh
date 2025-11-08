#!/bin/bash
set -e

echo "=== DEPLOY ALLO-ELECTRICIEN.PRO TO LOCAL PUBLIC_HTML ==="
echo ""

# Paths
SOURCE_DIR="/home/proalloelectrici/hugosource/public"
DEST_DIR="/home/proalloelectrici/public_html"

# Build Hugo site first
echo "Building Hugo site..."
cd /home/proalloelectrici/hugosource
hugo --minify

if [ ! -d "$SOURCE_DIR" ]; then
    echo "ERROR: Source directory $SOURCE_DIR not found"
    exit 1
fi

if [ ! -d "$DEST_DIR" ]; then
    echo "ERROR: Destination directory $DEST_DIR not found"
    exit 1
fi

echo "Build complete"
echo ""

# Show what will be deployed
echo "Deployment details:"
echo "  Source: $SOURCE_DIR"
echo "  Destination: $DEST_DIR"
echo ""

# Rsync with archive mode (preserves permissions, timestamps, etc.)
echo "Syncing files..."
rsync -av --delete \
  --exclude='.htaccess' \
  --exclude='cgi-bin' \
  --exclude='.well-known' \
  "$SOURCE_DIR/" "$DEST_DIR/"

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================================"
    echo " DEPLOYMENT SUCCESSFUL"
    echo "======================================================"
    echo ""
    echo "Site deployed to: https://allo-electricien.pro"
    echo ""

    # Count deployed files
    FILE_COUNT=$(find "$DEST_DIR" -type f | wc -l)
    DIR_COUNT=$(find "$DEST_DIR" -type d | wc -l)

    echo "Statistics:"
    echo "  Files: $FILE_COUNT"
    echo "  Directories: $DIR_COUNT"
    echo ""
else
    echo ""
    echo "ERROR: Deployment failed"
    exit 1
fi
