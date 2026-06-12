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
  var params  = new URLSearchParams(window.location.search);
  var token   = params.get('invite');

  if (token && INVITE_TOKENS[token]) {
    localStorage.setItem('afinitie_auth', '1');
    localStorage.setItem('afinitie_tier', INVITE_TOKENS[token]);
    // Clean token from URL without reloading
    params.delete('invite');
    var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null, '', clean);
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

  var style = document.createElement('style');
  style.textContent = [
    '#gate-overlay{position:fixed;inset:0;background:var(--color-bg,#faf6f0);z-index:9999;display:flex;align-items:center;justify-content:center;padding:2rem;}',
    '#gate-box{text-align:center;max-width:380px;width:100%;}',
    '#gate-logo{height:80px;width:auto;margin:0 auto 1.5rem;display:block;}',
    '#gate-subtitle{font-family:"Jost",sans-serif;font-size:0.85rem;letter-spacing:0.08em;color:#5a6a7a;margin-bottom:1.5rem;}',
    '#gate-form{display:flex;flex-direction:column;gap:0.75rem;}',
    '#gate-input{width:100%;padding:0.85rem 1rem;border:1px solid #e2d8cc;background:#fff;font-family:"Jost",sans-serif;font-size:1rem;text-align:center;letter-spacing:0.2em;outline:none;}',
    '#gate-input:focus{border-color:#6b1a2a;}',
    '#gate-form button{padding:0.85rem;background:#c4601a;color:#fff;border:none;font-family:"Jost",sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;}',
    '#gate-form button:hover{background:#6b1a2a;}',
    '#gate-error{color:#c4601a;font-size:0.8rem;margin-top:0.5rem;letter-spacing:0.05em;}',
  ].join('');

  document.head.appendChild(style);
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

})();
