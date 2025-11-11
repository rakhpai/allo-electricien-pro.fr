# Website Investigation and Fix Report
## allo-electricien.pro

**Generated:** 2025-11-10
**Total Pages Analyzed:** 1,352

---

## Executive Summary

This comprehensive investigation identified two major issues affecting the allo-electricien.pro website:

1. **Department Mismatches**: 54 pages (4%) have incorrect department classifications
2. **Duplicate Pages**: 48 duplicate pages across 27 city groups

### Impact
- **SEO**: Duplicate content dilutes search ranking potential
- **User Experience**: Multiple URLs for the same location cause confusion
- **Data Integrity**: Incorrect department categorization affects filtering and organization

---

## Issue #1: Department Mismatches

### Summary
- **Total Affected**: 54 pages out of 1,352 (4%)
- **Root Cause**: Department field doesn't match postal code

### How French Postal Codes Work
In France, the first 2 digits of a postal code indicate the department:
- 75xxx = Paris (75)
- 92xxx = Hauts-de-Seine (92)
- 91xxx = Essonne (91)
- etc.

### Confirmed Examples

| City | Postal Code | Current Dept | Expected Dept | URL |
|------|-------------|--------------|---------------|-----|
| Bagneux | 92220 | 91 | **92** | /bagneux/ |
| Bezons | 95870 | 77 | **95** | /bezons/ |
| Beauvais | 60155 | 91 | **60** | /beauvais/ |
| Bievres | 91570 | 78 | **91** | /bievres/ |
| Acheres | 78260 | 92 | **78** | /acheres/ |
| Alfortville | 94140 | 92 | **94** | /alfortville/ |
| Argenteuil | 95100 | 94 | **95** | /argenteuil/ |

### Department Transition Breakdown

| Incorrect → Correct | Number of Pages |
|---------------------|-----------------|
| 92 → 78 | 4 |
| 78 → 91 | 3 |
| 77 → 92 | 3 |
| 93 → 95 | 3 |
| 75 → 94 | 2 |
| 92 → 94 | 2 |
| 77 → 78 | 2 |
| 94 → 95 | 2 |
| 95 → 93 | 2 |
| Others | 31 (1 each) |

### Generated Files
- `department-mismatches-report.csv` - Complete list of 54 affected pages
- `department-mismatches-report.json` - Detailed JSON report with metadata

---

## Issue #2: Duplicate Pages

### Summary
- **Duplicate Groups**: 27 cities with multiple URLs
- **Total Duplicates**: 48 pages to remove
- **Patterns Identified**:
  - 21 cities with 3 versions
  - 6 cities with 2 versions

### Pattern 1: Paris Arrondissements (Majority)

Each of the 20 Paris arrondissements has **3 URL variations**:

**Example - Paris 8th Arrondissement:**
- ✅ **KEEP**: `/paris-8e/` (canonical)
- ❌ REMOVE: `/paris-8/` → redirect to `/paris-8e/`
- ❌ REMOVE: `/paris-8e-arrondissement/` → redirect to `/paris-8e/`

**Why Keep `paris-8e`?**
- Most SEO-friendly and natural French format
- Grammatically correct (8e = "huitième")
- Shorter URL (better for sharing and UX)
- Consistent pattern across all arrondissements

**Total Paris Duplicates**: ~40 pages (2 duplicates × 20 arrondissements)

### Pattern 2: Apostrophe Variations

Cities with apostrophes have multiple URL encodings:

**Example - L'Haÿ-les-Roses:**
- ✅ **KEEP**: `/l-hay-les-roses/` (canonical)
- ❌ REMOVE: `/l'hay-les-roses/` → redirect
- ❌ REMOVE: `/lhay-les-roses/` → redirect

**Why Keep Hyphenated Version?**
- URL-safe (no special characters)
- Better browser compatibility
- Avoids encoding issues (%27 for apostrophe)
- More SEO-friendly

**Cities Affected by Apostrophes**: ~7 cities with apostrophes in names

### Complete Duplicate Groups

| City | Total Versions | Canonical | Duplicates |
|------|----------------|-----------|------------|
| Paris 1er | 3 | paris-1er | paris-1, paris-1e-arrondissement |
| Paris 2e | 3 | paris-2e | paris-2, paris-2e-arrondissement |
| Paris 3e | 3 | paris-3e | paris-3, paris-3e-arrondissement |
| Paris 5e | 3 | paris-5e | paris-5, paris-5e-arrondissement |
| Paris 6e | 3 | paris-6e | paris-6, paris-6e-arrondissement |
| Paris 7e | 3 | paris-7e | paris-7, paris-7e-arrondissement |
| Paris 9e | 3 | paris-9e | paris-9, paris-9e-arrondissement |
| Paris 10e | 3 | paris-10e | paris-10, paris-10e-arrondissement |
| Paris 11e | 3 | paris-11e | paris-11, paris-11e-arrondissement |
| Paris 12e | 3 | paris-12e | paris-12, paris-12e-arrondissement |
| Paris 14e | 3 | paris-14e | paris-14, paris-14e-arrondissement |
| Paris 16e | 3 | paris-16e | paris-16, paris-16e-arrondissement |
| Paris 18e | 3 | paris-18e | paris-18, paris-18e-arrondissement |
| Paris 19e | 3 | paris-19e | paris-19, paris-19e-arrondissement |
| L'Haÿ-les-Roses | 3 | l-hay-les-roses | l'hay-les-roses, lhay-les-roses |
| *(Plus 12 more cities)* | - | - | - |

