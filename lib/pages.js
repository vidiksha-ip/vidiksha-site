// Page renderers. Each returns a full HTML document via layout().
'use strict';
const { esc, fmtDate, fmtDateTime, fmtDuration, inr, layout, sectionHead, postCard, courseCard, webinarCard, newsletter } = require('./html');

const CATEGORIES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Licensing'];

function contactForm(site) {
  return `<form class="form form-stack" action="${esc(site.formEndpoint)}" method="post" data-form="contact">
    <input type="hidden" name="form" value="contact">
    <div class="form-row">
      <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" type="text" required autocomplete="name"></div>
      <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required autocomplete="email"></div>
    </div>
    <div class="field"><label for="c-topic">What is this about?</label>
      <select id="c-topic" name="topic">
        <option>A course</option><option>A live training session</option><option>Training for my team or firm</option><option>Something I read on the blog</option><option>Something else</option>
      </select>
    </div>
    <div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="6" required placeholder="Tell us what you are trying to do. The more specific, the better the answer."></textarea></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Send message</button><p class="form-status" role="status" aria-live="polite"></p></div>
  </form>`;
}

/* ---------------- Home ---------------- */
function home({ site, posts, courses, webinars, research }) {
  const featured = courses.find((c) => c.featured) || courses[0];
  const next = webinars.upcoming[0];
  const body = `
<section class="hero">
  <div class="container">
    <div class="hero-grid">
      <h1 class="display reveal">${site.hero.title}</h1>
      <div class="hero-side reveal">
        <p class="lede">${esc(site.hero.lede)}</p>
        <div class="cta-row">
          <a class="btn btn-primary btn-lg" href="${site.cta.href}">${esc(site.cta.label)}</a>
          ${next ? `<a class="link-arrow" href="/live-training/">Next live training session, ${fmtDate(next.datetime.slice(0, 10))}</a>` : ''}
        </div>
      </div>
    </div>
    <div class="hero-visual reveal" aria-hidden="true">
      <div class="workspace">
        <div class="ws-side">
          <div class="ws-brand">${esc(site.name)}</div>
          <div class="ws-label">Trademark Prosecution</div>
          <ul>
            <li>03 · Reading the examination report</li>
            <li class="is-active">04 · Section 9: absolute grounds</li>
            <li>05 · Section 11: relative grounds</li>
            <li>06 · The show-cause hearing</li>
          </ul>
          <div class="ws-label">Your drafts</div>
          <ul>
            <li>Reply to examination report <span>draft 2</span></li>
            <li>Affidavit of use <span>draft 1</span></li>
          </ul>
        </div>
        <div class="ws-main">
          <div class="ws-toolbar"><span>Exercise 4.5 · Examination report, Class 30</span><span class="ws-pill">Reply due in 30 days</span></div>
          <div class="ws-doc">
            <p class="ws-doc-meta">Trade Marks Registry · Examination report · Application no. 6274981</p>
            <h4>Objection under Section 9(1)(b)</h4>
            <p>The mark applied for consists exclusively of words which serve in trade to designate the kind, quality and intended purpose of the goods. <mark>Being a descriptive and laudatory expression, the mark is not capable of distinguishing</mark> the goods of the applicant from those of other traders, and is therefore open to objection.</p>
            <div class="ws-notes">
              <div class="ws-note"><span>Route</span>Acquired distinctiveness under the proviso to s. 9(1)</div>
              <div class="ws-note"><span>Evidence</span>Affidavit of use, seven annexures, indexed by paragraph</div>
              <div class="ws-note"><span>Fallback</span>Disclaimer on the descriptive element; request a hearing</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="offer-title">
  <div class="container">
    ${sectionHead('Three ways in', '<span id="offer-title">One method. Read it, build it, watch it done.</span>', null, { center: true, lede: 'Every article, course and live session starts from a real document and ends with a draft you wrote. Pick the depth you need.' })}
    <div class="offerings">
      <a class="offer offer-green reveal" href="/blog/">
        <p class="eyebrow">Blog</p>
        <h3>Read the method</h3>
        <p>Practical articles that start from an examination report, a licence or a discrepancy letter and end with the reply. Free, weekly.</p>
        <span class="btn btn-sm">Read the blog</span>
        <p class="offer-meta">${posts.length} articles · Trademark, Patent, Copyright, Design, Licensing</p>
      </a>
      <a class="offer offer-olive reveal" href="/courses/">
        <p class="eyebrow">Courses</p>
        <h3>Build the skill</h3>
        <p>Self-paced courses on real filings, with drafting exercises, model answers and the templates we use in practice.</p>
        <span class="btn btn-sm">Browse courses</span>
        <p class="offer-meta">${courses.length} courses · ${inr(Math.min(...courses.map((c) => c.price)))} to ${inr(Math.max(...courses.map((c) => c.price)))} inaugural · recorded sessions, templates, exercises</p>
      </a>
      <a class="offer offer-slate reveal" href="/live-training/">
        <p class="eyebrow">Live Training Sessions</p>
        <h3>Watch it done live</h3>
        <p>Three-hour live training sessions on a real Registry examination report, drafting the response on screen. Replay for every session and a Certificate of Training on completion.</p>
        <span class="btn btn-sm">See the sessions</span>
        <p class="offer-meta">${next ? `Next: ${fmtDate(next.datetime.slice(0, 10))}` : 'Next session to be announced'}${webinars.past.length ? ` · ${webinars.past.length} replays` : ' · On Microsoft Teams'}</p>
      </a>
    </div>
  </div>
</section>

<section class="research-band reveal" aria-labelledby="rb-title">
  <div class="container research-band-inner">
    <div>
      <p class="eyebrow">Research</p>
      <h2 id="rb-title">${research.total.toLocaleString('en-IN')} IP judgments, searchable. Newest first.</h2>
      <p>Supreme Court and High Court decisions under the Trade Marks, Patents, Copyright, Designs and GI statutes. Full-text search, relevant paragraphs and the official PDFs. Free, no account needed.</p>
    </div>
    <a class="btn btn-primary" href="/research/">Open the case law repository</a>
  </div>
</section>

<section class="section section-dark compare-section" aria-labelledby="compare-title">
  <div class="container">
    ${sectionHead('Why we are different', '<span id="compare-title">Everyone else teaches you about IP law. We teach you to do it.</span>', null, { center: true })}
    <div class="compare reveal" role="table" aria-label="Theory versus practice">
      <div class="compare-head" role="row"><div role="columnheader">What they teach</div><div role="columnheader">What you will do here</div></div>
      ${site.compare.map((r) => `<div class="compare-row" role="row"><div class="compare-theory" role="cell">${esc(r.theory)}</div><div class="compare-practice" role="cell">${esc(r.practice)}</div></div>`).join('\n      ')}
    </div>
    <p class="compare-note reveal">${esc(site.compareNote)}</p>
  </div>
</section>

<section class="section" aria-labelledby="featured-title">
  <div class="container">
    ${sectionHead('Featured course', `<span id="featured-title">${esc(featured.title)}</span>`, { href: '/courses/', label: 'All courses' })}
    <div class="featured reveal">
      <div class="featured-main">
        <p class="featured-sub">${esc(featured.subtitle)}</p>
        <p>${esc(featured.summary)}</p>
        <h3 class="h-small">After this course you will be able to</h3>
        <ul class="check-list">${featured.outcomes.slice(0, 4).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
        <div class="cta-row">
          <a class="btn btn-primary" href="${featured.url}">See the curriculum</a>
          <span class="price">${inr(featured.price)} <span class="price-note">inaugural price · ${esc(featured.level)} · ${esc(featured.duration)}</span></span>
        </div>
      </div>
      <aside class="featured-side">
        <p class="eyebrow">What is inside</p>
        <ul class="plain-list">${featured.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </aside>
    </div>
  </div>
</section>

<section class="section section-alt" aria-labelledby="latest-title">
  <div class="container">
    ${sectionHead('From the blog', '<span id="latest-title">Articles you can use at your desk tomorrow</span>', { href: '/blog/', label: 'All articles' })}
    <div class="grid grid-3">${posts.slice(0, 3).map((p) => postCard(p)).join('\n')}</div>
  </div>
</section>

<section class="section" aria-labelledby="webinar-title">
  <div class="container">
    ${sectionHead('Next live training session', '<span id="webinar-title">Current law, worked on screen</span>', { href: '/live-training/', label: webinars.past.length ? 'All sessions and replays' : 'All sessions' })}
    ${next ? `<div class="next-webinar reveal">
      <div class="next-webinar-date"><span class="nw-day">${Number(next.datetime.slice(8, 10))}</span><span class="nw-month">${fmtDate(next.datetime.slice(0, 10)).split(' ').slice(1).join(' ')}</span></div>
      <div class="next-webinar-body">
        <div class="card-meta"><span class="tag">${esc(next.area)}</span><span>${fmtDuration(next.duration)}</span><span>Live on Microsoft Teams</span></div>
        <h3>${esc(next.title)}</h3>
        <p>${esc(next.summary)}</p>
        ${next.format || next.certificate ? `<ul class="session-points">${next.format ? `<li>${esc(next.format)}</li>` : ''}${next.certificate ? `<li>${esc(next.certificate)}</li>` : ''}</ul>` : ''}
        <p class="webinar-when"><time datetime="${next.datetime}">${fmtDateTime(next.datetime, next.duration)}</time></p>
        <a class="btn btn-primary" href="${esc(next.registerUrl)}">Register${next.price ? ` · ${inr(next.price)} inaugural` : ' · Free'}</a>
      </div>
    </div>` : `<p class="reveal">No live session is scheduled right now. ${webinars.past.length ? '<a href="/live-training/">Watch a replay</a> or <a href="/contact/">subscribe</a>' : '<a href="/contact/">Subscribe</a>'} to hear about the next one.</p>`}
  </div>
</section>

${newsletter(site)}
`;
  return layout({ site, title: site.tagline, description: site.description, path: '/', body, bodyClass: 'page-home',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: site.url, email: site.email, description: site.description, sameAs: Object.values(site.social) } });
}

