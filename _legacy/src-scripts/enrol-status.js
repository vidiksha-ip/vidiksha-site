/* Course page and enrol page: asks Supabase whether the course's open batch is enrolling right now and, if not,
   disables Enrol now with the reason. The payment function enforces the same window on the server. */
(function () {
  'use strict';
  var box = document.querySelector('[data-enrol-window]');
  if (!box) return;
  var url = box.getAttribute('data-supabase-url'), key = box.getAttribute('data-supabase-key'), slug = box.getAttribute('data-course');
  if (!url || !key || !slug) return;
  var fmt = function (d) { return new Date(d + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }); };
  fetch(url.replace(/\/$/, '') + '/rest/v1/open_enrolment?course_slug=eq.' + encodeURIComponent(slug) + '&select=*', { headers: { apikey: key, Authorization: 'Bearer ' + key } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      var b = rows && rows[0];
      var note = box.querySelector('[data-enrol-note]'), btn = box.querySelector('[data-enrol-button]'), form = box.querySelector('[data-enrol-form]');
      if (!b || b.enrolling) {
        if (b && b.enrol_until && note) note.textContent = 'Enrolment for ' + b.batch_name + ' closes on ' + fmt(b.enrol_until) + '.';
        return;
      }
      var today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
      var msg = b.enrol_from && b.enrol_from > today ? 'Enrolment for ' + b.batch_name + ' opens on ' + fmt(b.enrol_from) + '.' : 'Enrolment for ' + b.batch_name + ' closed on ' + fmt(b.enrol_until) + '. The next batch will be announced here and on the live training page.';
      if (btn) { btn.setAttribute('aria-disabled', 'true'); btn.classList.add('is-disabled'); btn.textContent = b.enrol_from && b.enrol_from > today ? 'Enrolment opens ' + fmt(b.enrol_from) : 'Enrolment closed'; btn.addEventListener('click', function (e) { e.preventDefault(); }); }
      if (note) note.textContent = msg;
      if (form) { form.querySelectorAll('input, select, textarea, button').forEach(function (el) { el.disabled = true; }); var st = form.querySelector('[data-enrol-status]'); if (st) { st.textContent = msg; st.className = 'form-status is-error'; } }
    }).catch(function () {});
})();
