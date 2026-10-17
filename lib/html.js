// Layout and shared components. Every page goes through layout().
'use strict';
const { escText } = require('./md');

const esc = (s) => escText(s).replace(/"/g, '&quot;');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmtDate(iso) {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00+05:30' : iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTime(h, min) { return `${((h + 11) % 12) + 1}${min === '00' ? '' : ':' + min} ${h >= 12 ? 'pm' : 'am'}`; }
function fmtDateTime(iso, durationMin) {
  // Session times are written in IST in the content files; render them as such regardless of build machine TZ.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  const h = Number(m[4]); const min = m[5];
  let range = fmtTime(h, min);
  if (durationMin) {
    const end = h * 60 + Number(min) + Number(durationMin);
    range += ` to ${fmtTime(Math.floor(end / 60) % 24, String(end % 60).padStart(2, '0'))}`;
  }
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${range} IST`;
}
function fmtDuration(min) { return min % 60 === 0 ? `${min / 60} hour${min === 60 ? '' : 's'}` : `${min} min`; }
/* A session can have several sittings ("days"); older files have one datetime + duration. */
function sessionDays(w) {
  const days = Array.isArray(w.days) && w.days.length ? w.days : [{ datetime: w.datetime, duration: w.duration }];
  return days.map((d) => ({ datetime: d.datetime, duration: Number(d.duration || w.duration || 180) }));
}
function totalDuration(w) { return sessionDays(w).reduce((a, d) => a + d.duration, 0); }
function fmtTimeRange(iso, durationMin) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  const h = Number(m[4]); const min = m[5];
  let range = fmtTime(h, min);
  if (durationMin) { const end = h * 60 + Number(min) + Number(durationMin); range += ` to ${fmtTime(Math.floor(end / 60) % 24, String(end % 60).padStart(2, '0'))}`; }
  return range;
}
function fmtDateList(isos) {
  const groups = [];
  for (const iso of isos) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    const key = `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
    let g = groups.find((x) => x.key === key); if (!g) groups.push(g = { key, days: [] });
    g.days.push(Number(m[3]));
  }
  const join = (a) => a.length === 1 ? String(a[0]) : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  return groups.map((g) => `${join(g.days)} ${g.key}`).join(' and ');
}
/** "25 and 26 October 2026, 4 pm to 6 pm IST" for multi-day sessions with the same hours; one line per day otherwise. */
function fmtSchedule(w) {
  const days = sessionDays(w);
  if (days.length === 1) return fmtDateTime(days[0].datetime, days[0].duration);
  const same = days.every((d) => d.datetime.slice(11, 16) === days[0].datetime.slice(11, 16) && d.duration === days[0].duration);
  if (same) return `${fmtDateList(days.map((d) => d.datetime))}, ${fmtTimeRange(days[0].datetime, days[0].duration)} IST`;
  return days.map((d) => fmtDateTime(d.datetime, d.duration)).join('; ');
}
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

function nav(site, current) {
  return site.nav.map((n) => {
    const active = current === n.href || (n.href !== '/' && current.startsWith(n.href));
    return `<li><a href="${n.href}"${active ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`;
  }).join('');
}

