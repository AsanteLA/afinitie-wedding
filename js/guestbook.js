/* ============================================================
   AFINITIE WEDDING — GUESTBOOK JS

   Calls the AWS API Gateway / Lambda backend.
   Messages display as a single cycling card (10s interval).
   ============================================================ */

(function () {
  'use strict';

  var API_URL          = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/guestbook';
  var RSVP_MESSAGES_URL = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/rsvp?source=messages';

  var form      = document.getElementById('gbForm');
  var gbSuccess = document.getElementById('gbSuccess');
  var gbWall    = document.getElementById('gbWall');
  var gbEmpty   = document.getElementById('gbEmpty');

  if (!form) return;

  var allMessages  = [];
  var currentIndex = 0;
  var cycleTimer   = null;
  var INTERVAL_MS  = 10000;

  /* --- Load messages on page load --- */
  function loadMessages() {
    Promise.all([
      fetch(API_URL).then(function (r) { return r.json(); }).catch(function () { return []; }),
      fetch(RSVP_MESSAGES_URL).then(function (r) { return r.json(); }).catch(function () { return []; }),
    ]).then(function (results) {
      var gbMsgs   = Array.isArray(results[0]) ? results[0] : [];
      var rsvpMsgs = Array.isArray(results[1]) ? results[1] : [];
      var combined = gbMsgs.concat(rsvpMsgs);
      combined.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
      // Shuffle so it feels fresh on every load
      allMessages = shuffle(combined);
      startCarousel();
    });
  }

  /* --- Fisher-Yates shuffle --- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* --- Build the carousel DOM (runs once) --- */
  function startCarousel() {
    // Clear existing children except gbEmpty
    Array.from(gbWall.children).forEach(function (el) {
      if (el !== gbEmpty) el.remove();
    });

    if (!allMessages || allMessages.length === 0) {
      gbEmpty.style.display = 'block';
      return;
    }

    gbEmpty.style.display = 'none';

    // Card
    var card = document.createElement('div');
    card.className = 'gb-carousel-card';
    card.id = 'gbCarouselCard';

    var textEl = document.createElement('p');
    textEl.className = 'gb-message__text';
    textEl.id = 'gbCarouselText';

    var authorEl = document.createElement('span');
    authorEl.className = 'gb-message__author';
    authorEl.id = 'gbCarouselAuthor';

    card.appendChild(textEl);
    card.appendChild(authorEl);
    gbWall.appendChild(card);

    // Controls row
    if (allMessages.length > 1) {
      var controls = document.createElement('div');
      controls.className = 'gb-controls';

      var prevBtn = document.createElement('button');
      prevBtn.className = 'gb-nav-btn';
      prevBtn.setAttribute('aria-label', 'Previous message');
      prevBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

      var dots = document.createElement('div');
      dots.className = 'gb-dots';
      dots.id = 'gbDots';

      var nextBtn = document.createElement('button');
      nextBtn.className = 'gb-nav-btn';
      nextBtn.setAttribute('aria-label', 'Next message');
      nextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

      controls.appendChild(prevBtn);
      controls.appendChild(dots);
      controls.appendChild(nextBtn);
      gbWall.appendChild(controls);

      // Dots (max 7 shown)
      var dotCount = Math.min(allMessages.length, 7);
      for (var i = 0; i < dotCount; i++) {
        var dot = document.createElement('span');
        dot.className = 'gb-dot';
        dot.setAttribute('data-dot', i);
        dots.appendChild(dot);
      }

      prevBtn.addEventListener('click', function () { navigate(-1); });
      nextBtn.addEventListener('click', function () { navigate(1); });
    }

    showMessage(0, false);
    if (allMessages.length > 1) {
      cycleTimer = setInterval(function () { navigate(1); }, INTERVAL_MS);
    }
  }

  /* --- Show a specific message with optional fade --- */
  function showMessage(index, animate) {
    var card   = document.getElementById('gbCarouselCard');
    var textEl = document.getElementById('gbCarouselText');
    var author = document.getElementById('gbCarouselAuthor');
    if (!card || !textEl || !author) return;

    var msg = allMessages[index];

    function applyContent() {
      textEl.innerHTML = '“' + escapeHtml(msg.message) + '”';
      author.textContent = '— ' + escapeHtml(msg.name);
      updateDots(index);
    }

    if (animate) {
      card.classList.add('gb-fade-out');
      setTimeout(function () {
        applyContent();
        card.classList.remove('gb-fade-out');
        card.classList.add('gb-fade-in');
        setTimeout(function () { card.classList.remove('gb-fade-in'); }, 400);
      }, 300);
    } else {
      applyContent();
    }
  }

  /* --- Navigate by delta, reset timer --- */
  function navigate(delta) {
    currentIndex = (currentIndex + delta + allMessages.length) % allMessages.length;
    showMessage(currentIndex, true);
    clearInterval(cycleTimer);
    cycleTimer = setInterval(function () { navigate(1); }, INTERVAL_MS);
  }

  /* --- Update dots --- */
  function updateDots(index) {
    var dots = document.getElementById('gbDots');
    if (!dots) return;
    var dotEls = dots.querySelectorAll('.gb-dot');
    // If more messages than dots, map dots across the range
    var dotCount = dotEls.length;
    dotEls.forEach(function (dot, i) {
      var mappedIndex = allMessages.length <= dotCount
        ? i
        : Math.round(i * (allMessages.length - 1) / (dotCount - 1));
      dot.classList.toggle('active', i === Math.round(index * (dotCount - 1) / (allMessages.length - 1)));
    });
  }

  /* --- Submit handler --- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name    = document.getElementById('gb-name').value.trim();
    var message = document.getElementById('gb-msg').value.trim();

    if (!name || !message) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Posting…';

    fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: name, message: message }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(function (data) {
        form.style.display      = 'none';
        gbSuccess.style.display = 'block';
        if (data.approved) {
          var newMsg = { name: name, message: message, timestamp: new Date().toISOString() };
          allMessages.unshift(newMsg);
          currentIndex = 0;
          clearInterval(cycleTimer);
          startCarousel();
        }
      })
      .catch(function () {
        alert('Could not post your message — please try again.');
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Post Message';
      });
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  loadMessages();

})();
