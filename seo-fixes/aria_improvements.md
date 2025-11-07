# ARIA Label Improvements for Accessibility

## 1. Navigation
**Current:** `<nav class="bg-white shadow-md sticky top-0 z-50">`
**Improved:** `<nav class="bg-white shadow-md sticky top-0 z-50" role="navigation" aria-label="Main navigation">`

## 2. Mobile Menu Button
**Current:** `<button id=mobile-menu-button class="text-gray-700...">`
**Improved:** `<button id=mobile-menu-button class="text-gray-700..." aria-label="Toggle mobile menu" aria-expanded="false" aria-controls="mobile-menu">`

## 3. Mobile Menu
**Current:** `<div id=mobile-menu class="hidden md:hidden pb-4">`
**Improved:** `<div id=mobile-menu class="hidden md:hidden pb-4" role="menu" aria-label="Mobile navigation menu">`

## 4. Phone Links
**Current:** `<a href=tel:0144901131 class="bg-primary...">`
**Improved:** `<a href=tel:0144901131 class="bg-primary..." aria-label="Appeler le 01 44 90 11 31">`

## 5. Search Input
**Current:** `<input type=text id=city-search placeholder="Rechercher...">`
**Improved:** `<input type=text id=city-search placeholder="Rechercher une commune..." aria-label="Rechercher une commune" role="searchbox">`

## 6. Map Container
**Current:** `<div id=map class="h-96 md:h-[600px] rounded-lg shadow-lg">`
**Improved:** `<div id=map class="h-96 md:h-[600px] rounded-lg shadow-lg" role="application" aria-label="Carte interactive des électriciens en Île-de-France">`

## 7. Department Filter Buttons
**Current:** `<button class="dept-filter-btn active..." data-dept=all>`
**Improved:** `<button class="dept-filter-btn active..." data-dept=all aria-label="Filtrer par tous les départements" aria-pressed="true">`

## 8. City Cards (Grid Items)
Add role="article" to each city card for better semantic structure

## 9. Skip Navigation Link (Add at top of body)
```html
<a href="#main-content" class="skip-link sr-only focus:not-sr-only">Skip to main content</a>
```

## 10. Section Headings
Ensure all major sections have proper heading hierarchy and ARIA landmarks:
- `<main id="main-content" role="main">` wrapper
- `<section role="region" aria-labelledby="services-heading">` for services
- `<section role="region" aria-labelledby="directory-heading">` for directory

## CSS for Skip Link
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #0066FF;
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```
