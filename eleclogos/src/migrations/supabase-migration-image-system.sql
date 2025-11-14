-- ============================================================================
-- CENTRALIZED IMAGE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- Multi-site image repository with automatic generation tracking
-- Supports: allo-electricien.pro and future electrician websites
-- Features: Watermarking, format optimization, usage tracking, on-demand generation
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. SITES TABLE (Multi-tenancy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Watermark configuration (JSON)
  watermark_config JSONB NOT NULL DEFAULT '{
    "logo": {
      "path": "logos/default-logo.svg",
      "position": "top-left",
      "size": 240,
      "opacity": 1.0
    },
    "cta": {
      "path": "logos/default-cta.svg",
      "position": "bottom-right",
      "size": 1050,
      "maxWidthPercent": 0.6,
      "opacity": 1.0,
      "dropShadow": true
    },
    "brandColor": "#dc2626"
  }'::jsonb,

  -- Status
  active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT sites_domain_check CHECK (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_sites_domain ON sites(domain);
CREATE INDEX idx_sites_active ON sites(active);

-- ============================================================================
-- 2. SOURCE IMAGES TABLE (Master Image Repository)
-- ============================================================================
CREATE TABLE IF NOT EXISTS source_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Identification
  filename TEXT UNIQUE NOT NULL,              -- elec-001.jpg
  image_number INTEGER UNIQUE NOT NULL,       -- 1-342

  -- Storage location
  storage_path TEXT UNIQUE NOT NULL,          -- source-images/electrician/elec-001.jpg
  storage_bucket TEXT DEFAULT 'source-images',

  -- File properties
  file_size BIGINT,                           -- bytes
  width INTEGER,                              -- pixels
  height INTEGER,                             -- pixels
  format TEXT,                                -- jpg, png, webp
  mime_type TEXT DEFAULT 'image/jpeg',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,         -- EXIF, color profile, camera info
  tags TEXT[],                                -- ['electrical', 'worker', 'indoor', 'tools']
  description TEXT,
  alt_text TEXT,

  -- Usage tracking
  variant_count INTEGER DEFAULT 0,            -- How many variants generated
  usage_count INTEGER DEFAULT 0,              -- How many pages use this
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT source_images_image_number_check CHECK (image_number >= 1 AND image_number <= 1000),
  CONSTRAINT source_images_dimensions_check CHECK (width > 0 AND height > 0)
);

-- Indexes
CREATE INDEX idx_source_images_number ON source_images(image_number);
CREATE INDEX idx_source_images_filename ON source_images(filename);
CREATE INDEX idx_source_images_tags ON source_images USING GIN(tags);
CREATE INDEX idx_source_images_uploaded ON source_images(uploaded_at DESC);

-- ============================================================================
-- 3. IMAGE VARIANTS TABLE (Generated Optimized Images)
-- ============================================================================
CREATE TABLE IF NOT EXISTS image_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Relations
  source_image_id UUID NOT NULL REFERENCES source_images(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- Variant specification
  variant_type TEXT NOT NULL,                 -- hero, og, featured, video
  format TEXT NOT NULL,                       -- jpg, webp, avif
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,

  -- Storage location
  storage_path TEXT UNIQUE NOT NULL,          -- processed-images/allo-electricien.pro/hero/elec-001-hero.jpg
  storage_bucket TEXT DEFAULT 'processed-images',
  public_url TEXT NOT NULL,                   -- Full Supabase CDN URL

  -- File properties
  file_size BIGINT,                           -- bytes
  quality INTEGER,                            -- 1-100

  -- Watermark tracking
  watermark_applied BOOLEAN DEFAULT true,
  watermark_config JSONB,                     -- Snapshot of watermark settings used

  -- Performance metrics
  generation_time_ms INTEGER,                 -- Processing time in milliseconds
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Access tracking
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT image_variants_unique_combo UNIQUE(source_image_id, site_id, variant_type, format),
  CONSTRAINT image_variants_type_check CHECK (variant_type IN ('hero', 'og', 'featured', 'video')),
  CONSTRAINT image_variants_format_check CHECK (format IN ('jpg', 'webp', 'avif', 'png')),
  CONSTRAINT image_variants_dimensions_check CHECK (width > 0 AND height > 0),
  CONSTRAINT image_variants_quality_check CHECK (quality > 0 AND quality <= 100)
);

-- Indexes
CREATE INDEX idx_image_variants_source ON image_variants(source_image_id);
CREATE INDEX idx_image_variants_site ON image_variants(site_id);
CREATE INDEX idx_image_variants_type_format ON image_variants(variant_type, format);
CREATE INDEX idx_image_variants_generated ON image_variants(generated_at DESC);
CREATE INDEX idx_image_variants_access ON image_variants(access_count DESC);

