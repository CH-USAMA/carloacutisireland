/* ==========================================================================
   THE CATALOGUE — behaviour
   No dependencies. Everything here is enhancement: with JavaScript off the
   whole catalogue still renders, every record is readable, plate records
   link straight to their photograph and film records link to YouTube.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  doc.documentElement.classList.remove('no-js');
  doc.documentElement.classList.add('js');

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var index = doc.getElementById('index');
  if (!index) return;

  var records = [].slice.call(index.querySelectorAll('.rec'));
  var empty = doc.getElementById('noresult');

  /* ----------------------------------------------------------------------
     Filtering and search.

     Catalogue numbers never change. In a real archive the number IS the
     record's identity, so filtering moves the cards, it does not renumber
     them. Movement is done with FLIP: measure, re-layout, invert, release —
     so records visibly travel to their new positions rather than blinking.
  ---------------------------------------------------------------------- */
  var activeFilter = 'all';
  var query = '';

  function matches(rec) {
    var kind = rec.dataset.kind || '';
    var okFilter = activeFilter === 'all' || kind.split(' ').indexOf(activeFilter) > -1;
    if (!okFilter) return false;
    if (!query) return true;
    return (rec.dataset.search || rec.textContent).toLowerCase().indexOf(query) > -1;
  }

  function apply() {
    var first = {};
    if (!reduce) {
      records.forEach(function (r, i) {
        if (!r.classList.contains('is-out')) first[i] = r.getBoundingClientRect().top;
      });
    }

    var shown = 0;
    records.forEach(function (r) {
      var ok = matches(r);
      r.classList.toggle('is-out', !ok);
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown !== 0;
    updateCounts(shown);

    if (reduce) return;

    // Invert: put each surviving record back where it was, then release.
    index.classList.add('is-sorting');
    records.forEach(function (r, i) {
      if (r.classList.contains('is-out') || first[i] === undefined) return;
      var delta = first[i] - r.getBoundingClientRect().top;
      if (!delta) return;
      r.style.transform = 'translateY(' + delta + 'px)';
      r.style.transitionDuration = '0s';
    });
    requestAnimationFrame(function () {
      records.forEach(function (r) {
        if (!r.style.transform) return;
        r.style.transitionDuration = '';
        r.style.transform = '';
      });
      setTimeout(function () { index.classList.remove('is-sorting'); }, 560);
    });
  }

  function updateCounts(shown) {
    var c = doc.getElementById('count');
    if (c) c.textContent = String(shown).padStart(2, '0');
    var t = doc.getElementById('spine-count');
    if (t) t.textContent = String(shown).padStart(2, '0') + ' / ' + String(records.length).padStart(2, '0');
  }

  [].forEach.call(doc.querySelectorAll('.filters button'), function (btn) {
    btn.addEventListener('click', function () {
      activeFilter = btn.dataset.filter;
      [].forEach.call(doc.querySelectorAll('.filters button'), function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      apply();
    });
  });

  var search = doc.getElementById('search');
  if (search) {
    search.addEventListener('input', function () {
      query = search.value.trim().toLowerCase();
      apply();
    });
    // Escape clears rather than trapping the visitor in a filtered view.
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && search.value) { search.value = ''; query = ''; apply(); }
    });
  }

  updateCounts(records.length);

  /* ----------------------------------------------------------------------
     THE PLATE — a record gives way to the photograph that evidences it.
     Openable records are real links, so this is interception, not invention.
  ---------------------------------------------------------------------- */
  var plate = doc.getElementById('plate');
  if (!plate) return;

  var figure = plate.querySelector('.plate-fig');
  var pImg = plate.querySelector('.plate-fig img');
  var pNo = plate.querySelector('.plate-no');
  var pTtl = plate.querySelector('.plate-cap');
  var pMeta = plate.querySelector('.plate-meta');
  var pPrev = plate.querySelector('[data-plate-prev]');
  var pNext = plate.querySelector('[data-plate-next]');
  var openable = records.filter(function (r) { return r.hasAttribute('data-plate'); });
  var at = -1, opener = null, frame = null;

  function paint(i) {
    at = i;
    var r = openable[i];
    // Clear any film that was playing before showing another plate.
    if (frame) { frame.remove(); frame = null; }
    pImg.hidden = false;

    var film = r.dataset.film;
    pImg.src = r.dataset.plate;
    pImg.alt = r.dataset.alt || '';
    pNo.textContent = r.dataset.plateNo || '';
    pTtl.textContent = r.dataset.caption || '';
    pMeta.textContent = r.dataset.meta || '';
    if (pPrev) pPrev.disabled = i === 0;
    if (pNext) pNext.disabled = i === openable.length - 1;

    // A film record plays in place of the still, once asked.
    if (film) {
      frame = doc.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(film) +
                  '?autoplay=1&rel=0&modestbranding=1';
      frame.title = r.dataset.caption || 'Film';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      pImg.hidden = true;
      figure.appendChild(frame);
    }
  }

  function open(i, from) {
    opener = from || null;
    paint(i);
    plate.classList.add('is-open');
    plate.removeAttribute('aria-hidden');
    doc.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { plate.classList.add('is-shown'); });
    plate.focus();
  }

  function close() {
    plate.classList.remove('is-shown');
    var done = function () {
      plate.classList.remove('is-open');
      plate.setAttribute('aria-hidden', 'true');
      pImg.removeAttribute('src');
      if (frame) { frame.remove(); frame = null; }
      doc.body.style.overflow = '';
      if (opener) opener.focus();
    };
    if (reduce) { done(); return; }
    setTimeout(done, 240);
  }

  function step(d) {
    var n = at + d;
    if (n < 0 || n >= openable.length) return;
    paint(n);
  }

  openable.forEach(function (r, i) {
    r.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // let people open in a tab
      e.preventDefault();
      open(i, r);
    });
  });

  plate.addEventListener('click', function (e) {
    if (e.target.closest('[data-plate-close]')) return close();
    if (e.target.closest('[data-plate-prev]')) return step(-1);
    if (e.target.closest('[data-plate-next]')) return step(1);
    if (e.target === plate) close();
  });

  doc.addEventListener('keydown', function (e) {
    if (!plate.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') {
      var f = plate.querySelectorAll('button:not([disabled])');
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && doc.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
})();
