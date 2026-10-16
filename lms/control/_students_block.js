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
      ], list, 'No members match.').replace('<div class="table-wrap">', '<div class="table-wrap fit">');
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
        sb.from('lectures').select('id, course_slug, position, title, duration_min').order('position')
      ]).then(function (r) {
        var enr = (r[0].data || []).filter(function (e) { return e.status === 'paid'; }).map(function (e) { e.kind = 'enrolment'; return e; }), attempts = (r[0].data || []).filter(function (e) { return e.status !== 'paid'; });
        var grants = (r[1].data || []).map(function (g) { g.kind = 'grant'; return g; }), regs = r[2].data || [], watch = r[3].data || [], subs = r[4].data || [], msgs = r[5].data || [], acts = r[6].data || [], rlog = r[8].data || [], lecs = r[9].data || [];
        var access = enr.concat(grants);
        var courseSlugs = []; access.forEach(function (a) { if (courseSlugs.indexOf(a.course_slug) < 0) courseSlugs.push(a.course_slug); });
        var watchBy = {}; watch.forEach(function (w) { watchBy[w.lecture_id] = w; });
        var logins = acts.filter(function (a) { return a.event === 'portal_login'; });
        var totalMin = Math.round(watch.reduce(function (a, w) { return a + (w.seconds || 0); }, 0) / 60), doneCount = watch.filter(function (w) { return w.completed; }).length;

        L.render(head('Member', p.full_name || p.email, esc(p.email) + (p.whatsapp ? ' · ' + esc(p.whatsapp) : '') + (p.profession ? ' · ' + esc(p.profession) : '') + (p.organisation ? ' · ' + esc(p.organisation) : '') + (r[7].data ? ' · <span class="pill ok">team: ' + esc(r[7].data.role) + '</span>' : ''),
          '<button class="btn btn-ghost" id="edit">Edit details</button><button class="btn" id="grant">Grant course access</button>') +
          '<div class="grid grid-4" style="margin-bottom:1.75rem">' + [[totalMin ? L.minutes(totalMin) : '0 min', 'watched in total'], [doneCount, 'sessions completed'], [logins.length ? L.fmtDate(logins[0].created_at) : 'never', 'last portal login'], [(rlog.length ? L.fmtDate(rlog[0].created_at) : 'never'), 'last research login']].map(function (x) { return '<div class="card stat"><div class="n" style="font-size:1.5rem">' + esc(x[0]) + '</div><div class="l">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' +

          '<div class="section-head"><h2>Course access</h2><span class="muted small">Disable hides the course in the portal; the record and the invoice stay.</span></div>' +
          table([
            { label: 'Course', get: function (e) { return e.course_title || L.courseName(e.course_slug); }, wrap: true },
            { label: 'Via', html: function (e) { return e.kind === 'grant' ? '<span class="pill">grant' + (e.note ? ': ' + esc(e.note) : '') + '</span>' : '<span class="pill ok">paid ' + esc(e.invoice_no || '') + '</span>'; }, wrap: true },
            { label: 'From', get: function (e) { return L.fmtDate(e.paid_at || e.created_at); } },
            { label: 'Until', html: function (e) { var u = accessEnd(e); return (u && new Date(u).getFullYear() < 2200 ? esc(L.fmtDate(u)) : 'no end date') + (e.access_until ? '<div class="muted small">changed by the team</div>' : ''); } },
            { label: 'Status', html: function (e) { var st = accessState(e); return '<span class="pill ' + st.cls + '">' + st.label + '</span>' + (e.suspended_at ? '<div class="muted small">' + esc(L.fmtDate(e.suspended_at)) + (e.suspended_reason ? ': ' + esc(e.suspended_reason) : '') + '</div>' : ''); }, wrap: true },
            { label: '', html: function (e) { return (e.suspended_at ? '<button class="btn btn-sm" data-enable="' + e.kind + '|' + e.id + '">Enable</button>' : '<button class="btn btn-ghost btn-sm" data-disable="' + e.kind + '|' + e.id + '">Disable</button>') + ' <button class="btn btn-ghost btn-sm" data-extend="' + e.kind + '|' + e.id + '">End date</button>' + (e.kind === 'grant' ? ' <button class="btn btn-danger btn-sm" data-del-grant="' + e.id + '">Remove</button>' : ''); } }
          ], access, 'No courses on this account. Use "Grant course access" to add one.').replace('<div class="table-wrap">', '<div class="table-wrap fit">') +
          (attempts.length ? '<p class="muted small" style="margin-top:0.5rem">' + attempts.length + ' unpaid purchase attempt' + (attempts.length > 1 ? 's' : '') + ' (' + attempts.map(function (a) { return a.status + ' ' + L.fmtDate(a.created_at); }).join(', ') + ').</p>' : '') +

          '<div class="section"><div class="section-head"><h2>Watching activity</h2><span class="muted small">Every session of each course, with how much of the recording has been watched.</span></div>' +
          (courseSlugs.length ? courseSlugs.map(function (slug) {
            var mine = lecs.filter(function (l) { return l.course_slug === slug; }), cur = (window.VIDIKSHA_COURSES && window.VIDIKSHA_COURSES[slug] && window.VIDIKSHA_COURSES[slug].sessions) || [];
            var rows = cur.length ? cur.map(function (c) { return { n: c.n, title: c.title, lecture: mine.filter(function (l) { return l.position === c.n; })[0] }; }) : mine.map(function (l) { return { n: l.position, title: l.title, lecture: l }; });
            mine.forEach(function (l) { if (!rows.some(function (x) { return x.lecture && x.lecture.id === l.id; })) rows.push({ n: l.position, title: l.title, lecture: l }); });
            var done = rows.filter(function (x) { return x.lecture && watchBy[x.lecture.id] && watchBy[x.lecture.id].completed; }).length;
            return '<h3 style="margin-top:1rem">' + esc(L.courseName(slug)) + ' <span class="muted small">' + done + ' of ' + rows.length + ' completed</span></h3>' + table([
              { label: '#', get: function (x) { return x.n; } }, { label: 'Session', get: function (x) { return x.title; }, wrap: true },
              { label: 'Watched', html: function (x) { var w = x.lecture && watchBy[x.lecture.id]; if (!x.lecture) return '<span class="muted">no recording yet</span>'; if (!w) return '<span class="muted">not opened</span>'; var pct = x.lecture.duration_min ? Math.min(100, Math.round(w.seconds / 60 * 100 / x.lecture.duration_min)) : null; return (L.minutes(Math.round(w.seconds / 60)) || '< 1 min') + (pct !== null ? ' <span class="muted small">(' + pct + '%)</span>' : '') + '<div class="progress" style="margin-top:0.3rem;width:120px"><i style="width:' + (w.completed ? 100 : pct || 0) + '%"></i></div>'; } },
              { label: 'Status', html: function (x) { var w = x.lecture && watchBy[x.lecture.id]; return !x.lecture ? '' : w && w.completed ? '<span class="pill ok">completed</span>' : w ? '<span class="pill warn">in progress</span>' : '<span class="pill">not started</span>'; } },
              { label: 'Last watched', get: function (x) { var w = x.lecture && watchBy[x.lecture.id]; return w ? L.fmtDateTime(w.last_watched) : ''; } }
            ], rows, 'No sessions in this course yet.').replace('<div class="table-wrap">', '<div class="table-wrap fit">');
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

