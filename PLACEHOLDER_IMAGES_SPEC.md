# Default Placeholder Images Specification

**Date:** 2025-11-09
**Purpose:** Create default placeholder images to eliminate 1,007 hero image 404 errors
**Strategy:** Option B - Default Placeholder Images

---

## Required Images

### Files to Create

Create **12 total files** (4 image types × 3 formats):

```
static/images/hero/default-electricien-hero.jpg
static/images/hero/default-electricien-hero.webp
static/images/hero/default-electricien-hero.avif

static/images/og/default-electricien-og.jpg
static/images/og/default-electricien-og.webp
static/images/og/default-electricien-og.avif

static/images/featured/default-electricien-featured.jpg
static/images/featured/default-electricien-featured.webp
static/images/featured/default-electricien-featured.avif

static/images/video/default-electricien-video.jpg
static/images/video/default-electricien-video.webp
static/images/video/default-electricien-video.avif
```

---

## Image Specifications

### 1. Hero Image
**Filename:** `default-electricien-hero.{jpg,webp,avif}`
**Dimensions:** 1920×1080px (16:9 ratio)
**Usage:** Main hero banner on city pages

**Design Requirements:**
- Professional electrician working on electrical panel
- Modern, clean aesthetic
- Branded with "Allo Électricien Île-de-France" logo/text
- Color scheme: Blue (#1E40AF), Yellow (#F59E0B), White (#FFFFFF)
- Include safety equipment (helmet, gloves, safety vest)
- Well-lit, high-quality stock photo or AI-generated

**Text Overlay (Optional):**
- "Service d'Électricien Professionnel"
- "Île-de-France • Intervention 24/7"

### 2. OG (Open Graph) Image
**Filename:** `default-electricien-og.{jpg,webp,avif}`
**Dimensions:** 1200×630px (1.91:1 ratio)
**Usage:** Social media sharing (Facebook, LinkedIn, Twitter)

**Design Requirements:**
- Based on hero image but optimized for social sharing
- Clear branding: "Allo Électricien"
- Include key value propositions:
  - "24/7 Disponible"
  - "Île-de-France"
  - "Intervention Rapide"
- High contrast for visibility in social feeds
- Same color scheme as hero image

**Must Include:**
- Logo or brand name prominently
- Phone icon or "Appelez Maintenant" CTA
- Professional electrician imagery

### 3. Featured Image
**Filename:** `default-electricien-featured.{jpg,webp,avif}`
**Dimensions:** 800×600px (4:3 ratio)
**Usage:** Thumbnail in listings, featured sections

**Design Requirements:**
- Cropped/zoomed version of hero image
- Focus on electrician's hands working or electrical equipment
- Maintain brand colors
- Clear, recognizable even at small sizes
- Professional quality

### 4. Video Thumbnail
**Filename:** `default-electricien-video.{jpg,webp,avif}`
**Dimensions:** 1280×720px (16:9 ratio)
**Usage:** Video player thumbnail (even though no videos exist yet)

**Design Requirements:**
- Play button overlay (centered)
- Screenshot-like appearance
- Electrician in action or equipment close-up
- "Vidéo Présentation" text
- Same branding as other images

---

## Format Requirements

### JPEG (.jpg)
- Quality: 85%
- Progressive encoding
- Optimized for web
- File size target: <200KB for hero, <100KB for others

### WebP (.webp)
- Quality: 80%
- Better compression than JPEG
- File size target: <150KB for hero, <75KB for others

### AVIF (.avif)
- Quality: 75%
- Best compression (newest format)
- File size target: <100KB for hero, <50KB for others

---

## Design Themes

### Theme: Professional & Trustworthy

**Key Elements:**
- Clean, modern design
- Professional electrician in branded uniform
- Safety-first appearance (equipment, proper attire)
- Warm, welcoming lighting
- Tools and equipment visible but organized

**Color Palette:**
```
Primary:   #1E40AF (Deep Blue) - Trust, professionalism
Secondary: #F59E0B (Amber)     - Energy, electrical theme
Accent:    #EF4444 (Red)       - Urgency, 24/7 service
Neutral:   #FFFFFF (White)     - Clean, modern
Text:      #1F2937 (Dark Gray) - Readable, professional
```

**Typography (if text overlay):**
- Font: Sans-serif, bold, modern
- Size: Large enough to read in thumbnails
- Color: White with dark shadow or overlay for contrast

---

## Source Options

### Option 1: Stock Photos (Free)
**Websites:**
- Unsplash: https://unsplash.com/s/photos/electrician
- Pexels: https://www.pexels.com/search/electrician/
- Pixabay: https://pixabay.com/images/search/electrician/

**Search terms:**
- "electrician professional"
- "electrical panel"
- "electrician working"
- "electrical safety"

**License:** Ensure commercial use is allowed

### Option 2: AI Generation
**Tools:**
- DALL-E 3
- Midjourney
- Stable Diffusion

**Prompt example:**
```
Professional electrician in safety vest and helmet working on modern
electrical panel, well-lit commercial environment, professional photography,
high quality, modern clean aesthetic, branded uniform, tools visible,
16:9 ratio, photorealistic
```

### Option 3: Custom Photography
- Hire professional photographer
- Use actual company technicians
- On-site electrical work photos
- Most authentic but most expensive

---

## Image Editing Steps

### Using GIMP/Photoshop:

1. **Start with base image** (2000×1200px or larger)

2. **Resize for each type:**
   - Hero: 1920×1080px
   - OG: 1200×630px
   - Featured: 800×600px
   - Video: 1280×720px

3. **Add branding overlay:**
   - Logo in corner (top-left or bottom-right)
   - Company name: "Allo Électricien"
   - Tagline: "Service 24/7 Île-de-France"

4. **Optimize and export:**
   ```bash
   # JPEG
   export at 85% quality, progressive

   # WebP (using cwebp tool)
   cwebp -q 80 input.jpg -o output.webp

   # AVIF (using avifenc tool)
   avifenc -q 75 input.jpg output.avif
   ```

5. **Verify file sizes:**
   - Hero JPG: <200KB ✓
   - OG JPG: <150KB ✓
   - Featured JPG: <100KB ✓
   - Video JPG: <150KB ✓

---

## Automated Generation Script

```bash
#!/bin/bash
# generate-placeholder-images.sh

# Requires: ImageMagick, cwebp, avifenc

BASE_IMAGE="base-electrician-photo.jpg"
HERO_SIZE="1920x1080"
OG_SIZE="1200x630"
FEATURED_SIZE="800x600"
VIDEO_SIZE="1280x720"

# Generate hero images
convert "$BASE_IMAGE" -resize "$HERO_SIZE^" -gravity center -extent "$HERO_SIZE" \
  -quality 85 static/images/hero/default-electricien-hero.jpg

cwebp -q 80 static/images/hero/default-electricien-hero.jpg \
  -o static/images/hero/default-electricien-hero.webp

avifenc -q 75 static/images/hero/default-electricien-hero.jpg \
  static/images/hero/default-electricien-hero.avif

# Generate OG images
convert "$BASE_IMAGE" -resize "$OG_SIZE^" -gravity center -extent "$OG_SIZE" \
  -quality 85 static/images/og/default-electricien-og.jpg

cwebp -q 80 static/images/og/default-electricien-og.jpg \
  -o static/images/og/default-electricien-og.webp

avifenc -q 75 static/images/og/default-electricien-og.jpg \
  static/images/og/default-electricien-og.avif

# Generate featured images
convert "$BASE_IMAGE" -resize "$FEATURED_SIZE^" -gravity center -extent "$FEATURED_SIZE" \
  -quality 85 static/images/featured/default-electricien-featured.jpg

cwebp -q 80 static/images/featured/default-electricien-featured.jpg \
  -o static/images/featured/default-electricien-featured.webp

avifenc -q 75 static/images/featured/default-electricien-featured.jpg \
  static/images/featured/default-electricien-featured.avif

# Generate video images
convert "$BASE_IMAGE" -resize "$VIDEO_SIZE^" -gravity center -extent "$VIDEO_SIZE" \
  -quality 85 static/images/video/default-electricien-video.jpg

cwebp -q 80 static/images/video/default-electricien-video.jpg \
  -o static/images/video/default-electricien-video.webp

avifenc -q 75 static/images/video/default-electricien-video.jpg \
  static/images/video/default-electricien-video.avif

echo "✅ Placeholder images generated successfully!"
```

---

## Testing Checklist

After creating placeholder images:

- [ ] All 12 files exist in correct directories
- [ ] File sizes are within targets
- [ ] Images display correctly in browser
- [ ] WebP and AVIF formats work in modern browsers
- [ ] JPG fallback works in older browsers
- [ ] Images are recognizable at thumbnail sizes
- [ ] Branding is visible and professional
- [ ] No copyright issues with source images

---

## Deployment Checklist

- [ ] Placeholder images created and optimized
- [ ] Images uploaded to static/images/ directories
- [ ] Frontmatter updated for 1,007 pages (using script)
- [ ] Hugo build succeeds without errors
- [ ] Test locally: `hugo server`
- [ ] Verify no 404s for placeholder images
- [ ] Deploy to production
- [ ] Monitor server logs for remaining 404s
- [ ] Update Supabase if needed

---

## Expected Impact

**Before:**
- 1,007 pages with image 404 errors
- Poor user experience
- Potential SEO penalties
- Broken social sharing

**After:**
- 0 image 404 errors
- Consistent branding across all pages
- Professional appearance
- Working social sharing
- Foundation for gradual replacement with custom images

**Timeline:**
- Image creation: 2-4 hours
- Frontmatter updates: Automated (<10 minutes)
- Testing: 1 hour
- Deployment: 30 minutes
- **Total: 4-6 hours**

---

## Future Enhancements

Once placeholders are deployed:

1. **Gradual Replacement**
   - Generate custom images for high-priority pages (128 pages)
   - Replace placeholders incrementally
   - Track coverage improvement in Supabase

2. **A/B Testing**
   - Test different placeholder designs
   - Measure engagement metrics
   - Optimize based on data

3. **Video Thumbnails**
   - Generate actual video thumbnails
   - Extract frames from commune videos
   - Replace generic video placeholders

---

*Specification created: 2025-11-09*
*Target: Eliminate 1,007 image 404 errors*
*Method: Default placeholder images*
