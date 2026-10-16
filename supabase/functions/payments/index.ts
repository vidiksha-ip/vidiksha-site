// VIDIKSHA payments: Razorpay orders, payment verification, the enrolment record, the buyer's account,
// the invoice and the welcome email.
//
// Routes (all under /functions/v1/payments):
//   POST /create-order   form details + course_slug  -> Razorpay order (server-side price) + pending enrolment row
//   POST /verify         order id, payment id, signature from Checkout -> marks paid, then account + invoice + email + sheet
//   POST /webhook        Razorpay webhook (payment.captured / payment.failed) -> same, for browsers that closed early
//   POST /retry          order id + payment id of a captured payment -> re-runs the steps above, reports what failed
//   GET  /status         health check: which secrets are present
//
// Deploy:  supabase functions deploy payments --no-verify-jwt
// Secrets (supabase secrets set ...):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, SHEET_WEBHOOK_URL
//   RESEND_API_KEY            Resend API key; without it the welcome email is skipped and logged
//   MAIL_FROM                 default "VIDIKSHA <noreply@vidiksha.in>"      MAIL_REPLY_TO  default team@vidiksha.in
//   PORTAL_URL                leave unset until the learning portal is live; then https://portal.vidiksha.in
//   SITE_URL                  default https://vidiksha.in
//   ACCESS_NOTE               the "what happens next" line about recordings (default below)
//   INVOICE_SELLER_NAME       default "Vidiksha Learning LLP"
//   INVOICE_SELLER_ADDRESS    registered address printed on the invoice
//   INVOICE_SELLER_STATE      state of the registered address (decides CGST+SGST vs IGST)
//   INVOICE_GSTIN             leave empty until registered; then the PDF becomes a tax invoice with the GST break-up
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
//
// Everything after "marks paid" is idempotent and retried on the next /verify or webhook call for the same order,
// so a failed email or sheet post never loses a payment and never repeats a step that already succeeded.

import { buildInvoicePdf, toBase64 } from "./invoice.ts";
import { sendMail, type WelcomeMail } from "./email.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const RZP_KEY_ID = env("RAZORPAY_KEY_ID"), RZP_KEY_SECRET = env("RAZORPAY_KEY_SECRET"), RZP_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET");
const SHEET_URL = env("SHEET_WEBHOOK_URL");
const RESEND_KEY = env("RESEND_API_KEY");
const MAIL_FROM = env("MAIL_FROM", "VIDIKSHA <noreply@vidiksha.in>"), MAIL_REPLY_TO = env("MAIL_REPLY_TO", "team@vidiksha.in");
const PORTAL_URL = env("PORTAL_URL"), SITE_URL = env("SITE_URL", "https://vidiksha.in");
const ACCESS_NOTE = env("ACCESS_NOTE", PORTAL_URL
  ? "Your recorded sessions are open on the learning portal for 2 months from today. Watch them in order; each ends with a practice exercise."
  : "Your recorded sessions will be opened to you on the learning portal, and we will email you the moment they are ready. Your 2 months of access start from that day, not today.");
const SELLER = { name: env("INVOICE_SELLER_NAME", "Vidiksha Learning LLP"), address: env("INVOICE_SELLER_ADDRESS", "India"), state: env("INVOICE_SELLER_STATE"), gstin: env("INVOICE_GSTIN"), email: MAIL_REPLY_TO, website: SITE_URL.replace(/^https?:\/\//, "") };
const ALLOWED_ORIGINS = env("ALLOWED_ORIGINS", "https://vidiksha.in,https://www.vidiksha.in,http://localhost:4321").split(",").map((s) => s.trim());

type Json = Record<string, unknown>;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Vary": "Origin" };
}
function json(body: Json, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

/* ---- database (PostgREST with the service role) ---- */
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers as Record<string, string> || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`db ${path}: ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const rpc = (fn: string, args: Json) => db(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
const patch = (id: string, body: Json) => db(`course_enrolments?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });

