#!/usr/bin/env python3
"""
Fixed script to update coordinates only.
"""

import re
import json

HTML_FILE = '/home/proalloelectrici/public_html/index.html'
CORRECTED_COORDS_FILE = '/home/proalloelectrici/hugosource/seo-fixes/corrected_coords.json'

def load_corrected_coordinates():
    """Load the corrected coordinates from JSON."""
    with open(CORRECTED_COORDS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def update_coordinates(html_content, corrected_coords):
    """Update all marker coordinates in the HTML."""
    print(f"\n🔧 Updating {len(corrected_coords)} city coordinates...")

    updated_count = 0

    for city_data in corrected_coords:
        city = city_data['city']
        postal = city_data['postal']
        new_lat = city_data['new_lat']
        new_lon = city_data['new_lon']

        # Pattern to match the marker with old coords followed by this city
        # Account for newline between marker and bindPopup
        pattern = rf"markers\.addLayer\(L\.marker\(\[48\.8566, 2\.3522\]\)\s*\n\.bindPopup\('<b>{re.escape(city)}</b><br>{re.escape(postal)}<br>"

        replacement = f"markers.addLayer(L.marker([{new_lat}, {new_lon}])\n.bindPopup('<b>{city}</b><br>{postal}<br>"

        # Check if pattern exists
        if re.search(pattern, html_content):
            # Replace first occurrence only
            html_content = re.sub(pattern, replacement, html_content, count=1)
            updated_count += 1
            if updated_count % 50 == 0:
                print(f"  Progress: {updated_count}/{len(corrected_coords)}")
        else:
            print(f"  ⚠️  Pattern not found for: {city} ({postal})")

    print(f"✅ Updated {updated_count} coordinates")
    return html_content, updated_count

def remove_duplicate_cities(html_content):
    """Remove duplicate city entries."""
    print("\n🗑️  Removing duplicate city entries...")

    duplicates = [
        ('BONNEUIL-SUR-MARNE', '94380'),
        ('BRUNOY', '91800'),
        ('BUC', '78530'),
        ('CHAMBOURCY', '78240'),
        ('CHEVILLY-LARUE', '94550'),
        ('EPINAY-SUR-SEINE', '93800'),
        ('FLEURY-MEROGIS', '91700'),
    ]

    removed_count = 0

    for city, postal in duplicates:
        # Find marker with duplicate coords for this city
        pattern = rf"markers\.addLayer\(L\.marker\(\[48\.8566, 2\.3522\]\)\s*\n\.bindPopup\('<b>{re.escape(city)}</b><br>{re.escape(postal)}<br>.*?'\)\);\n"

        matches = list(re.finditer(pattern, html_content))
        if len(matches) > 0:
            # Remove first occurrence (which should have duplicate coords)
            html_content = html_content.replace(matches[0].group(0), '', 1)
            removed_count += 1
            print(f"  ✅ Removed duplicate: {city} ({postal})")

    print(f"✅ Removed {removed_count} duplicate entries")
    return html_content, removed_count

def remove_null_entry(html_content):
    """Remove the NULL city entry."""
    print("\n🗑️  Removing NULL entry...")

    # Pattern for empty/null city - check what actually exists
    patterns = [
        r"markers\.addLayer\(L\.marker\(\[48\.8566, 2\.3522\]\)\s*\n\.bindPopup\('<b></b><br><br>.*?'\)\);\n",
        r"markers\.addLayer\(L\.marker\(\[48\.8566, 2\.3522\]\)\s*\n\.bindPopup\('<b></b><br>null.*?'\)\);\n",
    ]

    removed = False
    for pattern in patterns:
        if re.search(pattern, html_content):
            html_content = re.sub(pattern, '', html_content, count=1)
            removed = True
            print("✅ NULL entry removed")
            break

    if not removed:
        print("⚠️  NULL entry not found (may already be removed)")

    return html_content

def main():
    print("=" * 60)
    print("COORDINATE FIX SCRIPT")
    print("=" * 60)

    # Load data
    print("\n📂 Loading corrected coordinates...")
    corrected_coords = load_corrected_coordinates()
    print(f"✅ Loaded {len(corrected_coords)} corrected coordinates")

    # Load HTML
    print(f"\n📖 Reading {HTML_FILE}...")
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()
    print(f"✅ Loaded {len(html_content)} characters")

    # Apply fixes
    html_content, updated_count = update_coordinates(html_content, corrected_coords)
    html_content, removed_dupes = remove_duplicate_cities(html_content)
    html_content = remove_null_entry(html_content)

    # Write updated file
    print(f"\n💾 Writing updated HTML to {HTML_FILE}...")
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print("\n" + "=" * 60)
    print("✅ COORDINATE FIXES APPLIED!")
    print("=" * 60)
    print(f"  - Coordinates updated: {updated_count}")
    print(f"  - Duplicates removed: {removed_dupes}")
    print("\n🎉 Map coordinates are now accurate!")

if __name__ == '__main__':
    main()