### Generated Files
- `duplicate-pages-report.csv` - Complete list of 48 duplicates
- `duplicate-pages-report.json` - Detailed JSON report
- `redirects.txt` - 48 redirect rules (301 permanent redirects)

---

## Created Fix Scripts

### 1. Department Mismatch Fixes

**Script**: `scripts/fix-department-mismatches.js`

**What it does:**
- Updates Hugo frontmatter `department` field in all 54 affected pages
- Updates Supabase `data.department` field in database
- Generates detailed results report

**How to run:**
```bash
SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/fix-department-mismatches.js
```

**Expected output:**
- 54 Hugo frontmatter updates
- 54 Supabase record updates
- Results saved to `department-fix-results.json`

### 2. Duplicate Page Removal

**Script**: `scripts/remove-duplicate-pages.js`

**What it does:**
- Removes 48 duplicate Hugo content directories
- Removes 48 duplicate Supabase records
- Updates `data/interlinks.json` to remove duplicate references
- Creates `public/_redirects` file with 301 redirect rules
- **Default: DRY RUN mode** (safe to test first)

**How to run (dry run - safe):**
```bash
SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/remove-duplicate-pages.js
```

**How to run (actual removal):**
```bash
SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/remove-duplicate-pages.js --no-dry-run
```

**Expected output:**
- 48 Hugo content directories removed
- 48 Supabase records deleted
- `data/interlinks.json` updated
- `public/_redirects` created with 48 redirect rules
- Results saved to `duplicate-removal-results.json`

---

## Validation Scripts

### 1. Department Validation

**Script**: `scripts/validate-department-mismatches.js`

Run this after fixes to verify all departments are correct:
```bash
SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/validate-department-mismatches.js
```

Expected result: **0 mismatches**

### 2. Duplicate Detection

**Script**: `scripts/identify-duplicate-pages.js`

Run this after removal to verify no duplicates remain:
```bash
SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node scripts/identify-duplicate-pages.js
```

Expected result: **0 duplicate groups**

---

## Prevention Measures

To prevent these issues from recurring:

### 1. Postal Code Validation
Add validation to page generation scripts:
```javascript
function validateDepartment(postalCode, department) {
  const expected = postalCode.substring(0, 2);
  if (expected !== department) {
    throw new Error(`Department mismatch: ${department} should be ${expected}`);
  }
}
```

### 2. Slug Normalization
Standardize slug generation:
```javascript
function normalizeSlug(cityName) {
  return cityName
    .toLowerCase()
    .replace(/'/g, '-')  // Replace apostrophes with hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}
```

### 3. Duplicate Detection
Before creating new pages, check for existing slugs:
```javascript
const existingSlugs = await checkExistingSlugs(normalizedSlug);
if (existingSlugs.length > 0) {
  console.warn(`Slug already exists: ${normalizedSlug}`);
}
```

---

## Recommended Execution Order

1. **Backup First** (CRITICAL)
   ```bash
   # Backup Hugo content
   tar -czf hugo-content-backup-$(date +%Y%m%d).tar.gz content/

   # Backup Supabase (already automatic)
   ```

2. **Fix Department Mismatches**
   ```bash
   node scripts/fix-department-mismatches.js
   ```

3. **Validate Department Fixes**
   ```bash
   node scripts/validate-department-mismatches.js
   # Should show 0 mismatches
   ```

4. **Test Duplicate Removal (Dry Run)**
   ```bash
   node scripts/remove-duplicate-pages.js
   # Review output carefully
   ```

5. **Execute Duplicate Removal**
   ```bash
   node scripts/remove-duplicate-pages.js --no-dry-run
   ```

6. **Validate No Duplicates Remain**
   ```bash
   node scripts/identify-duplicate-pages.js
   # Should show 0 duplicate groups
   ```

7. **Rebuild Hugo Site**
   ```bash
   hugo --minify
   ```

8. **Deploy**
   ```bash
   npm run deploy
   # or your deployment command
   ```

---

## Post-Deployment Verification

After deployment, verify:

1. **Redirects Work**
   ```bash
   # Test a few redirect URLs
   curl -I https://allo-electricien.pro/paris-8/
   # Should return 301 redirect to /paris-8e/
   ```

2. **Canonical Pages Load**
   ```bash
   # Test canonical URLs
   curl -I https://allo-electricien.pro/paris-8e/
   # Should return 200 OK
   ```

3. **Search Console**
   - Submit updated sitemap
   - Monitor 404 errors (should decrease)
   - Check for duplicate content warnings (should resolve)

4. **Analytics**
   - Monitor traffic patterns
   - Ensure no significant drops
   - Redirects should preserve traffic to canonical URLs

---

## Summary Statistics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Pages | 1,352 | 1,304 | -48 (-3.5%) |
| Pages with Correct Dept | 1,298 (96%) | 1,304 (100%) | +6 pages |
| Duplicate Page Sets | 27 | 0 | -27 |
| Redirect Rules | 0 | 48 | +48 |

---

## Questions?

If you encounter any issues:
1. Check the generated report files (CSV/JSON)
2. Review the dry-run output before executing
3. Verify backups are in place
4. Test redirects after deployment

**All scripts are idempotent** - safe to run multiple times.
