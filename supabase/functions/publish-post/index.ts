// Publishes a blog post from the control panel to the website repository.
// The site is static and built from content/blog/<slug>.md on every push, so "publishing" is a commit.
//
//   POST /functions/v1/publish-post   { title, slug, description, category, course, date, body, mode }
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
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://control.vidiksha.in,http://localhost:4323").split(",").map((s) => s.trim());
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
    const gh = (p: string, init: RequestInit = {}) => fetch(`https://api.github.com/repos/${GH_REPO}/contents/${p}`, { ...init, headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "vidiksha-control-panel", ...(init.headers || {}) } });

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
