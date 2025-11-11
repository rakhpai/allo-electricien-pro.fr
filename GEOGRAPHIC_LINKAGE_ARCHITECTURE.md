# Geographic Linkage Architecture
## Dual-Field Strategy Documentation

**Last Updated:** 2025-11-10
**Status:** ✅ Production - Stable
**Coverage:** 99.9% (1,366/1,367 pages)

---

## Overview

This document explains the architectural decision to use a **dual-field strategy** for geographic linkage in the pages table, addressing the fact that 38.5% of geographic_locations entries have NULL `city_id` values.

**TL;DR:** This is an accepted architectural pattern, not a bug. The system uses two fields (`city_id` and `geographic_target_id`) to achieve 99.9% coverage despite incomplete external data.

---

## Architecture

### Database Schema

```sql
-- pages table (simplified)
pages {
  id: UUID (PK)
  domain_id: UUID (FK)

  -- Dual-field geographic linkage:
  city_id: INTEGER              -- External cities system reference (preferred)
  geographic_target_id: UUID    -- Direct geographic_locations.id reference (fallback)

  data: JSONB                   -- Page metadata
}

-- geographic_locations table
geographic_locations {
  id: UUID (PK)                 -- Used for geographic_target_id
  slug: TEXT
  name: TEXT
  postal_codes: TEXT[]
  city_id: INTEGER              -- External reference (38.5% are NULL)
  latitude: NUMERIC
  longitude: NUMERIC
  type: TEXT
}
```

### Dual-Field Strategy

**Two fields for geographic linkage:**

1. **`city_id` (INTEGER)** - Primary field when available
   - References external cities system (ranges 1-36,000)
   - Used for 1,260 pages (92.2% of linked pages)
   - Allows integration with external geographic databases
   - **NOT** a foreign key (no cities table in public schema)

2. **`geographic_target_id` (UUID)** - Fallback field
   - Direct reference to geographic_locations.id
   - Used for 106 pages (7.8% of linked pages)
   - Handles locations where city_id is NULL
   - 100% reliable (always exists if location exists)

**Pages can have:**
- ✅ `city_id` only (1,260 pages) - Standard case
- ✅ `geographic_target_id` only (106 pages) - Fallback case
- ✅ Neither (1 page - homepage) - Expected
- ❌ Both - Not currently used, but architecturally possible

---

## Why 38.5% of Locations Lack city_id

### Root Cause

**External Data Source Limitation:**
- Geographic locations were imported from an external source
- The external cities reference system is incomplete
- Some valid French communes exist in geographic_locations but lack city_id mappings
- This is a **data quality issue in the source**, not a system bug

### Examples

Locations that exist perfectly in geographic_locations but have NULL city_id:

| Location | Slug | Postal Code | city_id | Status |
|----------|------|-------------|---------|--------|
| Le Blanc-Mesnil | le-blanc-mesnil | 93150 | NULL | ✅ Works via UUID |
| Malakoff | malakoff | 92240 | NULL | ✅ Works via UUID |
| Le Raincy | le-raincy | 93340 | NULL | ✅ Works via UUID |

**These are fully functional** - they have complete data (name, slug, coordinates, postal codes) and are successfully used for geographic linkage via `geographic_target_id`.

---

## Decision Tree

### For Page Imports

```
When importing/updating pages:

Does matching geographic_location have city_id?
├─ YES (61.5% of locations)
│  └─ Use city_id (INTEGER)
│     ├─ pages.city_id = location.city_id
│     └─ pages.geographic_target_id = NULL
│
└─ NO (38.5% of locations)
   └─ Use geographic_target_id (UUID)
      ├─ pages.city_id = NULL
      └─ pages.geographic_target_id = location.id
```

### For Queries

```sql
-- Get all pages with geographic linkage
SELECT * FROM pages
WHERE city_id IS NOT NULL
   OR geographic_target_id IS NOT NULL;
-- Returns: 1,366 pages (99.9%)

-- Get geographic location for a page
SELECT
  CASE
    WHEN p.city_id IS NOT NULL THEN gl1.*
    WHEN p.geographic_target_id IS NOT NULL THEN gl2.*
    ELSE NULL
  END as location
FROM pages p
LEFT JOIN geographic_locations gl1 ON gl1.city_id = p.city_id
LEFT JOIN geographic_locations gl2 ON gl2.id = p.geographic_target_id
WHERE p.id = ?;
```

