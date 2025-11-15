// Lazy Loading Optimization for Maps and Animations
// This script improves page load performance by deferring resource loading

(function() {
  'use strict';

  // Configuration
  const config = {
    map: {
      selector: '#homepage-map',
      threshold: 0.1,
      rootMargin: '100px'
    },
    lottie: {
      selector: '#lottie-hero',
      threshold: 0.1,
      rootMargin: '50px'
    },
    swiper: {
      selector: '.swiper',
      threshold: 0.1,
      rootMargin: '100px'
    }
  };

  // Track loaded resources
  const loaded = {
    leaflet: false,
    lottie: false,
    swiper: false
  };

  // Lazy load Leaflet Map
  function initializeMap() {
    if (loaded.leaflet) return;

    const mapElement = document.querySelector(config.map.selector);
    if (!mapElement) return;

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded yet, waiting...');
      setTimeout(initializeMap, 100);
      return;
    }

    loaded.leaflet = true;

    // Initialize the map
    const map = L.map('homepage-map').setView([48.8566, 2.3522], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add markers (this data should be passed from Hugo template)
    if (window.mapMarkers) {
      const markers = L.markerClusterGroup();
      window.mapMarkers.forEach(marker => {
        markers.addLayer(L.marker([marker.lat, marker.lng])
          .bindPopup(marker.popup));
      });
      map.addLayer(markers);
    }
  }

  // Lazy load Lottie Animation
  function initializeLottie() {
    if (loaded.lottie) return;

    const lottieElement = document.querySelector(config.lottie.selector);
    if (!lottieElement) return;

    // Check if Lottie is loaded
    if (typeof lottie === 'undefined') {
      console.warn('Lottie not loaded yet, waiting...');
      setTimeout(initializeLottie, 100);
      return;
    }

    loaded.lottie = true;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      // Load Lottie animation
      const animation = lottie.loadAnimation({
        container: lottieElement,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/animations/electrical-service.json'
      });

      // Performance optimization: Pause animation when not visible
      const animObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animation.play();
          } else {
            animation.pause();
          }
        });
      }, {
        threshold: 0.1
      });

      animObserver.observe(lottieElement);
    } else {
      // Static fallback for reduced motion
      lottieElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-200 rounded-lg"><svg class="w-32 h-32 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div>';
    }
  }

  // Lazy load Swiper Carousel
  function initializeSwiper() {
    if (loaded.swiper) return;

    const swiperElement = document.querySelector(config.swiper.selector);
    if (!swiperElement) return;

    // Check if Swiper is loaded
    if (typeof Swiper === 'undefined') {
      console.warn('Swiper not loaded yet, waiting...');
      setTimeout(initializeSwiper, 100);
      return;
    }

    loaded.swiper = true;

    // Initialize Swiper (customize based on your needs)
    new Swiper('.swiper', {
      slidesPerView: 1,
      spaceBetween: 30,
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      breakpoints: {
        640: {
          slidesPerView: 2,
        },
        1024: {
          slidesPerView: 3,
        },
      }
    });
  }

  // Set up Intersection Observers
  function setupLazyLoading() {
    // Map Observer
    const mapElement = document.querySelector(config.map.selector);
    if (mapElement) {
      const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !loaded.leaflet) {
            initializeMap();
            mapObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: config.map.threshold,
        rootMargin: config.map.rootMargin
      });
      mapObserver.observe(mapElement);
    }

    // Lottie Observer
    const lottieElement = document.querySelector(config.lottie.selector);
    if (lottieElement) {
      const lottieObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !loaded.lottie) {
            initializeLottie();
            lottieObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: config.lottie.threshold,
        rootMargin: config.lottie.rootMargin
      });
      lottieObserver.observe(lottieElement);
    }

    // Swiper Observer
    const swiperElement = document.querySelector(config.swiper.selector);
    if (swiperElement) {
      const swiperObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !loaded.swiper) {
            initializeSwiper();
            swiperObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: config.swiper.threshold,
        rootMargin: config.swiper.rootMargin
      });
      swiperObserver.observe(swiperElement);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLazyLoading);
  } else {
    setupLazyLoading();
  }

  // Fallback: Load everything after 3 seconds if not already loaded
  setTimeout(() => {
    if (!loaded.leaflet && document.querySelector(config.map.selector)) {
      console.log('Fallback: Loading map after timeout');
      initializeMap();
    }
    if (!loaded.lottie && document.querySelector(config.lottie.selector)) {
      console.log('Fallback: Loading Lottie after timeout');
      initializeLottie();
    }
    if (!loaded.swiper && document.querySelector(config.swiper.selector)) {
      console.log('Fallback: Loading Swiper after timeout');
      initializeSwiper();
    }
  }, 3000);

})();