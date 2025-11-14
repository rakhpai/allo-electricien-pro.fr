# Supabase Image System for allo-electricien.pro

Automated image processing system with watermarking, multi-format generation, and CDN delivery.

## Overview

This system manages 342 source images and generates 4,104 optimized variants with watermarks:
- **4 variant types**: hero, og, featured, video
- **3 formats per type**: JPG, WebP, AVIF
- **Watermarking**: Logo (top-left) + CTA button (bottom-right)
- **CDN delivery**: Supabase global CDN
- **Multi-tenancy**: Supports multiple domains

## Architecture

```
Source Images (342)
    ↓
Image Processor (Sharp)
    ↓
Watermark Manager (SVG overlays)
    ↓
Image Variants (4,104)
    ↓
Supabase Storage CDN
    ↓
Hugo Templates
```

## Setup Status

### ✅ Completed (Phase 1)

- [x] Fixed critical bug in upload-source-images.js (line 391)
- [x] Created .env configuration file
- [x] Created package.json with dependencies
- [x] Installed npm dependencies (157 packages)

### ⏳ Pending (Phases 2-8)

- [ ] **Phase 2**: Supabase Configuration
  - [ ] Add API keys to .env file
  - [ ] Execute database migration
  - [ ] Create storage buckets
  - [ ] Configure bucket policies

- [ ] **Phase 3**: Upload 25 logo SVG files
- [ ] **Phase 4**: Upload 342 source images
- [ ] **Phase 5**: Generate 4,104 image variants
- [ ] **Phase 6**: Update Hugo templates
- [ ] **Phase 7**: Test locally
- [ ] **Phase 8**: Deploy to production

## Quick Start

### 1. Configure Supabase Credentials

Edit `/home/proalloelectrici/hugosource/eleclogos/.env`:

