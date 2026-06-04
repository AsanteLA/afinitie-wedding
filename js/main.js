/* ============================================================
   AFINITIE WEDDING — MAIN JS
   Nav scroll behaviour + mobile hamburger
   ============================================================ */

(function () {
  'use strict';

  const nav       = document.getElementById('nav');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  /* --- Scroll: add .scrolled class to nav --- */
  function onScroll() {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run on load

  /* --- Hamburger toggle --- */
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', false);
        document.body.style.overflow = '';
      });
    });
  }

  /* --- Card hover shadow --- */
  document.querySelectorAll('.card[href]').forEach(function (card) {
    card.addEventListener('mouseenter', function () {
      card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.07)';
      card.style.transform  = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.boxShadow = '';
      card.style.transform  = '';
    });
  });

  /* --- Countdown timer (September 24th of the next upcoming year) --- */
  var cdDays  = document.getElementById('cd-days');
  var cdHours = document.getElementById('cd-hours');
  var cdMins  = document.getElementById('cd-mins');
  var cdSecs  = document.getElementById('cd-secs');

  if (cdDays) {
    var weddingDate = new Date('September 24, 2026 00:00:00');

    function pad(n) { return n < 10 ? '0' + n : n; }

    function tick() {
      var now  = new Date();
      var diff = weddingDate - now;

      if (diff <= 0) {
        cdDays.textContent = cdHours.textContent = cdMins.textContent = cdSecs.textContent = '00';
        return;
      }

      cdDays.textContent  = pad(Math.floor(diff / 86400000));
      cdHours.textContent = pad(Math.floor((diff % 86400000) / 3600000));
      cdMins.textContent  = pad(Math.floor((diff % 3600000)  / 60000));
      cdSecs.textContent  = pad(Math.floor((diff % 60000)    / 1000));
    }

    tick();
    setInterval(tick, 1000);
  }

})();
