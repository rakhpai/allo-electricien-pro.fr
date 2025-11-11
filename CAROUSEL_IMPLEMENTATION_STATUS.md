# Carousel Schema Implementation - Status & Resumption Guide

**Last Updated:** 2025-11-11
**Status:** Phase 1 COMPLETE ✅ | Phase 2 PENDING | Phase 3 PENDING | Phase 4 PENDING

---

## Quick Status Check

Run this command to see current progress:
```bash
bash scripts/check-carousel-status.sh
```

If that file doesn't exist, use this:
```bash
echo "=== CAROUSEL IMPLEMENTATION STATUS ==="
echo ""
echo "Phase 1: Templates"
echo "  - Carousel schema: $([ -f layouts/partials/schema-carousel.html ] && echo '✓' || echo '✗')"
echo "  - Profile schema: $([ -f layouts/partials/schema-profile.html ] && echo '✓' || echo '✗')"
echo "  - Profile layout: $([ -f layouts/profile/single.html ] && echo '✓' || echo '✗')"
echo "  - City integration: $(grep -q 'schema-carousel' layouts/_default/single.html && echo '✓' || echo '✗')"
echo ""
echo "Phase 2: Content"
PROFILE_COUNT=$(find content/profiles -name "index.md" 2>/dev/null | wc -l)
echo "  - Profile pages: $PROFILE_COUNT / 420"
echo "  - Enhanced JSON: $([ -f data/electricien_profiles.json ] && echo '✓' || echo '✗')"
echo ""
echo "Phase 3: Build"
BUILD_COUNT=$(find public/profiles -name "index.html" 2>/dev/null | wc -l)
echo "  - Built profiles: $BUILD_COUNT / 420"
echo ""
echo "Phase 4: Deployment"
DEPLOYED=$([ -d /home/proalloelectrici/public_html/profiles ] && find /home/proalloelectrici/public_html/profiles -name "index.html" 2>/dev/null | wc -l || echo 0)
echo "  - Deployed profiles: $DEPLOYED / 420"
```

---

## Phase 1: Template Creation ✅ COMPLETE

### Completed Files:

1. **`layouts/partials/schema-carousel.html`** ✅
   - ItemList schema for city pages
   - Requires minimum 3 profiles
   - Includes all required Google fields

2. **`layouts/partials/schema-profile.html`** ✅
   - LocalBusiness + Electrician schema
   - For individual profile pages
   - Complete with all services and ratings

3. **`layouts/profile/single.html`** ✅
   - Main profile page template
   - Responsive design with Tailwind CSS
   - Includes hero, services, coverage, CTA sections
   - Schema markup included

4. **`layouts/_default/single.html`** ✅ MODIFIED
   - Added carousel schema partial at line 373
   - Integrates with existing city page structure

### Scripts Created:

1. **`scripts/export-electricien-profiles-enhanced.cjs`** ✅
   - Exports profiles with complete carousel data
   - Calculates review counts
   - Determines price ranges
   - Extracts addresses and coordinates
   - Generates profile URLs

2. **`scripts/generate-multi-aspect-images.js`** ✅
   - Generates 1:1, 4:3, 16:9 images
   - Professional gradient backgrounds
   - Uploads to Supabase Storage
   - Estimated time: 30-60 minutes for 420 profiles

3. **`scripts/generate-profile-pages.cjs`** ✅
   - Creates 420 Markdown pages
   - SEO-optimized frontmatter
   - Estimated time: < 1 minute

### Data Files:

1. **`data/electricien_profiles.json`** ✅ (17.78 MB)
   - 420 profiles with complete data
   - 100% coverage (all fields present)
   - 1,303 cities mapped
   - Images currently single-aspect (will update in Phase 2)

---

## Phase 2: Content Generation - NEXT STEPS

### Task 2.1: Generate Multi-Aspect Images

**Command:**
```bash
node scripts/generate-multi-aspect-images.js
```

**Expected Output:**
- 1,260 images generated (420 × 3 aspect ratios)
- Images uploaded to Supabase Storage
- Database updated with new URLs

**Duration:** 30-60 minutes

**Verification:**
```bash
# Check success count
cat scripts/multi-aspect-generation-report.json | grep '"success"'

# Should show 420 successful
```

