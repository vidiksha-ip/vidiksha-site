// Local development server for the learning portal and the control panel.
//   node lms/serve.js            -> portal on http://localhost:4322, control on http://localhost:4323
// Each app is a static folder; /shared/* is served to both from lms/shared. In production each app is its own
// static site (portal.vidiksha.in, control.vidiksha.in) built by lms/build.js, which copies shared/ into each.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function serveApp(app, port) {
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file;
    if (p.startsWith('/shared/')) file = path.join(ROOT, 'shared', p.slice('/shared/'.length));
    else {
      if (p === '/' || p === '') p = '/index.html';
      file = path.join(ROOT, app, p);
    }
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) {
        // single-page app: unknown paths get index.html
        if (!path.extname(p)) return fs.readFile(path.join(ROOT, app, 'index.html'), (e2, d2) => { if (e2) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(d2); });
        res.writeHead(404); return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  }).listen(port, () => console.log(`${app}: http://localhost:${port}`));
}

serveApp('portal', Number(process.env.PORTAL_PORT || 4322));
serveApp('control', Number(process.env.CONTROL_PORT || 4323));
