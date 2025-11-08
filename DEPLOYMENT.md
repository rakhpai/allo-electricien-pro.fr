# Deployment Instructions - Allo Électricien

## ✅ Successfully Deployed!

Your site has been deployed to: **`/home/proalloelectrici/public_html/`**

**Current Status:**
- Original homepage: **LIVE** at your domain
- All 3 variants: **Available for testing**
- Enhanced features: **Deployed** (testimonials, sticky CTA, enhanced CSS, SEO schema)

---

## 🧪 How to Test Homepage Variants

Since you chose to keep the original homepage live while testing variants, here's how to test each variant:

### Method 1: Quick Manual Swap (Recommended for Testing)

**Test Variant 1 (Urgency-First):**
```bash
cd /home/proalloelectrici/hugosource
cp layouts/index-variant1.html layouts/index.html
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

**Test Variant 2 (Trust-Driven):**
```bash
cd /home/proalloelectrici/hugosource
cp layouts/index-variant2.html layouts/index.html
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

**Test Variant 3 (Smart Personalized):**
```bash
cd /home/proalloelectrici/hugosource
cp layouts/index-variant3.html layouts/index.html
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

**Restore Original:**
```bash
cd /home/proalloelectrici/hugosource
git restore layouts/index.html
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

### Method 2: Create Testing Script

I can create a simple script for you:

```bash
#!/bin/bash
# Save as: /home/proalloelectrici/hugosource/deploy-variant.sh

VARIANT=$1

if [ -z "$VARIANT" ]; then
    echo "Usage: ./deploy-variant.sh [1|2|3|original]"
    exit 1
fi

cd /home/proalloelectrici/hugosource

if [ "$VARIANT" = "original" ]; then
    git restore layouts/index.html
elif [ "$VARIANT" = "1" ]; then
    cp layouts/index-variant1.html layouts/index.html
elif [ "$VARIANT" = "2" ]; then
    cp layouts/index-variant2.html layouts/index.html
elif [ "$VARIANT" = "3" ]; then
    cp layouts/index-variant3.html layouts/index.html
else
    echo "Invalid variant. Use: 1, 2, 3, or original"
    exit 1
fi

echo "Building site with variant $VARIANT..."
hugo --minify

echo "Deploying to public_html..."
rsync -av --delete public/ /home/proalloelectrici/public_html/

echo "✅ Deployed variant $VARIANT successfully!"
```

---

## 📁 What Was Deployed

### New Files on Live Site:
✅ `/css/custom.css` - Enhanced with 430+ lines of modern UX
✅ `/images/*` - All existing images
✅ `/js/app.js` - Enhanced JavaScript
✅ All 410 city pages

### Available Variant Templates (in Hugo source):
- `layouts/index-variant1.html` - Urgency-First Inverted Pyramid
- `layouts/index-variant2.html` - Trust-Driven Funnel
- `layouts/index-variant3.html` - Smart Personalized Journey

### New Components (ready to use):
- `layouts/partials/testimonials-carousel.html`
- `layouts/partials/sticky-cta-bar.html`
- `layouts/partials/intent-selector.html`

### Enhanced Data:
- `data/testimonials.json` (6 reviews)
- `data/faq.json` (10 SEO FAQs)
- `layouts/partials/schema.html` (Enhanced SEO)

---

## 🚀 Quick Deploy Commands

**Deploy current state to production:**
```bash
cd /home/proalloelectrici/hugosource
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

**Check what's deployed:**
```bash
ls -lh /home/proalloelectrici/public_html/index.html
ls -lh /home/proalloelectrici/public_html/css/custom.css
```

**View variant templates:**
```bash
ls -lh /home/proalloelectrici/hugosource/layouts/index-variant*.html
```

---

## 📊 Current Deployment Info

- **Build Date:** November 8, 2025, 04:18 UTC
- **Pages Generated:** 560
- **Static Files:** 3,102
- **Total Size:** ~350 MB
- **Hugo Version:** v0.139.3+extended

---

## 🎯 Next Steps for A/B Testing

### Option A: Server-Side A/B Testing
If you have access to server configuration (Apache/Nginx), you can set up random variant serving.

### Option B: JavaScript-Based Testing
Add client-side variant selection (can help set this up).

### Option C: Use External A/B Testing Tool
- Google Optimize (free)
- VWO, Optimizely (paid)

### Option D: Manual Weekly Rotation
- Week 1: Deploy Variant 1
- Week 2: Deploy Variant 2
- Week 3: Deploy Variant 3
- Week 4: Deploy winner
- Compare analytics between weeks

---

## 📖 Documentation

Full documentation available at:
- **Variant Guide:** `/home/proalloelectrici/hugosource/HOMEPAGE_VARIANTS_GUIDE.md`
- **This File:** `/home/proalloelectrici/hugosource/DEPLOYMENT.md`

---

## 🆘 Troubleshooting

**Site not updating?**
```bash
# Clear Hugo cache and rebuild
cd /home/proalloelectrici/hugosource
rm -rf public resources
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

**Need to rollback?**
```bash
cd /home/proalloelectrici/hugosource
git restore layouts/index.html
hugo --minify
rsync -av --delete public/ /home/proalloelectrici/public_html/
```

---

**Deployment Status:** ✅ **LIVE**
**Last Updated:** November 8, 2025, 04:18 UTC
**Generated by:** Claude Code 🤖
