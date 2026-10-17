// VIDIKSHA static site build. Reads content/, writes dist/. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');
const { render, parseFrontMatter, wordCount } = require('./lib/md');
const pages = require('./lib/pages');
const { esc } = require('./lib/html');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content');
const SRC = path.join(ROOT, 'src');
// Production (GitHub Pages) builds publish only the public site. The research data is never written to dist/ there:
// it is published as static files with the site (public, no login).
// Local builds keep the data in dist/research/ so serve.js can serve it behind its own login check.
const PRODUCTION = process.argv.includes('--production') || process.env.SITE_ENV === 'production';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const listFiles = (dir, ext) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(ext) && !f.startsWith('_')).map((f) => path.join(dir, f)) : []);

function writePage(urlPath, html) {
  const file = urlPath.includes('.') ? path.join(DIST, urlPath) : path.join(DIST, urlPath, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function loadContent() {
  const site = readJSON(path.join(CONTENT, 'site.json'));

  const posts = listFiles(path.join(CONTENT, 'blog'), '.md').map((file) => {
    const { data, body } = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    const slug = data.slug || slugify(path.basename(file, '.md'));
    for (const k of ['title', 'description', 'date', 'category']) if (!data[k]) throw new Error(`${file}: front matter is missing "${k}"`);
    const words = wordCount(body);
    return {
      ...data, slug, url: `/blog/${slug}/`,
      author: data.author || site.name,
      html: render(body), words,
      readingTime: Math.max(1, Math.round(words / 220)),
    };
  }).filter((p) => !p.draft).sort((a, b) => (a.date < b.date ? 1 : -1));

  const courses = listFiles(path.join(CONTENT, 'courses'), '.json').map((file) => {
    const c = readJSON(file);
    const slug = c.slug || slugify(path.basename(file, '.json'));
    // Enrolment runs on the site's own form and Razorpay when the course sets "enrolOpen": true.
    return { ...c, slug, url: `/courses/${slug}/`, enrolUrl: `/courses/${slug}/enrol/` };
  }).sort((a, b) => (a.order || 99) - (b.order || 99));

  const now = new Date();
  const webinars = listFiles(path.join(CONTENT, 'training'), '.json').map((file) => {
    const w = readJSON(file);
    const slug = w.slug || slugify(path.basename(file, '.json'));
    // Registration happens on the site's own form unless a session names an external registration page.
    const days = Array.isArray(w.days) && w.days.length ? w.days : [{ datetime: w.datetime, duration: w.duration || 180 }];
    const last = days[days.length - 1];
    const endsAt = new Date(new Date(last.datetime).getTime() + Number(last.duration || w.duration || 180) * 60000);
    return { ...w, days, datetime: w.datetime || days[0].datetime, duration: w.duration || days[0].duration, slug, registerUrl: w.externalRegisterUrl || `/live-training/register/${slug}/`, isPast: endsAt < now };
  });
  const upcoming = webinars.filter((w) => !w.isPast).sort((a, b) => (a.datetime < b.datetime ? -1 : 1));
  const past = webinars.filter((w) => w.isPast).sort((a, b) => (a.datetime < b.datetime ? 1 : -1));

  const tFile = path.join(CONTENT, 'testimonials.json');
  const testimonials = fs.existsSync(tFile) ? readJSON(tFile) : [];   // written by the control panel from consented feedback
  return { site, posts, courses, webinars: { upcoming, past }, testimonials };
}

function copyAssets() {
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, 'assets'))) fs.copyFileSync(path.join(SRC, 'assets', f), path.join(DIST, 'assets', f));
  fs.copyFileSync(path.join(SRC, 'styles', 'main.css'), path.join(DIST, 'assets', 'main.css'));
  for (const f of fs.readdirSync(path.join(SRC, 'scripts'))) fs.copyFileSync(path.join(SRC, 'scripts', f), path.join(DIST, 'assets', f));
}