### For Developers

**When to use which field:**

```javascript
// In application code:
function getGeographicLocation(page) {
  if (page.city_id) {
    // Preferred: Use city_id for external system integration
    return queryByCityId(page.city_id);
  } else if (page.geographic_target_id) {
    // Fallback: Direct UUID reference
    return queryByUUID(page.geographic_target_id);
  } else {
    // No geographic linkage (e.g., homepage)
    return null;
  }
}
```

---

## Matching Algorithm

The `populate-missing-city-ids.js` script implements the dual-field logic:

```javascript
// Simplified logic from actual implementation
function matchPage(page, lookupMaps) {
  const location = findMatchingLocation(page, lookupMaps);

  if (!location) {
    return { city_id: null, geographic_target_id: null };
  }

  // Dual-field strategy:
  return {
    city_id: location.city_id,                    // May be NULL
    geographic_target_id: location.id,            // Always exists
    use_geo_target: location.city_id === null     // Flag for which to use
  };
}

// Update logic
function updatePage(page, match) {
  if (match.use_geo_target) {
    // Location lacks city_id - use UUID fallback
    await supabase.from('pages').update({
      geographic_target_id: match.geographic_target_id
    }).eq('id', page.id);
  } else {
    // Standard case - use city_id
    await supabase.from('pages').update({
      city_id: match.city_id
    }).eq('id', page.id);
  }
}
```

---

## Coverage Statistics

### Current State (2025-11-10)

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Pages** | 1,367 | 100% |
| **With city_id** | 1,260 | 92.2% |
| **With geographic_target_id** | 106 | 7.8% |
| **Total with linkage** | 1,366 | **99.9%** |
| **Without linkage** | 1 | 0.1% (homepage) |

### Geographic Locations Table

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Locations** | 9,732 | 100% |
| **With city_id** | 5,983 | 61.5% |
| **Without city_id** | 3,749 | **38.5%** |

**Key Insight:** Despite 38.5% of locations lacking city_id, we achieve 99.9% page coverage through the geographic_target_id fallback.

---

## Alternative Approaches Considered

### Option A: Accept Current State ✅ **CHOSEN**

**Rationale:** System is fully functional, zero risk

**Pros:**
- Already 99.9% operational
- Zero implementation risk
- Maintains data integrity
- UUID reference is actually more reliable

**Cons:**
- Conceptual inconsistency (mixed field usage)
- Cannot fully migrate to city_id-only

**Status:** ✅ Implemented and documented

---

### Option B: Backfill from External Source

**Rationale:** Obtain missing city_id values from original data source

**Pros:**
- Complete, consistent data
- Single field for linkage
- Better external integration

**Cons:**
- Requires access to external data source (may not exist)
- Risk of incorrect matches
- Time-consuming (11-22 hours)
- May not be possible

**Status:** ❌ Not pursued - source unavailable, high risk

---

### Option C: Generate Sequential IDs

**Rationale:** Auto-generate city_id for missing entries

**Pros:**
- Quick to implement

**Cons:**
- ⚠️ **DANGEROUS** - may conflict with external system
- Breaks referential integrity
- No semantic meaning
- Could cause data corruption

**Status:** ❌ Not recommended - too risky

---

### Option D: Migrate to UUID-Only

**Rationale:** Deprecate city_id, use geographic_target_id universally

**Pros:**
- Simplifies data model
- Works with 100% of data
- No external dependencies

**Cons:**
- Loses external reference capability
- Requires code changes
- Migration effort

**Status:** 🤔 Future consideration if external integration not needed

---

## Benefits of Dual-Field Strategy

### 1. Robustness
- Handles incomplete external data gracefully
- No pages fail due to missing city_id
- 99.9% coverage despite 38.5% data gap

### 2. Flexibility
- Can use external city_id when available
- Falls back to UUID when needed
- Future-proof for data source changes

