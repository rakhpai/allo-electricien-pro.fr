# Homepage Variants Guide - Allo Électricien

## Overview

This document describes the 3 mobile-first, SEO/CRO-optimized homepage variants created for testing and optimization. Each variant uses the **exact same elements** from the original homepage but reorganizes them with different strategies to maximize emergency phone call conversions.

## 🎯 Common Goals

All variants are optimized for:
- **Primary Conversion Goal:** Emergency phone calls
- **Mobile-First Design:** 2025 UX/UI standards
- **SEO Optimization:** Enhanced structured data, FAQs, reviews
- **CRO Features:** Micro-interactions, thumb-zone CTAs, social proof

## 🔧 Implementation

### File Structure

```
hugosource/
├── layouts/
│   ├── index.html                          # Original homepage (unchanged)
│   ├── index-variant1.html                 # Variant 1: Urgency-First
│   ├── index-variant2.html                 # Variant 2: Trust-Driven
│   ├── index-variant3.html                 # Variant 3: Smart Personalized
│   └── partials/
│       ├── testimonials-carousel.html      # NEW: Testimonials carousel
│       ├── sticky-cta-bar.html             # NEW: Thumb-zone CTA bar
│       ├── intent-selector.html            # NEW: Intent selector (V3)
│       └── schema.html                     # ENHANCED: Rating/FAQ schema
├── data/
│   ├── testimonials.json                   # NEW: 6 customer reviews
│   └── faq.json                            # NEW: 10 SEO-optimized FAQs
└── static/
    └── css/
        └── custom.css                      # ENHANCED: Micro-interactions, thumb-zone

```

### How to Use Variants

Since you requested **separate template files**, you have several options to test the variants:

#### Option 1: Manual File Swap
Replace `layouts/index.html` with the desired variant:
```bash
# Test Variant 1
cp layouts/index-variant1.html layouts/index.html

# Test Variant 2
cp layouts/index-variant2.html layouts/index.html

# Test Variant 3
cp layouts/index-variant3.html layouts/index.html

# Restore original
git restore layouts/index.html
```

#### Option 2: Hugo Layout Configuration
Create different content files that call different layouts:
```bash
# In content/_index.md
---
layout: "variant1"  # or "variant2" or "variant3"
---
```

#### Option 3: Query Parameter Testing (Requires JavaScript)
Add to your site to allow testing via URL parameters:
```
yoursite.com/?variant=1
yoursite.com/?variant=2
yoursite.com/?variant=3
```

---

## 📊 Variant 1: "Urgency-First Inverted Pyramid"

### Strategy
**Immediate action for emergency users, depth for researchers**

Prioritizes conversion at the top of the page, with supporting information progressively disclosed as users scroll.

### Layout Order
1. **Compact Hero (50% height)**
   - Emergency phone CTA (prominent, red)
   - Urgency badge (24/7, pulsing animation)
   - Trust badges (compact version)

2. **Stats Bar**
   - 410 professionals, 9 departments, 24/7, <30min
   - Counter animations

3. **Social Proof (Testimonials Carousel)**
   - NEW: Swiper carousel with reviews
   - 4.8/5 star rating
   - Auto-play testimonials

4. **Services (Condensed Cards)**
   - Three service cards with gradient backgrounds
   - Expandable details
   - Quick CTAs

5. **Smart Search + Directory**
   - Geo-suggestion support
   - Department filters
   - Condensed city grid

6. **Map Section**
   - Interactive Leaflet map
   - Last position (lower priority)

7. **Sticky Thumb-Zone CTA Bar**
   - Always-visible call button (bottom)
   - Time-aware messaging
   - Dismissible for 5 minutes

### Key Features
- ⚡ **Emergency-first color scheme** (red accents)
- 📱 **Floating bottom CTA** (thumb-zone optimized)
- 🎨 **Micro-interactions:** Pulse, scale, slide animations
- 🎯 **Progressive disclosure:** More info as user scrolls

### Best For
- **High-intent emergency traffic**
- **Mobile users** (80%+ mobile traffic)
- **Time-sensitive situations**
- **Users who need immediate help**