/* ---------- Research: IP case-law index ---------- */
const COURT_NAMES = {
  'supreme-court': 'Supreme Court of India', delhi: 'Delhi High Court', bombay: 'Bombay High Court', madras: 'Madras High Court',
  calcutta: 'Calcutta High Court', karnataka: 'Karnataka High Court', gujarat: 'Gujarat High Court', telangana: 'Telangana High Court',
  'andhra-pradesh': 'Andhra Pradesh High Court', kerala: 'Kerala High Court', allahabad: 'Allahabad High Court',
  'punjab-and-haryana': 'Punjab and Haryana High Court', rajasthan: 'Rajasthan High Court', 'madhya-pradesh': 'Madhya Pradesh High Court',
  chhattisgarh: 'Chhattisgarh High Court', orissa: 'Orissa High Court', patna: 'Patna High Court', jharkhand: 'Jharkhand High Court',
  gauhati: 'Gauhati High Court', 'himachal-pradesh': 'Himachal Pradesh High Court', uttarakhand: 'Uttarakhand High Court',
  'jammu-and-kashmir': 'Jammu and Kashmir High Court', tripura: 'Tripura High Court', manipur: 'Manipur High Court',
  meghalaya: 'Meghalaya High Court', sikkim: 'Sikkim High Court',
};
const SMALL = new Set(['of', 'and', 'the', 'for', 'in', 'on', 'at', 'by', 'vs', 'v', 'a', 'an', 'to']);
const ABBR = { ltd: 'Ltd', pvt: 'Pvt', llp: 'LLP', inc: 'Inc', 'm/s': 'M/s', 'm/s.': 'M/s.', co: 'Co', corp: 'Corp', gmbh: 'GmbH', ag: 'AG', sa: 'SA', ors: 'Ors', anr: 'Anr', uoi: 'UOI' };
function titleCase(s) {
  if (!s) return '';
  s = s.trim();
  if (s !== s.toUpperCase()) return s; // already mixed case
  return s.toLowerCase().split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w)) return w;
    const core = w.replace(/[.,()]/g, '');
    if (ABBR[core]) return w.replace(core, ABBR[core]);
    if (i > 0 && SMALL.has(core)) return w;
    return w.replace(/(^|[(\/&.-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }).join('');
}
function parseTitle(raw, caseNumber, petitioner, respondent) {
  let t = (raw || '').trim();
  let n = (caseNumber || '').trim();
  // Some records carry only the registry label as a title ("CIVIL APPEAL 3784 of 2004"); the parties are stored separately.
  if (!/\s(vs\.?|v\.|versus)\s/i.test(t) && petitioner && respondent) {
    if (!n) { const m0 = /\b(\d+)\s+of\s+(\d{4})\b/.exec(t); if (m0) n = `${m0[1]} of ${m0[2]}`; }
    t = `${petitioner} vs ${respondent}`;
  }
  const m = /^([A-Z][A-Z0-9().\-\/ ]*?\/\d+\/\d{4})\s+of\s+(.+)$/i.exec(t);
  if (m) { n = n || m[1]; t = m[2]; }
  t = t.replace(/\s*\((?:ORA|OA|TRA|SR)\/[^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s+(?:vs\.?|v\.|versus)\s+/i);
  const p = titleCase(parts[0] || '');
  const r = titleCase(parts.slice(1).join(' v. ') || '');
  return { title: r ? `${p} v. ${r}` : p || titleCase(raw), p, r, n };
}
/* The corpus's judges field is unreliable for some courts: it can hold counsel, addresses, or words lifted from the prayer
   ("passing off", "damages", "delivery up"). Keep only entries that read like a judge's name. */
const NOT_A_JUDGE = /\b(adv\.?|advocate|counsel|senior|sr\.|amicus|for the|trading|ltd|pvt|llp|inc|m\/s|layout|road|street|nagar|colony|floor|building|sector|phase|district|no\.|petitioner|respondent|appellant|plaintiff|defendant|applicant|state|union|government|limited|company|corporation|bank|department|commissioner|registrar|controller|industries|enterprises|private|through|represented|rep\.|by its|son of|s\/o|d\/o|w\/o|proprietor|partner|director|manager|secretary|office|chambers|court|bench|order|judgment|dated|versus|\bvs\b)\b/i;
function cleanJudges(raw) {
  const out = [];
  for (let j of raw || []) {
    j = String(j || '').trim().replace(/\s+/g, ' ');
    if (!j || /\d|\/|@|\(|\)/.test(j)) continue;                     // digits, slashes, brackets: addresses and registry text
    if (j === j.toLowerCase()) continue;                               // lower-case entries are prayer words, never names
    j = j.replace(/^(hon'?ble\s+)?(the\s+)?(justice|mr\.?|ms\.?|mrs\.?|dr\.?|smt\.?|shri\.?|sri\.?)\s*/i, '').replace(/\s*,?\s*(j\.?|jj\.?|cj\.?|acj\.?|oral|cav|\(oral\)|\(cav\))$/i, '').trim();
    if (NOT_A_JUDGE.test(j) || /\b(salai|marg|chowk|gali|bazar|bazaar|peth|mohalla)\b/i.test(j)) continue;
    j = j.replace(/\.(?=[A-Za-z]{2,})/g, '. ').replace(/\s+/g, ' ');     // "S.J.Kathawalla" -> "S.J. Kathawalla"
    const half = j.length % 2 === 1 ? j.slice(0, (j.length - 1) / 2) : '';
    if (half && j === `${half} ${half}`) j = half;                       // "Amit Bansal Amit Bansal" -> "Amit Bansal"
    const words = j.split(' ').filter(Boolean);
    if (words.length < 2 && !/\./.test(j)) continue;                   // a lone word is not a name we can trust
    if (words.length > 5 || j.length > 40) continue;
    const name = titleCase(j);
    if (!out.includes(name)) out.push(name);
    if (out.length === 5) break;
  }
  return out;
}

/* Proceeding type from the registry number and cause title. First match wins; order matters. */
const PROCEEDINGS = [
  ['Appeal from the Registrar or Controller', /IPD[A-Z]*(TM|PT|AID|CR|GI)|COMM\.? ?IPD|\(T\)\s*(CMA|OP|A)|\((TM|PT|CR|GI|DN)\)\s*A?\/|OP\(TM\)|OP\(PT\)|CMA\(PT\)|\bTMA\b|\bPTA\b|\bORA\/|\bOA\/\d+\/\d+\/(PT|TM)|TRA\/|\bTM\s*APPEAL|\bPATENT\s*APPEAL/i],
  ['Writ petition', /\bW\.?P\.?\s*[(.\d\/]|WRIT|\bWPA\b|\bWP\(C\)|\bW\.P\.\(C\)|\bWPC\b/i],
  ['Review, contempt or execution', /REVIEW|CONTEMPT|\bCONT\.?\s*P|EXECUTION|\bEX\.?\s*P|\bCCP\b|\bRP\s*(NO|\d|\/)/i],
  ['Criminal proceeding', /\bCRL|CRIMINAL|BAIL|QUASH|\bCR\.?\s*(P|OP|RC|M\.?C|A)\b|\bCRA\b|\bMCRC\b|\bCRMP\b/i],
  ['Rectification or cancellation petition', /\bC\.?O\.?\s*\(COMM|\bC\.?O\.?\s*(NO|\d|\/)|RECTIFICATION|CANCELLATION|\bORA\b/i],
  ['Interim application or motion', /\bI\.?A\.?\s*(NO|\d|\/)|\bO\.?A\.?\s*(NO|\d|\/)|NOTICE OF MOTION|\bNM[A-Z]*\s*(NO|\d|\/)|\bN\.?M\.?\s*(NO|\d|\/)|\bGA\s*(NO|\d|\/)|(^|\s)A\.?\s*(NO|\/)\s*\d|\bCM\s*APPL|INTERIM APPL|\bIA\(|\bIA\/|\bAPPL\s*(NO|\d|\/)|\bCMP\b/i],
  ['Appeal', /\bFAO|\bRFA|\bOSA|\bCMA\b|\bCOMAP|\bCOMMAP|\bIPA\b|\bMFA|\bAPOT\b|\bAPO\b|LETTERS PATENT|\bLPA\b|\bAPPEAL|\bFA\s*(NO|\d|\/)|\bCCCA|\bSA\s*(NO|\d|\/)|\bMA\s*(NO|\d|\/)|\bRSA\b|\bCMSA\b|\bAS\s*(NO|\d|\/)/i],
  ['Suit', /\bCS\s*\(|\bCS\(COMM|\bCOMIP|\bC\.?S\.?\s*(NO|\d|\(|\/)|\bCOM\.?\s*O\.?S|ORIGINAL SUIT|\bSUIT|\bCOMS\b|\bTS\s*(NO|\d|\/)|\bOS\s*(NO|\d|\/)|\bCOM\.?\s*S\b/i],
  ['Arbitration', /\bARB|ARBITRATION|\bOMP\b|\bO\.M\.P|\bCOMAP\(ARB/i],
];
const REGISTRY_PARTY = /registrar of trade ?marks|controller (general )?of patents|controller of designs|assistant controller|deputy controller|registrar of copyright|intellectual property appellate board/i;
function proceedingType(c, courtName) {
  const hay = `${c.case_number || ''} ${c.title || ''}`;
  const parties = `${c.petitioner || ''} ${c.respondent || ''} ${c.title || ''}`;
  const writ = /\bW\.?P\.?\s*[(.\d\/]|WRIT/i.test(hay);
  if (courtName === 'Supreme Court of India') return writ ? 'Writ petition' : 'Supreme Court petition or appeal';
  if (REGISTRY_PARTY.test(parties) && !writ) return 'Appeal from the Registrar or Controller';
  for (const [name, rx] of PROCEEDINGS) if (rx.test(hay)) return name;
  return 'Other or unclassified';
}
function benchLabel(judges) {
  const n = judges.length;
  return n === 0 ? 'Not recorded' : n === 1 ? 'Single judge' : n === 2 ? 'Division bench' : 'Full bench or larger';
}
function lengthLabel(chunks) {
  const n = Number(chunks) || 0;
  return n <= 2 ? 'Brief order' : n <= 7 ? 'Short judgment' : n <= 19 ? 'Full judgment' : 'Lengthy judgment';
}
function normalizeOutcome(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[.\s]+$/, '');
  if (!s) return '';
  if (/^disposed/.test(s)) return 'Disposed';
  if (/^dismiss/.test(s)) return 'Dismissed';
  if (/^allow/.test(s)) return 'Allowed';
  if (/^decree/.test(s)) return 'Decreed';
  if (/^reject/.test(s)) return 'Rejected';
  if (/^remand/.test(s)) return 'Remanded';
  if (/^withdraw/.test(s)) return 'Withdrawn';
  if (/^(partly|partially)/.test(s)) return 'Partly allowed';
  if (/^(set aside|quash)/.test(s)) return 'Set aside';
  if (/^(abate|infruct)/.test(s)) return 'Abated';
  if (/^(settle|compromise)/.test(s)) return 'Settled';
  return titleCase(String(raw).trim());
}
function loadResearch() {
  const dir = path.join(CONTENT, 'research');
  const seen = new Set();
  const cases = [];
  for (const file of listFiles(dir, '.json')) {
    const d = readJSON(file);
    if (!Array.isArray(d.cases)) continue; // links.json, issues.json and other side files
    const courtName = COURT_NAMES[d.court] || d.court;
    for (const c of d.cases) {
      if (seen.has(c.case_id)) continue;
      seen.add(c.case_id);
      let date = (c.decision_date || '').slice(0, 10);
      let yearOnly = false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        if (!/^\d{4}$/.test(String(c.year || ''))) continue; // no usable date at all
        date = `${c.year}-01-01`; yearOnly = true;            // sorts with its year; shown as the year alone
      }
      const { title, p, r, n } = parseTitle(c.title, c.case_number, c.petitioner, c.respondent);
      const judges = cleanJudges(c.judges);
      // Drop descriptions that are just the all-caps court header; the key passage carries the substance.
      const desc = (c.description || '').trim();
      const s = desc && desc !== desc.toUpperCase() && !/^(in the|court at|before)/i.test(desc) ? desc.slice(0, 240) : '';
      cases.push({
        id: c.case_id, t: title, p, r, c: courtName, d: date, n, ct: c.citation || '',
        j: judges, o: normalizeOutcome(c.disposition), a: c.areas || [],
        tp: c.issues || [], ind: c.industries || [], st: c.statutes || [],
        pr: proceedingType(c, courtName), bn: benchLabel(judges), ln: lengthLabel(c.total_chunks),
        k: (c.key_passage || '').slice(0, 420), s, ...(yearOnly ? { yo: 1 } : {}),
      });
    }
  }
  cases.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.id < b.id ? 1 : -1));
  return cases;
}
/* Full-text index: every distinct token of every judgment, as a sharded inverted index the browser fetches per keyword.
   Tokens come from content/research/<court>.tokens.jsonl.gz (one [case_id, [tokens]] per line), produced by the index script. */
const FTS_BUCKETS = 128;
const FTS_STOP_DF = 0.35; // a token present in more than this share of judgments carries no signal and is not stored
function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
function buildFts(cases) {
  const zlib = require('zlib');
  const dir = path.join(CONTENT, 'research');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.tokens.jsonl.gz')) : [];
  const out = path.join(DIST, 'research', 'fts');
  fs.mkdirSync(out, { recursive: true });
  const idOf = new Map(cases.map((c) => [c.id, c.i]));
  const postings = new Map();
  let indexed = 0;
  for (const f of files) {
    let lines;
    try { lines = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n'); }
    catch (err) { console.warn(`  ! ${f} is unreadable (${err.message}); full-text index skips it. Re-run the index script if this persists.`); continue; }
    for (const line of lines) {
      if (!line) continue;
      const [caseId, toks] = JSON.parse(line);
      const id = idOf.get(caseId);
      if (id === undefined) continue;
      indexed++;
      for (const t of toks) { let p = postings.get(t); if (!p) { p = []; postings.set(t, p); } p.push(id); }
    }
  }
  const stop = [];
  const buckets = Array.from({ length: FTS_BUCKETS }, () => ({}));
  let stored = 0;
  for (const [t, ids] of postings) {
    if (ids.length > cases.length * FTS_STOP_DF) { stop.push(t); continue; }
    ids.sort((a, b) => a - b);
    let prev = 0; const deltas = new Array(ids.length);
    for (let k = 0; k < ids.length; k++) { deltas[k] = (ids[k] - prev).toString(36); prev = ids[k]; }
    buckets[fnv1a(t) % FTS_BUCKETS][t] = deltas.join(',');
    stored += ids.length;
  }
  buckets.forEach((b, n) => fs.writeFileSync(path.join(out, `b${n}.json`), JSON.stringify(b)));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ buckets: FTS_BUCKETS, docs: cases.length, indexed, terms: postings.size - stop.length, postings: stored, stop }));
  return { indexed, terms: postings.size - stop.length, postings: stored, stop: stop.length };
}
/* The judgment text itself, one small JSON per judgment, fetched by the page on demand to show relevant paragraphs
   and to read the judgment inline. Source: content/research/<court>.text.jsonl.gz ([case_id, [[page, para_no, text], ...]]). */
function writeResearchText(cases) {
  const zlib = require('zlib');
  const dir = path.join(CONTENT, 'research');
  const out = path.join(DIST, 'research', 'text');
  fs.mkdirSync(out, { recursive: true });
  const wanted = new Set(cases.map((c) => c.id));
  let written = 0, bytes = 0;
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.text.jsonl.gz')) : []) {
    let lines;
    try { lines = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').split('\n'); }
    catch (err) { console.warn(`  ! ${f} is unreadable (${err.message}); judgment text skips it.`); continue; }
    for (let line of lines) {
      line = line.trim(); // the export may end lines with \r\n
      if (!line) continue;
      const nl = line.indexOf(',');
      const id = line.slice(2, nl - 1);
      if (!wanted.has(id)) continue;
      const body = line.slice(nl + 1, -1);
      const json = `{"id":"${id}","p":${body}}`;
      fs.writeFileSync(path.join(out, `${id}.json`), json);
      written++; bytes += json.length;
    }
  }
  for (const c of cases) if (fs.existsSync(path.join(out, `${c.id}.json`))) c.x = 1; // text available
  return { written, mb: Math.round(bytes / 1e6) };
}
function loadLinks() {
  const f = path.join(CONTENT, 'research', 'links.json');
  return fs.existsSync(f) ? readJSON(f) : {};
}
function writeResearchData(cases) {
  const dir = path.join(DIST, 'research', 'data');
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const links = loadLinks();
  let linked = 0;
  for (const c of cases) if (links[c.id]) { c.u = links[c.id]; linked++; }
  // Stable integer ids for the full-text index: position in case_id order.
  [...cases].sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((c, i) => { c.i = i; });
  const text = writeResearchText(cases);
  const issuesFile = path.join(CONTENT, 'research', 'issues.json');
  if (fs.existsSync(issuesFile)) fs.copyFileSync(issuesFile, path.join(DIST, 'research', 'issues.json'));
  const fts = buildFts(cases);
  return manifestFor(cases, fts, text, linked, dir);
}
function manifestFor(cases, fts, text, linked, dir) {
  const byYear = new Map();
  for (const c of cases) { const y = c.d.slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(c); }
  const years = [...byYear.keys()].sort().reverse();
  if (dir) for (const y of years) fs.writeFileSync(path.join(dir, `${y}.json`), JSON.stringify(byYear.get(y)));
  const count = (key) => { const m = {}; for (const c of cases) for (const v of (Array.isArray(c[key]) ? c[key] : [c[key]])) if (v) m[v] = (m[v] || 0) + 1; return m; };
  const facet = (key, limit) => Object.entries(count(key)).sort((a, b) => b[1] - a[1]).slice(0, limit || 1000).map(([name, n]) => ({ name, n }));
  const manifest = {
    generated: new Date().toISOString().slice(0, 10), total: cases.length,
    years: years.map((y) => ({ y, n: byYear.get(y).length })),
    courts: facet('c'),
    areas: count('a'),
    dispositions: facet('o', 12),
    facets: {
      area: facet('a'), issue: facet('tp'), court: facet('c'), proc: facet('pr'), outcome: facet('o', 12),
      length: ['Brief order', 'Short judgment', 'Full judgment', 'Lengthy judgment'].map((name) => ({ name, n: count('ln')[name] || 0 })),
      bench: ['Single judge', 'Division bench', 'Full bench or larger', 'Not recorded'].map((name) => ({ name, n: count('bn')[name] || 0 })).filter((f) => f.n),
      industry: facet('ind'), statute: facet('st'), judge: facet('j', 30),
    },
    fts, text, linked,
  };
  if (dir) fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

function rss(site, posts) {
  const base = site.url.replace(/\/$/, '');
  const items = posts.slice(0, 20).map((p) => `<item>
  <title>${esc(p.title)}</title>
  <link>${base}${p.url}</link>
  <guid>${base}${p.url}</guid>
  <pubDate>${new Date(p.date + 'T09:00:00+05:30').toUTCString()}</pubDate>
  <category>${esc(p.category)}</category>
  <description>${esc(p.description)}</description>
</item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(site.name)} blog</title>
<link>${base}/blog/</link>
<description>${esc(site.description)}</description>
<language>en-in</language>
${items}
</channel></rss>`;
}

function sitemap(site, urls) {
  const base = site.url.replace(/\/$/, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('\n')}
</urlset>`;
}

function build() {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  const data = loadContent();
  data.site.production = PRODUCTION;
  copyAssets();
  if (PRODUCTION) {
    const host = new URL(data.site.url).host;
    fs.writeFileSync(path.join(DIST, 'CNAME'), host + '\n');          // GitHub Pages custom domain
    fs.writeFileSync(path.join(DIST, '.nojekyll'), '');              // serve files and folders as they are
  }

  const urls = [];
  const emit = (urlPath, html) => { writePage(urlPath, html); urls.push(urlPath); };

  data.research = { total: loadResearch().length };
  emit('/', pages.home(data));
  emit('/blog/', pages.blogIndex(data));
  for (const p of data.posts) emit(p.url, pages.post(data, p));
  emit('/courses/', pages.coursesIndex(data));
  for (const c of data.courses) {
    emit(c.url, pages.course(data, c));
    if (c.enrolOpen) emit(c.enrolUrl, pages.enrol(data, c));
  }
  emit('/live-training/', pages.webinars(data));
  for (const w of data.webinars.upcoming) if (!w.externalRegisterUrl) emit(w.registerUrl, pages.register(data, w));
  data.research = writeResearchData(loadResearch());
  emit('/research/', pages.research(data));
  emit('/about/', pages.about(data));
  emit('/contact/', pages.contact(data));
  writePage('/404.html', pages.notFound(data));
  writePage('/feed.xml', rss(data.site, data.posts));
  writePage('/sitemap.xml', sitemap(data.site, urls));
  writePage('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${data.site.url.replace(/\/$/, '')}/sitemap.xml\n`);

  const f = data.research.fts || {};
  const r = data.research;
  console.log(`Built ${urls.length} pages${PRODUCTION ? ' [production]' : ''} (${data.posts.length} posts, ${data.courses.length} courses, ${data.webinars.upcoming.length + data.webinars.past.length} training sessions, ${r.total} judgments in research index, full text for ${f.indexed || 0}: ${(f.terms || 0).toLocaleString()} terms, ${(f.postings || 0).toLocaleString()} postings; judgment text files ${(r.text || {}).written || 0} (${(r.text || {}).mb || 0} MB); PDF links ${r.linked || 0}) in ${Date.now() - t0} ms -> dist/`);
}

build();
