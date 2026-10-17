/* VIDIKSHA live training registration.
   The form posts to the payments function's /register-session route, which creates the registrant's learning-portal
   account (or links the existing one), records the registration in the training register and the Google Sheet, and
   returns the session's WhatsApp group link. No confirmation email is sent. */
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
  var portal = (box.getAttribute('data-portal') || '').replace(/^https?:\/\//, '');
  var session = { slug: box.getAttribute('data-session-slug'), title: box.getAttribute('data-session-title'), date: box.getAttribute('data-session-date') };

  box.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.parentNode.querySelector('input'), show = input.type === 'password';
      input.type = show ? 'text' : 'password'; btn.textContent = show ? 'Hide' : 'Show'; btn.setAttribute('aria-pressed', String(show)); input.focus();
    });
  });
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
    return { session_slug: session.slug, session_title: session.title, session_date: session.date, full_name: f.full_name.value.trim(), email: f.email.value.trim().toLowerCase(), whatsapp: normalisePhone(f.whatsapp.value), profession: f.profession.value, qualification: f.qualification.value, password: f.password.value, confirm: f.confirm.value };
  }
  function validate(v) {
    if (v.full_name.length < 2) return 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return 'Enter a valid email address.';
    if (!/^\+?[0-9][0-9 \-]{7,16}$/.test(v.whatsapp)) return 'Enter a WhatsApp number with country code, for example +91 98765 43210.';
    if (!v.profession) return 'Choose your profession.';
    if (!v.qualification) return 'Choose your academic qualification.';
    if (v.password.length < 8) return 'Choose a password of at least 8 characters.';
    if (v.password !== v.confirm) return 'The two passwords differ.';
    return '';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = fields(), err = validate(v);
    if (err) return say(err, false);
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    say('Reserving your seat…');
    if (!endpoint) { say('Registration is not configured on this build.', false); btn.disabled = false; return; }
    delete v.confirm;
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + anonKey }, body: JSON.stringify(v) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Registration failed. Try again in a moment.'); return j; }); },
        function () { throw new Error('Could not reach the registration service. Check your connection and try again.'); })
      .then(function (j) {
        var first = v.full_name.split(' ')[0] || '';
        var account = j.account === 'created' ? 'Your learning portal account at ' + portal + ' is ready: sign in with this email and the password you set. '
          : j.account === 'existing' ? 'The seat is added to your existing VIDIKSHA account; sign in at ' + portal + ' as usual. '
          : j.account === 'existing, password differs' ? 'An account already exists for this email, so your existing password still applies; use "Forgot your password" at ' + portal + ' if you need a new one. ' : '';
        finish((j.already ? 'You were already registered with this email. ' : 'Thank you for registering, ' + first + '. ') + account + (j.whatsapp ? 'Join the WhatsApp group below: the Teams link, materials and reminders are shared there. After the session the recording, your feedback form and your certificate are in the portal.' : 'The Teams link and materials will reach you on WhatsApp before the session; the recording and your certificate appear in the portal afterwards.'), j.whatsapp);
      })
      .catch(function (e2) { say(e2.message, false); btn.disabled = false; });
  });
})();