/* ---------------- Blog ---------------- */
function blogIndex({ site, posts }) {
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Blog</p>
    <h1>Articles about doing IP work, not describing it.</h1>
    <p class="lede">Each piece starts from a real document: an examination report, a licence, a discrepancy letter. Read it, then go draft.</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container">
    <div class="filter-bar" data-filter-bar>
      <div class="chips" role="group" aria-label="Filter by category">
        <button class="chip is-active" type="button" data-filter="all" aria-pressed="true">All</button>
        ${CATEGORIES.map((c) => `<button class="chip" type="button" data-filter="${c}" aria-pressed="false">${c}</button>`).join('')}
      </div>
      <label class="search"><span class="sr-only">Search articles</span><input type="search" placeholder="Search articles" data-search-input></label>
    </div>
    <div class="grid grid-3" data-post-grid>${posts.map((p) => postCard(p)).join('\n')}</div>
    <p class="empty-state" data-empty hidden>Nothing matches that. Try a broader word, or <a href="/contact/">tell us what you wanted to read</a>.</p>
  </div>
</section>
${newsletter(site)}
`;
  return layout({ site, title: 'Blog', description: 'Practical articles on Indian trademark, patent, copyright, design and licensing work. Objection replies, examination reports, licences and filings, explained by doing.', path: '/blog/', body });
}

function post({ site, posts, courses }, p) {
  const related = posts.filter((x) => x.slug !== p.slug && x.category === p.category).slice(0, 3);
  const fallback = posts.filter((x) => x.slug !== p.slug && !related.includes(x)).slice(0, 3 - related.length);
  const course = courses.find((c) => c.slug === p.course) || courses.find((c) => c.area === p.category);
  const body = `
<article class="post">
  <header class="page-head page-head-article">
    <div class="container container-narrow">
      <p class="card-meta"><a class="tag" href="/blog/?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a><span>${p.readingTime} min read</span><time datetime="${p.date}">${fmtDate(p.date)}</time></p>
      <h1>${esc(p.title)}</h1>
      <p class="lede">${esc(p.description)}</p>
    </div>
  </header>
  <div class="container container-narrow prose">
    ${p.html}
  </div>
  ${course ? `<aside class="container container-narrow">
    <div class="post-cta reveal">
      <p class="eyebrow">Go further</p>
      <h2>${esc(course.title)}</h2>
      <p>${esc(course.summary)}</p>
      <a class="btn btn-primary" href="${course.url}">See the curriculum · ${inr(course.price)} inaugural</a>
    </div>
  </aside>` : ''}
</article>
<section class="section section-alt" aria-labelledby="more-title">
  <div class="container">
    ${sectionHead('Keep reading', '<span id="more-title">More like this</span>', { href: '/blog/', label: 'All articles' })}
    <div class="grid grid-3">${[...related, ...fallback].map((x) => postCard(x)).join('\n')}</div>
  </div>
</section>
${newsletter(site)}
`;
  return layout({ site, title: p.title, description: p.description, path: p.url, body, type: 'article', bodyClass: 'page-post',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description, datePublished: p.date, author: { '@type': 'Organization', name: site.name }, publisher: { '@type': 'Organization', name: site.name }, mainEntityOfPage: site.url.replace(/\/$/, '') + p.url, articleSection: p.category, wordCount: p.words } });
}

/* ---------------- Courses ---------------- */
function coursesIndex({ site, courses }) {
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Courses</p>
    <h1>Self-paced courses built around real filings.</h1>
    <p class="lede">Every course is a sequence of drafting exercises on actual documents, with model answers and the templates we use in practice. Watch, draft, compare, repeat. ${inr(Math.min(...courses.map((c) => c.price)))} to ${inr(Math.max(...courses.map((c) => c.price)))} at inaugural prices, paid once.</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container">
    <div class="grid grid-2">${courses.map((c) => courseCard(c, { featured: c.featured })).join('\n')}</div>
  </div>
</section>
<section class="section section-alt" aria-labelledby="how-title">
  <div class="container">
    ${sectionHead('How a course works', '<span id="how-title">Watch less. Draft more.</span>')}
    <div class="grid grid-3 steps">
      ${site.howCourses.map((s, i) => `<div class="step reveal"><span class="step-num">0${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('\n')}
    </div>
  </div>
</section>
<section class="section" aria-labelledby="faq-title">
  <div class="container container-narrow">
    ${sectionHead('Questions', '<span id="faq-title">Before you enrol</span>')}
    <div class="faq reveal">
      ${site.courseFaq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}
    </div>
  </div>
</section>
${newsletter(site)}
`;
  return layout({ site, title: 'Courses', description: 'Self-paced IP law courses in INR built around real trademark, patent, copyright, design and licensing work. Drafting exercises, templates and model answers.', path: '/courses/', body });
}

function course({ site, courses, posts }, c) {
  const lessons = c.modules.reduce((n, m) => n + m.lessons.length, 0);
  const related = posts.filter((p) => p.course === c.slug || p.category === c.area).slice(0, 3);
  const others = courses.filter((x) => x.slug !== c.slug).slice(0, 2);
  const body = `
<section class="page-head course-head">
  <div class="container">
    <p class="card-meta"><a class="tag" href="/courses/">${esc(c.area)}</a><span>${esc(c.level)}</span><span>${esc(c.duration)}</span><span>${c.modules.length} ${esc(c.unit || 'modules')}${c.unitNote ? `, ${esc(c.unitNote)}` : ''} · ${lessons} lessons</span></p>
    <h1>${esc(c.title)}</h1>
    <p class="lede">${esc(c.subtitle)}</p>
  </div>
</section>
<div class="container course-layout">
  <div class="course-main">
    <section class="course-block reveal" aria-labelledby="do-title">
      <h2 id="do-title">What you will actually be able to do after this</h2>
      <ul class="check-list check-list-big">${c.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
    </section>
    <section class="course-block reveal" aria-labelledby="about-title">
      <h2 id="about-title">About the course</h2>
      ${c.about.map((p) => `<p>${esc(p)}</p>`).join('\n')}
    </section>
    <section class="course-block reveal" aria-labelledby="curr-title">
      <h2 id="curr-title">Curriculum</h2>
      ${c.unit === 'sessions' ? `<p class="muted">${c.modules.length} sessions${c.unitNote ? `, ${esc(c.unitNote)}` : ''}. Each ends with a practice exercise that comes with a model answer.</p>` : ''}
      <div class="curriculum">
        ${c.modules.map((m, i) => `<details${i === 0 ? ' open' : ''}>
          <summary><span class="mod-num">${String(i + 1).padStart(2, '0')}</span><span class="mod-title">${esc(m.title)}</span><span class="mod-count">${c.unit === 'sessions' ? '2 hours · ' : ''}${m.lessons.length} lessons</span></summary>
          <ol class="lessons">${m.lessons.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
        </details>`).join('\n')}
      </div>
    </section>
    ${c.kit ? `<section class="course-block reveal" aria-labelledby="kit-title">
      <h2 id="kit-title">${esc(c.kit.title)}, at your doorstep</h2>
      ${c.kit.intro ? `<p>${esc(c.kit.intro)}</p>` : ''}
      <ol class="kit-list">${c.kit.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
    </section>` : ''}
    <section class="course-block reveal" aria-labelledby="who-title">
      <h2 id="who-title">Who this is for</h2>
      <div class="grid grid-2 who">
        <div><h3 class="h-small">Take it if</h3><ul class="check-list">${c.whoFor.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
        <div><h3 class="h-small">Skip it if</h3><ul class="x-list">${c.notFor.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
      </div>
    </section>
    ${c.faq && c.faq.length ? `<section class="course-block reveal" aria-labelledby="cfaq-title">
      <h2 id="cfaq-title">Questions</h2>
      <div class="faq">${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}</div>
    </section>` : ''}
  </div>
  <aside class="course-side">
    <div class="enrol-card reveal">
      <p class="eyebrow">Inaugural price</p>
      <p class="price price-big">${inr(c.price)}</p>
      <p class="price-note">One-time payment · ${esc(c.access || 'Lifetime access')} · GST included</p>
      ${c.enrolOpen ? `<a class="btn btn-primary btn-block" href="${esc(c.enrolUrl)}">Enrol now</a>
      <p class="enrol-fine">Pay by UPI, card or net banking through Razorpay. 14-day refund if you have completed fewer than two ${c.unit === 'sessions' ? 'sessions' : 'modules'}.</p>` : `<a class="btn btn-ghost btn-block" href="/contact/">Ask about this course</a>
      <p class="enrol-fine">Enrolment for this course opens soon. Write to us to be told first.</p>`}
      <h3 class="h-small">Included</h3>
      <ul class="plain-list">${c.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>
  </aside>
</div>
${related.length ? `<section class="section section-alt" aria-labelledby="rel-title">
  <div class="container">
    ${sectionHead('Read first', '<span id="rel-title">Free articles from this course\'s territory</span>', { href: '/blog/', label: 'All articles' })}
    <div class="grid grid-3">${related.map((p) => postCard(p)).join('\n')}</div>
  </div>
</section>` : ''}
<section class="section" aria-labelledby="other-title">
  <div class="container">
    ${sectionHead('Other courses', '<span id="other-title">Build the next skill</span>', { href: '/courses/', label: 'All courses' })}
    <div class="grid grid-2">${others.map((x) => courseCard(x)).join('\n')}</div>
  </div>
</section>
`;
  return layout({ site, title: c.title, description: c.subtitle, path: c.url, body, bodyClass: 'page-course',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Course', name: c.title, description: c.subtitle, provider: { '@type': 'Organization', name: site.name, url: site.url },
      offers: { '@type': 'Offer', price: c.price, priceCurrency: 'INR', url: site.url.replace(/\/$/, '') + c.url, availability: 'https://schema.org/InStock' },
      hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: c.duration } } });
}

/* ---------------- Webinars ---------------- */
function webinars({ site, webinars, testimonials }) {
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Live Training Sessions</p>
    <h1>Live training on what the Registry and the Patent Office are doing right now.</h1>
    <p class="lede">Three hours on Microsoft Teams, 4 pm to 7 pm IST, drafting live on a real Registry examination report. Every session is recorded, registrants get the replay, the slides and the templates shown, and a Certificate of Training is issued on successful completion.</p>
  </div>
</section>
<section class="section section-tight" aria-labelledby="up-title">
  <div class="container">
    ${sectionHead('Upcoming', '<span id="up-title">Register for a live session</span>')}
    ${webinars.upcoming.length ? `<div class="grid grid-2">${webinars.upcoming.map((w) => webinarCard(w)).join('\n')}</div>` : `<p class="reveal">Nothing is scheduled right now. Subscribe below and you will hear first.</p>`}
  </div>
</section>
<section class="section section-alt" aria-labelledby="past-title">
  <div class="container">
    ${sectionHead('Replays', '<span id="past-title">Past sessions</span>')}
    ${webinars.past.length ? `<div class="grid grid-3">${webinars.past.map((w) => webinarCard(w, { past: true })).join('\n')}</div>` : `<p class="reveal">Recordings will appear here after the first session. Every session is recorded, and registrants get the replay within 24 hours.</p>`}
  </div>
</section>
${(testimonials || []).length ? `<section class="section" aria-labelledby="say-title">
  <div class="container">
    ${sectionHead('From past sessions', '<span id="say-title">What participants say</span>')}
    <div class="grid grid-3 testimonials">${testimonials.slice(0, 9).map((t) => `<figure class="testimonial reveal"><blockquote><p>${esc(t.text)}</p></blockquote><figcaption><strong>${esc(t.name)}</strong>${t.profession || t.organisation ? `<span>${esc([t.profession, t.organisation].filter(Boolean).join(', '))}</span>` : ''}<span class="muted">${esc(t.session)}</span>${t.linkedin ? `<a href="${esc(t.linkedin)}" rel="noopener" target="_blank">LinkedIn</a>` : ''}</figcaption></figure>`).join('')}</div>
  </div>
</section>` : ''}
<section class="section" aria-labelledby="wfaq-title">
  <div class="container container-narrow">
    ${sectionHead('How the sessions work', '<span id="wfaq-title">What to expect</span>')}
    <div class="faq reveal">${site.webinarFaq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n')}</div>
  </div>
</section>
${newsletter(site)}
`;
  return layout({ site, title: 'Live Training Sessions', description: 'Live training sessions on current Indian IP law developments, worked through on real documents, with replays for every session.', path: '/live-training/', body });
}

/* ---------------- Course enrolment (Razorpay) ---------------- */
const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
function enrol({ site }, c) {
  const professions = ['Law student', 'Junior lawyer', 'IP practitioner', 'In-house counsel', 'Startup founder', 'Patent or trademark agent', 'Academic', 'Other'];
  const paymentsUrl = site.supabase.url ? `${site.supabase.url.replace(/\/$/, '')}/functions/v1/payments` : '';
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Enrol</p>
    <h1>${esc(c.title)}</h1>
    <p class="lede">${inr(c.price)} inaugural price, paid once · ${esc(c.duration)} · ${esc(c.access || 'Lifetime access')}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container register-layout">
    <div class="register-info reveal">
      <h2 class="h-small" style="margin-top:0">What you get</h2>
      <ul class="check-list">${c.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      ${c.kit ? `<h2 class="h-small">${esc(c.kit.title)}</h2><p class="muted">Delivered to the postal address you give below, within India.</p><ol class="kit-list">${c.kit.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>` : ''}
      <h2 class="h-small">Payment</h2>
      <p class="muted">Payment is taken by Razorpay: UPI, cards, net banking and wallets. Prices include GST; Razorpay emails the receipt. Fourteen-day refund if you have completed fewer than two sessions.</p>
    </div>
    <div class="gate-card reveal" data-enrol data-course-slug="${esc(c.slug)}" data-course-title="${esc(c.title)}" data-payments-url="${esc(paymentsUrl)}" data-supabase-key="${esc(site.supabase.anonKey)}" data-portal="${esc(site.portalUrl || 'https://portal.vidiksha.in')}">
      <form class="form form-stack" data-enrol-form autocomplete="on" novalidate>
        <div class="field"><label for="en-name">Full name</label><input id="en-name" name="full_name" type="text" required autocomplete="name"></div>
        <div class="field"><label for="en-email">Email ID</label><input id="en-email" name="email" type="email" required autocomplete="email" placeholder="Receipt, recordings and support go here"></div>
        <div class="field"><label for="en-whatsapp">WhatsApp number</label><input id="en-whatsapp" name="whatsapp" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+91 98765 43210"></div>
        <div class="form-row">
          <div class="field"><label for="en-profession">Profession</label>
            <select id="en-profession" name="profession" required><option value="">Choose one</option>${professions.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="en-org">Organisation</label><input id="en-org" name="organisation" type="text" autocomplete="organization" placeholder="Firm, company or college"></div>
        </div>
        <div class="field"><label for="en-address">Postal address for the IP Prosecution Kit</label><textarea id="en-address" name="address_line" rows="3" required autocomplete="street-address" placeholder="House or flat, building, street, locality"></textarea></div>
        <div class="form-row">
          <div class="field"><label for="en-city">City</label><input id="en-city" name="city" type="text" required autocomplete="address-level2"></div>
          <div class="field"><label for="en-state">State</label><input id="en-state" name="state" type="text" required list="en-states" autocomplete="address-level1"><datalist id="en-states">${INDIAN_STATES.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></div>
        </div>
        <div class="form-row">
          <div class="field"><label for="en-pin">PIN code</label><input id="en-pin" name="pincode" type="text" required inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="postal-code"></div>
          <div class="field"></div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Proceed to payment · ${inr(c.price)}</button></div>
        <p class="form-status" data-enrol-status role="status" aria-live="polite"></p>
        <p class="form-fine">Your details are saved when you proceed and recorded in our enrolment register only after the payment succeeds. If this email already has a VIDIKSHA account, the course is added to it and you sign in with your existing details; otherwise the account is created on payment and the welcome email carries your login details, with the tax invoice and receipt. Nothing on this site is legal advice.</p>
      </form>
      <div class="register-done" data-enrol-done hidden>
        <p class="eyebrow">You are enrolled</p>
        <h2 class="h-reg">Welcome to ${esc(c.title)}.</h2>
        <p data-enrol-done-text></p>
        <p><a class="btn btn-primary btn-sm" href="${esc(site.portalUrl || 'https://portal.vidiksha.in')}" target="_blank" rel="noopener">Open the learning portal</a> <a class="btn btn-ghost btn-sm" href="${c.url}">Back to the course</a></p>
      </div>
    </div>
  </div>
</section>
`;
  return layout({ site, title: `Enrol: ${c.title}`, description: `Enrol in ${c.title} for ${inr(c.price)}: ${c.summary}`, path: c.enrolUrl, body, bodyClass: 'page-enrol', scripts: ['https://checkout.razorpay.com/v1/checkout.js', '/assets/enrol.js'] });
}

/* ---------------- Live training registration ---------------- */
function register({ site }, w) {
  const when = fmtDateTime(w.datetime, w.duration);
  const date = w.datetime.slice(0, 10);
  const price = w.price ? `${inr(w.price)} inaugural` : 'Free';
  const professions = ['Law student', 'Junior lawyer', 'IP practitioner', 'In-house counsel', 'Startup founder', 'Patent or trademark agent', 'Academic', 'Other'];
  const qualifications = ['LLB (3-year)', 'BA LLB / BBA LLB / B.Com LLB (5-year)', 'LLM', 'PhD', 'B.Tech / B.E. / B.Sc.', 'M.Tech / M.Sc. / M.Pharm', 'CA / CS / CMA', 'MBA', 'Other'];
  const registerUrl = site.supabase.url ? `${site.supabase.url.replace(/\/$/, '')}/functions/v1/payments/register-session` : '';
  const whatsapp = w.whatsappGroup || site.trainingWhatsappGroup || '';
  const portal = site.portalUrl || 'https://portal.vidiksha.in';
  const pw = (id, name, label, placeholder) => `<div class="field"><label for="${id}">${label}</label><div class="password-wrap"><input id="${id}" name="${name}" type="password" required autocomplete="new-password" minlength="8" placeholder="${placeholder}"><button type="button" class="password-toggle" data-password-toggle aria-pressed="false" aria-label="Show password">Show</button></div></div>`;
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Register · Live training</p>
    <h1>${esc(w.title)}</h1>
    <p class="lede"><time datetime="${w.datetime}">${when}</time> · ${fmtDuration(w.duration)} on ${esc(w.platform || 'Microsoft Teams')} · ${price}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container register-layout">
    <div class="register-info reveal">
      <h2 class="h-small" style="margin-top:0">What this session is</h2>
      <p>${esc(w.summary)}</p>
      <ul class="check-list">
        ${w.format ? `<li>${esc(w.format)}</li>` : ''}
        ${w.certificate ? `<li>${esc(w.certificate)}</li>` : ''}
        <li>Recording in your learning portal after the session</li>
        <li>Teams link and reminders in the session's WhatsApp group</li>
      </ul>
      <h2 class="h-small">Your learning portal account</h2>
      <p class="muted">Registering creates your account on <a href="${esc(portal)}">${esc(portal.replace(/^https?:\/\//, ''))}</a> with the password you set below. After the session the recording appears there; share your feedback and download your participation certificate from the same place. Course purchases made with this email land in the same account.</p>
    </div>
    <div class="gate-card reveal" data-register data-session-slug="${esc(w.slug)}" data-session-title="${esc(w.title)}" data-session-date="${date}" data-register-url="${esc(registerUrl)}" data-supabase-key="${esc(site.supabase.anonKey)}" data-portal="${esc(portal)}">
      <form class="form form-stack" data-register-form autocomplete="on" novalidate>
        <div class="field"><label for="rg-name">Full name</label><input id="rg-name" name="full_name" type="text" required autocomplete="name" placeholder="As it should appear on the certificate"></div>
        <div class="field"><label for="rg-email">Email ID</label><input id="rg-email" name="email" type="email" required autocomplete="email" placeholder="Your portal login"></div>
        <div class="field"><label for="rg-whatsapp">WhatsApp number</label><input id="rg-whatsapp" name="whatsapp" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+91 98765 43210" pattern="^\\+?[0-9][0-9 \\-]{7,16}$"></div>
        <div class="form-row">
          <div class="field"><label for="rg-profession">Profession</label>
            <select id="rg-profession" name="profession" required><option value="">Choose one</option>${professions.map((p) => `<option>${esc(p)}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="rg-qualification">Academic qualification</label>
            <select id="rg-qualification" name="qualification" required><option value="">Choose one</option>${qualifications.map((q) => `<option>${esc(q)}</option>`).join('')}</select>
          </div>
        </div>
        ${pw('rg-password', 'password', 'Set password', 'At least 8 characters')}
        ${pw('rg-confirm', 'confirm', 'Confirm password', 'Type it again')}
        <div class="form-actions"><button class="btn btn-primary" type="submit">Reserve my seat${w.price ? ` · ${inr(w.price)}` : ''}</button></div>
        <p class="form-status" data-register-status role="status" aria-live="polite"></p>
        <p class="form-fine">Already have a VIDIKSHA account? Use its email and password and the seat is added to it. Your details go into the training register; we message you on WhatsApp only about this session. Nothing on this site is legal advice.</p>
      </form>
      <div class="register-done" data-register-done hidden>
        <p class="eyebrow">Seat reserved</p>
        <h2 class="h-reg">Thank you for registering.</h2>
        <p data-register-done-text></p>
        <p><a class="btn btn-primary" data-register-whatsapp href="${esc(whatsapp)}" target="_blank" rel="noopener" ${whatsapp ? '' : 'hidden'}>Join the WhatsApp group</a> <a class="btn btn-ghost btn-sm" href="${esc(portal)}" target="_blank" rel="noopener">Open the learning portal</a></p>
      </div>
    </div>
  </div>
</section>
`;
  return layout({ site, title: `Register: ${w.title}`, description: `Register for the live training "${w.title}" on ${when}.`, path: w.registerUrl, body, bodyClass: 'page-register', scripts: ['/assets/register.js'] });
}

/* ---------------- Research ---------------- */
function facetGroup(key, legend, items, { open = false, show = 0, hint = '' } = {}) {
  if (!items || !items.length) return '';
  const rows = items.map((it, i) => `<label${show && i >= show ? ' class="facet-more" hidden' : ''}><input type="checkbox" name="${key}" value="${esc(it.name)}"> <span class="facet-name">${esc(it.name)}</span> <span class="count" data-count-for="${key}">${it.n.toLocaleString('en-IN')}</span></label>`).join('\n');
  const more = show && items.length > show ? `<button type="button" class="facet-toggle" data-facet-toggle>Show all ${items.length}</button>` : '';
  return `<details class="filter-group"${open ? ' open' : ''} data-facet-group="${key}">
    <summary>${esc(legend)} <span class="active-n" data-active-n></span></summary>
    ${hint ? `<p class="facet-hint">${esc(hint)}</p>` : ''}
    ${rows}
    ${more}
  </details>`;
}
function research({ site, research }) {
  const m = research;
  const years = m.years.map((y) => y.y);
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Research</p>
    <h1>IP case law, searchable. Always newest first.</h1>
    <p class="lede">${m.total.toLocaleString('en-IN')} judgments of the Supreme Court and High Courts that decide questions under the Trade Marks, Patents, Copyright, Designs and Geographical Indications statutes, ${years[years.length - 1]} to ${years[0]}. Search the full text with as many keywords as you like, then narrow by legal issue, court, proceeding, outcome, bench, industry, statute or judge.</p>
  </div>
</section>
<section class="section section-tight research" data-research>
  <div class="container">
    <form class="kw-form" data-kw-form autocomplete="off">
      <label class="sr-only" for="kw-input">Add a keyword</label>
      <div class="kw-row">
        <input id="kw-input" type="search" placeholder="Add a keyword and press Enter: e.g. Section 9, passing off, Novartis, pharmaceutical" data-kw-input>
        <button class="btn btn-primary" type="submit">Add keyword</button>
      </div>
      <div class="kw-chips" data-kw-chips aria-live="polite"></div>
      <p class="kw-hint">Keywords are searched in the full text of every judgment, plus title, parties, judges, case number and citation. A phrase with spaces must have all its words in the judgment. Section references work: "section 29", "9(1)(b)", "3(d)". All keywords must match. Each result can then show the paragraphs where your keywords and chosen issues appear.</p>
    </form>
    <div class="research-layout">
      <aside class="filters" aria-label="Filters">
        ${facetGroup('area', 'Area of IP', m.facets.area, { open: true })}
        ${facetGroup('issue', 'Legal issue', m.facets.issue, { open: true, show: 10, hint: 'Detected from the judgment text' })}
        ${facetGroup('court', 'Court', m.facets.court, { open: true })}
        <details class="filter-group" open data-facet-group="years">
          <summary>Decided between <span class="active-n" data-active-n></span></summary>
          <div class="year-range">
            <label><span class="sr-only">From year</span><select name="from"><option value="">From</option>${[...years].reverse().map((y) => `<option value="${y}">${y}</option>`).join('')}</select></label>
            <label><span class="sr-only">To year</span><select name="to"><option value="">To</option>${years.map((y) => `<option value="${y}">${y}</option>`).join('')}</select></label>
          </div>
          <div class="quick-years">
            ${[['Last 12 months', '12m'], ['Since 2020', '2020'], ['2010s', '2010s'], ['Before 2010', 'pre2010']].map(([label, v]) => `<button type="button" class="chip chip-sm" data-quick-years="${v}">${label}</button>`).join('')}
          </div>
        </details>
        ${facetGroup('proc', 'Type of proceeding', m.facets.proc, { hint: 'From the registry number' })}
        ${facetGroup('outcome', 'Outcome', m.facets.outcome)}
        ${facetGroup('length', 'Length of judgment', m.facets.length, { hint: 'Brief orders are under three pages; lengthy judgments run past forty' })}
        ${facetGroup('bench', 'Bench', m.facets.bench)}
        ${facetGroup('industry', 'Industry', m.facets.industry, { show: 8, hint: 'Detected from the judgment text' })}
        ${facetGroup('statute', 'Statutes cited', m.facets.statute, { show: 8 })}
        ${facetGroup('judge', 'Coram', m.facets.judge, { show: 8, hint: 'Judges who decided the most indexed matters' })}
        <button class="btn btn-ghost btn-sm" type="button" data-clear>Clear all</button>
      </aside>
      <div class="results-col">
        <div class="results-head">
          <p class="results-count" data-count role="status" aria-live="polite">Loading the index…</p>
          <p class="results-progress" data-progress></p>
        </div>
        <div class="active-filters" data-active-filters></div>
        <ol class="results" data-results></ol>
        <p class="empty-state" data-empty hidden>No judgment matches every keyword and filter. Remove a keyword, widen the years, or try a different spelling of a party name.</p>
        <div class="results-more"><button class="btn btn-ghost" type="button" data-more hidden>Show more</button></div>
      </div>
    </div>
  </div>
</section>
<noscript><div class="container"><p class="empty-state">The case law search needs JavaScript.</p></div></noscript>
<section class="section section-alt" aria-labelledby="idx-title">
  <div class="container">
    ${sectionHead('What is indexed', '<span id="idx-title">How this repository is built</span>')}
    <div class="grid grid-3">
      <div class="step reveal"><span class="step-num">01</span><h3>Source</h3><p>Judgment text from <a href="https://github.com/Vaquill-AI/open-india-law">Open India Law</a> by Vaquill AI, snapshot v2026.08.1, licensed CC BY 4.0. The underlying judgments are government works reproduced under section 52(1)(q) of the Copyright Act.</p></div>
      <div class="step reveal"><span class="step-num">02</span><h3>Selection and tagging</h3><p>A judgment is included when any part of its text engages an IP statute, doctrine or authority, or when it carries an IP Division registry number. Legal issues, industries and statutes are detected from the text by fixed rules, and proceeding type from the registry number. No machine learning is involved, so every tag can be traced to the words that triggered it. ${m.courts.map((c) => c.name).join(', ')}.</p></div>
      <div class="step reveal"><span class="step-num">03</span><h3>Read, then verify</h3><p>Every result can show the paragraphs most relevant to your keywords and selected issues, or the whole judgment as extracted. ${m.linked ? `${m.linked.toLocaleString('en-IN')} entries link to the court's own PDF, mirrored on the AWS Open Data Registry from the eCourts and Supreme Court portals.` : ''} Check the PDF before citing. Index regenerated ${m.generated}.</p></div>
    </div>
  </div>
</section>
`;
  return layout({ site, title: 'Research', description: `Searchable repository of ${m.total.toLocaleString('en-IN')} Indian IP judgments: trademark, patent, copyright, design and GI decisions of the Supreme Court and High Courts, filterable by court, area and year, newest first. Free, no account needed.`, path: '/research/', body, bodyClass: 'page-research', scripts: ['/assets/research.js'] });
}

/* ---------------- About ---------------- */
function about({ site }) {
  const body = `
<section class="page-head">
  <div class="container container-narrow">
    <p class="eyebrow">About</p>
    <h1>${site.about.title}</h1>
  </div>
</section>
<section class="section section-tight">
  <div class="container container-narrow prose prose-about reveal">
    ${site.about.story.map((p) => `<p>${p}</p>`).join('\n')}
  </div>
</section>
<section class="section section-alt" aria-labelledby="princ-title">
  <div class="container">
    ${sectionHead('How we teach', '<span id="princ-title">Four rules we do not break</span>')}
    <div class="grid grid-2 principles">
      ${site.about.principles.map((p, i) => `<div class="principle reveal"><span class="step-num">0${i + 1}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div>`).join('\n')}
    </div>
  </div>
</section>
${newsletter(site)}
`;
  return layout({ site, title: 'About', description: 'Why VIDIKSHA exists: Indian legal education teaches IP theory and leaves practice to be learned on the job. We teach the job.', path: '/about/', body });
}

/* ---------------- Contact ---------------- */
function contact({ site }) {
  const body = `
<section class="page-head">
  <div class="container">
    <p class="eyebrow">Contact</p>
    <h1>Ask a specific question. Get a specific answer.</h1>
    <p class="lede">For course and live training queries, firm training, guest sessions, or to tell us which filing you want covered next.</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container contact-layout">
    <div class="reveal">${contactForm(site)}</div>
    <aside class="contact-side reveal">
      <h2 class="h-small">Direct</h2>
      <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a><br>Replies within two working days.</p>
      <h2 class="h-small">Training for teams</h2>
      <p>We run closed cohorts for law firms, in-house legal teams and incubators. Curriculum is built on your own matters, under NDA. <a href="mailto:${esc(site.email)}?subject=Team%20training">Email with headcount and area of practice.</a></p>
      <h2 class="h-small">Elsewhere</h2>
      <ul class="plain-list">${Object.entries(site.social).map(([k, v]) => `<li><a href="${esc(v)}" rel="me noopener">${esc(k[0].toUpperCase() + k.slice(1))}</a></li>`).join('')}</ul>
    </aside>
  </div>
</section>
${newsletter(site)}
`;
  return layout({ site, title: 'Contact', description: 'Contact VIDIKSHA about courses, live training sessions, firm training or the newsletter.', path: '/contact/', body });
}

function notFound({ site }) {
  const body = `
<section class="page-head">
  <div class="container container-narrow">
    <p class="eyebrow">404</p>
    <h1>That page was abandoned for non-prosecution.</h1>
    <p class="lede">The link is wrong or the page moved. Try the <a href="/blog/">blog</a>, the <a href="/courses/">courses</a> or <a href="/">the start</a>.</p>
  </div>
</section>`;
  return layout({ site, title: 'Page not found', description: 'Page not found.', path: '/404.html', body });
}

module.exports = { home, blogIndex, post, coursesIndex, course, enrol, webinars, register, research, about, contact, notFound };
