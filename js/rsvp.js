/* ============================================================
   AFINITIE WEDDING — RSVP FORM JS
   Tier-aware event attendance + form submission
   ============================================================ */

(function () {
  'use strict';

  const form            = document.getElementById('rsvpForm');
  const formSuccess     = document.getElementById('formSuccess');
  const guestCountGroup = document.getElementById('guestCountGroup');
  const dietaryGroup    = document.getElementById('dietaryGroup');
  const songGroup       = document.getElementById('songGroup');
  const attendingLabel  = document.getElementById('attendingLabel');
  const attendingOptions= document.getElementById('attendingOptions');

  if (!form) return;

  const API_URL = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/rsvp';

  // Read tier — null/undefined treated as full
  const tier = localStorage.getItem('afinitie_tier') || 'full';

  // ── Build attendance UI ───────────────────────────────────────

  function showFields(show) {
    guestCountGroup.style.display = show ? 'block' : 'none';
    dietaryGroup.style.display    = show ? 'block' : 'none';
    songGroup.style.display       = show ? 'block' : 'none';
  }

  if (tier === 'reception') {
    // Simple yes / no
    attendingLabel.textContent = 'Will you be attending?';
    attendingOptions.innerHTML = `
      <div class="radio-group">
        <div class="radio-option">
          <input type="radio" id="ev-yes" name="attending" value="yes" required />
          <label for="ev-yes">Joyfully accepts</label>
        </div>
        <div class="radio-option">
          <input type="radio" id="ev-no" name="attending" value="no" />
          <label for="ev-no">Regretfully declines</label>
        </div>
      </div>
    `;
    attendingOptions.querySelectorAll('input[name="attending"]').forEach(function (r) {
      r.addEventListener('change', function () { showFields(this.value === 'yes'); });
    });

  } else {
    // Full or luncheon — event checkboxes
    attendingLabel.textContent = 'Which events will you attend?';

    const events = [];
    if (tier === 'full') {
      events.push({ id: 'ev-sealing',      label: 'Temple Sealing', time: '12:00 PM' });
    }
    events.push({ id: 'ev-ring',         label: 'Ring Ceremony',   time: '2:30 PM' });
    events.push({ id: 'ev-luncheon',     label: 'Luncheon',         time: '4:00 PM' });
    events.push({ id: 'ev-reception',    label: 'Reception',         time: '7:00 PM' });

    attendingOptions.innerHTML = `
      <div class="event-check-group">
        ${events.map(function (ev) {
          return `
            <div class="check-option">
              <input type="checkbox" id="${ev.id}" value="yes" class="event-checkbox" />
              <label for="${ev.id}" class="check-option__label">
                <span class="check-option__text">
                  <strong>${ev.label}</strong>
                  <span class="check-option__time">${ev.time}</span>
                </span>
              </label>
            </div>
          `;
        }).join('')}
      </div>
      <div class="check-option check-option--decline">
        <input type="checkbox" id="ev-decline" value="yes" />
        <label for="ev-decline" class="check-option__label">
          <span class="check-option__text">Regretfully, I'm unable to attend</span>
        </label>
      </div>
    `;

    var eventCbs  = attendingOptions.querySelectorAll('.event-checkbox');
    var declineCb = document.getElementById('ev-decline');

    function anyEventChecked() {
      return Array.from(eventCbs).some(function (c) { return c.checked; });
    }

    eventCbs.forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) declineCb.checked = false;
        showFields(anyEventChecked());
      });
    });

    declineCb.addEventListener('change', function () {
      if (this.checked) {
        eventCbs.forEach(function (c) { c.checked = false; });
        showFields(false);
      }
    });
  }

  // ── Validation ────────────────────────────────────────────────

  function validate() {
    var name  = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();

    if (!name) { alert('Please enter your full name.'); return false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.'); return false;
    }

    if (tier === 'reception') {
      if (!attendingOptions.querySelector('input[name="attending"]:checked')) {
        alert('Please let us know if you\'ll be attending.'); return false;
      }
    } else {
      var anyChecked = attendingOptions.querySelectorAll('.event-checkbox:checked').length > 0;
      var declined   = document.getElementById('ev-decline').checked;
      if (!anyChecked && !declined) {
        alert('Please select which events you\'ll attend, or let us know you\'re unable to make it.');
        return false;
      }
    }
    return true;
  }

  // ── Collect data ──────────────────────────────────────────────

  function collectData() {
    var name    = document.getElementById('name').value.trim();
    var email   = document.getElementById('email').value.trim();
    var message = document.getElementById('message').value.trim();
    var attending, sealing, ring_ceremony, luncheon, reception;

    if (tier === 'reception') {
      attending    = attendingOptions.querySelector('input[name="attending"]:checked').value;
      sealing      = 'na';
      ring_ceremony = 'na';
      luncheon     = 'na';
      reception    = attending === 'yes' ? 'yes' : 'no';
    } else {
      var sealingCb  = document.getElementById('ev-sealing');
      var ringCb     = document.getElementById('ev-ring');
      var luncheonCb = document.getElementById('ev-luncheon');
      var recepCb    = document.getElementById('ev-reception');

      sealing       = sealingCb  ? (sealingCb.checked  ? 'yes' : 'no') : 'na';
      ring_ceremony = ringCb     ? (ringCb.checked      ? 'yes' : 'no') : 'na';
      luncheon      = luncheonCb ? (luncheonCb.checked  ? 'yes' : 'no') : 'na';
      reception     = recepCb    ? (recepCb.checked     ? 'yes' : 'no') : 'na';

      var anyYes = [sealing, ring_ceremony, luncheon, reception].some(function (v) { return v === 'yes'; });
      attending = anyYes ? 'yes' : 'no';
    }

    var isAttending = attending === 'yes';
    return {
      name:         name,
      email:        email,
      attending:    attending,
      tier:         tier,
      sealing:      sealing,
      ring_ceremony: ring_ceremony,
      luncheon:     luncheon,
      reception:    reception,
      guests:    isAttending ? document.getElementById('guests').value : '0',
      dietary:   isAttending ? document.getElementById('dietary').value.trim() : '',
      song:      isAttending ? document.getElementById('song').value.trim() : '',
      message:   message,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Submit ────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    var data = collectData();
    var btn  = form.querySelector('button[type="submit"]');
    btn.disabled    = true;
    btn.textContent = 'Sending…';

    try {
      var res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        alert('Something went wrong. Please try again.');
        btn.disabled    = false;
        btn.textContent = 'Send RSVP';
        return;
      }
    } catch (err) {
      alert('Could not submit — please check your connection and try again.');
      btn.disabled    = false;
      btn.textContent = 'Send RSVP';
      return;
    }

    form.style.display        = 'none';
    formSuccess.style.display = 'block';
    window.scrollTo({ top: formSuccess.offsetTop - 100, behavior: 'smooth' });
  }

  form.addEventListener('submit', handleSubmit);

})();
