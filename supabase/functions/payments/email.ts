// Welcome email after a paid enrolment, sent through Resend from noreply@vidiksha.in.
// Same look as supabase/email-templates/*.html so every VIDIKSHA email matches.

export interface WelcomeMail {
  to: string;
  name: string;
  course: string;
  amountInr: number;
  invoiceNo: string;
  paymentId: string;
  portalUrl: string;          // empty until the learning portal is live
  researchUrl: string;
  account: { status: "created" | "existing"; email: string; password?: string; resetUrl: string };
  kit: boolean;
  accessNote: string;
  pdf?: { filename: string; base64: string };
}

const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

export function welcomeHtml(m: WelcomeMail) {
  const first = esc((m.name || "").trim().split(/\s+/)[0] || "there");
  const creds = m.account.status === "created"
    ? `<p style="margin:0 0 10px;">Your VIDIKSHA account has been created. ${m.portalUrl ? `These details sign you in to the learning portal at <a href="${esc(m.portalUrl)}" style="color:#1d4a39;">${esc(host(m.portalUrl))}</a> and to the case law repository on vidiksha.in:` : `These details sign you in to the case law repository on vidiksha.in now, and to the learning portal at portal.vidiksha.in when it opens:`}</p>
       <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#fafaf9;border:1px solid #e4e2dd;font-size:15px;">
         <tr><td style="padding:10px 14px;color:#6f6c66;width:120px;">Login email</td><td style="padding:10px 14px;font-weight:600;">${esc(m.account.email)}</td></tr>
         <tr><td style="padding:10px 14px;color:#6f6c66;border-top:1px solid #e4e2dd;">Password</td><td style="padding:10px 14px;font-weight:600;border-top:1px solid #e4e2dd;font-family:Menlo,Consolas,monospace;">${esc(m.account.password || "")}</td></tr>
       </table>
       <p style="margin:10px 0 0;font-size:13px;color:#6f6c66;">Please change this password after your first login (Profile page in the portal). If you ever forget it, write to <a href="mailto:team@vidiksha.in" style="color:#1d4a39;">team@vidiksha.in</a> and the team will set a new one.</p>`
    : `<p style="margin:0;">You already have a VIDIKSHA account under <strong>${esc(m.account.email)}</strong>, so this course has been added to it. Sign in with your existing password${m.portalUrl ? ` at <a href="${esc(m.portalUrl)}" style="color:#1d4a39;">${esc(host(m.portalUrl))}</a>` : ""}; if you have forgotten it, write to <a href="mailto:team@vidiksha.in" style="color:#1d4a39;">team@vidiksha.in</a> and the team will set a new one.</p>`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafaf9;padding:32px 0;font-family:Helvetica,Arial,sans-serif;color:#0f0e0d;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e4e2dd;">
      <tr><td style="padding:32px 36px 0;font-family:'Times New Roman',Times,serif;font-size:20px;letter-spacing:3px;">VIDIKSHA</td></tr>
      <tr><td style="padding:28px 36px 0;font-family:'Times New Roman',Times,serif;font-size:28px;line-height:1.2;">Welcome to ${esc(m.course)}, ${first}.</td></tr>
      <tr><td style="padding:16px 36px 0;font-size:16px;line-height:1.6;color:#33312c;">Your payment of <strong>${inr(m.amountInr)}</strong> has been received. The tax invoice and payment receipt (invoice ${esc(m.invoiceNo)}, Razorpay payment ${esc(m.paymentId)}) is attached to this email as a PDF.</td></tr>

      <tr><td style="padding:28px 36px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6f6c66;">Your login</td></tr>
      <tr><td style="padding:10px 36px 0;font-size:15px;line-height:1.6;color:#33312c;">${creds}</td></tr>
      <tr><td style="padding:22px 36px 0;">
        <a href="${esc(m.portalUrl || m.researchUrl)}" style="display:inline-block;background:#0f0e0d;color:#fafaf9;text-decoration:none;font-size:15px;font-weight:600;padding:14px 22px;">${m.portalUrl ? "Open the learning portal" : "Sign in to VIDIKSHA"}</a>
      </td></tr>

      <tr><td style="padding:28px 36px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6f6c66;">What happens next</td></tr>
      <tr><td style="padding:10px 36px 0;font-size:15px;line-height:1.7;color:#33312c;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="font-size:15px;line-height:1.6;color:#33312c;">
          <tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:#1d4a39;">01</td><td style="padding:4px 0;">${esc(m.accessNote)}</td></tr>
          <tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:#1d4a39;">02</td><td style="padding:4px 0;">Your invitation to the VIDIKSHA community of IP professionals follows separately within one working day.</td></tr>
          ${m.kit ? `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:#1d4a39;">03</td><td style="padding:4px 0;">The IP Prosecution Kit is couriered to the address you gave, within 7 working days. We will send the tracking details.</td></tr>` : ""}
          <tr><td style="padding:4px 10px 4px 0;vertical-align:top;color:#1d4a39;">${m.kit ? "04" : "03"}</td><td style="padding:4px 0;">The <a href="${esc(m.researchUrl)}" style="color:#1d4a39;">case law repository</a> on vidiksha.in, 12,000+ Indian IP judgments with full-text search, is free to use alongside the course.</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 36px 0;font-size:14px;line-height:1.6;color:#33312c;">Questions go to <a href="mailto:team@vidiksha.in" style="color:#1d4a39;">team@vidiksha.in</a>; reply to this email and it reaches the same inbox.</td></tr>
      <tr><td style="padding:24px 36px 36px;font-size:13px;line-height:1.6;color:#6f6c66;border-top:1px solid #e4e2dd;">Vidiksha Learning LLP. Nothing on VIDIKSHA is legal advice.</td></tr>
    </table>
  </td></tr>
</table>`;
}

export function welcomeText(m: WelcomeMail) {
  const login = m.account.status === "created"
    ? `Your VIDIKSHA account has been created.\nLogin email: ${m.account.email}\nPassword: ${m.account.password}\nPlease change the password after your first login. Forgotten it? Write to team@vidiksha.in.`
    : `You already have a VIDIKSHA account under ${m.account.email}; this course has been added to it. Forgotten the password? Write to team@vidiksha.in.`;
  return `Welcome to ${m.course}.\n\nYour payment of INR ${m.amountInr.toLocaleString("en-IN")} has been received. Invoice ${m.invoiceNo} (Razorpay payment ${m.paymentId}) is attached as a PDF.\n\n${login}\n\n${m.portalUrl ? "Learning portal: " + m.portalUrl : "The learning portal at portal.vidiksha.in opens shortly; the same login will work there."}\nCase law repository (free, no login): ${m.researchUrl}\n\n${m.accessNote}\nYour community invitation follows within one working day.${m.kit ? "\nThe IP Prosecution Kit is couriered to your address within 7 working days." : ""}\n\nQuestions: team@vidiksha.in\nVidiksha Learning LLP. Nothing on VIDIKSHA is legal advice.`;
}

/** Sends through Resend. Returns the provider message id, or throws. */
export async function sendMail(apiKey: string, from: string, replyTo: string, m: WelcomeMail) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [m.to], reply_to: replyTo,
      subject: `Welcome to ${m.course}: your login and invoice ${m.invoiceNo}`,
      html: welcomeHtml(m), text: welcomeText(m),
      attachments: m.pdf ? [{ filename: m.pdf.filename, content: m.pdf.base64 }] : [],
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`resend ${r.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body.id as string;
}
