# Service Pages UX/UI Enhancement Plan
**Status:** Ready for Implementation
**Created:** 2025-11-10
**Scope:** All service pages site-wide
**Approach:** Hugo Shortcodes (Most Maintainable)

---

## Executive Summary

### Problem Statement
Service pages (e.g., `/services/mise-aux-normes-paris/`) display markdown content as plain, unstyled text creating a "wall of text" problem. The content lacks visual hierarchy, card-based layouts, and interactive elements despite having excellent Tailwind utilities available.

### Solution
Implement reusable Hugo shortcodes to transform plain markdown sections into:
- Feature card grids (for requirements, benefits)
- Step-by-step process timelines
- Modern pricing cards with CTAs
- Interactive FAQ accordions
- Colored callout boxes

### User Decisions (Confirmed)
✅ **Approach:** Hugo Shortcodes (Most Maintainable)
✅ **Priority Enhancements:** All 4 selected
  - Card-based requirement lists
  - Step-by-step process cards
  - Enhanced pricing tables
  - FAQ accordion/collapsible

✅ **Scope:** All service pages site-wide

---

## Current State Analysis

### Template Architecture
- **Base:** `/layouts/_default/baseof.html`
- **Single:** `/layouts/_default/single.html`
- **Content:** `/content/services/*/index.md`

### Key Finding
The template renders `{{ .Content }}` as plain HTML without card wrappers or Tailwind classes. Hardcoded sections in `single.html` look beautiful, but markdown content is unstyled.

### Available Resources
- ✅ Tailwind CSS (CDN-based) with custom colors
- ✅ Custom CSS utilities in `/static/css/custom.css`
  - Glass morphism (`.glass`, `.glass-dark`)
  - Elevation shadows (`.elevation-1` to `.elevation-4`)
  - Animations (`.fade-in-up`, `.slide-in-right`, `.scale-in`)
  - Card hover effects (`.card-hover`)
- ✅ Inter font (Google Fonts)
- ✅ Existing card patterns in template

### Service Pages to Update (Estimated 15-20)
Primary targets identified:
1. `/content/services/mise-aux-normes-paris/index.md` (PILOT - 324 lines)
2. `/content/services/installation-electrique-paris/index.md` (291 lines)
3. `/content/services/renovation-electrique-paris/index.md`
4. `/content/services/depannage-electrique-paris/index.md`
5. `/content/services/tableau-electrique-paris/index.md`
6. Other location-specific variants

---

## Implementation Plan

### PHASE 1: Create Hugo Shortcode Components
**Location:** `/layouts/shortcodes/`
**Estimated Time:** 2-3 hours

#### 1.1 Feature Grid Container (`feature-grid.html`)
**Purpose:** Wrapper for feature card grids
**Usage:**
```markdown
{{< feature-grid columns="2" >}}
  {{< feature-card icon="shield" title="Protection" >}}
  Content here...
  {{< /feature-card >}}
  {{< feature-card icon="check" title="Compliance" >}}
  Content here...
  {{< /feature-card >}}
{{< /feature-grid >}}
```

**Props:**
- `columns` (default: "2") - Grid columns: "1", "2", "3", "4"
- `gap` (default: "4") - Tailwind gap size

**HTML Output:**
```html
<div class="grid grid-cols-1 md:grid-cols-{{ .Get "columns" }} gap-{{ .Get "gap" }} mb-8">
  {{ .Inner }}
</div>
```

#### 1.2 Feature Card (`feature-card.html`)
**Purpose:** Individual card with icon, title, content
**Usage:**
```markdown
{{< feature-card icon="lightning" title="Intervention Rapide" color="blue" >}}
- Disponible 24h/24 et 7j/7
- Temps de réponse sous 30 minutes
- Électriciens certifiés
{{< /feature-card >}}
```

**Props:**
- `icon` - Icon identifier (see icon mapping below)
- `title` - Card heading
- `color` (default: "primary") - Theme: "blue", "green", "yellow", "red"
- `hoverable` (default: "true") - Enable hover lift effect