-- ============================================================================
-- 4. IMAGE USAGE TABLE (Track which pages use which images)
-- ============================================================================
CREATE TABLE IF NOT EXISTS image_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Relations
  variant_id UUID NOT NULL REFERENCES image_variants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- Page identification
  page_slug TEXT NOT NULL,                    -- abbeville-la-riviere
  page_type TEXT DEFAULT 'commune',           -- commune, landing, blog, homepage
  usage_type TEXT NOT NULL,                   -- hero, og, featured, video

  -- Location-specific (for electrician sites)
  commune_code TEXT,                          -- 91150
  department TEXT,                            -- 91
  city_name TEXT,                             -- Abbeville-la-Rivière

  -- Metadata
  page_url TEXT,                              -- Full URL
  page_title TEXT,

  -- Timestamps
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT image_usage_unique_page_type UNIQUE(page_slug, usage_type, variant_id),
  CONSTRAINT image_usage_type_check CHECK (usage_type IN ('hero', 'og', 'featured', 'video'))
);

-- Indexes
CREATE INDEX idx_image_usage_page ON image_usage(page_slug);
CREATE INDEX idx_image_usage_variant ON image_usage(variant_id);
CREATE INDEX idx_image_usage_site ON image_usage(site_id);
CREATE INDEX idx_image_usage_commune ON image_usage(commune_code) WHERE commune_code IS NOT NULL;
CREATE INDEX idx_image_usage_assigned ON image_usage(assigned_at DESC);

