/* VIDIKSHA Research: client-side search over the IP case-law index.
   Data is sharded by year under /research/data/; shards load newest-first and results are always newest-first.
   Full text is searched through a sharded inverted index under /research/fts/, fetched per keyword. */
(function () {
  'use strict';
  var root = document.querySelector('[data-research]');
  if (!root) return;

  var els = {
    form: root.querySelector('[data-kw-form]'), input: root.querySelector('[data-kw-input]'), chips: root.querySelector('[data-kw-chips]'),
    count: root.querySelector('[data-count]'), progress: root.querySelector('[data-progress]'), results: root.querySelector('[data-results]'),
    empty: root.querySelector('[data-empty]'), more: root.querySelector('[data-more]'), clear: root.querySelector('[data-clear]'),
    active: root.querySelector('[data-active-filters]'),
    from: root.querySelector('select[name="from"]'), to: root.querySelector('select[name="to"]')
  };
  // Facets: URL key -> record field. Array fields match if any selected value is present; string fields if equal.
  var FACETS = [
    { key: 'area', field: 'a', label: 'Area' }, { key: 'issue', field: 'tp', label: 'Issue' }, { key: 'court', field: 'c', label: 'Court' },
    { key: 'proc', field: 'pr', label: 'Proceeding' }, { key: 'outcome', field: 'o', label: 'Outcome' }, { key: 'length', field: 'ln', label: 'Length' },
    { key: 'bench', field: 'bn', label: 'Bench' }, { key: 'industry', field: 'ind', label: 'Industry' }, { key: 'statute', field: 'st', label: 'Statute' },
    { key: 'judge', field: 'j', label: 'Coram' }
  ];
  FACETS.forEach(function (f) { f.inputs = Array.prototype.slice.call(root.querySelectorAll('input[name="' + f.key + '"]')); });
  var PAGE = 40;
  var state = { keywords: [], loaded: [], total: 0, loadedCount: 0, matches: [], shown: 0, pending: 0 };

  /* ---------- member login (Supabase Auth) ----------
     The research data is served by serve.js only with a valid session token, so every data fetch carries it. */
  var gate = {
    root: document.querySelector('[data-research-gate]'), status: document.querySelector('[data-gate-status]'),
    tabs: document.querySelectorAll('[data-gate-tab]'), forms: document.querySelectorAll('[data-gate-form]'),
    forgot: document.querySelector('[data-gate-forgot]'), bar: root.querySelector('[data-member-bar]'),
    name: root.querySelector('[data-member-name]'), signOut: root.querySelector('[data-sign-out]')
  };
  var sb = null, session = null, started = false;
  var cfg = { url: root.getAttribute('data-supabase-url'), key: root.getAttribute('data-supabase-key') };
  function gateStatus(msg, ok) { if (gate.status) { gate.status.textContent = msg || ''; gate.status.className = 'form-status' + (ok === true ? ' is-ok' : ok === false ? ' is-error' : ''); } }
  function showGate() { if (gate.root) gate.root.hidden = false; root.hidden = true; }
  function showApp(user) {
    if (gate.root) gate.root.hidden = true;
    root.hidden = false;
    if (gate.bar && user) {
      gate.bar.hidden = false;
      gate.name.textContent = 'Signed in as ' + ((user.user_metadata && user.user_metadata.full_name) || user.email);
    }
    if (!started) { started = true; load(); }
  }
  // Where the research data lives. "storage": the private Supabase Storage bucket "research", read with the member's
  // session token (production, GitHub Pages). "local": same-origin paths served by serve.js behind its own check.
  var source = root.getAttribute('data-research-source') === 'storage' && cfg.url ? 'storage' : 'local';
  function dataUrl(sitePath) {
    if (source !== 'storage') return sitePath;
    return cfg.url.replace(/\/$/, '') + '/storage/v1/object/authenticated/research/' + sitePath.replace(/^\/research\//, '');
  }
  function authFetch(url) {
    var headers = {};
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    if (source === 'storage') headers.apikey = cfg.key;
    return fetch(dataUrl(url), { headers: headers }).then(function (r) {
      if ((r.status === 401 || r.status === 400 || r.status === 403) && sb) { showGate(); gateStatus('Please sign in to continue.', false); throw new Error('unauthorised'); }
      return r;
    });
  }
  function recordLogin(user) {
    if (!sb || !user) return;
    sb.from('research_logins').insert({ user_id: user.id, user_agent: navigator.userAgent.slice(0, 200) }).then(function () {});
    sb.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id).then(function () {});
  }
  function initAuth() {
    if (!cfg.url || !cfg.key || !window.supabase) {
      // No Supabase configured (local development): no gate, data served openly by serve.js.
      if (gate.root) gate.root.hidden = true;
      root.hidden = false;
      if (gate.bar) { gate.bar.hidden = false; gate.name.textContent = 'Member login is not configured; see README'; gate.signOut.hidden = true; }
      started = true; load();
      return;
    }
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    var recovering = false;
    sb.auth.onAuthStateChange(function (event, s) {
      session = s;
      if (event === 'PASSWORD_RECOVERY') { recovering = true; showGate(); selectTab('login'); setRecoveryMode(true); return; }
      if (s && s.user && !recovering) { showApp(s.user); if (event === 'SIGNED_IN') recordLogin(s.user); }
      else if (!s) { started = false; showGate(); }
    });
    sb.auth.getSession().then(function (r) {
      session = r.data.session;
      if (session && session.user) showApp(session.user); else showGate();
    });
    function setRecoveryMode(on) {
      var form = document.querySelector('[data-gate-form="login"]');
      form.setAttribute('data-mode', on ? 'recovery' : '');
      form.querySelector('label[for="li-password"]').textContent = on ? 'New password' : 'Password';
      form.querySelector('button[type="submit"]').textContent = on ? 'Set new password' : 'Log in';
      form.querySelector('#li-email').parentNode.hidden = on;
      if (on) gateStatus('Choose a new password for your account.', null);
    }
    function selectTab(name) {
      gate.tabs.forEach(function (t) { var on = t.getAttribute('data-gate-tab') === name; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); });
      gate.forms.forEach(function (f) { f.hidden = f.getAttribute('data-gate-form') !== name; });
      gateStatus('');
    }
    gate.tabs.forEach(function (t) { t.addEventListener('click', function () { selectTab(t.getAttribute('data-gate-tab')); }); });
    document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentNode.querySelector('input');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        input.focus();
      });
    });
    gate.forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
        var f = form.elements;
        var done = function () { btn.disabled = false; };
        if (form.getAttribute('data-gate-form') === 'signup') {
          gateStatus('Creating your account…');
          sb.auth.signUp({ email: f.email.value.trim(), password: f.password.value, options: { data: { full_name: f.full_name.value.trim(), organisation: f.organisation.value.trim(), role: f.role.value } } })
            .then(function (r) {
              if (r.error) return gateStatus(r.error.message, false);
              if (r.data.session) { gateStatus('Account created. Opening the repository…', true); }
              else gateStatus('Account created. Check your inbox for a confirmation email, then log in.', true);
            }).finally(done);
        } else if (form.getAttribute('data-mode') === 'recovery') {
          sb.auth.updateUser({ password: f.password.value }).then(function (r) {
            if (r.error) return gateStatus(r.error.message, false);
            recovering = false; setRecoveryMode(false); gateStatus('Password updated.', true);
            sb.auth.getSession().then(function (g) { session = g.data.session; if (session) showApp(session.user); });
          }).finally(done);
        } else {
          gateStatus('Signing in…');
          sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (r) {
            if (r.error) return gateStatus(r.error.message === 'Invalid login credentials' ? 'That email and password do not match.' : r.error.message, false);
            gateStatus('');
          }).finally(done);
        }
      });
    });
    if (gate.forgot) gate.forgot.addEventListener('click', function () {
      var email = document.getElementById('li-email').value.trim();
      if (!email) return gateStatus('Enter your email above first, then click Forgot password.', false);
      sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/research/' }).then(function (r) {
        gateStatus(r.error ? r.error.message : 'If that address has an account, a reset link is on its way.', !r.error);
      });
    });
    if (gate.signOut) gate.signOut.addEventListener('click', function () { sb.auth.signOut(); });
  }

  /* ---------- URL state ---------- */
  function selected(f) { return f.inputs.filter(function (n) { return n.checked; }).map(function (n) { return n.value; }); }
  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.keywords = (p.get('q') || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    FACETS.forEach(function (f) { var vals = (p.get(f.key) || '').split('|'); f.inputs.forEach(function (n) { n.checked = vals.indexOf(n.value) !== -1; }); });
    if (els.from) els.from.value = p.get('from') || '';
    if (els.to) els.to.value = p.get('to') || '';
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (state.keywords.length) p.set('q', state.keywords.join('|'));
    FACETS.forEach(function (f) { var v = selected(f); if (v.length) p.set(f.key, v.join('|')); });
    if (els.from && els.from.value) p.set('from', els.from.value);
    if (els.to && els.to.value) p.set('to', els.to.value);
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  /* ---------- keywords ---------- */
  function renderChips() {
    els.chips.innerHTML = '';
    state.keywords.forEach(function (kw, i) {
      var chip = document.createElement('span');
      chip.className = 'kw-chip';
      chip.innerHTML = '<span></span><button type="button" aria-label="Remove keyword"></button>';
      chip.firstChild.textContent = kw;
      chip.lastChild.textContent = '×';
      chip.lastChild.addEventListener('click', function () { state.keywords.splice(i, 1); renderChips(); run(); });
      els.chips.appendChild(chip);
    });
    if (state.keywords.length > 1) {
      var note = document.createElement('span');
      note.className = 'kw-and';
      note.textContent = 'all ' + state.keywords.length + ' must match';
      els.chips.appendChild(note);
    }
  }
  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var kw = els.input.value.trim().replace(/^"|"$/g, '');
    if (!kw) return;
    if (state.keywords.map(function (k) { return k.toLowerCase(); }).indexOf(kw.toLowerCase()) === -1) state.keywords.push(kw);
    els.input.value = '';
    renderChips();
    run();
  });
  var typingTimer;
  els.input.addEventListener('input', function () { clearTimeout(typingTimer); typingTimer = setTimeout(run, 220); });

  FACETS.forEach(function (f) { f.inputs.forEach(function (n) { n.addEventListener('change', run); }); });
  [els.from, els.to].forEach(function (n) { if (n) n.addEventListener('change', run); });
  els.clear.addEventListener('click', function () {
    state.keywords = []; els.input.value = '';
    FACETS.forEach(function (f) { f.inputs.forEach(function (n) { n.checked = false; }); });
    if (els.from) els.from.value = ''; if (els.to) els.to.value = '';
    renderChips(); run();
  });
  root.querySelectorAll('[data-facet-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('[data-facet-group]');
      var hidden = group.querySelectorAll('.facet-more');
      var expand = hidden[0] && hidden[0].hidden;
      hidden.forEach(function (l) { l.hidden = !expand; });
      btn.textContent = expand ? 'Show fewer' : 'Show all ' + (group.querySelectorAll('label').length);
    });
  });
  root.querySelectorAll('[data-quick-years]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = btn.getAttribute('data-quick-years'), now = new Date();
      var set = function (from, to) { if (els.from) els.from.value = from; if (els.to) els.to.value = to; };
      if (v === '12m') set(String(now.getFullYear() - 1), ''); else if (v === '2020') set('2020', ''); else if (v === '2010s') set('2010', '2019'); else if (v === 'pre2010') set('', '2009');
      run();
    });
  });

  /* ---------- full-text index: tokens of every judgment, sharded by hash, fetched per keyword ----------
     Mirrors the tokeniser in scripts/research-index.py; keep the two identical. */
  var STOP = {}; 'the of and to in a is that for by or as be it this with on any not are was which from has have under at an were been shall such other than may his their its also would will if no so all into can only there he but these'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function tokenize(text) {
    var t = String(text).toLowerCase().replace(/\((\w{1,3})\)/g, '_$1').replace(/\bsections?\s+(?=[0-9])/g, 'section_');
    var out = {}, parts, k;
    t.split(/[^a-z0-9_]+/).forEach(function (tok) {
      tok = tok.replace(/^_+|_+$/g, '');
      if (tok.length < 2 || tok.length > 40 || (/^\d+$/.test(tok) && tok.length > 4)) return;
      if (tok.indexOf('_') !== -1) {
        parts = tok.split('_');
        for (k = 1; k <= parts.length; k++) out[parts.slice(0, k).join('_')] = 1;
        if (parts[0] === 'section') for (k = 2; k <= parts.length; k++) out[parts.slice(1, k).join('_')] = 1;
      } else out[tok] = 1;
    });
    return Object.keys(out).filter(function (x) { return !STOP[x]; });
  }
  function fnv1a(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
  var fts = { meta: null, buckets: {}, sets: {}, stop: {} };
  function ftsMeta() {
    if (!fts.meta) fts.meta = authFetch('/research/fts/meta.json').then(function (r) { return r.json(); }).then(function (m) { (m.stop || []).forEach(function (w) { fts.stop[w] = 1; }); return m; }).catch(function () { return { buckets: 0 }; });
    return fts.meta;
  }
  function bucket(n) {
    if (!fts.buckets[n]) fts.buckets[n] = authFetch('/research/fts/b' + n + '.json').then(function (r) { return r.json(); }).catch(function () { return {}; });
    return fts.buckets[n];
  }
  function docsFor(tok) {
    if (fts.sets[tok]) return fts.sets[tok];
    fts.sets[tok] = ftsMeta().then(function (m) {
      if (!m.buckets || fts.stop[tok]) return null;
      return bucket(fnv1a(tok) % m.buckets).then(function (b) {
        var set = new Set(), enc = b[tok];
        if (enc) { var prev = 0; enc.split(',').forEach(function (d) { prev += parseInt(d, 36); set.add(prev); }); }
        return set;
      });
    });
    return fts.sets[tok];
  }
  function keywordDocs(kw) {
    var toks = tokenize(kw);
    if (!toks.length) return Promise.resolve(null);
    return Promise.all(toks.map(docsFor)).then(function (sets) {
      sets = sets.filter(function (s) { return s !== null; });
      if (!sets.length) return null;
      sets.sort(function (a, b) { return a.size - b.size; });
      var acc = sets[0];
      for (var i = 1; i < sets.length; i++) { var next = new Set(); acc.forEach(function (id) { if (sets[i].has(id)) next.add(id); }); acc = next; }
      return acc;
    });
  }

  /* ---------- matching ---------- */
  function haystack(c) {
    if (!c._h) c._h = [c.t, c.p, c.r, c.n, c.ct, c.c, (c.j || []).join(' '), c.o, c.s, c.k, c.id].join(' \n ').toLowerCase();
    return c._h;
  }
  function keywordPass(c, kws, docSets) {
    if (!kws.length) return true;
    var h = haystack(c);
    for (var i = 0; i < kws.length; i++) {
      if (h.indexOf(kws[i]) !== -1) continue;
      if (docSets[i] && docSets[i].has(c.i)) continue;
      return false;
    }
    return true;
  }
  function yearPass(c, from, to) {
    var y = c.d.slice(0, 4);
    return !(from && y < from) && !(to && y > to);
  }
  function facetPass(c, f, vals) {
    if (!vals.length) return true;
    var v = c[f.field];
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) if (vals.indexOf(v[i]) !== -1) return true; return false; }
    return vals.indexOf(v) !== -1;
  }
  var runSeq = 0;
  function run() {
    writeUrl();
    var kws = state.keywords.map(function (k) { return k.toLowerCase(); });
    var live = els.input.value.trim().toLowerCase();
    if (live) kws.push(live);
    var from = els.from ? els.from.value : '', to = els.to ? els.to.value : '';
    var sel = FACETS.map(selected);
    var seq = ++runSeq;
    if (kws.length) els.count.textContent = 'Searching the full text…';
    Promise.all(kws.map(keywordDocs)).then(function (docSets) {
      if (seq !== runSeq) return;
      // Pass 1: keywords and years. Pass 2: facets, remembering per case which facets it fails so counts can be faceted.
      var base = state.loaded.filter(function (c) { return keywordPass(c, kws, docSets) && yearPass(c, from, to); });
      var matches = [];
      var counts = FACETS.map(function () { return {}; });
      base.forEach(function (c) {
        var fails = [], failed = 0;
        for (var i = 0; i < FACETS.length; i++) if (!facetPass(c, FACETS[i], sel[i])) { fails.push(i); failed++; }
        if (failed === 0) matches.push(c);
        // A case counts toward facet i's options when it passes every OTHER facet (standard faceted navigation).
        for (var k = 0; k < FACETS.length; k++) {
          if (failed > 1 || (failed === 1 && fails[0] !== k)) continue;
          var v = c[FACETS[k].field];
          if (Array.isArray(v)) v.forEach(function (x) { counts[k][x] = (counts[k][x] || 0) + 1; }); else if (v) counts[k][v] = (counts[k][v] || 0) + 1;
        }
      });
      matches.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
      state.matches = matches;
      state.shown = 0;
      els.results.innerHTML = '';
      showMore();
      var n = matches.length;
      var narrowed = kws.length || from || to || sel.some(function (v) { return v.length; });
      els.count.textContent = n === 0 ? 'No matches' : n.toLocaleString('en-IN') + (n === 1 ? ' judgment' : ' judgments') + (narrowed ? ' match' : '') + ', newest first';
      els.empty.hidden = n !== 0 || state.pending > 0;
      updateCounts(counts, sel);
      renderActive(sel, from, to);
    });
  }
  function updateCounts(counts, sel) {
    FACETS.forEach(function (f, i) {
      f.inputs.forEach(function (input) {
        var n = counts[i][input.value] || 0;
        var span = input.parentNode.querySelector('.count');
        if (span) span.textContent = n.toLocaleString('en-IN');
        input.parentNode.classList.toggle('is-zero', n === 0 && !input.checked);
      });
      var group = root.querySelector('[data-facet-group="' + f.key + '"] [data-active-n]');
      if (group) group.textContent = sel[i].length ? sel[i].length : '';
    });
    var yg = root.querySelector('[data-facet-group="years"] [data-active-n]');
    if (yg) yg.textContent = (els.from && els.from.value) || (els.to && els.to.value) ? '1' : '';
  }
  function renderActive(sel, from, to) {
    els.active.innerHTML = '';
    var add = function (label, value, remove) {
      var chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'active-chip';
      chip.innerHTML = '<span class="active-chip-label"></span><span></span> ×';
      chip.firstChild.textContent = label + ': ';
      chip.childNodes[1].textContent = value;
      chip.setAttribute('aria-label', 'Remove filter ' + label + ' ' + value);
      chip.addEventListener('click', function () { remove(); run(); });
      els.active.appendChild(chip);
    };
    FACETS.forEach(function (f, i) {
      sel[i].forEach(function (v) { add(f.label, v, function () { f.inputs.forEach(function (n) { if (n.value === v) n.checked = false; }); }); });
    });
    if (from || to) add('Decided', (from || 'any') + ' to ' + (to || 'now'), function () { if (els.from) els.from.value = ''; if (els.to) els.to.value = ''; });
    els.active.hidden = !els.active.children.length;
  }
  function showMore() {
    if (state.shown === 0) autoOpen = 3;
    var slice = state.matches.slice(state.shown, state.shown + PAGE);
    var frag = document.createDocumentFragment();
    slice.forEach(function (c) { frag.appendChild(renderCase(c)); });
    els.results.appendChild(frag);
    state.shown += slice.length;
    els.more.hidden = state.shown >= state.matches.length;
    els.more.textContent = 'Show more (' + (state.matches.length - state.shown).toLocaleString('en-IN') + ' remaining)';
  }
  els.more.addEventListener('click', showMore);

  /* ---------- rendering ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(d) { var p = d.split('-'); return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0]; }
  function when(c) { return c.yo ? c.d.slice(0, 4) : fmtDate(c.d); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function highlight(text, kws) {
    if (!kws.length || !text) return document.createTextNode(text || '');
    var frag = document.createDocumentFragment();
    var lower = text.toLowerCase(); var pos = 0;
    while (pos < text.length) {
      var best = -1, bestKw = '';
      kws.forEach(function (k) { var i = lower.indexOf(k, pos); if (i !== -1 && (best === -1 || i < best)) { best = i; bestKw = k; } });
      if (best === -1) { frag.appendChild(document.createTextNode(text.slice(pos))); break; }
      frag.appendChild(document.createTextNode(text.slice(pos, best)));
      frag.appendChild(el('mark', null, text.slice(best, best + bestKw.length)));
      pos = best + bestKw.length;
    }
    return frag;
  }
  function tagButton(label, facetKey, value) {
    // Clicking a tag on a result applies it as a filter.
    var b = el('button', 'tag tag-btn', label); b.type = 'button';
    b.title = 'Filter by ' + label;
    b.addEventListener('click', function () {
      var f = FACETS.filter(function (x) { return x.key === facetKey; })[0];
      if (!f) return;
      f.inputs.forEach(function (n) { if (n.value === value) n.checked = true; });
      run();
      window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
    return b;
  }
  function renderCase(c) {
    var kws = state.keywords.map(function (k) { return k.toLowerCase(); });
    var live = els.input.value.trim().toLowerCase(); if (live) kws.push(live);
    var li = el('li', 'result');
    var meta = el('div', 'card-meta');
    meta.appendChild(el('time', null, when(c))).setAttribute('datetime', c.yo ? c.d.slice(0, 4) : c.d);
    meta.appendChild(el('span', null, c.c));
    c.a.forEach(function (a) { meta.appendChild(tagButton(a, 'area', a)); });
    if (c.pr && c.pr !== 'Other or unclassified') meta.appendChild(el('span', 'muted', c.pr));
    li.appendChild(meta);
    var h = el('h3', 'result-title'); h.appendChild(highlight(c.t, kws)); li.appendChild(h);
    if (kws.length) {
      var inText = kws.filter(function (k) { return haystack(c).indexOf(k) === -1; });
      if (inText.length) li.appendChild(el('p', 'result-fulltext', 'Matched in the judgment text: ' + inText.join(', ')));
    }
    var ids = [];
    if (c.n) ids.push(c.n);
    if (c.ct) ids.push(c.ct);
    if (c.id) ids.push(c.id.replace(/_/g, ' '));
    var idLine = el('p', 'result-ids'); idLine.appendChild(highlight(ids.join(' · '), kws)); li.appendChild(idLine);
    if (c.j && c.j.length) { var jl = el('p', 'result-judges'); jl.appendChild(highlight('Coram: ' + c.j.join(', ') + (c.bn && c.bn !== 'Not recorded' ? ' · ' + c.bn : ''), kws)); li.appendChild(jl); }
    if (c.tp && c.tp.length) {
      var issues = el('div', 'result-issues');
      c.tp.slice(0, 6).forEach(function (t) { issues.appendChild(tagButton(t, 'issue', t)); });
      if (c.tp.length > 6) issues.appendChild(el('span', 'muted', '+' + (c.tp.length - 6) + ' more'));
      li.appendChild(issues);
    }
    if (c.s) { var sp = el('p', 'result-desc'); sp.appendChild(highlight(c.s, kws)); li.appendChild(sp); }
    if (c.k) {
      var det = el('details', 'result-passage');
      det.appendChild(el('summary', null, 'Key passage'));
      var q = el('blockquote'); q.appendChild(highlight(c.k, kws)); det.appendChild(q);
      li.appendChild(det);
    }
    var foot = el('div', 'result-foot');
    if (c.o) foot.appendChild(el('span', 'result-outcome', c.o));
    if (c.ln) foot.appendChild(el('span', 'result-outcome', c.ln));
    if (c.ind && c.ind.length) foot.appendChild(el('span', 'muted', c.ind.slice(0, 2).join(' · ')));
    if (c.x) {
      var paraBtn = el('button', 'link-copy', kws.length || activeIssues().length ? 'Relevant paragraphs' : 'Key paragraphs'); paraBtn.type = 'button';
      paraBtn.addEventListener('click', function () { togglePassages(li, c, paraBtn, false); });
      foot.appendChild(paraBtn);
      var readBtn = el('button', 'link-copy', 'Read the judgment'); readBtn.type = 'button';
      readBtn.addEventListener('click', function () { togglePassages(li, c, readBtn, true); });
      foot.appendChild(readBtn);
    }
    if (c.u) {
      var pdf = el('a', 'link-arrow', 'Official PDF');
      pdf.href = c.u; pdf.target = '_blank'; pdf.rel = 'noopener';
      pdf.title = /supreme-court/.test(c.u) ? 'Supreme Court of India judgment, as published on scr.sci.gov.in (AWS Open Data mirror)' : 'High Court judgment, as published on judgments.ecourts.gov.in (AWS Open Data mirror)';
      foot.appendChild(pdf);
    } else {
      var find = el('a', 'link-arrow', 'Find the judgment');
      find.href = 'https://judgments.ecourts.gov.in/pdfsearch/';
      find.title = 'No PDF could be matched for this record; search the eCourts judgments portal by case number';
      find.target = '_blank'; find.rel = 'noopener';
      foot.appendChild(find);
    }
    var copy = el('button', 'link-copy', 'Copy citation'); copy.type = 'button';
    copy.addEventListener('click', function () {
      var cite = c.t + (c.ct ? ', ' + c.ct : '') + (c.n ? ', ' + c.n : '') + ' (' + c.c + ', ' + when(c) + ')' + (c.u ? ' ' + c.u : '');
      if (navigator.clipboard) navigator.clipboard.writeText(cite).then(function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy citation'; }, 1500); });
    });
    foot.appendChild(copy);
    li.appendChild(foot);
    var box = el('div', 'passages'); box.hidden = true; li.appendChild(box);
    // When a search is active, the first few results open their relevant paragraphs automatically.
    if (c.x && (kws.length || activeIssues().length) && autoOpen > 0) { autoOpen--; togglePassages(li, c, null, false); }
    return li;
  }

  /* ---------- relevant paragraphs: the judgment text is fetched per result and scored in the browser ---------- */
  var textCache = {};
  var issuePatterns = null;
  function loadIssuePatterns() {
    if (!issuePatterns) issuePatterns = authFetch('/research/issues.json').then(function (r) { return r.json(); }).then(function (m) {
      var out = {}; Object.keys(m).forEach(function (k) { try { out[k] = new RegExp(m[k], 'gi'); } catch (e) { /* skip */ } }); return out;
    }).catch(function () { return {}; });
    return issuePatterns;
  }
  function activeIssues() { var f = FACETS.filter(function (x) { return x.key === 'issue'; })[0]; return f ? selected(f) : []; }
  function fetchText(id) {
    if (!textCache[id]) textCache[id] = authFetch('/research/text/' + id + '.json').then(function (r) { if (!r.ok) throw new Error(); return r.json(); });
    return textCache[id];
  }
  function phraseRegex(kw) {
    var esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(esc, 'gi');
  }
  // Score each paragraph: whole-keyword hits count most, then each keyword's individual tokens, then the selected issues' patterns.
  function scoreParagraphs(paras, kws, issueRx) {
    var kwRx = kws.map(phraseRegex);
    var kwTok = kws.map(function (k) { return tokenize(k).filter(function (t) { return t.length > 2 && !fts.stop[t]; }); });
    return paras.map(function (p, i) {
      var text = p[2], low = text.toLowerCase(), score = 0, why = [];
      kwRx.forEach(function (rx, k) {
        var m = text.match(rx);
        if (m) { score += 6 * Math.min(m.length, 3); why.push(kws[k]); return; }
        var hit = kwTok[k].filter(function (t) { return low.indexOf(t.replace(/_/g, ' ')) !== -1 || low.indexOf(t) !== -1; }).length;
        if (hit && hit === kwTok[k].length) { score += 3; why.push(kws[k]); } else if (hit) score += hit;
      });
      Object.keys(issueRx).forEach(function (name) {
        var m = text.match(issueRx[name]);
        if (m) { score += 2 * Math.min(m.length, 3); why.push(name); }
      });
      if (/\b(held|hold|we are of the (view|opinion)|in our (view|opinion)|accordingly|therefore|consequently|conclusion|prima facie)\b/i.test(text)) score += 1; // reasoning paragraphs edge ahead on ties
      if (text.length < 120) score *= 0.5;
      return { i: i, score: score, why: why, p: p };
    });
  }
  function highlightAll(text, kws, issueRx) {
    var frag = highlight(text, kws);
    if (!Object.keys(issueRx).length) return frag;
    // Second pass for issue patterns over the text nodes produced by the keyword pass.
    var wrap = document.createElement('span'); wrap.appendChild(frag);
    var walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var t = node.nodeValue, spans = [];
      Object.keys(issueRx).forEach(function (name) { var rx = new RegExp(issueRx[name].source, 'gi'), m; while ((m = rx.exec(t))) { if (m[0]) spans.push([m.index, m.index + m[0].length]); if (!m[0].length) rx.lastIndex++; } });
      if (!spans.length) return;
      spans.sort(function (a, b) { return a[0] - b[0]; });
      var out = document.createDocumentFragment(), pos = 0;
      spans.forEach(function (s) { if (s[0] < pos) return; out.appendChild(document.createTextNode(t.slice(pos, s[0]))); out.appendChild(el('mark', 'mark-issue', t.slice(s[0], s[1]))); pos = s[1]; });
      out.appendChild(document.createTextNode(t.slice(pos)));
      node.parentNode.replaceChild(out, node);
    });
    return wrap;
  }
  function togglePassages(li, c, btn, full) {
    var box = li.querySelector('.passages');
    var mode = box.getAttribute('data-mode');
    if (!box.hidden && mode === (full ? 'full' : 'top')) { box.hidden = true; box.setAttribute('data-mode', ''); return; }
    box.hidden = false; box.setAttribute('data-mode', full ? 'full' : 'top');
    box.innerHTML = ''; box.appendChild(el('p', 'muted', 'Loading the judgment text…'));
    var kws = state.keywords.map(function (k) { return k.toLowerCase(); });
    var live = els.input.value.trim().toLowerCase(); if (live) kws.push(live);
    var issues = activeIssues();
    Promise.all([fetchText(c.id), loadIssuePatterns()]).then(function (res) {
      // Drop running headers and page footers that the PDF extraction leaves as their own lines.
      var paras = (res[0].p || []).filter(function (p) { return !/^(.{0,80}\s)?page\s+\d+\s+of\s+\d+\s*$/i.test(p[2]) && !/^\s*(signature not verified|digitally signed by).{0,120}$/i.test(p[2]); });
      var allRx = res[1], issueRx = {};
      issues.forEach(function (name) { if (allRx[name]) issueRx[name] = allRx[name]; });
      var scored = scoreParagraphs(paras, kws, issueRx);
      box.innerHTML = '';
      var head = el('div', 'passages-head');
      var scoredHits = scored.filter(function (s) { return s.score > 0; });
      if (full) {
        head.appendChild(el('strong', null, 'Full judgment text'));
        head.appendChild(el('span', 'muted', ' · ' + paras.length + ' paragraphs' + (scoredHits.length ? ' · ' + scoredHits.length + ' match your search' : '') + ' · as extracted by Open India Law; check the official PDF before citing'));
      } else {
        head.appendChild(el('strong', null, kws.length || issues.length ? 'Paragraphs most relevant to your search' : 'Key paragraphs'));
        head.appendChild(el('span', 'muted', kws.length || issues.length ? ' · ranked by keyword and issue matches; ¶ numbers are the judgment’s own where printed' : ' · the paragraphs that read as holdings or conclusions'));
      }
      box.appendChild(head);
      var list = el('ol', 'passage-list');
      var pick;
      if (full) pick = scored;
      else {
        var ranked = scored.slice().sort(function (a, b) { return b.score - a.score || a.i - b.i; });
        pick = ranked.filter(function (s) { return s.score > 0; }).slice(0, 5);
        if (!pick.length) pick = ranked.slice(0, 3);
        pick.sort(function (a, b) { return a.i - b.i; });
      }
      pick.forEach(function (s) {
        var item = el('li', 'passage' + (s.score > 0 && full ? ' passage-hit' : ''));
        var num = s.p[1]; if (!num) { var nm = /^\(?(\d{1,3})[.)]\s*(?=[A-Z“"(])/.exec(s.p[2]); if (nm) num = Number(nm[1]); }
        var label = el('span', 'passage-label', (num ? '¶ ' + num : '¶') + (s.p[0] ? ' · p. ' + s.p[0] : ''));
        item.appendChild(label);
        var body = el('p'); body.appendChild(highlightAll(s.p[2], kws, issueRx)); item.appendChild(body);
        if (s.why.length && !full) item.appendChild(el('span', 'passage-why', 'Matches: ' + s.why.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')));
        list.appendChild(item);
      });
      box.appendChild(list);
      if (!full) {
        var more = el('button', 'link-copy', 'Read the whole judgment'); more.type = 'button';
        more.addEventListener('click', function () { togglePassages(li, c, null, true); });
        box.appendChild(more);
      }
    }).catch(function () { box.innerHTML = ''; box.appendChild(el('p', 'muted', 'The text of this judgment is not available in the index.')); });
  }
  var autoOpen = 0;

  /* ---------- loading shards, newest first ---------- */
  function setProgress() {
    els.progress.textContent = state.pending > 0 ? 'Loaded ' + state.loadedCount.toLocaleString('en-IN') + ' of ' + state.total.toLocaleString('en-IN') + ' judgments…' : state.total.toLocaleString('en-IN') + ' judgments indexed';
  }
  function load() {
    state.loaded = []; state.loadedCount = 0;
    authFetch('/research/data/manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      state.total = m.total;
      state.pending = m.years.length;
      setProgress();
      var i = 0;
      (function next() {
        if (i >= m.years.length) { state.pending = 0; setProgress(); run(); return; }
        var y = m.years[i++].y;
        authFetch('/research/data/' + y + '.json').then(function (r) { return r.json(); }).then(function (rows) {
          state.loaded = state.loaded.concat(rows);
          state.loadedCount += rows.length;
          state.pending--;
          setProgress();
          run();
          next();
        }).catch(function () { state.pending--; setProgress(); next(); });
      })();
    }).catch(function () { els.count.textContent = 'The index could not be loaded. Try again in a moment.'; });
  }

  readUrl();
  renderChips();
  initAuth();
})();