**HTML Output:**
```html
<div class="bg-white rounded-lg shadow-lg p-6 transition-all duration-300 hover:shadow-xl hover:scale-105">
  <div class="flex items-start gap-4">
    <div class="flex-shrink-0">
      <svg class="w-8 h-8 text-{{ color }}-600"><!-- Icon SVG --></svg>
    </div>
    <div class="flex-1">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">{{ .Get "title" }}</h3>
      <div class="text-gray-700 prose prose-sm">
        {{ .Inner | markdownify }}
      </div>
    </div>
  </div>
</div>
```

**Icon Mapping:**
- `shield` → Protection shield SVG
- `check` → Checkmark circle
- `lightning` → Lightning bolt (emergency)
- `wrench` → Tool/service
- `document` → Document/certification
- `clock` → Time/urgency
- `home` → Building/residential
- `euro` → Pricing
- `question` → FAQ/help

#### 1.3 Step Process Container (`step-process.html`)
**Purpose:** Sequential step timeline
**Usage:**
```markdown
{{< step-process >}}
  {{< step number="1" title="Diagnostic Initial" >}}
  Notre électricien certifié se déplace...
  {{< /step >}}
  {{< step number="2" title="Devis Détaillé" >}}
  Établissement d'un devis...
  {{< /step >}}
{{< /step-process >}}
```

**HTML Output:**
```html
<div class="relative mb-8">
  <!-- Progress line background -->
  <div class="absolute top-8 left-8 w-1 h-full bg-gray-200 hidden md:block"></div>

  <div class="space-y-6">
    {{ .Inner }}
  </div>
</div>
```

#### 1.4 Step Item (`step.html`)
**Props:**
- `number` - Step number (1, 2, 3, 4)
- `title` - Step heading
- `icon` (optional) - Override default number with icon

**HTML Output:**
```html
<div class="relative flex items-start gap-4 bg-white rounded-lg shadow-lg p-6">
  <!-- Step number badge -->
  <div class="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg z-10">
    {{ .Get "number" }}
  </div>

  <div class="flex-1 pt-2">
    <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ .Get "title" }}</h3>
    <div class="text-gray-700 prose">
      {{ .Inner | markdownify }}
    </div>
  </div>
</div>
```

#### 1.5 Pricing Table Container (`pricing-table.html`)
**Purpose:** Modern pricing card grid
**Usage:**
```markdown
{{< pricing-table >}}
  {{< pricing-card tier="Studio/T1" price="590" featured="false" >}}
  - Diagnostic complet
  - Mise en conformité
  - Attestation Consuel
  {{< /pricing-card >}}

  {{< pricing-card tier="T2/T3" price="790" featured="true" >}}
  - Diagnostic complet
  - Mise en conformité
  - Attestation Consuel
  - Garantie 2 ans
  {{< /pricing-card >}}
{{< /pricing-table >}}
```

**HTML Output:**
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
  {{ .Inner }}
</div>
```

#### 1.6 Pricing Card (`pricing-card.html`)
**Props:**
- `tier` - Tier name/label
- `price` - Price amount (number only)
- `currency` (default: "€") - Currency symbol
- `period` (default: "intervention") - Pricing period
- `featured` (default: "false") - Highlight this tier
- `cta` (default: "Demander un devis") - CTA button text

**HTML Output:**
```html
<div class="bg-white rounded-xl shadow-lg overflow-hidden {{ if eq (.Get "featured") "true" }}ring-2 ring-blue-500 transform scale-105{{ end }}">
  <!-- Header with gradient -->
  <div class="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white">
    {{ if eq (.Get "featured") "true" }}
    <span class="inline-block bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full mb-2">
      RECOMMANDÉ
    </span>
    {{ end }}
    <h3 class="text-2xl font-bold mb-1">{{ .Get "tier" }}</h3>
    <div class="flex items-baseline gap-1">
      <span class="text-4xl font-bold">{{ .Get "price" }}</span>
      <span class="text-xl">{{ .Get "currency" }}</span>
    </div>
    <p class="text-blue-100 text-sm">par {{ .Get "period" }}</p>
  </div>

  <!-- Features list -->
  <div class="p-6">
    <div class="prose prose-sm text-gray-700 mb-6">
      {{ .Inner | markdownify }}
    </div>

    <!-- CTA Button -->
    <a href="tel:0187390013" class="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors duration-200">
      {{ .Get "cta" }}
    </a>
  </div>
