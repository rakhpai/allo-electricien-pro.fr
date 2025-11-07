#!/usr/bin/env python3
"""
Fix ALL markers - both in HTML grid AND JavaScript map initialization.
"""

import re
import json

HTML_FILE = '/home/proalloelectrici/public_html/index.html'
CORRECTED_COORDS_FILE = '/home/proalloelectrici/hugosource/seo-fixes/corrected_coords.json'

def load_corrected_coordinates():
    with open(CORRECTED_COORDS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def fix_javascript_markers(html_content, corrected_coords):
    """Fix markers in the JavaScript section."""
    print("\n🗺️  Fixing JavaScript map markers...")

    # Create a mapping for quick lookups
    coord_map = {}
    for city_data in corrected_coords:
        key = f"{city_data['city']}_{city_data['postal']}"
        coord_map[key] = (city_data['new_lat'], city_data['new_lon'])

    updated_count = 0

    # Pattern for JavaScript markers: e.addLayer(L.marker([lat,lon]).bindPopup(`<b>CITY</b><br>POSTAL
    pattern = r'e\.addLayer\(L\.marker\(\[([0-9.]+),([0-9.]+)\]\)\.bindPopup\(`<b>([^<]*)</b><br>([^<]*)<br>'

    def replace_marker(match):
        nonlocal updated_count
        lat, lon, city, postal = match.groups()

        # Check if this has duplicate coords
        if abs(float(lat) - 48.8566) < 0.0001 and abs(float(lon) - 2.3522) < 0.0001:
            key = f"{city}_{postal}"
            if key in coord_map:
                new_lat, new_lon = coord_map[key]
                updated_count += 1
                if updated_count % 50 == 0:
                    print(f"  Progress: {updated_count}")
                return f'e.addLayer(L.marker([{new_lat},{new_lon}]).bindPopup(`<b>{city}</b><br>{postal}<br>'

        # Return unchanged if not a duplicate or not found
        return match.group(0)

    html_content = re.sub(pattern, replace_marker, html_content)

    print(f"✅ Updated {updated_count} JavaScript markers")
    return html_content, updated_count

def remove_null_marker(html_content):
    """Remove NULL marker from grid."""
    print("\n🗑️  Removing NULL marker...")

    # Pattern for NULL entry in grid
    pattern = r"markers\.addLayer\(L\.marker\(\[[0-9.]+,\s*[0-9.]+\]\)\s*\n\.bindPopup\('<b></b><br><br>.*?'\)\);\n"

    if re.search(pattern, html_content):
        html_content = re.sub(pattern, '', html_content)
        print("✅ NULL marker removed from grid")

    return html_content

def main():
    print("=" * 60)
    print("FIX ALL MARKERS - HTML & JAVASCRIPT")
    print("=" * 60)

    corrected_coords = load_corrected_coordinates()
    print(f"\n✅ Loaded {len(corrected_coords)} corrected coordinates")

    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Fix JavaScript markers
    html_content, js_count = fix_javascript_markers(html_content, corrected_coords)

    # Remove NULL marker
    html_content = remove_null_marker(html_content)

    # Write updated file
    print(f"\n💾 Writing updated HTML...")
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print("\n" + "=" * 60)
    print("✅ ALL MARKERS FIXED!")
    print("=" * 60)
    print(f"  - JavaScript markers updated: {js_count}")
    print("\n🎉 Both HTML grid AND JavaScript map now have correct coordinates!")

if __name__ == '__main__':
    main()
