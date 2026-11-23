# Vidiksha IP — firm website

Website for Vidiksha IP, a boutique trademark law firm in India. A static site built by a small, dependency-free Node script: content lives in JSON and Markdown under `content/`, the build turns it into plain HTML in `dist/`. No framework, no npm packages.

## Run it

```bash
npm run build      # content/ + src/ -> dist/
npm run dev        # build, then serve dist/ at http://localhost:4321
```

Requires Node 18 or newer.

## Content

| Where | What |
|---|---|
| `content/site.json` | Firm name, contact details, navigation, the founder block (name, role, photo, bio) and all the copy on the home, firm and contact pages. Fill in `phone` and `offices` before launch. |
| `content/practice/*.json` | One file per practice area. `order` sets the sequence; `categories` links the area to related insight articles. |
| `content/insights/*.md` | Articles. Front matter needs `title`, `description`, `date` and a `category` from: Prosecution, Oppositions, Enforcement, Licensing, Portfolio, Strategy. |

The Bar Council disclaimer shown on first visit is in `site.json` under `disclaimer`. The enquiry form posts to `formEndpoint`; until that is set to a real endpoint (for example a Formspree form), submissions are acknowledged on the page but not sent anywhere.

## Deployment

The site publishes to GitHub Pages at the domain in `site.json`. `.github/workflows/pages.yml` runs `node build.js --production` and publishes `dist/` on every push to `main`. The production build writes the `CNAME` file for the custom domain.

## Legacy

`_legacy/` holds the previous education-platform code (courses, live training, research database, learning portal and the Supabase and Google Sheets integrations). It is not part of the build and can be deleted once nothing in it is needed.
