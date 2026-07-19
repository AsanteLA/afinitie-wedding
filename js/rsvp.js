/* ============================================================
   AFINITIE WEDDING — RSVP FORM JS
   Tier-aware event attendance + per-event guest steppers
   ============================================================ */

(function () {
  'use strict';

  const form            = document.getElementById('rsvpForm');
  const formSuccess     = document.getElementById('formSuccess');
  const dietaryGroup    = document.getElementById('dietaryGroup');
  const songGroup       = document.getElementById('songGroup');
  const attendingLabel  = document.getElementById('attendingLabel');
  const attendingOptions= document.getElementById('attendingOptions');

  if (!form) return;

  const API_URL = 'https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/rsvp';

  // Read tier — null/undefined treated as full
  const tier = localStorage.getItem('afinitie_tier') || 'full';

  // ── Show/hide dietary + song fields ─────────────────────────

  function showFields(show) {
    dietaryGroup.style.display = show ? 'block' : 'none';
    songGroup.style.display    = show ? 'block' : 'none';
  }

  // ── Stepper helpers ──────────────────────────────────────────

  function buildStepper(evId) {
    return `
      <div class="event-stepper" id="${evId}-stepper">
        <span class="event-stepper__label">Guests attending</span>
        <div class="event-stepper__controls">
          <button type="button" class="stepper-btn stepper-minus" data-for="${evId}" aria-label="Remove guest" disabled>−</button>
          <span class="stepper-count" id="${evId}-count">1</span>
          <button type="button" class="stepper-btn stepper-plus" data-for="${evId}" aria-label="Add guest">+</button>
        </div>
      </div>`;
  }

  function wireStepper(evId) {
    var stepper  = document.getElementById(evId + '-stepper');
    var countEl  = document.getElementById(evId + '-count');
    var minusBtn = stepper.querySelector('.stepper-minus');
    var plusBtn  = stepper.querySelector('.stepper-plus');

    function updateButtons(n) {
      minusBtn.disabled = (n <= 1);
      plusBtn.disabled  = (n >= 10);
    }

    minusBtn.addEventListener('click', function () {
      var n = Math.max(parseInt(countEl.textContent) - 1, 1);
      countEl.textContent = n;
      updateButtons(n);
    });

    plusBtn.addEventListener('click', function () {
      var n = Math.min(parseInt(countEl.textContent) + 1, 10);
      countEl.textContent = n;
      updateButtons(n);
    });
  }

  function openStepper(evId) {
    var stepper = document.getElementById(evId + '-stepper');
    var option  = stepper.closest('.check-option');
    stepper.style.display = 'flex';
    option.classList.add('stepper-open');
  }

  function closeStepper(evId) {
    var stepper = document.getElementById(evId + '-stepper');
    var option  = stepper.closest('.check-option');
    stepper.style.display = 'none';
    option.classList.remove('stepper-open');
    document.getElementById(evId + '-count').textContent = '1';
    // reset button states
    stepper.querySelector('.stepper-minus').disabled = true;
    stepper.querySelector('.stepper-plus').disabled  = false;
  }

  function getCount(evId) {
    var el = document.getElementById(evId + '-count');
    return el ? parseInt(el.textContent) || 1 : 1;
  }

  // ── Build attendance UI ───────────────────────────────────────

  if (tier === 'reception') {
    // Simple yes / no + stepper when yes
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
      <div id="reception-stepper-wrap" style="display:none; margin-top:0.75rem;">
        <div class="check-option stepper-open" style="border:1px solid var(--color-border); border-radius:var(--radius);">
          <div class="event-stepper" id="ev-reception-stepper" style="display:flex; border-radius:var(--radius);">
            <span class="event-stepper__label">Guests attending</span>
            <div class="event-stepper__controls">
              <button type="button" class="stepper-btn stepper-minus" data-for="ev-reception" aria-label="Remove guest" disabled>−</button>
              <span class="stepper-count" id="ev-reception-count">1</span>
              <button type="button" class="stepper-btn stepper-plus" data-for="ev-reception" aria-label="Add guest">+</button>
            </div>
          </div>
        </div>
      </div>
    `;

    wireStepper('ev-reception');

    attendingOptions.querySelectorAll('input[name="attending"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var isYes = this.value === 'yes';
        document.getElementById('reception-stepper-wrap').style.display = isYes ? 'block' : 'none';
        showFields(isYes);
      });
    });

  } else {
    // Full or luncheon — event checkboxes with per-event steppers
    attendingLabel.textContent = 'Which events will you attend?';

    var events = [];
    if (tier === 'full') {
      events.push({ id: 'ev-sealing',   label: 'Temple Sealing', time: '12:00 PM' });
    }
    events.push({ id: 'ev-ring',      label: 'Ring Ceremony',  time: '2:30 PM' });
    events.push({ id: 'ev-luncheon',  label: 'Luncheon',        time: '4:00 PM' });
    events.push({ id: 'ev-reception', label: 'Reception',        time: '7:00 PM' });

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
              ${buildStepper(ev.id)}
            </div>`;
        }).join('')}
      </div>
      <div class="check-option check-option--decline">
        <input type="checkbox" id="ev-decline" value="yes" />
        <label for="ev-decline" class="check-option__label">
          <span class="check-option__text">Regretfully, I'm unable to attend</span>
        </label>
      </div>
    `;

    // Wire all steppers
    events.forEach(function (ev) { wireStepper(ev.id); });

    var eventCbs  = attendingOptions.querySelectorAll('.event-checkbox');
    var declineCb = document.getElementById('ev-decline');

    function anyEventChecked() {
      return Array.from(eventCbs).some(function (c) { return c.checked; });
    }

    eventCbs.forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) {
          openStepper(this.id);
          declineCb.checked = false;
        } else {
          closeStepper(this.id);
        }
        showFields(anyEventChecked());
      });
    });

    declineCb.addEventListener('change', function () {
      if (this.checked) {
        eventCbs.forEach(function (c) {
          if (c.checked) { c.checked = false; closeStepper(c.id); }
        });
        showFields(false);
      }
    });
  }

  // ── Validation ────────────────────────────────────────────────

  function validate() {
    var name  = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();

    if (!name)  { alert('Please enter your full name.'); return false; }
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
    var sealing_count = '0', ring_count = '0', luncheon_count = '0', reception_count = '0';

    if (tier === 'reception') {
      attending     = attendingOptions.querySelector('input[name="attending"]:checked').value;
      sealing       = 'na';
      ring_ceremony = 'na';
      luncheon      = 'na';
      reception     = attending === 'yes' ? 'yes' : 'no';
      if (attending === 'yes') {
        reception_count = String(getCount('ev-reception'));
      }
    } else {
      var sealingCb  = document.getElementById('ev-sealing');
      var ringCb     = document.getElementById('ev-ring');
      var luncheonCb = document.getElementById('ev-luncheon');
      var recepCb    = document.getElementById('ev-reception');

      sealing       = sealingCb  ? (sealingCb.checked  ? 'yes' : 'no') : 'na';
      ring_ceremony = ringCb     ? (ringCb.checked      ? 'yes' : 'no') : 'na';
      luncheon      = luncheonCb ? (luncheonCb.checked  ? 'yes' : 'no') : 'na';
      reception     = recepCb    ? (recepCb.checked     ? 'yes' : 'no') : 'na';

      if (sealing       === 'yes') sealing_count   = String(getCount('ev-sealing'));
      if (ring_ceremony === 'yes') ring_count      = String(getCount('ev-ring'));
      if (luncheon      === 'yes') luncheon_count  = String(getCount('ev-luncheon'));
      if (reception     === 'yes') reception_count = String(getCount('ev-reception'));

      var anyYes = [sealing, ring_ceremony, luncheon, reception].some(function (v) { return v === 'yes'; });
      attending = anyYes ? 'yes' : 'no';
    }

    // Overall guests = max headcount across all attended events
    var counts = [sealing_count, ring_count, luncheon_count, reception_count].map(Number);
    var maxCount = Math.max.apply(null, counts);
    var overallGuests = String(maxCount > 0 ? maxCount : (attending === 'yes' ? 1 : 0));

    // Update hidden field
    var guestsHidden = document.getElementById('guests');
    if (guestsHidden) guestsHidden.value = overallGuests;

    var isAttending = attending === 'yes';
    return {
      name:           name,
      email:          email,
      attending:      attending,
      tier:           tier,
      sealing:        sealing,
      ring_ceremony:  ring_ceremony,
      luncheon:       luncheon,
      reception:      reception,
      sealing_count:  sealing_count,
      ring_count:     ring_count,
      luncheon_count: luncheon_count,
      reception_count: reception_count,
      guests:         overallGuests,
      dietary:        isAttending ? document.getElementById('dietary').value.trim() : '',
      song:           isAttending ? document.getElementById('song').value.trim() : '',
      message:        message,
      timestamp:      new Date().toISOString(),
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
