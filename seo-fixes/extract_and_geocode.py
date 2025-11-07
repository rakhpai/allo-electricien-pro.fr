#!/usr/bin/env python3
"""
Script to extract cities from index.html, identify incorrect coordinates,
and geocode them to get correct locations.
"""

import re
import json
import time
import urllib.request
import urllib.parse
from typing import Dict, List, Tuple

# The duplicate/incorrect coordinates
DUPLICATE_COORDS = [48.8566, 2.3522]
DUPLICATE_PATTERN = r'\[48\.8566, 2\.3522\]'

def extract_markers_from_html(html_file: str) -> List[Dict]:
    """Extract all marker data from HTML file."""
    markers = []

    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to match marker entries
    # markers.addLayer(L.marker([lat, lon]).bindPopup('<b>CITY</b><br>POSTAL<br><a href=URL...
    pattern = r"markers\.addLayer\(L\.marker\(\[([0-9.]+),\s*([0-9.]+)\]\)\s*\.bindPopup\('<b>([^<]*)</b><br>([^<]*)<br><a href=([^']*)"

    matches = re.findall(pattern, content)

    for match in matches:
        lat, lon, city, postal, url = match
        markers.append({
            'lat': float(lat),
            'lon': float(lon),
            'city': city.strip(),
            'postal': postal.strip(),
            'url': url,
            'is_duplicate': (abs(float(lat) - DUPLICATE_COORDS[0]) < 0.0001 and
                           abs(float(lon) - DUPLICATE_COORDS[1]) < 0.0001)
        })

    return markers

def geocode_city(city: str, postal: str) -> Tuple[float, float]:
    """
    Geocode a city using Nominatim (OpenStreetMap).
    Returns (latitude, longitude) or None if not found.
    """
    # Nominatim requires a User-Agent
    headers = {'User-Agent': 'AlloElectricien-SEO-Fix/1.0'}

    # Build query
    query = f"{city}, {postal}, France"
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1&countrycodes=fr"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())

            if data and len(data) > 0:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                return (lat, lon)
            else:
                print(f"  ⚠️  No results for {city} ({postal})")
                return None
    except Exception as e:
        print(f"  ❌ Error geocoding {city}: {e}")
        return None

def main():
    print("🔍 Extracting markers from index.html...")

    markers = extract_markers_from_html('/home/proalloelectrici/public_html/index.html')

    print(f"\n📊 Found {len(markers)} total markers")

    # Count duplicates
    duplicates = [m for m in markers if m['is_duplicate']]
    print(f"❌ {len(duplicates)} markers with duplicate coordinates")
    print(f"✅ {len(markers) - len(duplicates)} markers with correct coordinates")

    # Find truly duplicate cities (same name and postal appearing twice)
    city_counts = {}
    for m in markers:
        key = f"{m['city']}_{m['postal']}"
        city_counts[key] = city_counts.get(key, 0) + 1

    true_duplicates = {k: v for k, v in city_counts.items() if v > 1}
    print(f"\n🔄 {len(true_duplicates)} cities appearing multiple times:")
    for city_key, count in sorted(true_duplicates.items()):
        print(f"  - {city_key.replace('_', ' ')}: {count}x")

    # Geocode cities with incorrect coordinates
    print(f"\n🌍 Geocoding {len(duplicates)} cities with incorrect coordinates...")
    print("(This may take a while due to rate limiting - 1 request per second)")

    corrected = []
    failed = []

    for i, marker in enumerate(duplicates, 1):
        city = marker['city']
        postal = marker['postal']

        # Skip empty entries
        if not city or not postal or postal == 'null':
            print(f"{i}/{len(duplicates)}: Skipping NULL/empty entry")
            failed.append(marker)
            continue

        print(f"{i}/{len(duplicates)}: Geocoding {city} ({postal})...", end=' ')

        coords = geocode_city(city, postal)

        if coords:
            marker['new_lat'] = coords[0]
            marker['new_lon'] = coords[1]
            corrected.append(marker)
            print(f"✅ [{coords[0]:.6f}, {coords[1]:.6f}]")
        else:
            failed.append(marker)

        # Rate limiting - Nominatim requires max 1 request per second
        if i < len(duplicates):
            time.sleep(1.1)

    # Save results
    print(f"\n💾 Saving results...")

    # Save all corrected coordinates
    with open('/home/proalloelectrici/hugosource/seo-fixes/corrected_coords.json', 'w', encoding='utf-8') as f:
        json.dump(corrected, f, indent=2, ensure_ascii=False)

    # Save failed ones
    if failed:
        with open('/home/proalloelectrici/hugosource/seo-fixes/failed_geocode.json', 'w', encoding='utf-8') as f:
            json.dump(failed, f, indent=2, ensure_ascii=False)

    # Save summary
    summary = {
        'total_markers': len(markers),
        'duplicate_coords': len(duplicates),
        'successfully_geocoded': len(corrected),
        'failed_geocode': len(failed),
        'true_duplicate_cities': len(true_duplicates)
    }

    with open('/home/proalloelectrici/hugosource/seo-fixes/summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print(f"\n✅ Results saved:")
    print(f"  - corrected_coords.json: {len(corrected)} cities with new coordinates")
    print(f"  - failed_geocode.json: {len(failed)} cities that failed")
    print(f"  - summary.json: Statistics")

    print(f"\n📈 Summary:")
    print(f"  ✅ Successfully geocoded: {len(corrected)}")
    print(f"  ❌ Failed to geocode: {len(failed)}")
    print(f"  🔄 Duplicate cities to remove: {len(true_duplicates)}")

if __name__ == '__main__':
    main()
