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

      // Remove scrolled/backdrop-filter when menu opens to avoid
      // stacking context trapping the overlay inside the nav bar
      if (isOpen) {
        nav.classList.remove('scrolled');
      } else {
        if (window.scrollY > 40) nav.classList.add('scrolled');
      }
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

  /* --- Scroll reveal (Intersection Observer) --- */
  var revealEls = document.querySelectorAll('.section, .card, .page-hero, .program__item, .faq-item, .registry-card, .hotel-card, .timeline__item');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    // Wait one frame so the page renders before we apply hidden states.
    // Then only animate elements that are below the fold — anything already
    // visible on load is marked revealed immediately (no flash).
    requestAnimationFrame(function() {
      var vh = window.innerHeight;
      revealEls.forEach(function(el) {
        var rect = el.getBoundingClientRect();
        if (rect.top < vh * 0.95) {
          // Already visible — skip animation entirely
          el.classList.add('revealed');
        } else {
          el.classList.add('reveal');
          observer.observe(el);
        }
      });
    });
  } else {
    revealEls.forEach(function(el) { el.classList.add('revealed'); });
  }

  /* --- Back button on inner pages --- */
  var pageHero = document.querySelector('.page-hero');
  if (pageHero) {
    var backBtn = document.createElement('a');
    backBtn.href = 'index.html';
    backBtn.className = 'back-btn';
    backBtn.innerHTML = '← Home';
    document.body.insertBefore(backBtn, document.body.firstChild.nextSibling);
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

  /* --- Countdown timer (September 15, 2026) --- */
  var cdDays  = document.getElementById('cd-days');
  var cdHours = document.getElementById('cd-hours');
  var cdMins  = document.getElementById('cd-mins');
  var cdSecs  = document.getElementById('cd-secs');

  if (cdDays) {
    var weddingDate = new Date('September 15, 2026 00:00:00');

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

/* ── Analytics: page views + time on page ───────────────── */
(function () {
  'use strict';

  var API = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/rsvp';

  if (/admin/.test(location.pathname)) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  var sid = sessionStorage.getItem('_af_sid');
  if (!sid) {
    sid = Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('_af_sid', sid);
  }

  var page     = location.pathname.replace(/\.html$/, '') || '/';
  var referrer = 'direct';
  try { if (document.referrer) referrer = new URL(document.referrer).hostname; } catch (_) {}
  var t0 = Date.now(), sent = false;

  function ping(payload) {
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(function () {});
  }

  ping({ source: 'pageview', sessionId: sid, page: page, referrer: referrer });

  function sendTime() {
    if (sent) return; sent = true;
    var secs = Math.round((Date.now() - t0) / 1000);
    if (secs < 1) return;
    ping({ source: 'timespent', sessionId: sid, page: page, seconds: secs });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { sendTime(); }
    else { sent = false; t0 = Date.now(); }
  });
  window.addEventListener('pagehide', sendTime);
})();