</div>
```

#### 1.7 FAQ Accordion Container (`faq-accordion.html`)
**Purpose:** Collapsible FAQ section with Alpine.js
**Usage:**
```markdown
{{< faq-accordion >}}
  {{< faq question="Combien coûte une mise aux normes électrique à Paris ?" >}}
  Le coût dépend de la surface...
  {{< /faq >}}

  {{< faq question="Combien de temps dure l'intervention ?" >}}
  Pour un studio, comptez 1 à 2 jours...
  {{< /faq >}}
{{< /faq-accordion >}}
```

**HTML Output:**
```html
<div class="space-y-4 mb-8" x-data="{ openFaq: null }">
  {{ .Inner }}
</div>
```

#### 1.8 FAQ Item (`faq.html`)
**Props:**
- `question` - Question text
- `id` (auto-generated) - Unique identifier

**HTML Output:**
```html
{{ $id := printf "faq-%d" (add 1 (index (split $.Inner "") | len)) }}
<div class="bg-white rounded-lg shadow-md overflow-hidden">
  <!-- Question button -->
  <button
    @click="openFaq = (openFaq === '{{ $id }}' ? null : '{{ $id }}')"
    class="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
  >
    <h3 class="text-lg font-semibold text-gray-900 pr-4">
      {{ .Get "question" }}
    </h3>
    <svg
      class="w-6 h-6 text-blue-600 transform transition-transform duration-200"
      :class="{ 'rotate-180': openFaq === '{{ $id }}' }"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <!-- Answer content -->
  <div
    x-show="openFaq === '{{ $id }}'"
    x-transition:enter="transition ease-out duration-200"
    x-transition:enter-start="opacity-0 transform -translate-y-2"
    x-transition:enter-end="opacity-100 transform translate-y-0"
    x-transition:leave="transition ease-in duration-150"
    x-transition:leave-start="opacity-100 transform translate-y-0"
    x-transition:leave-end="opacity-0 transform -translate-y-2"
    class="px-6 pb-6"
    style="display: none;"
  >
    <div class="prose prose-sm text-gray-700 border-t border-gray-100 pt-4">
      {{ .Inner | markdownify }}
    </div>
  </div>
</div>
```

#### 1.9 Callout Box (`callout.html`)
**Purpose:** Highlighted info/warning/success boxes
**Usage:**
```markdown
{{< callout type="warning" title="Attention" >}}
Depuis 2015, tout bailleur doit fournir un diagnostic électrique...
{{< /callout >}}

{{< callout type="info" title="Bon à savoir" >}}
La norme NF C 15-100 est régulièrement mise à jour...
{{< /callout >}}
```

**Props:**
- `type` - "info" (blue), "warning" (yellow), "success" (green), "danger" (red)
- `title` - Callout heading
- `icon` (auto) - Auto-selected based on type

**HTML Output:**
```html
{{ $colors := dict "info" "blue" "warning" "yellow" "success" "green" "danger" "red" }}
{{ $color := index $colors (.Get "type") }}

<div class="bg-{{ $color }}-50 border-l-4 border-{{ $color }}-500 rounded-lg p-6 mb-6">
  <div class="flex items-start gap-3">
    <svg class="w-6 h-6 text-{{ $color }}-600 flex-shrink-0 mt-0.5">
      <!-- Icon based on type -->
    </svg>
    <div class="flex-1">
      {{ with .Get "title" }}
      <h4 class="text-lg font-semibold text-{{ $color }}-900 mb-2">{{ . }}</h4>
      {{ end }}
      <div class="prose prose-sm text-{{ $color }}-800">
        {{ .Inner | markdownify }}
      </div>
    </div>
  </div>
