// Certificate of participation for a live training session: one landscape A4 page, hand-written PDF (no dependencies).
export interface CertificateData {
  certificateNo: string;
  name: string;
  sessionTitle: string;
  sessionDate: Date;
  durationMin: number;
  issuedAt: Date;
  issuer: string;      // legal name
  website: string;
}

const latin1 = (s: string) => s.replace(/₹/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const esc = (s: string) => latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const width = (s: string, size: number, bold = false) => s.length * size * (bold ? 0.56 : 0.52);
function wrap(s: string, size: number, max: number, bold = false) {
  const words = latin1(s).split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { const n = cur ? cur + " " + w : w; if (width(n, size, bold) > max && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); return lines;
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export function buildCertificatePdf(d: CertificateData): Uint8Array {
  const W = 841.89, H = 595.28; // A4 landscape
  const ops: string[] = [];
  const text = (x: number, y: number, s: string, size: number, font: "F1" | "F2" | "F3", color = "0 0 0") => ops.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${(H - y).toFixed(2)} Tm (${esc(s)}) Tj ET`);
  const center = (y: number, s: string, size: number, font: "F1" | "F2" | "F3", color = "0 0 0") => text((W - width(latin1(s), size, font === "F2")) / 2, y, s, size, font, color);
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, color: string) => ops.push(`${color} RG ${w} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => ops.push(`${fill} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);

  const ink = "0.06 0.055 0.05", green = "0.11 0.29 0.22", grey = "0.42 0.41 0.39";
  rect(0, 0, W, H, "0.98 0.98 0.976");
  rect(0, 0, 14, H, green);
  line(48, 44, W - 48, 44, 0.8, "0.75 0.75 0.73");
  line(48, H - 44, W - 48, H - 44, 0.8, "0.75 0.75 0.73");

  text(60, 80, "VIDIKSHA", 22, "F3", ink);
  text(60, 96, "IP law, learned by doing", 9, "F1", grey);
  const noW = width(d.certificateNo, 9); text(W - 60 - noW, 80, d.certificateNo, 9, "F1", grey);

  center(170, "CERTIFICATE OF PARTICIPATION", 13, "F1", green);
  center(215, "This is to certify that", 13, "F1", grey);
  const nameSize = Math.min(34, Math.max(20, 34 * 560 / Math.max(560, width(d.name, 34, false))));
  center(262, d.name, nameSize, "F3", ink);
  line(W / 2 - 180, 276, W / 2 + 180, 276, 0.8, green);
  center(306, "participated in the live training session", 13, "F1", grey);
  const tl = wrap(d.sessionTitle, 18, 640, true);
  let y = 340;
  for (const l of tl) { center(y, l, 18, "F2", ink); y += 24; }
  const hours = Math.round(d.durationMin / 60 * 10) / 10;
  center(y + 10, `held on ${fmtDate(d.sessionDate)} (${hours} hour${hours === 1 ? "" : "s"}, online)`, 12, "F1", grey);
  center(y + 30, "conducted by " + d.issuer + ", with real documents and live drafting.", 11, "F1", grey);

  text(60, H - 88, "Issued " + fmtDate(d.issuedAt), 9.5, "F1", grey);
  text(60, H - 72, d.website + "  ·  team@vidiksha.in", 9.5, "F1", grey);
  const sig = "For " + d.issuer;
  text(W - 60 - width(sig, 10), H - 96, sig, 10, "F1", ink);
  line(W - 260, H - 108, W - 60, H - 108, 0.6, "0.5 0.5 0.48");
  const auth = "Authorised signatory";
  text(W - 60 - width(auth, 9), H - 72, auth, 9, "F1", grey);

  return pdf(ops.join("\n"), W, H);
}

function pdf(content: string, W: number, H: number): Uint8Array {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
  ];
  const enc = (s: string) => { const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 0xff; return o; };
  const bytes = enc(content);
  const parts: Uint8Array[] = [enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets: number[] = []; let pos = parts[0].length;
  const push = (...a: Uint8Array[]) => { for (const x of a) { parts.push(x); pos += x.length; } };
  objs.forEach((o, i) => { offsets.push(pos); push(enc(`${i + 1} 0 obj\n${o}\nendobj\n`)); });
  offsets.push(pos); push(enc(`7 0 obj\n<< /Length ${bytes.length} >>\nstream\n`), bytes, enc("\nendstream\nendobj\n"));
  const xref = pos;
  let x = `xref\n0 8\n0000000000 65535 f \n`; for (const o of offsets) x += String(o).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; push(enc(x));
  const n = parts.reduce((a, b) => a + b.length, 0); const out = new Uint8Array(n); let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
