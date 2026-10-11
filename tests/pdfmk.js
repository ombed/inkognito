/* Minimal PDF writer for invented test files: one Type1 font whose ToUnicode CMap maps
   0xE0-0xFA to the Hebrew letters (like Windows-1255) and ASCII to itself, so pdf.js extracts
   real Hebrew. Each line is drawn in visual order (right-aligned, as Word's "Save as PDF" lays
   out an RTL paragraph). Optional standard-security RC4 40-bit encryption (R=2) with a user
   password, to make a real password-protected PDF. */
const crypto = require("crypto");
const PAD = Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex");
const md5 = (...b) => crypto.createHash("md5").update(Buffer.concat(b)).digest();
function rc4(key, data) {
  const s = [...Array(256).keys()]; let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
  const out = Buffer.alloc(data.length); let i = 0; j = 0;
  for (let k = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; [s[i], s[j]] = [s[j], s[i]]; out[k] = data[k] ^ s[(s[i] + s[j]) & 255]; }
  return out;
}
const padPw = (pw) => Buffer.concat([Buffer.from(pw, "latin1"), PAD]).slice(0, 32);
// logical Hebrew line -> visual order (simple UBA for an RTL paragraph: LTR runs keep their order)
function visual(s) {
  const runs = []; const isL = (c) => /[0-9A-Za-z]/.test(c);
  let cur = "", curL = null;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    // digits/latin with inner joiners (- . / @ :) stay one LTR run
    const l = isL(c) || (/[-./@:,]/.test(c) && curL && k + 1 < s.length && isL(s[k + 1]));
    if (curL === null || l === curL) { cur += c; curL = curL === null ? l : curL; }
    else { runs.push([cur, curL]); cur = c; curL = l; }
  }
  if (cur) runs.push([cur, curL]);
  return runs.reverse().map(([t, l]) => l ? t : [...t].reverse().map((c) => ({ "(": ")", ")": "(" }[c] || c)).join("")).join("");
}
function enc1255(s) {
  const out = [];
  for (const c of s) { const u = c.codePointAt(0); if (u >= 0x5d0 && u <= 0x5ea) out.push(0xe0 + u - 0x5d0); else if (u < 128) out.push(u); else throw new Error("no code for " + c); }
  return Buffer.from(out);
}
const pdfStr = (b) => "(" + [...b].map((x) => x === 40 || x === 41 || x === 92 ? "\\" + String.fromCharCode(x) : x < 32 || x > 126 ? "\\" + x.toString(8).padStart(3, "0") : String.fromCharCode(x)).join("") + ")";
/* pages: array of pages; a page is an array of line strings (logical order), or of
   {text, x, y, size, logical:true} items for exact placement.
   opt.fields: filled form fields, as a viewer saves a filled form: [{page, value, rect:[x1,y1,x2,y2], type}]
   (type "Tx" by default, or "Ch"); each is a widget with its value (/V) and an appearance that draws it. */
function mkpdf(pages, opt = {}) {
  const objs = []; const add = (s) => { objs.push(s); return objs.length; };
  const cat = add(null), pagesId = add(null);
  const cmap = "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Heb def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange 2 beginbfrange <20> <7E> <0020> <E0> <FA> <05D0> endbfrange endcmap CMapName currentdict /CMap defineresource pop end end";
  const tu = add({ stream: Buffer.from(cmap, "latin1"), dict: "" });
  const widths = Array(256).fill(500).slice(32).join(" ");
  const font = add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 32 /LastChar 255 /Widths [${widths}] /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [224 /afii57664 /afii57665 /afii57666 /afii57667 /afii57668 /afii57669 /afii57670 /afii57671 /afii57672 /afii57673 /afii57674 /afii57675 /afii57676 /afii57677 /afii57678 /afii57679 /afii57680 /afii57681 /afii57682 /afii57683 /afii57684 /afii57685 /afii57686 /afii57687 /afii57688 /afii57689 /afii57690] >> /ToUnicode ${tu} 0 R >>`);
  const kids = [], allFields = [];
  pages.forEach((pg, pi) => {
    let cs = "";
    pg.forEach((ln, i) => {
      const it = typeof ln === "string" ? { text: ln } : ln;
      const size = it.size || 12, y = it.y != null ? it.y : 780 - i * 18;
      const v = it.logical ? it.text : visual(it.text), b = enc1255(v);
      const x = it.x != null ? it.x : 540 - b.length * size * 0.5; // right-aligned at x=540
      cs += `BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y} Tm ${pdfStr(b)} Tj ET\n`;
    });
    const content = add({ stream: Buffer.from(cs, "latin1"), dict: "" });
    const annots = (opt.fields || []).filter((f) => (f.page || 0) === pi).map((f) => {
      const [x1, y1, x2, y2] = f.rect, b = enc1255(visual(f.value));
      const ap = add({ stream: Buffer.from(`/Tx BMC BT /F1 12 Tf 2 5 Td ${pdfStr(b)} Tj ET EMC`, "latin1"), dict: `/Type /XObject /Subtype /Form /BBox [0 0 ${x2 - x1} ${y2 - y1}] /Resources << /Font << /F1 ${font} 0 R >> >>` });
      const v = "<FEFF" + Buffer.from(f.value, "utf16le").swap16().toString("hex") + ">";
      return add(`<< /Type /Annot /Subtype /Widget /FT /${f.type || "Tx"} /T (f${allFields.length + 1}_${pi}) /V ${v} /Rect [${x1} ${y1} ${x2} ${y2}] /F 4 /P PAGE /AP << /N ${ap} 0 R >> >>`);
    });
    const page = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R${annots.length ? ` /Annots [${annots.map((a) => a + " 0 R").join(" ")}]` : ""} >>`);
    for (const a of annots) { objs[a - 1] = objs[a - 1].replace("/P PAGE", `/P ${page} 0 R`); allFields.push(a); }
    kids.push(page);
  });
  objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R${allFields.length ? ` /AcroForm << /Fields [${allFields.map((a) => a + " 0 R").join(" ")}] /DA (/F1 12 Tf 0 g) /DR << /Font << /F1 ${font} 0 R >> >> >>` : ""} >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  let key = null, encId = null;
  if (opt.userPassword != null) {
    const P = -44; // print allowed etc.
    const O = rc4(md5(padPw(opt.ownerPassword || "owner-secret")).slice(0, 5), padPw(opt.userPassword));
    const pbuf = Buffer.alloc(4); pbuf.writeInt32LE(P);
    key = md5(padPw(opt.userPassword), O, pbuf, id).slice(0, 5);
    const U = rc4(key, PAD);
    encId = add(`<< /Filter /Standard /V 1 /R 2 /O <${O.toString("hex")}> /U <${U.toString("hex")}> /P ${P} >>`);
  }
  const objKey = (n) => md5(key, Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, 0, 0])).slice(0, 10);
  let out = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1"); const offs = [];
  objs.forEach((o, i) => {
    const n = i + 1; offs.push(out.length);
    let body;
    if (o && o.stream) {
      const data = key && n !== encId ? rc4(objKey(n), o.stream) : o.stream;
      body = Buffer.concat([Buffer.from(`${n} 0 obj\n<< /Length ${data.length} ${o.dict} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream\nendobj\n", "latin1")]);
    } else body = Buffer.from(`${n} 0 obj\n${o}\nendobj\n`, "latin1");
    out = Buffer.concat([out, body]);
  });
  const xref = out.length;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  x += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>]${encId ? ` /Encrypt ${encId} 0 R` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.concat([out, Buffer.from(x, "latin1")]);
}
module.exports = { mkpdf, visual };
