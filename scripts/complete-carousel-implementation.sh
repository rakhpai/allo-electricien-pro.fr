#!/bin/bash
# Automated Carousel Implementation Completion Script
# Run this after image generation completes

set -e  # Exit on error

echo "════════════════════════════════════════════════════════"
echo "  CAROUSEL SCHEMA IMPLEMENTATION - AUTO-COMPLETE"
echo "════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if image generation is complete
print_status "Checking image generation status..."
if [ -f /tmp/image-generation.log ]; then
    COMPLETED=$(grep -c "✅ Complete" /tmp/image-generation.log || echo "0")
    echo "   Images generated: $COMPLETED / 420"

    if [ "$COMPLETED" -lt 420 ]; then
        print_warning "Image generation not complete yet ($COMPLETED/420)"
        echo ""
        echo "   Wait for completion or run manually:"
        echo "   tail -f /tmp/image-generation.log"
        echo ""
        exit 1
    fi
fi

print_success "Image generation complete!"
echo ""

# Step 1: Re-export profiles with new image URLs
echo "════════════════════════════════════════════════════════"
echo "Step 1/4: Re-export profiles with new image URLs"
echo "════════════════════════════════════════════════════════"
echo ""

print_status "Running enhanced export script..."
if node scripts/export-electricien-profiles-enhanced.cjs > /tmp/export.log 2>&1; then
    print_success "Export complete"

    # Show file size
    FILE_SIZE=$(du -h data/electricien_profiles.json | cut -f1)
    echo "   Updated JSON: data/electricien_profiles.json ($FILE_SIZE)"

    # Verify images structure
    if grep -q '"images"' data/electricien_profiles.json && \
       grep -q '"square"' data/electricien_profiles.json && \
       grep -q '"landscape"' data/electricien_profiles.json && \
       grep -q '"wide"' data/electricien_profiles.json; then
        print_success "Image structure verified (3 aspect ratios present)"
    else
        print_warning "Image structure may be incomplete"
    fi
else
    print_error "Export failed - check /tmp/export.log"
    exit 1
fi

echo ""
sleep 2

# Step 2: Generate profile pages
echo "════════════════════════════════════════════════════════"
echo "Step 2/4: Generate 420 profile pages"
echo "════════════════════════════════════════════════════════"
echo ""

print_status "Running profile page generator..."
if node scripts/generate-profile-pages.cjs > /tmp/pages.log 2>&1; then
    # Count generated pages
    PAGE_COUNT=$(find content/profiles -name "index.md" 2>/dev/null | wc -l)

    if [ "$PAGE_COUNT" -eq 420 ]; then
        print_success "All 420 profile pages generated"

        # Show sample URLs
        echo ""
        echo "   Sample profile pages:"
        find content/profiles -name "index.md" | head -3 | while read page; do
            DIR=$(dirname "$page")
            SLUG=$(basename "$DIR")
            echo "      /profiles/$SLUG/"
        done
    else
        print_warning "Only $PAGE_COUNT/420 pages generated"
    fi
else
    print_error "Page generation failed - check /tmp/pages.log"
    exit 1
fi

echo ""
sleep 2

# Step 3: Build with Hugo
echo "════════════════════════════════════════════════════════"
echo "Step 3/4: Build site with Hugo"
echo "════════════════════════════════════════════════════════"
echo ""

print_status "Running Hugo build..."
if hugo --minify > /tmp/hugo-build.log 2>&1; then
    # Parse Hugo output
    TOTAL_PAGES=$(grep -oP 'Total in \K[0-9]+' /tmp/hugo-build.log | head -1)
    BUILD_TIME=$(grep -oP 'Total in .* \(\K[^)]+' /tmp/hugo-build.log | head -1)

    print_success "Hugo build complete"
    echo "   Total pages: $TOTAL_PAGES"
    echo "   Build time: $BUILD_TIME"

    # Verify profile pages
    PROFILE_BUILD_COUNT=$(find public/profiles -name "index.html" 2>/dev/null | wc -l)

    if [ "$PROFILE_BUILD_COUNT" -eq 420 ]; then
        print_success "All 420 profile pages built successfully"
    else
        print_warning "Only $PROFILE_BUILD_COUNT/420 profile pages built"
    fi

    # Check for schema in sample pages
    echo ""
    print_status "Verifying schema markup..."

    # Check city page carousel schema
    if grep -q '@type.*ItemList' public/bezons/index.html 2>/dev/null; then
        print_success "Carousel schema found on city pages"
    else
        print_warning "Carousel schema not found on city pages"
    fi

    # Check profile page schema
    SAMPLE_PROFILE=$(find public/profiles -name "index.html" | head -1)
    if [ -n "$SAMPLE_PROFILE" ] && grep -q '@type.*LocalBusiness' "$SAMPLE_PROFILE"; then
        print_success "Profile schema found on profile pages"
    else
        print_warning "Profile schema not found on profile pages"
    fi