**Resume if interrupted:**
- Script uses upsert mode (safe to re-run)
- Will skip already-processed images
- Check report JSON for progress

---

### Task 2.2: Re-Export Profiles with New Image URLs

**Command:**
```bash
node scripts/export-electricien-profiles-enhanced.cjs
```

**Expected Output:**
- Updated `data/electricien_profiles.json`
- Images field now has all 3 aspect ratios
- File size: ~18-20 MB

**Duration:** 2-3 minutes

**Verification:**
```bash
# Check file updated
ls -lh data/electricien_profiles.json

# Verify images structure
head -100 data/electricien_profiles.json | grep -A 5 '"images"'

# Should show: square, landscape, wide
```

---

### Task 2.3: Generate Profile Pages

**Command:**
```bash
node scripts/generate-profile-pages.cjs
```

**Expected Output:**
- 420 directories in `content/profiles/`
- Each with `index.md`
- Total: ~2-3 MB content

**Duration:** < 1 minute

**Verification:**
```bash
# Count pages
find content/profiles -name "index.md" | wc -l
# Should be: 420

# Check sample page
ls content/profiles/*/index.md | head -1 | xargs head -30

# Verify frontmatter has all fields
```

---

## Phase 3: Hugo Build & Testing

### Task 3.1: Test Hugo Build

**Command:**
```bash
hugo --minify
```

**Expected Output:**
- Total pages built: 1,767+ (1,303 cities + 420 profiles + 44 other)
- Build time: 1-3 minutes
- No errors

**Verification:**
```bash
# Check build success
echo $?  # Should be 0

# Count pages
find public -name "index.html" | wc -l
# Should be 1,767+

# Verify profile pages
ls public/profiles/*/index.html | wc -l
# Should be 420

# Check sample profile
ls public/profiles/*/index.html | head -1
```

---

### Task 3.2: Verify Schema Markup

**Command:**
```bash
# Check city page has carousel schema
grep -l "@type.*ItemList" public/bezons/index.html

# Check profile page has LocalBusiness schema
grep -l "@type.*LocalBusiness" public/profiles/yves-leclercq-*/index.html
```

**Expected Output:**
- Both commands should return file paths
- No errors

---

### Task 3.3: Validate with Google Rich Results Test

**Manual Testing:**

1. Test City Page (Carousel):
   - URL: https://search.google.com/test/rich-results
   - Test URL: Build a sample page and host temporarily OR use production after deploy
   - Look for: "ItemList" detection
   - Verify: 3+ profiles shown, all required fields present

2. Test Profile Page:
   - Same tool
   - Look for: "LocalBusiness" and "Electrician" types
   - Verify: Image array with 3 URLs, rating, address, etc.

**Fix Common Errors:**
- Missing images: Check image URLs are accessible
- Invalid URLs: Verify profile_url format
- Missing fields: Re-run export script

---

## Phase 4: Deployment

### Task 4.1: Deploy to Production

**Command:**
```bash
# If using npm deploy script
npm run deploy

# OR manual rsync
rsync -avz --delete public/ /home/proalloelectrici/public_html/
```

**Duration:** 5-10 minutes

**Verification:**
```bash
# Check deployed profile pages
ls /home/proalloelectrici/public_html/profiles/*/index.html | wc -l
# Should be 420

# Test live URL
curl -s https://allo-electricien.pro/profiles/yves-leclercq-98e368df/ | grep -o "<title>.*</title>"

# Check carousel schema on city page
curl -s https://allo-electricien.pro/bezons/ | grep -o "@type.*ItemList"
```

---

### Task 4.2: Submit to Google Search Console

**Manual Steps:**

1. **Submit Sitemap:**
   - Log in: https://search.google.com/search-console
   - Property: allo-electricien.pro
   - Sitemaps → Add new sitemap
   - URL: https://allo-electricien.pro/sitemap.xml

2. **Request Indexing (Sample Pages):**
   - URL Inspection tool
   - Test 5-10 profile pages
   - Test 5-10 city pages
   - Click "Request Indexing"

3. **Monitor Structured Data:**
   - Enhancements → Structured Data
   - Wait 24-48 hours
   - Check for ItemList and LocalBusiness reports
   - Fix any errors reported

---

## Resumption Instructions

### If Session Disconnects During Phase 2:

