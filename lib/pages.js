// Page renderers. Each returns a full HTML document via layout().
'use strict';
const { esc, fmtDate, ARROW, emblem, layout, sectionHead, practiceRow, insightCard, personCard, contactBand, pageHead, initials } = require('./html');

const CATEGORIES = ['Prosecution', 'Oppositions', 'Enforcement', 'Licensing', 'Portfolio', 'Strategy'];

const stepsHtml = (items, { numerals = 'roman', light = false } = {}) => {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return `<div class="steps ${light ? 'steps-light' : ''}">${items.map((it, i) => `<div class="step reveal" style="--d:${i * 0.08}s"><span class="step-num">${numerals === 'roman' ? roman[i] : String(i + 1).padStart(2, '0')}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div>`).join('')}</div>`;
};

function contactForm(site) {
  const matters = ['A new trademark application or clearance search', 'An examination report or Registry hearing', 'An opposition or rectification', 'Infringement, passing off or counterfeiting', 'A licence, assignment or brand transaction', 'International filings or the Madrid Protocol', 'Portfolio management for an existing brand', 'Something else'];
  return `<form class="form form-stack" action="${esc(site.formEndpoint)}" method="post" data-form="contact">
    <input type="hidden" name="form" value="contact">
    <div class="form-row">
      <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" type="text" required autocomplete="name"></div>
      <div class="field"><label for="c-org">Organisation</label><input id="c-org" name="organisation" type="text" autocomplete="organization"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" autocomplete="tel"></div>
    </div>
    <div class="field"><label for="c-topic">The matter concerns</label>
      <select id="c-topic" name="matter">${matters.map((m) => `<option>${esc(m)}</option>`).join('')}</select>
    </div>
    <div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required placeholder="The mark, the goods or services, the market, and where things stand. Please do not send confidential documents until we have confirmed there is no conflict."></textarea></div>
    <div class="form-actions"><button class="btn btn-navy" type="submit">Send enquiry</button><p class="form-status" role="status" aria-live="polite"></p></div>
    <p class="form-note">Sending an enquiry does not create a lawyer–client relationship. We run a conflict check on every enquiry before reading anything confidential.</p>
  </form>`;
}

