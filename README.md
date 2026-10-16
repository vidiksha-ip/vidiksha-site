# VIDIKSHA — marketing site

Static site for VIDIKSHA, a practical IP law education platform. Built with a small, dependency-free Node script: content lives in Markdown and JSON files under `content/`, the build turns them into plain HTML in `dist/`. No framework, no npm packages, nothing to update.

## Run it

```bash
npm run build      # local build: content/ + src/ -> dist/, including the research data for local use
npm run dev        # build, then serve dist/ at http://localhost:4321 (serve.js checks logins for the research data)
```

Requires Node 18 or newer.

## Deployment: vidiksha.in on GitHub Pages

The public site is static and lives on GitHub Pages at https://vidiksha.in. The two things a static host cannot do are handled by services the site already uses: Supabase holds the member accounts and the research data (served only to signed-in members from a private Storage bucket), and the Google Apps Script web app receives registrations directly. There is no server to run.

**One-time set-up**

1. **Repository.** Create an empty repository on GitHub (any name, for example `vidiksha-site`; private or public both work with Pages on a free account only if public, so make it public or use a paid plan). Push this folder to its `main` branch. `.github/workflows/pages.yml` builds with `node build.js --production` and publishes `dist/` on every push.
2. **Pages.** In the repository: Settings → Pages → Source: **GitHub Actions**. After the first workflow run, under Custom domain enter `vidiksha.in`, save, and tick **Enforce HTTPS** once the certificate is issued (a few minutes after DNS resolves).
3. **DNS at Hostinger.** hPanel → Domains → vidiksha.in → DNS / Name Servers → DNS records. Remove any existing A or CNAME records for `@` and `www` that point at Hostinger parking, then add:

   | Type | Name | Value | TTL |
   |---|---|---|---|
   | A | @ | 185.199.108.153 | 3600 |
   | A | @ | 185.199.109.153 | 3600 |
   | A | @ | 185.199.110.153 | 3600 |
   | A | @ | 185.199.111.153 | 3600 |
   | CNAME | www | `<github-username>.github.io` | 3600 |

   Propagation takes minutes to an hour. `www.vidiksha.in` redirects to the apex automatically once both are set.
4. **Supabase Storage for the research data.** Run `supabase/migrations/0003_research_storage.sql` in the SQL Editor (creates the private `research` bucket and the members-only read policy). Then, on your machine, after a local `npm run build`:

   ```bash
   set SUPABASE_SERVICE_KEY=<secret key: Project Settings -> API Keys -> Secret keys -> default>
   python scripts/research-upload.py
   ```

   This uploads about 13,000 small JSON files (280 MB) to the bucket, takes 10 to 20 minutes, and only re-uploads changed files on later runs. The secret key is used on your machine only; never commit it.
5. **Supabase URLs.** Authentication → URL Configuration: Site URL `https://vidiksha.in`; redirect URLs `https://vidiksha.in/research/` and `https://vidiksha.in/live-training/register/*`.

**Every later change**: edit content, commit, push. Pages rebuilds in about a minute. Re-run the upload script only when the research index itself is regenerated.

**Bandwidth note.** The research data is served by Supabase Storage, whose free tier allows 5 GB of egress a month. A member's first visit loads about 9 MB; each search a few hundred KB; each judgment opened 20 to 100 KB. That is roughly 300 to 500 active members a month on the free tier; the Pro plan ($25/month) raises it to 250 GB.

**Self-hosting instead.** `node serve.js` still serves everything from `dist/` with the research data behind its own login check and the registration endpoint built in, for any Node host or VPS. Build without `--production` for that.

## Layout of the project

```
content/
  site.json            site-wide settings and copy: name, URLs, nav, hero, FAQs, about page
  blog/*.md            one Markdown file per post
  courses/*.json       one JSON file per course
  training/*.json      one JSON file per live training session
src/
  styles/main.css      all styles (design tokens at the top; dark mode via prefers-color-scheme)
  scripts/main.js      nav toggle, scroll fade-ins, blog filter/search, form handling
  assets/              favicon, default OpenGraph image
lib/
  md.js                Markdown + front matter parser
  html.js              layout and shared components (cards, newsletter)
  pages.js             one function per page type
build.js               reads content, writes dist/, plus sitemap.xml, feed.xml, robots.txt
serve.js               local preview server
```