### 3. Maintainability
- Clear decision logic (if city_id else geographic_target_id)
- Easy to understand and debug
- Well-documented in code

### 4. Performance
- Both lookups are efficient (indexed fields)
- No complex joins required
- Direct reference resolution

---

## FAQs

### Q: Is this a bug that needs fixing?
**A:** No. This is an accepted architectural pattern to handle incomplete external data.

### Q: Should we populate the missing 38.5% city_id values?
**A:** Only if there's a specific business requirement. The system works perfectly as-is.

### Q: Which field is "better"?
**A:**
- **city_id** is preferred for external system integration
- **geographic_target_id** is more reliable (always exists)
- Both are valid and supported

### Q: What if a location has neither field?
**A:** This shouldn't happen for valid locations. The matching script ensures every matched location gets at least one field populated.

### Q: Can a page have both fields?
**A:** Architecturally yes, but current implementation uses one or the other. This could be changed if needed.

### Q: What about the homepage with no linkage?
**A:** Expected and correct. The homepage (/) is not location-specific and intentionally has no geographic linkage.

---

## Maintenance Guidelines

### Adding New Pages

```javascript
// When importing new pages, use this pattern:
const location = findMatchingLocation(pageData);

if (!location) {
  console.log('No matching location found');
  return;
}

const updateData = {};
if (location.city_id) {
  // Preferred: use city_id
  updateData.city_id = location.city_id;
} else {
  // Fallback: use UUID
  updateData.geographic_target_id = location.id;
}

await supabase.from('pages').insert(updateData);
```

### Querying Linked Pages

```sql
-- All pages with any geographic linkage
SELECT id, url_path, city_id, geographic_target_id
FROM pages
WHERE city_id IS NOT NULL
   OR geographic_target_id IS NOT NULL;

-- Pages using city_id
SELECT id, url_path, city_id
FROM pages
WHERE city_id IS NOT NULL;

-- Pages using UUID fallback
SELECT id, url_path, geographic_target_id
FROM pages
WHERE geographic_target_id IS NOT NULL
  AND city_id IS NULL;
```

### Monitoring

```sql
-- Coverage report
SELECT
  COUNT(*) as total_pages,
  COUNT(city_id) as using_city_id,
  COUNT(geographic_target_id) as using_geo_uuid,
  COUNT(CASE WHEN city_id IS NOT NULL OR geographic_target_id IS NOT NULL THEN 1 END) as total_linked,
  ROUND(100.0 * COUNT(CASE WHEN city_id IS NOT NULL OR geographic_target_id IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_pct
FROM pages
WHERE domain_id = '<domain-id>';
```

---

## Related Scripts

- `scripts/populate-missing-city-ids.js` - Main population script with dual-field logic
- `scripts/diagnose-missing-city-ids.js` - Diagnostic tool for unlinked pages
- `scripts/final-status-check.js` - Coverage verification
- `scripts/investigate-cities-table.js` - city_id investigation tool

---

## Related Documentation

- `CITY_ID_POPULATION_REPORT.md` - Phase 1 implementation report
- `FINAL_CITY_LINKAGE_REPORT.md` - Complete project documentation
- `PARIS_FIX_AND_FINAL_REPORT.md` - Paris arrondissement fix details

---

## Future Considerations

### If Business Requirements Change

**Scenario: Need to populate all city_id values**

Steps:
1. Investigate external cities data source
2. Determine if it's INSEE codes, another API, or custom system
3. Create matching script with validation
4. Run in dry-run mode extensively
5. Migrate geographic_target_id pages to city_id
6. Update this documentation

**Scenario: Want to simplify to single field**

Options:
1. Migrate all to city_id (requires external data)
2. Migrate all to geographic_target_id (simplest)
3. Keep dual-field (current state)

---

## Conclusion

The dual-field strategy is a **pragmatic, production-ready solution** that achieves 99.9% geographic linkage coverage despite incomplete external data. It's not a bug to fix but an architectural decision to document and maintain.

**Status:** ✅ Accepted and stable
**Recommendation:** Maintain current architecture unless business requirements demand otherwise

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Next Review:** On-demand or when business requirements change