/* ---- Supabase Auth admin ---- */
async function authAdmin(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers as Record<string, string> || {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`auth ${path}: ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}
function makePassword(len = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s.slice(0, 5) + "-" + s.slice(5, 10) + "-" + s.slice(10);
}
/** Finds or creates the buyer's VIDIKSHA account. Returns the password only when the account is new. */
async function ensureAccount(e: Record<string, string>) {
  const existing = await rpc("find_user_id_by_email", { addr: e.email });
  if (existing) return { status: "existing" as const, userId: existing as string };
  const password = makePassword();
  const user = await authAdmin("users", {
    method: "POST",
    body: JSON.stringify({
      email: e.email, password, email_confirm: true,
      user_metadata: { full_name: e.full_name, whatsapp: e.whatsapp, profession: e.profession, organisation: e.organisation, role: e.profession, source: "course-purchase", course: e.course_slug },
    }),
  });
  return { status: "created" as const, userId: user.id as string, password };
}

/* ---- crypto ---- */
async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/* ---- helpers ---- */
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const cleanMulti = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);

async function razorpayPayment(paymentId: string) {
  try {
    const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, { headers: { Authorization: "Basic " + btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`) } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
function methodLabel(p: Record<string, unknown> | null) {
  if (!p) return "Online (Razorpay)";
  const m = String(p.method || "");
  if (m === "card") { const c = p.card as Record<string, string> | undefined; return `Card${c?.network ? " (" + c.network + (c.last4 ? " ending " + c.last4 : "") + ")" : ""}`; }
  if (m === "upi") return "UPI";
  if (m === "netbanking") return `Net banking${p.bank ? " (" + p.bank + ")" : ""}`;
  if (m === "wallet") return `Wallet${p.wallet ? " (" + p.wallet + ")" : ""}`;
  if (m === "emi") return "EMI";
  return m ? m[0].toUpperCase() + m.slice(1) : "Online (Razorpay)";
}

async function sendToSheet(row: Json) {
  if (!SHEET_URL) return false;
  try {
    const r = await fetch(SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(row), redirect: "follow" });
    const text = await r.text();
    return r.ok && /"ok"\s*:\s*true/.test(text);
  } catch (e) { console.error("sheet failed", String(e)); return false; }
}

