/* VIDIKSHA learning portal (portal.vidiksha.in). Students sign in with the account created at purchase.
   Everything comes straight from Supabase under row level security; there is no server of our own. */
(function () {
  'use strict';
  var L = window.LMS, sb = L.sb, esc = L.esc, $ = L.$, $$ = L.$$;
  var app = document.getElementById('app');
  var session = null, profile = null, courses = [], unread = 0;

  /* ------------------------------------------------------------ auth screens */
  function authShell(inner) {
    app.innerHTML = '<div class="auth"><div class="auth-card"><a class="brand" href="' + L.cfg.siteUrl + '">VIDIKSHA<small>Learning portal</small></a>' + inner + '</div></div>';
    L.passwordToggles(app);
  }
  function loginScreen(msg) {
    authShell('<h1>Sign in</h1><p class="muted">Use the login email and password from your welcome email.</p>' +
      '<form class="form" id="login-form">' +
      L.field('Email', '<input type="email" name="email" required autocomplete="username">') +
      L.field('Password', '<div class="pw"><input type="password" name="password" id="pw" required autocomplete="current-password"><button type="button" data-toggle-password="pw">Show</button></div>') +
      '<button class="btn" type="submit">Sign in</button><p class="status" id="login-status">' + esc(msg || '') + '</p></form>' +
      '<div class="auth-foot"><a href="#/forgot">Forgot your password?</a> · No account yet? <a href="' + L.cfg.siteUrl + '/courses/">Enrol in a course</a></div>');
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = L.formData(e.target), st = $('#login-status'); st.textContent = 'Signing in…'; st.className = 'status';
      sb.auth.signInWithPassword({ email: f.email.toLowerCase(), password: f.password }).then(function (r) {
        if (r.error) { st.textContent = r.error.message === 'Invalid login credentials' ? 'That email and password do not match. Check the welcome email, or reset the password.' : r.error.message; st.className = 'status is-error'; }
      });
    });
  }
  function forgotScreen() {
    authShell('<h1>Reset password</h1><p class="muted">We will email you a link to set a new password.</p>' +
      '<form class="form" id="forgot-form">' + L.field('Email', '<input type="email" name="email" required>') +
      '<button class="btn" type="submit">Send reset link</button><p class="status" id="forgot-status"></p></form>' +
      '<div class="auth-foot"><a href="#/">Back to sign in</a></div>');
    $('#forgot-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('#forgot-status'); st.textContent = 'Sending…';
      sb.auth.resetPasswordForEmail(L.formData(e.target).email.toLowerCase(), { redirectTo: location.origin + location.pathname + '#/reset' }).then(function (r) {
        st.textContent = r.error ? r.error.message : 'If that address has an account, the reset link is on its way.'; st.className = 'status ' + (r.error ? 'is-error' : 'is-ok');
      });
    });
  }
  function resetScreen() {
    authShell('<h1>Choose a new password</h1>' +
      '<form class="form" id="reset-form">' +
      L.field('New password', '<div class="pw"><input type="password" name="password" id="npw" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="npw">Show</button></div>') +
      L.field('Repeat it', '<input type="password" name="confirm" required minlength="8" autocomplete="new-password">') +
      '<button class="btn" type="submit">Save password</button><p class="status" id="reset-status"></p></form>');
    $('#reset-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = L.formData(e.target), st = $('#reset-status');
      if (f.password !== f.confirm) { st.textContent = 'The two passwords differ.'; st.className = 'status is-error'; return; }
      sb.auth.updateUser({ password: f.password }).then(function (r) {
        if (r.error) { st.textContent = r.error.message; st.className = 'status is-error'; return; }
        L.toast('Password saved', 'ok'); recoveryMode = false; location.hash = '#/'; boot();
      });
    });
  }

  /* ------------------------------------------------------------ shell */
  var NAV = [
    ['', 'Dashboard'], ['courses', 'My courses'], ['notices', 'Announcements'], ['messages', 'Messages'], ['profile', 'Profile']
  ];
  function shell() {
    var name = (profile && profile.full_name) || session.user.email;
    app.innerHTML = '<div class="shell"><aside class="sidebar"><a class="brand" href="#/">VIDIKSHA<small>Learning portal</small></a><nav class="nav" id="nav"></nav>' +
      '<div class="nav-sep"></div><nav class="nav"><a href="' + L.cfg.siteUrl + '/research/" target="_blank" rel="noopener">Case law repository ↗</a><a href="' + L.cfg.siteUrl + '" target="_blank" rel="noopener">vidiksha.in ↗</a></nav>' +
      '<div class="user-chip"><span class="avatar">' + esc(L.initials(name)) + '</span><div><b>' + esc(name) + '</b><button type="button" id="signout">Sign out</button></div></div></aside><main id="main"></main></div>';
    $('#signout').addEventListener('click', function () { sb.auth.signOut(); });
    drawNav();
  }
  function drawNav() {
    var cur = (location.hash.replace(/^#\/?/, '').split('/')[0] || '');
    $('#nav').innerHTML = NAV.map(function (n) {
      var active = n[0] === '' ? cur === '' : cur === n[0] || (n[0] === 'courses' && (cur === 'course' || cur === 'lecture' || cur === 'assignment'));
      return '<a href="#/' + n[0] + '" class="' + (active ? 'is-active' : '') + '">' + n[1] + (n[0] === 'messages' && unread ? '<span class="badge">' + unread + '</span>' : '') + '</a>';
    }).join('');
  }

  /* ------------------------------------------------------------ data */
  function loadBase() {
    return Promise.all([
      sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      sb.from('my_courses').select('*'),
      sb.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('from_staff', true).is('read_at', null)
    ]).then(function (r) {
      profile = r[0].data || { id: session.user.id, email: session.user.email, full_name: session.user.user_metadata && session.user.user_metadata.full_name };
      courses = (r[1].data || []).sort(function (a, b) { return String(a.course_title).localeCompare(b.course_title); });
      unread = r[2].count || 0;
    });
  }
  function active(c) { return new Date(c.until) > new Date(); }
  function logEvent(event, meta) { sb.from('activity_log').insert({ user_id: session.user.id, event: event, meta: meta || null }).then(function () {}); }

  /* ------------------------------------------------------------ pages */
  function dashboard() {
    L.render('<div class="page-head"><div><p class="eyebrow">Dashboard</p><h1>Welcome back, ' + esc((profile.full_name || '').split(' ')[0] || 'there') + '.</h1></div></div>' +
      '<div class="section"><div class="section-head"><h2>Your courses</h2><a href="#/courses">All courses</a></div><div id="dash-courses">' + L.spinner() + '</div></div>' +
      '<div class="grid grid-2 section"><div><div class="section-head"><h2>Announcements</h2><a href="#/notices">All</a></div><div id="dash-notices">' + L.spinner() + '</div></div>' +
      '<div><div class="section-head"><h2>Your sessions</h2></div><div id="dash-sessions">' + L.spinner() + '</div></div></div>');
    courseCards($('#dash-courses'));
    sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(4).then(function (r) {
      $('#dash-notices').innerHTML = (r.data && r.data.length) ? r.data.map(noticeHtml).join('') : L.empty('No announcements yet.');
    });
    sb.from('training_registrations').select('*').eq('user_id', session.user.id).order('session_date', { ascending: false }).then(function (r) {
      $('#dash-sessions').innerHTML = (r.data && r.data.length) ? '<ul class="list">' + r.data.map(function (s) {
        var past = s.session_date && new Date(s.session_date) < new Date(new Date().toDateString());
        return '<li><div class="grow"><div class="t">' + esc(s.session_title) + '</div><div class="s">' + (s.session_date ? L.fmtDate(s.session_date) : '') + (past ? ' · attended' : ' · upcoming, 4 pm to 7 pm IST on Microsoft Teams') + '</div></div></li>';
      }).join('') + '</ul>' : '<div class="empty">You have not registered for a live training session. <a href="' + L.cfg.siteUrl + '/live-training/" target="_blank" rel="noopener">See upcoming sessions</a>.</div>';
    });
  }
  function courseCards(el) {
    if (!courses.length) { el.innerHTML = L.empty('No courses on this account yet. Courses bought with this email appear here the moment payment is confirmed.'); return; }
    var ids = courses.map(function (c) { return c.course_slug; });
    Promise.all([
      sb.from('lectures').select('id, course_slug').in('course_slug', ids),
      sb.from('lecture_progress').select('lecture_id, completed').eq('user_id', session.user.id)
    ]).then(function (r) {
      var lecs = r[0].data || [], done = {}; (r[1].data || []).forEach(function (p) { if (p.completed) done[p.lecture_id] = true; });
      el.innerHTML = '<div class="grid grid-2">' + courses.map(function (c) {
        var mine = lecs.filter(function (l) { return l.course_slug === c.course_slug; });
        var n = mine.filter(function (l) { return done[l.id]; }).length, pct = mine.length ? Math.round(n * 100 / mine.length) : 0;
        return '<a class="card is-link" href="#/course/' + esc(c.course_slug) + '"><p class="eyebrow">' + (active(c) ? 'Access ' + esc(L.until(c.until)) : 'Access ended ' + esc(L.fmtDate(c.until))) + '</p><h3>' + esc(c.course_title) + '</h3>' +
          '<div class="muted small">' + (mine.length ? n + ' of ' + mine.length + ' sessions completed' : 'Sessions are being added') + '</div><div class="progress"><i style="width:' + pct + '%"></i></div></a>';
      }).join('') + '</div>';
    });
  }
  function coursesPage() {
    L.render('<div class="page-head"><div><p class="eyebrow">My courses</p><h1>Courses</h1></div><a class="btn btn-ghost" href="' + L.cfg.siteUrl + '/courses/" target="_blank" rel="noopener">Browse all courses ↗</a></div><div id="cc">' + L.spinner() + '</div>');
    courseCards($('#cc'));
  }
  function coursePage(slug) {
    var c = courses.filter(function (x) { return x.course_slug === slug; })[0];
    if (!c) return L.render('<div class="page-head"><div><h1>' + esc(L.courseName(slug)) + '</h1><p>This course is not on your account.</p></div></div><a class="btn" href="' + L.cfg.siteUrl + '/courses/' + esc(slug) + '/">See the course on vidiksha.in</a>');
    L.render('<div class="page-head"><div><p class="eyebrow">Course</p><h1>' + esc(c.course_title) + '</h1><p>' + (active(c) ? 'Recording access ' + esc(L.until(c.until)) + '.' : 'Your access ended on ' + esc(L.fmtDate(c.until)) + '. Write to team@vidiksha.in to extend it.') + '</p></div></div>' +
      '<div class="grid grid-2" style="grid-template-columns: 1.4fr 1fr; align-items:start"><div><div class="section-head"><h2>Sessions</h2></div><div id="lectures">' + L.spinner() + '</div>' +
      '<div class="section"><div class="section-head"><h2>Assignments</h2></div><div id="assignments">' + L.spinner() + '</div></div></div>' +
      '<div><div class="section-head"><h2>Materials</h2></div><div id="materials">' + L.spinner() + '</div><div class="section"><div class="section-head"><h2>Announcements</h2></div><div id="cnotices">' + L.spinner() + '</div></div></div></div>');
    Promise.all([
      sb.from('lectures').select('*').eq('course_slug', slug).order('position'),
      sb.from('lecture_progress').select('*').eq('user_id', session.user.id),
      sb.from('assignments').select('*').eq('course_slug', slug).order('created_at'),
      sb.from('submissions').select('*').eq('user_id', session.user.id),
      sb.from('materials').select('*').eq('course_slug', slug).order('created_at'),
      sb.from('announcements').select('*').eq('audience', slug).order('created_at', { ascending: false }).limit(5)
    ]).then(function (r) {
      var prog = {}; (r[1].data || []).forEach(function (p) { prog[p.lecture_id] = p; });
      var lecs = r[0].data || [];
      $('#lectures').innerHTML = lecs.length ? '<ul class="list">' + lecs.map(function (l, i) {
        var p = prog[l.id];
        return '<li><a class="row" href="#/lecture/' + l.id + '"><span class="num">' + String(i + 1).padStart(2, '0') + '</span><div class="grow"><div class="t">' + esc(l.title) + '</div><div class="s">' + esc(L.minutes(l.duration_min)) + (p && !p.completed && p.seconds > 30 ? ' · in progress' : '') + '</div></div><span class="tick ' + (p && p.completed ? 'is-done' : '') + '">' + (p && p.completed ? '✓' : '') + '</span></a></li>';
      }).join('') + '</ul>' : L.empty('Sessions will appear here as they are released.');
      var subs = {}; (r[3].data || []).forEach(function (s) { subs[s.assignment_id] = s; });
      var asg = r[2].data || [];
      $('#assignments').innerHTML = asg.length ? '<ul class="list">' + asg.map(function (a) {
        var s = subs[a.id], pill = s ? (s.graded_at ? '<span class="pill ok">Graded' + (s.grade ? ': ' + esc(s.grade) : '') + '</span>' : '<span class="pill">Submitted</span>') : (a.due_at && new Date(a.due_at) < new Date() ? '<span class="pill bad">Overdue</span>' : '<span class="pill warn">To do</span>');
        return '<li><a class="row" href="#/assignment/' + a.id + '"><div class="grow"><div class="t">' + esc(a.title) + '</div><div class="s">' + (a.due_at ? 'Due ' + esc(L.fmtDate(a.due_at)) : 'No deadline') + '</div></div>' + pill + '</a></li>';
      }).join('') + '</ul>' : L.empty('No assignments yet.');
      var mats = r[4].data || [];
      $('#materials').innerHTML = mats.length ? '<ul class="list">' + mats.map(function (m) { return '<li><div class="grow"><div class="t">' + esc(m.title) + '</div></div><button class="btn btn-ghost btn-sm" data-material="' + m.id + '">Open</button></li>'; }).join('') + '</ul>' : L.empty('No materials yet.');
      $$('[data-material]').forEach(function (b) { b.addEventListener('click', function () { openMaterial(mats.filter(function (m) { return m.id === b.getAttribute('data-material'); })[0], b); }); });
      $('#cnotices').innerHTML = (r[5].data && r[5].data.length) ? r[5].data.map(noticeHtml).join('') : L.empty('No course announcements.');
    });
  }
  function openMaterial(m, btn) {
    if (m.url) return window.open(m.url, '_blank', 'noopener');
    btn.disabled = true;
    sb.storage.from('lms-materials').createSignedUrl(m.file_path, 3600).then(function (r) {
      btn.disabled = false;
      if (r.error) return L.toast(L.err(r.error), 'error');
      window.open(r.data.signedUrl, '_blank', 'noopener');
    });
  }
  function lecturePage(id) {
    L.render(L.spinner('Loading session'));
    sb.from('lectures').select('*').eq('id', id).maybeSingle().then(function (r) {
      var l = r.data;
      if (!l) return L.render(L.empty('This session is not available to you.'));
      Promise.all([
        sb.from('lectures').select('id, title, position').eq('course_slug', l.course_slug).order('position'),
        sb.from('lecture_progress').select('*').eq('user_id', session.user.id).eq('lecture_id', id).maybeSingle(),
        sb.from('materials').select('*').eq('lecture_id', id),
        sb.from('assignments').select('id, title').eq('lecture_id', id)
      ]).then(function (rr) {
        var all = rr[0].data || [], idx = all.findIndex(function (x) { return x.id === id; }), prev = all[idx - 1], next = all[idx + 1];
        var p = rr[1].data, mats = rr[2].data || [], asg = rr[3].data || [];
        L.render('<p class="eyebrow"><a href="#/course/' + esc(l.course_slug) + '">' + esc(L.courseName(l.course_slug)) + '</a> · Session ' + (idx + 1) + ' of ' + all.length + '</p><h1>' + esc(l.title) + '</h1>' +
          '<div class="lecture-layout"><div><div class="player" id="player">' + L.spinner('Loading video') + '</div>' +
          '<div class="actions" style="margin:1rem 0 1.5rem"><button class="btn ' + (p && p.completed ? 'btn-ghost' : '') + '" id="done">' + (p && p.completed ? '✓ Completed' : 'Mark as completed') + '</button>' +
          (prev ? '<a class="btn btn-ghost" href="#/lecture/' + prev.id + '">← Previous</a>' : '') + (next ? '<a class="btn btn-ghost" href="#/lecture/' + next.id + '">Next →</a>' : '') + '</div>' +
          '<div class="prose">' + L.nl2p(l.description) + '</div></div>' +
          '<aside><div class="card"><p class="eyebrow">This session</p><div class="kv"><dt>Length</dt><dd>' + esc(L.minutes(l.duration_min) || '—') + '</dd></div>' +
          (mats.length ? '<h3 style="margin-top:1rem">Materials</h3><ul class="list">' + mats.map(function (m) { return '<li><div class="grow t">' + esc(m.title) + '</div><button class="btn btn-ghost btn-sm" data-material="' + m.id + '">Open</button></li>'; }).join('') + '</ul>' : '') +
          (asg.length ? '<h3 style="margin-top:1rem">Practice exercise</h3><ul class="list">' + asg.map(function (a) { return '<li><a class="row" href="#/assignment/' + a.id + '"><div class="grow t">' + esc(a.title) + '</div>→</a></li>'; }).join('') + '</ul>' : '') +
          '</div></aside></div>');
        $$('[data-material]').forEach(function (b) { b.addEventListener('click', function () { openMaterial(mats.filter(function (m) { return m.id === b.getAttribute('data-material'); })[0], b); }); });
        $('#done').addEventListener('click', function () {
          var completed = !(p && p.completed);
          sb.from('lecture_progress').upsert({ user_id: session.user.id, lecture_id: id, completed: completed, seconds: (p && p.seconds) || 0, updated_at: new Date().toISOString() }).then(function (x) {
            if (x.error) return L.toast(L.err(x.error), 'error');
            p = p || {}; p.completed = completed;
            $('#done').textContent = completed ? '✓ Completed' : 'Mark as completed'; $('#done').className = 'btn ' + (completed ? 'btn-ghost' : '');
            if (completed) logEvent('lecture_completed', { lecture_id: id, course: l.course_slug });
          });
        });
        showVideo(l, p);
      });
    });
  }
  function showVideo(l, p) {
    var el = $('#player');
    if (l.video_path) {
      sb.storage.from('lms-videos').createSignedUrl(l.video_path, 3 * 3600).then(function (r) {
        if (r.error) { el.innerHTML = L.empty('The recording could not be loaded: ' + L.err(r.error)); return; }
        el.innerHTML = '<video controls controlsList="nodownload" playsinline preload="metadata" src="' + esc(r.data.signedUrl) + '"></video>';
        var v = $('video', el), last = 0;
        if (p && p.seconds > 10) v.addEventListener('loadedmetadata', function () { if (p.seconds < v.duration - 15) v.currentTime = p.seconds; });
        v.addEventListener('timeupdate', function () {
          var s = Math.floor(v.currentTime);
          if (s - last >= 30) { last = s; sb.from('lecture_progress').upsert({ user_id: session.user.id, lecture_id: l.id, seconds: s, completed: (p && p.completed) || false, updated_at: new Date().toISOString() }).then(function () {}); }
        });
      });
    } else if (l.video_url) {
      el.innerHTML = '<iframe src="' + esc(L.embedUrl(l.video_url)) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    } else el.innerHTML = L.empty('The recording for this session is being uploaded.');
  }
  function assignmentPage(id) {
    L.render(L.spinner('Loading'));
    Promise.all([sb.from('assignments').select('*').eq('id', id).maybeSingle(), sb.from('submissions').select('*').eq('assignment_id', id).eq('user_id', session.user.id).maybeSingle()]).then(function (r) {
      var a = r[0].data, s = r[1].data;
      if (!a) return L.render(L.empty('This assignment is not available to you.'));
      var locked = s && s.graded_at;
      L.render('<p class="eyebrow"><a href="#/course/' + esc(a.course_slug) + '">' + esc(L.courseName(a.course_slug)) + '</a> · Assignment</p><h1>' + esc(a.title) + '</h1><p class="muted">' + (a.due_at ? 'Due ' + esc(L.fmtDateTime(a.due_at)) : 'No deadline') + '</p>' +
        '<div class="lecture-layout"><div><div class="prose">' + L.nl2p(a.instructions) + '</div>' +
        '<div class="section"><div class="section-head"><h2>' + (s ? 'Your submission' : 'Submit your work') + '</h2></div>' +
        (locked ? '<div class="card"><p class="eyebrow">Graded ' + esc(L.fmtDate(s.graded_at)) + (s.grade ? ' · ' + esc(s.grade) : '') + '</p>' + (s.feedback ? '<div class="prose">' + L.nl2p(s.feedback) + '</div>' : '<p class="muted">No written feedback.</p>') + '<hr style="border:0;border-top:1px solid var(--line);margin:1rem 0"><div class="prose muted">' + L.nl2p(s.body) + '</div>' + (s.file_path ? '<button class="btn btn-ghost btn-sm" id="sub-file">Open your file</button>' : '') + '</div>'
          : '<form class="form" id="sub-form">' + L.field('Your answer', '<textarea name="body" placeholder="Paste or type your draft here">' + esc(s ? s.body : '') + '</textarea>') +
            L.field('Attach a file (PDF or Word, up to 25 MB)' + (s && s.file_path ? ' · a file is already attached; choosing another replaces it' : ''), '<input type="file" name="file" accept=".pdf,.doc,.docx,.txt,.md">') +
            '<div class="actions"><button class="btn" type="submit">' + (s ? 'Update submission' : 'Submit') + '</button>' + (s && s.file_path ? '<button class="btn btn-ghost" type="button" id="sub-file">Open attached file</button>' : '') + '</div><p class="status" id="sub-status">' + (s ? 'Submitted ' + esc(L.fmtDateTime(s.submitted_at)) + '. You can revise it until it is graded.' : '') + '</p></form>') +
        '</div></div><aside><div class="card"><p class="eyebrow">Status</p>' + (s ? (locked ? '<span class="pill ok">Graded</span>' : '<span class="pill">Submitted, awaiting review</span>') : '<span class="pill warn">Not submitted</span>') + '</div></aside></div>');
      if ($('#sub-file')) $('#sub-file').addEventListener('click', function () { sb.storage.from('lms-submissions').createSignedUrl(s.file_path, 600).then(function (r) { if (r.error) return L.toast(L.err(r.error), 'error'); window.open(r.data.signedUrl, '_blank', 'noopener'); }); });
      var form = $('#sub-form');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var st = $('#sub-status'), body = form.body.value.trim(), file = form.file.files[0];
        if (!body && !file && !(s && s.file_path)) { st.textContent = 'Write an answer or attach a file.'; st.className = 'status is-error'; return; }
        st.textContent = 'Saving…'; st.className = 'status';
        var save = function (path) {
          var row = { assignment_id: id, user_id: session.user.id, body: body, submitted_at: new Date().toISOString() };
          if (path) row.file_path = path;
          return sb.from('submissions').upsert(row, { onConflict: 'assignment_id,user_id' }).select().maybeSingle();
        };
        var up = file ? sb.storage.from('lms-submissions').upload(session.user.id + '/' + id + '-' + Date.now() + '-' + L.safeName(file.name), file, { upsert: true }).then(function (r) { if (r.error) throw r.error; return r.data.path; }) : Promise.resolve(null);
        up.then(save).then(function (r) {
          if (r.error) throw r.error;
          logEvent('submission', { assignment_id: id });
          L.toast('Submission saved', 'ok'); assignmentPage(id);
        }).catch(function (e2) { st.textContent = L.err(e2); st.className = 'status is-error'; });
      });
    });
  }
  function noticeHtml(n) {
    return '<div class="notice ' + (n.pinned ? 'is-pinned' : '') + '"><div class="meta">' + esc(L.fmtDate(n.created_at)) + (n.audience !== 'all' ? ' · ' + esc(L.courseName(n.audience)) : '') + (n.pinned ? ' · pinned' : '') + '</div><strong>' + esc(n.title) + '</strong>' + (n.body ? '<div class="prose small" style="margin-top:0.35rem">' + L.nl2p(n.body) + '</div>' : '') + '</div>';
  }
  function noticesPage() {
    L.render('<div class="page-head"><div><p class="eyebrow">Announcements</p><h1>Announcements</h1></div></div><div id="nn">' + L.spinner() + '</div>');
    sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).then(function (r) {
      $('#nn').innerHTML = (r.data && r.data.length) ? r.data.map(noticeHtml).join('') : L.empty('No announcements yet.');
    });
  }
  function messagesPage() {
    L.render('<div class="page-head"><div><p class="eyebrow">Messages</p><h1>Messages from the VIDIKSHA team</h1><p>Replies here reach the team; for anything urgent write to team@vidiksha.in.</p></div></div><div id="mm">' + L.spinner() + '</div>' +
      '<form class="form section" id="reply-form"><label class="field"><span>Reply</span><textarea name="body" required placeholder="Write to the team"></textarea></label><div><button class="btn" type="submit">Send</button></div><p class="status" id="reply-status"></p></form>');
    sb.from('messages').select('*').eq('user_id', session.user.id).order('created_at').then(function (r) {
      var ms = r.data || [];
      $('#mm').innerHTML = ms.length ? ms.map(function (m) { return '<div class="msg ' + (m.from_staff ? (m.read_at ? '' : 'is-unread') : 'is-mine') + '"><div class="prose">' + L.nl2p(m.body) + '</div><div class="meta">' + (m.from_staff ? 'VIDIKSHA team' : 'You') + ' · ' + esc(L.fmtDateTime(m.created_at)) + '</div></div>'; }).join('') : L.empty('No messages yet.');
      var unreadIds = ms.filter(function (m) { return m.from_staff && !m.read_at; }).map(function (m) { return m.id; });
      if (unreadIds.length) sb.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(function () { unread = 0; drawNav(); });
    });
    $('#reply-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('#reply-status'); st.textContent = 'Sending…';
      sb.from('messages').insert({ user_id: session.user.id, from_staff: false, sender_id: session.user.id, body: e.target.body.value.trim() }).then(function (r) {
        if (r.error) { st.textContent = L.err(r.error); st.className = 'status is-error'; return; }
        messagesPage();
      });
    });
  }
  function profilePage() {
    L.render('<div class="page-head"><div><p class="eyebrow">Profile</p><h1>Your profile</h1></div></div>' +
      '<div class="grid grid-2" style="align-items:start"><div class="card"><h3>Details</h3><form class="form" id="prof-form">' +
      L.field('Full name', '<input type="text" name="full_name" value="' + esc(profile.full_name || '') + '">') +
      L.field('Email (login)', '<input type="email" value="' + esc(profile.email || session.user.email) + '" disabled>') +
      L.field('WhatsApp number', '<input type="text" name="whatsapp" value="' + esc(profile.whatsapp || '') + '">') +
      '<div class="form-row">' + L.field('Profession', '<input type="text" name="profession" value="' + esc(profile.profession || '') + '">') + L.field('Organisation', '<input type="text" name="organisation" value="' + esc(profile.organisation || '') + '">') + '</div>' +
      L.field('Academic qualification', '<input type="text" name="qualification" value="' + esc(profile.qualification || '') + '">') +
      '<div><button class="btn" type="submit">Save</button></div><p class="status" id="prof-status"></p></form></div>' +
      '<div><div class="card"><h3>Change password</h3><form class="form" id="pw-form">' +
      L.field('New password', '<div class="pw"><input type="password" name="password" id="cpw" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="cpw">Show</button></div>') +
      L.field('Repeat it', '<input type="password" name="confirm" required minlength="8" autocomplete="new-password">') +
      '<div><button class="btn btn-ghost" type="submit">Update password</button></div><p class="status" id="pw-status"></p></form></div>' +
      '<div class="card section"><h3>Invoices</h3><div id="inv">' + L.spinner() + '</div></div></div></div>');
    L.passwordToggles(document);
    $('#prof-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = L.formData(e.target), st = $('#prof-status'); st.textContent = 'Saving…';
      sb.from('profiles').upsert({ id: session.user.id, email: session.user.email, full_name: f.full_name, whatsapp: f.whatsapp, profession: f.profession, organisation: f.organisation, qualification: f.qualification }).then(function (r) {
        if (r.error) { st.textContent = L.err(r.error); st.className = 'status is-error'; return; }
        profile = Object.assign(profile, f); st.textContent = 'Saved.'; st.className = 'status is-ok'; shell(); profilePage();
      });
    });
    $('#pw-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = L.formData(e.target), st = $('#pw-status');
      if (f.password !== f.confirm) { st.textContent = 'The two passwords differ.'; st.className = 'status is-error'; return; }
      sb.auth.updateUser({ password: f.password }).then(function (r) { st.textContent = r.error ? L.err(r.error) : 'Password updated.'; st.className = 'status ' + (r.error ? 'is-error' : 'is-ok'); if (!r.error) e.target.reset(); });
    });
    sb.from('course_enrolments').select('course_title, amount_inr, invoice_no, paid_at, razorpay_payment_id').eq('status', 'paid').order('paid_at', { ascending: false }).then(function (r) {
      $('#inv').innerHTML = (r.data && r.data.length) ? '<ul class="list">' + r.data.map(function (e) { return '<li><div class="grow"><div class="t">' + esc(e.course_title) + '</div><div class="s">' + esc(e.invoice_no || '') + ' · ' + esc(L.fmtDate(e.paid_at)) + '</div></div><span>' + L.fmtInr(e.amount_inr) + '</span></li>'; }).join('') + '</ul><p class="fine" style="margin-top:0.75rem">The PDF of each invoice was attached to your welcome email. Need a copy? Write to team@vidiksha.in with the invoice number.</p>' : L.empty('No invoices on this account.');
    });
  }

  /* ------------------------------------------------------------ routing */
  var routes = L.router({
    '': dashboard, 'courses': coursesPage, 'course/:slug': function (p) { coursePage(p.slug); }, 'lecture/:id': function (p) { lecturePage(p.id); },
    'assignment/:id': function (p) { assignmentPage(p.id); }, 'notices': noticesPage, 'messages': messagesPage, 'profile': profilePage
  }, function () { L.render(L.empty('Page not found.')); });
  var recoveryMode = false;
  function route() {
    var r = routes.parse();
    if (!session) {
      if (r.path === 'forgot') return forgotScreen();
      return loginScreen();
    }
    if (recoveryMode || r.path === 'reset') return resetScreen();
    if (!$('#main')) shell();
    drawNav();
    r.handler(r.params, r.query);
  }
  function boot() {
    if (!session) return route();
    app.innerHTML = '<div class="auth">' + L.spinner('Opening your portal') + '</div>';
    loadBase().then(function () { shell(); route(); }, function (e) { app.innerHTML = '<div class="auth"><div class="auth-card">' + L.empty('Could not load your account: ' + L.err(e)) + '</div></div>'; });
  }
  window.addEventListener('hashchange', route);
  sb.auth.onAuthStateChange(function (event, s) {
    var had = !!session; session = s;
    if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; return route(); }
    if (event === 'SIGNED_IN' && !had) { logEvent('portal_login', { ua: navigator.userAgent.slice(0, 120) }); sb.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', s.user.id).then(function () {}); return boot(); }
    if (event === 'SIGNED_OUT') { profile = null; courses = []; location.hash = '#/'; return route(); }
    if (event === 'INITIAL_SESSION') return boot();
  });
})();