</div>
```

---

### PHASE 2: Update Template for Alpine.js
**Location:** `/layouts/_default/baseof.html`
**Estimated Time:** 15 minutes

Add Alpine.js CDN before closing `</head>` tag:
```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
```

Check if Alpine.js is already present - if so, skip this step.

---

### PHASE 3: Convert Pilot Page (Mise aux Normes Paris)
**Location:** `/content/services/mise-aux-normes-paris/index.md`
**Estimated Time:** 1 hour

#### Current Structure → Shortcode Conversion Map

**Section 1: Les 7 Exigences de la Norme NF C 15-100**
```markdown
<!-- OLD: Plain bullet list -->
## Les Exigences Obligatoires

1. **Prise de terre et liaisons équipotentielles**
   - Installation d'une prise de terre conforme
   - Raccordement de tous les éléments métalliques

2. **Protection différentielle**
   - Installation d'un dispositif différentiel 30mA
   ...

<!-- NEW: Feature grid with cards -->
{{< feature-grid columns="2" >}}
  {{< feature-card icon="shield" title="Prise de terre et liaisons équipotentielles" color="blue" >}}
  - Installation d'une prise de terre conforme
  - Raccordement de tous les éléments métalliques
  - Mise en place de liaisons équipotentielles
  {{< /feature-card >}}

  {{< feature-card icon="lightning" title="Protection différentielle" color="blue" >}}
  - Installation d'un dispositif différentiel 30mA
  - Protection contre les contacts indirects
  - Détection des fuites de courant
  {{< /feature-card >}}

  {{< feature-card icon="check" title="Protection contre les surintensités" color="blue" >}}
  - Disjoncteurs adaptés à chaque circuit
  - Protection des câbles et appareils
  {{< /feature-card >}}

  {{< feature-card icon="document" title="Schéma et repérage" color="blue" >}}
  - Schéma électrique à jour
  - Étiquetage de tous les circuits
  - Documentation complète
  {{< /feature-card >}}

  {{< feature-card icon="wrench" title="Circuits spécialisés" color="blue" >}}
  - Circuit dédié pour plaques de cuisson
  - Circuit pour lave-linge
  - Circuit pour congélateur
  {{< /feature-card >}}

  {{< feature-card icon="home" title="Nombre de prises minimum" color="blue" >}}
  - Prises en nombre suffisant par pièce
  - Respect des distances réglementaires
  - Hauteur d'installation normée
  {{< /feature-card >}}

  {{< feature-card icon="shield" title="Protection des salles d'eau" color="blue" >}}
  - Respect des volumes de sécurité
  - Matériel adapté à l'environnement humide
  - Protection IPX4 minimum
  {{< /feature-card >}}
{{< /feature-grid >}}
```

**Section 2: Notre Prestation en 4 Étapes**
```markdown
<!-- OLD: H3 headings with paragraphs -->
### 1. Diagnostic Initial Gratuit
Notre électricien...

### 2. Devis Détaillé
...

