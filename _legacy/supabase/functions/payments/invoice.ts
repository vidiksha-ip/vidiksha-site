// Tax invoice cum payment receipt as a one-page A4 PDF, written by hand (no dependencies).
// Standard Helvetica fonts only, so text is limited to Latin-1; anything else becomes "?".

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: Date;
  seller: { name: string; address: string; gstin: string; state: string; email: string; website: string };
  buyer: { name: string; email: string; phone: string; organisation: string; address: string; city: string; state: string; pincode: string };
  item: { title: string; description: string; sac: string };
  amountInr: number;              // GST-inclusive total actually paid
  payment: { id: string; orderId: string; method: string; paidAt: Date };
}

const esc = (s: string) => latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function latin1(s: string) {
  return s.replace(/₹/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}
const fmtInr = (n: number) => "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const fmtDateTime = (d: Date) => d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST";

/** Approximate Helvetica width for right alignment and wrapping (average glyph 0.5 em). */
const textWidth = (s: string, size: number) => s.length * size * 0.5;
function wrap(s: string, size: number, maxWidth: number) {
  const words = latin1(s).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (textWidth(next, size) > maxWidth && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function gstBreakup(amountInr: number, sellerGstin: string, sellerState: string, buyerState: string) {
  if (!sellerGstin) return null;
  const taxable = Math.round((amountInr / 1.18) * 100) / 100;
  const tax = Math.round((amountInr - taxable) * 100) / 100;
  const intra = sellerState && buyerState && sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase();
  return intra
    ? { taxable, rows: [["CGST @ 9%", Math.round(tax / 2 * 100) / 100], ["SGST @ 9%", Math.round((tax - Math.round(tax / 2 * 100) / 100) * 100) / 100]] as [string, number][] }
    : { taxable, rows: [["IGST @ 18%", tax]] as [string, number][] };
}

export function buildInvoicePdf(d: InvoiceData): Uint8Array {
  const W = 595.28, H = 841.89, M = 48;
  const ops: string[] = [];
  const text = (x: number, y: number, s: string, size = 10, bold = false, color = "0 0 0") => {
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${(H - y).toFixed(2)} Tm (${esc(s)}) Tj ET`);
  };
  const textRight = (xRight: number, y: number, s: string, size = 10, bold = false, color = "0 0 0") => text(xRight - textWidth(latin1(s), size), y, s, size, bold, color);
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6, color = "0.75 0.75 0.73") => ops.push(`${color} RG ${w} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => ops.push(`${fill} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const grey = "0.42 0.41 0.39", green = "0.11 0.29 0.22";

  // Header
  text(M, 70, "VIDIKSHA", 20, false);
  const gst = gstBreakup(d.amountInr, d.seller.gstin, d.seller.state, d.buyer.state);
  textRight(W - M, 62, gst ? "TAX INVOICE" : "INVOICE", 13, true);
  textRight(W - M, 78, "and payment receipt", 9, false, grey);
  line(M, 92, W - M, 92, 1, "0.06 0.05 0.05");

  // Seller / invoice meta
  let y = 116;
  text(M, y, "From", 8, true, grey);
  text(M, y + 15, d.seller.name, 10.5, true);
  let yy = y + 29;
  for (const l of wrap(d.seller.address, 9.5, 230)) { text(M, yy, l, 9.5); yy += 13; }
  if (d.seller.gstin) { text(M, yy, "GSTIN " + d.seller.gstin, 9.5); yy += 13; }
  text(M, yy, d.seller.email + "  |  " + d.seller.website, 9.5, false, grey);

  const metaX = 330, valX = 430;
  const meta: [string, string][] = [
    ["Invoice no.", d.invoiceNo],
    ["Invoice date", fmtDate(d.invoiceDate)],
    ["Place of supply", d.buyer.state || "-"],
    ["Payment", "Received in full"],
  ];
  let my = y;
  for (const [k, v] of meta) { text(metaX, my + 15, k, 9, false, grey); text(valX, my + 15, v, 9.5, true); my += 16; }

  // Buyer
  y = Math.max(yy, my) + 32;
  text(M, y, "Billed to", 8, true, grey);
  text(M, y + 15, d.buyer.name, 10.5, true);
  yy = y + 29;
  if (d.buyer.organisation) { text(M, yy, d.buyer.organisation, 9.5); yy += 13; }
  const addr = [d.buyer.address, [d.buyer.city, d.buyer.state].filter(Boolean).join(", ") + (d.buyer.pincode ? " " + d.buyer.pincode : "")].filter(Boolean).join(", ");
  for (const l of wrap(addr, 9.5, 300)) { text(M, yy, l, 9.5); yy += 13; }
  text(M, yy, d.buyer.email + (d.buyer.phone ? "  |  " + d.buyer.phone : ""), 9.5, false, grey);

  // Items table
  y = yy + 34;
  rect(M, y - 13, W - 2 * M, 20, "0.96 0.96 0.95");
  text(M + 8, y, "Description", 8.5, true, grey);
  text(370, y, "SAC", 8.5, true, grey);
  textRight(W - M - 8, y, "Amount", 8.5, true, grey);
  y += 24;
  text(M + 8, y, d.item.title, 10.5, true);
  text(370, y, d.item.sac, 9.5);
  textRight(W - M - 8, y, fmtInr(gst ? gst.taxable : d.amountInr), 10.5);
  yy = y + 14;
  for (const l of wrap(d.item.description, 9, 300)) { text(M + 8, yy, l, 9, false, grey); yy += 12; }
  y = yy + 8;
  line(M, y, W - M, y);

  // Totals
  y += 18;
  const totals: [string, string, boolean][] = [];
  if (gst) {
    totals.push(["Taxable value", fmtInr(gst.taxable), false]);
    for (const [k, v] of gst.rows) totals.push([k, fmtInr(v), false]);
  }
  totals.push(["Total paid", fmtInr(d.amountInr), true]);
  for (const [k, v, b] of totals) {
    text(370, y, k, b ? 10.5 : 9.5, b, b ? "0 0 0" : grey);
    textRight(W - M - 8, y, v, b ? 11 : 9.5, b);
    y += b ? 20 : 15;
  }
  if (gst) { text(370, y - 4, "Prices are GST-inclusive; tax shown is included in the total.", 7.5, false, grey); y += 10; }

  // Receipt
  y += 22;
  rect(M, y - 13, W - 2 * M, 20, "0.96 0.96 0.95");
  text(M + 8, y, "Payment receipt", 8.5, true, grey);
  y += 22;
  const rec: [string, string][] = [
    ["Amount received", fmtInr(d.amountInr)],
    ["Received on", fmtDateTime(d.payment.paidAt)],
    ["Payment method", d.payment.method || "Online (Razorpay)"],
    ["Razorpay payment id", d.payment.id],
    ["Razorpay order id", d.payment.orderId],
  ];
  for (const [k, v] of rec) { text(M + 8, y, k, 9, false, grey); text(230, y, v, 9.5); y += 15; }
  y += 6;
  text(M + 8, y, "Paid in full. This document serves as the receipt for the payment above.", 9, true, green);

  // Footer
  const fy = H - 64;
  line(M, fy - 14, W - M, fy - 14);
  for (const [i, l] of ["Thank you for enrolling. Recording access, the community invitation and the IP Prosecution Kit follow as described in the welcome email.",
    "This is a computer-generated invoice and does not require a signature. Questions: " + d.seller.email + ". Nothing on VIDIKSHA is legal advice."].entries()) {
    text(M, fy + i * 12, l, 7.5, false, grey);
  }

  return pdf(ops.join("\n"), W, H);
}

function pdf(content: string, W: number, H: number): Uint8Array {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const bytes = latin1Bytes(content);
  objects.push(`<< /Length ${bytes.length} >>\nstream\n` + "\u0000STREAM\u0000" + "\nendstream");

  const enc = (s: string) => latin1Bytes(s);
  const parts: Uint8Array[] = [enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets: number[] = [];
  let pos = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(pos);
    const head = enc(`${i + 1} 0 obj\n`);
    let body: Uint8Array;
    if (obj.includes("\u0000STREAM\u0000")) {
      const [a, b] = obj.split("\u0000STREAM\u0000");
      body = concat(enc(a), bytes, enc(b));
    } else body = enc(obj);
    const tail = enc("\nendobj\n");
    parts.push(head, body, tail);
    pos += head.length + body.length + tail.length;
  });
  const xref = pos;
  let x = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) x += String(o).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  parts.push(enc(x));
  return concat(...parts);
}
function latin1Bytes(s: string) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
function concat(...arrs: Uint8Array[]) {
  const n = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
