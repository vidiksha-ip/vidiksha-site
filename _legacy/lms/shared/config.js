/* Shared, public configuration for the learning portal and the control panel.
   The anon key is publishable by design; every permission is enforced by row level security in Supabase.
   The course list is loaded from the database at start (see LMS.setCourses in lib.js). */
window.VIDIKSHA = {
  supabaseUrl: 'https://euvlsarftingglxvsuzq.supabase.co',
  anonKey: 'sb_publishable_KfR6_R3l2q_-8KD3QjOrOg_x6iNqKTa',
  siteUrl: 'https://vidiksha.in',
  portalUrl: location.hostname === 'localhost' ? 'http://localhost:4322' : 'https://portal.vidiksha.in',
  controlUrl: location.hostname === 'localhost' ? 'http://localhost:4323' : 'https://control.vidiksha.in',
  functionsUrl: 'https://euvlsarftingglxvsuzq.supabase.co/functions/v1',
  courses: {},        // slug -> title, filled at start
  courseRows: {}      // slug -> full course row, filled at start
};
