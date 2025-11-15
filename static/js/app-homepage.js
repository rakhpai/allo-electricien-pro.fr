// Homepage JavaScript - City Search & Filter
// Only loads on homepage for optimal performance
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    // Department Filter (Homepage)
    const filterButtons = document.querySelectorAll('.dept-filter-btn');
    const cityCards = document.querySelectorAll('.city-card');
    const noResults = document.getElementById('no-results');

    if (filterButtons.length > 0) {
      filterButtons.forEach(button => {
        button.addEventListener('click', function() {
          // Update active button
          filterButtons.forEach(btn => {
            btn.classList.remove('active', 'bg-primary', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
          });
          this.classList.add('active', 'bg-primary', 'text-white');
          this.classList.remove('bg-gray-200', 'text-gray-700');

          // Filter cities
          const dept = this.getAttribute('data-dept');
          let visibleCount = 0;

          cityCards.forEach(card => {
            if (dept === 'all' || card.getAttribute('data-dept') === dept) {
              card.style.display = 'block';
              visibleCount++;
            } else {
              card.style.display = 'none';
            }
          });

          // Show/hide no results message
          if (noResults) {
            noResults.classList.toggle('hidden', visibleCount > 0);
          }
        });
      });
    }

    // City Search (Homepage)
    const searchInput = document.getElementById('city-search');

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        let visibleCount = 0;

        cityCards.forEach(card => {
          const city = card.getAttribute('data-city');
          const zip = card.getAttribute('data-zip');

          if (city.includes(searchTerm) || zip.includes(searchTerm)) {
            card.style.display = 'block';
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });

        // Show/hide no results message
        if (noResults) {
          noResults.classList.toggle('hidden', visibleCount > 0);
        }

        // Reset department filter when searching
        if (searchTerm) {
          filterButtons.forEach(btn => {
            btn.classList.remove('active', 'bg-primary', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
          });
          const allBtn = document.querySelector('[data-dept="all"]');
          if (allBtn) {
            allBtn.classList.add('active', 'bg-primary', 'text-white');
            allBtn.classList.remove('bg-gray-200', 'text-gray-700');
          }
        }
      });
    }
  });
})();