function layout({ site, title, description, path, body, image, type = 'website', jsonLd, bodyClass = '', scripts = [] }) {
  const fullTitle = path === '/' ? `${site.name} — ${site.tagline}` : `${title} — ${site.name}`;
  const base = site.url.replace(/\/$/, '');
  const url = base + path;
  const ogImage = base + (image || '/assets/og-default.svg');
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#fafaf9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f0e0d" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)} blog" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">
<link rel="stylesheet" href="/assets/main.css">
${ld}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(site.name)} home"><span class="brand-name">${esc(site.name)}</span></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span><span></span></button>
    <nav id="site-nav" class="site-nav" aria-label="Primary">
      <ul>${nav(site, path)}</ul>
      <div class="nav-actions">
        <a class="btn btn-primary btn-sm" href="${site.cta.href}">${esc(site.cta.label)}</a>
      </div>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/"><span class="brand-name">${esc(site.name)}</span></a>
      <p>${esc(site.footerLine)}</p>
      <p class="footer-fine">Nothing on this site is legal advice. It is training for the people who give it.</p>
    </div>
    <div>
      <h2 class="footer-head">Learn</h2>
      <ul class="footer-links">
        <li><a href="/courses/">Courses</a></li>
        <li><a href="/live-training/">Live Training Sessions</a></li>
        <li><a href="/research/">Research</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/feed.xml">RSS feed</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-head">Company</h2>
      <ul class="footer-links">
        <li><a href="/about/">About</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-head">Elsewhere</h2>
      <ul class="footer-links">
        ${Object.entries(site.social).map(([k, v]) => `<li><a href="${esc(v)}" rel="me noopener">${esc(k[0].toUpperCase() + k.slice(1))}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${new Date().getFullYear()} ${esc(site.legalName)}. All rights reserved.</span>
    <span>Made in India.</span>
  </div>
</footer>
<script src="/assets/main.js" defer></script>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

/* ---------- components ---------- */

function sectionHead(eyebrow, title, link, { center = false, lede = '' } = {}) {
  return `<div class="section-head${center ? ' section-head-center' : ''} reveal">
    <div><p class="eyebrow">${esc(eyebrow)}</p><h2>${title}</h2>${lede ? `<p class="section-lede">${esc(lede)}</p>` : ''}</div>
    ${link ? `<a class="link-arrow" href="${link.href}">${esc(link.label)}</a>` : ''}
  </div>`;
}

function postCard(p) {
  return `<article class="card post-card reveal" data-category="${esc(p.category)}" data-search="${esc((p.title + ' ' + p.description + ' ' + p.category).toLowerCase())}">
    <div class="card-meta"><span class="tag">${esc(p.category)}</span><span>${p.readingTime} min read</span></div>
    <h3 class="card-title"><a href="${p.url}">${esc(p.title)}</a></h3>
    <p class="card-desc">${esc(p.description)}</p>
    <time class="card-date" datetime="${p.date}">${fmtDate(p.date)}</time>
  </article>`;
}

function courseCard(c, { featured = false } = {}) {
  return `<article class="card course-card${featured ? ' course-card-featured' : ''} reveal">
    <div class="card-meta"><span class="tag">${esc(c.area)}</span><span>${esc(c.level)}</span><span>${esc(c.duration)}</span></div>
    <h3 class="card-title"><a href="${c.url}">${esc(c.title)}</a></h3>
    <p class="card-desc">${esc(c.summary)}</p>
    <ul class="mini-list">${c.outcomes.slice(0, 3).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
    <div class="card-foot">
      <span class="price">${inr(c.price)}<span class="price-note"> inaugural price</span></span>
      <a class="btn btn-ghost btn-sm" href="${c.url}">See curriculum</a>
    </div>
  </article>`;
}

function webinarCard(w, { past = false } = {}) {
  const when = fmtSchedule(w);
  const nDays = sessionDays(w).length;
  const action = past
    ? (w.replayUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(w.replayUrl)}">Watch replay</a>` : `<span class="muted">Replay coming soon</span>`)
    : `<a class="btn btn-primary btn-sm" href="${esc(w.registerUrl)}">Register${w.price ? ` · ${inr(w.price)} inaugural` : ' · Free'}</a>`;
  return `<article class="card webinar-card reveal">
    <div class="card-meta"><span class="tag">${esc(w.area)}</span><span>${nDays > 1 ? `${nDays} days · ` : ''}${fmtDuration(totalDuration(w))}</span>${past ? '<span>Replay</span>' : '<span>Live</span>'}</div>
    <h3 class="card-title">${esc(w.title)}</h3>
    <p class="card-desc">${esc(w.summary)}</p>
    ${w.format || w.certificate ? `<ul class="session-points">${w.format ? `<li>${esc(w.format)}</li>` : ''}${w.certificate ? `<li>${esc(w.certificate)}</li>` : ''}</ul>` : ''}
    <p class="webinar-when"><time datetime="${w.datetime}">${when}</time></p>
    <div class="card-foot">${action}</div>
  </article>`;
}

function newsletter(site) {
  return `<section class="newsletter reveal" aria-labelledby="nl-title">
    <div class="container newsletter-inner">
      <div>
        <p class="eyebrow">The Friday Filing</p>
        <h2 id="nl-title">One practical IP note a week. No case summaries.</h2>
        <p>A drafting tip, a reading of a real examination report, or a clause worth stealing. Four minutes to read. One click to leave.</p>
      </div>
      <form class="form form-inline" action="${esc(site.formEndpoint)}" method="post" data-form="newsletter">
        <input type="hidden" name="form" value="newsletter">
        <label class="sr-only" for="nl-email">Email address</label>
        <input id="nl-email" type="email" name="email" placeholder="you@firm.in" required autocomplete="email">
        <button class="btn btn-primary" type="submit">Subscribe</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </section>`;
}

module.exports = { esc, fmtDate, fmtDateTime, fmtDuration, inr, layout, sectionHead, postCard, courseCard, webinarCard, newsletter, sessionDays, totalDuration, fmtSchedule };
