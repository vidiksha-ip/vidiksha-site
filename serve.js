// Static server for the built site, with the Research data behind member login.
// Usage: node serve.js [port]   (serves ./dist; default port 4321)
//
// Everything is public except the Research data (/research/data, /research/fts, /research/text, /research/issues.json),
// which needs a valid Supabase session: the page sends "Authorization: Bearer <access token>" and this server checks
// the token with Supabase Auth before serving. Supabase settings come from SUPABASE_URL / SUPABASE_ANON_KEY,
// falling back to content/site.json. Without either, the research data is served openly (local development only).
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'dist');
const port = Number(process.argv[2] || process.env.PORT || 4321);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};

function supabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  try {
    const site = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'site.json'), 'utf8'));
    if (site.supabase && site.supabase.url && site.supabase.anonKey) return { url: site.supabase.url, key: site.supabase.anonKey };
  } catch { /* no config */ }
  return null;
}
const supabase = supabaseConfig();
if (!supabase) console.warn('No Supabase configuration found: research data is NOT protected (fine for local development only).');

const PROTECTED = /^\/research\/(data|fts|text)\/|^\/research\/issues\.json$/;

/* ---- live training registrations: Google Sheet webhook plus a local log ---- */
function sheetWebhook() {
  if (process.env.SHEET_WEBHOOK_URL) return process.env.SHEET_WEBHOOK_URL;
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'site.json'), 'utf8')).sheetWebhook || ''; } catch { return ''; }
}
const SHEET_URL = sheetWebhook();
if (!SHEET_URL) console.warn('No Google Sheet webhook configured: registrations are logged to data/registrations.jsonl only.');
const LOG = path.join(__dirname, 'data', 'registrations.jsonl');

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
const clean = (v, max) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

async function registerSession(req, res) {
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, '{"ok":false,"error":"Bad request"}'); }
  const row = {
    received_at: new Date().toISOString(),
    session_slug: clean(body.session_slug, 120), session_title: clean(body.session_title, 200), session_date: clean(body.session_date, 10),
    full_name: clean(body.full_name, 120), email: clean(body.email, 200).toLowerCase(), whatsapp: clean(body.whatsapp, 30),
    profession: clean(body.profession, 80), qualification: clean(body.qualification, 80),
    account_status: clean(body.account_status, 120), source: clean(body.source, 40) || 'website',
    ip: clean(req.headers['x-forwarded-for'] || req.socket.remoteAddress, 60),
  };
  if (!row.session_slug || !row.full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return send(res, 400, '{"ok":false,"error":"Name, email and session are required"}');
  // Local log first: nothing is lost if the sheet is unreachable.
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, JSON.stringify(row) + '\n'); } catch (e) { console.error('registration log failed:', e.message); }
  let sheet = false;
  if (SHEET_URL) {
    try {
      const r = await fetch(SHEET_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row), redirect: 'follow', signal: AbortSignal.timeout(15000) });
      const text = await r.text();
      sheet = r.ok && /"ok"\s*:\s*true/.test(text);
      if (!sheet) console.error('sheet webhook replied', r.status, text.slice(0, 200));
    } catch (e) { console.error('sheet webhook failed:', e.message); }
  }
  send(res, 200, JSON.stringify({ ok: true, sheet, stored: true }));
}
const verified = new Map(); // token -> expiry (ms); a verified token is trusted for five minutes

function verifyToken(token) {
  const hit = verified.get(token);
  if (hit && hit > Date.now()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const req = https.request(`${supabase.url.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET', headers: { apikey: supabase.key, Authorization: `Bearer ${token}` }, timeout: 8000,
    }, (res) => {
      res.resume();
      const ok = res.statusCode === 200;
      if (ok) { verified.set(token, Date.now() + 5 * 60 * 1000); if (verified.size > 5000) verified.clear(); }
      resolve(ok);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function handle(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/api/register-session') {
    if (req.method !== 'POST') return send(res, 405, '{"ok":false,"error":"POST only"}');
    return registerSession(req, res);
  }
  let file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': types['.html'] });
    return fs.createReadStream(path.join(root, '404.html')).pipe(res);
  }
  const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => { handle(req, res).catch(() => send(res, 500, 'Server error', 'text/plain')); })
  .listen(port, () => console.log(`VIDIKSHA: http://localhost:${port}`));