<!-- NEW: Step process -->
{{< step-process >}}
  {{< step number="1" title="Diagnostic Initial Gratuit" >}}
  Notre électricien certifié se déplace à votre domicile pour réaliser un diagnostic complet de votre installation électrique. Il identifie tous les points de non-conformité et évalue l'ampleur des travaux nécessaires.
  {{< /step >}}

  {{< step number="2" title="Devis Détaillé et Transparent" >}}
  Établissement d'un devis précis comprenant :
  - Liste détaillée des travaux à réaliser
  - Coût du matériel et de la main-d'œuvre
  - Délais d'intervention
  - Garanties offertes
  {{< /step >}}

  {{< step number="3" title="Réalisation des Travaux" >}}
  Intervention de nos électriciens certifiés dans le respect des normes :
  - Travaux réalisés avec du matériel de qualité professionnelle
  - Respect du planning défini
  - Chantier propre et sécurisé
  {{< /step >}}

  {{< step number="4" title="Contrôle et Attestation Consuel" >}}
  À l'issue des travaux :
  - Vérification complète de l'installation
  - Tests de sécurité et de conformité
  - Délivrance de l'attestation Consuel
  - Garantie décennale sur les travaux
  {{< /step >}}
{{< /step-process >}}
```

**Section 3: Pricing Tables**
```markdown
<!-- OLD: Markdown table -->
| Type de Logement | Prix Indicatif |
|------------------|----------------|
| Studio/T1 | À partir de 590€ |
| T2/T3 | À partir de 790€ |

<!-- NEW: Pricing cards -->
{{< pricing-table >}}
  {{< pricing-card tier="Studio / T1" price="590" period="intervention" >}}
  **Inclus dans cette offre :**
  - Diagnostic complet de l'installation
  - Mise en conformité des éléments essentiels
  - Attestation de conformité Consuel
  - Garantie décennale
  {{< /pricing-card >}}

  {{< pricing-card tier="T2 / T3" price="790" period="intervention" featured="true" >}}
  **Inclus dans cette offre :**
  - Diagnostic complet de l'installation
  - Mise en conformité totale
  - Attestation de conformité Consuel
  - Garantie décennale
  - Mise à jour du schéma électrique
  {{< /pricing-card >}}

  {{< pricing-card tier="T4 et plus" price="990" period="intervention" >}}
  **Inclus dans cette offre :**
  - Diagnostic approfondi
  - Mise en conformité complète
  - Attestation de conformité Consuel
  - Garantie décennale
  - Documentation complète
  - Suivi post-intervention
  {{< /pricing-card >}}
{{< /pricing-table >}}

{{< callout type="info" title="Devis Gratuit" >}}
Chaque situation étant unique, nous vous recommandons de demander un devis personnalisé gratuit. Nos électriciens se déplacent pour évaluer précisément vos besoins.
{{< /callout >}}
```

**Section 4: FAQ Section**
```markdown
<!-- OLD: Bold questions with paragraph answers -->
**Combien coûte une mise aux normes électrique à Paris ?**

Le coût dépend de...

