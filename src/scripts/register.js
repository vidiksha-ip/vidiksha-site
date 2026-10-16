/* VIDIKSHA live training registration.
   1. Creates (or signs into) the member's Supabase account with the form details; the database trigger records the
      registration against the account.
   2. Posts the non-secret details to the site's server, which appends a row to the Google Sheet and keeps a local log.
   Passwords go to Supabase only. */
(function () {
  'use strict';
  var box = document.querySelector('[data-register]');
  if (!box) return;
  var form = box.querySelector('[data-register-form]');
  var status = box.querySelector('[data-register-status]');
  var done = box.querySelector('[data-register-done]');
  var doneText = box.querySelector('[data-register-done-text]');
  var session = { slug: box.getAttribute('data-session-slug'), title: box.getAttribute('data-session-title'), date: box.getAttribute('data-session-date') };
  var cfg = { url: box.getAttribute('data-supabase-url'), key: box.getAttribute('data-supabase-key') };
  var sb = cfg.url && cfg.key && window.supabase ? window.supabase.createClient(cfg.url, cfg.key) : null;

  function say(msg, ok) { status.textContent = msg || ''; status.className = 'form-status' + (ok === true ? ' is-ok' : ok === false ? ' is-error' : ''); }
  function finish(text) { form.hidden = true; done.hidden = false; doneText.textContent = text; window.scrollTo({ top: box.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' }); }

  box.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.parentNode.querySelector('input'), show = input.type === 'password';
      input.type = show ? 'text' : 'password'; btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show)); btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); input.focus();
    });
  });

  function normalisePhone(raw) {
    var s = raw.trim().replace(/[\s\-()]/g, '');
    if (/^[6-9]\d{9}$/.test(s)) s = '+91' + s;          // bare Indian mobile number
    else if (/^0[6-9]\d{9}$/.test(s)) s = '+91' + s.slice(1);
    else if (/^91[6-9]\d{9}$/.test(s)) s = '+' + s;
    return s.replace(/^(\+\d{2})(\d{5})(\d{5})$/, '$1 $2 $3');
  }
  function fields() {
    var f = form.elements;
    return {
      full_name: f.full_name.value.trim(), email: f.email.value.trim().toLowerCase(), whatsapp: normalisePhone(f.whatsapp.value),
      profession: f.profession.value, qualification: f.qualification.value, password: f.password.value, confirm: f.confirm.value
    };
  }
  function validate(v) {
    if (v.full_name.length < 2) return 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return 'Enter a valid email address.';
    if (!/^\+?[0-9][0-9 \-]{7,16}$/.test(v.whatsapp)) return 'Enter a WhatsApp number with country code, for example +91 98765 43210.';
    if (!v.profession) return 'Choose your profession.';
    if (!v.qualification) return 'Choose your academic qualification.';
    if (v.password.length < 8) return 'The password needs at least 8 characters.';
    if (v.password !== v.confirm) return 'The two passwords do not match.';
    return '';
  }
  // The sheet endpoint is the site's own server locally, or the Google Apps Script web app directly on the static site.
  var sheetEndpoint = box.getAttribute('data-sheet-endpoint') || '';
  function recordToSheet(v, accountStatus) {
    if (!sheetEndpoint) return Promise.resolve({ ok: false });
    var payload = JSON.stringify({ received_at: new Date().toISOString(), session_slug: session.slug, session_title: session.title, session_date: session.date, full_name: v.full_name, email: v.email, whatsapp: v.whatsapp, profession: v.profession, qualification: v.qualification, account_status: accountStatus, source: 'website' });
    var direct = /script\.google\.com/.test(sheetEndpoint);
    // Apps Script accepts a "simple" POST (text/plain, no custom headers) without a CORS preflight.
    return fetch(sheetEndpoint, { method: 'POST', headers: { 'Content-Type': direct ? 'text/plain;charset=utf-8' : 'application/json' }, body: payload, redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .catch(function () {
        if (!direct) return { ok: false };
        // The redirect Apps Script answers with can hide the response from the page; send once more opaquely so the row is written.
        return fetch(sheetEndpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: payload }).then(function () { return { ok: true, opaque: true }; }).catch(function () { return { ok: false }; });
      });
  }
  // Insert the registration for a signed-in member (existing account path); ignore a duplicate.
  function registerSignedIn(user, v) {
    return sb.from('training_registrations').insert({ user_id: user.id, session_slug: session.slug, session_title: session.title, session_date: session.date, full_name: v.full_name, email: v.email, whatsapp: v.whatsapp, profession: v.profession, qualification: v.qualification })
      .then(function (r) { if (r.error && !/duplicate|unique/i.test(r.error.message)) throw r.error; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = fields();
    var err = validate(v);
    if (err) return say(err, false);
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    var release = function () { btn.disabled = false; };
    var meta = { full_name: v.full_name, whatsapp: v.whatsapp, profession: v.profession, qualification: v.qualification, role: v.profession, register_session: session.slug, register_session_title: session.title, register_session_date: session.date };

    if (!sb) {
      // Member database not configured (local development): keep the registration anyway.
      say('Reserving your seat…');
      recordToSheet(v, 'no account (member database not configured)').then(function () {
        finish('Your details are recorded. The member database is not configured on this build, so no account was created.');
      }).finally(release);
      return;
    }

    say('Creating your account and reserving your seat…');
    sb.auth.signUp({ email: v.email, password: v.password, options: { data: meta } }).then(function (r) {
      if (r.error) {
        if (/already registered|already exists/i.test(r.error.message)) return existingAccount(v);
        throw r.error;
      }
      var u = r.data.user;
      // Supabase returns a user with no identities when the email already has an account (enumeration protection).
      if (u && Array.isArray(u.identities) && u.identities.length === 0) return existingAccount(v);
      if (r.data.session) {
        return recordToSheet(v, 'new account, signed in').then(function () {
          finish('Your account is active and your seat is reserved. The Teams link comes by email the morning of the session.');
        });
      }
      return recordToSheet(v, 'new account, confirmation email sent').then(function () {
        finish('Your seat is reserved. We have sent a confirmation email to ' + v.email + '; confirm it to activate your account and the case law repository.');
      });
    }).catch(function (e2) {
      say((e2 && e2.message) || 'Something went wrong. Try again, or email team@vidiksha.in.', false);
    }).finally(release);

    function existingAccount(v2) {
      say('An account exists for this email. Signing you in…');
      return sb.auth.signInWithPassword({ email: v2.email, password: v2.password }).then(function (r) {
        if (r.error) {
          return recordToSheet(v2, 'existing account, password did not match').then(function () {
            say('An account already exists for ' + v2.email + ' but the password does not match it. Your details are recorded; log in on the Research page with your existing password, or use Forgot password there, and your seat will be confirmed by email.', false);
          });
        }
        return registerSignedIn(r.data.user, v2).then(function () { return recordToSheet(v2, 'existing account, signed in'); }).then(function () {
          finish('Welcome back. Your seat is reserved on your existing account.');
        });
      });
    }
  });
})();