### Conversion Tactics
- Emergency CTA above fold
- Persistent sticky call bar
- Social proof early (builds trust fast)
- Scarcity messaging ("Intervention <30 min")

---

## 🏆 Variant 2: "Trust-Driven Funnel"

### Strategy
**Build credibility first, convert skeptical users**

Leads with social proof and trust signals before asking for action. Perfect for users who need reassurance before committing.

### Layout Order
1. **Social Proof Hero**
   - Large featured testimonial
   - 4.8/5 star rating (prominent)
   - Animated star rating
   - Client testimonial card

2. **Stats Bar**
   - Same as Variant 1
   - Builds credibility

3. **Trust Badges / Certifications**
   - NEW: 4-grid certification section
   - NF C 15-100, RC Pro, Guarantee, Support
   - Fade-in animations

4. **Value Proposition + CTA**
   - Time-based personalized messaging
   - Large emergency CTA (red)
   - Secondary benefits listed

5. **Testimonials Carousel**
   - Full carousel with all 6 reviews
   - Social proof reinforcement

6. **Services (Detailed)**
   - Expanded service descriptions
   - Checklist features per service
   - Individual CTAs per service

7. **Directory Section**
   - Full search and filter
   - City cards

8. **Map Section**

9. **Sticky Thumb-Zone CTA Bar**
   - Appears after scroll
   - Time-aware messaging

### Key Features
- ⭐ **Social proof first approach**
- 🎓 **Certification badges** (credibility)
- ⏰ **Time-based personalization** (day/night messaging)
- 💎 **Premium feel** (blue gradient, professional)

### Best For
- **Skeptical users** who need reassurance
- **Desktop traffic** (though still mobile-optimized)
- **Planned services** (non-emergency)
- **Users researching electricians**

### Conversion Tactics
- Trust before action
- Time-based messaging ("Service nuit actif")
- Detailed service information
- Multiple conversion points (per service)

---

## 🤖 Variant 3: "Smart Personalized Journey"

### Strategy
**Adaptive experience based on user intent & context**

Uses geo-detection, time-awareness, and intent selection to create personalized user journeys.

### Layout Order
1. **Geo-Aware Hero**
   - IP-based city detection
   - Personalized headline: "Électricien à [Your City]"
   - Time-based greeting (☀️ morning, 🌙 night)
   - Dynamic subheadline based on time

2. **Stats Bar**
   - Same as other variants

3. **Intent Selector**
   - NEW: Two-button choice
   - "Urgence Maintenant" (Emergency)
   - "Planifier un Service" (Planned)
   - Stores selection in sessionStorage

4. **Dynamic Content Zone**
   - Changes based on intent selection:

   **If Emergency Selected:**
   - Nearest 6 electricians (geo-sorted)
   - Distance calculations
   - Urgent CTAs
   - Testimonials focused on emergency

   **If Planned Selected:**
   - Services section (detailed)
   - Full directory with search
   - Testimonials focused on quality

   **Default (No Selection):**
   - Standard services
   - Testimonials

5. **Map Section**
   - Shows user location marker (if detected)
   - Highlights nearest electricians

6. **Adaptive Sticky CTA Bar**
   - Changes text based on scroll depth
   - Time-aware messaging
   - Intent-aware CTAs

### Key Features
- 🌍 **Geo-detection** (IP-based, free API)
- ⏰ **Time-awareness** (night mode, morning, evening)
- 🎯 **Intent-based routing** (emergency vs planned)
- 📍 **Distance calculation** (nearest electricians)
- 🧠 **Progressive enhancement** (works without JS)
- 🎨 **Most advanced animations** (shimmer, geo-pulse)

### Best For
- **Mixed-intent traffic** (emergency + planned)
- **Tech-savvy users** (comfortable with interactive UX)
- **Returning visitors** (remembers intent)
- **Geographic targeting** (local SEO)

### Conversion Tactics
- Personalized experience reduces friction
- Geo-awareness builds local trust
- Intent selection qualifies leads
- Adaptive CTAs match user behavior
- Time-based urgency messaging

