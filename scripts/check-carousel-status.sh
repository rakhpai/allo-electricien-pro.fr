#!/bin/bash
# Carousel Implementation Status Checker
# Run this anytime to check progress

echo "=== CAROUSEL IMPLEMENTATION STATUS ==="
echo ""
echo "Generated: $(date)"
echo ""

# Phase 1: Templates
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1: Templates & Scripts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Carousel schema:     $([ -f layouts/partials/schema-carousel.html ] && echo '✓' || echo '✗')"
echo "  Profile schema:      $([ -f layouts/partials/schema-profile.html ] && echo '✓' || echo '✗')"
echo "  Profile layout:      $([ -f layouts/profile/single.html ] && echo '✓' || echo '✗')"
echo "  City integration:    $(grep -q 'schema-carousel' layouts/_default/single.html 2>/dev/null && echo '✓' || echo '✗')"
echo "  Image generator:     $([ -f scripts/generate-multi-aspect-images.js ] && echo '✓' || echo '✗')"
echo "  Page generator:      $([ -f scripts/generate-profile-pages.cjs ] && echo '✓' || echo '✗')"
echo "  Enhanced exporter:   $([ -f scripts/export-electricien-profiles-enhanced.cjs ] && echo '✓' || echo '✗')"
echo ""

# Phase 2: Content
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 2: Content Generation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check enhanced JSON
if [ -f data/electricien_profiles.json ]; then
    JSON_SIZE=$(du -h data/electricien_profiles.json | cut -f1)
    echo "  Enhanced JSON:       ✓ ($JSON_SIZE)"
else
    echo "  Enhanced JSON:       ✗"
fi

# Check profile pages
PROFILE_COUNT=$(find content/profiles -name "index.md" 2>/dev/null | wc -l)
if [ "$PROFILE_COUNT" -eq 420 ]; then
    echo "  Profile pages:       ✓ (420/420)"
elif [ "$PROFILE_COUNT" -gt 0 ]; then
    echo "  Profile pages:       ⚠ ($PROFILE_COUNT/420 - incomplete)"
else
    echo "  Profile pages:       ✗ (0/420)"
fi

# Check image generation progress
if [ -f /tmp/image-generation.log ]; then
    LAST_PROCESSED=$(grep -oP '\[\K[0-9]+(?=/420\])' /tmp/image-generation.log | tail -1)
    if [ -n "$LAST_PROCESSED" ]; then
        PERCENT=$((LAST_PROCESSED * 100 / 420))
        if [ "$LAST_PROCESSED" -eq 420 ]; then
            echo "  Image generation:    ✓ (420/420 - 100%)"
        else
            echo "  Image generation:    ⏳ ($LAST_PROCESSED/420 - $PERCENT%)"
        fi
    else
        echo "  Image generation:    ⏳ (in progress)"
    fi
else
    echo "  Image generation:    ✗ (not started)"
fi

echo ""

# Phase 3: Build
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 3: Hugo Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d public ]; then
    BUILD_COUNT=$(find public/profiles -name "index.html" 2>/dev/null | wc -l)
    TOTAL_PAGES=$(find public -name "index.html" 2>/dev/null | wc -l)
    if [ "$BUILD_COUNT" -eq 420 ]; then
        echo "  Built profiles:      ✓ (420/420)"
        echo "  Total pages:         ✓ ($TOTAL_PAGES)"
    elif [ "$BUILD_COUNT" -gt 0 ]; then
        echo "  Built profiles:      ⚠ ($BUILD_COUNT/420)"
        echo "  Total pages:         $TOTAL_PAGES"
    else
        echo "  Built profiles:      ✗ (0/420)"
        echo "  Public directory:    ✓ (exists but no profiles)"
    fi
else
    echo "  Hugo build:          ✗ (not run)"
fi

echo ""

# Phase 4: Deployment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 4: Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d /home/proalloelectrici/public_html/profiles ]; then
    DEPLOYED=$(find /home/proalloelectrici/public_html/profiles -name "index.html" 2>/dev/null | wc -l)
    if [ "$DEPLOYED" -eq 420 ]; then
        echo "  Deployed profiles:   ✓ (420/420)"
    elif [ "$DEPLOYED" -gt 0 ]; then
        echo "  Deployed profiles:   ⚠ ($DEPLOYED/420)"
    else
        echo "  Deployed profiles:   ✗ (0/420)"
    fi
else
    echo "  Deployment:          ✗ (not deployed)"
fi

echo ""

# Next actions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next Actions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f layouts/partials/schema-carousel.html ]; then
    echo "  → Phase 1: Create templates (see CAROUSEL_IMPLEMENTATION_STATUS.md)"
elif [ "$PROFILE_COUNT" -lt 420 ]; then
    if [ -f /tmp/image-generation.log ] && [ -n "$LAST_PROCESSED" ] && [ "$LAST_PROCESSED" -lt 420 ]; then
        echo "  → Phase 2: Wait for image generation ($LAST_PROCESSED/420)"
        echo "     Monitor: tail -f /tmp/image-generation.log"
    else
        echo "  → Phase 2: Run content generation scripts"
        echo "     1. node scripts/generate-multi-aspect-images.js"
        echo "     2. node scripts/export-electricien-profiles-enhanced.cjs"
        echo "     3. node scripts/generate-profile-pages.cjs"
    fi
elif [ ! -d public ] || [ "$BUILD_COUNT" -lt 420 ]; then
    echo "  → Phase 3: Build with Hugo"
    echo "     Run: hugo --minify"
elif [ "$DEPLOYED" -lt 420 ]; then
    echo "  → Phase 4: Deploy to production"
    echo "     Run: npm run deploy"
else
    echo "  → ✅ All phases complete!"
    echo "     Submit sitemap to Google Search Console"
fi

echo ""
