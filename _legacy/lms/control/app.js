/* VIDIKSHA control panel (control.vidiksha.in). Staff only: the account must be listed in public.staff.
   Students, enrolments, training registrations, course content, assignments, announcements, messages, blog. */
(function () {
  'use strict';
  var L = window.LMS, sb = L.sb, esc = L.esc, $ = L.$, $$ = L.$$;
  var app = document.getElementById('app');
  var session = null, me = null; // me = staff row
  var COURSES = L.cfg.courses;

  /* ------------------------------------------------------------ auth */
  function authShell(inner) { app.innerHTML = '<div class="auth"><div class="auth-card"><a class="brand" href="#/">VIDIKSHA<small>Control panel</small></a>' + inner + '</div></div>'; L.passwordToggles(app); }
  function loginScreen(msg) {
    authShell('<h1>Staff sign in</h1><form class="form" id="login-form">' +
      L.field('Email', '<input type="email" name="email" required autocomplete="username">') +
      L.field('Password', '<div class="pw"><input type="password" name="password" id="pw" required autocomplete="current-password"><button type="button" data-toggle-password="pw">Show</button></div>') +
      '<button class="btn" type="submit">Sign in</button><p class="status" id="st">' + esc(msg || '') + '</p></form>' +
      '<div class="auth-foot">Staff accounts are ordinary VIDIKSHA accounts that an admin has added to the team. Forgot the password? Ask an admin to set a new one from your member page.</div>');
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault(); var f = L.formData(e.target), st = $('#st'); st.textContent = 'Signing in…'; st.className = 'status';
      sb.auth.signInWithPassword({ email: f.email.toLowerCase(), password: f.password }).then(function (r) { if (r.error) { st.textContent = r.error.message; st.className = 'status is-error'; } });
    });
  }
  function noAccess() {
    authShell('<h1>No access</h1><p class="muted">' + esc(session.user.email) + ' is signed in but is not on the VIDIKSHA team. Ask an admin to add you, then sign in again.</p><button class="btn btn-ghost" id="out">Sign out</button>');
    $('#out').addEventListener('click', function () { sb.auth.signOut(); });
  }

  /* ------------------------------------------------------------ shell */
  var NAV = [['', 'Overview'], ['students', 'Students'], ['enrolments', 'Enrolments'], ['invoices', 'Invoices'], ['training', 'Training sessions'], ['feedbacks', 'Feedbacks'], ['courses', 'Course content'], ['grading', 'Grading'], ['notices', 'Announcements'], ['messages', 'Messages'], ['blog', 'Blog posts'], ['team', 'Team']];
  function shell() {
    var name = me.full_name || session.user.email;
    app.innerHTML = '<div class="shell"><aside class="sidebar"><a class="brand" href="#/">VIDIKSHA<small>Control panel</small></a><nav class="nav" id="nav"></nav><div class="nav-sep"></div><nav class="nav"><a href="' + L.cfg.portalUrl + '" target="_blank" rel="noopener">Learning portal ↗</a><a href="' + L.cfg.siteUrl + '" target="_blank" rel="noopener">vidiksha.in ↗</a><a href="https://supabase.com/dashboard/project/euvlsarftingglxvsuzq" target="_blank" rel="noopener">Supabase ↗</a></nav>' +
      '<div class="user-chip"><span class="avatar">' + esc(L.initials(name)) + '</span><div><b>' + esc(name) + '</b><span class="small">' + esc(me.role) + '</span> · <button type="button" id="signout">Sign out</button></div></div></aside><main id="main"></main></div>';
    $('#signout').addEventListener('click', function () { sb.auth.signOut(); });
    drawNav();
  }
  function drawNav() {
    var cur = location.hash.replace(/^#\/?/, '').split('/')[0] || '';
    var alias = { student: 'students', course: 'courses', lecture: 'courses', assignment: 'grading' };
    $('#nav').innerHTML = NAV.filter(function (n) { return n[0] !== 'team' || me.role === 'admin'; }).map(function (n) { return '<a href="#/' + n[0] + '" class="' + ((alias[cur] || cur) === n[0] ? 'is-active' : '') + '">' + n[1] + '</a>'; }).join('');
  }
  function head(eyebrow, title, sub, actions) { return '<div class="page-head"><div><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>'; }
  function table(cols, rows, emptyText) {
    if (!rows.length) return L.empty(emptyText || 'Nothing here yet.');
    return '<div class="table-wrap"><table><thead><tr>' + cols.map(function (c) { return '<th class="' + (c.nowrap ? 'nowrap' : '') + '">' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td class="' + (c.nowrap ? 'nowrap' : '') + '">' + (c.html ? c.html(r) : esc(c.get ? c.get(r) : r[c.key])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function courseSelect(name, value, allowAll) { return '<select name="' + name + '">' + (allowAll ? '<option value="all"' + (value === 'all' ? ' selected' : '') + '>Everyone</option>' : '') + Object.keys(COURSES).map(function (s) { return '<option value="' + s + '"' + (s === value ? ' selected' : '') + '>' + esc(COURSES[s]) + '</option>'; }).join('') + '</select>'; }
  function dialog(title, formHtml, onSubmit) {
    var d = document.createElement('dialog');
    d.innerHTML = '<div class="dlg"><h2>' + esc(title) + '</h2><form class="form" method="dialog">' + formHtml + '<div class="actions"><button class="btn" type="submit" value="ok">Save</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div><p class="status"></p></form></div>';
    document.body.appendChild(d); d.showModal();
    $('[data-close]', d).addEventListener('click', function () { d.close(); d.remove(); });
    var form = $('form', d);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('.status', d); st.textContent = 'Saving…'; st.className = 'status';
      Promise.resolve(onSubmit(L.formData(form), form)).then(function () { d.close(); d.remove(); }, function (err) { st.textContent = L.err(err); st.className = 'status is-error'; });
    });
    return d;
  }
  function confirmDelete(what) { return window.confirm('Delete ' + what + '? This cannot be undone.'); }
  function must(r) { if (r.error) throw r.error; return r.data; }
  function dtLocal(iso) { if (!iso) return ''; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function fromLocal(v) { return v ? new Date(v).toISOString() : null; }

  /* ------------------------------------------------------------ overview */
  function overview() {
    L.render(head('Overview', 'VIDIKSHA at a glance') + '<div class="grid grid-4" id="stats">' + L.spinner() + '</div>' +
      '<div class="grid grid-2 section"><div><div class="section-head"><h2>Latest enrolments</h2><a href="#/enrolments">All</a></div><div id="recent">' + L.spinner() + '</div></div>' +
      '<div><div class="section-head"><h2>Submissions awaiting grading</h2><a href="#/grading">Grading</a></div><div id="queue">' + L.spinner() + '</div></div></div>');
    var since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('course_enrolments').select('amount_inr').eq('status', 'paid'),
      sb.from('training_registrations').select('id', { count: 'exact', head: true }),
      sb.from('research_logins').select('id', { count: 'exact', head: true }).gte('created_at', since30),
      sb.from('activity_log').select('id', { count: 'exact', head: true }).eq('event', 'portal_login').gte('created_at', since30),
      sb.from('submissions').select('id', { count: 'exact', head: true }).is('graded_at', null)
    ]).then(function (r) {
      var paid = r[1].data || [], revenue = paid.reduce(function (a, e) { return a + Number(e.amount_inr || 0); }, 0);
      $('#stats').innerHTML = [[r[0].count || 0, 'member accounts'], [paid.length, 'paid enrolments'], [L.fmtInr(revenue), 'collected'], [r[2].count || 0, 'training registrations'], [r[3].count || 0, 'research logins, 30 days'], [r[4].count || 0, 'portal logins, 30 days'], [r[5].count || 0, 'submissions to grade']]
        .map(function (s) { return '<div class="card stat"><div class="n">' + esc(s[0]) + '</div><div class="l">' + esc(s[1]) + '</div></div>'; }).join('');
    });
    sb.from('enrolment_overview').select('*').order('created_at', { ascending: false }).limit(8).then(function (r) {
      $('#recent').innerHTML = table([{ label: 'When', get: function (e) { return L.fmtDate(e.paid_at || e.created_at); } }, { label: 'Name', html: function (e) { return '<a href="#/students?q=' + encodeURIComponent(e.email) + '">' + esc(e.full_name) + '</a>'; } }, { label: 'Course', get: function (e) { return e.course_title; } }, { label: 'Status', html: function (e) { return pillStatus(e.status); } }], r.data || []);
    });
    sb.from('submissions').select('id, submitted_at, assignment_id, user_id, assignments(title, course_slug), profiles:user_id(full_name)').is('graded_at', null).order('submitted_at').limit(8).then(function (r) {
      $('#queue').innerHTML = table([{ label: 'Submitted', get: function (s) { return L.fmtDate(s.submitted_at); } }, { label: 'Student', get: function (s) { return s.profiles ? s.profiles.full_name : ''; } }, { label: 'Assignment', html: function (s) { return '<a href="#/assignment/' + s.assignment_id + '">' + esc(s.assignments ? s.assignments.title : '') + '</a>'; } }], r.data || [], 'Nothing waiting.');
    });
  }
  function pillStatus(s) { return '<span class="pill ' + (s === 'paid' ? 'ok' : s === 'failed' ? 'bad' : 'warn') + '">' + esc(s) + '</span>'; }

  /* ------------------------------------------------------------ students */
  function students(p, q) {
    L.render(head('Students', 'Members', 'Everyone with a VIDIKSHA account: buyers, training registrants and research members. Click a name for their activity and course access.', '<button class="btn btn-ghost" id="csv">Export CSV</button>') +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search name, email, organisation" value="' + esc(q.q || '') + '"><select id="filter"><option value="">All members</option><option value="paid">Paid a course</option><option value="training">Registered for training</option><option value="research">Used research</option><option value="portal">Used the portal</option></select></div><div id="tbl">' + L.spinner() + '</div>');
    var rows = [];
    function draw() {
      var s = $('#q').value.trim().toLowerCase(), f = $('#filter').value;
      var list = rows.filter(function (r) { return (!s || [r.full_name, r.email, r.organisation, r.profession].join(' ').toLowerCase().indexOf(s) >= 0) && (!f || (f === 'paid' && r.paid_courses > 0) || (f === 'training' && r.registrations > 0) || (f === 'research' && r.research_logins > 0) || (f === 'portal' && r.last_portal_login)); });
      $('#tbl').innerHTML = '<p class="muted small">' + list.length + ' of ' + rows.length + '</p>' + table([
        { label: 'Member', html: function (r) { return '<a href="#/student/' + r.id + '"><strong>' + esc(r.full_name || '(no name)') + '</strong></a><div class="muted small">' + esc(r.email) + (r.whatsapp ? ' · ' + esc(r.whatsapp) : '') + '</div>'; }, wrap: true },
        { label: 'Profile', html: function (r) { return esc([r.profession, r.organisation].filter(Boolean).join(' · ')) + (r.qualification ? '<div class="muted small">' + esc(r.qualification) + '</div>' : ''); }, wrap: true },
        { label: 'Courses', html: function (r) { return (r.paid_courses || 0) + (r.grants ? ' <span class="muted small">+' + r.grants + ' granted</span>' : ''); } },
        { label: 'Sessions', key: 'registrations' }, { label: 'Research', key: 'research_logins' },
        { label: 'Joined', get: function (r) { return L.fmtDate(r.created_at); } },
        { label: 'Last seen', html: function (r) { var d = r.last_portal_login || r.last_login_at; return d ? esc(L.fmtDate(d)) + '<div class="muted small">' + (r.last_portal_login ? 'portal' : 'site') + '</div>' : '<span class="muted">never</span>'; } }
      ], list, 'No members match.');
    }
    sb.from('student_overview').select('*').order('created_at', { ascending: false }).then(function (r) { rows = r.data || []; draw(); });
    $('#q').addEventListener('input', draw); $('#filter').addEventListener('change', draw);
    $('#csv').addEventListener('click', function () { L.download('vidiksha-members.csv', L.csv(rows, [{ label: 'Name', key: 'full_name' }, { label: 'Email', key: 'email' }, { label: 'WhatsApp', key: 'whatsapp' }, { label: 'Profession', key: 'profession' }, { label: 'Organisation', key: 'organisation' }, { label: 'Qualification', key: 'qualification' }, { label: 'Paid courses', key: 'paid_courses' }, { label: 'Training registrations', key: 'registrations' }, { label: 'Research logins', key: 'research_logins' }, { label: 'Joined', key: 'created_at' }, { label: 'Last portal login', key: 'last_portal_login' }])); });
  }
  function accessEnd(x) { return x.kind === 'grant' ? x.expires_at : (x.access_until || (x.paid_at ? new Date(new Date(x.paid_at).getTime() + 61 * 864e5).toISOString() : null)); }
  function accessState(x) {
    if (x.suspended_at) return { label: 'Paused', cls: 'bad' };
    var until = accessEnd(x);
    if (until && new Date(until) < new Date()) return { label: 'Expired', cls: 'warn' };
    return { label: 'Active', cls: 'ok' };
  }
  function student(id) {
    L.render(L.spinner());
    sb.from('profiles').select('*').eq('id', id).maybeSingle().then(function (pr) {
      var p = pr.data; if (!p) return L.render(L.empty('No such member.'));
      return Promise.all([
        sb.from('course_enrolments').select('*').or('user_id.eq.' + id + ',email.ilike.' + p.email.replace(/[,()]/g, '')).order('created_at', { ascending: false }),
        sb.from('course_grants').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        sb.from('training_registrations').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        sb.from('watch_activity').select('*').eq('user_id', id).order('last_watched', { ascending: false }),
        sb.from('submissions').select('*, assignments(title, course_slug)').eq('user_id', id).order('submitted_at', { ascending: false }),
        sb.from('messages').select('*').eq('user_id', id).order('created_at'),
        sb.from('activity_log').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(40),
        sb.from('staff').select('*').eq('user_id', id).maybeSingle(),
        sb.from('research_logins').select('created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(5),
        sb.from('lectures').select('id, course_slug, position, title, duration_min, published, video_url, video_path').order('position'),
        sb.from('course_roster').select('course_slug, batch_id, batch_name').eq('user_id', id),
        sb.from('batches').select('id, course_slug, name, is_open').order('starts_on', { ascending: false })
      ]).then(function (r) {
        var myBatch = {}; (r[10].data || []).forEach(function (x) { myBatch[x.course_slug] = x; });
        var allBatches = r[11].data || [];
        var batchOptions = function (slug, selected) { return allBatches.filter(function (b) { return b.course_slug === slug; }).map(function (b) { return '<option value="' + b.id + '"' + (b.id === selected ? ' selected' : '') + '>' + esc(b.name) + (b.is_open ? ' (open)' : '') + '</option>'; }).join(''); };
        var enr = (r[0].data || []).filter(function (e) { return e.status === 'paid'; }).map(function (e) { e.kind = 'enrolment'; return e; }), attempts = (r[0].data || []).filter(function (e) { return e.status !== 'paid'; });
        var grants = (r[1].data || []).map(function (g) { g.kind = 'grant'; return g; }), regs = r[2].data || [], watch = r[3].data || [], subs = r[4].data || [], msgs = r[5].data || [], acts = r[6].data || [], rlog = r[8].data || [], lecs = r[9].data || [];
        var access = enr.concat(grants);
        var courseSlugs = []; access.forEach(function (a) { if (courseSlugs.indexOf(a.course_slug) < 0) courseSlugs.push(a.course_slug); });
        var watchBy = {}; watch.forEach(function (w) { watchBy[w.lecture_id] = w; });
        var logins = acts.filter(function (a) { return a.event === 'portal_login'; });
        var totalMin = Math.round(watch.reduce(function (a, w) { return a + (w.seconds || 0); }, 0) / 60), doneCount = watch.filter(function (w) { return w.completed; }).length;

        L.render(head('Member', p.full_name || p.email, esc(p.email) + (p.whatsapp ? ' · ' + esc(p.whatsapp) : '') + (p.profession ? ' · ' + esc(p.profession) : '') + (p.organisation ? ' · ' + esc(p.organisation) : '') + (r[7].data ? ' · <span class="pill ok">team: ' + esc(r[7].data.role) + '</span>' : ''),
          '<button class="btn btn-ghost" id="edit">Edit details</button>' + (me.role === 'admin' ? '<button class="btn btn-ghost" id="setpw">Set password</button>' : '') + '<button class="btn" id="grant">Grant course access</button>') +
          '<div class="grid grid-4" style="margin-bottom:1.75rem">' + [[totalMin ? L.minutes(totalMin) : '0 min', 'watched in total'], [doneCount, 'sessions completed'], [logins.length ? L.fmtDate(logins[0].created_at) : 'never', 'last portal login'], [(rlog.length ? L.fmtDate(rlog[0].created_at) : 'never'), 'last research login']].map(function (x) { return '<div class="card stat"><div class="n" style="font-size:1.5rem">' + esc(x[0]) + '</div><div class="l">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' +

          '<div class="section-head"><h2>Course access</h2><span class="muted small">Disable hides the course in the portal; the record and the invoice stay.</span></div>' +
          table([
            { label: 'Course', get: function (e) { return e.course_title || L.courseName(e.course_slug); }, wrap: true },
            { label: 'Via', html: function (e) { return e.kind === 'grant' ? '<span class="pill">grant' + (e.note ? ': ' + esc(e.note) : '') + '</span>' : '<span class="pill ok">paid ' + esc(e.invoice_no || '') + '</span>'; }, wrap: true },
            { label: 'Batch', html: function (e) { var mb = myBatch[e.course_slug]; return '<select data-batch="' + esc(e.course_slug) + '" style="width:auto;padding:0.3rem 0.5rem;font-size:0.8rem"><option value="">' + (mb && mb.batch_name ? 'Change…' : 'No batch: choose') + '</option>' + batchOptions(e.course_slug, null) + '</select>' + (mb && mb.batch_name ? '<div class="small">' + esc(mb.batch_name) + '</div>' : ''); }, wrap: true },
            { label: 'From', get: function (e) { return L.fmtDate(e.paid_at || e.created_at); } },
            { label: 'Until', html: function (e) { var u = accessEnd(e); return (u && new Date(u).getFullYear() < 2200 ? esc(L.fmtDate(u)) : 'no end date') + (e.access_until ? '<div class="muted small">changed by the team</div>' : ''); } },
            { label: 'Status', html: function (e) { var st = accessState(e); return '<span class="pill ' + st.cls + '">' + st.label + '</span>' + (e.suspended_at ? '<div class="muted small">' + esc(L.fmtDate(e.suspended_at)) + (e.suspended_reason ? ': ' + esc(e.suspended_reason) : '') + '</div>' : ''); }, wrap: true },
            { label: '', html: function (e) { return (e.suspended_at ? '<button class="btn btn-sm" data-enable="' + e.kind + '|' + e.id + '">Enable</button>' : '<button class="btn btn-ghost btn-sm" data-disable="' + e.kind + '|' + e.id + '">Disable</button>') + ' <button class="btn btn-ghost btn-sm" data-extend="' + e.kind + '|' + e.id + '">End date</button>' + (e.kind === 'grant' ? ' <button class="btn btn-danger btn-sm" data-del-grant="' + e.id + '">Remove</button>' : ''); } }
          ], access, 'No courses on this account. Use "Grant course access" to add one.') +
          (attempts.length ? '<p class="muted small" style="margin-top:0.5rem">' + attempts.length + ' unpaid purchase attempt' + (attempts.length > 1 ? 's' : '') + ' (' + attempts.map(function (a) { return a.status + ' ' + L.fmtDate(a.created_at); }).join(', ') + ').</p>' : '') +

          '<div class="section"><div class="section-head"><h2>Watching activity</h2><span class="muted small">Every session of each course, with how much of the recording has been watched.</span></div>' +
          (courseSlugs.length ? courseSlugs.map(function (slug) {
            var mine = lecs.filter(function (l) { return l.course_slug === slug; });
            var rows = mine.map(function (l) { return { n: l.position, title: l.title, lecture: (l.published && (l.video_url || l.video_path)) ? l : null, row: l }; });
            var done = rows.filter(function (x) { return x.lecture && watchBy[x.lecture.id] && watchBy[x.lecture.id].completed; }).length;
            return '<h3 style="margin-top:1rem">' + esc(L.courseName(slug)) + ' <span class="muted small">' + done + ' of ' + rows.length + ' completed</span></h3>' + table([
              { label: '#', get: function (x) { return x.n; } }, { label: 'Session', get: function (x) { return x.title; }, wrap: true },
              { label: 'Watched', html: function (x) { var w = x.row && watchBy[x.row.id]; if (!x.lecture && !w) return '<span class="muted">no recording yet</span>'; if (!x.lecture) x.lecture = x.row; if (!w) return '<span class="muted">not opened</span>'; var pct = x.lecture.duration_min ? Math.min(100, Math.round(w.seconds / 60 * 100 / x.lecture.duration_min)) : null; return (L.minutes(Math.round(w.seconds / 60)) || '< 1 min') + (pct !== null ? ' <span class="muted small">(' + pct + '%)</span>' : '') + '<div class="progress" style="margin-top:0.3rem;width:120px"><i style="width:' + (w.completed ? 100 : pct || 0) + '%"></i></div>'; } },
              { label: 'Status', html: function (x) { var w = x.lecture && watchBy[x.lecture.id]; return !x.lecture ? '' : w && w.completed ? '<span class="pill ok">completed</span>' : w ? '<span class="pill warn">in progress</span>' : '<span class="pill">not started</span>'; } },
              { label: 'Last watched', get: function (x) { var w = x.lecture && watchBy[x.lecture.id]; return w ? L.fmtDateTime(w.last_watched) : ''; } }
            ], rows, 'No sessions in this course yet.');
          }).join('') : L.empty('No course access, so nothing to watch yet.')) + '</div>' +

          '<div class="grid grid-2 section" style="align-items:start"><div>' +
          '<div class="section-head"><h2>Submissions</h2></div>' + table([{ label: 'Assignment', html: function (s) { return '<a href="#/assignment/' + s.assignment_id + '">' + esc(s.assignments ? s.assignments.title : '') + '</a>'; }, wrap: true }, { label: 'Submitted', get: function (s) { return L.fmtDate(s.submitted_at); } }, { label: 'Grade', get: function (s) { return s.graded_at ? (s.grade || 'graded') : 'pending'; } }], subs, 'No submissions.') +
          '<div class="section"><div class="section-head"><h2>Training sessions</h2></div>' + table([{ label: 'Session', key: 'session_title', wrap: true }, { label: 'Date', get: function (x) { return L.fmtDate(x.session_date); } }, { label: 'Registered', get: function (x) { return L.fmtDate(x.created_at); } }], regs, 'No registrations.') + '</div>' +
          '<div class="section"><div class="section-head"><h2>Logins and activity</h2></div>' + table([{ label: 'When', get: function (a) { return L.fmtDateTime(a.created_at); } }, { label: 'Event', get: function (a) { return a.event.replace(/_/g, ' '); } }, { label: 'Detail', get: function (a) { return a.meta ? Object.keys(a.meta).filter(function (k) { return k !== 'ua'; }).map(function (k) { return k + ': ' + a.meta[k]; }).join(', ') : ''; }, wrap: true }], acts, 'No activity recorded.') + '</div>' +
          '</div><div>' +
          '<div class="section-head"><h2>Messages</h2></div><div id="msgs">' + (msgs.length ? msgs.map(function (m) { return '<div class="msg ' + (m.from_staff ? 'is-mine' : '') + '"><div class="prose">' + L.nl2p(m.body) + '</div><div class="meta">' + (m.from_staff ? 'Team' : esc(p.full_name || 'Student')) + ' · ' + esc(L.fmtDateTime(m.created_at)) + (m.from_staff ? (m.read_at ? ' · read' : ' · unread') : '') + '</div></div>'; }).join('') : L.empty('No messages yet.')) + '</div>' +
          '<form class="form" id="msg-form" style="margin-top:1rem"><label class="field"><span>Send a message</span><textarea name="body" required placeholder="It appears in their portal under Messages"></textarea></label><div><button class="btn" type="submit">Send</button></div><p class="status" id="msg-st"></p></form>' +
          '</div></div>');

        $('#msg-form').addEventListener('submit', function (e) {
          e.preventDefault(); var st = $('#msg-st'); st.textContent = 'Sending…';
          sb.from('messages').insert({ user_id: id, from_staff: true, sender_id: session.user.id, body: e.target.body.value.trim() }).then(function (x) { if (x.error) { st.textContent = L.err(x.error); st.className = 'status is-error'; return; } L.toast('Sent', 'ok'); student(id); });
        });
        if ($('#setpw')) $('#setpw').addEventListener('click', function () {
          var d = dialog('Set a new password for ' + (p.full_name || p.email), '<p class="muted">The member signs in with this password from now on, on the portal and, if they are staff, here. Tell them the new password yourself; nothing is emailed.</p>' + L.field('New password (at least 8 characters)', '<div class="pw"><input type="password" name="password" id="apw" required minlength="8" autocomplete="new-password"><button type="button" data-toggle-password="apw">Show</button></div>') + L.field('Repeat it', '<input type="password" name="confirm" required minlength="8" autocomplete="new-password">'), function (f) {
            if (f.password.length < 8) throw new Error('At least 8 characters.');
            if (f.password !== f.confirm) throw new Error('The two passwords differ.');
            return sb.auth.getSession().then(function (s) { return fetch(L.cfg.functionsUrl + '/payments/admin/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.data.session.access_token, apikey: L.cfg.anonKey }, body: JSON.stringify({ user_id: id, password: f.password }) }); })
              .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not set the password.'); }); }).then(function () { L.toast('Password changed', 'ok'); });
          });
          L.passwordToggles(d);
        });
        $$('[data-batch]').forEach(function (sel) { sel.addEventListener('change', function () { if (!sel.value) return; sb.rpc('assign_batch', { uid: id, slug: sel.getAttribute('data-batch'), bid: sel.value }).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); L.toast('Batch changed', 'ok'); student(id); }); }); });
        $('#grant').addEventListener('click', function () {
          var d = dialog('Grant course access', L.field('Course', courseSelect('course_slug')) + L.field('Batch', '<select name="batch_id"><option value="">Open batch (default)</option></select>') + L.field('Access until (leave empty for no end date)', '<input type="date" name="expires">') + L.field('Note (why)', '<input type="text" name="note" placeholder="e.g. complimentary, batch 2 scholarship">'), function (f) {
            return sb.from('course_grants').insert({ user_id: id, course_slug: f.course_slug, batch_id: f.batch_id || null, expires_at: f.expires ? new Date(f.expires + 'T23:59:59').toISOString() : null, note: f.note, granted_by: session.user.id }).then(must).then(function () { L.toast('Access granted', 'ok'); student(id); });
          });
          var cs = $('[name=course_slug]', d), bs = $('[name=batch_id]', d);
          var fill = function () { bs.innerHTML = '<option value="">Open batch (default)</option>' + batchOptions(cs.value, null); };
          cs.addEventListener('change', fill); fill();
        });
        $('#edit').addEventListener('click', function () {
          dialog('Edit member', '<div class="form-row">' + L.field('Full name', '<input type="text" name="full_name" value="' + esc(p.full_name || '') + '">') + L.field('WhatsApp', '<input type="text" name="whatsapp" value="' + esc(p.whatsapp || '') + '">') + '</div><div class="form-row">' + L.field('Profession', '<input type="text" name="profession" value="' + esc(p.profession || '') + '">') + L.field('Organisation', '<input type="text" name="organisation" value="' + esc(p.organisation || '') + '">') + '</div>' + L.field('Qualification', '<input type="text" name="qualification" value="' + esc(p.qualification || '') + '">'), function (f) {
            return sb.from('profiles').update(f).eq('id', id).then(must).then(function () { L.toast('Saved', 'ok'); student(id); });
          });
        });
        $$('[data-disable]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-disable').split('|'); dialog('Disable course access', '<p class="muted">The student keeps the account and the invoice, but the course disappears from their portal until you enable it again.</p>' + L.field('Reason (shown only to the team)', '<input type="text" name="reason" placeholder="e.g. payment dispute, credential sharing">'), function (f) { return sb.rpc('set_course_access', { kind: k[0], row_id: k[1], enabled: false, reason: f.reason || null }).then(must).then(function () { L.toast('Access disabled', 'ok'); student(id); }); }); }); });
        $$('[data-enable]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-enable').split('|'); sb.rpc('set_course_access', { kind: k[0], row_id: k[1], enabled: true }).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); L.toast('Access enabled', 'ok'); student(id); }); }); });
        $$('[data-extend]').forEach(function (b) { b.addEventListener('click', function () {
          var k = b.getAttribute('data-extend').split('|'), row = access.filter(function (a) { return a.id === k[1]; })[0], cur = accessEnd(row);
          dialog('Change the end date', '<p class="muted">Current end: ' + (cur && new Date(cur).getFullYear() < 2200 ? esc(L.fmtDate(cur)) : 'no end date') + '. Leave empty for no end date.</p>' + L.field('Access until', '<input type="date" name="until" value="' + (cur && new Date(cur).getFullYear() < 2200 ? new Date(cur).toISOString().slice(0, 10) : '') + '">'), function (f) {
            var until = f.until ? new Date(f.until + 'T23:59:59').toISOString() : null;
            var q = k[0] === 'grant' ? sb.from('course_grants').update({ expires_at: until }).eq('id', k[1]) : sb.rpc('set_enrolment_access_until', { enrolment_id: k[1], until: until || new Date('2200-01-01').toISOString() });
            return q.then(must).then(function () { L.toast('End date changed', 'ok'); student(id); });
          });
        }); });
        $$('[data-del-grant]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this access grant')) return; sb.from('course_grants').delete().eq('id', b.getAttribute('data-del-grant')).then(function () { student(id); }); }); });
      });
    });
  }

  /* ------------------------------------------------------------ invoices */
  function invoices() {
    L.render(head('Invoices', 'Invoices', 'Every tax invoice issued for a paid course, newest first. Download opens the same PDF the buyer received.', '<button class="btn btn-ghost" id="csv">Export CSV</button>') +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search invoice, name, email, phone"><select id="course"><option value="">All courses</option>' + Object.keys(COURSES).map(function (s) { return '<option value="' + s + '">' + esc(COURSES[s]) + '</option>'; }).join('') + '</select><select id="fy"><option value="">All years</option></select></div><div id="tbl">' + L.spinner() + '</div>');
    var rows = [];
    function draw() {
      var s = $('#q').value.toLowerCase(), c = $('#course').value, fy = $('#fy').value;
      var list = rows.filter(function (r) { return (!s || [r.invoice_no, r.full_name, r.email, r.whatsapp].join(' ').toLowerCase().indexOf(s) >= 0) && (!c || r.course_slug === c) && (!fy || (r.invoice_no || '').indexOf('/' + fy + '/') >= 0); });
      $('#tbl').innerHTML = '<p class="muted small">' + list.length + ' invoices · ' + L.fmtInr(list.reduce(function (a, r) { return a + Number(r.amount_inr); }, 0)) + '</p>' + table([
        { label: 'S. No.', nowrap: true, html: function (r) { return String(list.indexOf(r) + 1); } },
        { label: 'Invoice number', nowrap: true, html: function (r) { return '<strong>' + esc(r.invoice_no) + '</strong>'; } },
        { label: 'Date', nowrap: true, get: function (r) { return L.fmtDate(r.invoice_at || r.paid_at); } },
        { label: 'Full name', html: function (r) { return r.user_id ? '<a href="#/student/' + r.user_id + '">' + esc(r.full_name) + '</a>' : esc(r.full_name); } },
        { label: 'Email ID', key: 'email' },
        { label: 'Contact number', nowrap: true, key: 'whatsapp' },
        { label: 'Course', key: 'course_title' },
        { label: 'Amount', nowrap: true, get: function (r) { return L.fmtInr(r.amount_inr); } },
        { label: 'Download', nowrap: true, html: function (r) { return '<button class="btn btn-ghost btn-sm" data-dl="' + esc(r.razorpay_order_id) + '" data-no="' + esc(r.invoice_no) + '">PDF</button>'; } }
      ], list, 'No invoices yet.');
      $$('[data-dl]').forEach(function (b) { b.addEventListener('click', function () {
        b.disabled = true; b.textContent = '…';
        sb.auth.getSession().then(function (s2) { return fetch(L.cfg.functionsUrl + '/payments/invoice?order=' + encodeURIComponent(b.getAttribute('data-dl')), { headers: { Authorization: 'Bearer ' + s2.data.session.access_token, apikey: L.cfg.anonKey } }); })
          .then(function (res) { if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || 'Could not prepare the invoice.'); }); return res.blob(); })
          .then(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'VIDIKSHA-invoice-' + b.getAttribute('data-no').replace(/\//g, '-') + '.pdf'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); })
          .catch(function (e) { L.toast(L.err(e), 'error'); }).then(function () { b.disabled = false; b.textContent = 'PDF'; });
      }); });
      $('#csv').onclick = function () { L.download('vidiksha-invoices.csv', L.csv(list, [{ label: 'S. No.', get: function (r) { return list.indexOf(r) + 1; } }, { label: 'Invoice number', key: 'invoice_no' }, { label: 'Date', get: function (r) { return L.fmtDate(r.invoice_at || r.paid_at); } }, { label: 'Full name', key: 'full_name' }, { label: 'Email', key: 'email' }, { label: 'Contact', key: 'whatsapp' }, { label: 'Course', key: 'course_title' }, { label: 'Amount (INR)', key: 'amount_inr' }, { label: 'Payment id', key: 'razorpay_payment_id' }, { label: 'Method', key: 'payment_method' }])); };
    }
    sb.from('course_enrolments').select('*').eq('status', 'paid').not('invoice_no', 'is', null).order('invoice_at', { ascending: false }).then(function (r) {
      rows = r.data || [];
      var fys = []; rows.forEach(function (x) { var m = /\/(\d\d-\d\d)\//.exec(x.invoice_no || ''); if (m && fys.indexOf(m[1]) < 0) fys.push(m[1]); });
      $('#fy').innerHTML = '<option value="">All years</option>' + fys.map(function (f) { return '<option value="' + f + '">FY 20' + f.replace('-', '–20') + '</option>'; }).join('');
      draw();
    });
    ['q', 'course', 'fy'].forEach(function (i) { $('#' + i).addEventListener('input', draw); $('#' + i).addEventListener('change', draw); });
  }

  /* ------------------------------------------------------------ enrolments & training */
  function enrolments() {
    L.render(head('Enrolments', 'Course enrolments', 'Every purchase attempt with the student’s batch and progress. Paid rows also appear in the Google Sheet.', '<button class="btn btn-ghost" id="csv">Export CSV</button>') +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search name, email, invoice, payment"><select id="filter"><option value="paid">Paid</option><option value="">All attempts</option><option value="created">Started, not paid</option><option value="failed">Failed</option></select><select id="course"><option value="">All courses</option>' + Object.keys(COURSES).map(function (s) { return '<option value="' + s + '">' + esc(COURSES[s]) + '</option>'; }).join('') + '</select><select id="batch"><option value="">All batches</option></select><select id="sort"><option value="date">Newest first</option><option value="course">By course, then batch</option><option value="batch">By batch</option><option value="progress">Progress, highest first</option><option value="progress-asc">Progress, lowest first</option><option value="name">By name</option></select><select id="elig"><option value="">Certificate: any</option><option value="yes">Eligible only</option><option value="no">Not yet eligible</option></select></div><div id="tbl">' + L.spinner() + '</div>');
    var rows = [], batches = [], roster = {}, lecturesBy = {}, progressBy = {};
    function stats(r) {
      var lecs = lecturesBy[r.course_slug] || [], prog = (r.user_id && progressBy[r.user_id]) || {};
      var total = lecs.length, done = 0, secs = 0, totalMin = 0;
      lecs.forEach(function (l) { var p = prog[l.id]; totalMin += l.duration_min || 0; if (p) { if (p.completed) done++; secs += Math.min(p.seconds || 0, (l.duration_min || 0) * 60 || Infinity); } });
      var pct = total ? Math.round(done * 100 / total) : 0;
      return { total: total, done: done, hours: Math.round(secs / 360) / 10, totalHours: Math.round(totalMin / 6) / 10, pct: pct, eligible: total > 0 && done === total };
    }
    function batchOptions() {
      var c = $('#course').value, sel = $('#batch'), cur = sel.value;
      sel.innerHTML = '<option value="">All batches</option>' + batches.filter(function (b) { return !c || b.course_slug === c; }).map(function (b) { return '<option value="' + b.id + '"' + (b.id === cur ? ' selected' : '') + '>' + (c ? '' : esc(L.courseName(b.course_slug)) + ' · ') + esc(b.name) + (b.is_open ? ' (open)' : '') + '</option>'; }).join('');
    }
    function draw() {
      var s = $('#q').value.toLowerCase(), f = $('#filter').value, c = $('#course').value, b = $('#batch').value, sort = $('#sort').value, el = $('#elig').value;
      var list = rows.filter(function (r) {
        var rb = r.user_id && roster[r.user_id + '|' + r.course_slug];
        return (!s || [r.full_name, r.email, r.whatsapp, r.invoice_no, r.razorpay_payment_id].join(' ').toLowerCase().indexOf(s) >= 0) && (!f || r.status === f) && (!c || r.course_slug === c) && (!b || (rb && rb.batch_id === b)) && (!el || (r.status === 'paid' && (el === 'yes') === r.st.eligible));
      });
      var bname = function (r) { var rb = r.user_id && roster[r.user_id + '|' + r.course_slug]; return (rb && rb.batch_name) || ''; };
      list.sort(function (x, y) {
        if (sort === 'course') return (x.course_title + bname(x)).localeCompare(y.course_title + bname(y)) || (y.created_at > x.created_at ? 1 : -1);
        if (sort === 'batch') return (bname(x) || '~').localeCompare(bname(y) || '~') || x.course_title.localeCompare(y.course_title);
        if (sort === 'progress') return y.st.pct - x.st.pct || y.st.hours - x.st.hours;
        if (sort === 'progress-asc') return x.st.pct - y.st.pct || x.st.hours - y.st.hours;
        if (sort === 'name') return String(x.full_name).localeCompare(String(y.full_name));
        return (y.paid_at || y.created_at) > (x.paid_at || x.created_at) ? 1 : -1;
      });
      var paid = list.filter(function (r) { return r.status === 'paid'; });
      $('#tbl').innerHTML = '<p class="muted small">' + list.length + ' rows · ' + L.fmtInr(paid.reduce(function (a, r) { return a + Number(r.amount_inr); }, 0)) + ' paid · ' + paid.filter(function (r) { return r.st.eligible; }).length + ' eligible for a certificate</p>' + table([
        { label: 'When', nowrap: true, html: function (r) { return esc(L.fmtDate(r.paid_at || r.created_at)) + '<span class="sub">' + esc(new Date(r.paid_at || r.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })) + '</span>' + pillStatus(r.status); } },
        { label: 'Buyer', html: function (r) { return (r.user_id ? '<a href="#/student/' + r.user_id + '"><strong>' + esc(r.full_name) + '</strong></a>' : '<strong>' + esc(r.full_name) + '</strong>') + '<span class="sub">' + esc(r.email) + '</span><span class="sub">' + esc(r.whatsapp || '') + (r.profession ? ' · ' + esc(r.profession) : '') + (r.organisation ? ' · ' + esc(r.organisation) : '') + '</span>'; } },
        { label: 'Course · batch', html: function (r) { var bn = bname(r); return esc(r.course_title) + '<span class="sub">' + (bn ? esc(bn) : (r.status === 'paid' ? '<span class="pill warn">no batch</span>' : '')) + '</span><span class="sub">' + L.fmtInr(r.amount_inr) + (r.invoice_no ? ' · ' + esc(r.invoice_no) : '') + (r.razorpay_payment_id ? ' · <span class="mono">' + esc(r.razorpay_payment_id) + '</span>' : '') + (r.payment_method ? ' · ' + esc(r.payment_method) : '') + '</span>'; } },
        { label: 'Kit delivery address', html: function (r) { return esc(r.address_line || '') + '<span class="sub">' + esc([r.city, r.state, r.pincode].filter(Boolean).join(', ')) + '</span>'; } },
        { label: 'Progress', nowrap: true, html: function (r) { if (r.status !== 'paid') return ''; var t = r.st; if (!t.total) return '<span class="muted small">no sessions yet</span>'; return '<strong>' + t.done + ' / ' + t.total + '</strong> sessions<span class="sub">' + t.hours + ' / ' + t.totalHours + ' h watched</span><span class="sub">' + t.pct + '% completed</span><div class="progress" style="width:110px;margin-top:0.3rem"><i style="width:' + t.pct + '%"></i></div>'; } },
        { label: 'Certificate', nowrap: true, html: function (r) { if (r.status !== 'paid') return ''; return r.st.eligible ? '<span class="pill ok">eligible</span>' : '<span class="pill">not yet</span><span class="sub">needs 100%</span>'; } },
        { label: 'After payment', html: function (r) { if (r.status !== 'paid') return ''; return (r.account_status ? '<span class="pill ok">account ' + esc(r.account_status) + '</span>' : '<span class="pill warn">no account</span>') + '<span class="sub">' + (r.welcome_sent_at ? 'welcome email sent' : '<span class="pill bad">email not sent</span>') + (r.sheet_sent_at ? ' · in sheet' : '') + '</span>'; } }
      ], list);
      $('#csv').onclick = function () { L.download('vidiksha-enrolments.csv', L.csv(list, ['created_at', 'paid_at', 'status', 'course_title', 'amount_inr', 'invoice_no', 'full_name', 'email', 'whatsapp', 'profession', 'organisation', 'address_line', 'city', 'state', 'pincode', 'razorpay_payment_id', 'payment_method', 'account_status'].map(function (k) { return { label: k, key: k }; }).concat([{ label: 'batch', get: bname }, { label: 'sessions_completed', get: function (r) { return r.st.done; } }, { label: 'sessions_total', get: function (r) { return r.st.total; } }, { label: 'hours_watched', get: function (r) { return r.st.hours; } }, { label: 'hours_total', get: function (r) { return r.st.totalHours; } }, { label: 'percent_completed', get: function (r) { return r.st.pct; } }, { label: 'certificate_eligible', get: function (r) { return r.st.eligible ? 'yes' : 'no'; } }]))); };
    }
    Promise.all([
      sb.from('course_enrolments').select('*').order('created_at', { ascending: false }),
      sb.from('batches').select('id, course_slug, name, is_open').order('starts_on', { ascending: false }),
      sb.from('course_roster').select('user_id, course_slug, batch_id, batch_name'),
      sb.from('lectures').select('id, course_slug, duration_min'),
      sb.from('lecture_progress').select('user_id, lecture_id, seconds, completed')
    ]).then(function (r) {
      rows = r[0].data || []; batches = r[1].data || [];
      (r[2].data || []).forEach(function (x) { roster[x.user_id + '|' + x.course_slug] = x; });
      (r[3].data || []).forEach(function (l) { (lecturesBy[l.course_slug] = lecturesBy[l.course_slug] || []).push(l); });
      (r[4].data || []).forEach(function (p) { (progressBy[p.user_id] = progressBy[p.user_id] || {})[p.lecture_id] = p; });
      rows.forEach(function (x) { x.st = stats(x); });
      batchOptions(); draw();
    });
    ['q', 'filter', 'batch', 'sort', 'elig'].forEach(function (i) { $('#' + i).addEventListener('input', draw); $('#' + i).addEventListener('change', draw); });
    $('#course').addEventListener('change', function () { batchOptions(); draw(); });
  }
  function sessionDialog(s) {
    var isNew = !s.slug;
    var d = dialog(isNew ? 'Add training session' : 'Edit training session',
      L.field('Title', '<input type="text" name="title" required value="' + esc(s.title || '') + '" data-title>') +
      L.field('URL slug' + (isNew ? ' (auto from the date and title)' : ' (fixed; registrations are keyed to it)'), '<input type="text" name="slug" value="' + esc(s.slug || '') + '"' + (isNew ? ' placeholder="auto"' : ' readonly') + '>') +
      L.field('Summary (shown on the card and the registration page)', '<textarea name="summary">' + esc(s.summary || '') + '</textarea>') +
      '<div class="field"><span>Days: one row per sitting (date, start time, length). A one-day session has one row.</span><div id="days-editor"></div><button type="button" class="btn btn-ghost btn-sm" id="add-day" style="margin-top:0.4rem">Add a day</button></div>' +
      '<div class="form-row">' + L.field('Price (INR, 0 = free)', '<input type="number" name="price_inr" min="0" value="' + esc(s.price_inr == null ? 0 : s.price_inr) + '">') + L.field('Area', '<select name="area">' + AREAS.map(function (a) { return '<option' + ((s.area || 'Trademark') === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>') + '</div>' +
      '<div class="form-row">' + L.field('Format line (first tick on the card)', '<input type="text" name="format" value="' + esc(s.format || 'Real Registry examination report + live drafting') + '">') + L.field('Certificate line (second tick)', '<input type="text" name="certificate" value="' + esc(s.certificate || 'Certificate of Training on successful completion') + '">') + '</div>' +
      '<div class="form-row">' + L.field('Platform', '<input type="text" name="platform" value="' + esc(s.platform || 'Microsoft Teams') + '">') + L.field('WhatsApp group invite link', '<input type="url" name="whatsapp_group_url" value="' + esc(s.whatsapp_group_url || '') + '" placeholder="https://chat.whatsapp.com/…">') + '</div>' +
      L.field('External registration page (optional; otherwise the site’s own form)', '<input type="url" name="external_register_url" value="' + esc(s.external_register_url || '') + '">') +
      '<label class="check"><input type="checkbox" name="published_on_site"' + (s.published_on_site || isNew ? ' checked' : '') + '> <strong>Show on vidiksha.in</strong> (live training page and, if it is the next one, the home page)</label>' +
      '<p class="fine">Showing commits the session to the website repository; the site rebuilds in a minute or two. Unticking hides it from the site but keeps the session and its registrations here. The recording is never published on the site; registrants watch it in their portal.</p>',
      function (f, form) {
        var days = $$('.day-row', form).map(function (r) { var start = $('[data-day-start]', r).value; if (!start) return null; var fileInp = $('[data-day-file]', r); return { starts_at: fromLocal(start), duration_min: Number($('[data-day-len]', r).value) || 180, replay_url: $('[data-day-url]', r).value.trim() || null, recording_path: r.getAttribute('data-existing-path') || null, _file: fileInp && fileInp.files[0] }; }).filter(Boolean).sort(function (a, b) { return a.starts_at < b.starts_at ? -1 : 1; });
        if (!days.length) throw new Error('Add at least one day with its date and time.');
        f.starts_at = days[0].starts_at;
        var slug = isNew ? L.slugify(days[0].starts_at.slice(0, 10) + ' ' + (f.slug || f.title)) : s.slug;
        if (!slug) throw new Error('Could not make a URL slug.');
        var row = { slug: slug, title: f.title, summary: f.summary, starts_at: days[0].starts_at, duration_min: days[0].duration_min, price_inr: Number(f.price_inr) || 0, area: f.area, format: f.format, certificate: f.certificate, platform: f.platform || 'Microsoft Teams', external_register_url: f.external_register_url || null, whatsapp_group_url: f.whatsapp_group_url || null, updated_at: new Date().toISOString() };
        // upload each day's new recording (if any), then store the days without the file handles
        var up = days.reduce(function (chain, day, i) { return chain.then(function () { if (!day._file) return; return upload('lms-videos', 'training/' + slug + '/day' + (i + 1) + '-' + Date.now() + '-' + L.safeName(day._file.name), day._file).then(function (p2) { day.recording_path = p2; }); }); }, Promise.resolve()).then(function () {
          row.days = days.map(function (day) { return { starts_at: day.starts_at, duration_min: day.duration_min, replay_url: day.replay_url, recording_path: day.recording_path }; });
          // the session-level fields mirror day 1, so the portal keeps working until it shows every day
          row.replay_url = row.days[0].replay_url; row.recording_path = row.days[0].recording_path;
        });
        var wantSite = !!f.published_on_site, wasSite = !!s.published_on_site;
        return up.then(function () { return sb.from('training_sessions').upsert(row, { onConflict: 'slug' }).then(must); }).then(function () {
          if (wantSite) return sitePublish('session', slug).then(function () { L.toast('Saved and shown on vidiksha.in', 'ok'); });
          if (wasSite && !wantSite) return sitePublish('unpublish_session', slug).then(function () { L.toast('Saved and hidden from vidiksha.in', 'ok'); });
          L.toast('Saved', 'ok');
        }).then(function () { if (location.hash.indexOf('#/training/') === 0) trainingSession(slug); else training(); });
      });
    var t = $('[data-title]', d), sl = $('[name=slug]', d);
    if (isNew) { t.addEventListener('input', function () { if (!sl.dataset.touched) sl.value = L.slugify(t.value); }); sl.addEventListener('input', function () { sl.dataset.touched = '1'; }); }
    // days editor
    var ed = $('#days-editor', d);
    var addDay = function (day) {
      var n = ed.children.length + 1;
      var row = document.createElement('div'); row.className = 'day-row'; row.style.cssText = 'border:1px solid var(--line); padding:0.75rem 0.9rem; margin-bottom:0.6rem; display:grid; grid-template-columns: 1fr 120px; gap:0.6rem 1rem; align-items:end';
      if (day && day.recording_path) row.setAttribute('data-existing-path', day.recording_path);
      row.innerHTML = '<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center"><strong class="small">Day ' + n + '</strong><button type="button" class="btn btn-ghost btn-sm" data-remove-day>Remove day</button></div>' +
        '<label class="field"><span>Date and start time (IST)</span><input type="datetime-local" data-day-start value="' + esc(dtLocal(day && day.starts_at)) + '"></label><label class="field"><span>Minutes</span><input type="number" min="30" step="15" data-day-len value="' + esc((day && day.duration_min) || 120) + '"></label>' +
        '<label class="field" style="grid-column:1/-1"><span>Recording link for this day (YouTube unlisted, Vimeo, Loom, Google Drive)</span><input type="url" data-day-url value="' + esc((day && day.replay_url) || '') + '" placeholder="https://youtu.be/…"></label>' +
        '<label class="field" style="grid-column:1/-1"><span>Or upload this day\'s recording (mp4; streams only to registrants)' + (day && day.recording_path ? '. Current file: ' + esc(day.recording_path.split('/').pop()) : '') + '</span><input type="file" data-day-file accept="video/mp4,video/webm,video/quicktime"></label>';
      ed.appendChild(row);
      $('[data-remove-day]', row).addEventListener('click', function () { if (ed.children.length > 1) { row.remove(); $$('.day-row strong', ed).forEach(function (el, i) { el.textContent = 'Day ' + (i + 1); }); } });
    };
    var initial = (s.days && s.days.length) ? s.days.map(function (day, i) { return i === 0 && !day.replay_url && !day.recording_path ? Object.assign({}, day, { replay_url: s.replay_url, recording_path: s.recording_path }) : day; }) : (s.starts_at ? [{ starts_at: s.starts_at, duration_min: s.duration_min || 180, replay_url: s.replay_url, recording_path: s.recording_path }] : [null]);
    initial.forEach(addDay);
    $('#add-day', d).addEventListener('click', function () {
      var last = $$('[data-day-start]', ed).slice(-1)[0], len = $$('[data-day-len]', ed).slice(-1)[0];
      var next = null;
      if (last && last.value) { var t2 = new Date(fromLocal(last.value)); t2.setDate(t2.getDate() + 1); next = { starts_at: t2.toISOString(), duration_min: Number(len && len.value) || 120 }; }
      addDay(next);
    });
  }
  function training() {
    L.render(head('Training sessions', 'Live training sessions', 'Click a session for its participants. Show and Hide control whether it appears on vidiksha.in.', '<button class="btn btn-ghost" id="csv">Export all registrations</button><button class="btn" id="add">Add session</button>') + '<p class="status" id="tr-st"></p><div id="sessions">' + L.spinner() + '</div>');
    Promise.all([sb.from('training_session_overview').select('*').order('starts_at', { ascending: false }), sb.from('training_registrations').select('*').order('created_at', { ascending: false })]).then(function (r) {
      var sessions = r[0].data || [], regs = r[1].data || [], now = new Date();
      var counts = {}; regs.forEach(function (x) { counts[x.session_slug] = (counts[x.session_slug] || 0) + 1; });
      // Registrations whose session was removed still need a home.
      Object.keys(counts).forEach(function (k) { if (!sessions.some(function (s) { return s.slug === k; })) { var x = regs.filter(function (y) { return y.session_slug === k; })[0]; sessions.push({ slug: k, title: x.session_title, starts_at: x.session_date, removed: true, registrations: counts[k] }); } });
      $('#sessions').innerHTML = sessions.length ? table([
        { label: 'When', html: function (s) { var d = new Date(s.starts_at); var endd = (s.days && s.days.length) ? new Date(new Date(s.days[s.days.length - 1].starts_at).getTime() + Number(s.days[s.days.length - 1].duration_min || 180) * 60000) : new Date(d.getTime() + (s.duration_min || 180) * 60000); return (s.removed ? esc(L.fmtDate(d)) : esc(L.schedule(s.days, s.starts_at, s.duration_min)) + '<span class="sub">' + ((s.days && s.days.length > 1) ? s.days.length + ' days · ' : '') + esc(L.minutes(L.totalMinutes(s.days, s.duration_min))) + '</span>') + (s.removed ? '<span class="pill bad">removed</span>' : endd < now ? '<span class="pill">past</span>' : '<span class="pill ok">upcoming</span>'); } },
        { label: 'Session', html: function (s) { return '<a href="#/training/' + encodeURIComponent(s.slug) + '"><strong>' + esc(s.title) + '</strong></a>' + (s.removed ? '' : '<span class="sub">' + esc(s.area || '') + ' · ' + (s.price_inr ? L.fmtInr(s.price_inr) : 'Free') + ' · ' + esc(s.platform || '') + '</span>'); } },
        { label: 'Website', html: function (s) { return s.removed ? '' : s.published_on_site ? '<span class="pill ok">shown</span>' : '<span class="pill">hidden</span>'; } },
        { label: 'Registered', html: function (s) { return '<a href="#/training/' + encodeURIComponent(s.slug) + '">' + (s.registrations || 0) + '</a>'; } },
        { label: '', html: function (s) { return s.removed ? '' : '<a class="btn btn-ghost btn-sm" href="#/training/' + encodeURIComponent(s.slug) + '">Participants</a> <button class="btn btn-ghost btn-sm" data-edit="' + esc(s.slug) + '">Edit</button> ' + (s.published_on_site ? '<button class="btn btn-ghost btn-sm" data-hide="' + esc(s.slug) + '">Hide</button>' : '<button class="btn btn-sm" data-show="' + esc(s.slug) + '">Show</button>'); } }
      ], sessions) : L.empty('No sessions yet. Add the first one.');
      var st = $('#tr-st');
      var pub = function (type, slug, label) { st.textContent = label + '…'; st.className = 'status'; sitePublish(type, slug).then(function () { st.textContent = ''; L.toast(type === 'session' ? 'Shown on vidiksha.in' : 'Hidden from vidiksha.in', 'ok'); training(); }, function (e) { st.textContent = L.err(e); st.className = 'status is-error'; }); };
      $('#add').addEventListener('click', function () { sessionDialog({}); });
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { sessionDialog(sessions.filter(function (x) { return x.slug === b.getAttribute('data-edit'); })[0]); }); });
      $$('[data-hide]').forEach(function (b) { b.addEventListener('click', function () { pub('unpublish_session', b.getAttribute('data-hide'), 'Hiding from the website'); }); });
      $$('[data-show]').forEach(function (b) { b.addEventListener('click', function () { pub('session', b.getAttribute('data-show'), 'Publishing to the website'); }); });
      $('#csv').addEventListener('click', function () { L.download('vidiksha-training-registrations.csv', L.csv(regs, ['session_title', 'session_date', 'created_at', 'full_name', 'email', 'whatsapp', 'profession', 'qualification'].map(function (k) { return { label: k, key: k }; }))); });
    });
  }
  function trainingSession(slug) {
    L.render(L.spinner());
    Promise.all([sb.from('training_session_overview').select('*').eq('slug', slug).maybeSingle(), sb.from('training_registrations').select('*').eq('session_slug', slug).order('created_at'), sb.from('training_feedback_overview').select('*').eq('session_slug', slug).order('created_at', { ascending: false })]).then(function (r) {
      var s = r[0].data, regs = r[1].data || [], fbs = r[2].data || [];
      if (!s && !regs.length) return L.render(L.empty('No such session.'));
      var fbBy = {}; fbs.forEach(function (f) { fbBy[f.user_id] = f; });
      var title = s ? s.title : regs[0].session_title, when = s ? new Date(s.starts_at) : (regs[0].session_date ? new Date(regs[0].session_date) : null);
      var lastDay = s && s.days && s.days.length ? s.days[s.days.length - 1] : null;
      var finished = s && ((lastDay ? new Date(lastDay.starts_at).getTime() + Number(lastDay.duration_min || 180) * 60000 : new Date(s.starts_at).getTime() + (s.duration_min || 180) * 60000) < Date.now());
      L.render(head('Training session', title, '<a href="#/training">← All sessions</a>' + (when ? ' · ' + (s ? esc(L.schedule(s.days, s.starts_at, s.duration_min)) + ' · ' + ((s.days && s.days.length > 1) ? s.days.length + ' days, ' : '') + esc(L.minutes(L.totalMinutes(s.days, s.duration_min))) : esc(L.fmtDate(when))) : '') + (s ? ' · ' + (s.price_inr ? L.fmtInr(s.price_inr) : 'Free') + ' · ' + esc(s.platform || '') + ' · ' + (s.published_on_site ? '<span class="pill ok">shown on vidiksha.in</span>' : '<span class="pill">hidden from the website</span>') + ' · ' + (function () { var dl = (s.days && s.days.length) ? s.days : [{ replay_url: s.replay_url, recording_path: s.recording_path }]; var have = dl.filter(function (x) { return x.replay_url || x.recording_path; }).length; return have === dl.length ? '<span class="pill ok">' + (dl.length > 1 ? 'all ' + dl.length + ' recordings attached' : 'recording attached') + '</span>' : have ? '<span class="pill warn">' + have + ' of ' + dl.length + ' recordings attached</span>' : '<span class="pill warn">no recording yet</span>'; })() : ' · <span class="pill bad">session removed; registrations kept</span>'),
        (s ? '<button class="btn btn-ghost" id="edit">Edit / add recording</button>' + (s.published_on_site ? '<button class="btn btn-ghost" id="hide">Hide from website</button>' : '<button class="btn" id="show">Show on website</button>') + '<button class="btn btn-danger" id="del">Remove session</button>' : '') + (regs.length ? '<button class="btn btn-ghost" id="csv">Export CSV</button>' : '')) +
        '<p class="status" id="ts-st"></p>' + (s && s.summary ? '<p class="muted" style="max-width:70ch">' + esc(s.summary) + '</p>' : '') +
        '<div class="grid grid-4" style="margin-bottom:1.5rem">' + [[regs.length, 'registered'], [regs.filter(function (x) { return x.attended !== false; }).length, 'marked attended'], [fbs.length, 'gave feedback'], [regs.filter(function (x) { return x.certificate_no; }).length, 'certificates issued']].map(function (x) { return '<div class="card stat"><div class="n" style="font-size:1.5rem">' + x[0] + '</div><div class="l">' + x[1] + '</div></div>'; }).join('') + '</div>' +
        '<div class="section-head"><h2>Participants</h2><span class="muted small">Untick Attended for no-shows; they then cannot download a certificate.</span></div>' +
        (regs.length ? table([
          { label: '#', nowrap: true, html: function (x) { return String(regs.indexOf(x) + 1); } },
          { label: 'Name', html: function (x) { return (x.user_id ? '<a href="#/student/' + x.user_id + '"><strong>' + esc(x.full_name) + '</strong></a>' : '<strong>' + esc(x.full_name) + '</strong>') + '<span class="sub">' + esc(x.email) + '</span>'; } },
          { label: 'WhatsApp', nowrap: true, key: 'whatsapp' }, { label: 'Profession', key: 'profession' }, { label: 'Qualification', key: 'qualification' },
          { label: 'Registered', nowrap: true, get: function (x) { return L.fmtDate(x.created_at); } },
          { label: 'Attended', html: function (x) { return '<label class="check"><input type="checkbox" data-attended="' + x.id + '"' + (x.attended !== false ? ' checked' : '') + '></label>'; } },
          { label: 'Feedback', html: function (x) { var f = x.user_id && fbBy[x.user_id]; return f ? '<span class="pill ok">' + f.rating + '/5</span>' + (f.consent_publish ? '<span class="sub">consented</span>' : '<span class="sub">private</span>') : (finished ? '<span class="pill warn">pending</span>' : ''); } },
          { label: 'Certificate', nowrap: true, html: function (x) { return x.certificate_no ? esc(x.certificate_no) : '<span class="muted">—</span>'; } },
          { label: 'Account', html: function (x) { return x.user_id ? '<span class="pill ok">yes</span>' : '<span class="pill warn">none</span>'; } }
        ], regs) : L.empty('Nobody has registered yet. Registrations arrive from the form on vidiksha.in.')) +
        '<div class="section"><div class="section-head"><h2>Feedback</h2><span class="actions"><span class="muted small">' + fbs.filter(function (f) { return f.consent_publish; }).length + ' consented to publication</span><button class="btn btn-ghost btn-sm" id="pub-testimonials">Publish consented feedback to vidiksha.in</button></span></div><p class="status" id="pub-st"></p>' +
        feedbackTable(fbs, { empty: finished ? 'No feedback yet.' : 'Feedback opens for registrants once the session is over.' }) + '</div>');
      var st = $('#ts-st');
      var pub = function (type, label) { st.textContent = label + '…'; st.className = 'status'; sitePublish(type, slug).then(function () { L.toast(type === 'session' ? 'Shown on vidiksha.in' : 'Hidden from vidiksha.in', 'ok'); trainingSession(slug); }, function (e) { st.textContent = L.err(e); st.className = 'status is-error'; }); };
      if ($('#edit')) $('#edit').addEventListener('click', function () { sessionDialog(s); });
      if ($('#hide')) $('#hide').addEventListener('click', function () { pub('unpublish_session', 'Hiding from the website'); });
      if ($('#show')) $('#show').addEventListener('click', function () { pub('session', 'Publishing to the website'); });
      if ($('#del')) $('#del').addEventListener('click', function () {
        if (!confirmDelete('this session' + (regs.length ? ' (its ' + regs.length + ' registrations are kept and stay visible here)' : ''))) return;
        st.textContent = 'Removing…'; st.className = 'status';
        (s.published_on_site ? sitePublish('unpublish_session', slug) : Promise.resolve()).then(function () { return sb.from('training_sessions').delete().eq('slug', slug).then(must); }).then(function () { L.toast('Session removed', 'ok'); location.hash = '#/training'; }, function (e) { st.textContent = 'Could not remove: ' + L.err(e); st.className = 'status is-error'; });
      });
      if ($('#csv')) $('#csv').addEventListener('click', function () { L.download('vidiksha-' + slug + '-registrations.csv', L.csv(regs, ['full_name', 'email', 'whatsapp', 'profession', 'qualification', 'created_at', 'attended', 'certificate_no'].map(function (k) { return { label: k, key: k }; }))); });
      $$('[data-attended]').forEach(function (cb) { cb.addEventListener('change', function () { sb.from('training_registrations').update({ attended: cb.checked }).eq('id', cb.getAttribute('data-attended')).then(function (x) { if (x.error) { L.toast(L.err(x.error), 'error'); cb.checked = !cb.checked; } else L.toast(cb.checked ? 'Marked attended' : 'Marked absent', 'ok'); }); }); });
      $('#pub-testimonials').addEventListener('click', function () {
        var ps = $('#pub-st'); ps.textContent = 'Publishing testimonials…'; ps.className = 'status';
        sitePublish('testimonials', slug).then(function (j) { ps.innerHTML = 'Published ' + j.count + ' testimonial' + (j.count === 1 ? '' : 's') + ' across all sessions. <a href="' + esc(j.url) + '" target="_blank" rel="noopener">vidiksha.in/live-training</a> updates in a minute or two.'; ps.className = 'status is-ok'; }, function (e) { ps.textContent = L.err(e); ps.className = 'status is-error'; });
      });
    });
  }

  /* ------------------------------------------------------------ feedback table (shared) */
  function viewDialog(title, html) {
    var d = document.createElement('dialog');
    d.innerHTML = '<div class="dlg"><h2>' + esc(title) + '</h2>' + html + '<div class="actions" style="margin-top:1.25rem"><button class="btn btn-ghost" type="button" data-close>Close</button></div></div>';
    document.body.appendChild(d); d.showModal();
    $('[data-close]', d).addEventListener('click', function () { d.close(); d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) { d.close(); d.remove(); } });
    return d;
  }
  function feedbackDialog(f) {
    var t = String(f.feedback || '');
    viewDialog('Feedback from ' + (f.full_name || f.email), '<p class="muted small" style="margin:0 0 0.75rem">' + esc(f.session_title || f.session_slug) + ' · ' + esc(L.fmtDateTime(f.created_at)) + ' · rated ' + f.rating + ' of 5 · ' + t.trim().split(/\s+/).filter(Boolean).length + ' words' + (f.consent_publish ? ' · consented to publication' : ' · private') + '</p><div class="prose" style="max-height:55vh;overflow:auto;padding-right:0.5rem">' + L.nl2p(t) + '</div><p class="small" style="margin:0.75rem 0 0"><a href="' + esc(f.linkedin_url) + '" target="_blank" rel="noopener">' + esc(f.linkedin_url) + '</a></p>');
  }
  function feedbackTable(list, opts) {
    opts = opts || {};
    var cols = [
      { label: 'S. No.', nowrap: true, html: function (f) { return String(list.indexOf(f) + 1); } },
      { label: 'Date', nowrap: true, get: function (f) { return L.fmtDate(f.created_at); } },
      { label: 'Time', nowrap: true, get: function (f) { return new Date(f.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }); } },
      { label: 'Full name', html: function (f) { return f.user_id ? '<a href="#/student/' + f.user_id + '">' + esc(f.full_name || '') + '</a>' : esc(f.full_name || ''); } },
      { label: 'Email ID', key: 'email' },
      { label: 'Contact', nowrap: true, key: 'whatsapp' }
    ];
    if (opts.session) cols.push({ label: 'Session', html: function (f) { return '<a href="#/training/' + encodeURIComponent(f.session_slug) + '">' + esc(f.session_title || f.session_slug) + '</a>'; } });
    cols.push({ label: 'LinkedIn profile', nowrap: true, html: function (f) { return '<a href="' + esc(f.linkedin_url) + '" target="_blank" rel="noopener">Open profile ↗</a>'; } });
    cols.push({ label: 'Rating out of 5', nowrap: true, html: function (f) { return '<strong>' + f.rating + '</strong> / 5'; } });
    cols.push({ label: 'Feedback', nowrap: true, html: function (f) { return '<button class="btn btn-ghost btn-sm" data-view-fb="' + f.id + '">View feedback</button>'; } });
    cols.push({ label: 'Certificate', nowrap: true, html: function (f) { return f.certificate_no ? esc(f.certificate_no) + ' <button class="btn btn-ghost btn-sm" data-cert="' + f.registration_id + '">PDF</button>' : (f.attended === false ? '<span class="pill bad">absent</span>' : '<span class="muted">—</span>'); } });
    var html = table(cols, list, opts.empty || 'No feedback yet.');
    setTimeout(function () {
      $$('[data-view-fb]').forEach(function (b) { b.addEventListener('click', function () { var f = list.filter(function (x) { return x.id === b.getAttribute('data-view-fb'); })[0]; if (f) feedbackDialog(f); }); });
      $$('[data-cert]').forEach(function (b) { b.addEventListener('click', function () {
        b.disabled = true;
        sb.auth.getSession().then(function (s2) { return fetch(L.cfg.functionsUrl + '/payments/certificate?reg=' + encodeURIComponent(b.getAttribute('data-cert')), { headers: { Authorization: 'Bearer ' + s2.data.session.access_token, apikey: L.cfg.anonKey } }); })
          .then(function (res) { if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || 'Could not open the certificate.'); }); return res.blob(); })
          .then(function (blob) { var u = URL.createObjectURL(blob); window.open(u, '_blank', 'noopener'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); })
          .catch(function (e) { L.toast(L.err(e), 'error'); }).then(function () { b.disabled = false; });
      }); });
    }, 0);
    return html;
  }

  /* ------------------------------------------------------------ feedbacks */
  function feedbacks() {
    L.render(head('Feedbacks', 'Training feedback', 'Every piece of feedback from live training participants, with the certificate issued to them.', '<button class="btn btn-ghost" id="csv">Export CSV</button><button class="btn" id="pub">Publish consented feedback to vidiksha.in</button>') +
      '<p class="status" id="fb-st"></p><div class="toolbar"><input type="search" id="q" placeholder="Search name, email, text"><select id="session"><option value="">All sessions</option></select><select id="consent"><option value="">Consent: any</option><option value="yes">Consented to publish</option><option value="no">Private</option></select><select id="rating"><option value="">Rating: any</option><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select><select id="cert"><option value="">Certificate: any</option><option value="yes">Issued</option><option value="no">Not issued</option></select></div><div id="tbl">' + L.spinner() + '</div>');
    var rows = [];
    function draw() {
      var s = $('#q').value.toLowerCase(), ss = $('#session').value, c = $('#consent').value, rt = $('#rating').value, ce = $('#cert').value;
      var list = rows.filter(function (f) { return (!s || [f.full_name, f.email, f.feedback].join(' ').toLowerCase().indexOf(s) >= 0) && (!ss || f.session_slug === ss) && (!c || (c === 'yes') === !!f.consent_publish) && (!rt || String(f.rating) === rt) && (!ce || (ce === 'yes') === !!f.certificate_no); });
      var avg = list.length ? (list.reduce(function (a, f) { return a + f.rating; }, 0) / list.length).toFixed(1) : '—';
      $('#tbl').innerHTML = '<p class="muted small">' + list.length + ' feedback' + (list.length === 1 ? '' : 's') + ' · average rating ' + avg + ' · ' + list.filter(function (f) { return f.consent_publish; }).length + ' consented to publication · ' + list.filter(function (f) { return f.certificate_no; }).length + ' certificates issued</p>' + feedbackTable(list, { session: true, empty: 'No feedback yet. Participants leave it in the portal after a session ends.' });
      $('#csv').onclick = function () { L.download('vidiksha-feedback.csv', L.csv(list, [{ label: 'Date', key: 'created_at' }, { label: 'Name', key: 'full_name' }, { label: 'Email', key: 'email' }, { label: 'Profession', key: 'profession' }, { label: 'Organisation', key: 'organisation' }, { label: 'Session', key: 'session_title' }, { label: 'Rating', key: 'rating' }, { label: 'Feedback', key: 'feedback' }, { label: 'LinkedIn', key: 'linkedin_url' }, { label: 'Consent to publish', get: function (f) { return f.consent_publish ? 'yes' : 'no'; } }, { label: 'Certificate', key: 'certificate_no' }, { label: 'Certificate issued', key: 'certificate_issued_at' }])); };
    }
    sb.from('training_feedback_overview').select('*').order('created_at', { ascending: false }).then(function (r) {
      rows = r.data || [];
      var seen = {}; var opts = rows.filter(function (f) { if (seen[f.session_slug]) return false; seen[f.session_slug] = true; return true; });
      $('#session').innerHTML = '<option value="">All sessions</option>' + opts.map(function (f) { return '<option value="' + esc(f.session_slug) + '">' + esc(f.session_title || f.session_slug) + '</option>'; }).join('');
      draw();
    });
    ['q', 'session', 'consent', 'rating', 'cert'].forEach(function (i) { $('#' + i).addEventListener('input', draw); $('#' + i).addEventListener('change', draw); });
    $('#pub').addEventListener('click', function () {
      var st = $('#fb-st'); st.textContent = 'Publishing testimonials…'; st.className = 'status';
      sitePublish('testimonials', '').then(function (j) { st.innerHTML = 'Published ' + j.count + ' testimonial' + (j.count === 1 ? '' : 's') + '. <a href="' + esc(j.url) + '" target="_blank" rel="noopener">vidiksha.in/live-training</a> updates in a minute or two.'; st.className = 'status is-ok'; }, function (e) { st.textContent = L.err(e); st.className = 'status is-error'; });
    });
  }

  /* ------------------------------------------------------------ course content */
  function coursePills(c) {
    return (c.published_on_site ? '<span class="pill ok">on vidiksha.in</span>' : '<span class="pill">not on the website</span>') + ' ' + (c.enrol_open ? '<span class="pill ok">enrolment open · ' + L.fmtInr(c.price_inr) + '</span>' : '<span class="pill">enrolment closed</span>') + (c.active ? '' : ' <span class="pill bad">inactive</span>');
  }
  function courses() {
    L.render(head('Course content', 'Courses', 'Every course, published on the website or still a draft. Open one for its sessions, materials, assignments and students.', '<button class="btn" id="add-course">Add course</button>') + '<div class="grid grid-2" id="cc">' + L.spinner() + '</div>');
    Promise.all([L.loadCourses(), sb.from('lectures').select('course_slug, published'), sb.from('course_roster').select('course_slug'), sb.from('assignments').select('course_slug')]).then(function (r) {
      var lec = {}, pub = {}, ros = {}, asg = {};
      (r[1].data || []).forEach(function (l) { lec[l.course_slug] = (lec[l.course_slug] || 0) + 1; if (l.published) pub[l.course_slug] = (pub[l.course_slug] || 0) + 1; });
      (r[2].data || []).forEach(function (x) { ros[x.course_slug] = (ros[x.course_slug] || 0) + 1; });
      (r[3].data || []).forEach(function (x) { asg[x.course_slug] = (asg[x.course_slug] || 0) + 1; });
      $('#cc').innerHTML = r[0].length ? r[0].map(function (c) { var s = c.slug; return '<a class="card is-link" href="#/course/' + s + '"><p class="eyebrow">' + esc(c.area || 'Course') + '</p><h3>' + esc(c.title) + '</h3><div style="margin:0.25rem 0 0.6rem">' + coursePills(c) + '</div><div class="muted small">' + (lec[s] || 0) + ' sessions (' + (pub[s] || 0) + ' released) · ' + (asg[s] || 0) + ' assignments · ' + (ros[s] || 0) + ' students</div></a>'; }).join('') : L.empty('No courses yet. Add the first one.');
    });
    $('#add-course').addEventListener('click', function () { courseDialog({}); });
  }
  var AREAS = ['Trademark', 'Patent', 'Copyright', 'Design', 'Licensing'];
  var lines = function (arr) { return (arr || []).join('\n'); }, splitLines = function (s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
  function courseDialog(c) {
    var isNew = !c.slug;
    var d = dialog(isNew ? 'Add course' : 'Edit course',
      '<div class="form-row">' + L.field('Title', '<input type="text" name="title" required value="' + esc(c.title || '') + '" data-title>') + L.field('URL slug' + (isNew ? ' (auto from the title)' : ' (fixed)'), '<input type="text" name="slug" value="' + esc(c.slug || '') + '"' + (isNew ? ' placeholder="auto"' : ' readonly') + '>') + '</div>' +
      L.field('One-line subtitle (under the title on the course page)', '<input type="text" name="subtitle" value="' + esc(c.subtitle || '') + '">') +
      L.field('Summary (two or three sentences, used on cards and in search results)', '<textarea name="summary" style="min-height:80px">' + esc(c.summary || '') + '</textarea>') +
      '<div class="form-row">' + L.field('Area', '<select name="area">' + AREAS.map(function (a) { return '<option' + ((c.area || 'Trademark') === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>') + L.field('Level', '<input type="text" name="level" value="' + esc(c.level || 'Beginner to intermediate') + '">') + '</div>' +
      '<div class="form-row">' + L.field('Price (INR, GST-inclusive)', '<input type="number" name="price_inr" min="1" required value="' + esc(c.price_inr || '') + '">') + L.field('Duration (free text, e.g. 20 hours)', '<input type="text" name="duration" value="' + esc(c.duration || '') + '">') + '</div>' +
      '<div class="form-row">' + L.field('Sessions are called', '<select name="unit"><option value="sessions"' + (c.unit === 'sessions' ? ' selected' : '') + '>sessions</option><option value="modules"' + (c.unit !== 'sessions' ? ' selected' : '') + '>modules</option></select>') + L.field('Note on each (e.g. 2 hours each, recorded)', '<input type="text" name="unit_note" value="' + esc(c.unit_note || '') + '">') + '</div>' +
      L.field('Access line (e.g. Recording access for 2 months from the date of registration)', '<input type="text" name="access" value="' + esc(c.access || 'Recording access for 2 months from the date of registration') + '">') +
      L.field('What you will be able to do (one per line)', '<textarea name="outcomes">' + esc(lines(c.outcomes)) + '</textarea>') +
      L.field('About the course (one paragraph per line)', '<textarea name="about">' + esc(lines(c.about)) + '</textarea>') +
      L.field('What is included (one per line)', '<textarea name="includes" style="min-height:80px">' + esc(lines(c.includes)) + '</textarea>') +
      '<div class="form-row">' + L.field('Take it if (one per line)', '<textarea name="who_for" style="min-height:80px">' + esc(lines(c.who_for)) + '</textarea>') + L.field('Skip it if (one per line)', '<textarea name="not_for" style="min-height:80px">' + esc(lines(c.not_for)) + '</textarea>') + '</div>' +
      L.field('FAQ (one per line as  Question :: Answer)', '<textarea name="faq">' + esc((c.faq || []).map(function (f) { return f.q + ' :: ' + f.a; }).join('\n')) + '</textarea>') +
      L.field('Physical kit (optional): first line the kit name, second line the intro sentence, then one item per line', '<textarea name="kit" style="min-height:80px">' + esc(c.kit ? [c.kit.title, c.kit.intro].concat(c.kit.items || []).join('\n') : '') + '</textarea>') +
      '<div class="form-row">' + L.field('Order on the courses page', '<input type="number" name="sort_order" value="' + esc(c.sort_order || 99) + '">') + '<div></div></div>' +
      '<label class="check"><input type="checkbox" name="published_on_site"' + (c.published_on_site ? ' checked' : '') + '> <strong>Publish on vidiksha.in</strong> (course page, courses list, home page)</label>' +
      '<label class="check"><input type="checkbox" name="enrol_open"' + (c.enrol_open ? ' checked' : '') + '> Enrolment open: the website shows Enrol now and takes payment at the price above</label>' +
      '<p class="fine">Publishing commits the course to the website repository; the site rebuilds in a minute or two. Sessions and their lesson points come from the Sessions tab and are published with the course.</p>',
      function (f) {
        var slug = isNew ? L.slugify(f.slug || f.title) : c.slug;
        if (!slug) throw new Error('Could not make a URL slug from the title.');
        var kitLines = splitLines(f.kit), kit = kitLines.length >= 2 ? { title: kitLines[0], intro: kitLines[1], items: kitLines.slice(2) } : null;
        var row = { slug: slug, title: f.title, subtitle: f.subtitle, summary: f.summary, area: f.area, level: f.level, price_inr: Number(f.price_inr), duration: f.duration, unit: f.unit, unit_note: f.unit_note, access: f.access,
          outcomes: splitLines(f.outcomes), about: splitLines(f.about), includes: splitLines(f.includes), who_for: splitLines(f.who_for), not_for: splitLines(f.not_for),
          faq: splitLines(f.faq).map(function (l) { var p = l.split('::'); return { q: (p[0] || '').trim(), a: (p.slice(1).join('::') || '').trim() }; }).filter(function (x) { return x.q; }),
          kit: kit, sort_order: Number(f.sort_order) || 99, enrol_open: !!f.enrol_open, active: true, updated_at: new Date().toISOString() };
        var wantSite = !!f.published_on_site, wasSite = !!c.published_on_site;
        return sb.from('courses').upsert(row, { onConflict: 'slug' }).then(must).then(function () {
          if (wantSite) return sitePublish('course', slug).then(function (j) { L.toast('Saved and published to vidiksha.in', 'ok'); });
          if (wasSite && !wantSite) return sitePublish('unpublish_course', slug).then(function () { L.toast('Saved and removed from vidiksha.in', 'ok'); });
          L.toast('Saved', 'ok');
        }).then(function () { return L.loadCourses(); }).then(function () { location.hash = '#/course/' + slug; if (location.hash === '#/course/' + slug) route(); });
      });
    var t = $('[data-title]', d), sl = $('[name=slug]', d);
    if (isNew) { t.addEventListener('input', function () { if (!sl.dataset.touched) sl.value = L.slugify(t.value); }); sl.addEventListener('input', function () { sl.dataset.touched = '1'; }); }
  }
  /** Calls the publish-post function for course publishing; surfaces its error message. */
  function sitePublish(type, slug) {
    return sb.auth.getSession().then(function (s) {
      return fetch(L.cfg.functionsUrl + '/publish-post', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.data.session.access_token, apikey: L.cfg.anonKey }, body: JSON.stringify({ type: type, slug: slug }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Publishing failed'); return j; }); });
    });
  }
  function course(slug, q) {
    var tab = q.tab || 'sessions', c = L.cfg.courseRows[slug] || { slug: slug, title: L.courseName(slug) };
    L.render(head('Course', c.title, coursePills(c) + (c.published_on_site ? ' · <a href="' + L.cfg.siteUrl + '/courses/' + esc(slug) + '/" target="_blank" rel="noopener">Public page ↗</a>' : ''), '<button class="btn btn-ghost" id="edit-course">Edit course</button>' + (c.published_on_site ? '<button class="btn" id="republish">Publish changes to vidiksha.in</button>' : '')) +
      '<div class="tabs">' + [['sessions', 'Sessions'], ['materials', 'Materials'], ['assignments', 'Assignments'], ['students', 'Students'], ['batches', 'Batches']].map(function (t) { return '<a href="#/course/' + slug + '?tab=' + t[0] + '" class="' + (tab === t[0] ? 'is-active' : '') + '">' + t[1] + '</a>'; }).join('') + '</div><p class="status" id="course-st"></p><div id="tab">' + L.spinner() + '</div>');
    $('#edit-course').addEventListener('click', function () { courseDialog(c); });
    if ($('#republish')) $('#republish').addEventListener('click', function () {
      var st = $('#course-st'); st.textContent = 'Publishing to vidiksha.in…'; st.className = 'status';
      sitePublish('course', slug).then(function (j) { st.innerHTML = 'Published. <a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.url) + '</a> updates in a minute or two.'; st.className = 'status is-ok'; }, function (e) { st.textContent = L.err(e); st.className = 'status is-error'; });
    });
    ({ sessions: lecturesTab, materials: materialsTab, assignments: assignmentsTab, students: studentsTab, batches: batchesTab })[tab](slug);
  }
  function upload(bucket, path, file, onProgress) {
    return sb.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' }).then(function (r) { if (r.error) throw r.error; return r.data.path; });
  }
  function lectureForm(slug, l) {
    return '<div class="form-row" style="grid-template-columns: 1fr 120px">' + L.field('Session title', '<input type="text" name="title" required value="' + esc(l.title || '') + '">') + L.field('Position', '<input type="number" name="position" min="1" value="' + esc(l.position || 1) + '">') + '</div>' +
      L.field('What this session covers (one point per line; shown to students as the curriculum)', '<textarea name="lessons" placeholder="One lesson per line">' + esc((l.lessons || []).join('\n')) + '</textarea>') +
      L.field('Description (shown under the player)', '<textarea name="description" style="min-height:80px">' + esc(l.description || '') + '</textarea>') +
      L.field('Recording link (YouTube unlisted, Vimeo, Loom, Google Drive), or upload a file below', '<input type="url" name="video_url" value="' + esc(l.video_url || '') + '" placeholder="https://youtu.be/…">') +
      L.field('Upload recording (mp4). Large files take a while; keep this window open.' + (l.video_path ? ' Current file: ' + esc(l.video_path.split('/').pop()) : ''), '<input type="file" name="video_file" accept="video/mp4,video/webm,video/quicktime">') +
      '<div class="form-row">' + L.field('Length (minutes)', '<input type="number" name="duration_min" min="1" value="' + esc(l.duration_min || '') + '">') + L.field('Release recording on (optional)', '<input type="datetime-local" name="release_at" value="' + dtLocal(l.release_at) + '">') + '</div>' +
      '<label class="check"><input type="checkbox" name="published"' + (l.published ? ' checked' : '') + '> Recording released to students (the session itself is always listed in the curriculum)</label>';
  }
  function saveLecture(slug, l, f, form) {
    var lessons = String(f.lessons || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var row = { course_slug: slug, title: f.title, position: Number(f.position) || 1, lessons: lessons, description: f.description, video_url: f.video_url || null, duration_min: Number(f.duration_min) || null, release_at: fromLocal(f.release_at), published: !!f.published, updated_at: new Date().toISOString() };
    var file = form.video_file.files[0];
    var up = file ? upload('lms-videos', slug + '/' + Date.now() + '-' + L.safeName(file.name), file).then(function (p) { row.video_path = p; }) : Promise.resolve();
    return up.then(function () { return (l.id ? sb.from('lectures').update(row).eq('id', l.id) : sb.from('lectures').insert(row)).then(must); });
  }
  function lecturesTab(slug) {
    sb.from('lectures').select('*').eq('course_slug', slug).order('position').then(function (r) {
      var rows = r.data || [];
      $('#tab').innerHTML = '<div class="toolbar"><button class="btn" id="add">Add session</button><span class="muted small">This list is the curriculum students see. Attach a recording and tick "released" when a session is ready to watch. Changes reach vidiksha.in when you press "Publish changes" above.</span></div>' +
        '<ol class="cur-list">' + rows.map(function (l, i) {
          var ready = l.published && (l.video_url || l.video_path) && (!l.release_at || new Date(l.release_at) <= new Date());
          return '<li class="cur-item"><div class="cur-num">' + String(l.position).padStart(2, '0') + '</div><div class="cur-body"><div class="cur-top"><strong>' + esc(l.title) + '</strong> ' +
            (ready ? '<span class="pill ok">released</span>' : l.video_url || l.video_path ? '<span class="pill warn">recording attached, not released</span>' : '<span class="pill">no recording</span>') + (l.release_at && new Date(l.release_at) > new Date() ? ' <span class="pill">releases ' + esc(L.fmtDate(l.release_at)) + '</span>' : '') + (l.duration_min ? ' <span class="muted small">' + esc(L.minutes(l.duration_min)) + '</span>' : '') + '</div>' +
            ((l.lessons || []).length ? '<ul class="cur-lessons">' + l.lessons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<div class="muted small">No lesson points yet. Edit to add what this session covers.</div>') + '</div>' +
            '<div class="cur-actions"><button class="btn btn-ghost btn-sm" data-up="' + l.id + '"' + (i === 0 ? ' disabled' : '') + ' title="Move up">↑</button><button class="btn btn-ghost btn-sm" data-down="' + l.id + '"' + (i === rows.length - 1 ? ' disabled' : '') + ' title="Move down">↓</button><a class="btn btn-ghost btn-sm" href="#/lecture/' + l.id + '">Viewers</a><button class="btn btn-ghost btn-sm" data-edit="' + l.id + '">Edit</button><button class="btn btn-danger btn-sm" data-del="' + l.id + '">Remove</button></div></li>';
        }).join('') + '</ol>' + (rows.length ? '' : L.empty('No sessions yet. Add the first one.'));
      var renumber = function (list) { return Promise.all(list.map(function (l, i) { return l.position === i + 1 ? null : sb.from('lectures').update({ position: i + 1 }).eq('id', l.id); }).filter(Boolean)); };
      var move = function (id, dir) { var i = rows.findIndex(function (x) { return x.id === id; }), j = i + dir; if (j < 0 || j >= rows.length) return; var list = rows.slice(); var t = list[i]; list[i] = list[j]; list[j] = t; renumber(list).then(function () { lecturesTab(slug); }); };
      $('#add').addEventListener('click', function () { dialog('Add session', lectureForm(slug, { position: rows.length + 1 }), function (f, form) { return saveLecture(slug, {}, f, form).then(function () { L.toast('Session added', 'ok'); lecturesTab(slug); }); }); });
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var l = rows.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0]; dialog('Edit session', lectureForm(slug, l), function (f, form) { return saveLecture(slug, l, f, form).then(function () { L.toast('Saved', 'ok'); lecturesTab(slug); }); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this session, its recording link and the progress records of students who watched it')) return; sb.from('lectures').delete().eq('id', b.getAttribute('data-del')).then(function () { var rest = rows.filter(function (x) { return x.id !== b.getAttribute('data-del'); }); return renumber(rest); }).then(function () { lecturesTab(slug); }); }); });
      $$('[data-up]').forEach(function (b) { b.addEventListener('click', function () { move(b.getAttribute('data-up'), -1); }); });
      $$('[data-down]').forEach(function (b) { b.addEventListener('click', function () { move(b.getAttribute('data-down'), 1); }); });
    });
  }
  function lecture(id) {
    L.render(L.spinner());
    Promise.all([sb.from('lectures').select('*').eq('id', id).maybeSingle(), sb.from('lecture_progress').select('*, profiles:user_id(full_name, email)').eq('lecture_id', id).order('updated_at', { ascending: false })]).then(function (r) {
      var l = r[0].data; if (!l) return L.render(L.empty('No such session.'));
      L.render(head('Session ' + l.position + ' · ' + L.courseName(l.course_slug), l.title, '<a href="#/course/' + l.course_slug + '">← Back to course</a>') +
        '<div class="lecture-layout"><div><div class="player" id="player">' + (l.video_url ? '<iframe src="' + esc(L.embedUrl(l.video_url)) + '" allowfullscreen></iframe>' : l.video_path ? L.spinner('Loading file') : L.empty('No video yet')) + '</div><div class="prose" style="margin-top:1rem">' + L.nl2p(l.description) + '</div></div>' +
        '<aside><div class="card"><p class="eyebrow">Viewers</p>' + table([{ label: 'Student', get: function (p) { return p.profiles ? p.profiles.full_name : ''; } }, { label: 'Watched', get: function (p) { return L.minutes(Math.round(p.seconds / 60)) || '0 min'; } }, { label: 'Done', html: function (p) { return p.completed ? '✓' : ''; } }], r[1].data || [], 'Nobody has opened this session yet.') + '</div></aside></div>');
      if (l.video_path) sb.storage.from('lms-videos').createSignedUrl(l.video_path, 3600).then(function (x) { $('#player').innerHTML = x.error ? L.empty(L.err(x.error)) : '<video controls src="' + esc(x.data.signedUrl) + '"></video>'; });
    });
  }
  function materialsTab(slug) {
    Promise.all([sb.from('materials').select('*').eq('course_slug', slug).order('created_at'), sb.from('lectures').select('id, title, position').eq('course_slug', slug).order('position')]).then(function (r) {
      var rows = r[0].data || [], lecs = r[1].data || [];
      var lecName = function (id) { var l = lecs.filter(function (x) { return x.id === id; })[0]; return l ? l.position + '. ' + l.title : 'Whole course'; };
      var lecSelect = function (v) { return '<select name="lecture_id"><option value="">Whole course</option>' + lecs.map(function (l) { return '<option value="' + l.id + '"' + (l.id === v ? ' selected' : '') + '>' + esc(l.position + '. ' + l.title) + '</option>'; }).join('') + '</select>'; };
      $('#tab').innerHTML = '<div class="toolbar"><button class="btn" id="add">Add material</button><span class="muted small">Checklists, sample drafts, slides. Upload a file (PDF, DOCX, up to 100 MB) or paste a link.</span></div>' +
        table([{ label: 'Title', key: 'title', wrap: true }, { label: 'Attached to', get: function (m) { return lecName(m.lecture_id); }, wrap: true }, { label: 'Type', html: function (m) { return m.file_path ? '<span class="pill ok">file</span>' : '<span class="pill">link</span>'; } }, { label: 'Added', get: function (m) { return L.fmtDate(m.created_at); } }, { label: '', html: function (m) { return '<button class="btn btn-ghost btn-sm" data-open="' + m.id + '">Open</button> <button class="btn btn-danger btn-sm" data-del="' + m.id + '">Delete</button>'; } }], rows, 'No materials yet.');
      $('#add').addEventListener('click', function () {
        dialog('Add material', L.field('Title', '<input type="text" name="title" required>') + L.field('Attach to', lecSelect('')) + L.field('File', '<input type="file" name="file">') + L.field('or link', '<input type="url" name="url" placeholder="https://">'), function (f, form) {
          var file = form.file.files[0]; if (!file && !f.url) throw new Error('Choose a file or paste a link.');
          var row = { course_slug: slug, title: f.title, lecture_id: f.lecture_id || null, url: f.url || null };
          var up = file ? upload('lms-materials', slug + '/' + Date.now() + '-' + L.safeName(file.name), file).then(function (p) { row.file_path = p; }) : Promise.resolve();
          return up.then(function () { return sb.from('materials').insert(row).then(must); }).then(function () { L.toast('Added', 'ok'); materialsTab(slug); });
        });
      });
      $$('[data-open]').forEach(function (b) { b.addEventListener('click', function () { var m = rows.filter(function (x) { return x.id === b.getAttribute('data-open'); })[0]; if (m.url) return window.open(m.url, '_blank', 'noopener'); sb.storage.from('lms-materials').createSignedUrl(m.file_path, 600).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); window.open(x.data.signedUrl, '_blank', 'noopener'); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this material')) return; var m = rows.filter(function (x) { return x.id === b.getAttribute('data-del'); })[0]; (m.file_path ? sb.storage.from('lms-materials').remove([m.file_path]) : Promise.resolve()).then(function () { return sb.from('materials').delete().eq('id', m.id); }).then(function () { materialsTab(slug); }); }); });
    });
  }
  function assignmentsTab(slug) {
    Promise.all([sb.from('assignments').select('*, submissions(id, graded_at)').eq('course_slug', slug).order('created_at'), sb.from('lectures').select('id, title, position').eq('course_slug', slug).order('position')]).then(function (r) {
      var rows = r[0].data || [], lecs = r[1].data || [];
      var lecSelect = function (v) { return '<select name="lecture_id"><option value="">Not tied to a session</option>' + lecs.map(function (l) { return '<option value="' + l.id + '"' + (l.id === v ? ' selected' : '') + '>' + esc(l.position + '. ' + l.title) + '</option>'; }).join('') + '</select>'; };
      var form = function (a) { return L.field('Title', '<input type="text" name="title" required value="' + esc(a.title || '') + '">') + L.field('Instructions', '<textarea name="instructions">' + esc(a.instructions || '') + '</textarea>') + '<div class="form-row">' + L.field('After session', lecSelect(a.lecture_id)) + L.field('Due (optional)', '<input type="datetime-local" name="due_at" value="' + dtLocal(a.due_at) + '">') + '</div><label class="check"><input type="checkbox" name="published"' + (a.published ? ' checked' : '') + '> Published</label>'; };
      var save = function (a, f) { var row = { course_slug: slug, title: f.title, instructions: f.instructions, lecture_id: f.lecture_id || null, due_at: fromLocal(f.due_at), published: !!f.published }; return (a.id ? sb.from('assignments').update(row).eq('id', a.id) : sb.from('assignments').insert(row)).then(must).then(function () { L.toast('Saved', 'ok'); assignmentsTab(slug); }); };
      $('#tab').innerHTML = '<div class="toolbar"><button class="btn" id="add">Add assignment</button></div>' +
        table([{ label: 'Title', html: function (a) { return '<a href="#/assignment/' + a.id + '">' + esc(a.title) + '</a>'; }, wrap: true }, { label: 'Due', get: function (a) { return a.due_at ? L.fmtDateTime(a.due_at) : ''; } }, { label: 'Submissions', get: function (a) { return (a.submissions || []).length + ' (' + (a.submissions || []).filter(function (s) { return !s.graded_at; }).length + ' to grade)'; } }, { label: 'Published', html: function (a) { return a.published ? '<span class="pill ok">yes</span>' : '<span class="pill">draft</span>'; } }, { label: '', html: function (a) { return '<button class="btn btn-ghost btn-sm" data-edit="' + a.id + '">Edit</button> <button class="btn btn-danger btn-sm" data-del="' + a.id + '">Delete</button>'; } }], rows, 'No assignments yet.');
      $('#add').addEventListener('click', function () { dialog('Add assignment', form({}), function (f) { return save({}, f); }); });
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var a = rows.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0]; dialog('Edit assignment', form(a), function (f) { return save(a, f); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this assignment and all its submissions')) return; sb.from('assignments').delete().eq('id', b.getAttribute('data-del')).then(function () { assignmentsTab(slug); }); }); });
    });
  }
  function studentsTab(slug) {
    Promise.all([sb.from('course_roster').select('*').eq('course_slug', slug).order('since', { ascending: false }), sb.from('lectures').select('id').eq('course_slug', slug), sb.from('lecture_progress').select('user_id, lecture_id, completed')]).then(function (r) {
      var rows = r[0].data || [], total = (r[1].data || []).length, done = {};
      (r[2].data || []).forEach(function (p) { if (p.completed) done[p.user_id] = (done[p.user_id] || 0) + 1; });
      $('#tab').innerHTML = '<p class="muted small">' + rows.length + ' students with access</p>' + table([{ label: 'Student', html: function (s) { return '<a href="#/student/' + s.user_id + '">' + esc(s.full_name || s.email) + '</a><div class="muted small">' + esc(s.email) + '</div>'; }, wrap: true }, { label: 'Batch', html: function (s) { return s.batch_name ? esc(s.batch_name) : '<span class="pill warn">none</span>'; } }, { label: 'Via', html: function (s) { return '<span class="pill ' + (s.suspended ? 'bad' : 'ok') + '">' + (s.suspended ? 'paused' : s.via) + '</span>'; } }, { label: 'Since', get: function (s) { return L.fmtDate(s.since); } }, { label: 'Until', get: function (s) { return L.until(s.until).replace('until ', '') || 'no end date'; } }, { label: 'Progress', get: function (s) { return total ? (done[s.user_id] || 0) + ' / ' + total : '—'; } }], rows, 'Nobody has this course yet.');
    });
  }
  function batchesTab(slug) {
    Promise.all([sb.from('batches').select('*, batch_members(user_id, added_at)').eq('course_slug', slug).order('starts_on', { ascending: false }), sb.from('course_roster').select('*').eq('course_slug', slug), sb.from('lectures').select('id').eq('course_slug', slug), sb.from('lecture_progress').select('user_id, lecture_id, completed')]).then(function (r) {
      var rows = r[0].data || [], roster = r[1].data || [], total = (r[2].data || []).length, done = {};
      (r[3].data || []).forEach(function (p) { if (p.completed) done[p.user_id] = (done[p.user_id] || 0) + 1; });
      var inBatch = {}; rows.forEach(function (b) { (b.batch_members || []).forEach(function (m) { inBatch[m.user_id] = b.id; }); });
      var unassigned = roster.filter(function (x) { return !inBatch[x.user_id]; });
      var form = function (b) { return L.field('Name', '<input type="text" name="name" required value="' + esc(b.name || '') + '" placeholder="e.g. Batch 2 (January 2027)">') + '<div class="form-row">' + L.field('Batch starts', '<input type="date" name="starts_on" value="' + esc(b.starts_on || '') + '">') + L.field('Batch ends', '<input type="date" name="ends_on" value="' + esc(b.ends_on || '') + '">') + '</div>' + '<div class="form-row">' + L.field('Enrolment opens on', '<input type="date" name="enrol_from" value="' + esc(b.enrol_from || '') + '">') + L.field('Last date to enrol (Enrol now is disabled after this)', '<input type="date" name="enrol_until" value="' + esc(b.enrol_until || '') + '">') + '</div>' + L.field('Notes (shown to the batch in the portal)', '<textarea name="notes">' + esc(b.notes || '') + '</textarea>') + '<label class="check"><input type="checkbox" name="is_open"' + (b.is_open ? ' checked' : '') + '> Open batch: new enrolments and grants join this batch automatically, and the website follows its enrolment dates</label>'; };
      var save = function (b, f) { var row = { course_slug: slug, name: f.name, starts_on: f.starts_on || null, ends_on: f.ends_on || null, enrol_from: f.enrol_from || null, enrol_until: f.enrol_until || null, notes: f.notes }; return (b.id ? sb.from('batches').update(row).eq('id', b.id).select().single() : sb.from('batches').insert(row).select().single()).then(must).then(function (saved) { return f.is_open ? sb.rpc('set_open_batch', { bid: saved.id }).then(must) : null; }).then(function () { batchesTab(slug); }); };
      $('#tab').innerHTML = '<div class="toolbar"><button class="btn" id="add">New batch</button><span class="muted small">Every student is in one batch per course. New enrolments join the open batch; move students between batches with the dropdown next to their name.</span></div>' +
        (unassigned.length ? '<div class="notice" style="border-left-color:var(--warn)"><strong>' + unassigned.length + ' student' + (unassigned.length > 1 ? 's' : '') + ' without a batch.</strong> <button class="btn btn-sm" id="assign-all">Put them in the open batch</button></div>' : '') +
        (rows.length ? rows.map(function (b) {
          var members = (b.batch_members || []).map(function (m) { return Object.assign({ user_id: m.user_id, added_at: m.added_at }, roster.filter(function (x) { return x.user_id === m.user_id; })[0] || {}); });
          var moveSelect = function (uid) { return '<select class="btn-sm" data-move="' + uid + '" style="width:auto;padding:0.3rem 0.5rem;font-size:0.8rem"><option value="">Move to…</option>' + rows.filter(function (o) { return o.id !== b.id; }).map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + '</option>'; }).join('') + '</select>'; };
          return '<div class="card section" style="margin-top:1rem"><div class="section-head"><h2>' + esc(b.name) + ' ' + (b.is_open ? '<span class="pill ok">open for new students</span>' : '<button class="btn btn-ghost btn-sm" data-open="' + b.id + '">Make this the open batch</button>') + '</h2><span class="muted">' + (b.starts_on ? esc(L.fmtDate(b.starts_on)) : '') + (b.ends_on ? ' to ' + esc(L.fmtDate(b.ends_on)) : '') + ' · ' + members.length + ' student' + (members.length === 1 ? '' : 's') + (b.is_open ? ' · enrolment ' + (b.enrol_until ? (new Date(b.enrol_until + 'T23:59:59+05:30') < new Date() ? '<span class="pill bad">closed ' + esc(L.fmtDate(b.enrol_until)) + '</span>' : 'until ' + esc(L.fmtDate(b.enrol_until))) : '<span class="pill warn">no last date set</span>') : '') + '</span></div>' + (b.notes ? '<p class="muted">' + esc(b.notes) + '</p>' : '') +
            (members.length ? table([{ label: 'Student', html: function (m) { return '<a href="#/student/' + m.user_id + '">' + esc(m.full_name || m.email || m.user_id) + '</a><div class="muted small">' + esc(m.email || '') + '</div>'; }, wrap: true }, { label: 'Via', html: function (m) { return m.via ? '<span class="pill ' + (m.suspended ? 'bad' : 'ok') + '">' + (m.suspended ? 'paused' : m.via) + '</span>' : ''; } }, { label: 'Joined batch', get: function (m) { return L.fmtDate(m.added_at); } }, { label: 'Progress', get: function (m) { return total ? (done[m.user_id] || 0) + ' / ' + total : '—'; } }, { label: '', html: function (m) { return moveSelect(m.user_id); } }], members) : L.empty('No students in this batch yet.')) +
            '<div class="inline-form" style="margin-top:0.75rem"><label class="field"><span>Add a student with course access</span><select data-add-select="' + b.id + '"><option value="">Choose</option>' + roster.filter(function (x) { return inBatch[x.user_id] !== b.id; }).map(function (x) { return '<option value="' + x.user_id + '">' + esc((x.full_name || '') + ' <' + x.email + '>') + (inBatch[x.user_id] ? ' (in another batch)' : '') + '</option>'; }).join('') + '</select></label><button class="btn btn-sm" data-add="' + b.id + '">Add</button><button class="btn btn-ghost btn-sm" data-edit="' + b.id + '">Edit batch</button>' + (members.length ? '' : '<button class="btn btn-danger btn-sm" data-del="' + b.id + '">Delete</button>') + '</div></div>';
        }).join('') : L.empty('No batches yet. The first enrolment creates "Batch 1" automatically; or create one now and mark it open.'));
      var assign = function (uid, bid) { return sb.rpc('assign_batch', { uid: uid, slug: slug, bid: bid || null }).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); batchesTab(slug); }); };
      $('#add').addEventListener('click', function () { dialog('New batch', form({ is_open: !rows.some(function (b) { return b.is_open; }) }), function (f) { return save({}, f); }); });
      if ($('#assign-all')) $('#assign-all').addEventListener('click', function () { Promise.all(unassigned.map(function (u) { return sb.rpc('assign_batch', { uid: u.user_id, slug: slug, bid: null }); })).then(function () { batchesTab(slug); }); });
      $$('[data-open]').forEach(function (b) { b.addEventListener('click', function () { sb.rpc('set_open_batch', { bid: b.getAttribute('data-open') }).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); batchesTab(slug); }); }); });
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var x = rows.filter(function (y) { return y.id === b.getAttribute('data-edit'); })[0]; dialog('Edit batch', form(x), function (f) { return save(x, f); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this empty batch')) return; sb.from('batches').delete().eq('id', b.getAttribute('data-del')).then(function () { batchesTab(slug); }); }); });
      $$('[data-add]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-add'), uid = $('[data-add-select="' + id + '"]').value; if (uid) assign(uid, id); }); });
      $$('[data-move]').forEach(function (sel) { sel.addEventListener('change', function () { if (sel.value) assign(sel.getAttribute('data-move'), sel.value); }); });
    });
  }

  /* ------------------------------------------------------------ grading */
  function grading() {
    L.render(head('Grading', 'Submissions', 'Newest first. Open one to read it and record a grade and feedback.') + '<div class="toolbar"><select id="f"><option value="pending">Awaiting grading</option><option value="all">All</option></select></div><div id="tbl">' + L.spinner() + '</div>');
    function draw() {
      var q = sb.from('submissions').select('*, assignments(title, course_slug), profiles:user_id(full_name, email)').order('submitted_at', { ascending: false }).limit(200);
      if ($('#f').value === 'pending') q = q.is('graded_at', null);
      q.then(function (r) { $('#tbl').innerHTML = table([{ label: 'Submitted', get: function (s) { return L.fmtDateTime(s.submitted_at); } }, { label: 'Student', html: function (s) { return '<a href="#/student/' + s.user_id + '">' + esc(s.profiles ? s.profiles.full_name : '') + '</a>'; } }, { label: 'Course', get: function (s) { return s.assignments ? L.courseName(s.assignments.course_slug) : ''; } }, { label: 'Assignment', html: function (s) { return '<a href="#/assignment/' + s.assignment_id + '?s=' + s.id + '">' + esc(s.assignments ? s.assignments.title : '') + '</a>'; }, wrap: true }, { label: 'Grade', html: function (s) { return s.graded_at ? '<span class="pill ok">' + esc(s.grade || 'graded') + '</span>' : '<span class="pill warn">pending</span>'; } }], r.data || [], 'Nothing to grade.'); });
    }
    $('#f').addEventListener('change', draw); draw();
  }
  function assignment(id, q) {
    L.render(L.spinner());
    Promise.all([sb.from('assignments').select('*').eq('id', id).maybeSingle(), sb.from('submissions').select('*, profiles:user_id(full_name, email)').eq('assignment_id', id).order('submitted_at', { ascending: false })]).then(function (r) {
      var a = r[0].data; if (!a) return L.render(L.empty('No such assignment.'));
      var subs = r[1].data || [];
      L.render(head(L.courseName(a.course_slug) + ' · Assignment', a.title, '<a href="#/course/' + a.course_slug + '?tab=assignments">← Course assignments</a> · ' + (a.due_at ? 'Due ' + esc(L.fmtDateTime(a.due_at)) : 'No deadline') + ' · ' + (a.published ? 'published' : 'draft')) +
        '<div class="lecture-layout"><div><div class="prose card">' + (L.nl2p(a.instructions) || '<p class="muted">No instructions.</p>') + '</div>' +
        '<div class="section"><div class="section-head"><h2>Submissions (' + subs.length + ')</h2></div><div id="subs">' + (subs.length ? subs.map(function (s) {
          return '<div class="card" style="margin-bottom:1rem" id="s-' + s.id + '"><div class="section-head" style="border:0;padding:0;margin-bottom:0.5rem"><h3><a href="#/student/' + s.user_id + '">' + esc(s.profiles ? s.profiles.full_name : '') + '</a></h3><span class="muted small">' + esc(L.fmtDateTime(s.submitted_at)) + (s.graded_at ? ' · graded ' + esc(L.fmtDate(s.graded_at)) : '') + '</span></div>' +
            '<div class="prose small">' + (L.nl2p(s.body) || '<p class="muted">No text.</p>') + '</div>' + (s.file_path ? '<button class="btn btn-ghost btn-sm" data-file="' + esc(s.file_path) + '">Open attached file</button>' : '') +
            '<form class="form" data-grade="' + s.id + '" style="margin-top:1rem"><div class="form-row">' + L.field('Grade (free text: Pass, Distinction, 8/10…)', '<input type="text" name="grade" value="' + esc(s.grade || '') + '">') + '</div>' + L.field('Feedback to the student', '<textarea name="feedback">' + esc(s.feedback || '') + '</textarea>') + '<div class="actions"><button class="btn btn-sm" type="submit">' + (s.graded_at ? 'Update grade' : 'Save grade') + '</button>' + (s.graded_at ? '<button class="btn btn-ghost btn-sm" type="button" data-ungrade="' + s.id + '">Reopen for revision</button>' : '') + '</div><p class="status"></p></form></div>';
        }).join('') : L.empty('No submissions yet.')) + '</div></div><aside></aside></div>');
      $$('[data-file]').forEach(function (b) { b.addEventListener('click', function () { sb.storage.from('lms-submissions').createSignedUrl(b.getAttribute('data-file'), 600).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); window.open(x.data.signedUrl, '_blank', 'noopener'); }); }); });
      $$('[data-grade]').forEach(function (form) { form.addEventListener('submit', function (e) { e.preventDefault(); var f = L.formData(form), st = $('.status', form); st.textContent = 'Saving…'; sb.from('submissions').update({ grade: f.grade || null, feedback: f.feedback || null, graded_at: new Date().toISOString(), graded_by: session.user.id }).eq('id', form.getAttribute('data-grade')).then(function (x) { if (x.error) { st.textContent = L.err(x.error); st.className = 'status is-error'; return; } L.toast('Grade saved', 'ok'); assignment(id, q); }); }); });
      $$('[data-ungrade]').forEach(function (b) { b.addEventListener('click', function () { sb.from('submissions').update({ graded_at: null, graded_by: null }).eq('id', b.getAttribute('data-ungrade')).then(function () { assignment(id, q); }); }); });
      if (q.s && $('#s-' + q.s)) $('#s-' + q.s).scrollIntoView();
    });
  }

  /* ------------------------------------------------------------ announcements & messages */
  function notices() {
    L.render(head('Announcements', 'Announcements', 'Shown in every student’s portal, to the students of one course, or to one batch.', '<button class="btn" id="add">New announcement</button>') + '<div id="list">' + L.spinner() + '</div>');
    var batches = [];
    var audienceLabel = function (a) { if (a === 'all') return 'everyone'; if (a.indexOf('batch:') === 0) { var b = batches.filter(function (x) { return x.id === a.slice(6); })[0]; return b ? L.courseName(b.course_slug) + ' · ' + b.name : 'a batch'; } return L.courseName(a); };
    var audienceSelect = function (v) { return '<select name="audience"><option value="all"' + (v === 'all' ? ' selected' : '') + '>Everyone</option>' + Object.keys(COURSES).map(function (s) { return '<option value="' + s + '"' + (s === v ? ' selected' : '') + '>All students of ' + esc(COURSES[s]) + '</option>' + batches.filter(function (b) { return b.course_slug === s; }).map(function (b) { return '<option value="batch:' + b.id + '"' + ('batch:' + b.id === v ? ' selected' : '') + '>&nbsp;&nbsp;&nbsp;' + esc(COURSES[s]) + ' · ' + esc(b.name) + '</option>'; }).join(''); }).join('') + '</select>'; };
    var form = function (n) { return L.field('Title', '<input type="text" name="title" required value="' + esc(n.title || '') + '">') + L.field('Text', '<textarea name="body">' + esc(n.body || '') + '</textarea>') + L.field('Audience', audienceSelect(n.audience || 'all')) + '<label class="check"><input type="checkbox" name="pinned"' + (n.pinned ? ' checked' : '') + '> Pin to the top</label>'; };
    var save = function (n, f) { var row = { title: f.title, body: f.body, audience: f.audience, pinned: !!f.pinned, created_by: session.user.id }; return (n.id ? sb.from('announcements').update(row).eq('id', n.id) : sb.from('announcements').insert(row)).then(must).then(function () { L.toast('Saved', 'ok'); notices(); }); };
    Promise.all([sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }), sb.from('batches').select('id, course_slug, name').order('starts_on', { ascending: false })]).then(function (r) {
      var rows = r[0].data || []; batches = r[1].data || [];
      $('#list').innerHTML = rows.length ? rows.map(function (n) { return '<div class="notice ' + (n.pinned ? 'is-pinned' : '') + '"><div class="meta">' + esc(L.fmtDateTime(n.created_at)) + ' · ' + esc(audienceLabel(n.audience)) + (n.pinned ? ' · pinned' : '') + '</div><strong>' + esc(n.title) + '</strong><div class="prose small" style="margin-top:0.35rem">' + L.nl2p(n.body) + '</div><div class="actions" style="margin-top:0.5rem"><button class="btn btn-ghost btn-sm" data-edit="' + n.id + '">Edit</button><button class="btn btn-danger btn-sm" data-del="' + n.id + '">Delete</button></div></div>'; }).join('') : L.empty('No announcements yet.');
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var n = rows.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0]; dialog('Edit announcement', form(n), function (f) { return save(n, f); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this announcement')) return; sb.from('announcements').delete().eq('id', b.getAttribute('data-del')).then(function () { notices(); }); }); });
    });
    $('#add').addEventListener('click', function () { dialog('New announcement', form({}), function (f) { return save({}, f); }); });
  }
  function messages() {
    L.render(head('Messages', 'Messages', 'One thread per student. Replies from students arrive here too.', '<button class="btn" id="new">New message</button>') + '<div id="list">' + L.spinner() + '</div>');
    sb.from('messages').select('*, profiles:user_id(full_name, email)').order('created_at', { ascending: false }).limit(300).then(function (r) {
      var threads = {}, order = [];
      (r.data || []).forEach(function (m) { if (!threads[m.user_id]) { threads[m.user_id] = { user: m.profiles || {}, last: m, unreadFromStudent: 0, n: 0 }; order.push(m.user_id); } threads[m.user_id].n++; if (!m.from_staff && !m.read_at) threads[m.user_id].unreadFromStudent++; });
      $('#list').innerHTML = table([{ label: 'Student', html: function (id) { var t = threads[id]; return '<a href="#/student/' + id + '">' + esc(t.user.full_name || t.user.email || id) + '</a>'; } }, { label: 'Last message', get: function (id) { return threads[id].last.body.slice(0, 120); }, wrap: true }, { label: 'From', get: function (id) { return threads[id].last.from_staff ? 'team' : 'student'; } }, { label: 'When', get: function (id) { return L.fmtDateTime(threads[id].last.created_at); } }, { label: 'Messages', get: function (id) { return threads[id].n; } }, { label: '', html: function (id) { return threads[id].unreadFromStudent ? '<span class="pill warn">' + threads[id].unreadFromStudent + ' new from student</span>' : ''; } }], order, 'No messages yet. Open a member and send one.');
    });
    $('#new').addEventListener('click', function () {
      sb.from('profiles').select('id, full_name, email').order('full_name').then(function (r) {
        dialog('New message', L.field('To', '<select name="user_id" required>' + (r.data || []).map(function (p) { return '<option value="' + p.id + '">' + esc((p.full_name || '') + ' <' + p.email + '>') + '</option>'; }).join('') + '</select>') + L.field('Message', '<textarea name="body" required></textarea>'), function (f) {
          return sb.from('messages').insert({ user_id: f.user_id, from_staff: true, sender_id: session.user.id, body: f.body }).then(must).then(function () { L.toast('Sent', 'ok'); messages(); });
        });
      });
    });
  }

  /* ------------------------------------------------------------ blog */
  function blogApi(body) {
    return sb.auth.getSession().then(function (s) {
      return fetch(L.cfg.functionsUrl + '/publish-post', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.data.session.access_token, apikey: L.cfg.anonKey }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Failed'); return j; }); });
    });
  }
  function blog(p, q) {
    L.render(head('Blog posts', 'Blog posts', 'Every post on vidiksha.in. Edit, hide or delete from the table; write a new one below. Changes reach the site in a minute or two.', '<button class="btn" id="new">New post</button>') +
      '<p class="status" id="list-st"></p><div id="list">' + L.spinner('Loading posts from the website repository') + '</div>' +
      '<div class="section"><div class="section-head"><h2 id="ed-title">New post</h2><span class="muted small">Markdown: ## for headings, blank lines between paragraphs, **bold**, lists with -.</span></div>' +
      '<form class="form card" id="blog-form">' +
      '<div class="form-row">' + L.field('Title', '<input type="text" name="title" required>') + L.field('URL slug (auto from the title)', '<input type="text" name="slug" placeholder="auto">') + '</div>' +
      L.field('Description (one or two sentences, shown on cards and in search results)', '<input type="text" name="description" required maxlength="200">') +
      '<div class="form-row">' + L.field('Category', '<select name="category"><option>Trademark</option><option>Patent</option><option>Copyright</option><option>Design</option><option>Licensing</option></select>') + L.field('Related course', courseSelect('course', Object.keys(COURSES)[0])) + '</div>' +
      '<div class="form-row">' + L.field('Date', '<input type="date" name="date" value="' + new Date().toISOString().slice(0, 10) + '">') + '<label class="check" style="align-self:end;padding-bottom:0.6rem"><input type="checkbox" name="hidden"> Hidden (saved in the repository but not shown on the site)</label></div>' +
      L.field('Body (Markdown)', '<textarea name="body" class="tall" required placeholder="## The problem&#10;&#10;Most juniors…"></textarea>') +
      '<input type="hidden" name="mode" value="create">' +
      '<div class="actions"><button class="btn" type="submit" id="save">Publish to vidiksha.in</button><button class="btn btn-ghost" type="button" id="cancel" hidden>Cancel editing</button></div><p class="status" id="st"></p></form></div>');
    var form = $('#blog-form'), posts = [];
    function resetForm() { form.reset(); form.mode.value = 'create'; form.slug.readOnly = false; delete form.slug.dataset.touched; $('#ed-title').textContent = 'New post'; $('#save').textContent = 'Publish to vidiksha.in'; $('#cancel').hidden = true; $('#st').textContent = ''; }
    function load() {
      blogApi({ type: 'list_posts' }).then(function (j) {
        posts = j.posts || [];
        $('#list').innerHTML = table([
          { label: 'Date', nowrap: true, get: function (x) { return L.fmtDate(x.date); } },
          { label: 'Title', html: function (x) { return '<a href="' + L.cfg.siteUrl + '/blog/' + esc(x.slug) + '/" target="_blank" rel="noopener"><strong>' + esc(x.title) + '</strong></a><span class="sub">' + esc(x.description) + '</span>'; } },
          { label: 'Category', nowrap: true, key: 'category' },
          { label: 'Course', get: function (x) { return x.course ? L.courseName(x.course) : ''; } },
          { label: 'Website', html: function (x) { return x.hidden ? '<span class="pill">hidden</span>' : '<span class="pill ok">shown</span>'; } },
          { label: '', nowrap: true, html: function (x) { return '<button class="btn btn-ghost btn-sm" data-edit="' + esc(x.slug) + '">Edit</button> ' + (x.hidden ? '<button class="btn btn-sm" data-show="' + esc(x.slug) + '">Show</button>' : '<button class="btn btn-ghost btn-sm" data-hide="' + esc(x.slug) + '">Hide</button>') + ' <button class="btn btn-danger btn-sm" data-del="' + esc(x.slug) + '">Delete</button>'; } }
        ], posts, 'No posts in the repository yet.');
        var st = $('#list-st');
        var act = function (body, label) { st.textContent = label + '…'; st.className = 'status'; return blogApi(body).then(function () { st.textContent = ''; load(); }, function (e) { st.textContent = L.err(e); st.className = 'status is-error'; }); };
        $$('[data-hide]').forEach(function (b) { b.addEventListener('click', function () { act({ type: 'set_post_hidden', slug: b.getAttribute('data-hide'), hidden: true }, 'Hiding'); }); });
        $$('[data-show]').forEach(function (b) { b.addEventListener('click', function () { act({ type: 'set_post_hidden', slug: b.getAttribute('data-show'), hidden: false }, 'Showing'); }); });
        $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this post from the website and the repository')) return; act({ type: 'delete_post', slug: b.getAttribute('data-del') }, 'Deleting'); }); });
        $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () {
          st.textContent = 'Loading the post…'; st.className = 'status';
          blogApi({ type: 'get_post', slug: b.getAttribute('data-edit') }).then(function (x) {
            st.textContent = '';
            form.title.value = x.title; form.slug.value = x.slug; form.slug.readOnly = true; form.slug.dataset.touched = '1'; form.description.value = x.description; form.category.value = x.category || 'Trademark';
            if (x.course) form.course.value = x.course; form.date.value = x.date; form.hidden.checked = !!x.hidden; form.body.value = x.body; form.mode.value = 'update';
            $('#ed-title').textContent = 'Editing: ' + x.title; $('#save').textContent = 'Save changes'; $('#cancel').hidden = false;
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, function (e) { st.textContent = L.err(e); st.className = 'status is-error'; });
        }); });
      }, function (e) { $('#list').innerHTML = L.empty(L.err(e).indexOf('not configured') >= 0 ? 'Blog management needs the GitHub token (see README).' : L.err(e)); });
    }
    load();
    $('#new').addEventListener('click', function () { resetForm(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); form.title.focus(); });
    $('#cancel').addEventListener('click', resetForm);
    form.title.addEventListener('input', function () { if (!form.slug.dataset.touched) form.slug.value = L.slugify(form.title.value); });
    form.slug.addEventListener('input', function () { form.slug.dataset.touched = '1'; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var f = L.formData(form), st = $('#st'); st.textContent = f.mode === 'update' ? 'Saving…' : 'Publishing…'; st.className = 'status';
      f.slug = L.slugify(f.slug || f.title);
      blogApi(f).then(function (j) { st.innerHTML = (f.mode === 'update' ? 'Saved. ' : 'Published. ') + (f.hidden ? 'The post is hidden from the site.' : 'Live at <a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.url) + '</a> in a minute or two.'); st.className = 'status is-ok'; var keep = st.innerHTML; resetForm(); st.innerHTML = keep; st.className = 'status is-ok'; load(); }, function (err) { st.textContent = L.err(err); st.className = 'status is-error'; });
    });
  }

  /* ------------------------------------------------------------ team */
  function team() {
    if (me.role !== 'admin') return L.render(L.empty('Only admins manage the team.'));
    L.render(head('Team', 'Team access', 'Staff see everything in this panel; admins can also add and remove staff. The person needs a VIDIKSHA account first (any sign-up on the site).') +
      '<form class="inline-form card" id="add-form"><label class="field"><span>Email of an existing account</span><input type="email" name="email" required></label><label class="field" style="flex:0 0 140px"><span>Role</span><select name="role"><option value="staff">Staff</option><option value="admin">Admin</option></select></label><button class="btn" type="submit">Add</button><p class="status" id="st" style="flex-basis:100%"></p></form><div id="list" class="section">' + L.spinner() + '</div>');
    function draw() { sb.from('staff').select('*, profiles:user_id(full_name, email)').order('added_at').then(function (r) { $('#list').innerHTML = table([{ label: 'Name', get: function (s) { return s.profiles ? s.profiles.full_name : s.full_name; } }, { label: 'Email', get: function (s) { return s.profiles ? s.profiles.email : ''; } }, { label: 'Role', key: 'role' }, { label: 'Since', get: function (s) { return L.fmtDate(s.added_at); } }, { label: '', html: function (s) { return s.user_id === session.user.id ? '<span class="muted small">you</span>' : '<button class="btn btn-danger btn-sm" data-del="' + s.user_id + '">Remove</button>'; } }], r.data || []); $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this team member’s access')) return; sb.from('staff').delete().eq('user_id', b.getAttribute('data-del')).then(draw); }); }); }); }
    draw();
    $('#add-form').addEventListener('submit', function (e) { e.preventDefault(); var f = L.formData(e.target), st = $('#st'); sb.rpc('add_staff_by_email', { addr: f.email, new_role: f.role }).then(function (r) { st.textContent = r.error ? L.err(r.error) : r.data; st.className = 'status ' + (r.error ? 'is-error' : 'is-ok'); draw(); }); });
  }

  /* ------------------------------------------------------------ routing */
  var routes = L.router({
    '': overview, 'students': students, 'student/:id': function (p) { student(p.id); }, 'enrolments': enrolments, 'invoices': invoices, 'training': training, 'training/:slug': function (p) { trainingSession(p.slug); }, 'feedbacks': feedbacks,
    'courses': courses, 'course/:slug': function (p, q) { course(p.slug, q); }, 'lecture/:id': function (p) { lecture(p.id); },
    'grading': grading, 'assignment/:id': function (p, q) { assignment(p.id, q); }, 'notices': notices, 'messages': messages, 'blog': blog, 'team': team
  }, function () { L.render(L.empty('Page not found.')); });
  function route() {
    if (!session) return loginScreen();
    if (!me) return noAccess();
    if (!$('#main')) shell();
    drawNav();
    var r = routes.parse(); r.handler(r.params, r.query);
  }
  function boot() {
    if (!session) return route();
    app.innerHTML = '<div class="auth">' + L.spinner('Checking access') + '</div>';
    sb.from('staff').select('*').eq('user_id', session.user.id).maybeSingle().then(function (r) {
      me = r.data || null;
      if (me && !me.full_name) { me.full_name = session.user.user_metadata && session.user.user_metadata.full_name; }
      if (me) sb.from('activity_log').insert({ user_id: session.user.id, event: 'control_login' }).then(function () {});
      (me ? L.loadCourses() : Promise.resolve()).then(route, route);
    });
  }
  window.addEventListener('hashchange', route);
  sb.auth.onAuthStateChange(function (event, s) {
    var had = !!session; session = s;
    if (event === 'SIGNED_OUT') { me = null; location.hash = '#/'; return route(); }
    if ((event === 'SIGNED_IN' && !had) || event === 'INITIAL_SESSION') return boot();
  });
})();
