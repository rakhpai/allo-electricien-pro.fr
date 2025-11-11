# Image 400 Error Fix - Resume Plan

## Current Status (2025-11-09)

### ✅ COMPLETED
1. **Checkpoint 1: Page List Created** ✓
   - File: `/home/proalloelectrici/hugosource/debug/pages-to-generate.json`
   - Total pages: 940 pages needing images
   - Sources: 15 from 404images.csv + 938 from 404_heros.csv (some overlap removed)

2. **Fixed 36/51 Pages from debug/404images.csv** ✓
   - Issue: Malformed CDN URLs in frontmatter
   - Solution: Updated frontmatter with correct URLs
   - Verification: All return HTTP 200

### 🔄 IN PROGRESS
2. **Checkpoint 2: Generating Images**
   - Script: `/home/proalloelectrici/hugosource/eleclogos/generate-missing-images.js`
   - Status: RUNNING in background (PID: 6523e4)
   - Progress: Check `/home/proalloelectrici/hugosource/eleclogos/generation-checkpoint.json`
   - Estimated: ~11,280 images (940 pages × 12 variants)
   - Duration: 60-90 minutes
   - Output: `/home/proalloelectrici/hugosource/eleclogos/generated/allo-electricien.pro/`

### ⏳ PENDING
3. **Checkpoint 3: Upload to Supabase**
   - Command: `cd /home/proalloelectrici/hugosource/eleclogos && node src/scripts/batch-upload-variants.js`
   - Duration: 30-60 minutes
   - Checkpoint: Check `upload-stats.json`

4. **Checkpoint 4: Update Frontmatter**
   - Command: `cd /home/proalloelectrici/hugosource/eleclogos && node src/scripts/update-hugo-frontmatter.js`
   - Updates cdnImages for newly generated images
   - Checkpoint: Check `frontmatter-update-stats.json`

5. **Checkpoint 5: Rebuild Hugo**
   - Command: `cd /home/proalloelectrici/hugosource && hugo --minify`
   - Checkpoint: Build output shows 1414+ pages

6. **Checkpoint 6: Verification**
   - Test sample URLs return HTTP 200
   - Create final verification report

---

## Resume Instructions

### If Session Disconnects During Step 2 (Image Generation):

1. Check progress:
   ```bash
   cat /home/proalloelectrici/hugosource/eleclogos/generation-checkpoint.json
   ```

2. Check if process is still running:
   ```bash
   ps aux | grep generate-missing-images
   ```

3. If process died, resume:
   ```bash
   cd /home/proalloelectrici/hugosource/eleclogos
   node generate-missing-images.js
   ```
   *Script will automatically resume from last checkpoint*

4. Monitor progress:
   ```bash
   watch -n 10 "find generated/allo-electricien.pro/ -type f | wc -l"
   ```

### To Continue to Step 3 (Upload):

1. Verify Step 2 complete:
   ```bash
   grep "CHECKPOINT 2 COMPLETE" /home/proalloelectrici/hugosource/eleclogos/generation-log.txt
   ```

2. Run upload:
   ```bash
   cd /home/proalloelectrici/hugosource/eleclogos
   node src/scripts/batch-upload-variants.js
   ```

3. Check upload progress:
   ```bash
   cat /home/proalloelectrici/hugosource/eleclogos/upload-stats.json
   ```

### To Continue to Step 4 (Frontmatter):

```bash
cd /home/proalloelectrici/hugosource/eleclogos
node src/scripts/update-hugo-frontmatter.js
```

### To Continue to Step 5 (Rebuild):

```bash
cd /home/proalloelectrici/hugosource
hugo --minify
```

### To Continue to Step 6 (Verify):

```bash
# Test sample URLs
curl -I "https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/hero/electricien-urgence-guyancourt-78280-hero.jpg"
curl -I "https://eedbqzgrcqenopeyjwjj.supabase.co/storage/v1/object/public/processed-images/allo-electricien.pro/hero/electricien-urgence-versailles-78000-hero.jpg"
```

---

## Files & Checkpoints

### Key Files
- **Page List**: `/home/proalloelectrici/hugosource/debug/pages-to-generate.json`
- **Generation Checkpoint**: `/home/proalloelectrici/hugosource/eleclogos/generation-checkpoint.json`
- **Upload Stats**: `/home/proalloelectrici/hugosource/eleclogos/upload-stats.json`
- **Frontmatter Stats**: `/home/proalloelectrici/hugosource/frontmatter-update-summary.json`

### Progress Indicators
- **Images Generated**: `find /home/proalloelectrici/hugosource/eleclogos/generated/allo-electricien.pro/ -type f | wc -l`
- **Expected Total**: ~27,000 files (existing + new)
- **Disk Usage**: `du -sh /home/proalloelectrici/hugosource/eleclogos/generated/`

---

## Quick Status Check

```bash
#!/bin/bash
echo "=== Image Fix Progress ==="
echo ""
echo "Step 1: Page List"
[ -f /home/proalloelectrici/hugosource/debug/pages-to-generate.json ] && echo "✅ Complete" || echo "❌ Not found"
echo ""
echo "Step 2: Image Generation"
if [ -f /home/proalloelectrici/hugosource/eleclogos/generation-checkpoint.json ]; then
    completed=$(grep -o '"completed":' /home/proalloelectrici/hugosource/eleclogos/generation-checkpoint.json | wc -l)
    echo "🔄 In Progress - Check checkpoint file for details"
else
    echo "⏳ Not started"
fi
echo ""
echo "Total generated images: $(find /home/proalloelectrici/hugosource/eleclogos/generated/allo-electricien.pro/ -type f 2>/dev/null | wc -l)"
```

---

## Expected Timeline

- **Step 1**: ✅ 2 minutes (Complete)
- **Step 2**: 🔄 60-90 minutes (In Progress)
- **Step 3**: ⏳ 30-60 minutes (Pending)
- **Step 4**: ⏳ 5 minutes (Pending)
- **Step 5**: ⏳ 30 seconds (Pending)
- **Step 6**: ⏳ 2 minutes (Pending)

**Total Estimated**: ~2-3 hours

---

## Contact & Support

If issues arise:
1. Check error logs in script output
2. Check checkpoint files for last successful state
3. All scripts are resumable and idempotent (safe to re-run)
4. If process stuck, kill and restart from checkpoint

---

Last Updated: 2025-11-09 19:10 UTC
