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
      '<div class="auth-foot">Staff accounts are ordinary VIDIKSHA accounts that an admin has added to the team. Forgot the password? Reset it from the <a href="' + L.cfg.portalUrl + '/#/forgot">learning portal</a>.</div>');
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
  var NAV = [['', 'Overview'], ['students', 'Students'], ['enrolments', 'Enrolments'], ['training', 'Training sessions'], ['courses', 'Course content'], ['grading', 'Grading'], ['notices', 'Announcements'], ['messages', 'Messages'], ['blog', 'Blog posts'], ['team', 'Team']];
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
    return '<div class="table-wrap"><table><thead><tr>' + cols.map(function (c) { return '<th class="' + (c.wrap ? 'wrap' : '') + '">' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td class="' + (c.wrap ? 'wrap' : '') + '">' + (c.html ? c.html(r) : esc(c.get ? c.get(r) : r[c.key])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
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
    L.render(head('Students', 'Members', 'Everyone with a VIDIKSHA account: buyers, training registrants and research members.', '<button class="btn btn-ghost" id="csv">Export CSV</button>') +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search name, email, organisation" value="' + esc(q.q || '') + '"><select id="filter"><option value="">All members</option><option value="paid">Paid a course</option><option value="training">Registered for training</option><option value="research">Used research</option></select></div><div id="tbl">' + L.spinner() + '</div>');
    var rows = [];
    function draw() {
      var s = $('#q').value.trim().toLowerCase(), f = $('#filter').value;
      var list = rows.filter(function (r) { return (!s || [r.full_name, r.email, r.organisation, r.profession].join(' ').toLowerCase().indexOf(s) >= 0) && (!f || (f === 'paid' && r.paid_courses > 0) || (f === 'training' && r.registrations > 0) || (f === 'research' && r.research_logins > 0)); });
      $('#tbl').innerHTML = '<p class="muted small">' + list.length + ' of ' + rows.length + '</p>' + table([
        { label: 'Name', html: function (r) { return '<a href="#/student/' + r.id + '">' + esc(r.full_name || '(no name)') + '</a>'; } }, { label: 'Email', key: 'email' }, { label: 'WhatsApp', key: 'whatsapp' }, { label: 'Profession', key: 'profession' }, { label: 'Organisation', key: 'organisation' },
        { label: 'Courses', key: 'paid_courses' }, { label: 'Sessions', key: 'registrations' }, { label: 'Research logins', key: 'research_logins' }, { label: 'Joined', get: function (r) { return L.fmtDate(r.created_at); } }, { label: 'Last seen', get: function (r) { return L.fmtDate(r.last_portal_login || r.last_login_at); } }
      ], list, 'No members match.');
    }
    sb.from('student_overview').select('*').order('created_at', { ascending: false }).then(function (r) { rows = r.data || []; draw(); });
    $('#q').addEventListener('input', draw); $('#filter').addEventListener('change', draw);
    $('#csv').addEventListener('click', function () { L.download('vidiksha-members.csv', L.csv(rows, [{ label: 'Name', key: 'full_name' }, { label: 'Email', key: 'email' }, { label: 'WhatsApp', key: 'whatsapp' }, { label: 'Profession', key: 'profession' }, { label: 'Organisation', key: 'organisation' }, { label: 'Qualification', key: 'qualification' }, { label: 'Paid courses', key: 'paid_courses' }, { label: 'Training registrations', key: 'registrations' }, { label: 'Research logins', key: 'research_logins' }, { label: 'Joined', key: 'created_at' }])); });
  }
  function student(id) {
    L.render(L.spinner());
    Promise.all([
      sb.from('profiles').select('*').eq('id', id).maybeSingle(),
      Promise.resolve({ data: null }), // enrolments are loaded below once the email is known
      sb.from('course_grants').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      sb.from('training_registrations').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      sb.from('lecture_progress').select('*, lectures(title, course_slug)').eq('user_id', id).order('updated_at', { ascending: false }),
      sb.from('submissions').select('*, assignments(title, course_slug)').eq('user_id', id).order('submitted_at', { ascending: false }),
      sb.from('messages').select('*').eq('user_id', id).order('created_at'),
      sb.from('activity_log').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
      sb.from('staff').select('*').eq('user_id', id).maybeSingle()
    ]).then(function (r) {
      var p = r[0].data; if (!p) return L.render(L.empty('No such member.'));
      sb.from('course_enrolments').select('*').or('user_id.eq.' + id + ',email.ilike.' + p.email.replace(/[,()]/g, '')).order('created_at', { ascending: false }).then(function (er) {
        var enr = er.data || [], grants = r[2].data || [], regs = r[3].data || [], prog = r[4].data || [], subs = r[5].data || [], msgs = r[6].data || [], acts = r[7].data || [];
        L.render(head('Member', p.full_name || p.email, esc(p.email) + (p.whatsapp ? ' · ' + esc(p.whatsapp) : '') + (p.profession ? ' · ' + esc(p.profession) : '') + (p.organisation ? ' · ' + esc(p.organisation) : '') + (r[8].data ? ' · <span class="pill ok">team: ' + esc(r[8].data.role) + '</span>' : ''),
          '<button class="btn btn-ghost" id="edit">Edit details</button><button class="btn" id="grant">Grant course access</button>') +
          '<div class="grid grid-2" style="align-items:start"><div>' +
          '<div class="section-head"><h2>Course access</h2></div>' + table([{ label: 'Course', get: function (e) { return e.course_title || L.courseName(e.course_slug); } }, { label: 'Via', html: function (e) { return e.kind === 'grant' ? '<span class="pill">grant</span>' : pillStatus(e.status); } }, { label: 'From', get: function (e) { return L.fmtDate(e.paid_at || e.created_at); } }, { label: 'Until', get: function (e) { return e.kind === 'grant' ? (e.expires_at ? L.fmtDate(e.expires_at) : 'no end date') : (e.paid_at ? L.fmtDate(new Date(new Date(e.paid_at).getTime() + 61 * 864e5)) : ''); } }, { label: 'Invoice', key: 'invoice_no' }, { label: '', html: function (e) { return e.kind === 'grant' ? '<button class="btn btn-ghost btn-sm" data-del-grant="' + e.id + '">Remove</button>' : ''; } }],
            enr.map(function (e) { e.kind = 'enrolment'; return e; }).concat(grants.map(function (g) { g.kind = 'grant'; return g; })), 'No courses.') +
          '<div class="section"><div class="section-head"><h2>Training sessions</h2></div>' + table([{ label: 'Session', key: 'session_title', wrap: true }, { label: 'Date', get: function (x) { return L.fmtDate(x.session_date); } }, { label: 'Registered', get: function (x) { return L.fmtDate(x.created_at); } }], regs, 'No registrations.') + '</div>' +
          '<div class="section"><div class="section-head"><h2>Progress</h2></div>' + table([{ label: 'Session', get: function (x) { return x.lectures ? x.lectures.title : ''; }, wrap: true }, { label: 'Course', get: function (x) { return x.lectures ? L.courseName(x.lectures.course_slug) : ''; } }, { label: 'Watched', get: function (x) { return L.minutes(Math.round(x.seconds / 60)) || '0 min'; } }, { label: 'Done', html: function (x) { return x.completed ? '<span class="pill ok">yes</span>' : ''; } }, { label: 'Last', get: function (x) { return L.fmtDate(x.updated_at); } }], prog, 'No sessions watched yet.') + '</div>' +
          '<div class="section"><div class="section-head"><h2>Submissions</h2></div>' + table([{ label: 'Assignment', html: function (s) { return '<a href="#/assignment/' + s.assignment_id + '">' + esc(s.assignments ? s.assignments.title : '') + '</a>'; }, wrap: true }, { label: 'Submitted', get: function (s) { return L.fmtDate(s.submitted_at); } }, { label: 'Grade', get: function (s) { return s.graded_at ? (s.grade || 'graded') : 'pending'; } }], subs, 'No submissions.') + '</div>' +
          '</div><div>' +
          '<div class="section-head"><h2>Messages</h2></div><div id="msgs">' + (msgs.length ? msgs.map(function (m) { return '<div class="msg ' + (m.from_staff ? 'is-mine' : '') + '"><div class="prose">' + L.nl2p(m.body) + '</div><div class="meta">' + (m.from_staff ? 'Team' : esc(p.full_name || 'Student')) + ' · ' + esc(L.fmtDateTime(m.created_at)) + (m.from_staff ? (m.read_at ? ' · read' : ' · unread') : '') + '</div></div>'; }).join('') : L.empty('No messages yet.')) + '</div>' +
          '<form class="form" id="msg-form" style="margin-top:1rem"><label class="field"><span>Send a message</span><textarea name="body" required placeholder="It appears in their portal under Messages"></textarea></label><div><button class="btn" type="submit">Send</button></div><p class="status" id="msg-st"></p></form>' +
          '<div class="section"><div class="section-head"><h2>Activity</h2></div>' + table([{ label: 'When', get: function (a) { return L.fmtDateTime(a.created_at); } }, { label: 'Event', key: 'event' }, { label: 'Detail', get: function (a) { return a.meta ? Object.keys(a.meta).filter(function (k) { return k !== 'ua'; }).map(function (k) { return k + ': ' + a.meta[k]; }).join(', ') : ''; }, wrap: true }], acts, 'No activity recorded.') + '</div>' +
          '</div></div>');
        $('#msg-form').addEventListener('submit', function (e) {
          e.preventDefault(); var st = $('#msg-st'); st.textContent = 'Sending…';
          sb.from('messages').insert({ user_id: id, from_staff: true, sender_id: session.user.id, body: e.target.body.value.trim() }).then(function (x) { if (x.error) { st.textContent = L.err(x.error); st.className = 'status is-error'; return; } L.toast('Sent', 'ok'); student(id); });
        });
        $('#grant').addEventListener('click', function () {
          dialog('Grant course access', L.field('Course', courseSelect('course_slug')) + L.field('Access until (leave empty for no end date)', '<input type="date" name="expires">') + L.field('Note (why)', '<input type="text" name="note" placeholder="e.g. complimentary, batch 2 scholarship">'), function (f) {
            return sb.from('course_grants').insert({ user_id: id, course_slug: f.course_slug, expires_at: f.expires ? new Date(f.expires + 'T23:59:59').toISOString() : null, note: f.note, granted_by: session.user.id }).then(must).then(function () { L.toast('Access granted', 'ok'); student(id); });
          });
        });
        $('#edit').addEventListener('click', function () {
          dialog('Edit member', '<div class="form-row">' + L.field('Full name', '<input type="text" name="full_name" value="' + esc(p.full_name || '') + '">') + L.field('WhatsApp', '<input type="text" name="whatsapp" value="' + esc(p.whatsapp || '') + '">') + '</div><div class="form-row">' + L.field('Profession', '<input type="text" name="profession" value="' + esc(p.profession || '') + '">') + L.field('Organisation', '<input type="text" name="organisation" value="' + esc(p.organisation || '') + '">') + '</div>' + L.field('Qualification', '<input type="text" name="qualification" value="' + esc(p.qualification || '') + '">'), function (f) {
            return sb.from('profiles').update(f).eq('id', id).then(must).then(function () { L.toast('Saved', 'ok'); student(id); });
          });
        });
        $$('[data-del-grant]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this access grant')) return; sb.from('course_grants').delete().eq('id', b.getAttribute('data-del-grant')).then(function () { student(id); }); }); });
      });
    });
  }

  /* ------------------------------------------------------------ enrolments & training */
  function enrolments() {
    L.render(head('Enrolments', 'Course enrolments', 'Every purchase attempt. Paid rows also appear in the Google Sheet.', '<button class="btn btn-ghost" id="csv">Export CSV</button>') +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search"><select id="filter"><option value="">All</option><option value="paid">Paid</option><option value="created">Started, not paid</option><option value="failed">Failed</option></select><select id="course"><option value="">All courses</option>' + Object.keys(COURSES).map(function (s) { return '<option value="' + s + '">' + esc(COURSES[s]) + '</option>'; }).join('') + '</select></div><div id="tbl">' + L.spinner() + '</div>');
    var rows = [];
    function draw() {
      var s = $('#q').value.toLowerCase(), f = $('#filter').value, c = $('#course').value;
      var list = rows.filter(function (r) { return (!s || [r.full_name, r.email, r.whatsapp, r.invoice_no, r.razorpay_payment_id].join(' ').toLowerCase().indexOf(s) >= 0) && (!f || r.status === f) && (!c || r.course_slug === c); });
      $('#tbl').innerHTML = '<p class="muted small">' + list.length + ' rows · ' + L.fmtInr(list.filter(function (r) { return r.status === 'paid'; }).reduce(function (a, r) { return a + Number(r.amount_inr); }, 0)) + ' paid</p>' + table([
        { label: 'Date', get: function (r) { return L.fmtDateTime(r.paid_at || r.created_at); } }, { label: 'Status', html: function (r) { return pillStatus(r.status); } }, { label: 'Name', html: function (r) { return r.user_id ? '<a href="#/student/' + r.user_id + '">' + esc(r.full_name) + '</a>' : esc(r.full_name); } }, { label: 'Email', key: 'email' }, { label: 'WhatsApp', key: 'whatsapp' },
        { label: 'Course', key: 'course_title' }, { label: 'Amount', get: function (r) { return L.fmtInr(r.amount_inr); } }, { label: 'Invoice', key: 'invoice_no' }, { label: 'Payment', key: 'razorpay_payment_id' }, { label: 'Method', key: 'payment_method' }, { label: 'Kit address', get: function (r) { return [r.address_line, r.city, r.state, r.pincode].filter(Boolean).join(', '); }, wrap: true },
        { label: 'Account', key: 'account_status' }, { label: 'Email sent', html: function (r) { return r.welcome_sent_at ? '<span class="pill ok">yes</span>' : (r.status === 'paid' ? '<span class="pill bad">no</span>' : ''); } }
      ], list);
    }
    sb.from('course_enrolments').select('*').order('created_at', { ascending: false }).then(function (r) { rows = r.data || []; draw(); });
    ['q', 'filter', 'course'].forEach(function (i) { $('#' + i).addEventListener('input', draw); $('#' + i).addEventListener('change', draw); });
    $('#csv').addEventListener('click', function () { L.download('vidiksha-enrolments.csv', L.csv(rows, ['created_at', 'paid_at', 'status', 'course_title', 'amount_inr', 'invoice_no', 'full_name', 'email', 'whatsapp', 'profession', 'organisation', 'address_line', 'city', 'state', 'pincode', 'razorpay_order_id', 'razorpay_payment_id', 'payment_method', 'account_status'].map(function (k) { return { label: k, key: k }; }))); });
  }
  function training() {
    L.render(head('Training sessions', 'Live training registrations', 'Who registered for which session.', '<button class="btn btn-ghost" id="csv">Export CSV</button>') + '<div id="tbl">' + L.spinner() + '</div>');
    sb.from('training_registrations').select('*').order('session_date', { ascending: false }).order('created_at', { ascending: false }).then(function (r) {
      var rows = r.data || [], groups = {};
      rows.forEach(function (x) { (groups[x.session_slug] = groups[x.session_slug] || { title: x.session_title, date: x.session_date, rows: [] }).rows.push(x); });
      $('#tbl').innerHTML = Object.keys(groups).length ? Object.keys(groups).map(function (k) { var g = groups[k]; return '<div class="section"><div class="section-head"><h2>' + esc(g.title) + '</h2><span class="muted">' + esc(L.fmtDate(g.date)) + ' · ' + g.rows.length + ' registered</span></div>' + table([{ label: 'Registered', get: function (x) { return L.fmtDateTime(x.created_at); } }, { label: 'Name', html: function (x) { return x.user_id ? '<a href="#/student/' + x.user_id + '">' + esc(x.full_name) + '</a>' : esc(x.full_name); } }, { label: 'Email', key: 'email' }, { label: 'WhatsApp', key: 'whatsapp' }, { label: 'Profession', key: 'profession' }, { label: 'Qualification', key: 'qualification' }], g.rows) + '</div>'; }).join('') : L.empty('No registrations yet.');
      $('#csv').addEventListener('click', function () { L.download('vidiksha-training-registrations.csv', L.csv(rows, ['session_title', 'session_date', 'created_at', 'full_name', 'email', 'whatsapp', 'profession', 'qualification'].map(function (k) { return { label: k, key: k }; }))); });
    });
  }

  /* ------------------------------------------------------------ course content */
  function courses() {
    L.render(head('Course content', 'Courses', 'Recorded sessions, materials, assignments and batches for each course.') + '<div class="grid grid-2" id="cc">' + L.spinner() + '</div>');
    Promise.all([sb.from('lectures').select('course_slug, published'), sb.from('course_roster').select('course_slug'), sb.from('assignments').select('course_slug')]).then(function (r) {
      var lec = {}, pub = {}, ros = {}, asg = {};
      (r[0].data || []).forEach(function (l) { lec[l.course_slug] = (lec[l.course_slug] || 0) + 1; if (l.published) pub[l.course_slug] = (pub[l.course_slug] || 0) + 1; });
      (r[1].data || []).forEach(function (x) { ros[x.course_slug] = (ros[x.course_slug] || 0) + 1; });
      (r[2].data || []).forEach(function (x) { asg[x.course_slug] = (asg[x.course_slug] || 0) + 1; });
      $('#cc').innerHTML = Object.keys(COURSES).map(function (s) { return '<a class="card is-link" href="#/course/' + s + '"><h3>' + esc(COURSES[s]) + '</h3><div class="muted small">' + (lec[s] || 0) + ' sessions (' + (pub[s] || 0) + ' published) · ' + (asg[s] || 0) + ' assignments · ' + (ros[s] || 0) + ' students</div></a>'; }).join('');
    });
  }
  function course(slug, q) {
    var tab = q.tab || 'sessions';
    L.render(head('Course', L.courseName(slug), '<a href="' + L.cfg.siteUrl + '/courses/' + esc(slug) + '/" target="_blank" rel="noopener">Public page ↗</a>') +
      '<div class="tabs">' + [['sessions', 'Sessions'], ['materials', 'Materials'], ['assignments', 'Assignments'], ['students', 'Students'], ['batches', 'Batches']].map(function (t) { return '<a href="#/course/' + slug + '?tab=' + t[0] + '" class="' + (tab === t[0] ? 'is-active' : '') + '">' + t[1] + '</a>'; }).join('') + '</div><div id="tab">' + L.spinner() + '</div>');
    ({ sessions: lecturesTab, materials: materialsTab, assignments: assignmentsTab, students: studentsTab, batches: batchesTab })[tab](slug);
  }
  function upload(bucket, path, file, onProgress) {
    return sb.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: '3600' }).then(function (r) { if (r.error) throw r.error; return r.data.path; });
  }
  function lectureForm(slug, l) {
    return '<div class="form-row">' + L.field('Title', '<input type="text" name="title" required value="' + esc(l.title || '') + '">') + L.field('Position', '<input type="number" name="position" min="1" value="' + esc(l.position || 1) + '">') + '</div>' +
      L.field('Description (what the session covers, shown under the player)', '<textarea name="description">' + esc(l.description || '') + '</textarea>') +
      L.field('Video link (YouTube unlisted, Vimeo, Loom, Google Drive) — or upload a file below', '<input type="url" name="video_url" value="' + esc(l.video_url || '') + '" placeholder="https://youtu.be/…">') +
      L.field('Upload recording (mp4). Large files take a while; keep this window open.' + (l.video_path ? ' Current file: ' + esc(l.video_path.split('/').pop()) : ''), '<input type="file" name="video_file" accept="video/mp4,video/webm,video/quicktime">') +
      '<div class="form-row">' + L.field('Length (minutes)', '<input type="number" name="duration_min" min="1" value="' + esc(l.duration_min || '') + '">') + L.field('Release on (optional; empty = as soon as published)', '<input type="datetime-local" name="release_at" value="' + dtLocal(l.release_at) + '">') + '</div>' +
      '<label class="check"><input type="checkbox" name="published"' + (l.published ? ' checked' : '') + '> Published (visible to students with access)</label>';
  }
  function saveLecture(slug, l, f, form) {
    var row = { course_slug: slug, title: f.title, position: Number(f.position) || 1, description: f.description, video_url: f.video_url || null, duration_min: Number(f.duration_min) || null, release_at: fromLocal(f.release_at), published: !!f.published, updated_at: new Date().toISOString() };
    var file = form.video_file.files[0];
    var up = file ? upload('lms-videos', slug + '/' + Date.now() + '-' + L.safeName(file.name), file).then(function (p) { row.video_path = p; }) : Promise.resolve();
    return up.then(function () { return (l.id ? sb.from('lectures').update(row).eq('id', l.id) : sb.from('lectures').insert(row)).then(must); });
  }
  function lecturesTab(slug) {
    sb.from('lectures').select('*').eq('course_slug', slug).order('position').then(function (r) {
      var rows = r.data || [];
      $('#tab').innerHTML = '<div class="toolbar"><button class="btn" id="add">Add session</button><span class="muted small">Students see published sessions whose release date has passed. Position sets the order.</span></div>' +
        table([{ label: '#', key: 'position' }, { label: 'Title', html: function (l) { return '<a href="#/lecture/' + l.id + '">' + esc(l.title) + '</a>'; }, wrap: true }, { label: 'Video', html: function (l) { return l.video_path ? '<span class="pill ok">file</span>' : l.video_url ? '<span class="pill ok">link</span>' : '<span class="pill warn">none</span>'; } }, { label: 'Length', get: function (l) { return L.minutes(l.duration_min); } }, { label: 'Release', get: function (l) { return l.release_at ? L.fmtDateTime(l.release_at) : ''; } }, { label: 'Published', html: function (l) { return l.published ? '<span class="pill ok">yes</span>' : '<span class="pill">draft</span>'; } }, { label: '', html: function (l) { return '<button class="btn btn-ghost btn-sm" data-edit="' + l.id + '">Edit</button> <button class="btn btn-danger btn-sm" data-del="' + l.id + '">Delete</button>'; } }], rows, 'No sessions yet. Add the first one.');
      $('#add').addEventListener('click', function () { dialog('Add session', lectureForm(slug, { position: rows.length + 1 }), function (f, form) { return saveLecture(slug, {}, f, form).then(function () { L.toast('Session added', 'ok'); lecturesTab(slug); }); }); });
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var l = rows.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0]; dialog('Edit session', lectureForm(slug, l), function (f, form) { return saveLecture(slug, l, f, form).then(function () { L.toast('Saved', 'ok'); lecturesTab(slug); }); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this session and its progress records')) return; sb.from('lectures').delete().eq('id', b.getAttribute('data-del')).then(function () { lecturesTab(slug); }); }); });
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
      $('#tab').innerHTML = '<p class="muted small">' + rows.length + ' students with access</p>' + table([{ label: 'Student', html: function (s) { return '<a href="#/student/' + s.user_id + '">' + esc(s.full_name || s.email) + '</a>'; } }, { label: 'Email', key: 'email' }, { label: 'Via', key: 'via' }, { label: 'Since', get: function (s) { return L.fmtDate(s.since); } }, { label: 'Until', get: function (s) { return L.until(s.until).replace('until ', '') || 'no end date'; } }, { label: 'Progress', get: function (s) { return total ? (done[s.user_id] || 0) + ' / ' + total : '—'; } }], rows, 'Nobody has this course yet.');
    });
  }
  function batchesTab(slug) {
    Promise.all([sb.from('batches').select('*, batch_members(user_id)').eq('course_slug', slug).order('starts_on', { ascending: false }), sb.from('course_roster').select('user_id, email, full_name').eq('course_slug', slug)]).then(function (r) {
      var rows = r[0].data || [], roster = r[1].data || [];
      var form = function (b) { return L.field('Name', '<input type="text" name="name" required value="' + esc(b.name || '') + '" placeholder="e.g. Batch 1 (October 2026)">') + '<div class="form-row">' + L.field('Starts', '<input type="date" name="starts_on" value="' + esc(b.starts_on || '') + '">') + L.field('Ends', '<input type="date" name="ends_on" value="' + esc(b.ends_on || '') + '">') + '</div>' + L.field('Notes', '<textarea name="notes">' + esc(b.notes || '') + '</textarea>'); };
      var save = function (b, f) { var row = { course_slug: slug, name: f.name, starts_on: f.starts_on || null, ends_on: f.ends_on || null, notes: f.notes }; return (b.id ? sb.from('batches').update(row).eq('id', b.id) : sb.from('batches').insert(row)).then(must).then(function () { batchesTab(slug); }); };
      $('#tab').innerHTML = '<div class="toolbar"><button class="btn" id="add">New batch</button><span class="muted small">Batches group students who started together, for your own tracking.</span></div>' +
        (rows.length ? rows.map(function (b) {
          var members = b.batch_members || [];
          return '<div class="card section" style="margin-top:1rem"><div class="section-head"><h2>' + esc(b.name) + '</h2><span class="muted">' + esc(L.fmtDate(b.starts_on)) + (b.ends_on ? ' to ' + esc(L.fmtDate(b.ends_on)) : '') + ' · ' + members.length + ' students</span></div>' + (b.notes ? '<p class="muted">' + esc(b.notes) + '</p>' : '') +
            '<ul class="list">' + members.map(function (m) { var s = roster.filter(function (x) { return x.user_id === m.user_id; })[0] || {}; return '<li><div class="grow"><a href="#/student/' + m.user_id + '">' + esc(s.full_name || s.email || m.user_id) + '</a></div><button class="btn btn-ghost btn-sm" data-rm="' + b.id + '|' + m.user_id + '">Remove</button></li>'; }).join('') + '</ul>' +
            '<div class="inline-form" style="margin-top:0.75rem"><label class="field"><span>Add a student with access</span><select data-add-select="' + b.id + '"><option value="">Choose</option>' + roster.filter(function (x) { return !members.some(function (m) { return m.user_id === x.user_id; }); }).map(function (x) { return '<option value="' + x.user_id + '">' + esc((x.full_name || '') + ' <' + x.email + '>') + '</option>'; }).join('') + '</select></label><button class="btn btn-sm" data-add="' + b.id + '">Add</button><button class="btn btn-ghost btn-sm" data-edit="' + b.id + '">Edit batch</button><button class="btn btn-danger btn-sm" data-del="' + b.id + '">Delete</button></div></div>';
        }).join('') : L.empty('No batches yet.'));
      $('#add').addEventListener('click', function () { dialog('New batch', form({}), function (f) { return save({}, f); }); });
      $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { var x = rows.filter(function (y) { return y.id === b.getAttribute('data-edit'); })[0]; dialog('Edit batch', form(x), function (f) { return save(x, f); }); }); });
      $$('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirmDelete('this batch')) return; sb.from('batches').delete().eq('id', b.getAttribute('data-del')).then(function () { batchesTab(slug); }); }); });
      $$('[data-add]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-add'), uid = $('[data-add-select="' + id + '"]').value; if (!uid) return; sb.from('batch_members').insert({ batch_id: id, user_id: uid }).then(function (x) { if (x.error) return L.toast(L.err(x.error), 'error'); batchesTab(slug); }); }); });
      $$('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { var p = b.getAttribute('data-rm').split('|'); sb.from('batch_members').delete().eq('batch_id', p[0]).eq('user_id', p[1]).then(function () { batchesTab(slug); }); }); });
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
    L.render(head('Announcements', 'Announcements', 'Shown in every student’s portal, or only to students of one course.', '<button class="btn" id="add">New announcement</button>') + '<div id="list">' + L.spinner() + '</div>');
    var form = function (n) { return L.field('Title', '<input type="text" name="title" required value="' + esc(n.title || '') + '">') + L.field('Text', '<textarea name="body">' + esc(n.body || '') + '</textarea>') + L.field('Audience', courseSelect('audience', n.audience || 'all', true)) + '<label class="check"><input type="checkbox" name="pinned"' + (n.pinned ? ' checked' : '') + '> Pin to the top</label>'; };
    var save = function (n, f) { var row = { title: f.title, body: f.body, audience: f.audience, pinned: !!f.pinned, created_by: session.user.id }; return (n.id ? sb.from('announcements').update(row).eq('id', n.id) : sb.from('announcements').insert(row)).then(must).then(function () { L.toast('Saved', 'ok'); notices(); }); };
    sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).then(function (r) {
      var rows = r.data || [];
      $('#list').innerHTML = rows.length ? rows.map(function (n) { return '<div class="notice ' + (n.pinned ? 'is-pinned' : '') + '"><div class="meta">' + esc(L.fmtDateTime(n.created_at)) + ' · ' + (n.audience === 'all' ? 'everyone' : esc(L.courseName(n.audience))) + (n.pinned ? ' · pinned' : '') + '</div><strong>' + esc(n.title) + '</strong><div class="prose small" style="margin-top:0.35rem">' + L.nl2p(n.body) + '</div><div class="actions" style="margin-top:0.5rem"><button class="btn btn-ghost btn-sm" data-edit="' + n.id + '">Edit</button><button class="btn btn-danger btn-sm" data-del="' + n.id + '">Delete</button></div></div>'; }).join('') : L.empty('No announcements yet.');
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
  function blog() {
    L.render(head('Blog posts', 'Publish a blog post', 'The post is committed to the website repository and vidiksha.in rebuilds itself within about a minute. Write in Markdown: ## for headings, blank lines between paragraphs, **bold**, lists with -.') +
      '<form class="form card" id="blog-form">' +
      '<div class="form-row">' + L.field('Title', '<input type="text" name="title" required>') + L.field('URL slug (auto from the title)', '<input type="text" name="slug" placeholder="auto">') + '</div>' +
      L.field('Description (one or two sentences, shown on cards and in search results)', '<input type="text" name="description" required maxlength="200">') +
      '<div class="form-row">' + L.field('Category', '<select name="category"><option>Trademark</option><option>Patent</option><option>Copyright</option><option>Design</option><option>Licensing</option></select>') + L.field('Related course', courseSelect('course', 'trademark-prosecution-in-practice')) + '</div>' +
      '<div class="form-row">' + L.field('Date', '<input type="date" name="date" value="' + new Date().toISOString().slice(0, 10) + '">') + L.field('Mode', '<select name="mode"><option value="create">New post (refuse if the slug exists)</option><option value="update">Update an existing post with this slug</option></select>') + '</div>' +
      L.field('Body (Markdown)', '<textarea name="body" class="tall" required placeholder="## The problem&#10;&#10;Most juniors…"></textarea>') +
      '<div class="actions"><button class="btn" type="submit">Publish to vidiksha.in</button></div><p class="status" id="st"></p></form>' +
      '<p class="fine" style="margin-top:1rem">Existing posts: <a href="' + L.cfg.siteUrl + '/blog/" target="_blank" rel="noopener">vidiksha.in/blog ↗</a>. To edit one, use its slug (the last part of its address) with mode “Update”.</p>');
    var form = $('#blog-form');
    form.title.addEventListener('input', function () { if (!form.slug.dataset.touched) form.slug.value = L.slugify(form.title.value); });
    form.slug.addEventListener('input', function () { form.slug.dataset.touched = '1'; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var f = L.formData(form), st = $('#st'); st.textContent = 'Publishing…'; st.className = 'status';
      f.slug = L.slugify(f.slug || f.title);
      sb.auth.getSession().then(function (s) {
        return fetch(L.cfg.functionsUrl + '/publish-post', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.data.session.access_token, apikey: L.cfg.anonKey }, body: JSON.stringify(f) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Failed'); return j; }); });
      }).then(function (j) { st.innerHTML = 'Published. It will be live at <a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.url) + '</a> in a minute or two.'; st.className = 'status is-ok'; form.reset(); delete form.slug.dataset.touched; }, function (err) { st.textContent = L.err(err); st.className = 'status is-error'; });
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
    '': overview, 'students': students, 'student/:id': function (p) { student(p.id); }, 'enrolments': enrolments, 'training': training,
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
      route();
    });
  }
  window.addEventListener('hashchange', route);
  sb.auth.onAuthStateChange(function (event, s) {
    var had = !!session; session = s;
    if (event === 'SIGNED_OUT') { me = null; location.hash = '#/'; return route(); }
    if ((event === 'SIGNED_IN' && !had) || event === 'INITIAL_SESSION') return boot();
  });
})();