---

## 🎨 New Components

### 1. Testimonials Carousel
**File:** `layouts/partials/testimonials-carousel.html`

- Uses Swiper.js (already loaded)
- 6 French customer testimonials
- Responsive: 1 card mobile, 3 desktop
- Auto-play with pause on hover
- Star rating animations
- Location and service type tags

**Data:** `data/testimonials.json`

### 2. Sticky CTA Bar (Thumb-Zone)
**File:** `layouts/partials/sticky-cta-bar.html`

- Fixed bottom position (safe-area-inset support)
- Emergency badge with pulse animation
- Phone number with call icon
- Time-aware messaging
- Dismissible for 5 minutes (localStorage)
- Hides near footer (smart visibility)

### 3. Intent Selector
**File:** `layouts/partials/intent-selector.html`

- Two large touch-friendly buttons
- Emergency (red) / Planned (blue)
- Stores selection in sessionStorage
- Triggers content filtering
- Smooth scroll to relevant section
- Micro-interactions on selection

---

## 📈 SEO Enhancements

### Enhanced Structured Data
**File:** `layouts/partials/schema.html`

Added to homepage:
1. **AggregateRating schema**
   - 4.8/5 rating
   - 200 reviews
   - Shows stars in search results

2. **FAQPage schema**
   - 10 SEO-optimized questions
   - Expands search presence
   - Featured snippets potential

3. **Review schema**
   - First 3 testimonials as Review objects
   - Individual review snippets

4. **Service catalog**
   - Structured service offerings
   - Better service page indexing

### FAQ Data
**File:** `data/faq.json`

10 commonly asked questions:
- Intervention time
- Pricing transparency
- Availability (24/7, night, weekend)
- Certifications
- Types of issues handled
- Free quotes
- NF C 15-100 norme
- Coverage area
- City-specific electricians
- Payment methods

---

## 🎨 CSS Enhancements
**File:** `static/css/custom.css`

Added 430+ lines of modern CSS:

### Micro-Interactions
- Haptic-style button feedback (ripple effect)
- Elevation shadows (Material Design)
- Hover effects (scale, lift, magnetic)
- Skeleton loading states
- Pulse animations
- Shimmer effects

### Thumb-Zone Optimizations
- Safe area insets (iPhone X+)
- Large touch targets (min 44x44px)
- Bottom navigation patterns
- Floating action buttons

### Advanced Animations
- Fade in up
- Slide in from right
- Scale in
- Rotate in
- Stagger animations

### Accessibility
- Focus-visible (better than :focus)
- Prefers-reduced-motion support
- High contrast mode support
- ARIA-friendly

### 2025 Trends
- Glass morphism (frosted glass effect)
- Gradient text
- Card hover effects
- Backdrop blur

### Mobile Optimizations
- Prevent iOS zoom on input focus
- Improved tap highlight
- Smooth scroll on iOS
- Touch-optimized interactions

---

## 📱 Mobile-First Features

All variants include:

### 1. Safe Area Insets
- Supports iPhone notch/island
- Bottom safe area for home indicator
- `env(safe-area-inset-bottom)` throughout

### 2. Thumb-Zone Design
- Primary CTAs within easy reach
- Bottom-anchored actions
- Large touch targets (min 44px)

### 3. Progressive Enhancement
- Works without JavaScript
- Enhanced with JS features
- Graceful degradation

### 4. Performance
- Lazy loading images
- Optimized animations (GPU-accelerated)
- Reduced motion support

---

## 🧪 Testing Recommendations

### A/B Testing Setup

1. **Traffic Split:**
   - Variant 1: 33% (Urgency-First)
   - Variant 2: 33% (Trust-Driven)
   - Variant 3: 34% (Personalized)

2. **Success Metrics:**
   - Primary: Phone call clicks
   - Secondary: Time to first CTA click
   - Tertiary: Scroll depth, bounce rate

3. **Segment Analysis:**
   - Device type (mobile vs desktop)
   - Time of day (emergency hours vs business hours)
   - Traffic source (organic, direct, referral)
   - New vs returning visitors

