/**
 * Sitemap Search Functionality
 * Real-time filtering of communes, zip codes, and departments
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSitemapSearch);
  } else {
    initSitemapSearch();
  }

  function initSitemapSearch() {
    const searchInput = document.getElementById('sitemap-search');
    const resultsCount = document.getElementById('search-results-count');

    if (!searchInput) {
      console.warn('Sitemap search input not found');
      return;
    }

    // Get all sitemap items
    const sitemapItems = document.querySelectorAll('.sitemap-item');
    const totalItems = sitemapItems.length;

    // Track search state
    let searchTimeout = null;

    /**
     * Perform search and filter items
     */
    function performSearch(query) {
      query = query.toLowerCase().trim();

      // If query is empty, show all items
      if (!query) {
        showAllItems();
        updateResultsCount(totalItems, totalItems);
        return;
      }

      let visibleCount = 0;
      let matchedSections = new Set();

      // Filter items
      sitemapItems.forEach(item => {
        const searchTerms = item.getAttribute('data-search-terms') || '';
        const itemText = (item.textContent || '').toLowerCase();
        const combinedText = (searchTerms + ' ' + itemText).toLowerCase();

        // Check if item matches query
        const matches = combinedText.includes(query);

        if (matches) {
          item.classList.remove('hidden');
          item.classList.add('match');
          visibleCount++;

          // Track which sections have matches
          const section = item.closest('section');
          if (section) {
            matchedSections.add(section);
          }

          // Auto-expand parent details if collapsed
          const details = item.closest('details');
          if (details && !details.open) {
            details.open = true;
          }
        } else {
          item.classList.add('hidden');
          item.classList.remove('match');
        }
      });

      // Remove match highlighting after animation
      setTimeout(() => {
        sitemapItems.forEach(item => {
          item.classList.remove('match');
        });
      }, 500);

      // Update results count
      updateResultsCount(visibleCount, totalItems);

      // Scroll to first match if any
      if (visibleCount > 0) {
        const firstMatch = document.querySelector('.sitemap-item:not(.hidden)');
        if (firstMatch) {
          const section = firstMatch.closest('section');
          if (section) {
            // Smooth scroll to section
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    }

    /**
     * Show all items
     */
    function showAllItems() {
      sitemapItems.forEach(item => {
        item.classList.remove('hidden');
        item.classList.remove('match');
      });

      // Collapse all details elements
      document.querySelectorAll('.department-accordion').forEach(details => {
        details.open = false;
      });
    }

    /**
     * Update results count display
     */
    function updateResultsCount(visible, total) {
      if (!resultsCount) return;

      if (visible === total) {
        resultsCount.textContent = '';
      } else if (visible === 0) {
        resultsCount.textContent = 'Aucun résultat trouvé. Essayez un autre terme de recherche.';
        resultsCount.classList.add('text-red-600');
        resultsCount.classList.remove('text-gray-600');
      } else {
        resultsCount.textContent = `${visible} résultat${visible > 1 ? 's' : ''} trouvé${visible > 1 ? 's' : ''} sur ${total} communes`;
        resultsCount.classList.remove('text-red-600');
        resultsCount.classList.add('text-gray-600');
      }
    }

    /**
     * Handle search input
     */
    function handleSearchInput(event) {
      const query = event.target.value;

      // Debounce search for performance
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 200); // Wait 200ms after user stops typing
    }

    /**
     * Clear search
     */
    function clearSearch() {
      searchInput.value = '';
      showAllItems();
      updateResultsCount(totalItems, totalItems);
    }

    // Attach event listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('search', handleSearchInput); // For search input type

    // Handle Escape key to clear search
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        clearSearch();
        searchInput.blur();
      }
    });

    // Handle keyboard navigation
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + F focuses search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }

      // Ctrl/Cmd + K focuses search (alternate shortcut)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // Add search tip
    if (!searchInput.hasAttribute('data-tip-added')) {
      searchInput.setAttribute('data-tip-added', 'true');
      searchInput.setAttribute('title', 'Raccourci: Ctrl+F ou Ctrl+K pour rechercher rapidement');
    }

    // Track search analytics (if analytics is available)
    if (typeof gtag === 'function') {
      searchInput.addEventListener('search', (event) => {
        const query = event.target.value;
        if (query) {
          gtag('event', 'search', {
            'event_category': 'Sitemap',
            'event_label': 'Search Query',
            'value': query
          });
        }
      });
    }

    // Progressive enhancement: Add clear button
    const searchContainer = searchInput.parentElement;
    if (searchContainer && !searchContainer.querySelector('.search-clear-btn')) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'search-clear-btn absolute right-4 top-4 w-6 h-6 text-gray-400 hover:text-gray-600 hidden';
      clearBtn.innerHTML = '&times;';
      clearBtn.setAttribute('aria-label', 'Effacer la recherche');
      clearBtn.style.fontSize = '24px';
      clearBtn.style.lineHeight = '1';

      clearBtn.addEventListener('click', clearSearch);
      searchContainer.appendChild(clearBtn);

      // Show/hide clear button based on input value
      searchInput.addEventListener('input', () => {
        if (searchInput.value) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      });
    }

    console.log('✅ Sitemap search initialized:', totalItems, 'items');
  }

  /**
   * Export for external use
   */
  window.SitemapSearch = {
    init: initSitemapSearch
  };
})();
