// Certificate of participation for a live training session: one landscape A4 page, hand-written PDF (no dependencies).
export interface CertificateData {
  certificateNo: string;
  name: string;
  sessionTitle: string;
  sessionDate: Date;
  durationMin: number;
  issuedAt: Date;
  issuer: string;      // "Vidiksha IP"
  website: string;
}

const latin1 = (s: string) => s.replace(/₹/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const esc = (s: string) => latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
// Approximate glyph widths (Helvetica ~0.52 em, bold ~0.56, Times ~0.47) plus any letter spacing.
const width = (s: string, size: number, font: "F1" | "F2" | "F3", spacing = 0) => s.length * size * (font === "F2" ? 0.56 : font === "F3" ? 0.47 : 0.52) + Math.max(0, s.length - 1) * spacing;
function wrap(s: string, size: number, max: number, font: "F1" | "F2" | "F3") {
  const words = latin1(s).split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { const n = cur ? cur + " " + w : w; if (width(n, size, font) > max && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); return lines;
}
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const fmtLength = (min: number) => min < 60 ? `${min} minutes` : (min % 60 === 0 ? `${min / 60} hour${min === 60 ? "" : "s"}` : `${Math.floor(min / 60)} h ${min % 60} min`);

export function buildCertificatePdf(d: CertificateData): Uint8Array {
  const W = 841.89, H = 595.28; // A4 landscape
  const ops: string[] = [];
  const text = (x: number, y: number, s: string, size: number, font: "F1" | "F2" | "F3", color = "0 0 0", spacing = 0) => ops.push(`BT /${font} ${size} Tf ${spacing} Tc ${color} rg 1 0 0 1 ${x.toFixed(2)} ${(H - y).toFixed(2)} Tm (${esc(s)}) Tj ET`);
  const center = (y: number, s: string, size: number, font: "F1" | "F2" | "F3", color = "0 0 0", spacing = 0) => text((W - width(latin1(s), size, font, spacing)) / 2, y, s, size, font, color, spacing);
  const line = (x1: number, y1: number, x2: number, y2: number, w: number, color: string) => ops.push(`${color} RG ${w} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => ops.push(`${fill} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const frame = (inset: number, w: number, color: string) => ops.push(`${color} RG ${w} w ${inset.toFixed(2)} ${inset.toFixed(2)} ${(W - 2 * inset).toFixed(2)} ${(H - 2 * inset).toFixed(2)} re S`);

  const ink = "0.06 0.055 0.05", green = "0.11 0.29 0.22", grey = "0.42 0.41 0.39", cream = "0.985 0.98 0.97";
  rect(0, 0, W, H, cream);
  frame(26, 1.4, green);
  frame(33, 0.5, green);
  // corner accents
  for (const [cx, cy] of [[33, 33], [W - 33, 33], [33, H - 33], [W - 33, H - 33]] as [number, number][]) {
    rect(cx - 3, H - cy - 3, 6, 6, green);
  }

  // Wordmark
  center(84, "VIDIKSHA IP", 24, "F3", ink, 6);
  center(104, "IP law, learned by doing", 9.5, "F1", grey, 0.6);
  line(W / 2 - 60, 118, W / 2 + 60, 118, 0.6, green);

  // Heading
  center(166, "CERTIFICATE OF PARTICIPATION", 12.5, "F1", green, 3.2);
  center(206, "This is to certify that", 13, "F3", grey);

  // Name
  const nameSize = Math.min(40, Math.max(22, 40 * 560 / Math.max(560, width(d.name, 40, "F3"))));
  center(258, d.name, nameSize, "F3", ink);
  const nw = Math.min(460, width(latin1(d.name), nameSize, "F3") + 40);
  line(W / 2 - nw / 2, 272, W / 2 + nw / 2, 272, 0.8, green);

  center(306, "has participated in the live training session", 13, "F3", grey);
  const tl = wrap(d.sessionTitle, 19, 620, "F2");
  let y = 340;
  for (const l of tl) { center(y, l, 19, "F2", ink); y += 25; }
  center(y + 10, `held online on ${fmtDate(d.sessionDate)}  ·  ${fmtLength(d.durationMin)}`, 12, "F1", grey);
  center(y + 30, "Real documents, live drafting, questions answered.", 11, "F3", grey);

  // Foot: certificate number, issue date, issuer
  const fy = H - 78;
  line(W / 2 - 140, fy - 22, W / 2 + 140, fy - 22, 0.5, "0.75 0.75 0.73");
  center(fy, d.issuer, 13, "F3", ink, 1.5);
  center(fy + 18, `${d.website}  ·  team@vidiksha.in`, 9, "F1", grey);
  text(52, fy + 6, "Certificate no. " + d.certificateNo, 8.5, "F1", grey);
  const issued = "Issued " + fmtDate(d.issuedAt);
  text(W - 52 - width(issued, 8.5, "F1"), fy + 6, issued, 8.5, "F1", grey);

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
