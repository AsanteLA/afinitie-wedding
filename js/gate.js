/* ============================================================
   AFINITIE WEDDING — GATE + INVITE TOKEN SYSTEM

   Three ways to unlock the site:
     1. URL token  → ?invite=CODE  (QR codes, digital invites)
     2. Password   → afinitie2026  (fallback / manual entry)
     3. localStorage → remembered on return visits (same browser)

   Invite tiers (for future tiered schedule):
     full      → wf9k2mxp   (sealing + luncheon + reception)
     luncheon  → n4wr9tlv   (luncheon + reception)
     reception → x2hj6nbc   (reception only)
   ============================================================ */

(function () {
  'use strict';

  var SITE_PASSWORD = 'afinitie2026';

  var INVITE_TOKENS = {
    'wf9k2mxp': 'full',
    'n4wr9tlv': 'luncheon',
    'x2hj6nbc': 'reception'
  };

  /* ── 1. Check URL for invite token ── */
  var params = new URLSearchParams(window.location.search);
  var token  = params.get('invite');

  if (token && INVITE_TOKENS[token]) {
    localStorage.setItem('afinitie_auth', '1');
    localStorage.setItem('afinitie_tier', INVITE_TOKENS[token]);

    // Clean token from URL without reloading
    params.delete('invite');
    var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null, '', clean);

    // Show RSVP check modal on first-ever scan only
    if (!localStorage.getItem('afinitie_welcomed')) {
      showRsvpCheckModal();
      return;
    }
  }

  /* ── 2. Already authenticated ── */
  if (localStorage.getItem('afinitie_auth') === '1') return;

  /* ── 3. Show password gate ── */
  var overlay = document.createElement('div');
  overlay.id = 'gate-overlay';
  overlay.innerHTML = [
    '<div id="gate-box">',
    '  <img src="images/logo.png" alt="Afinitie" id="gate-logo" />',
    '  <p id="gate-subtitle">You\'re invited — enter the passcode to continue.</p>',
    '  <form id="gate-form">',
    '    <input type="password" id="gate-input" placeholder="Passcode" autocomplete="off" />',
    '    <button type="submit">Enter</button>',
    '  </form>',
    '  <p id="gate-error" style="display:none;">Incorrect passcode. Try again.</p>',
    '</div>',
  ].join('');

  var gateStyle = document.createElement('style');
  gateStyle.textContent = [
    '#gate-overlay{position:fixed;inset:0;background:var(--color-bg,#faf6f0);z-index:9999;display:flex;align-items:center;justify-content:center;padding:2rem;}',
    '#gate-box{text-align:center;max-width:380px;width:100%;}',
    '#gate-logo{height:80px;width:auto;margin:0 auto 1.5rem;display:block;}',
    '#gate-subtitle{font-family:"Jost",sans-serif;font-size:0.85rem;letter-spacing:0.08em;color:#5a6a7a;margin-bottom:1.5rem;}',
    '#gate-form{display:flex;flex-direction:column;gap:0.75rem;}',
    '#gate-input{width:100%;padding:0.85rem 1rem;border:1px solid #e2d8cc;background:#fff;font-family:"Jost",sans-serif;font-size:1rem;text-align:center;letter-spacing:0.2em;outline:none;}',
    '#gate-input:focus{border-color:#0c6870;}',
    '#gate-form button{padding:0.85rem;background:#c4601a;color:#fff;border:none;font-family:"Jost",sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;}',
    '#gate-form button:hover{background:#0c6870;}',
    '#gate-error{color:#c4601a;font-size:0.8rem;margin-top:0.5rem;letter-spacing:0.05em;}',
  ].join('');

  document.head.appendChild(gateStyle);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  document.getElementById('gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var val = document.getElementById('gate-input').value.trim();
    if (val === SITE_PASSWORD) {
      localStorage.setItem('afinitie_auth', '1');
      localStorage.setItem('afinitie_tier', 'full');
      overlay.remove();
      document.body.style.overflow = '';
    } else {
      document.getElementById('gate-error').style.display = 'block';
      document.getElementById('gate-input').value = '';
      document.getElementById('gate-input').focus();
    }
  });

  /* ── RSVP check modal (first QR scan only) ─────────────────── */

  function showRsvpCheckModal() {
    var modal = document.createElement('div');
    modal.id = 'rsvp-check-overlay';
    modal.innerHTML = [
      '<div id="rsvp-check-box">',
      '  <img src="images/logo.png" alt="Afinitie" class="gate-logo-img" />',
      '  <p class="rsvp-check-eyebrow">Abbie &amp; Asante · September 15, 2026</p>',
      '  <h2 class="rsvp-check-heading">Welcome!</h2>',
      '  <div class="rsvp-check-divider"></div>',
      '  <p class="rsvp-check-sub">Have you already submitted your RSVP?</p>',
      '  <div class="rsvp-check-btns">',
      '    <button id="rsvp-check-yes">Yes, I\'ve RSVPed</button>',
      '    <button id="rsvp-check-no">No, take me there</button>',
      '  </div>',
      '</div>',
    ].join('');

    var modalStyle = document.createElement('style');
    modalStyle.textContent = [
      '#rsvp-check-overlay{position:fixed;inset:0;background:var(--color-bg,#faf6f0);z-index:9999;display:flex;align-items:center;justify-content:center;padding:2rem;}',
      '#rsvp-check-box{text-align:center;max-width:420px;width:100%;}',
      '.gate-logo-img{height:80px;width:auto;margin:0 auto 1.5rem;display:block;filter:brightness(0) saturate(100%) invert(30%) sepia(80%) saturate(700%) hue-rotate(155deg) brightness(85%);}',
      '.rsvp-check-eyebrow{font-family:"Jost",sans-serif;font-size:0.7rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#c89020;margin:0 0 0.75rem;}',
      '.rsvp-check-heading{font-family:"Cormorant Garamond",Georgia,serif;font-size:clamp(2rem,6vw,3rem);font-weight:300;color:#0c6870;margin:0 0 0.5rem;line-height:1.1;}',
      '.rsvp-check-divider{width:50px;height:1px;background:#c89020;margin:0.75rem auto 1.25rem;}',
      '.rsvp-check-sub{font-family:"Jost",sans-serif;font-size:1rem;color:#5a6a7a;margin:0 0 2rem;line-height:1.6;}',
      '.rsvp-check-btns{display:flex;flex-direction:column;gap:0.75rem;}',
      '.rsvp-check-btns button{width:100%;padding:0.9rem 1rem;font-family:"Jost",sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;border:none;cursor:pointer;transition:background 0.2s,color 0.2s;}',
      '#rsvp-check-yes{background:#0c6870;color:#fff;}',
      '#rsvp-check-yes:hover{background:#094f56;}',
      '#rsvp-check-no{background:transparent;color:#0c6870;border:1px solid #0c6870;}',
      '#rsvp-check-no:hover{background:#0c6870;color:#fff;}',
    ].join('');

    document.head.appendChild(modalStyle);
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('rsvp-check-yes').addEventListener('click', function () {
      localStorage.setItem('afinitie_welcomed', '1');
      window.location.href = 'index.html';
    });

    document.getElementById('rsvp-check-no').addEventListener('click', function () {
      localStorage.setItem('afinitie_welcomed', '1');
      window.location.href = 'rsvp.html';
    });
  }

})();