### Testing Duration
- **Minimum:** 2 weeks
- **Ideal:** 4 weeks (account for weekly patterns)
- **Sample size:** 10,000+ visitors per variant

### What to Measure

**Variant 1 (Urgency-First):**
- Immediate CTA clicks
- Sticky bar effectiveness
- Mobile conversion rate
- Time to conversion

**Variant 2 (Trust-Driven):**
- Testimonial engagement
- Service CTA clicks
- Desktop conversion rate
- Lower bounce rate

**Variant 3 (Personalized):**
- Intent selector usage rate
- Geo-detection accuracy
- Content path differences
- Returning visitor preference

---

## 🔧 Customization Guide

### Changing Colors

**Variant 1 (Red Emergency):**
```css
/* Change emergency color */
.bg-emergency { background-color: #YOUR_COLOR; }
```

**Variant 2 (Blue Trust):**
```css
/* Change primary blue */
.bg-primary { background-color: #YOUR_COLOR; }
```

### Adding More Testimonials

Edit `data/testimonials.json`:
```json
{
  "id": 7,
  "name": "Client Name",
  "city": "City",
  "rating": 5,
  "date": "2025-01-20",
  "text": "Review text...",
  "service": "Service Type"
}
```

### Modifying FAQs

Edit `data/faq.json`:
```json
{
  "question": "Your question?",
  "answer": "Your detailed answer with keywords."
}
```

### Adjusting Sticky Bar Behavior

Edit `layouts/partials/sticky-cta-bar.html`:
```javascript
// Change auto-show delay (default: 3000ms)
setTimeout(() => {
  if (ctaBar) ctaBar.classList.add('visible');
}, 5000); // Change to 5 seconds

// Change dismiss duration (default: 5 minutes)
localStorage.setItem('ctaBarDismissed', Date.now() + (10 * 60 * 1000)); // 10 minutes
```

---

## 📊 Performance Checklist

All variants are optimized for:

- ✅ Core Web Vitals (LCP, FID, CLS)
- ✅ Mobile-first indexing
- ✅ Lazy loading images
- ✅ Minified CSS/JS
- ✅ Compressed images (AVIF, WebP)
- ✅ Structured data validation
- ✅ ARIA accessibility
- ✅ Touch-friendly (44px+ targets)
- ✅ Keyboard navigation
- ✅ Screen reader support

---

## 🚀 Next Steps

1. **Choose a Testing Method:**
   - Manual file swap for quick testing
   - A/B testing platform integration
   - Hugo content layout selection

2. **Set Up Analytics:**
   - Track CTA clicks (phone, sticky bar, services)
   - Monitor scroll depth
   - Measure conversion funnel

3. **Gather Feedback:**
   - User testing (5-10 users per variant)
   - Heatmap analysis (Hotjar, Crazy Egg)
   - Session recordings

4. **Iterate:**
   - Combine best elements from all 3
   - Create hybrid version
   - Test refined variant

---

## 📞 Support

If you need to modify or extend these variants:

1. All components are modular and reusable
2. CSS classes follow consistent naming
3. JavaScript is documented inline
4. Hugo templates use standard syntax
5. Data files are JSON (easy to edit)

---

## 🎯 Quick Reference

| Variant | Best For | Key Strength | Conversion Focus |
|---------|----------|--------------|------------------|
| **1. Urgency-First** | Mobile emergency users | Immediate action | Phone calls above fold |
| **2. Trust-Driven** | Skeptical researchers | Credibility first | Service selection |
| **3. Personalized** | Mixed intent traffic | Adaptive UX | Intent-based routing |

---

## 📝 Change Log

**2025-01-08:**
- Created 3 homepage variants
- Added testimonials carousel component
- Added sticky CTA bar component
- Added intent selector component
- Enhanced CSS with micro-interactions
- Enhanced schema with ratings/FAQ
- Created comprehensive documentation

---

**Generated with Claude Code** 🤖
Mobile-First 2025 UX/UI Standards