```bash
# Get these from: https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/settings/api

SUPABASE_URL=https://eedbqzgrcqenopeyjwjj.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Where to find keys:**
1. Go to [Supabase API Settings](https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/settings/api)
2. Copy "anon public" key → `SUPABASE_ANON_KEY`
3. Copy "service_role secret" key → `SUPABASE_SERVICE_ROLE_KEY`
4. ⚠️ **NEVER commit .env to git!** (already in .gitignore)

### 2. Run Database Migration

**Option A: Supabase SQL Editor (Recommended)**

1. Go to [SQL Editor](https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/editor)
2. Click "New Query"
3. Copy contents of `src/migrations/supabase-migration-image-system.sql`
4. Paste and run (Ctrl+Enter)

**Option B: Helper Script**

```bash
node src/scripts/run-migration.js
```
This will provide detailed instructions.

**Verify Migration:**

```bash
node src/scripts/verify-migration.js
```

Expected output: 6 tables created (sites, source_images, image_variants, image_usage, image_generation_queue, image_statistics)

### 3. Create Storage Buckets

Go to [Supabase Storage](https://supabase.com/dashboard/project/eedbqzgrcqenopeyjwjj/storage/buckets)

**Create bucket: `source-images`**
- Privacy: Private
- File size limit: 10 MB
- Allowed MIME types: image/jpeg, image/png, image/webp

**Create bucket: `processed-images`**
- Privacy: Public
- File size limit: 5 MB
- Allowed MIME types: image/jpeg, image/webp, image/avif

### 4. Upload Assets

**Upload logos (25 SVG files):**

```bash
node src/scripts/upload-logos.js
```

**Upload source images (342 photos):**

First, ensure `elecphotos/` directory exists with 342 images.

```bash
node src/scripts/upload-source-images.js
```

### 5. Generate Image Variants

Pre-generate all 4,104 variants:

```bash
node src/scripts/batch-generate-variants.js
```

This will:
- Process all 342 source images
- Generate 4 variant types (hero, og, featured, video)
- Convert to 3 formats (jpg, webp, avif)
- Apply watermarks (logo + CTA)
- Upload to Supabase CDN

**Estimated time:** 2-3 hours

## Database Schema

### Tables

1. **sites** - Multi-tenancy configuration
   - Stores domain-specific watermark settings
   - Default: allo-electricien.pro

2. **source_images** - Master image repository
   - 342 high-quality source images
   - Metadata, tags, usage tracking

3. **image_variants** - Processed images
   - 4,104 generated variants
   - CDN URLs, dimensions, file sizes

4. **image_usage** - Page-to-image mapping
   - Tracks which pages use which images
   - Enables analytics and cleanup

5. **image_generation_queue** - On-demand processing
   - Queue for generating missing variants
   - Retry logic and status tracking

6. **image_statistics** - Analytics
   - Daily aggregated stats
   - Performance monitoring

## Image Specifications

### Variant Types and Dimensions

| Type     | Dimensions  | Use Case           | Quality |
|----------|-------------|-------------------|---------|
| hero     | 1920×1080   | Page headers      | 85%     |
| og       | 1200×630    | Social sharing    | 90%     |
| featured | 800×600     | Thumbnails        | 85%     |
| video    | 1280×720    | Video placeholders| 85%     |

### Formats

- **JPG**: Baseline compatibility, moderate file size
- **WebP**: Modern browsers, better compression (~30% smaller)
- **AVIF**: Cutting-edge, best compression (~50% smaller)

### Watermark Configuration

**Logo (top-left):**
- Size: 240px
- Position: 40px from top, 40px from left
- Opacity: 100%

**CTA Button (bottom-right):**
- Size: 1050px width (max 60% of image width)
- Position: 60px from bottom, 60px from right
- Opacity: 100%
- Drop shadow: Yes
- Brand color: #dc2626 (red)

## Scripts Reference

### Migration & Setup

```bash
node src/scripts/run-migration.js      # Migration instructions
node src/scripts/verify-migration.js   # Verify database setup
```

### Asset Upload

```bash
node src/scripts/upload-logos.js          # Upload 25 SVG logos
node src/scripts/upload-source-images.js  # Upload 342 source images
```

### Image Generation

```bash
node src/scripts/batch-generate-variants.js  # Pre-generate all variants
```

## Services

### Image Processor (`src/services/image-processor.js`)

Core image processing with Sharp:
- Resize to exact dimensions
- Apply watermarks
- Convert formats (jpg/webp/avif)
- Optimize file size
- Upload to Supabase CDN

### Watermark Manager (`src/services/watermark-manager.js`)

Watermark composition:
- Load SVG assets from Supabase
- Calculate positioning (responsive to image size)
- Cache SVG buffers
- Site-specific configurations

### Supabase Service (`src/services/supabase.js`)

Database operations:
- CRUD for all tables
- Batch processing
- Usage tracking
- Queue management

## File Structure

```
eleclogos/
├── .env                          # Supabase credentials (gitignored)
├── .gitignore                    # Protect sensitive files
├── package.json                  # Dependencies
├── README.md                     # This file
│
├── logos/                        # 25 SVG files
│   ├── logo-allo-electricien.svg
│   ├── cta-*.svg
│   └── ...
│
├── src/
│   ├── config/
│   │   └── index.js              # Centralized config
│   │
│   ├── migrations/
│   │   └── supabase-migration-image-system.sql
│   │
│   ├── scripts/
│   │   ├── run-migration.js
│   │   ├── verify-migration.js
│   │   ├── upload-logos.js
│   │   ├── upload-source-images.js
│   │   └── batch-generate-variants.js
│   │
│   ├── services/
│   │   ├── image-processor.js
│   │   ├── watermark-manager.js
│   │   └── supabase.js
│   │
│   └── utils/
│       ├── logger.js
│       ├── image-helper.js
│       └── storage-helper.js
│
└── node_modules/                 # Installed packages (gitignored)
```

## Troubleshooting

### Error: Missing Supabase credentials

**Solution:** Update `.env` file with your API keys from Supabase dashboard.

### Error: Tables don't exist

**Solution:** Run database migration in Supabase SQL editor.

### Error: Storage bucket not found

**Solution:** Create buckets `source-images` and `processed-images` in Supabase Storage.

### Error: Sharp installation failed

**Solution:** Sharp requires node-gyp. Try:
```bash
npm rebuild sharp
```

## Performance

### File Sizes (Estimated)

- Source images: ~2-5 MB each (JPEG)
- Hero JPG: ~150-250 KB
- Hero WebP: ~80-150 KB
- Hero AVIF: ~50-100 KB

### Processing Time

- Single variant: ~2-3 seconds
- Full batch (4,104 variants): ~2-3 hours
- Watermark application: ~500ms per image

### Storage Requirements

- Source images: ~1 GB (342 × 3 MB average)
- Processed variants: ~400 MB (4,104 × ~100 KB average)
- Total: ~1.5 GB

## Next Steps After Setup

1. **Integrate with Hugo:**
   - Update templates to use Supabase CDN URLs
   - Replace static image references
   - Implement responsive picture elements

2. **Monitor Performance:**
   - Check CDN hit rates
   - Analyze format usage (AVIF vs WebP vs JPG)
   - Track page load improvements

3. **Optimize:**
   - Fine-tune watermark positioning
   - Adjust compression quality
   - A/B test image variants

## Support

For issues or questions:
- Check logs: `node_modules/.bin/` scripts have verbose logging
- Review Supabase dashboard for storage/database errors
- Verify .env configuration

## License

MIT License - Internal tool for allo-electricien.pro
