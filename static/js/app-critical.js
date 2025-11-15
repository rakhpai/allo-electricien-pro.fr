// Critical JavaScript - Mobile Menu (Loads immediately)
// Minimized for fastest possible execution
(function() {
  'use strict';

  // Mobile Menu Toggle - CRITICAL for navigation
  document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
      mobileMenuButton.addEventListener('click', function() {
        mobileMenu.classList.toggle('hidden');
      });
    }

    // Universal Mobile Menu Management
    const allMobileMenus = document.querySelectorAll('[id^="mobile-menu"]');

    function closeMobileMenu() {
      allMobileMenus.forEach(menu => {
        menu.classList.remove('active');
        menu.classList.add('hidden');
      });
      document.body.classList.remove('mobile-menu-open', 'menu-open-v5', 'drawer-open');
      document.body.style.overflow = '';
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileMenu();
      }
    });

    // Close mobile menu on window resize to desktop
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth >= 1024) {
          closeMobileMenu();
        }
      }, 250);
    });
  });
})();
