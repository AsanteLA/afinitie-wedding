/* ============================================================
   AFINITIE WEDDING — GUESTBOOK JS

   Calls the AWS API Gateway / Lambda backend.
   Paste your API URL below after deploying.
   ============================================================ */

(function () {
  'use strict';

  // ---- Paste your API Gateway URL here after deploying ----
  var API_URL = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/guestbook';
  // ---------------------------------------------------------

  var form      = document.getElementById('gbForm');
  var gbSuccess = document.getElementById('gbSuccess');
  var gbWall    = document.getElementById('gbWall');
  var gbEmpty   = document.getElementById('gbEmpty');

  if (!form) return;

  /* --- Load existing messages on page load --- */
  function loadMessages() {
    fetch(API_URL)
      .then(function (res) { return res.json(); })
      .then(function (messages) { renderMessages(messages); })
      .catch(function () {
        // Silently fail — show empty state
        renderMessages([]);
      });
  }

  /* --- Render messages to the wall --- */
  function renderMessages(messages) {
    Array.from(gbWall.querySelectorAll('.gb-message')).forEach(function (el) { el.remove(); });

    if (!messages || messages.length === 0) {
      gbEmpty.style.display = 'block';
      return;
    }

    gbEmpty.style.display = 'none';

    messages.forEach(function (msg) {
      var card = document.createElement('div');
      card.className = 'gb-message';
      card.innerHTML =
        '<p class="gb-message__text">"' + escapeHtml(msg.message) + '"</p>' +
        '<span class="gb-message__author">— ' + escapeHtml(msg.name) + '</span>';
      gbWall.appendChild(card);
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
        form.style.display        = 'none';
        gbSuccess.style.display   = 'block';
        // Add the new message to the wall immediately
        if (data.approved) {
          var newMsg = [{ name: name, message: message, timestamp: new Date().toISOString() }];
          var existing = Array.from(gbWall.querySelectorAll('.gb-message')).map(function (el) {
            return {
              name:    el.querySelector('.gb-message__author').textContent.replace('— ', ''),
              message: el.querySelector('.gb-message__text').textContent.replace(/^"|"$/g, ''),
              timestamp: '',
            };
          });
          renderMessages(newMsg.concat(existing));
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