Every page gets a title, meta description, canonical URL, OpenGraph and Twitter tags, and JSON-LD (`Organization` on the home page, `Article` on posts, `Course` on course pages). The build also writes `sitemap.xml`, an RSS `feed.xml` for the blog, and `robots.txt`.

## Add a blog post

Create `content/blog/<slug>.md`. The file name becomes the URL (`/blog/<slug>/`). Front matter at the top, Markdown below:

```markdown
---
title: How to respond to a Section 9 trademark objection
description: One or two sentences. Used on cards, in meta tags and in the RSS feed.
date: 2026-10-08
category: Trademark
course: trademark-prosecution-in-practice
---

Body in Markdown. Headings (##), lists, bold, links, blockquotes, tables and fenced code all work.
```

- `category` must be one of `Trademark`, `Patent`, `Copyright`, `Design`, `Licensing`. It drives the blog filter.
- `course` (optional) is the slug of the course to promote at the end of the post. Without it, the first course in the same area is used.
- `author` (optional) is used only in the structured data, never shown on the page; it defaults to the site name. Instructors and speakers are deliberately not named anywhere on the site.
- `draft: true` keeps a post out of the build.
- Reading time is calculated from the word count. Posts are sorted by `date`, newest first. The home page shows the latest three.

## Add a course

Create `content/courses/<slug>.json`. Copy an existing file; the fields are:

| Field | What it is |
|---|---|
| `title`, `subtitle`, `summary` | Headline, one-line pitch (used as meta description), card blurb |
| `area` | `Trademark`, `Patent`, `Copyright`, `Design` or `Licensing`; matches blog categories |
| `level`, `duration`, `price` | Free text, free text, integer in INR (GST-inclusive) |
| `enrolOpen` | `true` turns on the site's own enrolment page at `/courses/<slug>/enrol/` with Razorpay payment (see "Course enrolment and payments"). Without it the course shows "Ask about this course" |
| `outcomes` | "What you will actually be able to do" list. First four appear on the home page if featured |
| `about` | Array of paragraphs |
| `modules` | Array of `{ "title", "lessons": [...] }`; rendered as the curriculum accordion |
| `unit`, `unitNote` | Optional. `"sessions"` labels modules as sessions (with "2 hours" on each); `unitNote` adds text such as "2 hours each, recorded" |
| `access` | Optional. Shown on the enrol card in place of "Lifetime access", for example "Recording access for 2 months from the date of registration" |
| `kit` | Optional. `{ "title", "intro", "items": [...] }` renders a numbered "at your doorstep" section for a physical kit |
| `includes`, `whoFor`, `notFor`, `faq` | Sidebar list, "take it if", "skip it if", and `{ "q", "a" }` pairs |
| `order` | Sort position on the courses page |
| `featured` | `true` on exactly one course puts it on the home page and marks it "Most popular" |

## Add a live training session

Create `content/training/<slug>.json`. Sessions are listed at `/live-training/`:

```json
{
  "title": "Preparation of Exam Report Responses (Trademark Prosecution)",
  "summary": "Two or three sentences on what gets covered.",
  "area": "Trademark",
  "datetime": "2026-10-25T16:00:00+05:30",
  "duration": 180,
  "format": "Real Registry examination report + live drafting",
  "certificate": "Certificate of Training on successful completion",
  "price": 0,
  "registerUrl": "https://...",
  "replayUrl": "https://..."
}
```

`datetime` is the start in IST and `duration` is minutes; the pages show the range ("4 pm to 7 pm IST") and whole hours as "3 hours". `format` and `certificate` are optional lines shown as ticks on the card. Whether a session is upcoming or past is decided by `datetime` at build time, so rebuild after the session to move it to replays. `price: 0` shows as free; any other price is labelled "inaugural". Course prices are labelled "inaugural price" everywhere they appear; to drop that label later, search `lib/` for the word. Add `replayUrl` once the recording is up; until then past sessions show "Replay coming soon". The earliest upcoming session is featured on the home page.

## Member login for the Research tab

The Research tab is for registered members only. Accounts live in Supabase Auth (email and password, confirmation emails, password resets) and the site keeps a member table alongside it. Nothing else on the site needs a login.

What is in the database (`supabase/migrations/0001_members.sql`):