**Check Image Generation Status:**
```bash
# Look for report file
ls scripts/multi-aspect-generation-report.json

# If exists, check progress
cat scripts/multi-aspect-generation-report.json | jq '.success | length'
```

**Resume Action:**
- If 0-419: Re-run image generation script (safe, idempotent)
- If 420: Continue to Task 2.2

**Check Profile Pages:**
```bash
find content/profiles -name "index.md" | wc -l
```

**Resume Action:**
- If 0: Run Task 2.3
- If 1-419: Delete `content/profiles/` and re-run (fast)
- If 420: Continue to Phase 3

---

### If Session Disconnects During Phase 3:

**Check Build Status:**
```bash
# Check public directory
ls -ld public/

# Check profile pages built
find public/profiles -name "index.html" | wc -l
```

**Resume Action:**
- If public/ missing: Run `hugo --minify`
- If < 420 profiles: Run `hugo --minify` again
- If 420: Continue to Task 3.2

---

### If Session Disconnects During Phase 4:

**Check Deployment Status:**
```bash
# Check production has profiles
find /home/proalloelectrici/public_html/profiles -name "index.html" 2>/dev/null | wc -l
```

**Resume Action:**
- If 0: Run deployment command
- If 1-419: Re-run deployment (will sync missing files)
- If 420: Continue to Task 4.2

---

## Critical Commands Reference

### Phase 2:
```bash
# 1. Generate images
node scripts/generate-multi-aspect-images.js

# 2. Re-export with new image URLs
node scripts/export-electricien-profiles-enhanced.cjs

# 3. Generate pages
node scripts/generate-profile-pages.cjs
```

### Phase 3:
```bash
# Build site
hugo --minify

# Test locally
hugo server
```

### Phase 4:
```bash
# Deploy
npm run deploy
# OR
rsync -avz --delete public/ /home/proalloelectrici/public_html/
```

---

## Success Criteria

**Phase 2:**
- ✅ 420 profiles with 3-aspect-ratio images
- ✅ 420 profile page files created
- ✅ JSON updated with new image URLs

**Phase 3:**
- ✅ Hugo builds without errors
- ✅ 1,767+ pages generated
- ✅ Schemas validate with Google tool

**Phase 4:**
- ✅ All files deployed to production
- ✅ Sample URLs accessible
- ✅ Search Console shows no errors
- ✅ Carousel appears in search results (2-8 weeks)

---

## Expected Timeline

- **Phase 2:** 60-90 minutes (image generation is bottleneck)
- **Phase 3:** 15 minutes
- **Phase 4:** 20 minutes + monitoring

**Total Remaining:** ~2 hours of active work

---

## Troubleshooting

### Images Not Generating:
```bash
# Check Supabase connection
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Test connection
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

### Hugo Build Errors:
```bash
# Verbose build
hugo --verbose

# Check for template errors
grep -r "ERROR" hugo-build.log
```

### Schema Validation Failures:
```bash
# Check schema syntax
grep -A 100 "application/ld+json" public/bezons/index.html | jq .

# Common fixes:
# - Escape quotes in text fields
# - Ensure all URLs are absolute
# - Verify image URLs return 200
```

---

## Files Modified in This Implementation

**Created:**
- `layouts/partials/schema-carousel.html`
- `layouts/partials/schema-profile.html`
- `layouts/profile/single.html`
- `scripts/export-electricien-profiles-enhanced.cjs`
- `scripts/generate-multi-aspect-images.js`
- `scripts/generate-profile-pages.cjs`
- `CAROUSEL_IMPLEMENTATION_STATUS.md` (this file)

**Modified:**
- `layouts/_default/single.html` (added line 373: carousel schema partial)
- `data/electricien_profiles.json` (enhanced with carousel fields)

**To Be Created (Phase 2):**
- `content/profiles/[420 directories]/index.md`

---

## Next Immediate Action

**Run Phase 2, Task 2.1:**
```bash
node scripts/generate-multi-aspect-images.js
```

This will take 30-60 minutes. You can monitor progress by watching the console output.

---

## Contact & Support

If you encounter issues:
1. Check this status file for troubleshooting
2. Review the resumption instructions above
3. Run the quick status check command
4. Verify each phase's success criteria

**Important:** All scripts are idempotent (safe to re-run) except profile page generation (delete `content/profiles/` first if re-running).
