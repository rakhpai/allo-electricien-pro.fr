#!/usr/bin/env python3
"""
Generate HTML city cards from corrected_coords.json
Replaces the broken JavaScript display with proper HTML cards
"""

import json
import re

CORRECTED_COORDS_FILE = '/home/proalloelectrici/hugosource/seo-fixes/corrected_coords.json'
HTML_FILE = '/home/proalloelectrici/public_html/index.html'

def slugify(city_name):
    """Convert city name to URL slug format."""
    # Convert to lowercase
    slug = city_name.lower()

    # Replace spaces and special chars with hyphens
    slug = slug.replace("'", "-")
    slug = slug.replace(" ", "-")

    # Remove any duplicate hyphens
    slug = re.sub(r'-+', '-', slug)

    return slug

def get_department_code(postal_code):
    """Extract department code from postal code."""
    # For French postal codes, department is first 2 digits
    # Exception: Corsica (2A, 2B) but not in our dataset
    return postal_code[:2]

def generate_city_card_html(city_data):
    """Generate HTML for a single city card."""
    city = city_data['city']
    postal = city_data['postal']
    dept = get_department_code(postal)

    # Create URL slug (lowercase, replace apostrophes and spaces with hyphens)
    city_slug = slugify(city)

    html = f'''  <div class="city-card bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition" data-city="{city}" data-zip="{postal}" data-dept="{dept}">
    <h3 class="text-xl font-bold text-gray-900 mb-2">{city}</h3>
    <p class="text-gray-600 mb-4">{postal}</p>
    <a href="https://allo-electricien.pro/{city_slug}/" class="text-primary font-semibold hover:underline">Voir l'électricien →</a>
  </div>'''

    return html

def extract_cities_from_html(html_content):
    """Extract all city data from current HTML markers."""
    print("\n📖 Extracting city data from current HTML...")

    # Pattern to match: markers.addLayer(L.marker([lat, lon])
    # .bindPopup('<b>CITY</b><br>POSTAL<br><a href=...
    pattern = r"markers\.addLayer\(L\.marker\(\[([0-9.]+), ([0-9.]+)\]\)\s*\n\.bindPopup\('<b>([^<]+)</b><br>([^<]+)<br>"

    matches = re.findall(pattern, html_content)

    city_data = []
    for lat, lon, city, postal in matches:
        city_data.append({
            'city': city,
            'postal': postal,
            'lat': float(lat),
            'lon': float(lon)
        })

    print(f"✅ Extracted {len(city_data)} cities from HTML")

    return city_data

def load_city_data(html_content):
    """Load and sort city data from current HTML."""
    print("=" * 60)
    print("GENERATING HTML CITY CARDS")
    print("=" * 60)

    # Extract cities from current HTML (includes ALL 404 cities)
    city_data = extract_cities_from_html(html_content)

    # Sort alphabetically by city name for better UX
    city_data_sorted = sorted(city_data, key=lambda x: x['city'])

    print(f"✅ Sorted {len(city_data_sorted)} cities alphabetically")

    return city_data_sorted

def generate_all_cards(city_data):
    """Generate HTML for all city cards."""
    print("\n🏗️  Generating HTML cards...")

    cards_html = []

    for idx, city in enumerate(city_data, 1):
        card_html = generate_city_card_html(city)
        cards_html.append(card_html)

        if idx % 100 == 0:
            print(f"  Progress: {idx}/{len(city_data)}")

    # Join all cards with newlines
    all_cards = '\n'.join(cards_html)

    print(f"\n✅ Generated {len(cards_html)} HTML city cards")
    print(f"📊 Total HTML size: {len(all_cards):,} characters")

    return all_cards

def replace_cities_grid_content(html_content, new_cards_html):
    """Replace the broken JavaScript content with HTML city cards."""
    print("\n🔧 Replacing cities-grid content...")

    # Find the opening div tag
    opening_pattern = r'<div id=cities-grid class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">'

    # The file ends with: .bindPopup(...'));
    # followed immediately by: <a href=/politique-confidentialite/
    # We need to replace everything between the opening tag and the footer link
    footer_pattern = r'<a href=/politique-confidentialite/'

    # Check if patterns exist
    if not re.search(opening_pattern, html_content):
        print("❌ ERROR: Could not find cities-grid opening tag!")
        return None

    if not re.search(footer_pattern, html_content):
        print("❌ ERROR: Could not find footer link!")
        return None

    # Find positions
    opening_match = re.search(opening_pattern, html_content)
    footer_match = re.search(footer_pattern, html_content)

    start_pos = opening_match.end()  # After opening tag
    end_pos = footer_match.start()  # Before footer link

    print(f"  Found cities-grid section: characters {start_pos} to {end_pos}")
    print(f"  Removing: {end_pos - start_pos:,} characters of broken JavaScript")

    # Replace content - add proper closing </div> for cities-grid
    new_html = (
        html_content[:start_pos] +
        '\n' + new_cards_html + '\n</div>\n' +  # Add closing div
        html_content[end_pos:]
    )

    print(f"✅ Replaced cities-grid content")
    print(f"  New content size: {len(new_cards_html):,} characters")
    print(f"  Added proper closing </div> tag")

    return new_html

def main():
    # Read current HTML file first
    print(f"\n📖 Reading {HTML_FILE}...")
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()

    original_size = len(html_content)
    print(f"✅ Loaded {original_size:,} characters")

    # Load city data from HTML
    city_data = load_city_data(html_content)

    # Generate HTML cards
    cards_html = generate_all_cards(city_data)

    # Replace content
    new_html = replace_cities_grid_content(html_content, cards_html)

    if new_html is None:
        print("\n❌ Failed to replace content - check error messages above")
        return False

    # Create backup
    backup_file = HTML_FILE + '.before_cards_fix'
    print(f"\n💾 Creating backup: {backup_file}")
    with open(backup_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("✅ Backup created")

    # Write updated HTML
    print(f"\n💾 Writing updated HTML to {HTML_FILE}...")
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(new_html)

    new_size = len(new_html)
    size_diff = new_size - original_size
    size_change = "increased" if size_diff > 0 else "decreased"

    print("✅ File updated successfully!")
    print(f"  Original size: {original_size:,} characters")
    print(f"  New size: {new_size:,} characters")
    print(f"  Change: {size_change} by {abs(size_diff):,} characters")

    print("\n" + "=" * 60)
    print("✅ CITY CARDS GENERATION COMPLETE!")
    print("=" * 60)
    print(f"  - Generated {len(city_data)} HTML city cards")
    print(f"  - Replaced broken JavaScript display")
    print(f"  - Backup saved: {backup_file}")
    print("\n🎉 The cities-grid now displays proper HTML cards!")

    return True

if __name__ == '__main__':
    try:
        success = main()
        if not success:
            exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
