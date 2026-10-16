// Builds the two LMS apps into lms/dist/portal and lms/dist/control, each self-contained (shared/ copied in),
// with the CNAME file for its domain, ready to publish as a static site (GitHub Pages, Cloudflare Pages, Netlify).
//   node lms/build.js
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const APPS = { portal: 'portal.vidiksha.in', control: 'control.vidiksha.in' };

fs.rmSync(DIST, { recursive: true, force: true });
for (const [app, domain] of Object.entries(APPS)) {
  const out = path.join(DIST, app);
  fs.mkdirSync(path.join(out, 'shared'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, app))) fs.copyFileSync(path.join(ROOT, app, f), path.join(out, f));
  for (const f of fs.readdirSync(path.join(ROOT, 'shared'))) fs.copyFileSync(path.join(ROOT, 'shared', f), path.join(out, 'shared', f));
  fs.writeFileSync(path.join(out, 'CNAME'), domain + '\n');
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  fs.copyFileSync(path.join(out, 'index.html'), path.join(out, '404.html')); // hash routing: any path serves the app
  console.log(`${app} -> ${path.relative(process.cwd(), out)} (${domain})`);
}
