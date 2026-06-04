/* ============================================================
   AFINITIE WEDDING — RSVP FORM JS
   Form validation + conditional fields + submission handler

   NOTE: This currently logs to console on submit.
   When you're ready to wire up a backend (e.g. AWS Lambda +
   API Gateway, or a form service like Formspree / Netlify Forms),
   replace the TODO section in handleSubmit() below.
   ============================================================ */

(function () {
  'use strict';

  const form             = document.getElementById('rsvpForm');
  const formSuccess      = document.getElementById('formSuccess');
  const attendingRadios  = document.querySelectorAll('input[name="attending"]');
  const guestCountGroup  = document.getElementById('guestCountGroup');
  const dietaryGroup     = document.getElementById('dietaryGroup');
  const songGroup        = document.getElementById('songGroup');

  if (!form) return;

  /* --- Show / hide conditional fields based on attendance --- */
  attendingRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      const attending = this.value === 'yes';
      guestCountGroup.style.display = attending ? 'block' : 'none';
      dietaryGroup.style.display    = attending ? 'block' : 'none';
      songGroup.style.display       = attending ? 'block' : 'none';
    });
  });

  /* --- Simple client-side validation --- */
  function validate() {
    const name      = document.getElementById('name').value.trim();
    const email     = document.getElementById('email').value.trim();
    const attending = document.querySelector('input[name="attending"]:checked');

    if (!name) {
      alert('Please enter your full name.');
      return false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
      return false;
    }
    if (!attending) {
      alert('Please let us know if you\'ll be attending.');
      return false;
    }
    return true;
  }

  /* --- Build form data object --- */
  function collectData() {
    const attending = document.querySelector('input[name="attending"]:checked').value;
    return {
      name:      document.getElementById('name').value.trim(),
      email:     document.getElementById('email').value.trim(),
      attending: attending,
      guests:    attending === 'yes' ? document.getElementById('guests').value : '0',
      dietary:   attending === 'yes' ? document.getElementById('dietary').value.trim() : '',
      song:      attending === 'yes' ? document.getElementById('song').value.trim() : '',
      message:   document.getElementById('message').value.trim(),
      timestamp: new Date().toISOString(),
    };
  }

  /* --- Submit handler --- */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const data = collectData();
    console.log('RSVP submission:', data);

    // ---- Paste your API Gateway URL here after deploying ----
    var API_URL = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/rsvp';

    try {
      var res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) { alert('Something went wrong. Please try again.'); return; }
    } catch (err) {
      alert('Could not submit — please check your connection and try again.');
      return;
    }

    // Show success state
    form.style.display        = 'none';
    formSuccess.style.display = 'block';
    window.scrollTo({ top: formSuccess.offsetTop - 100, behavior: 'smooth' });
  }

  form.addEventListener('submit', handleSubmit);

})();
