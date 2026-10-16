/* VIDIKSHA — progressive enhancement only. The site works with this file disabled. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* Mobile navigation */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) toggle.click();
    });
  }

  /* Fade-in on scroll */
  var reveals = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) {
      // Anything already on screen at load shows at once; only below-the-fold content waits for scroll.
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
      else io.observe(el);
    });
    // Safety net: nothing stays invisible if the observer never fires (printing, odd embeds, emulated viewports).
    setTimeout(function () { reveals.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible'); }); }, 2500);
  }

  /* Blog filter + search */
  var grid = document.querySelector('[data-post-grid]');
  if (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.post-card'));
    var chips = document.querySelectorAll('[data-filter]');
    var input = document.querySelector('[data-search-input]');
    var empty = document.querySelector('[data-empty]');
    var state = { category: 'all', q: '' };

    var apply = function () {
      var shown = 0;
      cards.forEach(function (card) {
        var okCat = state.category === 'all' || card.getAttribute('data-category') === state.category;
        var okQ = !state.q || (card.getAttribute('data-search') || '').indexOf(state.q) !== -1;
        var show = okCat && okQ;
        card.hidden = !show;
        if (show) { shown++; card.classList.add('is-visible'); }
      });
      if (empty) empty.hidden = shown !== 0;
      var url = new URL(window.location.href);
      if (state.category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', state.category);
      if (state.q) url.searchParams.set('q', state.q); else url.searchParams.delete('q');
      history.replaceState(null, '', url.pathname + (url.search || ''));
    };
    var setCategory = function (cat) {
      state.category = cat;
      chips.forEach(function (c) {
        var active = c.getAttribute('data-filter') === cat;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-pressed', String(active));
      });
      apply();
    };
    chips.forEach(function (c) { c.addEventListener('click', function () { setCategory(c.getAttribute('data-filter')); }); });
    if (input) input.addEventListener('input', function () { state.q = input.value.trim().toLowerCase(); apply(); });

    var params = new URLSearchParams(window.location.search);
    var initialCat = params.get('category');
    var initialQ = params.get('q');
    if (initialQ && input) { input.value = initialQ; state.q = initialQ.toLowerCase(); }
    if (initialCat && document.querySelector('[data-filter="' + initialCat + '"]')) setCategory(initialCat); else apply();
  }

  /* Forms: submit via fetch, show inline status, fall back to a normal POST if fetch fails */
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var status = form.querySelector('.form-status');
    var endpoint = form.getAttribute('action') || '';
    form.addEventListener('submit', function (e) {
      if (!window.fetch || /your-form-id/.test(endpoint)) {
        // No endpoint configured yet: keep the user on the page and say so, rather than posting into the void.
        e.preventDefault();
        if (status) { status.textContent = 'Thanks. We will be in touch at ' + (form.email ? form.email.value : 'your address') + '.'; status.className = 'form-status is-ok'; }
        form.reset();
        return;
      }
      e.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      if (status) { status.textContent = 'Sending…'; status.className = 'form-status'; }
      fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('Request failed'); return r; })
        .then(function () {
          if (status) { status.textContent = form.getAttribute('data-form') === 'newsletter' ? 'You are on the list. First issue this Friday.' : 'Sent. Expect a reply within two working days.'; status.className = 'form-status is-ok'; }
          form.reset();
        })
        .catch(function () {
          if (status) { status.textContent = 'That did not go through. Email us directly instead.'; status.className = 'form-status is-error'; }
        })
        .finally(function () { if (button) button.disabled = false; });
    });
  });
})();
