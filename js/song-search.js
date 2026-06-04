/* ============================================================
   AFINITIE WEDDING — SONG AUTOCOMPLETE
   Uses the iTunes Search API (free, no key required).
   Fires after the guest types 2+ characters, debounced 350ms.
   ============================================================ */

(function () {
  'use strict';

  var input    = document.getElementById('song');
  var dropdown = document.getElementById('songDropdown');

  if (!input || !dropdown) return;

  var debounceTimer = null;
  var activeIndex   = -1;
  var currentItems  = [];

  /* --- Debounced input handler --- */
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    var query = this.value.trim();

    if (query.length < 2) {
      closeDropdown();
      return;
    }

    debounceTimer = setTimeout(function () {
      search(query);
    }, 350);
  });

  /* --- Keyboard navigation --- */
  input.addEventListener('keydown', function (e) {
    var items = dropdown.querySelectorAll('li[data-index]');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive(items);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectItem(currentItems[activeIndex]);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  /* --- Close on outside click --- */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#songAutocomplete')) closeDropdown();
  });

  /* --- Fetch from iTunes --- */
  function search(query) {
    showLoading();

    var url = 'https://itunes.apple.com/search?'
      + 'term=' + encodeURIComponent(query)
      + '&entity=song'
      + '&limit=6'
      + '&callback=itunesCallback';

    // Use JSONP to avoid CORS issues
    var existing = document.getElementById('itunes-script');
    if (existing) existing.remove();

    window.itunesCallback = function (data) {
      if (data && data.results && data.results.length) {
        currentItems = data.results;
        renderResults(data.results);
      } else {
        showEmpty();
      }
    };

    var script = document.createElement('script');
    script.id  = 'itunes-script';
    script.src = url;
    script.onerror = showEmpty;
    document.head.appendChild(script);
  }

  /* --- Render results --- */
  function renderResults(results) {
    dropdown.innerHTML = '';
    activeIndex = -1;

    results.forEach(function (track, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', i);

      var art = track.artworkUrl60 || '';
      li.innerHTML =
        (art ? '<img class="song-dropdown__art" src="' + art + '" alt="" />' : '') +
        '<div class="song-dropdown__info">' +
          '<div class="song-dropdown__title">' + escapeHtml(track.trackName) + '</div>' +
          '<div class="song-dropdown__artist">' + escapeHtml(track.artistName) + '</div>' +
        '</div>';

      li.addEventListener('mousedown', function (e) {
        e.preventDefault(); // prevent blur before click
        selectItem(track);
      });

      dropdown.appendChild(li);
    });

    dropdown.classList.add('open');
  }

  /* --- Select a track --- */
  function selectItem(track) {
    input.value = track.artistName + ' — ' + track.trackName;
    closeDropdown();
  }

  /* --- Loading / empty states --- */
  function showLoading() {
    dropdown.innerHTML = '<li class="song-dropdown__loading">Searching…</li>';
    dropdown.classList.add('open');
  }

  function showEmpty() {
    dropdown.innerHTML = '<li class="song-dropdown__empty">No results — try a different search</li>';
    dropdown.classList.add('open');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = [];
  }

  /* --- Keyboard active state --- */
  function updateActive(items) {
    items.forEach(function (el, i) {
      el.classList.toggle('active', i === activeIndex);
    });
  }

  /* --- Escape HTML --- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
