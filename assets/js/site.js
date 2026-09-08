/* ==========================================================================
   Carlo Acutis Ireland — site behaviour
   Vanilla, no dependencies. The old theme shipped jQuery 1.8.3 (2012) plus
   ~1.5MB of Weebly framework to do less than this file does.

   Everything here is progressive enhancement: with JS off you still get the
   full page, working links, a working form and all images.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Sticky header state ---------------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 12);
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Mobile navigation ------------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    var setNav = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', function () {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Close when a link is chosen, or on Escape.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setNav(false);
        toggle.focus();
      }
    });
    // If the viewport grows past the mobile breakpoint, reset to desktop nav.
    var mq = window.matchMedia('(min-width: 901px)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () {
      if (mq.matches) setNav(false);
    });
  }

  /* --- Scroll reveal ------------------------------------------------------
     Elements marked .reveal fade and rise once, when first seen. Anything
     already in view on load is shown immediately so nothing pops in late.
  ---------------------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) { /* nothing to do */ }
  else if (reduceMotion || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Stagger siblings so a row of cards arrives in sequence, not all at once.
        var delay = parseFloat(el.dataset.revealDelay || 0);
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    Array.prototype.forEach.call(reveals, function (el) {
      var group = el.closest('[data-stagger]');
      if (group) {
        var sibs = Array.prototype.slice.call(group.querySelectorAll('.reveal'));
        el.dataset.revealDelay = String(sibs.indexOf(el) * 90);
      }
      io.observe(el);
    });
  }

  /* --- YouTube facades ----------------------------------------------------
     A real iframe is only built when the visitor asks for it, so the page
     loads no third-party script or cookie until then.
  ---------------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('.video'), function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.loaded) return;
      btn.dataset.loaded = '1';
      var id = btn.dataset.videoId;
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
                  '?autoplay=1&rel=0&modestbranding=1';
      frame.title = btn.dataset.videoTitle || 'Video';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      frame.setAttribute('loading', 'lazy');
      btn.appendChild(frame);
    });
  });

  /* --- Lightbox -----------------------------------------------------------
     Small, accessible: arrow keys, Escape, focus returned to the thumbnail
     that opened it, background scroll locked while open.
  ---------------------------------------------------------------------- */
  var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
  if (triggers.length) {
    var lb = document.getElementById('lightbox');
    var lbImg = lb.querySelector('img');
    var lbCount = lb.querySelector('.lb-count');
    var index = 0;
    var opener = null;

    var show = function (i) {
      index = (i + triggers.length) % triggers.length;
      var t = triggers[index];
      lbImg.src = t.dataset.lightbox;
      lbImg.alt = t.dataset.caption || '';
      lbCount.textContent = (index + 1) + ' / ' + triggers.length;
    };

    var open = function (i, from) {
      opener = from || null;
      show(i);
      lb.classList.add('is-open');
      lb.removeAttribute('aria-hidden');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { lb.classList.add('is-visible'); });
      lb.querySelector('.lb-close').focus();
    };

    var close = function () {
      lb.classList.remove('is-visible');
      var done = function () {
        lb.classList.remove('is-open');
        lb.setAttribute('aria-hidden', 'true');
        lbImg.removeAttribute('src');
        document.body.style.overflow = '';
        if (opener) opener.focus();
        lb.removeEventListener('transitionend', done);
      };
      // transitionend may not fire if motion is reduced, so guarantee cleanup.
      lb.addEventListener('transitionend', done);
      setTimeout(done, 340);
    };

    triggers.forEach(function (t, i) {
      t.addEventListener('click', function () { open(i, t); });
    });

    lb.addEventListener('click', function (e) {
      var act = e.target.closest('[data-lb]');
      if (act) {
        var a = act.dataset.lb;
        if (a === 'close') close();
        if (a === 'prev') show(index - 1);
        if (a === 'next') show(index + 1);
        return;
      }
      if (e.target === lb) close(); // click the backdrop
    });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'Tab') { // keep focus inside the dialog
        var f = lb.querySelectorAll('button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* --- Form: stamp the timestamp contact.php checks ---------------------- */
  var ts = document.querySelector('input[name="cai_ts"]');
  if (ts) ts.value = String(Math.floor(Date.now() / 1000));
})();
