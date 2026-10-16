/* Shared, public configuration for the learning portal and the control panel.
   The anon key is publishable by design; every permission is enforced by row level security in Supabase. */
window.VIDIKSHA = {
  supabaseUrl: 'https://euvlsarftingglxvsuzq.supabase.co',
  anonKey: 'sb_publishable_KfR6_R3l2q_-8KD3QjOrOg_x6iNqKTa',
  siteUrl: 'https://vidiksha.in',
  portalUrl: location.hostname === 'localhost' ? 'http://localhost:4322' : 'https://portal.vidiksha.in',
  controlUrl: location.hostname === 'localhost' ? 'http://localhost:4323' : 'https://control.vidiksha.in',
  functionsUrl: 'https://euvlsarftingglxvsuzq.supabase.co/functions/v1',
  courses: {
    'trademark-prosecution-in-practice': 'Trademark Prosecution in Practice',
    'patent-drafting-and-prosecution': 'Patent Drafting and Prosecution',
    'copyright-and-design-registration': 'Copyright and Design Registration',
    'ip-licensing-and-contracts': 'IP Licensing and Contracts'
  }
};