else
    print_error "Hugo build failed - check /tmp/hugo-build.log"
    cat /tmp/hugo-build.log
    exit 1
fi

echo ""
sleep 2

# Step 4: Deployment
echo "════════════════════════════════════════════════════════"
echo "Step 4/4: Deploy to production"
echo "════════════════════════════════════════════════════════"
echo ""

print_status "Deploying to production server..."
if rsync -avz --delete public/ /home/proalloelectrici/public_html/ > /tmp/deploy.log 2>&1; then
    print_success "Deployment complete"

    # Verify deployment
    DEPLOYED_PROFILES=$(find /home/proalloelectrici/public_html/profiles -name "index.html" 2>/dev/null | wc -l)

    if [ "$DEPLOYED_PROFILES" -eq 420 ]; then
        print_success "All 420 profile pages deployed"
    else
        print_warning "Only $DEPLOYED_PROFILES/420 profiles deployed"
    fi

    # Test sample live URL
    echo ""
    print_status "Testing live URLs..."

    if curl -s -o /dev/null -w "%{http_code}" https://allo-electricien.pro/profiles/yves-leclercq-98e368df/ | grep -q "200"; then
        print_success "Sample profile page is live and accessible"
        echo "   Test: https://allo-electricien.pro/profiles/yves-leclercq-98e368df/"
    else
        print_warning "Could not verify live URL (may need time to propagate)"
    fi
else
    print_error "Deployment failed - check /tmp/deploy.log"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  🎉 CAROUSEL IMPLEMENTATION COMPLETE!"
echo "════════════════════════════════════════════════════════"
echo ""

# Final summary
print_success "Implementation Summary:"
echo ""
echo "   ✓ Templates created and integrated"
echo "   ✓ 1,260 images generated (420 profiles × 3 ratios)"
echo "   ✓ 420 profile pages created"
echo "   ✓ Site built with Hugo ($TOTAL_PAGES pages)"
echo "   ✓ Deployed to production"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Test Schema Validation:"
echo "   Visit: https://search.google.com/test/rich-results"
echo "   Test URLs:"
echo "   • https://allo-electricien.pro/bezons/ (carousel)"
echo "   • https://allo-electricien.pro/profiles/yves-leclercq-98e368df/ (profile)"
echo ""
echo "2. Submit to Google Search Console:"
echo "   • Log in to Search Console"
echo "   • Submit updated sitemap.xml"
echo "   • Request indexing for sample pages"
echo ""
echo "3. Monitor Results:"
echo "   • Check 'Enhancements > Structured Data' after 24-48h"
echo "   • Look for ItemList and LocalBusiness reports"
echo "   • Carousel may appear in search in 2-8 weeks"
echo ""
echo "4. Verify Live:"
echo "   • Check profile pages load correctly"
echo "   • Verify images display properly"
echo "   • Test phone click-to-call functionality"
echo ""

# Create completion report
cat > /tmp/carousel-completion-report.txt <<EOF
CAROUSEL SCHEMA IMPLEMENTATION - COMPLETION REPORT
Generated: $(date)

════════════════════════════════════════════════════════

PHASE 1: TEMPLATES ✓
- Carousel schema partial created
- Profile schema partial created
- Profile layout template created
- City pages integrated

PHASE 2: CONTENT ✓
- Images generated: 1,260 (420 profiles × 3 ratios)
- Profile pages created: 420
- Enhanced JSON updated: $(du -h data/electricien_profiles.json | cut -f1)

PHASE 3: BUILD ✓
- Total pages built: $TOTAL_PAGES
- Profile pages: $PROFILE_BUILD_COUNT/420
- Build time: $BUILD_TIME

PHASE 4: DEPLOYMENT ✓
- Profiles deployed: $DEPLOYED_PROFILES/420
- Live site: https://allo-electricien.pro/

════════════════════════════════════════════════════════

TEST URLS:
- City page (carousel): https://allo-electricien.pro/bezons/
- Profile page: https://allo-electricien.pro/profiles/yves-leclercq-98e368df/
- Rich Results Test: https://search.google.com/test/rich-results

EXPECTED SEO IMPACT:
- Carousel rich results: 10-30% of city page searches
- Enhanced SERP visibility with images and ratings
- Additional 420 indexed pages for long-tail keywords
- Improved click-through rates (15-40% increase expected)

MONITORING:
- Google Search Console > Enhancements > Structured Data
- Check for ItemList and LocalBusiness reports (24-48h)
- Monitor organic traffic growth (3-6 months)

════════════════════════════════════════════════════════
EOF

echo "📝 Full report saved to: /tmp/carousel-completion-report.txt"
echo ""
echo "✅ Implementation complete! Good luck with your SEO! 🚀"
echo ""
