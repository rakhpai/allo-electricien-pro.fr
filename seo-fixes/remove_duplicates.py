#!/usr/bin/env python3
"""
Remove duplicate city entries from index.html
"""

HTML_FILE = '/home/proalloelectrici/public_html/index.html'

def remove_duplicates():
    print("=" * 60)
    print("REMOVING DUPLICATE CITY ENTRIES")
    print("=" * 60)

    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    original_count = len(lines)
    print(f"\n📖 Original file: {original_count} lines")

    # Define duplicates to remove (line numbers are 1-indexed, convert to 0-indexed)
    # Each entry is: (start_line - 1, number_of_lines_to_remove, city_name)
    duplicates_to_remove = [
        (118, 2, "BRUNOY"),          # Lines 119-120
        (144, 2, "CHAMBOURCY"),      # Lines 145-146
        (166, 2, "CHEVILLY-LARUE"),  # Lines 167-168
        (337, 2, "L'HAY-LES-ROSES (without hyphen)"),  # Lines 338-339 (keep hyphenated)
        (339, 2, "L'ILE-SAINT-DENIS (without hyphen)"),  # Lines 340-341 (keep hyphenated)
    ]

    # Sort in reverse order so removals don't affect subsequent line numbers
    duplicates_to_remove.sort(reverse=True, key=lambda x: x[0])

    removed_count = 0
    for start_idx, num_lines, city_name in duplicates_to_remove:
        # Verify we're removing the right thing
        snippet = ''.join(lines[start_idx:start_idx+num_lines])
        print(f"\n🗑️  Removing {city_name} (lines {start_idx+1}-{start_idx+num_lines}):")
        print(f"   {snippet[:80]}...")

        # Remove the lines
        del lines[start_idx:start_idx+num_lines]
        removed_count += num_lines

    new_count = len(lines)
    print(f"\n✅ Removed {removed_count} lines")
    print(f"📊 New file: {new_count} lines")

    # Write back
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    print("\n💾 File updated successfully!")
    return removed_count

def fix_null_department():
    print("\n" + "=" * 60)
    print("FIXING NULL DEPARTMENT FILTER")
    print("=" * 60)

    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the NULL department button
    import re
    pattern = r'<button class="dept-filter-btn[^>]*data-dept=null>[^<]*null \(2\)</button>'

    if re.search(pattern, content):
        content = re.sub(pattern, '', content)
        print("✅ Removed 'null (2)' department filter button")
    else:
        print("⚠️  NULL department button not found (may already be fixed)")

    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

def update_counts():
    print("\n" + "=" * 60)
    print("UPDATING PROFESSIONAL COUNT: 410 → 404")
    print("=" * 60)

    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    import re

    # Update all instances of "410"
    replacements = [
        (r'410 Électriciens d\'Urgence', '404 Électriciens d\'Urgence'),
        (r'410 professionnels certifiés', '404 professionnels certifiés'),
        (r'Tous \(410\)', 'Tous (404)'),
        (r'>410<', '>404<'),  # Stats number
    ]

    count = 0
    for pattern, replacement in replacements:
        matches = len(re.findall(pattern, content))
        if matches > 0:
            content = re.sub(pattern, replacement, content)
            count += matches
            print(f"  ✅ Updated {matches} instance(s): {pattern}")

    if count > 0:
        with open(HTML_FILE, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"\n✅ Updated {count} total references from 410 to 404")
    else:
        print("⚠️  No instances of '410' found to update")

    return count

if __name__ == '__main__':
    try:
        # Step 1: Remove duplicates
        removed = remove_duplicates()

        # Step 2: Fix NULL department
        fix_null_department()

        # Step 3: Update counts
        updated = update_counts()

        print("\n" + "=" * 60)
        print("✅ ALL FIXES APPLIED SUCCESSFULLY!")
        print("=" * 60)
        print(f"  - Removed {removed} duplicate marker lines")
        print(f"  - Fixed NULL department filter")
        print(f"  - Updated {updated} count references")
        print("\n🎉 Cleanup complete!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
