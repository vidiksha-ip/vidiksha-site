// HTML helpers and the page layout shared by every page.
'use strict';

const escText = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const esc = (s) => escText(s).replace(/"/g, '&quot;');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12h17M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* The firm's mark: a hairline seal around a Cormorant V. Used in the header, the hero and the favicon. */
function brandMark(cls = 'brand-mark') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="1"/>
  <circle cx="32" cy="32" r="23.5" fill="none" stroke="#b6975e" stroke-width="0.9"/>
  <text x="32" y="43" text-anchor="middle" font-family="'Cormorant Garamond', 'Times New Roman', Georgia, serif" font-size="30" font-weight="400" fill="currentColor">V</text>
</svg>`;
}

function emblem() {
  return `<svg class="emblem" viewBox="0 0 440 440" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="eg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#16314d" stop-opacity="0.95"/><stop offset="1" stop-color="#0a1a2b" stop-opacity="0"/></radialGradient>
    <path id="arc" d="M220 60a160 160 0 1 1-0.01 0"/>
  </defs>
  <circle cx="220" cy="220" r="220" fill="url(#eg)"/>
  <circle cx="220" cy="220" r="196" fill="none" stroke="#b6975e" stroke-opacity="0.55" stroke-width="0.8"/>
  <g class="emblem-ring"><circle cx="220" cy="220" r="166" fill="none" stroke="#b6975e" stroke-opacity="0.55" stroke-width="0.8" stroke-dasharray="1.5 7"/></g>
  <circle cx="220" cy="220" r="124" fill="none" stroke="#f4f1ea" stroke-opacity="0.22" stroke-width="0.8"/>
  <path d="M220 14v16M220 410v16M14 220h16M410 220h16" stroke="#b6975e" stroke-width="1" stroke-opacity="0.9"/>
  <text font-family="'Instrument Sans', Helvetica, Arial, sans-serif" font-size="9.5" letter-spacing="3.2" fill="#f4f1ea" fill-opacity="0.45"><textPath href="#arc" startOffset="2%">VIDIKSHA IP · TRADEMARK ATTORNEYS · INDIA · </textPath></text>
  <text x="220" y="268" text-anchor="middle" font-family="'Cormorant Garamond', 'Times New Roman', Georgia, serif" font-size="164" font-weight="300" fill="#f4f1ea">V</text>
  <text x="290" y="170" font-family="Georgia, serif" font-size="22" fill="#b6975e">&#174;</text>
</svg>`;
}

function nav(site, current, { menu = false } = {}) {
  return site.nav.map((item) => {
    const active = current === item.href || (item.href !== '/' && current.startsWith(item.href));
    return `<li><a ${menu ? 'class="menu-link"' : ''} href="${esc(item.href)}"${active ? ' aria-current="page"' : ''}>${esc(item.label)}${menu ? ARROW : ''}</a></li>`;
  }).join('');
}

function layout({ site, title, description, path, body, image, type = 'website', jsonLd, bodyClass = '', scripts = [] }) {
  const fullTitle = path === '/' ? `${site.name} — ${site.tagline}` : `${title} — ${site.name}`;
  const base = site.url.replace(/\/$/, '');
  const url = base + path;
  const ogImage = base + (image || '/assets/og-default.svg');
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  const practiceLinks = (site.practiceLinks || []).map((p) => `<li><a href="${esc(p.href)}">${esc(p.label)}</a></li>`).join('\n        ');
  const social = Object.entries(site.social || {}).filter(([, v]) => v).map(([k, v]) => `<li><a href="${esc(v)}" rel="me noopener">${esc(k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1))}</a></li>`).join('\n        ');
  const d = site.disclaimer;
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
<meta name="theme-color" content="#0a1a2b">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)} insights" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<link rel="stylesheet" href="/assets/main.css">
${ld}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" data-header>
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(site.name)} home">${brandMark()}<span class="brand-word">${esc(site.shortName)}<small>IP</small></span></a>
    <nav class="site-nav" aria-label="Primary">
      <ul>${nav(site, path)}</ul>
    </nav>
    <div class="header-actions">
      <a class="btn btn-outline-light btn-sm" href="${esc(site.cta.href)}">${esc(site.cta.label)}</a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu"><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="site-menu" id="site-menu" hidden>
  <nav aria-label="Menu"><ul>${nav(site, path, { menu: true })}</ul></nav>
  <div class="menu-foot">
    <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
    ${site.phone ? `<a href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${esc(site.phone)}</a>` : ''}
    ${Object.entries(site.social || {}).filter(([, v]) => v).map(([k, v]) => `<a href="${esc(v)}" rel="me noopener">${esc(k === 'x' ? 'X' : k[0].toUpperCase() + k.slice(1))}</a>`).join('')}
  </div>
</div>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/">${brandMark()}<span class="brand-word">${esc(site.shortName)}<small>IP</small></span></a>
      <p>${esc(site.footerLine)}</p>
      <p class="footer-fine">Advocates and registered trade marks agents. Nothing on this website is legal advice or an invitation to engage the firm. Please see the Bar Council disclaimer.</p>
    </div>
    <div>
      <h2 class="footer-head">Expertise</h2>
      <ul class="footer-links">
        ${practiceLinks}
      </ul>
    </div>
    <div>
      <h2 class="footer-head">Firm</h2>
      <ul class="footer-links">
        <li><a href="/about/">The Firm</a></li>
        <li><a href="/people/">People</a></li>
        <li><a href="/insights/">Insights</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/feed.xml">RSS</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-head">Contact</h2>
      <ul class="footer-links">
        <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
        ${site.phone ? `<li><a href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${esc(site.phone)}</a></li>` : ''}
        ${social}
      </ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${new Date().getFullYear()} ${esc(site.legalName)}. All rights reserved.</span>
    <span class="links"><button type="button" data-disclaimer-open>Disclaimer</button><a href="/sitemap.xml">Sitemap</a></span>
  </div>
</footer>
<div class="disclaimer" id="disclaimer" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" hidden>
  <div class="disclaimer-panel">
    <p class="eyebrow">${esc(site.name)}</p>
    <h2 id="disclaimer-title">${esc(d.title)}</h2>
    <p>${esc(d.text)}</p>
    <label class="check"><input type="checkbox" data-disclaimer-check> <span>${esc(d.check)}</span></label>
    <button class="btn btn-navy" type="button" data-disclaimer-accept disabled>${esc(d.button)}</button>
  </div>
</div>
<script src="/assets/main.js" defer></script>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

/* ---------- reusable fragments ---------- */

function sectionHead(eyebrow, title, link, { lede = '' } = {}) {
  return `<div class="section-head reveal">
    <div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h2>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}</div>
    ${link ? `<a class="link-arrow" href="${esc(link.href)}">${esc(link.label)}${ARROW}</a>` : ''}
  </div>`;
}

function practiceRow(p, i, { large = false } = {}) {
  return `<li><a class="practice-row reveal" style="--d:${Math.min(i, 8) * 0.05}s" href="${esc(p.url)}">
    <span class="practice-num">${String(i + 1).padStart(2, '0')}</span>
    <span class="practice-title">${esc(p.title)}</span>
    <span class="practice-short">${esc(p.short)}</span>
    <span class="practice-arrow">${ARROW}</span>
  </a></li>`;
}

function insightCard(p, i = 0) {
  return `<article class="card insight-card reveal" style="--d:${(i % 3) * 0.08}s" data-category="${esc(p.category)}" data-search="${esc((p.title + ' ' + p.description + ' ' + p.category).toLowerCase())}">
    <div class="card-meta"><span class="tag">${esc(p.category)}</span><time datetime="${esc(p.date)}">${fmtDate(p.date)}</time></div>
    <h3 class="card-title"><a href="${esc(p.url)}">${esc(p.title)}</a></h3>
    <p class="card-desc">${esc(p.description)}</p>
    <div class="card-foot"><span>${p.readingTime} min read</span>${ARROW}</div>
  </article>`;
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function personCard(person, i = 0) {
  return `<article class="card person-card reveal" style="--d:${(i % 3) * 0.08}s">
    <div class="person-photo">${person.photo ? `<img src="${esc(person.photo)}" alt="${esc(person.name)}" loading="lazy">` : `<span class="person-initials">${esc(initials(person.name))}</span>`}</div>
    <div class="person-body">
      <h3 class="card-title"><a href="${esc(person.url)}">${esc(person.name)}</a></h3>
      <p class="person-role">${esc(person.role)}</p>
      ${person.focus && person.focus.length ? `<p class="person-focus">${esc(person.focus.join(' · '))}</p>` : ''}
    </div>
  </article>`;
}

function contactBand(site) {
  const c = site.contactBand;
  return `<section class="contact-band" aria-labelledby="cb-title">
  <div class="container">
    <div class="reveal"><p class="eyebrow">Contact</p><h2 id="cb-title">${esc(c.title)}</h2><p>${esc(c.text)}</p></div>
    <div class="contact-band-side reveal" style="--d:0.1s">
      <a class="big" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
      ${site.phone ? `<a class="big" href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${esc(site.phone)}</a>` : ''}
      <a class="btn btn-gold" href="/contact/">Make an enquiry</a>
    </div>
  </div>
</section>`;
}

function pageHead({ eyebrow, title, lede, crumbs = [], cls = '', extra = '' }) {
  const crumbHtml = crumbs.length ? `<p class="crumbs"><a href="/">Home</a>${crumbs.map((c) => `<span>${c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : esc(c.label)}</span>`).join('')}</p>` : '';
  return `<section class="page-head ${cls}">
  <div class="container">
    ${crumbHtml}
    ${eyebrow ? `<p class="eyebrow reveal">${esc(eyebrow)}</p>` : ''}
    ${extra}
    <h1 class="reveal" style="--d:0.05s">${title}</h1>
    ${lede ? `<p class="lede reveal" style="--d:0.1s">${lede}</p>` : ''}
  </div>
</section>`;
}

module.exports = { esc, escText, fmtDate, ARROW, brandMark, emblem, layout, sectionHead, practiceRow, insightCard, personCard, contactBand, pageHead, initials };