- `auth.users`: managed by Supabase Auth. Email, hashed password, confirmation and reset tokens.
- `public.profiles`: one row per member, filled automatically from the sign-up form by a trigger: full name, organisation, role (law student, junior lawyer, in-house counsel, founder and so on), created and last-login timestamps.
- `public.research_logins`: one row per login to the repository, with a timestamp and user agent.
- `public.member_overview`: a view for the dashboard joining the two.

Row level security means a member can only read or change their own rows; the Supabase dashboard sees everything.

How the gate works: `serve.js` refuses to serve anything under `/research/data/`, `/research/fts/` or `/research/text/` without a valid Supabase session token in the `Authorization` header, so the data cannot be fetched by skipping the page. The page itself shows a log-in / create-account panel until a session exists, then loads the index with the token on every request. Sign-up data goes straight to Supabase from the browser; the site's own server never sees passwords.

Set-up, once, in a Supabase account of your choosing:

1. Create a project (any region; Mumbai, `ap-south-1`, is closest to your users). In **Project Settings → API** copy the **Project URL** and the **publishable** (anon) key.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_members.sql`, run it.
3. In **Authentication → URL Configuration** set the Site URL to the site's address (for local testing, `http://localhost:4321`) and add `http://localhost:4321/research/` and the production `/research/` URL to the redirect list, so password-reset links land on the Research page.
4. Put the URL and key in `content/site.json` under `supabase`, or set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the environment of the server. Rebuild.
5. Optional: **Authentication → Providers → Email** lets you turn off "Confirm email" while testing; leave it on in production.

Without a URL and key configured, the gate is off and the research data is served openly, which is the right behaviour on a developer's machine and nowhere else.

### Live training registration

Every upcoming session gets its own registration page at `/live-training/register/<slug>/` (the Register buttons point there; set `externalRegisterUrl` on a session to send people elsewhere instead). The form asks for full name, email, WhatsApp number, profession, academic qualification, and a password with confirmation. Submitting it:

1. Creates the member's VIDIKSHA account in Supabase Auth with those details, or signs into the existing account when the email is already registered and the password matches. The `handle_new_user` trigger fills `profiles` (now with `whatsapp`, `profession`, `qualification`) and writes a row to `training_registrations`; for an existing member the page inserts that row itself. Run `supabase/migrations/0002_training_registrations.sql` once to add these. `registration_overview` is the dashboard view.
2. Posts the non-secret details to the Google Sheet. On the static site the browser posts straight to the Apps Script web app; when running `serve.js` locally it posts to `/api/register-session`, which keeps a copy in `data/registrations.jsonl` and forwards to the sheet.

**Google Sheet.** The sheet at the `registrationsSheet` address in `site.json` receives one row per registration through a Google Apps Script web app, because a website cannot write to a sheet without Google credentials. Install it once from the Google account that owns the sheet: open the sheet, Extensions → Apps Script, paste `google-sheets/registrations-webhook.gs`, Deploy → New deployment → Web app, execute as yourself, access "Anyone", copy the `/exec` URL into `sheetWebhook` in `site.json` (or `SHEET_WEBHOOK_URL` in the server environment) and restart the server. The script creates a "Registrations" tab with headers on the first row it receives: timestamp, session, date, name, email, WhatsApp, profession, qualification, account status, source. Passwords never reach the sheet or the server.

If a member's email already has an account but the password typed does not match it, the registration is still recorded in the sheet and the local log with the status "existing account, password did not match", and the member is told to log in or reset the password; it is not written to Supabase until they do.

### Course enrolment and payments (Razorpay)

"Enrol now" on a course with `enrolOpen: true` opens `/courses/<slug>/enrol/`: a form for full name, email, WhatsApp number, profession, organisation and the postal address for the IP Prosecution Kit, then the Razorpay payment window. The order of events, and where each piece runs:

1. The browser posts the form to the Supabase Edge Function `payments` (`supabase/functions/payments/index.ts`) at `/create-order`. The function looks the price up in the `course_prices` table (never trusting the browser), creates a Razorpay order for that amount, stores a `course_enrolments` row with status `created`, and returns the order id and the public key id.
2. Razorpay Checkout (`checkout.razorpay.com/v1/checkout.js`, loaded only on the enrol page) opens with the order, prefilled with name, email and phone. UPI, cards, net banking and wallets are Razorpay's business.
3. On success the browser sends the order id, payment id and signature to `/verify`. The function recomputes the HMAC-SHA256 signature with the key secret; only if it matches does it mark the enrolment `paid` and post the row to the Google Sheet (tab "Course enrolments"). The sheet row is therefore written only after a verified successful payment, and never by the browser.
4. Razorpay also calls `/webhook` (`payment.captured`, `payment.failed`) so that a payer who closes the tab before step 3 is still recorded. Both paths are idempotent: one row per order, one sheet row per enrolment.

