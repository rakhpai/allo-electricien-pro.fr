# AI Content Generation System for Allo-Électricien.pro

## Overview

This project now includes a comprehensive AI-powered content generation system using Claude (Anthropic) models to create SEO-optimized, location-specific content for electrician services across Île-de-France and Oise regions.

## System Components

### 1. Core Configuration (`scripts/ai-config.cjs`)
- Centralized AI configuration and utilities
- Anthropic Claude API integration
- Supabase database connection
- Shared helper functions for all AI scripts
- Theme detection and content variation logic

### 2. Main Scripts

#### a. SEO Content Generation (`scripts/regenerate-electricien-seo-content.cjs`)
**Purpose:** Generate complete SEO content for city pages

**Generates:**
- SEO titles (45-62 chars)
- Meta descriptions (145-165 chars)
- H1/H2 headings
- Hero headlines and subheadlines
- Taglines
- About text (800-1400 chars)

**Usage:**
```bash
# Test mode (5 cities, dry run)
node scripts/regenerate-electricien-seo-content.cjs --test --dry-run

# Specific cities
node scripts/regenerate-electricien-seo-content.cjs --cities=versailles,paris,meudon

# Full production run
node scripts/regenerate-electricien-seo-content.cjs
```

#### b. Location Enhancements (`scripts/generate-electricien-enhancements.cjs`)
**Purpose:** Generate city-specific contextual content

**Generates:**
- Hero introductions
- Emergency context
- Insurance information
- Norms compliance text
- Transport accessibility
- Local knowledge emphasis
- Emergency steps
- Why choose us sections

**Usage:**
```bash
# Test mode
node scripts/generate-electricien-enhancements.cjs --test --dry-run

# Production
node scripts/generate-electricien-enhancements.cjs
```

#### c. Service Descriptions (`scripts/generate-electricien-services.cjs`)
**Purpose:** Create detailed service descriptions

**Services Covered:**
- Emergency electrical repairs
- Electrical panel installation
- NF C 15-100 compliance
- Complete electrical renovation
- Outlet and switch installation
- Electrical diagnostics
- LED lighting
- Electric heating
- EV charging stations
- Home automation

**Usage:**
```bash
# Test mode (3 services)
node scripts/generate-electricien-services.cjs --test --dry-run

# Use Sonnet model for higher quality
node scripts/generate-electricien-services.cjs --model=claude-3-5-sonnet-20241022

# Production
node scripts/generate-electricien-services.cjs
```

#### d. Test Script (`scripts/test-ai-generation.cjs`)
**Purpose:** Verify AI configuration and test generation

**Usage:**
```bash
node scripts/test-ai-generation.cjs
```

## Configuration

### Environment Variables (.env)
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Anthropic AI Configuration
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# AI Model Configuration
AI_MODEL=claude-haiku-4-5-20251001

# Rate Limiting & Batch Processing
BATCH_SIZE=10
RATE_LIMIT_MS=1500
MAX_RETRIES=3
```

### Available Models
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`)
  - Cost-effective for bulk generation
  - $0.80/million input tokens
  - $4.00/million output tokens
  - Recommended for: Bulk content, summaries

- **Claude Sonnet 3.5** (`claude-3-5-sonnet-20241022`)
  - Higher quality output
  - $3.00/million input tokens
  - $15.00/million output tokens
  - Recommended for: Service descriptions, complex content

## Content Themes

The system automatically determines content themes based on city characteristics:

1. **Urgence (40%)** - Emergency electrical services
2. **Installation (30%)** - New electrical installations
3. **Renovation (20%)** - Electrical renovations
4. **Normes (10%)** - Compliance and standards

## Cost Estimates

Based on testing with Haiku 4.5:
- **Per city (full SEO content):** ~$0.005
- **Location enhancements:** ~$0.003 per city
- **Service description:** ~$0.002 per service
- **Full site generation (~410 cities):** ~$3-5

## Database Structure

### Tables Used/Created:
- `electricien_services` - Service descriptions
- `electricien_enhancements` - City-specific enhancements
- `pages` - Main page content (if exists)

## Best Practices

### 1. Testing
Always test with `--test --dry-run` flags first:
```bash
node scripts/[script-name].cjs --test --dry-run
```

### 2. Rate Limiting
- Default: 1.5 seconds between API calls
- Adjust in .env: `RATE_LIMIT_MS=2000`

### 3. Error Handling
- Scripts include retry logic (3 attempts)
- Failed generations are logged
- Partial results are saved

### 4. Content Validation
- Automatic length validation
- French language verification
- Markdown symbol removal
- Character count enforcement

## Workflow

### Initial Setup
1. Ensure `.env` contains `ANTHROPIC_API_KEY`
2. Run test script: `node scripts/test-ai-generation.cjs`
3. Verify API connection and generation quality

### Content Generation Workflow
1. **Test Phase:**
   ```bash
   # Test each script with dry-run
   node scripts/regenerate-electricien-seo-content.cjs --test --dry-run
   node scripts/generate-electricien-enhancements.cjs --test --dry-run
   node scripts/generate-electricien-services.cjs --test --dry-run
   ```

2. **Review Results:**
   - Check generated JSON files
   - Verify content quality
   - Review token usage and costs

3. **Production Run:**
   ```bash
   # Remove --dry-run to update database
   node scripts/regenerate-electricien-seo-content.cjs --test

   # If satisfied, run full generation
   node scripts/regenerate-electricien-seo-content.cjs
   ```

## Monitoring & Logs

### Output Files
Scripts generate timestamped JSON files with results:
- `electricien-seo-results-YYYY-MM-DD.json`
- `electricien-enhancements-YYYY-MM-DD.json`
- `electricien-services-YYYY-MM-DD.json`

### Metrics Tracked
- Token usage (input/output)
- Generation costs
- Success/failure rates
- Content themes distribution
- Processing time

## Troubleshooting

### Common Issues

1. **API Key Error**
   ```
   ERROR: ANTHROPIC_API_KEY not found
   ```
   Solution: Add key to `.env` file

2. **Module not found**
   ```
   Error: Cannot find module '@anthropic-ai/sdk'
   ```
   Solution: Run `npm install`

3. **Database errors**
   ```
   Could not find table 'electricien_enhancements'
   ```
   Solution: Script will auto-create tables on first run

4. **Rate limit errors**
   Solution: Increase `RATE_LIMIT_MS` in `.env`

## Future Enhancements

### Planned Features
1. A/B testing variants generation
2. Seasonal content variations
3. Competitor content analysis
4. Multi-language support (English)
5. Image alt-text generation
6. FAQ generation
7. Schema markup content

### Optimization Ideas
1. Implement content caching
2. Batch processing optimization
3. Progressive content updates
4. Content quality scoring
5. Automatic content refresh scheduling

## Support

For issues or questions:
1. Check test script first: `node scripts/test-ai-generation.cjs`
2. Review error logs in generated JSON files
3. Verify API key and permissions
4. Check Supabase connection

## License

This AI content generation system is proprietary to Allo-Électricien.pro.

---

*Last updated: November 2024*
*System version: 1.0.0*
*Compatible with Claude Haiku 4.5 and Sonnet 3.5*