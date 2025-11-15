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
    swiper: {
      selector: '.swiper',
      threshold: 0.1,
      rootMargin: '100px'
    }
  };

  // Track loaded resources
  const loaded = {
    leaflet: false,
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
    if (!loaded.swiper && document.querySelector(config.swiper.selector)) {
      console.log('Fallback: Loading Swiper after timeout');
      initializeSwiper();
    }
  }, 3000);

})();