Set-up, once:

1. Run `supabase/migrations/0004_course_enrolments.sql` in the SQL editor. It creates `course_prices` (seeded with Trademark Prosecution in Practice at ₹7,999), `course_enrolments` and the `enrolment_overview` view. Change a price by editing `course_prices`; the number in the course JSON is only what the page displays.
2. Deploy the function and give it its secrets. With the Supabase CLI (`npm i -g supabase` or `npx supabase`), from the project folder:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project ref>
   npx supabase secrets set RAZORPAY_KEY_ID=rzp_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx SHEET_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
   npx supabase functions deploy payments --no-verify-jwt
   ```
   Key id and secret come from Razorpay → Account & Settings → API Keys (test keys first, live keys when you go live). `--no-verify-jwt` is needed because buyers are not logged in; the function has its own checks.
3. In Razorpay → Account & Settings → Webhooks, add `https://<project ref>.supabase.co/functions/v1/payments/webhook` with a secret of your choosing (the same string you set as `RAZORPAY_WEBHOOK_SECRET`), events `payment.captured` and `payment.failed`.
4. Redeploy the Apps Script as a new version (the file now routes `type: "enrolment"` to the "Course enrolments" tab): Deploy → Manage deployments → pencil → Version: New version → Deploy. The URL does not change.
5. `GET https://<project ref>.supabase.co/functions/v1/payments/status` reports whether the keys, webhook secret, sheet URL, email key and GSTIN are set.

Secrets live only in Supabase's secret store. Nothing in this repository, the built site or the Google Sheet contains a Razorpay secret.

#### After the payment: account, invoice, welcome email

Once a payment is verified (by `/verify` or the webhook), the function runs four idempotent steps for that enrolment, retrying any that failed on the next call for the same order:

