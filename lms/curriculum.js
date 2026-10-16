// Writes lms/shared/courses.js from content/courses/*.json so the portal and control panel know each course's
// curriculum (sessions and what each covers). Run by build.js and by lms/build.js; can also be run on its own:
//   node lms/curriculum.js
const fs = require('fs');
const path = require('path');

function writeCurriculum() {
  const dir = path.join(__dirname, '..', 'content', 'courses');
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const slug = f.replace(/\.json$/, '');
    out[slug] = {
      title: c.title, area: c.area, duration: c.duration, unit: c.unit || 'modules', unitNote: c.unitNote || '', access: c.access || 'Lifetime access',
      price: c.price, kit: c.kit ? c.kit.title : null,
      sessions: (c.modules || []).map((m, i) => ({ n: i + 1, title: m.title, lessons: m.lessons || [] })),
      includes: c.includes || []
    };
  }
  const file = path.join(__dirname, 'shared', 'courses.js');
  fs.writeFileSync(file, '/* Generated from content/courses/*.json by lms/curriculum.js. Do not edit by hand. */\nwindow.VIDIKSHA_COURSES = ' + JSON.stringify(out, null, 1) + ';\n');
  return Object.keys(out).length;
}

if (require.main === module) console.log(`curriculum: ${writeCurriculum()} courses -> lms/shared/courses.js`);
module.exports = { writeCurriculum };