/** Mark an enrolment paid, then account -> invoice -> welcome email -> sheet. Every step idempotent. */
async function markPaid(orderId: string, paymentId: string) {
  const rows = await db(`course_enrolments?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*`);
  let e = rows?.[0];
  if (!e) throw new Error(`no enrolment for order ${orderId}`);
  const errors: string[] = [];
  const fail = (step: string, err: unknown) => { const m = `${step}: ${String(err).slice(0, 300)}`; console.error(m); errors.push(m); };

  if (e.status !== "paid") {
    const p = await razorpayPayment(paymentId);
    const upd = { status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString(), payment_method: methodLabel(p) };
    await patch(e.id, upd);
    e = { ...e, ...upd };
  }

  // 1. The buyer's VIDIKSHA account (also used by the learning portal).
  let password: string | undefined;
  if (!e.user_id) {
    try {
      const acc = await ensureAccount(e);
      password = acc.password;
      await patch(e.id, { user_id: acc.userId, account_status: acc.status });
      e = { ...e, user_id: acc.userId, account_status: acc.status };
    } catch (err) { fail("account", err); }
  }

  // 2. Invoice number (consecutive per financial year).
  if (!e.invoice_no) {
    try {
      const no = await rpc("assign_invoice_number", { enrolment: e.id });
      e = { ...e, invoice_no: no, invoice_at: new Date().toISOString() };
    } catch (err) { fail("invoice number", err); }
  }

  // 3. Welcome email with credentials and the invoice PDF. Skipped (and retried later) if the account or
  //    invoice step failed, since the email must not go out without them.
  if (!e.welcome_sent_at && e.user_id && e.invoice_no) {
    if (!RESEND_KEY) fail("welcome email", "RESEND_API_KEY not set");
    else {
      try {
        if (e.account_status === "created" && !password) {
          // Account was created on an earlier attempt whose email failed: issue a fresh password so the email is complete.
          password = makePassword();
          await authAdmin(`users/${e.user_id}`, { method: "PUT", body: JSON.stringify({ password }) });
        }
        const pdf = buildInvoicePdf({
          invoiceNo: e.invoice_no, invoiceDate: new Date(e.invoice_at || e.paid_at), seller: SELLER,
          buyer: { name: e.full_name, email: e.email, phone: e.whatsapp || "", organisation: e.organisation || "", address: e.address_line || "", city: e.city || "", state: e.state || "", pincode: e.pincode || "" },
          item: { title: e.course_title, description: "Online course: recorded sessions, practice exercises, email support, community membership and the IP Prosecution Kit.", sac: "999293" },
          amountInr: Number(e.amount_inr),
          payment: { id: paymentId, orderId, method: e.payment_method || "Online (Razorpay)", paidAt: new Date(e.paid_at) },
        });
        const mail: WelcomeMail = {
          to: e.email, name: e.full_name, course: e.course_title, amountInr: Number(e.amount_inr), invoiceNo: e.invoice_no, paymentId,
          portalUrl: PORTAL_URL, researchUrl: `${SITE_URL}/research/`,
          account: { status: e.account_status === "created" ? "created" : "existing", email: e.email, password, resetUrl: `${SITE_URL}/research/` },
          kit: true,
          accessNote: ACCESS_NOTE,
          pdf: { filename: `VIDIKSHA-invoice-${e.invoice_no.replace(/\//g, "-")}.pdf`, base64: toBase64(pdf) },
        };
        await sendMail(RESEND_KEY, MAIL_FROM, MAIL_REPLY_TO, mail);
        await patch(e.id, { welcome_sent_at: new Date().toISOString() });
        e = { ...e, welcome_sent_at: new Date().toISOString() };
      } catch (err) { fail("welcome email", err); }
    }
  }

  // 4. Google Sheet row.
  if (!e.sheet_sent_at) {
    const ok = await sendToSheet({
      type: "enrolment", received_at: new Date().toISOString(),
      course: e.course_title, course_slug: e.course_slug, amount_inr: e.amount_inr, invoice_no: e.invoice_no,
      payment_id: paymentId, order_id: orderId, payment_method: e.payment_method,
      full_name: e.full_name, email: e.email, whatsapp: e.whatsapp, profession: e.profession, organisation: e.organisation,
      address_line: e.address_line, city: e.city, state: e.state, pincode: e.pincode, status: "paid",
    });
    if (ok) await patch(e.id, { sheet_sent_at: new Date().toISOString() });
    else fail("sheet", "webhook did not answer ok");
  }
  return { ...e, errors };
}

