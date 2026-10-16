// Publishes from the control panel to the website repository: blog posts, and courses with their curriculum.
// The site is static and built from content/ on every push, so "publishing" is a commit.
//
//   POST /functions/v1/publish-post   { title, slug, description, category, course, date, body, mode }   blog post
//                                     { type: "course", slug }             write content/courses/<slug>.json from the database
//                                     { type: "unpublish_course", slug }   remove that file (course disappears from the site)
//                                     { type: "curriculum", slug, sessions } rewrite only the modules of an existing course file
//   Authorization: Bearer <the staff member's Supabase session token>
//
// Deploy:  supabase functions deploy publish-post --no-verify-jwt   (the function checks the token itself)
// Secrets: GITHUB_TOKEN   fine-grained personal access token with "Contents: read and write" on the site repository only
//          GITHUB_REPO    owner/name, default vidiksha-ip/vidiksha-site
//          GITHUB_BRANCH  default main
//          SITE_URL       default https://vidiksha.in

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GH_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GH_REPO = Deno.env.get("GITHUB_REPO") ?? "vidiksha-ip/vidiksha-site";
const GH_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://vidiksha.in";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://control.vidiksha.in,http://control.vidiksha.in,http://localhost:4323").split(",").map((s) => s.trim());
const CATEGORIES = ["Trademark", "Patent", "Copyright", "Design", "Licensing"];