-- ============================================================================
-- 5. IMAGE GENERATION QUEUE (For batch and on-demand processing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS image_generation_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- What to generate
  source_image_id UUID REFERENCES source_images(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL,
  format TEXT NOT NULL,

  -- Priority & Status
  priority INTEGER DEFAULT 50,                -- 0-100, higher = more urgent
  status TEXT DEFAULT 'pending',              -- pending, processing, completed, failed

  -- Error handling
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT generation_queue_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT generation_queue_priority_check CHECK (priority >= 0 AND priority <= 100)
);

-- Indexes
CREATE INDEX idx_generation_queue_status ON image_generation_queue(status, priority DESC);
CREATE INDEX idx_generation_queue_created ON image_generation_queue(created_at DESC);
CREATE INDEX idx_generation_queue_retry ON image_generation_queue(next_retry_at) WHERE status = 'failed';

-- ============================================================================
-- 6. IMAGE STATISTICS TABLE (Aggregated metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS image_statistics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Grouping
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Metrics
  total_variants INTEGER DEFAULT 0,
  total_storage_bytes BIGINT DEFAULT 0,
  total_generations INTEGER DEFAULT 0,
  total_accesses INTEGER DEFAULT 0,
  avg_generation_time_ms INTEGER,

  -- By variant type
  hero_count INTEGER DEFAULT 0,
  og_count INTEGER DEFAULT 0,
  featured_count INTEGER DEFAULT 0,
  video_count INTEGER DEFAULT 0,

  -- By format
  jpg_count INTEGER DEFAULT 0,
  webp_count INTEGER DEFAULT 0,
  avif_count INTEGER DEFAULT 0,

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT image_statistics_unique_site_date UNIQUE(site_id, date)
);

-- Indexes
CREATE INDEX idx_image_statistics_site ON image_statistics(site_id);
CREATE INDEX idx_image_statistics_date ON image_statistics(date DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_source_images_updated_at BEFORE UPDATE ON source_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_image_usage_updated_at BEFORE UPDATE ON image_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update variant_count on source_images when variants are created/deleted
CREATE OR REPLACE FUNCTION update_source_image_variant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE source_images
    SET variant_count = variant_count + 1
    WHERE id = NEW.source_image_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE source_images
    SET variant_count = variant_count - 1
    WHERE id = OLD.source_image_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_variant_count
AFTER INSERT OR DELETE ON image_variants
FOR EACH ROW EXECUTE FUNCTION update_source_image_variant_count();

-- Update access tracking
CREATE OR REPLACE FUNCTION track_image_access()
RETURNS TRIGGER AS $$
BEGIN
  NEW.access_count = OLD.access_count + 1;
  NEW.last_accessed_at = NOW();

  -- Also update source image
  UPDATE source_images
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.source_image_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Image inventory with usage stats
CREATE OR REPLACE VIEW v_image_inventory AS
SELECT
  si.id,
  si.image_number,
  si.filename,
  si.storage_path,
  si.width,
  si.height,
  si.file_size,
  si.variant_count,
  si.usage_count,
  si.uploaded_at,
  COUNT(DISTINCT iv.id) as generated_variants,
  COUNT(DISTINCT iu.id) as page_assignments,
  COALESCE(SUM(iv.file_size), 0) as total_variant_size
FROM source_images si
LEFT JOIN image_variants iv ON si.id = iv.source_image_id
LEFT JOIN image_usage iu ON iv.id = iu.variant_id
GROUP BY si.id;

-- View: Site storage usage
CREATE OR REPLACE VIEW v_site_storage AS
SELECT
  s.id,
  s.domain,
  s.name,
  COUNT(DISTINCT iv.id) as total_variants,
  COUNT(DISTINCT iv.source_image_id) as unique_source_images,
  COALESCE(SUM(iv.file_size), 0) as total_bytes,
  COALESCE(SUM(iv.file_size) / 1024.0 / 1024.0, 0) as total_mb,
  COALESCE(SUM(iv.file_size) / 1024.0 / 1024.0 / 1024.0, 0) as total_gb,
  COUNT(DISTINCT CASE WHEN iv.variant_type = 'hero' THEN iv.id END) as hero_count,
  COUNT(DISTINCT CASE WHEN iv.variant_type = 'og' THEN iv.id END) as og_count,
  COUNT(DISTINCT CASE WHEN iv.variant_type = 'featured' THEN iv.id END) as featured_count,
  COUNT(DISTINCT CASE WHEN iv.variant_type = 'video' THEN iv.id END) as video_count,
  COUNT(DISTINCT CASE WHEN iv.format = 'jpg' THEN iv.id END) as jpg_count,
  COUNT(DISTINCT CASE WHEN iv.format = 'webp' THEN iv.id END) as webp_count,
  COUNT(DISTINCT CASE WHEN iv.format = 'avif' THEN iv.id END) as avif_count
FROM sites s
LEFT JOIN image_variants iv ON s.id = iv.site_id
GROUP BY s.id;

-- View: Most used images
CREATE OR REPLACE VIEW v_most_used_images AS
SELECT
  si.image_number,
  si.filename,
  si.usage_count,
  si.variant_count,
  COUNT(DISTINCT iu.page_slug) as unique_pages,
  string_agg(DISTINCT iu.page_slug, ', ' ORDER BY iu.page_slug) as sample_pages
FROM source_images si
LEFT JOIN image_variants iv ON si.id = iv.source_image_id
LEFT JOIN image_usage iu ON iv.id = iu.variant_id
GROUP BY si.id
ORDER BY si.usage_count DESC, si.variant_count DESC;

-- View: Generation performance
CREATE OR REPLACE VIEW v_generation_performance AS
SELECT
  variant_type,
  format,
  COUNT(*) as total_generated,
  AVG(generation_time_ms) as avg_time_ms,
  MIN(generation_time_ms) as min_time_ms,
  MAX(generation_time_ms) as max_time_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY generation_time_ms) as median_time_ms,
  AVG(file_size) as avg_file_size,
  MIN(file_size) as min_file_size,
  MAX(file_size) as max_file_size
FROM image_variants
WHERE generation_time_ms IS NOT NULL
GROUP BY variant_type, format
ORDER BY variant_type, format;

-- ============================================================================
-- INITIAL DATA: Insert allo-electricien.pro site
-- ============================================================================
INSERT INTO sites (domain, name, description, watermark_config, active)
VALUES (
  'allo-electricien.pro',
  'Allo Électricien Pro',
  'Service d''urgence électrique en Île-de-France',
  '{
    "logo": {
      "path": "logos/logoicon-9.svg",
      "position": "top-left",
      "size": 240,
      "opacity": 1.0
    },
    "cta": {
      "path": "logos/tel_3.svg",
      "position": "bottom-right",
      "size": 1050,
      "maxWidthPercent": 0.6,
      "opacity": 1.0,
      "dropShadow": true
    },
    "brandColor": "#dc2626"
  }'::jsonb,
  true
) ON CONFLICT (domain) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  watermark_config = EXCLUDED.watermark_config,
  updated_at = NOW();

-- ============================================================================
-- GRANT PERMISSIONS (if using Row Level Security)
-- ============================================================================
-- ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE source_images ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE image_variants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE image_usage ENABLE ROW LEVEL SECURITY;

-- Public read access to processed images (via storage policies)
-- Service role full access for generation

-- ============================================================================
-- USEFUL QUERIES FOR MONITORING
-- ============================================================================

-- Check total storage usage
-- SELECT * FROM v_site_storage;

-- Find most used images
-- SELECT * FROM v_most_used_images LIMIT 20;

-- Generation performance metrics
-- SELECT * FROM v_generation_performance;

-- Images without any variants
-- SELECT * FROM source_images WHERE variant_count = 0;

-- Failed generations to retry
-- SELECT * FROM image_generation_queue
-- WHERE status = 'failed' AND retry_count < max_retries
-- ORDER BY priority DESC, created_at ASC;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Schema version: 1.0.0
-- Created: 2025
-- Purpose: Centralized multi-site image management system
-- ============================================================================
