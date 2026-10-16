// VIDIKSHA payments: Razorpay orders, payment verification and the enrolment record.
//
// Routes (all under /functions/v1/payments):
//   POST /create-order   form details + course_slug  -> Razorpay order (server-side price) + pending enrolment row
//   POST /verify         order id, payment id, signature from Checkout -> marks paid, writes the Google Sheet row
//   POST /webhook        Razorpay webhook (payment.captured / payment.failed) -> same, for browsers that closed early
//   GET  /status         health check
//
// Deploy:  supabase functions deploy payments --no-verify-jwt
// Secrets: supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... SHEET_WEBHOOK_URL=...
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
// The Google Sheet row is written only after a verified successful payment, never from the browser.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RZP_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RZP_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
const RZP_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
const SHEET_URL = Deno.env.get("SHEET_WEBHOOK_URL") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://vidiksha.in,https://www.vidiksha.in,http://localhost:4321").split(",").map((s) => s.trim());

type Json = Record<string, unknown>;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: Json, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

/* ---- database (PostgREST with the service role) ---- */
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`db ${path}: ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
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

async function sendToSheet(row: Json) {
  if (!SHEET_URL) return false;
  try {
    const r = await fetch(SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(row), redirect: "follow" });
    const text = await r.text();
    return r.ok && /"ok"\s*:\s*true/.test(text);
  } catch (e) {
    console.error("sheet failed", String(e));
    return false;
  }
}

/** Mark an enrolment paid (idempotent) and write the sheet row once. */
async function markPaid(orderId: string, paymentId: string) {
  const rows = await db(`course_enrolments?razorpay_order_id=eq.${encodeURIComponent(orderId)}&select=*`);
  const e = rows?.[0];
  if (!e) throw new Error(`no enrolment for order ${orderId}`);
  if (e.status !== "paid") {
    await db(`course_enrolments?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() }) });
  }
  if (!e.sheet_sent_at) {
    const ok = await sendToSheet({
      type: "enrolment", received_at: new Date().toISOString(),
      course: e.course_title, course_slug: e.course_slug, amount_inr: e.amount_inr,
      payment_id: paymentId, order_id: orderId,
      full_name: e.full_name, email: e.email, whatsapp: e.whatsapp, profession: e.profession, organisation: e.organisation,
      address_line: e.address_line, city: e.city, state: e.state, pincode: e.pincode, status: "paid",
    });
    if (ok) await db(`course_enrolments?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ sheet_sent_at: new Date().toISOString() }) });
  }
  return e;
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
  return json({ ok: true, course: e.course_title, email: e.email }, 200, origin);
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
    if (path.endsWith("/status")) return json({ ok: true, razorpay: !!(RZP_KEY_ID && RZP_KEY_SECRET), webhook: !!RZP_WEBHOOK_SECRET, sheet: !!SHEET_URL }, 200, origin);
    return json({ error: "Not found" }, 404, origin);
  } catch (e) {
    console.error(String(e));
    return json({ error: "Something went wrong on our side. Nothing has been charged." }, 500, origin);
  }
});