function cors(origin: string | null) {
  return { "Access-Control-Allow-Origin": origin && ALLOWED.includes(origin) ? origin : ALLOWED[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
const json = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

/** The caller must be a signed-in member listed in public.staff. */
async function staffUser(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const user = await u.json();
  const s = await fetch(`${SUPABASE_URL}/rest/v1/staff?user_id=eq.${user.id}&select=role`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  const rows = s.ok ? await s.json() : [];
  return rows.length ? { id: user.id as string, email: user.email as string, role: rows[0].role as string } : null;
}

const yamlStr = (s: string) => JSON.stringify(String(s ?? "").replace(/\s+/g, " ").trim());
const slugify = (s: string) => String(s).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  try {
    const staff = await staffUser(req);
    if (!staff) return json({ error: "Sign in as a team member to publish." }, 401, origin);
    if (!GH_TOKEN) return json({ error: "Publishing is not configured: GITHUB_TOKEN is missing." }, 503, origin);

    const b = await req.json().catch(() => ({}));
    const gh = (p: string, init: RequestInit = {}) => fetch(`https://api.github.com/repos/${GH_REPO}/contents/${p}`, { ...init, headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "vidiksha-control-panel", ...(init.headers || {}) } });

    // Whole course: write content/courses/<slug>.json from the database (course row + sessions), or remove it.
    if (b.type === "course" || b.type === "unpublish_course") {
      const cslug = String(b.slug ?? "").replace(/[^a-z0-9-]/g, "");
      if (!cslug) return json({ error: "Course slug is required." }, 400, origin);
      const cpath = `content/courses/${cslug}.json`;
      const cur = await gh(`${cpath}?ref=${GH_BRANCH}`);
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      if (b.type === "unpublish_course") {
        if (!sha) return json({ ok: true, removed: false, note: "The course was not on the website." }, 200, origin);
        const del = await gh(cpath, { method: "DELETE", body: JSON.stringify({ message: `Remove course from the website: ${cslug}\n\nUnpublished from the control panel by ${staff.email}`, sha, branch: GH_BRANCH, committer: { name: "VIDIKSHA Control Panel", email: "team@vidiksha.in" } }) });
        const resd = await del.json();
        if (!del.ok) { console.error("github", resd); return json({ error: `GitHub refused the removal: ${resd.message ?? del.status}` }, 502, origin); }
        await fetch(`${SUPABASE_URL}/rest/v1/courses?slug=eq.${cslug}`, { method: "PATCH", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ published_on_site: false }) });
        return json({ ok: true, removed: true, url: `${SITE_URL}/courses/` }, 200, origin);
      }
      const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
      const [cr, lr] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/courses?slug=eq.${cslug}&select=*`, { headers: h }),
        fetch(`${SUPABASE_URL}/rest/v1/lectures?course_slug=eq.${cslug}&select=title,lessons,position&order=position`, { headers: h }),
      ]);
      const course = cr.ok ? (await cr.json())[0] : null;
      if (!course) return json({ error: "No such course in the database." }, 404, origin);
      const lectures = lr.ok ? await lr.json() : [];
      const file = {
        order: course.sort_order ?? 99, featured: !!course.featured, title: course.title, subtitle: course.subtitle ?? "", area: course.area ?? "", level: course.level ?? "",
        duration: course.duration ?? "", unit: course.unit ?? "modules", unitNote: course.unit_note ?? "", price: Number(course.price_inr), enrolOpen: !!course.enrol_open,
        summary: course.summary ?? "", outcomes: course.outcomes ?? [], about: course.about ?? [],
        modules: lectures.map((l: Record<string, unknown>) => ({ title: l.title, lessons: Array.isArray(l.lessons) ? l.lessons : [] })),
        access: course.access ?? "Lifetime access", includes: course.includes ?? [], kit: course.kit ?? undefined, whoFor: course.who_for ?? [], notFor: course.not_for ?? [], faq: course.faq ?? [],
      };
      if (!file.kit) delete (file as Record<string, unknown>).kit;
      const put = await gh(cpath, { method: "PUT", body: JSON.stringify({ message: `${sha ? "Update" : "Add"} course on the website: ${course.title}\n\nPublished from the control panel by ${staff.email}`, content: b64(JSON.stringify(file, null, 2) + "\n"), branch: GH_BRANCH, sha, committer: { name: "VIDIKSHA Control Panel", email: "team@vidiksha.in" } }) });
      const resp = await put.json();
      if (!put.ok) { console.error("github", resp); return json({ error: `GitHub refused the commit: ${resp.message ?? put.status}` }, 502, origin); }
      await fetch(`${SUPABASE_URL}/rest/v1/courses?slug=eq.${cslug}`, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ published_on_site: true, site_published_at: new Date().toISOString() }) });
      return json({ ok: true, slug: cslug, url: `${SITE_URL}/courses/${cslug}/`, commit: resp.commit?.sha }, 200, origin);
    }

    // Live training session: write content/training/<slug>.json from the database, or remove it (hide from the site).
    if (b.type === "session" || b.type === "unpublish_session") {
      const sslug = String(b.slug ?? "").replace(/[^a-z0-9-]/g, "");
      if (!sslug) return json({ error: "Session slug is required." }, 400, origin);
      const spath = `content/training/${sslug}.json`;
      const cur = await gh(`${spath}?ref=${GH_BRANCH}`);
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
      if (b.type === "unpublish_session") {
        if (sha) {
          const del = await gh(spath, { method: "DELETE", body: JSON.stringify({ message: `Hide training session from the website: ${sslug}\n\nUnpublished from the control panel by ${staff.email}`, sha, branch: GH_BRANCH, committer: { name: "VIDIKSHA Control Panel", email: "team@vidiksha.in" } }) });
          if (!del.ok) { const r = await del.json(); console.error("github", r); return json({ error: `GitHub refused the removal: ${r.message ?? del.status}` }, 502, origin); }
        }
        await fetch(`${SUPABASE_URL}/rest/v1/training_sessions?slug=eq.${sslug}`, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ published_on_site: false }) });
        return json({ ok: true, removed: !!sha, url: `${SITE_URL}/live-training/` }, 200, origin);
      }
      const sr = await fetch(`${SUPABASE_URL}/rest/v1/training_sessions?slug=eq.${sslug}&select=*`, { headers: h });
      const s = sr.ok ? (await sr.json())[0] : null;
      if (!s) return json({ error: "No such session in the database." }, 404, origin);
      const ist = new Date(s.starts_at).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(" ", "T") + "+05:30";
      const file: Record<string, unknown> = { slug: sslug, title: s.title, summary: s.summary ?? "", format: s.format ?? "", certificate: s.certificate ?? "", area: s.area ?? "", datetime: ist, duration: Number(s.duration_min) || 180, price: Number(s.price_inr) || 0, platform: s.platform ?? "Microsoft Teams" };
      if (s.replay_url) file.replayUrl = s.replay_url;
      if (s.whatsapp_group_url) file.whatsappGroup = s.whatsapp_group_url;
      if (s.external_register_url) file.externalRegisterUrl = s.external_register_url;
      const put = await gh(spath, { method: "PUT", body: JSON.stringify({ message: `${sha ? "Update" : "Add"} training session on the website: ${s.title}\n\nPublished from the control panel by ${staff.email}`, content: b64(JSON.stringify(file, null, 2) + "\n"), branch: GH_BRANCH, sha, committer: { name: "VIDIKSHA Control Panel", email: "team@vidiksha.in" } }) });
      const resp = await put.json();
      if (!put.ok) { console.error("github", resp); return json({ error: `GitHub refused the commit: ${resp.message ?? put.status}` }, 502, origin); }
      await fetch(`${SUPABASE_URL}/rest/v1/training_sessions?slug=eq.${sslug}`, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ published_on_site: true, site_published_at: new Date().toISOString() }) });
      return json({ ok: true, slug: sslug, url: `${SITE_URL}/live-training/`, commit: resp.commit?.sha }, 200, origin);
    }

    // Curriculum only: rewrite the "modules" of content/courses/<slug>.json so the public course page matches the portal.
    if (b.type === "curriculum") {
      const cslug = String(b.slug ?? "").replace(/[^a-z0-9-]/g, "");
      const sessions = Array.isArray(b.sessions) ? b.sessions : [];
      if (!cslug || !sessions.length) return json({ error: "Course and sessions are required." }, 400, origin);
      const cpath = `content/courses/${cslug}.json`;
      const cur = await gh(`${cpath}?ref=${GH_BRANCH}`);
      if (!cur.ok) return json({ error: `No course file ${cpath} in the repository.` }, 404, origin);
      const meta = await cur.json();
      const text = new TextDecoder().decode(Uint8Array.from(atob(String(meta.content).replace(/\n/g, "")), (c) => c.charCodeAt(0)));
      const course = JSON.parse(text);
      course.modules = sessions.map((x: Record<string, unknown>) => ({ title: String(x.title ?? "").trim(), lessons: (Array.isArray(x.lessons) ? x.lessons : []).map((l: unknown) => String(l).trim()).filter(Boolean) })).filter((m: { title: string }) => m.title);
      const putc = await gh(cpath, { method: "PUT", body: JSON.stringify({ message: `Update curriculum: ${course.title}\n\nPublished from the control panel by ${staff.email}`, content: b64(JSON.stringify(course, null, 2) + "\n"), branch: GH_BRANCH, sha: meta.sha, committer: { name: "VIDIKSHA Control Panel", email: "team@vidiksha.in" } }) });
      const resc = await putc.json();
      if (!putc.ok) { console.error("github", resc); return json({ error: `GitHub refused the commit: ${resc.message ?? putc.status}` }, 502, origin); }
      return json({ ok: true, slug: cslug, url: `${SITE_URL}/courses/${cslug}/`, commit: resc.commit?.sha }, 200, origin);
    }

    const title = String(b.title ?? "").trim(), description = String(b.description ?? "").trim(), body = String(b.body ?? "").replace(/\r\n/g, "\n").trim();
    const slug = slugify(b.slug || title);
    const category = CATEGORIES.includes(b.category) ? b.category : "Trademark";
    const course = String(b.course ?? "").replace(/[^a-z0-9-]/g, "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : new Date().toISOString().slice(0, 10);
    const mode = b.mode === "update" ? "update" : "create";
    if (title.length < 8) return json({ error: "The title is too short." }, 400, origin);
    if (description.length < 20) return json({ error: "Write a one- or two-sentence description." }, 400, origin);
    if (body.length < 200) return json({ error: "The post needs more body text." }, 400, origin);
    if (!slug) return json({ error: "Could not make a URL slug from the title." }, 400, origin);

    const path = `content/blog/${slug}.md`;

    const existing = await gh(`${path}?ref=${GH_BRANCH}`);
    let sha: string | undefined;
    if (existing.ok) {
      if (mode === "create") return json({ error: `A post already exists at /blog/${slug}/. Choose another slug, or switch the mode to "Update".` }, 409, origin);
      sha = (await existing.json()).sha;
    } else if (mode === "update") return json({ error: `No post with the slug "${slug}" to update.` }, 404, origin);

    const front = [`---`, `title: ${yamlStr(title)}`, `description: ${yamlStr(description)}`, `date: ${date}`, `category: ${category}`, course ? `course: ${course}` : null, `---`].filter(Boolean).join("\n");
    const content = `${front}\n\n${body}\n`;
    const put = await gh(path, { method: "PUT", body: JSON.stringify({ message: `${mode === "update" ? "Update" : "Add"} blog post: ${title}\n\nPublished from the control panel by ${staff.email}`, content: b64(content), branch: GH_BRANCH, sha, committer: { name: "VIDIKSHA Control Panel", email: "team@vidiksha.in" } }) });
    const res = await put.json();
    if (!put.ok) { console.error("github", res); return json({ error: `GitHub refused the commit: ${res.message ?? put.status}` }, 502, origin); }
    return json({ ok: true, slug, url: `${SITE_URL}/blog/${slug}/`, commit: res.commit?.sha }, 200, origin);
  } catch (e) {
    console.error(String(e));
    return json({ error: "Something went wrong while publishing." }, 500, origin);
  }
});