/* ---- routes ---- */
async function createOrder(req: Request, origin: string | null) {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET) return json({ error: "Payments are not configured yet." }, 503, origin);
  const b = await req.json().catch(() => ({})) as Json;
  const f = {
    course_slug: clean(b.course_slug, 120), full_name: clean(b.full_name, 120), email: clean(b.email, 200).toLowerCase(),
    whatsapp: clean(b.whatsapp, 30), profession: clean(b.profession, 80), organisation: clean(b.organisation, 160),
    address_line: cleanMulti(b.address_line, 400), city: clean(b.city, 80), state: clean(b.state, 80), pincode: clean(b.pincode, 10),
  };
  if (!f.course_slug || f.full_name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) || !/^\+?[0-9][0-9 \-]{7,16}$/.test(f.whatsapp) || !f.profession || f.address_line.length < 8 || !f.city || !f.state || !/^\d{6}$/.test(f.pincode)) {
    return json({ error: "Please complete every field. The PIN code needs six digits and the WhatsApp number a country code." }, 400, origin);
  }
  const prices = await db(`course_prices?slug=eq.${encodeURIComponent(f.course_slug)}&active=is.true&select=slug,title,price_inr`);
  const course = prices?.[0];
  if (!course) return json({ error: "This course is not open for enrolment." }, 404, origin);

  const receipt = `enr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: course.price_inr * 100, currency: "INR", receipt, notes: { course: course.slug, email: f.email, name: f.full_name } }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok) { console.error("razorpay order failed", order); return json({ error: "Could not start the payment. Try again in a moment." }, 502, origin); }

  await db("course_enrolments", { method: "POST", body: JSON.stringify({ ...f, course_title: course.title, amount_inr: course.price_inr, razorpay_order_id: order.id, status: "created" }) });
  return json({
    ok: true, key_id: RZP_KEY_ID, order_id: order.id, amount: order.amount, currency: order.currency,
    name: "VIDIKSHA", description: course.title, prefill: { name: f.full_name, email: f.email, contact: f.whatsapp },
  }, 200, origin);
}

async function verify(req: Request, origin: string | null) {
  const b = await req.json().catch(() => ({})) as Json;
  const orderId = clean(b.razorpay_order_id, 80), paymentId = clean(b.razorpay_payment_id, 80), sig = clean(b.razorpay_signature, 200);
  if (!orderId || !paymentId || !sig) return json({ error: "Missing payment details." }, 400, origin);
  const expected = await hmacHex(RZP_KEY_SECRET, `${orderId}|${paymentId}`);
  if (!safeEqual(expected, sig)) return json({ error: "Payment could not be verified." }, 400, origin);
  const e = await markPaid(orderId, paymentId);
  return json({ ok: true, course: e.course_title, email: e.email, account: e.account_status || null, welcomed: !!e.welcome_sent_at, invoice: e.invoice_no || null, errors: e.errors }, 200, origin);
}

/** Re-runs the post-payment steps for a payment Razorpay confirms as captured. Idempotent, so safe to call again;
 *  used when an email or sheet step failed after the browser had already left. Needs both ids. */
async function retry(req: Request, origin: string | null) {
  const b = await req.json().catch(() => ({})) as Json;
  const orderId = clean(b.razorpay_order_id, 80), paymentId = clean(b.razorpay_payment_id, 80);
  if (!orderId || !paymentId) return json({ error: "Missing order or payment id." }, 400, origin);
  const p = await razorpayPayment(paymentId);
  if (!p || p.order_id !== orderId || p.status !== "captured") return json({ error: "Razorpay does not confirm this payment as captured." }, 400, origin);
  const e = await markPaid(orderId, paymentId);
  return json({ ok: true, status: e.status, account: e.account_status || null, invoice: e.invoice_no || null, welcomed: !!e.welcome_sent_at, sheet: !!e.sheet_sent_at, errors: e.errors }, 200, origin);
}

async function webhook(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!RZP_WEBHOOK_SECRET) { console.error("webhook secret not set"); return new Response("not configured", { status: 503 }); }
  const expected = await hmacHex(RZP_WEBHOOK_SECRET, raw);
  if (!safeEqual(expected, sig)) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(raw);
  const payment = event?.payload?.payment?.entity;
  try {
    if (event.event === "payment.captured" && payment?.order_id) await markPaid(payment.order_id, payment.id);
    else if (event.event === "payment.failed" && payment?.order_id) {
      await db(`course_enrolments?razorpay_order_id=eq.${encodeURIComponent(payment.order_id)}&status=eq.created`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
    }
  } catch (e) { console.error("webhook handling", String(e)); }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const path = new URL(req.url).pathname.replace(/\/$/, "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  try {
    if (path.endsWith("/create-order") && req.method === "POST") return await createOrder(req, origin);
    if (path.endsWith("/verify") && req.method === "POST") return await verify(req, origin);
    if (path.endsWith("/webhook") && req.method === "POST") return await webhook(req);
    if (path.endsWith("/retry") && req.method === "POST") return await retry(req, origin);
    if (path.endsWith("/status")) return json({ ok: true, razorpay: !!(RZP_KEY_ID && RZP_KEY_SECRET), webhook: !!RZP_WEBHOOK_SECRET, sheet: !!SHEET_URL, email: !!RESEND_KEY, gstin: !!SELLER.gstin, portal: PORTAL_URL || null }, 200, origin);
    return json({ error: "Not found" }, 404, origin);
  } catch (e) {
    console.error(String(e));
    return json({ error: "Something went wrong on our side. Nothing has been charged." }, 500, origin);
  }
});
