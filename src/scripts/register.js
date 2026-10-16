/* VIDIKSHA live training registration.
   The form posts to the payments function's /register-session route, which records the registration in the training
   register (Supabase) and the Google Sheet. No account is created and no email is sent: the page thanks the registrant
   and shows the WhatsApp group link for the session. */
(function () {
  'use strict';
  var box = document.querySelector('[data-register]');
  if (!box) return;
  var form = box.querySelector('[data-register-form]');
  var status = box.querySelector('[data-register-status]');
  var done = box.querySelector('[data-register-done]');
  var doneText = box.querySelector('[data-register-done-text]');
  var waLink = box.querySelector('[data-register-whatsapp]');
  var endpoint = box.getAttribute('data-register-url') || '';
  var anonKey = box.getAttribute('data-supabase-key') || '';
  var session = { slug: box.getAttribute('data-session-slug'), title: box.getAttribute('data-session-title'), date: box.getAttribute('data-session-date') };

  function say(msg, ok) { status.textContent = msg || ''; status.className = 'form-status' + (ok === true ? ' is-ok' : ok === false ? ' is-error' : ''); }
  function finish(text, whatsapp) {
    form.hidden = true; done.hidden = false; doneText.textContent = text;
    if (waLink) { if (whatsapp) { waLink.href = whatsapp; waLink.hidden = false; } else waLink.hidden = true; }
    window.scrollTo({ top: box.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  }
  function normalisePhone(raw) {
    var s = raw.trim().replace(/[\s\-()]/g, '');
    if (/^[6-9]\d{9}$/.test(s)) s = '+91' + s; else if (/^0[6-9]\d{9}$/.test(s)) s = '+91' + s.slice(1); else if (/^91[6-9]\d{9}$/.test(s)) s = '+' + s;
    return s.replace(/^(\+\d{2})(\d{5})(\d{5})$/, '$1 $2 $3');
  }
  function fields() {
    var f = form.elements;
    return { session_slug: session.slug, session_title: session.title, session_date: session.date, full_name: f.full_name.value.trim(), email: f.email.value.trim().toLowerCase(), whatsapp: normalisePhone(f.whatsapp.value), profession: f.profession.value, qualification: f.qualification.value };
  }
  function validate(v) {
    if (v.full_name.length < 2) return 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return 'Enter a valid email address.';
    if (!/^\+?[0-9][0-9 \-]{7,16}$/.test(v.whatsapp)) return 'Enter a WhatsApp number with country code, for example +91 98765 43210.';
    if (!v.profession) return 'Choose your profession.';
    if (!v.qualification) return 'Choose your academic qualification.';
    return '';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = fields(), err = validate(v);
    if (err) return say(err, false);
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    say('Reserving your seat…');
    if (!endpoint) { say('Registration is not configured on this build.', false); btn.disabled = false; return; }
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + anonKey }, body: JSON.stringify(v) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Registration failed. Try again in a moment.'); return j; }); },
        function () { throw new Error('Could not reach the registration service. Check your connection and try again.'); })
      .then(function (j) {
        finish(j.already ? 'You were already registered with this email. ' : 'Thank you for registering, ' + (v.full_name.split(' ')[0] || '') + '. ' + (j.whatsapp ? 'Join the WhatsApp group for this session below: the Teams link, materials and reminders are shared there.' : 'The Teams link and materials will be sent to you on WhatsApp before the session.'), j.whatsapp);
      })
      .catch(function (e2) { say(e2.message, false); btn.disabled = false; });
  });
})();
