#!/usr/bin/env python3
"""
Validation script to verify all SEO fixes were applied correctly.
"""

import re
import json

HTML_FILE = '/home/proalloelectrici/public_html/index.html'

def validate_html():
    print("=" * 60)
    print("SEO FIXES VALIDATION")
    print("=" * 60)

    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    issues = []
    successes = []

    # 1. Check for duplicate coordinates
    print("\n1. Checking for duplicate coordinates [48.8566, 2.3522]...")
    duplicate_coords = re.findall(r'\[48\.8566, 2\.3522\]', content)
    if len(duplicate_coords) > 0:
        issues.append(f"❌ Found {len(duplicate_coords)} markers still using duplicate coordinates")
    else:
        successes.append("✅ No duplicate coordinates found")

    # 2. Check for NULL entries
    print("2. Checking for NULL entries...")
    null_entries = re.findall(r"<b></b><br>null?<br>", content)
    if len(null_entries) > 0:
        issues.append(f"❌ Found {len(null_entries)} NULL entries")
    else:
        successes.append("✅ No NULL entries found")

    # 3. Check schema type
    print("3. Checking Schema.org type...")
    if '"@type":"LocalBusiness"' in content or '"@type": "LocalBusiness"' in content:
        successes.append("✅ Schema.org uses LocalBusiness type")
    else:
        issues.append("❌ Schema.org not using LocalBusiness type")

    # 4. Check for social media images
    print("4. Checking social media images...")
    has_og_image = 'og:image' in content and 'og-image.jpg' in content
    has_twitter_image = 'twitter:image' in content
    if has_og_image and has_twitter_image:
        successes.append("✅ Social media images added")
    else:
        if not has_og_image:
            issues.append("❌ Missing og:image")
        if not has_twitter_image:
            issues.append("❌ Missing twitter:image")

    # 5. Check for geo meta tags
    print("5. Checking geo meta tags...")
    if 'geo.region' in content:
        successes.append("✅ Geo meta tags added")
    else:
        issues.append("❌ Missing geo meta tags")

    # 6. Check for ARIA labels
    print("6. Checking ARIA labels...")
    aria_checks = [
        ('aria-label="Main navigation"', 'Main navigation'),
        ('aria-label="Toggle mobile menu"', 'Mobile menu button'),
        ('aria-label="Rechercher une commune"', 'Search input'),
        ('aria-label="Carte interactive', 'Map'),
    ]

    aria_count = 0
    for pattern, name in aria_checks:
        if pattern in content:
            aria_count += 1

    if aria_count == len(aria_checks):
        successes.append(f"✅ All {len(aria_checks)} ARIA labels added")
    else:
        issues.append(f"❌ Only {aria_count}/{len(aria_checks)} ARIA labels found")

    # 7. Count total markers
    print("7. Counting total markers...")
    markers = re.findall(r'markers\.addLayer\(L\.marker\(', content)
    total_markers = len(markers)
    successes.append(f"📊 Total markers: {total_markers}")

    # 8. Check for common city coordinates (sample check)
    print("8. Spot-checking coordinates...")
    sample_cities = [
        ('ARGENTEUIL', '95100', r'\[48\.785641, 2\.5483998\]'),
        ('BEAUVAIS', '60155', r'\[48\.6099887, 2\.3075288\]'),
        ('ABLON-SUR-SEINE', '94480', r'\[48\.8534951, 2\.3483915\]'),
    ]

    for city, postal, coords_pattern in sample_cities:
        pattern = rf'{coords_pattern}.*?<b>{city}</b><br>{postal}'
        if re.search(pattern, content, re.DOTALL):
            successes.append(f"✅ {city} has correct coordinates")
        else:
            issues.append(f"❌ {city} coordinates may be incorrect")

    # Print results
    print("\n" + "=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)

    print("\n✅ SUCCESSES:")
    for success in successes:
        print(f"  {success}")

    if issues:
        print("\n❌ ISSUES FOUND:")
        for issue in issues:
            print(f"  {issue}")
        print(f"\n⚠️  {len(issues)} issue(s) need attention")
        return False
    else:
        print("\n🎉 ALL VALIDATIONS PASSED!")
        return True

if __name__ == '__main__':
    validate_html()
