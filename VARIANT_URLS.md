# Homepage Variant Testing URLs

## 🌐 Live Testing Links

All variants are now **LIVE** and ready for testing!

---

### Original Homepage
**URL:** https://allo-electricien.pro/

Your current homepage with enhanced features:
- ✅ Enhanced CSS (micro-interactions)
- ✅ Enhanced SEO (AggregateRating, FAQ, Review schemas)
- ✅ New data files (testimonials, FAQs)

---

### Variant 1 - "Urgency-First Inverted Pyramid"
**URL:** https://allo-electricien.pro/variant1/

**Strategy:** Immediate emergency call conversion

**Key Features:**
- ⚡ Compact hero (50% height) with emergency CTA above fold
- ⚡ Sticky bottom call bar (thumb-zone optimized)
- ⚡ Red emergency color scheme
- ⚡ Social proof carousel after hero
- ⚡ Condensed services with gradient cards
- ⚡ Stats bar with counter animations

**Best For:**
- Mobile emergency users
- High-intent traffic
- Time-sensitive situations
- Users needing immediate help

**File Size:** 448 KB

---

### Variant 2 - "Trust-Driven Funnel"
**URL:** https://allo-electricien.pro/variant2/

**Strategy:** Build credibility before conversion

**Key Features:**
- ⭐ Social proof hero (featured testimonial + 4.8/5 rating FIRST)
- ⭐ Certification badges section (4 trust badges)
- ⭐ Time-based personalized messaging
- ⭐ Detailed service descriptions with checklists
- ⭐ Blue professional color scheme
- ⭐ Multiple CTAs per service

**Best For:**
- Skeptical users needing reassurance
- Desktop/tablet traffic
- Planned services (non-emergency)
- Users researching electricians

**File Size:** 399 KB

---

### Variant 3 - "Smart Personalized Journey"
**URL:** https://allo-electricien.pro/variant3/

**Strategy:** Adaptive experience based on user context

**Key Features:**
- 🤖 **Geo-detection** - Detects your city via IP, shows "Électricien à [Your City]"
- 🤖 **Intent selector** - Choose "Emergency" or "Planned" service
- 🤖 **Dynamic content** - Shows nearest electricians for emergency users
- 🤖 **Adaptive CTAs** - Changes based on time of day and scroll depth
- 🤖 **Distance calculation** - Sorts electricians by proximity
- 🤖 **Time-aware greetings** - Different messages for morning/night/evening

**Best For:**
- Mixed-intent traffic (emergency + planned)
- Tech-savvy users
- Local SEO testing
- Geographic targeting
- Returning visitors (remembers intent)

**File Size:** 697 KB (larger due to geo-detection JavaScript)

---

## 🧪 Testing Checklist

### Mobile Testing (Priority)
- [ ] Test all 4 URLs on iPhone
- [ ] Test all 4 URLs on Android
- [ ] Check sticky CTA bar (bottom)
- [ ] Verify thumb-zone accessibility
- [ ] Test call button clicks
- [ ] Check testimonial carousel swipe

### Desktop Testing
- [ ] Test all 4 URLs on Chrome
- [ ] Test all 4 URLs on Safari/Firefox
- [ ] Check responsive breakpoints
- [ ] Verify all CTAs visible
- [ ] Test search functionality

### Time-Based Testing (Variant 2 & 3)
- [ ] Test during daytime (9 AM - 6 PM)
- [ ] Test during evening (6 PM - 10 PM)
- [ ] Test during night (10 PM - 6 AM)
- [ ] Verify time-based messaging changes

### Geo-Detection Testing (Variant 3)
- [ ] Test from different IP locations
- [ ] Verify city detection works
- [ ] Check "nearest electricians" sorting
- [ ] Test with VPN from different regions

### Intent Selector Testing (Variant 3)
- [ ] Click "Urgence Maintenant" button
- [ ] Verify emergency content appears
- [ ] Click "Planifier un Service" button
- [ ] Verify planned content appears
- [ ] Check sessionStorage persistence

---

## 📊 Metrics to Track

For each variant, monitor:

### Primary Metrics
1. **Phone call clicks** (tel: link clicks)
2. **Click-through rate** on CTAs
3. **Time to first CTA click**

### Secondary Metrics
4. Scroll depth
5. Bounce rate
6. Time on page
7. Mobile vs Desktop performance
8. Hour of day performance

### Variant-Specific
- **Variant 1:** Sticky bar effectiveness, mobile conversion
- **Variant 2:** Testimonial engagement, service CTA clicks
- **Variant 3:** Intent selector usage, geo-detection accuracy

---

## 🎯 Quick Comparison

| Feature | Original | Variant 1 | Variant 2 | Variant 3 |
|---------|----------|-----------|-----------|-----------|
| **Hero Style** | Full-height | Compact (50%) | Social proof | Geo-aware |
| **CTA Position** | Above fold | Above + sticky | After trust | Adaptive |
| **Color** | Blue | Red (urgent) | Blue (trust) | Blue (smart) |
| **Social Proof** | Badges only | After hero | Hero + section | Dynamic |
| **Personalization** | None | Time-aware | Time-aware | Time + Geo + Intent |
| **File Size** | 254 KB | 448 KB | 399 KB | 697 KB |

---

## 🚀 Next Steps

1. **Share URLs** with your team for feedback
2. **Run A/B test** (split traffic evenly across variants)
3. **Monitor analytics** for 2-4 weeks minimum
4. **Gather user feedback** via surveys or heatmaps
5. **Choose winner** based on phone call conversions
6. **Iterate** - Combine best elements from all variants

---

## 📱 Share These URLs

Copy/paste for easy sharing:

```
Original:  https://allo-electricien.pro/
Variant 1: https://allo-electricien.pro/variant1/
Variant 2: https://allo-electricien.pro/variant2/
Variant 3: https://allo-electricien.pro/variant3/
```

---

## 🔧 Making Changes

If you want to update a variant:

1. Edit the template: `layouts/index-variant[1|2|3].html`
2. Copy to index: `/bin/cp -f layouts/index-variant1.html layouts/index.html`
3. Build: `hugo --minify --quiet`
4. Deploy: `mkdir -p /home/proalloelectrici/public_html/variant1 && /bin/cp -f public/index.html /home/proalloelectrici/public_html/variant1/index.html`

Or see `DEPLOYMENT.md` for detailed commands.

---

**Deployed:** November 8, 2025, 04:34 UTC
**Status:** ✅ All variants LIVE
**Documentation:** See `HOMEPAGE_VARIANTS_GUIDE.md`

🤖 Generated with Claude Code
