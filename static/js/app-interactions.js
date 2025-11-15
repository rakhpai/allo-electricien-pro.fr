// Non-Critical Interactions - Loaded after page interactive
// Navbar enhancements, animations, and progressive enhancements
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.getElementById('mobile-menu');

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

    // ========================================
    // NAVBAR ENHANCEMENTS
    // ========================================

    // Utility: Throttle function for scroll events
    function throttle(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }

    // Scroll Detection and Navbar State Management
    let lastScrollY = window.scrollY;
    let ticking = false;

    const navbar = document.querySelector('nav');
    const navbarScrollThreshold = 50;

    function updateNavbarOnScroll() {
      const currentScrollY = window.scrollY;

      // Add scrolled class when past threshold
      if (currentScrollY > navbarScrollThreshold) {
        navbar?.classList.add('scrolled');
      } else {
        navbar?.classList.remove('scrolled');
      }

      // Smart hide/show (hide on scroll down, show on scroll up)
      if (navbar?.classList.contains('smart-hide')) {
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          // Scrolling down
          navbar.classList.add('hide-on-scroll');
          navbar.classList.remove('show-on-scroll');
        } else if (currentScrollY < lastScrollY) {
          // Scrolling up
          navbar.classList.remove('hide-on-scroll');
          navbar.classList.add('show-on-scroll');
        }
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateNavbarOnScroll);
        ticking = true;
      }
    }, { passive: true });

    // Scroll Progress Bar
    const scrollProgressBar = document.querySelector('.scroll-progress-bar');

    if (scrollProgressBar) {
      const updateScrollProgress = throttle(() => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        scrollProgressBar.style.transform = `scaleX(${scrolled / 100})`;
      }, 10);

      window.addEventListener('scroll', updateScrollProgress, { passive: true });
    }

    // Active Navigation Item Detection
    function updateActiveNavItem() {
      const sections = document.querySelectorAll('section[id]');
      const navLinks = document.querySelectorAll('nav a[href^="#"]');

      if (sections.length === 0 || navLinks.length === 0) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href === `#${id}`) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        });
      }, {
        threshold: 0.3,
        rootMargin: '-100px 0px -50% 0px'
      });

      sections.forEach(section => observer.observe(section));
    }

    updateActiveNavItem();

    // Mega Menu Enhancements
    const megaMenuTriggers = document.querySelectorAll('.mega-menu-trigger');

    megaMenuTriggers.forEach(trigger => {
      const megaMenu = trigger.querySelector('.mega-menu');
      let hideTimeout;

      trigger.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
        megaMenu?.classList.add('active');
      });

      trigger.addEventListener('mouseleave', () => {
        hideTimeout = setTimeout(() => {
          megaMenu?.classList.remove('active');
        }, 300);
      });

      // Keyboard accessibility
      trigger.addEventListener('focusin', () => {
        clearTimeout(hideTimeout);
        megaMenu?.classList.add('active');
      });

      trigger.addEventListener('focusout', (e) => {
        if (!trigger.contains(e.relatedTarget)) {
          hideTimeout = setTimeout(() => {
            megaMenu?.classList.remove('active');
          }, 300);
        }
      });
    });

    // Mobile Menu Link Click Handler (Close menu after navigation)
    const mobileNavLinks = document.querySelectorAll('[class*="mobile-menu"] a, [class*="drawer-menu"] a');

    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        const allMobileMenus = document.querySelectorAll('[id^="mobile-menu"]');
        setTimeout(() => {
          allMobileMenus.forEach(menu => {
            menu.classList.remove('active');
            menu.classList.add('hidden');
          });
        }, 300);
      });
    });

    // Bottom Navigation Active State
    function updateBottomNavActive() {
      const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
      const currentHash = window.location.hash || '#';
      const currentPath = window.location.pathname;

      bottomNavItems.forEach(item => {
        const href = item.getAttribute('href');

        // Remove active from all
        item.classList.remove('active');

        // Add active to matching item
        if (href === '/' && (currentPath === '/' || currentPath === '/index.html') && !currentHash) {
          item.classList.add('active');
        } else if (href !== '/' && currentHash && href.includes(currentHash)) {
          item.classList.add('active');
        }
      });
    }

    // Update on page load and hash change
    updateBottomNavActive();
    window.addEventListener('hashchange', updateBottomNavActive);

    // Parallax Effect for Navbar (Variant 5)
    const parallaxNavbar = document.querySelector('.parallax-navbar');

    if (parallaxNavbar) {
      const handleParallax = throttle(() => {
        const scrollY = window.scrollY;
        if (scrollY < 200) {
          const offset = scrollY * 0.05;
          parallaxNavbar.style.transform = `translateY(-${offset}px)`;
        }
      }, 10);

      window.addEventListener('scroll', handleParallax, { passive: true });
    }

    // Logo Animation on Scroll
    const logoScaleScroll = document.querySelectorAll('.logo-scale-scroll img');

    if (logoScaleScroll.length > 0) {
      const handleLogoScale = throttle(() => {
        const scrollY = window.scrollY;
        const scale = scrollY > 50 ? 0.9 : 1;

        logoScaleScroll.forEach(logo => {
          logo.style.transform = `scale(${scale})`;
        });
      }, 50);

      window.addEventListener('scroll', handleLogoScale, { passive: true });
    }

    // Intersection Observer for Navbar Visibility
    const observerOptions = {
      root: null,
      threshold: 0,
      rootMargin: '0px 0px -100% 0px'
    };

    const navbarObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navbar?.classList.add('visible');
        }
      });
    }, observerOptions);

    if (navbar) {
      navbarObserver.observe(navbar);
    }

    // Trust Badge Tooltip Enhancement
    const trustBadges = document.querySelectorAll('.trust-badge, .badge-tooltip');

    trustBadges.forEach(badge => {
      // Add hover effect
      badge.addEventListener('mouseenter', () => {
        badge.style.transform = 'scale(1.1)';
      });

      badge.addEventListener('mouseleave', () => {
        badge.style.transform = 'scale(1)';
      });
    });

    // FAB (Floating Action Button) Hide on Scroll to Footer
    const fab = document.querySelector('.fab, .fab-emergency');
    const footer = document.querySelector('footer');

    if (fab && footer) {
      const handleFabVisibility = throttle(() => {
        const footerRect = footer.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        if (footerRect.top < windowHeight) {
          fab.style.opacity = '0';
          fab.style.pointerEvents = 'none';
        } else {
          fab.style.opacity = '1';
          fab.style.pointerEvents = 'auto';
        }
      }, 100);

      window.addEventListener('scroll', handleFabVisibility, { passive: true });
    }

    // Gradient CTA Button Ripple Effect
    const gradientCTAs = document.querySelectorAll('.cta-gradient, .cta-mobile-gradient, .cta-gradient-shine');

    gradientCTAs.forEach(cta => {
      cta.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.style.cssText = `
          position: absolute;
          left: ${x}px;
          top: ${y}px;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          transform: translate(-50%, -50%);
          animation: ripple-effect 0.6s ease-out;
          pointer-events: none;
        `;

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
      });
    });

    // Add ripple animation CSS
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
      @keyframes ripple-effect {
        to {
          width: 300px;
          height: 300px;
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(rippleStyle);

    // Top Bar Hide on Scroll (Variant 2)
    const topBar = document.querySelector('.top-bar');

    if (topBar) {
      const handleTopBarHide = throttle(() => {
        if (window.scrollY > 100) {
          topBar.classList.add('hidden');
        } else {
          topBar.classList.remove('hidden');
        }
      }, 100);

      window.addEventListener('scroll', handleTopBarHide, { passive: true });
    }

    // Haptic Feedback (if supported)
    function triggerHaptic(intensity = 10) {
      if ('vibrate' in navigator) {
        navigator.vibrate(intensity);
      }
    }

    // Add haptic feedback to interactive elements
    const interactiveElements = document.querySelectorAll(
      '.bottom-nav-item, .fab, [class*="cta"], .mobile-menu-button, .hamburger'
    );

    interactiveElements.forEach(element => {
      element.addEventListener('click', () => triggerHaptic(10));
    });

    // Accessibility: Focus trap for mobile menu
    function trapFocus(element) {
      const focusableElements = element.querySelectorAll(
        'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      element.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          } else if (!e.shiftKey && document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      });
    }

    const allMobileMenus = document.querySelectorAll('[id^="mobile-menu"]');
    allMobileMenus.forEach(menu => {
      menu.addEventListener('transitionend', () => {
        if (menu.classList.contains('active')) {
          trapFocus(menu);
          // Focus first focusable element
          const firstFocusable = menu.querySelector('a, button');
          firstFocusable?.focus();
        }
      });
    });

    // Console log for development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🚀 Navbar enhancements loaded');
      console.log('📱 Mobile menu variants: ', allMobileMenus.length);
      console.log('🎯 Mega menu triggers: ', document.querySelectorAll('.mega-menu-trigger').length);
    }
  });
})();
