#!/usr/bin/env python3
"""
Script to apply all SEO fixes to index.html:
1. Update coordinates for cities
2. Remove duplicate entries
3. Update schema.org markup
4. Add meta tags
5. Add ARIA labels
"""

import re
import json
from pathlib import Path

# File paths
HTML_FILE = '/home/proalloelectrici/public_html/index.html'
BACKUP_FILE = '/home/proalloelectrici/public_html/index.html.backup'
CORRECTED_COORDS_FILE = '/home/proalloelectrici/hugosource/seo-fixes/corrected_coords.json'
ENHANCED_SCHEMA_FILE = '/home/proalloelectrici/hugosource/seo-fixes/enhanced_schema.json'

def backup_html():
    """Create backup of original HTML file."""
    print("📋 Creating backup...")
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Backup created: {BACKUP_FILE}")

def load_corrected_coordinates():
    """Load the corrected coordinates from JSON."""
    with open(CORRECTED_COORDS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_enhanced_schema():
    """Load the enhanced schema markup."""
    with open(ENHANCED_SCHEMA_FILE, 'r', encoding='utf-8') as f:
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

        # Pattern to find this specific city marker with old coords
        # markers.addLayer(L.marker([48.8566, 2.3522]).bindPopup('<b>CITY</b><br>POSTAL...
        pattern = rf"(markers\.addLayer\(L\.marker\()\[48\.8566,\s*2\.3522\](\)\\s*\.bindPopup\('<b>{re.escape(city)}</b><br>{re.escape(postal)}<br>)"

        replacement = rf"\g<1>[{new_lat}, {new_lon}]\g<2>"

        # Replace first occurrence only (in case of duplicates)
        new_content = re.sub(pattern, replacement, html_content, count=1)

        if new_content != html_content:
            updated_count += 1
            html_content = new_content

    print(f"✅ Updated {updated_count} coordinates")
    return html_content

def remove_duplicate_cities(html_content):
    """Remove duplicate city entries (keep the one with correct coords)."""
    print("\n🗑️  Removing duplicate city entries...")

    # List of cities that appear twice - remove the one with duplicate coords [48.8566, 2.3522]
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
        # Pattern to find marker with DUPLICATE coords for this city
        pattern = rf"markers\.addLayer\(L\.marker\(\[48\.8566,\s*2\.3522\]\)\\s*\.bindPopup\('<b>{re.escape(city)}</b><br>{re.escape(postal)}<br>.*?'\)\);\n?"

        match = re.search(pattern, html_content)
        if match:
            html_content = html_content.replace(match.group(0), '', 1)
            removed_count += 1
            print(f"  ✅ Removed duplicate: {city} ({postal})")

    print(f"✅ Removed {removed_count} duplicate entries")
    return html_content

def remove_null_entry(html_content):
    """Remove the NULL city entry."""
    print("\n🗑️  Removing NULL entry...")

    # Pattern for empty/null city
    pattern = r"markers\.addLayer\(L\.marker\(\[.*?\]\)\\s*\.bindPopup\('<b></b><br>null?<br>.*?'\)\);\n?"

    html_content = re.sub(pattern, '', html_content)
    print("✅ NULL entry removed")
    return html_content

def update_schema(html_content, enhanced_schema):
    """Replace old schema with enhanced LocalBusiness schema."""
    print("\n📊 Updating Schema.org markup...")

    # Find existing schema JSON-LD block
    pattern = r'<script type=application/ld\+json>\{.*?"@type":"Organization".*?\}</script>'

    # Create new schema block (minified for production)
    new_schema = '<script type=application/ld+json>' + json.dumps(enhanced_schema, ensure_ascii=False, separators=(',', ':')) + '</script>'

    html_content = re.sub(pattern, new_schema, html_content, flags=re.DOTALL)
    print("✅ Schema updated to LocalBusiness with complete services")
    return html_content

def add_meta_tags(html_content):
    """Add additional meta tags for SEO and social media."""
    print("\n🏷️  Adding enhanced meta tags...")

    # Additional meta tags to insert after existing og/twitter tags
    additional_tags = '''<meta property="og:image" content="https://allo-electricien.pro/images/og-image.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Allo Électricien - 410 Électriciens d'Urgence Île-de-France"><meta name="twitter:image" content="https://allo-electricien.pro/images/twitter-card.jpg"><meta name="twitter:image:alt" content="Allo Électricien - Service d'urgence 24/7"><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"><meta name="googlebot" content="index, follow"><meta name="geo.region" content="FR-IDF"><meta name="geo.placename" content="Île-de-France"><meta name="geo.position" content="48.856614;2.3522219"><meta name="ICBM" content="48.856614, 2.3522219"><meta name="theme-color" content="#0066FF"><meta name="msapplication-TileColor" content="#0066FF">'''

    # Insert after the twitter:description tag
    pattern = r'(<meta name=twitter:description content="[^"]+">)'
    replacement = r'\1' + additional_tags

    html_content = re.sub(pattern, replacement, html_content)
    print("✅ Meta tags added")
    return html_content

def add_aria_labels(html_content):
    """Add ARIA labels for accessibility."""
    print("\n♿ Adding ARIA labels...")

    improvements = [
        # Navigation
        (r'<nav class="bg-white shadow-md sticky top-0 z-50">',
         '<nav class="bg-white shadow-md sticky top-0 z-50" role="navigation" aria-label="Main navigation">'),

        # Mobile menu button
        (r'<button id=mobile-menu-button class="text-gray-700',
         '<button id=mobile-menu-button aria-label="Toggle mobile menu" aria-expanded="false" aria-controls="mobile-menu" class="text-gray-700'),

        # Mobile menu
        (r'<div id=mobile-menu class="hidden md:hidden pb-4">',
         '<div id=mobile-menu class="hidden md:hidden pb-4" role="menu" aria-label="Mobile navigation menu">'),

        # Search input
        (r'<input type=text id=city-search placeholder="Rechercher une commune..."',
         '<input type=text id=city-search placeholder="Rechercher une commune..." aria-label="Rechercher une commune" role="searchbox"'),

        # Map
        (r'<div id=map class="h-96 md:h-\[600px\] rounded-lg shadow-lg">',
         '<div id=map class="h-96 md:h-[600px] rounded-lg shadow-lg" role="application" aria-label="Carte interactive des électriciens en Île-de-France">'),
    ]

    for pattern, replacement in improvements:
        html_content = re.sub(re.escape(pattern), replacement, html_content)

    print("✅ ARIA labels added")
    return html_content

def main():
    print("=" * 60)
    print("SEO FIXES APPLICATION SCRIPT")
    print("=" * 60)

    # Step 1: Backup
    backup_html()

    # Step 2: Load data
    print("\n📂 Loading data files...")
    corrected_coords = load_corrected_coordinates()
    enhanced_schema = load_enhanced_schema()
    print(f"✅ Loaded {len(corrected_coords)} corrected coordinates")
    print("✅ Loaded enhanced schema")

    # Step 3: Load HTML
    print(f"\n📖 Reading {HTML_FILE}...")
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        html_content = f.read()
    print(f"✅ Loaded {len(html_content)} characters")

    # Step 4: Apply fixes
    html_content = update_coordinates(html_content, corrected_coords)
    html_content = remove_duplicate_cities(html_content)
    html_content = remove_null_entry(html_content)
    html_content = update_schema(html_content, enhanced_schema)
    html_content = add_meta_tags(html_content)
    html_content = add_aria_labels(html_content)

    # Step 5: Write updated file
    print(f"\n💾 Writing updated HTML to {HTML_FILE}...")
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print("\n" + "=" * 60)
    print("✅ ALL SEO FIXES APPLIED SUCCESSFULLY!")
    print("=" * 60)
    print(f"\n📁 Backup saved at: {BACKUP_FILE}")
    print(f"📁 Updated file: {HTML_FILE}")
    print("\n🎉 Your homepage is now optimized!")

if __name__ == '__main__':
    main()
