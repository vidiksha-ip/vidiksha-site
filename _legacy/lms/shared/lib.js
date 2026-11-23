/* Shared helpers for the portal and the control panel: Supabase client, tiny router, rendering, formatting. */
(function () {
  'use strict';
  var cfg = window.VIDIKSHA;
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(d) { if (!d) return ''; var x = new Date(d); if (isNaN(x)) return ''; return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); }
  function fmtDateTime(d) { if (!d) return ''; var x = new Date(d); if (isNaN(x)) return ''; return x.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }); }
  function fmtInr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function until(d) { if (!d) return ''; var x = new Date(d); if (x.getFullYear() > 2200) return 'no end date'; return 'until ' + fmtDate(x); }
  /** "25 and 26 October 2026, 4:00 pm to 6:00 pm IST" for a session's sittings; falls back to start + length. */
  function schedule(days, startsAt, durationMin) {
    var tz = 'Asia/Kolkata';
    var list = ((days && days.length) ? days : [{ starts_at: startsAt, duration_min: durationMin }]).map(function (d) { return { t: new Date(d.starts_at), dur: Number(d.duration_min || durationMin || 180) }; }).filter(function (d) { return !isNaN(d.t); });
    if (!list.length) return '';
    var tm = function (d) { return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: tz }); };
    var range = function (d) { return tm(d.t) + ' to ' + tm(new Date(d.t.getTime() + d.dur * 60000)) + ' IST'; };
    var same = list.every(function (d) { return range(d) === range(list[0]); });
    if (list.length === 1 || !same) return list.map(function (d) { return fmtDate(d.t) + ', ' + range(d); }).join('; ');
    var groups = [];
    list.forEach(function (d) { var k = d.t.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: tz }); var g = groups.filter(function (x) { return x.k === k; })[0]; if (!g) { g = { k: k, days: [] }; groups.push(g); } g.days.push(Number(d.t.toLocaleDateString('en-IN', { day: 'numeric', timeZone: tz }))); });
    var join = function (a) { return a.length === 1 ? String(a[0]) : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
    return groups.map(function (g) { return join(g.days) + ' ' + g.k; }).join(' and ') + ', ' + range(list[0]);
  }
  function totalMinutes(days, durationMin) { return (days && days.length) ? days.reduce(function (a, d) { return a + Number(d.duration_min || durationMin || 180); }, 0) : Number(durationMin || 0); }
  function minutes(n) { if (!n) return ''; var h = Math.floor(n / 60), m = n % 60; return (h ? h + ' h ' : '') + (m ? m + ' min' : '').trim(); }
  function slugify(s) { return String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); }
  function courseName(slug) { return (cfg.courses && cfg.courses[slug]) || slug; }
  /** Loads the course list from the database into cfg.courses / cfg.courseRows (mutated in place so references stay valid). */
  function loadCourses() {
    return sb.from('courses').select('*').order('sort_order').then(function (r) {
      Object.keys(cfg.courses).forEach(function (k) { delete cfg.courses[k]; });
      Object.keys(cfg.courseRows).forEach(function (k) { delete cfg.courseRows[k]; });
      (r.data || []).forEach(function (c) { cfg.courses[c.slug] = c.title; cfg.courseRows[c.slug] = c; });
      return r.data || [];
    });
  }
  function nl2p(s) { return String(s || '').split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase(); }

  /** Turns a YouTube / Vimeo / Loom / Drive link into an embeddable iframe src; other URLs are returned as-is. */
  function embedUrl(url) {
    if (!url) return '';
    var m;
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/))) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&modestbranding=1';
    if ((m = url.match(/youtube\.com\/embed\/([\w-]{11})/))) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&modestbranding=1';
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\w]+))?/))) return 'https://player.vimeo.com/video/' + m[1] + (m[2] ? '?h=' + m[2] : '');
    if ((m = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/))) return 'https://www.loom.com/embed/' + m[1];
    if ((m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    return url;
  }

  /* --- toast --- */
  var toastEl;
  function toast(msg, kind) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.className = 'toast is-on' + (kind ? ' is-' + kind : '');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.className = 'toast'; }, 3500);
  }

  /* --- hash router: routes = { 'pattern/:param': handler } --- */
  function router(routes, notFound) {
    function parse() {
      var hash = location.hash.replace(/^#\/?/, '') || '';
      var parts = hash.split('?')[0].split('/').filter(Boolean);
      var query = {};
      (hash.split('?')[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
      for (var pattern in routes) {
        var pp = pattern.split('/').filter(Boolean);
        if (pp.length !== parts.length) continue;
        var params = {}, ok = true;
        for (var i = 0; i < pp.length; i++) {
          if (pp[i][0] === ':') params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
          else if (pp[i] !== parts[i]) { ok = false; break; }
        }
        if (ok) return { handler: routes[pattern], params: params, query: query, path: parts.join('/') };
      }
      return { handler: notFound, params: {}, query: query, path: parts.join('/') };
    }
    return { parse: parse, go: function (path) { location.hash = '#/' + path.replace(/^\/+/, ''); } };
  }

  /* --- rendering helpers --- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function render(html) { var m = $('#main'); m.innerHTML = html; m.scrollTop = 0; window.scrollTo(0, 0); return m; }
  function spinner(text) { return '<div class="empty"><span class="spin"></span> ' + esc(text || 'Loading') + '…</div>'; }
  function empty(text) { return '<div class="empty">' + esc(text) + '</div>'; }
  function field(label, input) { return '<label class="field"><span>' + esc(label) + '</span>' + input + '</label>'; }
  function formData(form) { var o = {}; Array.prototype.forEach.call(form.elements, function (el) { if (!el.name) return; if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value.trim(); }); return o; }
  function err(e) { return (e && (e.message || e.error_description || e.msg)) || String(e); }

  /* --- auth --- */
  function passwordToggles(root) {
    $$('[data-toggle-password]', root).forEach(function (b) {
      b.addEventListener('click', function () { var i = $('#' + b.getAttribute('data-toggle-password'), root); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide'; });
    });
  }
  function csv(rows, columns) {
    var head = columns.map(function (c) { return '"' + c.label.replace(/"/g, '""') + '"'; }).join(',');
    var body = rows.map(function (r) { return columns.map(function (c) { var v = typeof c.get === 'function' ? c.get(r) : r[c.key]; return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); });
    return [head].concat(body).join('\r\n');
  }
  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); }
  function safeName(name) { return String(name).replace(/[^\w.\-]+/g, '_').slice(0, 120); }

  window.LMS = { sb: sb, cfg: cfg, esc: esc, fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtInr: fmtInr, until: until, minutes: minutes, slugify: slugify, courseName: courseName, loadCourses: loadCourses, schedule: schedule, totalMinutes: totalMinutes, nl2p: nl2p, initials: initials, embedUrl: embedUrl, toast: toast, router: router, $: $, $$: $$, render: render, spinner: spinner, empty: empty, field: field, formData: formData, err: err, passwordToggles: passwordToggles, csv: csv, download: download, safeName: safeName };
})();