/* ---------------- Home ---------------- */
function home({ site, posts, practices, people }) {
  const s = site.statement, a = site.approach, sec = site.sectors, pp = site.people;
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="container hero-inner">
    <div>
      <p class="eyebrow reveal">${esc(site.hero.eyebrow)}</p>
      <h1 id="hero-title" class="display reveal" style="--d:0.08s">${esc(site.hero.title)}</h1>
      <p class="lede reveal" style="--d:0.16s">${esc(site.hero.lede)}</p>
      <div class="cta-row reveal" style="--d:0.24s">
        <a class="btn btn-gold" href="/expertise/">Our expertise</a>
        <a class="btn btn-outline-light" href="/contact/">Speak with us</a>
      </div>
    </div>
    <div class="hero-visual reveal" style="--d:0.2s">${emblem()}</div>
  </div>
  <div class="hero-foot"><div class="container"><ul class="forums">${site.forums.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div></div>
</section>

<section class="section" aria-labelledby="st-title">
  <div class="container statement">
    <div class="reveal"><p class="eyebrow">${esc(s.eyebrow)}</p><h2 id="st-title" class="statement-title">${esc(s.title)}</h2></div>
    <div class="statement-side reveal" style="--d:0.1s"><p>${esc(s.text)}</p><a class="link-arrow" href="${esc(s.link.href)}">${esc(s.link.label)}${ARROW}</a></div>
  </div>
</section>

<section class="section section-surface section-line" aria-labelledby="ex-title">
  <div class="container">
    ${sectionHead('Expertise', '<span id="ex-title">Everything a trademark needs, from the first search to the final order.</span>', { href: '/expertise/', label: 'All practice areas' })}
    <ol class="practice-list">${practices.map((p, i) => practiceRow(p, i)).join('')}</ol>
  </div>
</section>

<section class="section section-navy" aria-labelledby="ap-title">
  <div class="container">
    ${sectionHead(esc(a.eyebrow), `<span id="ap-title">${esc(a.title)}</span>`)}
    ${stepsHtml(a.items)}
  </div>
</section>

<section class="section section-alt" aria-labelledby="sec-title">
  <div class="container sectors">
    <div class="reveal"><p class="eyebrow">${esc(sec.eyebrow)}</p><h2 id="sec-title">${esc(sec.title)}</h2><p>${esc(sec.text)}</p></div>
    <ul class="sector-list reveal" style="--d:0.1s">${sec.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
</section>

${posts.length ? `<section class="section" aria-labelledby="in-title">
  <div class="container">
    ${sectionHead('Insights', '<span id="in-title">Writing from the practice.</span>', { href: '/insights/', label: 'All insights' })}
    <div class="grid grid-3">${posts.slice(0, 3).map((p, i) => insightCard(p, i)).join('')}</div>
  </div>
</section>` : ''}

<section class="section section-surface section-line" aria-labelledby="pe-title">
  <div class="container">
    ${sectionHead(esc(pp.eyebrow), `<span id="pe-title">${esc(pp.title)}</span>`, { href: '/people/', label: 'Meet the team' }, { lede: esc(pp.text) })}
    ${people.length ? `<div class="grid grid-3">${people.slice(0, 3).map((p, i) => personCard(p, i)).join('')}</div>` : ''}
  </div>
</section>

${contactBand(site)}
`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LegalService', name: site.name, url: site.url, email: site.email,
    description: site.description, areaServed: 'IN', knowsAbout: practices.map((p) => p.title), sameAs: Object.values(site.social || {}).filter(Boolean),
  };
  return layout({ site, title: site.tagline, description: site.description, path: '/', body, jsonLd, bodyClass: 'page-home' });
}

/* ---------------- Expertise ---------------- */
function expertiseIndex({ site, practices }) {
  const body = `
${pageHead({ eyebrow: 'Expertise', title: 'One discipline, practised in full.', lede: 'Eight areas of work, each of them a part of the life of a trademark. We take on all of them, and nothing outside them.', crumbs: [{ label: 'Expertise' }] })}
<section class="section section-tight">
  <div class="container">
    <ol class="practice-list practice-list-large">${practices.map((p, i) => practiceRow(p, i, { large: true })).join('')}</ol>
  </div>
</section>
<section class="section section-navy" aria-labelledby="ap2-title">
  <div class="container">
    ${sectionHead(esc(site.approach.eyebrow), `<span id="ap2-title">${esc(site.approach.title)}</span>`)}
    ${stepsHtml(site.approach.items)}
  </div>
</section>
${contactBand(site)}
`;
  return layout({ site, title: 'Expertise', description: 'Trademark clearance, filing, prosecution, oppositions, enforcement, anti-counterfeiting, portfolio management, licensing and Madrid filings. The practice areas of Vidiksha IP.', path: '/expertise/', body });
}

function expertise({ site, practices, posts }, p) {
  const related = posts.filter((x) => (p.categories || []).includes(x.category)).slice(0, 3);
  const body = `
${pageHead({ eyebrow: 'Expertise', title: esc(p.title), lede: esc(p.short), crumbs: [{ label: 'Expertise', href: '/expertise/' }, { label: p.title }] })}
<section class="section section-tight">
  <div class="container detail">
    <div>
      <div class="detail-section prose reveal">${p.intro.map((t, i) => `<p${i === 0 ? ' class="prose-lede"' : ''}>${esc(t)}</p>`).join('')}</div>
      <div class="detail-section reveal">
        <h2>What we do</h2>
        <ol class="service-list">${p.services.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
      </div>
      ${p.process && p.process.length ? `<div class="detail-section reveal">
        <h2>How a matter runs</h2>
        ${stepsHtml(p.process, { numerals: 'arabic', light: true })}
      </div>` : ''}
    </div>
    <aside class="detail-aside">
      <div class="aside-block reveal">
        <h2>Expertise</h2>
        <ul class="aside-list">${practices.map((x) => `<li><a href="${esc(x.url)}"${x.slug === p.slug ? ' aria-current="page"' : ''}>${esc(x.title)}${ARROW}</a></li>`).join('')}</ul>
      </div>
      <div class="aside-card reveal" style="--d:0.1s">
        <h3>Discuss a matter</h3>
        <p>Write to us with the mark and the question. We reply within one working day, after a conflict check.</p>
        <p><a class="plain" href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
        <a class="btn btn-gold" href="/contact/">Make an enquiry</a>
      </div>
    </aside>
  </div>
</section>
${related.length ? `<section class="section section-alt" aria-labelledby="rel-title">
  <div class="container">
    ${sectionHead('Insights', '<span id="rel-title">Related writing</span>', { href: '/insights/', label: 'All insights' })}
    <div class="grid grid-3">${related.map((x, i) => insightCard(x, i)).join('')}</div>
  </div>
</section>` : ''}
${contactBand(site)}
`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Service', name: p.title, description: p.short, provider: { '@type': 'LegalService', name: site.name, url: site.url }, areaServed: 'IN', serviceType: 'Trademark law' };
  return layout({ site, title: p.title, description: p.short, path: p.url, body, jsonLd });
}

/* ---------------- People ---------------- */
function peopleIndex({ site, people }) {
  const pp = site.people;
  const body = `
${pageHead({ eyebrow: pp.eyebrow, title: esc(pp.title), lede: esc(pp.text), crumbs: [{ label: 'People' }] })}
<section class="section section-tight">
  <div class="container">
    ${people.length ? `<div class="grid grid-3">${people.map((p, i) => personCard(p, i)).join('')}</div>` : `<div class="people-empty reveal">
      <p class="eyebrow eyebrow-plain" style="justify-content:center">Profiles</p>
      <h3>Lawyer profiles are being prepared.</h3>
      <p>In the meantime, write to <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> and the lawyer who would handle your matter will reply directly.</p>
    </div>`}
  </div>
</section>
${contactBand(site)}
`;
  return layout({ site, title: 'People', description: `The lawyers of ${site.name}, a boutique trademark law firm in India.`, path: '/people/', body });
}

function person({ site, people, practices }, p) {
  const details = [
    ['Qualifications', p.qualifications], ['Admissions', p.admissions], ['Focus', p.focus], ['Languages', p.languages],
  ].filter(([, v]) => Array.isArray(v) && v.length);
  const body = `
${pageHead({ eyebrow: esc(p.role), title: esc(p.name), crumbs: [{ label: 'People', href: '/people/' }, { label: p.name }] })}
<section class="section section-tight">
  <div class="container detail">
    <div>
      <div class="prose prose-about reveal">${(p.bio || []).map((t) => `<p>${esc(t)}</p>`).join('')}</div>
    </div>
    <aside class="detail-aside">
      ${p.photo ? `<div class="person-photo reveal"><img src="${esc(p.photo)}" alt="${esc(p.name)}"></div>` : ''}
      ${details.map(([k, v]) => `<div class="aside-block reveal"><h2>${k}</h2><ul class="aside-list plain">${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
      <div class="aside-card reveal">
        <h3>Contact</h3>
        ${p.email ? `<p><a class="plain" href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>` : `<p><a class="plain" href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>`}
        ${p.linkedin ? `<p><a class="plain" href="${esc(p.linkedin)}" rel="noopener">LinkedIn</a></p>` : ''}
        <a class="btn btn-gold" href="/contact/">Make an enquiry</a>
      </div>
    </aside>
  </div>
</section>
${contactBand(site)}
`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.role, worksFor: { '@type': 'LegalService', name: site.name, url: site.url }, url: site.url.replace(/\/$/, '') + p.url };
  return layout({ site, title: p.name, description: `${p.name}, ${p.role} at ${site.name}.`, path: p.url, body, type: 'profile', jsonLd });
}

/* ---------------- Insights ---------------- */
function insightsIndex({ site, posts }) {
  const cats = CATEGORIES.filter((c) => posts.some((p) => p.category === c));
  const body = `
${pageHead({ eyebrow: 'Insights', title: 'Writing from the practice.', lede: 'Notes on Indian trademark law as it is actually applied: at the Registry, in the Intellectual Property Divisions and in the agreements that hold a brand together.', crumbs: [{ label: 'Insights' }] })}
<section class="section section-tight">
  <div class="container">
    <div class="filter-bar reveal">
      <div class="chips" role="group" aria-label="Filter by topic">
        <button class="chip is-active" type="button" data-filter="all" aria-pressed="true">All</button>
        ${cats.map((c) => `<button class="chip" type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
      </div>
      <div class="search"><label class="sr-only" for="search">Search insights</label><input id="search" type="search" placeholder="Search" data-search-input></div>
    </div>
    <div class="grid grid-3" data-post-grid>${posts.map((p, i) => insightCard(p, i)).join('')}</div>
    <p class="empty-state" data-empty hidden>Nothing matches. Clear the filter or try another word.</p>
  </div>
</section>
${contactBand(site)}
`;
  return layout({ site, title: 'Insights', description: 'Articles on Indian trademark prosecution, oppositions, enforcement and licensing from Vidiksha IP.', path: '/insights/', body });
}

function post({ site, posts, practices }, p) {
  const more = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
  const related = practices.filter((x) => (x.categories || []).includes(p.category));
  const body = `
${pageHead({ cls: 'page-head-article', title: esc(p.title), lede: esc(p.description), crumbs: [{ label: 'Insights', href: '/insights/' }, { label: p.category }], extra: `<div class="card-meta reveal"><span class="tag">${esc(p.category)}</span><time datetime="${esc(p.date)}">${fmtDate(p.date)}</time><span>${p.readingTime} min read</span></div>` })}
<article class="section section-tight">
  <div class="container container-narrow">
    <div class="prose reveal">${p.html}</div>
    <div class="article-foot reveal">
      <p>Published ${fmtDate(p.date)} by ${esc(p.author)}. This article is general information about Indian trademark law and practice. It is not legal advice and does not create a lawyer–client relationship.</p>
      ${related.length ? `<div class="article-related">${related.map((x) => `<a href="${esc(x.url)}">${esc(x.title)}</a>`).join('')}</div>` : ''}
    </div>
  </div>
</article>
${more.length ? `<section class="section section-alt" aria-labelledby="more-title">
  <div class="container">
    ${sectionHead('Insights', '<span id="more-title">More from the practice</span>', { href: '/insights/', label: 'All insights' })}
    <div class="grid grid-3">${more.map((x, i) => insightCard(x, i)).join('')}</div>
  </div>
</section>` : ''}
${contactBand(site)}
`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description, datePublished: p.date, author: { '@type': 'Organization', name: p.author }, publisher: { '@type': 'Organization', name: site.name }, mainEntityOfPage: site.url.replace(/\/$/, '') + p.url, articleSection: p.category };
  return layout({ site, title: p.title, description: p.description, path: p.url, body, type: 'article', jsonLd });
}

/* ---------------- About ---------------- */
function about({ site }) {
  const a = site.about;
  const body = `
${pageHead({ eyebrow: a.eyebrow, title: esc(a.title), lede: esc(a.lede), crumbs: [{ label: 'The Firm' }] })}
<section class="section section-tight">
  <div class="container container-narrow prose prose-about reveal">
    ${a.story.map((t) => `<p>${t}</p>`).join('\n')}
  </div>
</section>
<section class="section section-alt" aria-labelledby="val-title">
  <div class="container">
    ${sectionHead(esc(a.values.eyebrow), `<span id="val-title">${esc(a.values.title)}</span>`)}
    ${stepsHtml(a.values.items, { light: true })}
  </div>
</section>
<section class="section section-navy" aria-labelledby="eng-title">
  <div class="container">
    ${sectionHead(esc(a.engagement.eyebrow), `<span id="eng-title">${esc(a.engagement.title)}</span>`)}
    ${stepsHtml(a.engagement.items, { numerals: 'arabic' })}
  </div>
</section>
<section class="section" aria-labelledby="sec2-title">
  <div class="container sectors">
    <div class="reveal"><p class="eyebrow">${esc(site.sectors.eyebrow)}</p><h2 id="sec2-title">${esc(site.sectors.title)}</h2><p>${esc(site.sectors.text)}</p></div>
    <ul class="sector-list reveal" style="--d:0.1s">${site.sectors.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
</section>
${contactBand(site)}
`;
  return layout({ site, title: 'The Firm', description: `About ${site.name}: a boutique trademark law firm in India that does trademark work and nothing else.`, path: '/about/', body });
}

/* ---------------- Contact ---------------- */
function contact({ site }) {
  const offices = (site.offices || []).filter((o) => o && (o.city || o.address));
  const body = `
${pageHead({ eyebrow: 'Contact', title: 'Tell us about the mark.', lede: 'A short description of the brand, the goods or services and the question is enough to begin. We reply within one working day.', crumbs: [{ label: 'Contact' }] })}
<section class="section section-tight">
  <div class="container contact-layout">
    <div class="reveal">${contactForm(site)}</div>
    <aside class="contact-side reveal" style="--d:0.1s">
      <div><h2>Email</h2><p><a class="big" href="mailto:${esc(site.email)}">${esc(site.email)}</a></p></div>
      ${site.phone ? `<div><h2>Telephone</h2><p><a class="big" href="tel:${esc(site.phone.replace(/\s+/g, ''))}">${esc(site.phone)}</a></p></div>` : ''}
      ${offices.map((o) => `<div><h2>${esc(o.city || 'Office')}</h2><address>${esc(o.address || '').replace(/\n/g, '<br>')}</address></div>`).join('')}
      <div><h2>Hours</h2><p class="muted">Monday to Friday, 10:00 to 19:00 IST. Urgent enforcement matters are attended to outside these hours.</p></div>
      <div><h2>Instructing us from abroad</h2><p class="muted">We act on instructions from law firms, IP agencies and in-house teams outside India, and report in the format your docketing requires.</p></div>
      <div><h2>Confidentiality</h2><p class="muted">Please do not send confidential documents until we have confirmed that there is no conflict of interest.</p></div>
    </aside>
  </div>
</section>
`;
  return layout({ site, title: 'Contact', description: `Contact ${site.name} about a trademark matter in India or abroad.`, path: '/contact/', body });
}

function notFound({ site }) {
  const body = `
${pageHead({ eyebrow: 'Error 404', title: 'That page is not on the register.', lede: 'The address may have changed, or the page may never have existed.' })}
<section class="section section-tight">
  <div class="container"><div class="cta-row" style="margin-top:0"><a class="btn btn-navy" href="/">Home</a><a class="btn btn-outline" href="/expertise/">Expertise</a><a class="btn btn-outline" href="/contact/">Contact</a></div></div>
</section>
`;
  return layout({ site, title: 'Page not found', description: 'The page you were looking for does not exist.', path: '/404.html', body });
}

module.exports = { home, expertiseIndex, expertise, peopleIndex, person, insightsIndex, post, about, contact, notFound, CATEGORIES };
