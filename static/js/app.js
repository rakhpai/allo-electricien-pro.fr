// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
    });
  }

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

  // Smooth Scroll for Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          // Close mobile menu if open
          if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
          }
        }
      }
    });
  });
});
