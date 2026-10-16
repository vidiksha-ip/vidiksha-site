/* VIDIKSHA course enrolment: details form -> Razorpay Checkout -> verified payment.
   The Supabase Edge Function "payments" creates the order at the server-side price and verifies the payment;
   the Google Sheet row is written there, only after a verified successful payment. */
(function () {
  'use strict';
  var box = document.querySelector('[data-enrol]');
  if (!box) return;
  var form = box.querySelector('[data-enrol-form]');
  var status = box.querySelector('[data-enrol-status]');
  var done = box.querySelector('[data-enrol-done]');
  var doneText = box.querySelector('[data-enrol-done-text]');
  var course = { slug: box.getAttribute('data-course-slug'), title: box.getAttribute('data-course-title') };
  var fnBase = box.getAttribute('data-payments-url') || '';
  var anonKey = box.getAttribute('data-supabase-key') || '';
  var pendingOrder = null;

  function say(msg, ok) { status.textContent = msg || ''; status.className = 'form-status' + (ok === true ? ' is-ok' : ok === false ? ' is-error' : ''); }
  function finish(text) { form.hidden = true; done.hidden = false; doneText.textContent = text; window.scrollTo({ top: box.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' }); }
  function normalisePhone(raw) {
    var s = raw.trim().replace(/[\s\-()]/g, '');
    if (/^[6-9]\d{9}$/.test(s)) s = '+91' + s; else if (/^0[6-9]\d{9}$/.test(s)) s = '+91' + s.slice(1); else if (/^91[6-9]\d{9}$/.test(s)) s = '+' + s;
    return s.replace(/^(\+\d{2})(\d{5})(\d{5})$/, '$1 $2 $3');
  }
  function fields() {
    var f = form.elements;
    return {
      course_slug: course.slug, full_name: f.full_name.value.trim(), email: f.email.value.trim().toLowerCase(), whatsapp: normalisePhone(f.whatsapp.value),
      profession: f.profession.value, organisation: f.organisation.value.trim(), address_line: f.address_line.value.trim(),
      city: f.city.value.trim(), state: f.state.value.trim(), pincode: f.pincode.value.trim()
    };
  }
  function validate(v) {
    if (v.full_name.length < 2) return 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return 'Enter a valid email address.';
    if (!/^\+?[0-9][0-9 \-]{7,16}$/.test(v.whatsapp)) return 'Enter a WhatsApp number with country code, for example +91 98765 43210.';
    if (!v.profession) return 'Choose your profession.';
    if (v.address_line.length < 8) return 'Enter the postal address for the IP Prosecution Kit: house or flat, street, locality.';
    if (!v.city) return 'Enter the city.';
    if (!v.state) return 'Enter the state.';
    if (!/^\d{6}$/.test(v.pincode)) return 'The PIN code needs six digits.';
    return '';
  }
  function api(path, body) {
    return fetch(fnBase + path, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + anonKey }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'The payment service is not available right now. Try again in a few minutes.'); return j; }); },
        function () { throw new Error('Could not reach the payment service. Check your connection and try again.'); });
  }
  function openCheckout(order, v) {
    if (!window.Razorpay) { say('The payment window could not load. Check your connection and try again.', false); return; }
    var rzp = new window.Razorpay({
      key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency,
      name: order.name, description: order.description, prefill: order.prefill,
      notes: { course: course.slug }, theme: { color: '#0f0e0d' },
      handler: function (resp) {
        say('Payment received. Confirming…');
        api('/verify', resp).then(function (r) {
          finish('Payment confirmed for ' + r.course + '. Razorpay emails the receipt to ' + r.email + ', and the VIDIKSHA team will write to the same address within one working day with access to the recordings and the community. The IP Prosecution Kit ships to the address you gave within 7 working days.');
        }).catch(function () {
          finish('Your payment went through. Confirmation is taking a moment longer than usual; the VIDIKSHA team will write to you within one working day. If you hear nothing by then, write to team@vidiksha.in with your email address.');
        });
      },
      modal: { ondismiss: function () { say('Payment not completed. Your details are saved; click the button to try again.', false); form.querySelector('button[type="submit"]').disabled = false; } }
    });
    rzp.on('payment.failed', function (r) { say('Payment failed: ' + ((r.error && r.error.description) || 'the bank declined the transaction') + '. You can try again.', false); form.querySelector('button[type="submit"]').disabled = false; });
    rzp.open();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = fields();
    var err = validate(v);
    if (err) return say(err, false);
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    if (!fnBase) { say('Payments are not configured on this build.', false); btn.disabled = false; return; }
    if (pendingOrder && pendingOrder.email === v.email) { say(''); openCheckout(pendingOrder.order, v); return; }
    say('Preparing your payment…');
    api('/create-order', v).then(function (order) {
      pendingOrder = { order: order, email: v.email };
      say('');
      openCheckout(order, v);
    }).catch(function (e2) { say(e2.message || 'Could not start the payment.', false); btn.disabled = false; });
  });
})();
