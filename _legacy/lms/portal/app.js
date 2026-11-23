/* VIDIKSHA learning portal (portal.vidiksha.in). Students sign in with the account created at purchase.
   Everything comes straight from Supabase under row level security; there is no server of our own.
   The curriculum of each course (sessions and what they cover) comes from shared/courses.js, generated from the
   site's course files; recordings uploaded in the control panel attach to curriculum sessions by position. */
(function () {
  'use strict';
  var L = window.LMS, sb = L.sb, esc = L.esc, $ = L.$, $$ = L.$$;
  var CUR = {}; // slug -> { title, duration, unitNote }, from the courses table
  var app = document.getElementById('app');
  var session = null, profile = null, courses = [], unread = 0, batches = {};
  function batchLine(slug) { var b = batches[slug]; if (!b) return ''; return esc(b.name) + (b.starts_on ? ', from ' + esc(L.fmtDate(b.starts_on)) : '') + (b.ends_on ? ' to ' + esc(L.fmtDate(b.ends_on)) : ''); }

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
      '<div class="auth-foot">Forgot your password? Write to team@vidiksha.in from your registered email and the team will set a new one for you. No account yet? <a href="' + L.cfg.siteUrl + '/courses/">Enrol in a course</a></div>');
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = L.formData(e.target), st = $('#login-status'); st.textContent = 'Signing in…'; st.className = 'status';
      sb.auth.signInWithPassword({ email: f.email.toLowerCase(), password: f.password }).then(function (r) {
        if (r.error) { st.textContent = r.error.message === 'Invalid login credentials' ? 'That email and password do not match. Check the welcome email, or write to team@vidiksha.in to have the password reset.' : r.error.message; st.className = 'status is-error'; }
      });
    });
  }
  /* ------------------------------------------------------------ shell */
  var NAV = [['', 'Dashboard'], ['courses', 'My courses'], ['training', 'Live training'], ['notices', 'Announcements'], ['messages', 'Messages'], ['profile', 'Profile']];
  function shell() {
    var name = (profile && profile.full_name) || session.user.email;
    app.innerHTML = '<div class="shell"><aside class="sidebar"><a class="brand" href="#/">VIDIKSHA<small>Learning portal</small></a><nav class="nav" id="nav"></nav>' +
      '<div class="nav-sep"></div><nav class="nav"><a href="' + L.cfg.siteUrl + '/research/" target="_blank" rel="noopener">Case law repository ↗</a><a href="' + L.cfg.siteUrl + '" target="_blank" rel="noopener">vidiksha.in ↗</a></nav>' +
      '<div class="user-chip"><span class="avatar">' + esc(L.initials(name)) + '</span><div><b>' + esc(name) + '</b><button type="button" id="signout">Sign out</button></div></div></aside><main id="main"></main></div>';
    $('#signout').addEventListener('click', function () { sb.auth.signOut(); });
    drawNav();
  }
  function drawNav() {
    var cur = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || '');
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
      sb.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('from_staff', true).is('read_at', null),
      L.loadCourses(),
      sb.from('my_batches').select('*')
    ]).then(function (r) {
      (r[3] || []).forEach(function (c) { CUR[c.slug] = { title: c.title, duration: c.duration, unitNote: c.unit_note }; });
      batches = {}; (r[4].data || []).forEach(function (b) { batches[b.course_slug] = b; });
      profile = r[0].data || { id: session.user.id, email: session.user.email, full_name: session.user.user_metadata && session.user.user_metadata.full_name };
      courses = (r[1].data || []).sort(function (a, b) { return String(a.course_title).localeCompare(b.course_title); });
      unread = r[2].count || 0;
    });
  }
  function active(c) { return !c.suspended && c.until && new Date(c.until) > new Date(); }
  function accessNote(c) { return c.suspended ? 'Access paused by the VIDIKSHA team. Write to team@vidiksha.in if you think this is a mistake.' : active(c) ? 'Recording access ' + L.until(c.until) + '.' : 'Your access ended on ' + L.fmtDate(c.until) + '. Write to team@vidiksha.in to extend it.'; }
  function logEvent(event, meta) { sb.from('activity_log').insert({ user_id: session.user.id, event: event, meta: meta || null }).then(function () {}); }

  /** The curriculum of a course: every session row, with the recording only where it has been released. */
  function sessionsFor(slug, lectures, progress) {
    var rows = lectures.slice().sort(function (a, b) { return a.position - b.position; }).map(function (l) { return { n: l.position, id: l.id, title: l.title, lessons: l.lessons || [], lecture: l.available ? l : null, row: l }; });
    rows.forEach(function (r) { var p = progress[r.id]; r.state = !r.lecture ? (p && p.completed ? 'done' : 'soon') : p && p.completed ? 'done' : p && p.seconds > 30 ? 'progress' : 'ready'; });
    return rows;
  }
  function courseStats(rows) {
    var withRec = rows.filter(function (r) { return r.lecture; }), done = withRec.filter(function (r) { return r.state === 'done'; });
    var next = rows.filter(function (r) { return r.state === 'progress'; })[0] || rows.filter(function (r) { return r.state === 'ready'; })[0];
    return { total: rows.length, released: withRec.length, done: done.length, pct: withRec.length ? Math.round(done.length * 100 / withRec.length) : 0, next: next };
  }
  function statePill(state) {
    return { soon: '<span class="pill">Recording coming soon</span>', done: '<span class="pill ok">Completed</span>', progress: '<span class="pill warn">In progress</span>', ready: '<span class="pill">Not started</span>' }[state];
  }

  /* ------------------------------------------------------------ dashboard & courses */
  function dashboard() {
    L.render('<div class="page-head"><div><p class="eyebrow">Dashboard</p><h1>Welcome back, ' + esc((profile.full_name || '').split(' ')[0] || 'there') + '.</h1></div></div>' +
      '<div class="section" style="margin-top:0"><div class="section-head"><h2>Your courses</h2><a href="#/courses">All courses</a></div><div id="dash-courses">' + L.spinner() + '</div></div>' +
      '<div class="grid grid-2 section"><div><div class="section-head"><h2>Announcements</h2><a href="#/notices">All</a></div><div id="dash-notices">' + L.spinner() + '</div></div>' +
      '<div><div class="section-head"><h2>Your live sessions</h2><a href="#/training">All</a></div><div id="dash-sessions">' + L.spinner() + '</div></div></div>');
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
      sb.from('lectures_student').select('id, course_slug, position, title, lessons, available').in('course_slug', ids),
      sb.from('lecture_progress').select('lecture_id, completed, seconds').eq('user_id', session.user.id)
    ]).then(function (r) {
      var prog = {}; (r[1].data || []).forEach(function (p) { prog[p.lecture_id] = p; });
      el.innerHTML = '<div class="grid grid-2">' + courses.map(function (c) {
        var rows = sessionsFor(c.course_slug, (r[0].data || []).filter(function (l) { return l.course_slug === c.course_slug; }), prog), s = courseStats(rows);
        return '<div class="card course-card"><p class="eyebrow">' + (c.suspended ? 'Access paused' : active(c) ? 'Access ' + esc(L.until(c.until)) : 'Access ended ' + esc(L.fmtDate(c.until))) + '</p><h3><a href="#/course/' + esc(c.course_slug) + '">' + esc(c.course_title) + '</a></h3>' +
          (batches[c.course_slug] ? '<div class="small" style="margin-bottom:0.3rem">' + batchLine(c.course_slug) + '</div>' : '') +
          '<div class="muted small">' + s.done + ' of ' + s.total + ' sessions completed' + (s.released < s.total ? ' · ' + s.released + ' recording' + (s.released === 1 ? '' : 's') + ' released' : '') + '</div><div class="progress"><i style="width:' + s.pct + '%"></i></div>' +
          '<div class="actions" style="margin-top:1rem">' + (s.next && active(c) ? '<a class="btn btn-sm" href="#/lecture/' + s.next.lecture.id + '">▶ ' + (s.next.state === 'progress' ? 'Continue' : 'Start') + ' session ' + s.next.n + '</a>' : '') + '<a class="btn btn-ghost btn-sm" href="#/course/' + esc(c.course_slug) + '">Course page</a></div></div>';
      }).join('') + '</div>';
    });
  }
  function coursesPage() {
    L.render('<div class="page-head"><div><p class="eyebrow">My courses</p><h1>Courses</h1></div><a class="btn btn-ghost" href="' + L.cfg.siteUrl + '/courses/" target="_blank" rel="noopener">Browse all courses ↗</a></div><div id="cc">' + L.spinner() + '</div>');
    courseCards($('#cc'));
  }

  /* ------------------------------------------------------------ course page with tabs */
  var TABS = [['sessions', 'Sessions'], ['materials', 'Materials'], ['assignments', 'Assignments'], ['notices', 'Announcements']];
  function coursePage(slug, q) {
    var c = courses.filter(function (x) { return x.course_slug === slug; })[0];
    var tab = TABS.some(function (t) { return t[0] === q.tab; }) ? q.tab : 'sessions';
    var info = CUR[slug] || {};
    if (!c) return L.render('<div class="page-head"><div><h1>' + esc(info.title || L.courseName(slug)) + '</h1><p>This course is not on your account.</p></div></div><a class="btn" href="' + L.cfg.siteUrl + '/courses/' + esc(slug) + '/">See the course on vidiksha.in</a>');
    L.render('<div class="page-head"><div><p class="eyebrow">Course</p><h1>' + esc(c.course_title) + '</h1><p>' + (batches[slug] ? batchLine(slug) + '. ' : '') + esc(accessNote(c)) + (info.duration ? ' ' + esc(info.duration) + (info.unitNote ? ', ' + esc(info.unitNote) : '') + '.' : '') + '</p></div><div id="course-cta"></div></div>' +
      '<div class="course-progress" id="course-progress"></div>' +
      '<div class="tabs">' + TABS.map(function (t) { return '<a href="#/course/' + esc(slug) + '?tab=' + t[0] + '" class="' + (tab === t[0] ? 'is-active' : '') + '">' + t[1] + '</a>'; }).join('') + '</div><div id="tab">' + L.spinner() + '</div>');
    Promise.all([
      sb.from('lectures_student').select('*').eq('course_slug', slug).order('position'),
      sb.from('lecture_progress').select('*').eq('user_id', session.user.id)
    ]).then(function (r) {
      var prog = {}; (r[1].data || []).forEach(function (p) { prog[p.lecture_id] = p; });
      var rows = sessionsFor(slug, r[0].data || [], prog), s = courseStats(rows);
      $('#course-progress').innerHTML = '<div class="muted small">' + s.done + ' of ' + s.total + ' sessions completed · ' + s.released + ' of ' + s.total + ' recordings released</div><div class="progress"><i style="width:' + s.pct + '%"></i></div>';
      if (s.next && active(c)) $('#course-cta').innerHTML = '<a class="btn" href="#/lecture/' + s.next.lecture.id + '">▶ ' + (s.next.state === 'progress' ? 'Continue' : 'Start') + ' session ' + s.next.n + '</a>';
      ({ sessions: sessionsTab, materials: materialsTab, assignments: assignmentsTab, notices: noticesTab })[tab](slug, rows, c);
    });
  }
  function sessionsTab(slug, rows, c) {
    if (!rows.length) { $('#tab').innerHTML = L.empty('Sessions will appear here as they are released.'); return; }
    $('#tab').innerHTML = '<ol class="sessions">' + rows.map(function (r) {
      var canPlay = r.lecture && active(c);
      return '<li class="session ' + (r.state === 'done' ? 'is-done' : '') + '"><div class="session-num">' + String(r.n).padStart(2, '0') + '</div>' +
        '<div class="session-body"><div class="session-top"><h3>' + esc(r.title) + '</h3>' + statePill(r.state) + '</div>' +
        (r.row.duration_min || r.row.description ? '<div class="muted small">' + (r.row.duration_min ? esc(L.minutes(r.row.duration_min)) : '') + (r.row.description ? (r.row.duration_min ? ' · ' : '') + esc(r.row.description.split('\n')[0]).slice(0, 140) : '') + '</div>' : '') +
        (r.lessons.length ? '<details class="lessons"><summary>What this session covers</summary><ul>' + r.lessons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') + '</div>' +
        '<div class="session-action">' + (canPlay ? '<a class="play" href="#/lecture/' + r.lecture.id + '" aria-label="Play session ' + r.n + '"><span class="play-icon">▶</span><span>' + (r.state === 'done' ? 'Watch again' : r.state === 'progress' ? 'Resume' : 'Play') + '</span></a>' : '<span class="play is-off"><span class="play-icon">▶</span><span>' + (r.lecture ? 'Access ended' : r.row.release_at && new Date(r.row.release_at) > new Date() ? 'Releases ' + esc(L.fmtDate(r.row.release_at)) : 'Coming soon') + '</span></span>') + '</div></li>';
    }).join('') + '</ol>';
  }
  function materialsTab(slug) {
    sb.from('materials').select('*, lectures(position, title)').eq('course_slug', slug).order('created_at').then(function (r) {
      var mats = r.data || [];
      $('#tab').innerHTML = mats.length ? '<ul class="list">' + mats.map(function (m) { return '<li><div class="grow"><div class="t">' + esc(m.title) + '</div><div class="s">' + (m.lectures ? 'Session ' + m.lectures.position + ': ' + esc(m.lectures.title) : 'Whole course') + (m.url ? ' · link' : ' · file') + '</div></div><button class="btn btn-ghost btn-sm" data-material="' + m.id + '">' + (m.url ? 'Open' : 'Download') + '</button></li>'; }).join('') + '</ul>' : L.empty('No materials yet. Checklists and sample drafts appear here as sessions are released.');
      $$('[data-material]').forEach(function (b) { b.addEventListener('click', function () { openMaterial(mats.filter(function (m) { return m.id === b.getAttribute('data-material'); })[0], b); }); });
    });
  }
  function assignmentsTab(slug) {
    Promise.all([sb.from('assignments').select('*, lectures(position)').eq('course_slug', slug).order('created_at'), sb.from('submissions').select('*').eq('user_id', session.user.id)]).then(function (r) {
      var subs = {}; (r[1].data || []).forEach(function (s) { subs[s.assignment_id] = s; });
      var asg = r[0].data || [];
      $('#tab').innerHTML = asg.length ? '<ul class="list">' + asg.map(function (a) {
        var s = subs[a.id], pill = s ? (s.graded_at ? '<span class="pill ok">Graded' + (s.grade ? ': ' + esc(s.grade) : '') + '</span>' : '<span class="pill">Submitted</span>') : (a.due_at && new Date(a.due_at) < new Date() ? '<span class="pill bad">Overdue</span>' : '<span class="pill warn">To do</span>');
        return '<li><a class="row" href="#/assignment/' + a.id + '"><div class="grow"><div class="t">' + esc(a.title) + '</div><div class="s">' + (a.lectures ? 'After session ' + a.lectures.position + ' · ' : '') + (a.due_at ? 'Due ' + esc(L.fmtDate(a.due_at)) : 'No deadline') + '</div></div>' + pill + '</a></li>';
      }).join('') + '</ul>' : L.empty('No assignments yet. Each session ends with a practice exercise; they appear here as sessions are released.');
    });
  }
  function noticesTab(slug) {
    sb.from('announcements').select('*').or('audience.eq.all,audience.eq.' + slug + (batches[slug] ? ',audience.eq.batch:' + batches[slug].id : '')).order('pinned', { ascending: false }).order('created_at', { ascending: false }).then(function (r) {
      $('#tab').innerHTML = (r.data && r.data.length) ? r.data.map(noticeHtml).join('') : L.empty('No announcements yet.');
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

  /* ------------------------------------------------------------ lecture */
  function lecturePage(id) {
    L.render(L.spinner('Loading session'));
    sb.from('lectures_student').select('*').eq('id', id).maybeSingle().then(function (r) {
      var l = r.data;
      if (!l) return L.render(L.empty('This session is not available to you.'));
      Promise.all([
        sb.from('lectures_student').select('id, title, position, lessons, available').eq('course_slug', l.course_slug).order('position'),
        sb.from('lecture_progress').select('*').eq('user_id', session.user.id),
        sb.from('materials').select('*').eq('lecture_id', id),
        sb.from('assignments').select('id, title').eq('lecture_id', id)
      ]).then(function (rr) {
        var all = rr[0].data || [], prog = {}; (rr[1].data || []).forEach(function (x) { prog[x.lecture_id] = x; });
        var rows = sessionsFor(l.course_slug, all, prog), me = rows.filter(function (x) { return x.id === id; })[0] || { n: l.position, lessons: l.lessons || [] };
        var idx = rows.indexOf(me), prev = null, next = null;
        for (var i = idx - 1; i >= 0; i--) if (rows[i].lecture) { prev = rows[i]; break; }
        for (var j = idx + 1; j < rows.length; j++) if (rows[j].lecture) { next = rows[j]; break; }
        var p = prog[id], mats = rr[2].data || [], asg = rr[3].data || [];
        L.render('<p class="eyebrow"><a href="#/course/' + esc(l.course_slug) + '">' + esc(L.courseName(l.course_slug)) + '</a> · Session ' + me.n + ' of ' + rows.length + '</p><h1>' + esc(l.title) + '</h1>' +
          '<div class="lecture-layout"><div><div class="player" id="player">' + L.spinner('Loading video') + '</div>' +
          '<div class="actions" style="margin:1rem 0 1.5rem"><button class="btn ' + (p && p.completed ? 'btn-ghost' : '') + '" id="done">' + (p && p.completed ? '✓ Completed' : 'Mark as completed') + '</button>' +
          (prev ? '<a class="btn btn-ghost" href="#/lecture/' + prev.lecture.id + '">← Session ' + prev.n + '</a>' : '') + (next ? '<a class="btn btn-ghost" href="#/lecture/' + next.lecture.id + '">Session ' + next.n + ' →</a>' : '<a class="btn btn-ghost" href="#/course/' + esc(l.course_slug) + '?tab=assignments">Assignments →</a>') + '</div>' +
          '<div class="prose">' + L.nl2p(l.description) + '</div></div>' +
          '<aside><div class="card"><p class="eyebrow">This session</p><div class="kv"><dt>Length</dt><dd>' + esc(L.minutes(l.duration_min) || '—') + '</dd></div>' +
          (me.lessons.length ? '<h3 style="margin-top:1rem">What it covers</h3><ul class="covers">' + me.lessons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
          (mats.length ? '<h3 style="margin-top:1rem">Materials</h3><ul class="list">' + mats.map(function (m) { return '<li><div class="grow t">' + esc(m.title) + '</div><button class="btn btn-ghost btn-sm" data-material="' + m.id + '">' + (m.url ? 'Open' : 'Download') + '</button></li>'; }).join('') + '</ul>' : '') +
          (asg.length ? '<h3 style="margin-top:1rem">Practice exercise</h3><ul class="list">' + asg.map(function (a) { return '<li><a class="row" href="#/assignment/' + a.id + '"><div class="grow t">' + esc(a.title) + '</div>→</a></li>'; }).join('') + '</ul>' : '') +
          '</div>' + (next ? '<div class="card" style="margin-top:1rem"><p class="eyebrow">Up next</p><a class="row" href="#/lecture/' + next.lecture.id + '"><span class="num">' + String(next.n).padStart(2, '0') + '</span><div class="grow t">' + esc(next.lecture.title) + '</div></a></div>' : '') + '</aside></div>');
        $$('[data-material]').forEach(function (b) { b.addEventListener('click', function () { openMaterial(mats.filter(function (m) { return m.id === b.getAttribute('data-material'); })[0], b); }); });
        $('#done').addEventListener('click', function () {
          var completed = !(p && p.completed);
          sb.from('lecture_progress').upsert({ user_id: session.user.id, lecture_id: id, completed: completed, seconds: (p && p.seconds) || 0, updated_at: new Date().toISOString() }).then(function (x) {
            if (x.error) return L.toast(L.err(x.error), 'error');
            p = p || {}; p.completed = completed; prog[id] = p;
            $('#done').textContent = completed ? '✓ Completed' : 'Mark as completed'; $('#done').className = 'btn ' + (completed ? 'btn-ghost' : '');
            if (completed) { logEvent('lecture_completed', { lecture_id: id, course: l.course_slug }); L.toast(next ? 'Session ' + me.n + ' done. Session ' + next.n + ' is next.' : 'Session ' + me.n + ' done.', 'ok'); }
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
      if (!p || p.seconds < 60) sb.from('lecture_progress').upsert({ user_id: session.user.id, lecture_id: l.id, seconds: 60, completed: (p && p.completed) || false, updated_at: new Date().toISOString() }).then(function () {});
    } else el.innerHTML = L.empty(l.release_at && new Date(l.release_at) > new Date() ? 'This recording is released on ' + L.fmtDateTime(l.release_at) + '.' : 'The recording for this session has not been released yet.');
  }

  /* ------------------------------------------------------------ assignments */
  function assignmentPage(id) {
    L.render(L.spinner('Loading'));
    Promise.all([sb.from('assignments').select('*').eq('id', id).maybeSingle(), sb.from('submissions').select('*').eq('assignment_id', id).eq('user_id', session.user.id).maybeSingle()]).then(function (r) {
      var a = r[0].data, s = r[1].data;
      if (!a) return L.render(L.empty('This assignment is not available to you.'));
      var locked = s && s.graded_at;
      L.render('<p class="eyebrow"><a href="#/course/' + esc(a.course_slug) + '?tab=assignments">' + esc(L.courseName(a.course_slug)) + '</a> · Assignment</p><h1>' + esc(a.title) + '</h1><p class="muted">' + (a.due_at ? 'Due ' + esc(L.fmtDateTime(a.due_at)) : 'No deadline') + '</p>' +
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

  /* ------------------------------------------------------------ live training */
  function trainingState(t) {
    if (!t.finished) return { label: 'Upcoming', cls: 'ok' };
    if (t.attended === false) return { label: 'Marked absent', cls: 'bad' };
    if (!t.feedback_given) return { label: 'Feedback pending', cls: 'warn' };
    return { label: t.certificate_no ? 'Certificate issued' : 'Certificate ready', cls: 'ok' };
  }
  function trainingPage() {
    L.render('<div class="page-head"><div><p class="eyebrow">Live training</p><h1>Your live training sessions</h1><p>Recordings appear here after each session. Share your feedback to unlock the participation certificate.</p></div><a class="btn btn-ghost" href="' + L.cfg.siteUrl + '/live-training/" target="_blank" rel="noopener">Upcoming sessions on vidiksha.in ↗</a></div><div id="tt">' + L.spinner() + '</div>');
    sb.from('my_training').select('*').order('starts_at', { ascending: false }).then(function (r) {
      var rows = r.data || [];
      $('#tt').innerHTML = rows.length ? '<div class="grid grid-2">' + rows.map(function (t) {
        var st = trainingState(t);
        return '<div class="card"><p class="eyebrow">' + esc(t.starts_at ? L.schedule(t.days, t.starts_at, t.duration_min) : 'Date to be announced') + '</p><h3><a href="#/training/' + encodeURIComponent(t.session_slug) + '">' + esc(t.title) + '</a></h3><div class="muted small">' + ((t.days && t.days.length > 1) ? t.days.length + ' days · ' : '') + (L.totalMinutes(t.days, t.duration_min) ? esc(L.minutes(L.totalMinutes(t.days, t.duration_min))) + ' · ' : '') + esc(t.platform || 'Microsoft Teams') + '</div><div style="margin:0.6rem 0"><span class="pill ' + st.cls + '">' + st.label + '</span>' + ((t.replay_url || t.recording_path) && t.finished ? ' <span class="pill ok">Recording available</span>' : '') + '</div>' +
          '<div class="actions"><a class="btn btn-sm" href="#/training/' + encodeURIComponent(t.session_slug) + '">' + (t.finished ? ((t.replay_url || t.recording_path) ? '▶ Watch the recording' : 'Open') : 'Details') + '</a>' + (t.whatsapp_group_url && !t.finished ? '<a class="btn btn-ghost btn-sm" href="' + esc(t.whatsapp_group_url) + '" target="_blank" rel="noopener">WhatsApp group</a>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">You have not registered for a live training session yet. <a href="' + L.cfg.siteUrl + '/live-training/" target="_blank" rel="noopener">See upcoming sessions</a>.</div>';
    });
  }
  function trainingSessionPage(slug) {
    L.render(L.spinner());
    Promise.all([sb.from('my_training').select('*').eq('session_slug', slug).maybeSingle(), sb.from('training_feedback').select('*').eq('session_slug', slug).eq('user_id', session.user.id).maybeSingle()]).then(function (r) {
      var t = r[0].data, fb = r[1].data;
      if (!t) return L.render(L.empty('You are not registered for this session.'));
      var st = trainingState(t);
      L.render('<p class="eyebrow"><a href="#/training">Live training</a></p><h1>' + esc(t.title) + '</h1><p class="muted">' + esc(t.starts_at ? L.schedule(t.days, t.starts_at, t.duration_min) : '') + (L.totalMinutes(t.days, t.duration_min) ? ' · ' + ((t.days && t.days.length > 1) ? t.days.length + ' days, ' : '') + esc(L.minutes(L.totalMinutes(t.days, t.duration_min))) : '') + ' · ' + esc(t.platform || 'Microsoft Teams') + ' · <span class="pill ' + st.cls + '">' + st.label + '</span></p>' +
        '<div class="lecture-layout"><div>' +
        (t.finished ? '<div class="player" id="player">' + L.spinner('Loading recording') + '</div>' : '<div class="card"><p class="eyebrow">Before the session</p><p>' + (t.summary ? esc(t.summary) : '') + '</p><p class="muted">The Teams link and reminders are posted in the WhatsApp group. The recording appears here within 24 hours of the session.</p>' + (t.whatsapp_group_url ? '<a class="btn" href="' + esc(t.whatsapp_group_url) + '" target="_blank" rel="noopener">Open the WhatsApp group</a>' : '') + '</div>') +
        (t.finished ? '<div class="section"><div class="section-head"><h2>' + (fb ? 'Your feedback' : 'Share your feedback') + '</h2></div>' +
          (fb ? '<div class="card"><p class="muted small">Submitted ' + esc(L.fmtDate(fb.created_at)) + ' · rated ' + fb.rating + ' of 5' + (fb.consent_publish ? ' · may be published on vidiksha.in' : ' · private') + '</p><div class="prose">' + L.nl2p(fb.feedback) + '</div><p class="small"><a href="' + esc(fb.linkedin_url) + '" target="_blank" rel="noopener">' + esc(fb.linkedin_url) + '</a></p></div>'
            : '<form class="form card" id="fb-form"><p class="muted" style="margin:0">Feedback of at least 100 words, your LinkedIn profile and your consent to publish it are required before the participation certificate can be downloaded. It helps us plan the next session and helps others decide.</p>' +
              L.field('How useful was the session?', '<select name="rating" required><option value="">Choose</option><option value="5">5 · Excellent</option><option value="4">4 · Very good</option><option value="3">3 · Good</option><option value="2">2 · Fair</option><option value="1">1 · Poor</option></select>') +
              L.field('Your feedback: at least 100 words (what worked, what you would change, what you will do differently at work)', '<textarea name="feedback" required placeholder="At least 100 words" style="min-height:180px"></textarea><span class="fine" id="fb-words">0 words · 100 needed</span>') +
              L.field('Your LinkedIn profile link (required)', '<input type="url" name="linkedin_url" required placeholder="https://www.linkedin.com/in/your-name">') +
              '<label class="check"><input type="checkbox" name="consent_publish" required> I consent to VIDIKSHA publishing this feedback with my name, profession and LinkedIn profile on vidiksha.in (required)</label>' +
              '<div><button class="btn" type="submit">Submit feedback</button></div><p class="status" id="fb-st"></p></form>') + '</div>' : '') +
        '</div><aside><div class="card"><p class="eyebrow">Participation certificate</p>' +
        (!t.finished ? '<p class="muted small">Available after the session, once you have shared your feedback.</p>' : t.attended === false ? '<p class="muted small">Our records show you did not attend. Write to team@vidiksha.in if that is wrong.</p>' : !t.feedback_given ? '<p class="muted small">Share your feedback on the left and the certificate unlocks here.</p>' : '<p class="small">' + (t.certificate_no ? 'Certificate ' + esc(t.certificate_no) : 'Your certificate is ready.') + '</p><button class="btn" id="cert">Download certificate (PDF)</button><p class="status" id="cert-st"></p>') +
        '</div>' + (t.whatsapp_group_url && t.finished ? '<div class="card" style="margin-top:1rem"><p class="eyebrow">Session group</p><a class="btn btn-ghost btn-sm" href="' + esc(t.whatsapp_group_url) + '" target="_blank" rel="noopener">Open the WhatsApp group</a></div>' : '') + '</aside></div>');
      if (t.finished) {
        var el = $('#player');
        if (t.recording_path) sb.storage.from('lms-videos').createSignedUrl(t.recording_path, 3 * 3600).then(function (x) { el.innerHTML = x.error ? L.empty('The recording could not be loaded: ' + L.err(x.error)) : '<video controls controlsList="nodownload" playsinline preload="metadata" src="' + esc(x.data.signedUrl) + '"></video>'; });
        else if (t.replay_url) el.innerHTML = '<iframe src="' + esc(L.embedUrl(t.replay_url)) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        else el.innerHTML = L.empty('The recording is being prepared and appears here within 24 hours of the session.');
      }
      var form = $('#fb-form');
      var words = function (t) { return String(t || '').trim().split(/\s+/).filter(Boolean).length; };
      if (form) { form.feedback.addEventListener('input', function () { var n = words(form.feedback.value); $('#fb-words').textContent = n + ' word' + (n === 1 ? '' : 's') + (n < 100 ? ' · ' + (100 - n) + ' more needed' : ' · thank you'); }); }
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault(); var f = L.formData(form), st = $('#fb-st');
        if (words(f.feedback) < 100) { st.textContent = 'Please write at least 100 words; you have ' + words(f.feedback) + '.'; st.className = 'status is-error'; return; }
        if (!/^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(f.linkedin_url)) { st.textContent = 'Your LinkedIn profile link is required (it starts with https://www.linkedin.com/in/).'; st.className = 'status is-error'; return; }
        if (!f.consent_publish) { st.textContent = 'Please provide consent to publish the feedback on the website.'; st.className = 'status is-error'; return; }
        st.textContent = 'Saving…'; st.className = 'status';
        sb.from('training_feedback').insert({ session_slug: slug, user_id: session.user.id, rating: Number(f.rating), feedback: f.feedback, linkedin_url: f.linkedin_url, consent_publish: true }).then(function (x) {
          if (x.error) { var m = L.err(x.error); st.textContent = /training_feedback_consent/.test(m) ? 'Please provide consent to publish the feedback on the website.' : /training_feedback_min_words/.test(m) ? 'Please write at least 100 words.' : /training_feedback_linkedin/.test(m) ? 'Your LinkedIn profile link is required.' : m; st.className = 'status is-error'; return; }
          logEvent('training_feedback', { session: slug }); L.toast('Thank you. Your certificate is unlocked.', 'ok'); trainingSessionPage(slug);
        });
      });
      var cert = $('#cert');
      if (cert) cert.addEventListener('click', function () {
        var st = $('#cert-st'); cert.disabled = true; st.textContent = 'Preparing your certificate…'; st.className = 'status';
        sb.auth.getSession().then(function (s) { return fetch(L.cfg.functionsUrl + '/payments/certificate?session=' + encodeURIComponent(slug), { headers: { Authorization: 'Bearer ' + s.data.session.access_token, apikey: L.cfg.anonKey } }); })
          .then(function (res) { if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || 'Could not prepare the certificate.'); }); return res.blob(); })
          .then(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'VIDIKSHA-certificate-' + slug + '.pdf'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); st.textContent = ''; cert.disabled = false; logEvent('certificate_downloaded', { session: slug }); if (!t.certificate_no) trainingSessionPage(slug); })
          .catch(function (err) { st.textContent = L.err(err); st.className = 'status is-error'; cert.disabled = false; });
      });
    });
  }

  /* ------------------------------------------------------------ notices, messages, profile */
  function noticeHtml(n) {
    var aud = n.audience === 'all' ? '' : n.audience.indexOf('batch:') === 0 ? (function () { var k = Object.keys(batches).filter(function (s) { return batches[s].id === n.audience.slice(6); })[0]; return k ? L.courseName(k) + ' · ' + batches[k].name : 'your batch'; })() : L.courseName(n.audience);
    return '<div class="notice ' + (n.pinned ? 'is-pinned' : '') + '"><div class="meta">' + esc(L.fmtDate(n.created_at)) + (aud ? ' · ' + esc(aud) : '') + (n.pinned ? ' · pinned' : '') + '</div><strong>' + esc(n.title) + '</strong>' + (n.body ? '<div class="prose small" style="margin-top:0.35rem">' + L.nl2p(n.body) + '</div>' : '') + '</div>';
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
        profile = Object.assign(profile, f); L.toast('Profile saved', 'ok'); shell(); profilePage();
      });
    });
    $('#pw-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = L.formData(e.target), st = $('#pw-status');
      if (f.password !== f.confirm) { st.textContent = 'The two passwords differ.'; st.className = 'status is-error'; return; }
      sb.auth.updateUser({ password: f.password }).then(function (r) { st.textContent = r.error ? L.err(r.error) : 'Password updated.'; st.className = 'status ' + (r.error ? 'is-error' : 'is-ok'); if (!r.error) e.target.reset(); });
    });
    sb.from('course_enrolments').select('course_title, amount_inr, invoice_no, paid_at, razorpay_payment_id, razorpay_order_id').eq('status', 'paid').order('paid_at', { ascending: false }).then(function (r) {
      var rows = r.data || [];
      $('#inv').innerHTML = rows.length ? '<ul class="list">' + rows.map(function (e, i) { return '<li><div class="grow"><div class="t">' + esc(e.course_title) + '</div><div class="s">' + esc(e.invoice_no || 'Invoice being prepared') + ' · ' + esc(L.fmtDate(e.paid_at)) + ' · ' + L.fmtInr(e.amount_inr) + '</div></div>' + (e.invoice_no ? '<button class="btn btn-ghost btn-sm" data-invoice="' + i + '">Download PDF</button>' : '') + '</li>'; }).join('') + '</ul><p class="fine" style="margin-top:0.75rem">Tax invoice and payment receipt in one PDF, the same document that came with your welcome email.</p>' : L.empty('No invoices on this account.');
      $$('[data-invoice]').forEach(function (b) {
        b.addEventListener('click', function () {
          var e = rows[Number(b.getAttribute('data-invoice'))]; b.disabled = true; b.textContent = 'Preparing…';
          sb.auth.getSession().then(function (s) {
            return fetch(L.cfg.functionsUrl + '/payments/invoice?order=' + encodeURIComponent(e.razorpay_order_id), { headers: { Authorization: 'Bearer ' + s.data.session.access_token, apikey: L.cfg.anonKey } });
          }).then(function (res) { if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || 'Could not prepare the invoice.'); }); return res.blob(); })
            .then(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'VIDIKSHA-invoice-' + e.invoice_no.replace(/\//g, '-') + '.pdf'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); b.disabled = false; b.textContent = 'Download PDF'; })
            .catch(function (err) { L.toast(L.err(err), 'error'); b.disabled = false; b.textContent = 'Download PDF'; });
        });
      });
    });
  }

  /* ------------------------------------------------------------ routing */
  var routes = L.router({
    '': dashboard, 'courses': coursesPage, 'course/:slug': function (p, q) { coursePage(p.slug, q); }, 'lecture/:id': function (p) { lecturePage(p.id); },
    'assignment/:id': function (p) { assignmentPage(p.id); }, 'training': trainingPage, 'training/:slug': function (p) { trainingSessionPage(p.slug); }, 'notices': noticesPage, 'messages': messagesPage, 'profile': profilePage
  }, function () { L.render(L.empty('Page not found.')); });
  function route() {
    var r = routes.parse();
    if (!session) return loginScreen();
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
    if (event === 'SIGNED_IN' && !had) { logEvent('portal_login', { ua: navigator.userAgent.slice(0, 120) }); sb.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', s.user.id).then(function () {}); return boot(); }
    if (event === 'SIGNED_OUT') { profile = null; courses = []; location.hash = '#/'; return route(); }
    if (event === 'INITIAL_SESSION') return boot();
  });
})();