<!-- NEW: FAQ accordion -->
{{< faq-accordion >}}
  {{< faq question="Combien coûte une mise aux normes électrique à Paris ?" >}}
  Le coût dépend de la surface de votre logement et de l'état actuel de votre installation. Pour un studio, comptez à partir de 590€. Pour un T2/T3, les tarifs débutent à 790€. Nous proposons un diagnostic gratuit et un devis détaillé avant toute intervention.
  {{< /faq >}}

  {{< faq question="Combien de temps dure une mise aux normes complète ?" >}}
  Pour un studio ou T1, comptez 1 à 2 jours d'intervention. Pour un T2/T3, prévoyez 2 à 3 jours. Pour les grands appartements ou en cas de rénovation complète, le délai peut s'étendre à une semaine. Nous établissons un planning précis lors de l'établissement du devis.
  {{< /faq >}}

  {{< faq question="La mise aux normes est-elle obligatoire ?" >}}
  Oui, dans certains cas :
  - Lors de la vente d'un logement de plus de 15 ans (diagnostic électrique obligatoire)
  - Pour la location (depuis 2018, le bailleur doit garantir une installation conforme)
  - Après des travaux importants de rénovation
  - En cas de risque identifié pour la sécurité des occupants
  {{< /faq >}}

  {{< faq question="Qu'est-ce que l'attestation Consuel ?" >}}
  Le Consuel (Comité National pour la Sécurité des Usagers de l'Électricité) est l'organisme qui délivre les attestations de conformité des installations électriques. Cette attestation est obligatoire pour :
  - Les installations neuves
  - Les rénovations totales
  - Les modifications importantes

  Elle prouve que votre installation respecte la norme NF C 15-100.
  {{< /faq >}}

  {{< faq question="Puis-je bénéficier d'aides financières ?" >}}
  Oui, plusieurs dispositifs existent :
  - **MaPrimeRénov'** : Pour les travaux de rénovation énergétique incluant l'électricité
  - **Crédit d'impôt** : Pour certains travaux d'amélioration
  - **Aides de l'Anah** : Pour les propriétaires aux revenus modestes
  - **Éco-prêt à taux zéro** : Pour financer vos travaux sans intérêts

  Nos conseillers peuvent vous orienter vers les aides adaptées à votre situation.
  {{< /faq >}}

  {{< faq question="Intervenez-vous dans tous les arrondissements de Paris ?" >}}
  Oui, Allo Électricien intervient dans tous les arrondissements parisiens (75001 à 75020) et dans toute la région Île-de-France. Nous garantissons une intervention rapide, généralement sous 30 minutes en urgence.
  {{< /faq >}}
{{< /faq-accordion >}}
```

**Section 5: Add Callouts for Important Info**
```markdown
<!-- Add warning callout for legal obligations -->
{{< callout type="warning" title="Obligation légale pour les bailleurs" >}}
Depuis 2015, tout bailleur doit fournir un diagnostic électrique pour les logements de plus de 15 ans. Depuis 2018, l'installation doit être conforme à la norme NF C 15-100 pour toute mise en location.
{{< /callout >}}

<!-- Add success callout for benefits -->
{{< callout type="success" title="Pourquoi mettre aux normes ?" >}}
**Sécurité** : Prévention des risques d'incendie et d'électrocution
**Conformité** : Respect de vos obligations légales
**Valorisation** : Augmentation de la valeur de votre bien
**Confort** : Installation moderne et performante
{{< /callout >}}
```

---

### PHASE 4: Roll Out to Other Service Pages
**Estimated Time:** 3-4 hours (15-20 pages × 10-15 min each)

Apply same conversion patterns to:

1. **Priority Pages (High Traffic):**
   - `/content/services/installation-electrique-paris/index.md`
   - `/content/services/depannage-electrique-paris/index.md`
   - `/content/services/renovation-electrique-paris/index.md`
   - `/content/services/tableau-electrique-paris/index.md`

2. **Secondary Pages:**
   - Other location-specific service pages
   - Specialty service pages

**Conversion Checklist per Page:**
- [ ] Convert requirement lists to `feature-grid`
- [ ] Convert process sections to `step-process`
- [ ] Convert pricing tables to `pricing-table`
- [ ] Convert FAQ to `faq-accordion`
- [ ] Add `callout` boxes for important info
- [ ] Test page locally with `hugo server`
- [ ] Verify responsive layout on mobile
- [ ] Check accordion functionality

---

### PHASE 5: Quality Assurance & Testing
**Estimated Time:** 2 hours

#### 5.1 Visual Testing Checklist
- [ ] **Desktop (1920px)**
  - [ ] Cards display in proper grid (2-3 columns)
  - [ ] Hover effects work smoothly
  - [ ] Step process timeline aligns correctly
  - [ ] Pricing cards are equal height
  - [ ] FAQ accordions expand/collapse smoothly

- [ ] **Tablet (768px)**
  - [ ] Cards stack properly (2 columns or 1 column)
  - [ ] Step numbers remain visible
  - [ ] Pricing cards maintain readability
  - [ ] Touch targets are 48px minimum

- [ ] **Mobile (375px)**
  - [ ] All cards stack to single column
  - [ ] Text remains readable (no overflow)
  - [ ] Accordions are touch-friendly
  - [ ] CTA buttons are accessible

#### 5.2 Functionality Testing
- [ ] Alpine.js loads correctly (check browser console)
- [ ] FAQ accordions open/close on click
- [ ] Multiple accordions can be open simultaneously
- [ ] Icons display correctly (no broken SVGs)
- [ ] Phone links in pricing cards work (`tel:` protocol)
- [ ] Scroll-to-section anchors function (if implemented)

#### 5.3 Performance Testing
- [ ] Page load time < 3 seconds
- [ ] No Cumulative Layout Shift (CLS)
- [ ] Images lazy-load properly
- [ ] No JavaScript errors in console
- [ ] Alpine.js bundle size acceptable (~15KB gzipped)

#### 5.4 Accessibility Testing
- [ ] Keyboard navigation works for accordions (Tab, Enter, Space)
- [ ] ARIA labels present on interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Screen reader announces accordion state changes
- [ ] Focus indicators visible on all interactive elements

#### 5.5 Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

### PHASE 6: Build & Deploy
**Estimated Time:** 30 minutes

#### 6.1 Local Testing
```bash
# Clean build
hugo --cleanDestinationDir

# Test locally
hugo server -D

# Check for build errors
```

#### 6.2 Production Build
```bash
# Build for production
hugo --minify

# Verify public/ directory
find public -name "*.html" | head -20
```

#### 6.3 Deployment
```bash
# Deploy via rsync (existing method)
npm run deploy

# Or manual deployment
rsync -avz --delete public/ user@server:/path/to/site/
```

#### 6.4 Post-Deployment Verification
- [ ] Check live page: https://allo-electricien.pro/services/mise-aux-normes-paris/
- [ ] Verify all shortcodes rendered correctly
- [ ] Test Alpine.js functionality on live site
- [ ] Check mobile responsiveness on real devices
- [ ] Monitor for any JavaScript errors

---

## Success Metrics

### Before vs. After Comparison

| Metric | Before | Target After | Measurement |
|--------|--------|--------------|-------------|
| Visual Density | High (wall of text) | Low (scannable cards) | User feedback |
| Mobile Readability | 3/10 | 8/10 | Subjective assessment |
| Avg. Time on Page | ~1:30 | ~2:30 | Analytics (if available) |
| Bounce Rate | ~65% | ~45% | Analytics (if available) |
| FAQ Engagement | Low (scroll fatigue) | High (interactive) | Click tracking |
| Conversion (CTA clicks) | Baseline | +25% increase | Button click tracking |

### User Experience Improvements
✅ **Hierarchy:** Clear visual distinction between sections
✅ **Scannability:** Key information accessible at a glance
✅ **Engagement:** Interactive elements (accordions, hover effects)
✅ **Mobile-First:** Optimized for small screens
✅ **Accessibility:** Keyboard navigation, ARIA labels
✅ **Performance:** No significant page load impact

---

## Troubleshooting Guide

### Issue: Shortcodes Not Rendering
**Symptoms:** `{{< feature-card >}}` appears as plain text in output
**Solutions:**
1. Check file location: Must be in `/layouts/shortcodes/`
2. Verify filename matches usage: `feature-card.html` for `{{< feature-card >}}`
3. Clear Hugo cache: `hugo --cleanDestinationDir`
4. Check Hugo version: Requires Hugo 0.80+ for shortcode improvements

### Issue: Alpine.js Not Working
**Symptoms:** Accordions don't expand/collapse
**Solutions:**
1. Verify Alpine.js script loads: Check browser Network tab
2. Check for JavaScript errors: Open browser console
3. Ensure `x-data` is on parent element
4. Check CDN URL is accessible
5. Try local Alpine.js file instead of CDN

### Issue: Cards Breaking Layout
**Symptoms:** Cards overflow, unequal heights, broken grid
**Solutions:**
1. Verify Tailwind CDN loads correctly
2. Check for unclosed HTML tags in shortcode
3. Add `h-full` class to cards for equal heights
4. Use `min-h-0` to prevent overflow issues
5. Inspect with browser DevTools

### Issue: Icons Not Displaying
**Symptoms:** Broken or missing icons in cards
**Solutions:**
1. Verify SVG code is valid XML
2. Check viewBox attribute is correct
3. Ensure `fill="currentColor"` or `stroke="currentColor"`
4. Test with simple icon first (checkmark)
5. Use Heroicons or similar SVG library

### Issue: Mobile Layout Issues
**Symptoms:** Text overflow, tiny buttons, horizontal scroll
**Solutions:**
1. Add viewport meta tag (should be in baseof.html)
2. Use `w-full` on container elements
3. Ensure responsive classes: `md:grid-cols-2` not just `grid-cols-2`
4. Test with Chrome DevTools mobile emulation
5. Add `overflow-x-hidden` to body if needed

---

## Maintenance & Updates

### Adding New Shortcodes
1. Create HTML file in `/layouts/shortcodes/`
2. Follow naming convention: lowercase, hyphenated
3. Document props and usage in this file
4. Test with various content types
5. Add to style guide/documentation

### Updating Existing Shortcodes
1. Make changes to shortcode HTML
2. Test on pilot page first
3. Check all pages using that shortcode
4. Document changes in this file
5. Rebuild and redeploy

### Content Editor Workflow
1. Edit markdown file in `/content/services/`
2. Use shortcode syntax as documented
3. Test locally: `hugo server -D`
4. Preview at `http://localhost:1313`
5. Commit and push changes
6. Deploy to production

---

## File Reference

### Created Files (9 Shortcodes)
1. `/layouts/shortcodes/feature-grid.html`
2. `/layouts/shortcodes/feature-card.html`
3. `/layouts/shortcodes/step-process.html`
4. `/layouts/shortcodes/step.html`
5. `/layouts/shortcodes/pricing-table.html`
6. `/layouts/shortcodes/pricing-card.html`
7. `/layouts/shortcodes/faq-accordion.html`
8. `/layouts/shortcodes/faq.html`
9. `/layouts/shortcodes/callout.html`

### Modified Files
1. `/layouts/_default/baseof.html` (add Alpine.js)
2. `/content/services/mise-aux-normes-paris/index.md` (pilot conversion)
3. 15-20 other service page markdown files

### Reference Files (No Changes)
- `/layouts/_default/single.html` (template already supports shortcodes)
- `/static/css/custom.css` (utilities already available)
- `/layouts/partials/head.html` (Tailwind already configured)

---

## Next Steps After Session Resume

### Step 1: Create Shortcodes (Start Here)
Begin with `/layouts/shortcodes/feature-card.html` as it's the most commonly used. Test immediately with a simple example.

### Step 2: Add Alpine.js
Check if Alpine.js exists in baseof.html first. If not, add the CDN link.

### Step 3: Convert Pilot Page
Start with "Les 7 Exigences" section - most impactful visual change.

### Step 4: Test & Iterate
Build locally, verify functionality, adjust styling as needed.

### Step 5: Roll Out
Apply to remaining service pages once pilot is successful.

---

## Session Resume Protocol

If this session disconnects, a new session can resume by:

1. **Reading this file:** `/home/proalloelectrici/hugosource/SERVICE_PAGES_UX_ENHANCEMENT_PLAN.md`
2. **Checking progress:** Look for created shortcode files in `/layouts/shortcodes/`
3. **Identifying last completed phase:** Review git status for modified files
4. **Continuing from next incomplete phase:** Follow phase checklist
5. **Referencing shortcode templates:** All HTML structures documented above

**Quick Start Command for Resume:**
```bash
# Check what's been done
ls -la /home/proalloelectrici/hugosource/layouts/shortcodes/

# See which content files modified
git status

# Test current state
hugo server -D
```

---

## Documentation Links

- **Hugo Shortcodes:** https://gohugo.io/content-management/shortcodes/
- **Alpine.js Docs:** https://alpinejs.dev/start-here
- **Tailwind CSS:** https://tailwindcss.com/docs
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

---

**Last Updated:** 2025-11-10
**Status:** ✅ Ready for Implementation
**Estimated Total Time:** 8-12 hours
**Current Phase:** Phase 1 - Create Shortcodes