// Vidiksha IP static site build. Reads content/, writes dist/. No dependencies.
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
const PRODUCTION = process.argv.includes('--production') || process.env.SITE_ENV === 'production';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const listFiles = (dir, ext) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(ext) && !f.startsWith('_')).sort().map((f) => path.join(dir, f)) : []);

function writePage(urlPath, html) {
  const file = urlPath.includes('.') ? path.join(DIST, urlPath) : path.join(DIST, urlPath, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function loadContent() {
  const site = readJSON(path.join(CONTENT, 'site.json'));

  const posts = listFiles(path.join(CONTENT, 'insights'), '.md').map((file) => {
    const { data, body } = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    const slug = data.slug || slugify(path.basename(file, '.md'));
    for (const k of ['title', 'description', 'date', 'category']) if (!data[k]) throw new Error(`${file}: front matter is missing "${k}"`);
    if (!pages.CATEGORIES.includes(data.category)) throw new Error(`${file}: category "${data.category}" is not one of ${pages.CATEGORIES.join(', ')}`);
    const words = wordCount(body);
    return {
      ...data, slug, url: `/insights/${slug}/`,
      author: data.author || site.name,
      html: render(body), words,
      readingTime: Math.max(1, Math.round(words / 220)),
    };
  }).filter((p) => !p.draft).sort((a, b) => (a.date < b.date ? 1 : -1));

  const practices = listFiles(path.join(CONTENT, 'practice'), '.json').map((file) => {
    const p = readJSON(file);
    const slug = p.slug || slugify(path.basename(file, '.json').replace(/^\d+-/, ''));
    for (const k of ['title', 'short', 'intro', 'services']) if (!p[k]) throw new Error(`${file}: missing "${k}"`);
    return { ...p, slug, url: `/expertise/${slug}/` };
  }).sort((a, b) => (a.order || 99) - (b.order || 99));

  site.practiceLinks = practices.map((p) => ({ label: p.title, href: p.url }));
  return { site, posts, practices };
}

function copyAssets() {
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, 'assets'))) fs.copyFileSync(path.join(SRC, 'assets', f), path.join(DIST, 'assets', f));
  fs.copyFileSync(path.join(SRC, 'styles', 'main.css'), path.join(DIST, 'assets', 'main.css'));
  for (const f of fs.readdirSync(path.join(SRC, 'scripts'))) fs.copyFileSync(path.join(SRC, 'scripts', f), path.join(DIST, 'assets', f));
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
<title>${esc(site.name)} insights</title>
<link>${base}/insights/</link>
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
    fs.writeFileSync(path.join(DIST, 'CNAME'), host + '\n');
    fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  }

  const urls = [];
  const emit = (urlPath, html) => { writePage(urlPath, html); urls.push(urlPath); };

  emit('/', pages.home(data));
  emit('/expertise/', pages.expertiseIndex(data));
  for (const p of data.practices) emit(p.url, pages.expertise(data, p));
  emit('/insights/', pages.insightsIndex(data));
  for (const p of data.posts) emit(p.url, pages.post(data, p));
  emit('/about/', pages.about(data));
  emit('/contact/', pages.contact(data));
  writePage('/404.html', pages.notFound(data));
  writePage('/feed.xml', rss(data.site, data.posts));
  writePage('/sitemap.xml', sitemap(data.site, urls));
  writePage('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${data.site.url.replace(/\/$/, '')}/sitemap.xml\n`);

  // Old URLs from the previous site: send visitors somewhere useful rather than to a 404.
  const redirects = { '/blog/': '/insights/', '/courses/': '/expertise/', '/live-training/': '/contact/', '/research/': '/insights/', '/people/': '/about/' };
  for (const p of data.posts) redirects[`/blog/${p.slug}/`] = p.url;
  for (const [from, to] of Object.entries(redirects)) {
    writePage(from, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${data.site.url.replace(/\/$/, '')}${to}"></head><body><p>This page has moved to <a href="${to}">${to}</a>.</p></body></html>`);
  }

  console.log(`Built ${urls.length} pages (${data.practices.length} practice areas, ${data.posts.length} insights) in ${Date.now() - t0} ms${PRODUCTION ? ' [production]' : ''}.`);
}

build();