1. **Account.** Looks the buyer up by email (`find_user_id_by_email`). New buyers get a VIDIKSHA account in Supabase Auth, email confirmed, with a generated 14-character password; the existing `handle_new_user` trigger fills `profiles`. Existing members keep their account and password. `course_enrolments.user_id` and `account_status` record which happened. The same account signs in to the Research tab now and to the learning portal at portal.vidiksha.in later; the view `course_access` lists who owns which course for the portal to read.
2. **Invoice number.** `assign_invoice_number` issues consecutive numbers per Indian financial year, `VID/26-27/0001`, from `invoice_counters`.
3. **Welcome email** from `noreply@vidiksha.in` through Resend: the course, the amount, the login email and password (new accounts) or a reminder plus reset link (existing), what happens next, and the **tax invoice cum payment receipt** attached as a PDF generated by `supabase/functions/payments/invoice.ts`. With `INVOICE_GSTIN` set the PDF shows taxable value and CGST+SGST (buyer in the seller's state) or IGST; without it, a plain invoice. The Razorpay payment id, order id, method and time appear in the receipt block. `welcome_sent_at` marks it done.
4. **Sheet row**, as before, now including the invoice number and payment method.

Run `supabase/migrations/0005_course_welcome.sql` once, then set the extra secrets:

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx INVOICE_SELLER_ADDRESS="Registered office address, City, State 000000" INVOICE_SELLER_STATE="Maharashtra"
```

Optional: `INVOICE_GSTIN` once registered, `PORTAL_URL=https://portal.vidiksha.in` once the portal is live (until then the email says it opens shortly and the button goes to the Research login), `ACCESS_NOTE` to change the recordings sentence, `MAIL_FROM` / `MAIL_REPLY_TO` to change sender and reply-to. Without `RESEND_API_KEY` the email step is skipped and logged; the payment, account and invoice number still go through, and the email is sent on the next webhook retry once the key exists.

**Resend set-up (once).** Create an account at resend.com, **Domains → Add domain** `vidiksha.in`, and add the DNS records it shows at Hostinger (hPanel → Domains → vidiksha.in → DNS / Name servers): one TXT for SPF on `send` (or the root, as Resend specifies), one TXT for DKIM (`resend._domainkey`), one MX on `send`, and a DMARC TXT on `_dmarc` such as `v=DMARC1; p=none; rua=mailto:team@vidiksha.in`. Wait for "Verified", then **API Keys → Create** with sending access and set it as `RESEND_API_KEY`. The same account's SMTP (`smtp.resend.com`, user `resend`, password = API key) can be entered in Supabase **Authentication → SMTP Settings** so password-reset and confirmation emails also leave from noreply@vidiksha.in.

### Emails from noreply@vidiksha.in

Out of the box, confirmation and reset emails come from Supabase's shared sender, which is rate-limited (a few emails an hour) and not branded. Once the vidiksha.in domain exists:

1. Pick a transactional email provider and verify the domain there (Resend, Postmark, Amazon SES, Brevo and SendGrid all work; Resend is the least setup). The provider gives you SMTP credentials and the DNS records (SPF, DKIM, usually a DMARC record) to add at the domain registrar. Without those records, mail from noreply@vidiksha.in lands in spam or is rejected.
2. In Supabase, **Authentication → Emails → SMTP Settings**: enable custom SMTP, sender email `noreply@vidiksha.in`, sender name `VIDIKSHA`, then the provider's host, port, username and password. Save. From that moment every auth email leaves under the VIDIKSHA address and the rate limit becomes the provider's.
3. **Authentication → Emails → Templates**: paste the branded templates from `supabase/email-templates/` into "Confirm sign up", "Reset password" and "Change email address", with the subjects noted at the top of each file. They use Supabase's template variables and the site's typography and colours.
4. **Authentication → URL Configuration**: change the Site URL and redirect list from localhost to `https://vidiksha.in` and `https://vidiksha.in/research/`.

Reply-to can be set to team@vidiksha.in in the same SMTP screen if you want members to be able to answer.

On GitHub Pages there is no server, so the gate is Supabase's own: the research data sits in a private Storage bucket whose read policy admits authenticated members only, and the page fetches it with the member's session token. Locally, `serve.js` plays the same role for files in `dist/research/`.

## Research: the IP case-law repository

`/research/` is a client-side search over Indian IP judgments, built from [Open India Law](https://github.com/Vaquill-AI/open-india-law) (Vaquill AI, CC BY 4.0; attribution is a licence condition and is printed on the page).

There is no server and no AI anywhere in it: everything is prepared at build time and searched in the browser.

How it works:

1. `scripts/research-index.py` queries the judgment parquet files on the public mirror with DuckDB over HTTP. Nothing is downloaded to disk; only the text columns are streamed. A judgment is kept when any part of its text mentions an IP marker: an IP statute (Trade Marks, Patents, Copyright, Designs, GI, Plant Varieties, Semiconductor), an IP doctrine (passing off, deceptive similarity, well-known mark, prior user, Anton Piller or John Doe orders) or an IP authority (Registrar of Trade Marks, Controller of Patents, IPAB), or when its registry number is an IP Division category. For snapshot v2026.08.1 this gives 12,867 judgments across the Supreme Court and the Delhi, Bombay, Madras, Calcutta and Karnataka High Courts (12,157 by the text markers alone, plus 710 IP Division matters caught by registry number). Each kept judgment gets its areas, a key passage (the highest-priority section the source pipeline detected) and the metadata the corpus carries. Output: `content/research/<court>.json` plus `content/research/<court>.tokens.jsonl.gz`, the distinct tokens of each judgment's full text.
2. `npm run build` merges those files, cleans titles and party names, shards the records by year into `dist/research/data/<year>.json`, writes `manifest.json` with counts by year, court, area and outcome, and builds the full-text index: every token of every judgment goes into an inverted index sharded by hash into 128 files under `dist/research/fts/` (about 21 MB in total, 165 KB per shard). Tokens present in more than 35% of judgments are dropped as stopwords.
   Facets are derived at the same time, all by fixed rules in `scripts/research_tags.py` and `build.js`: legal issues (about 35, from phrase patterns with a minimum hit count), industries, statutes cited, proceeding type (from the registry number and the parties), bench strength (from the coram), judgment length (from the chunk count) and the most frequent judges. Edit the pattern tables to add or rename a facet; every tag is traceable to the words that triggered it.
3. `src/scripts/research.js` loads the manifest, then the year shards newest-first, and filters in the browser. Facet counts are recomputed against the current results (each facet counted over judgments that pass every other filter), active filters show as removable chips, and tags on a result can be clicked to apply them as filters. For each keyword it fetches only the index shards for that keyword's tokens, so a search costs a few hundred kilobytes, not the whole index. A keyword matches a judgment when it appears in the metadata or key passage, or when every token of it appears in the judgment's full text. Keywords are AND-ed. Section references are tokenised specially so "section 29", "9(1)(b)" and "3(d)" work. Results are always sorted newest first. Search state lives in the URL, so a search can be shared.

4. Each result can open its **relevant paragraphs** or the **whole judgment**. The judgment text is published as one JSON file per judgment under `dist/research/text/` (paragraphs with page numbers, overlaps between the source's text chunks removed), fetched only when a result is opened. The browser scores every paragraph against the keywords and the selected legal-issue patterns (`dist/research/issues.json`, the same rules that produced the facet) and shows the top five with the matches highlighted, or all paragraphs with the matching ones marked. The first three results of any active search open automatically. Nothing is summarised or generated; the paragraphs are the judgment's own.
5. **Official PDF links.** The corpus carries no document URLs, but the judgment PDFs are public on the AWS Open Data Registry (Dattam Labs mirrors of judgments.ecourts.gov.in and scr.sci.gov.in, CC BY 4.0). `scripts/research-links.py` resolves each High Court judgment by listing its CNR prefix in the bucket's year/court/bench partition, and each Supreme Court judgment through the dataset's per-year metadata, and writes `content/research/links.json`. The build attaches the link as "Official PDF"; a judgment that could not be matched gets a link to the eCourts search page instead.

To refresh or extend the index:

```bash
pip install duckdb
python scripts/research-index.py supreme-court delhi bombay madras calcutta karnataka
python scripts/research-index.py gujarat telangana        # add more courts
python scripts/research-index.py --all                    # every court (streams ~27 GB of text; hours)
python scripts/research-links.py                          # official PDF links (one S3 listing per judgment; minutes)
npm run build
```

Where the data lives: a local build writes it to `dist/research/` (about 13,000 small files, 280 MB) for `serve.js`; the production build leaves it out and the page reads it from the private Supabase Storage bucket instead (see Deployment). `.tokens.jsonl.gz` and `.text.jsonl.gz` are not committed, since the index script regenerates them; the per-court JSON records and `links.json` are.

A court takes a few minutes per gigabyte of text at typical mirror throughput. The six courts above are the Supreme Court and the High Courts that carry India's IP docket. When Open India Law publishes a new snapshot, change `BASE` in the script and re-run. The tokeniser lives in both `scripts/research-index.py` and `src/scripts/research.js`; if you change one, change the other.

The corpus does not carry judgment URLs, so each result shows its identifiers (registry number, neutral citation, CNR-style id) and a "Find the full judgment" search link. Nothing here is legal advice; the page says so.

## Learning portal and control panel (lms/)

Two more static apps live in `lms/`, sharing one Supabase project with the site:

- **Learning portal**, `lms/portal/`, for portal.vidiksha.in. Students sign in with the account created at purchase (the credentials in the welcome email). Dashboard with their courses and progress, each course's recorded sessions (video player with resume, mark as completed), materials, assignments with file upload and feedback, announcements, messages with the team, profile and password, invoices.
- **Control panel**, `lms/control/`, for control.vidiksha.in. Staff only. Overview numbers; every member with search, filters and CSV export; each member's enrolments, grants, training registrations, progress, submissions, messages and activity; all enrolments with payment and kit-address details; training registrations by session; per-course content (sessions with video link or upload, drip release dates, publish toggle; materials; assignments; students; batches); a grading queue; announcements for everyone or one course; messages; a blog editor that publishes to vidiksha.in; team management (admins add staff by email).

Both are plain HTML, CSS and JavaScript talking straight to Supabase with the publishable key. There is no server of ours: every permission is a row level security policy in `supabase/migrations/0006_lms.sql`. Videos, materials and submissions sit in private storage buckets (`lms-videos`, `lms-materials`, `lms-submissions`) and are served through short-lived signed URLs to people the policies allow.

**Run locally** (the apps stay on localhost until you are ready to publish them):

```bash
node lms/serve.js
```

Portal at http://localhost:4322, control panel at http://localhost:4323. `.claude/launch.json` has entries `lms` and `control` for the preview pane.

**Set-up, once:**

1. Run `supabase/migrations/0006_lms.sql` in the SQL editor.
2. Make yourself an admin, in the SQL editor: `select public.make_admin('you@example.com');` (the email of your existing VIDIKSHA account). Admins add further staff from the control panel's Team page.
3. Blog publishing needs a GitHub token: on github.com as `vidiksha-ip`, Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate. Resource owner `vidiksha-ip`, repository access: only `vidiksha-site`, permission **Contents: Read and write**. Then `npx supabase secrets set GITHUB_TOKEN=github_pat_…` and `npx supabase functions deploy publish-post --no-verify-jwt`. A post written in the control panel becomes `content/blog/<slug>.md` in the repository and the site rebuilds itself.
4. When the portal goes live, tell the payments function so the welcome email links to it: `npx supabase secrets set PORTAL_URL=https://portal.vidiksha.in`. Also add `https://portal.vidiksha.in/` to Supabase → Authentication → URL Configuration → Redirect URLs, so password resets from the portal land back on it.

**Videos.** Add a session in the control panel and either paste a link (YouTube unlisted, Vimeo, Loom or Google Drive; the player embeds it) or upload an mp4 to the private bucket. Uploaded files stream only to students with access, through signed URLs that expire in three hours. On the Supabase free plan the per-file upload limit is 50 MB, so two-hour recordings need either the Pro plan (files up to 50 GB, 100 GB storage included) or a video host: Vimeo (unlisted, domain-restricted embeds) or Bunny Stream are the usual choices for paid courses because they stop casual downloading; YouTube unlisted is free but anyone with the link can watch.

**Publishing the two apps.** `node lms/build.js` writes `lms/dist/portal` and `lms/dist/control`, each self-contained with a `CNAME` file. GitHub Pages serves one site per repository, so create two more repositories under `vidiksha-ip` (for example `vidiksha-portal`, `vidiksha-control`), push the matching `dist` folder to each (or add a workflow like `.github/workflows/pages.yml` that runs `node lms/build.js` and uploads the folder), enable Pages, set the custom domain, and add two CNAME records at Hostinger: `portal` → `vidiksha-ip.github.io` and `control` → `vidiksha-ip.github.io`. Until then both apps run on localhost only.

**Access rules in one paragraph.** A student has a course for 2 months from payment (`course_enrolments`, status paid) or for as long as a grant says (`course_grants`, added from the member page in the control panel). Students see only published sessions whose release date has passed, materials and published assignments of courses they hold, announcements for everyone or for their courses, and their own submissions, progress, messages and invoices. Staff (`public.staff`) see and edit everything; only admins change the staff list. `course_access` is the view the portal, and any future system, can read to know who owns which course.

## Things to change before launch

All of these are in `content/site.json` unless noted.

- `url`: the production domain. Used for canonical links, OpenGraph, sitemap and RSS.
- `formEndpoint`: the newsletter and contact forms POST here. Any form backend that accepts a `multipart/form-data` POST works (Formspree, Basin, Netlify Forms, your own endpoint). While it still contains `your-form-id`, the forms show a success message without sending anything.
- `social`, `email`, `legalName`.
- `registerUrl` / `replayUrl` in each training session point at placeholder paths on the production domain; courses without `enrolOpen` show "Ask about this course".
- `src/assets/og-default.svg`: replace with a 1200×630 PNG or JPG if you want link previews on platforms that do not render SVG, and update the `image` default in `lib/html.js`.

## Changing the design

Colours, fonts and spacing are CSS custom properties at the top of `src/styles/main.css`. The system is monochrome: near-white paper (`#fafaf9`), near-black ink (`#0f0e0d`), warm greys, hairline borders and square controls, with one deep green (`#1d4a39`) used only for small marks. The textured green, olive and slate panels on the home page are pure CSS (`.hero-visual`, `.offer-*`), so there are no image assets to maintain. Fonts are Newsreader (display, regular weight) and Instrument Sans (body) from Google Fonts; the `<link>` is in `lib/html.js`.

Fade-in animation is opt-in per element with the `reveal` class and is disabled automatically for users who prefer reduced motion. The site is fully usable with JavaScript off.
