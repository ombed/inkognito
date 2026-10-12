/* The Word reader against broken and hostile files (the engineering audit of 12.10). A Word file is a ZIP, and the tool
   reads it with its own reader (engine/00-head.js, unzip). Until 12.10 a broken file could stop it with an English
   RangeError or TypeError, and a part whose content no longer matched its checksum (CRC) was read as it was.
   Here a valid file is broken in hundreds of ways, from a fixed seed so every run is the same: random bytes, a cut,
   the directory at the end, the sizes and offsets. Every broken file must either read or be refused with one of the
   tool's two messages, quickly; a part whose checksum does not match is refused. Invented names only. */
const xd = require("@xmldom/xmldom");
global.DOMParser = xd.DOMParser; global.XMLSerializer = xd.XMLSerializer;
{
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", { get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
    if (!proto.remove) proto.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
    if (!proto.querySelector) proto.querySelector = function (t) { const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
  }
}
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { base, doc, P, R } = require("./structure-lib.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const KNOWN = new Set(["הקובץ לא נראה כמו ‎.docx תקין", "מבנה הקובץ פגום"]);
const ab = (z) => (z instanceof ArrayBuffer ? z.slice(0) : z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength));
const u8 = (z) => new Uint8Array(ab(z));
// mulberry32: the same breakages on every run
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const withTime = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("HANG")), ms))]);
async function outcome(buf, caps) {
  try { const files = await withTime(C.unzip(buf, caps), 3000); return { read: true, files }; }
  catch (e) { return { read: false, err: e }; }
}

(async () => {
  const good = u8(mkzip([...base, { name: "word/document.xml", body: doc(P(R("דנה כהן הגישה בקשה לבית המשפט.")) + P(R("יואב לוי השיב לבקשה."))) }]));

  console.log("\n— a valid file reads, and a checksum that does not match is refused —");
  {
    const r = await outcome(ab(good));
    ok(r.read && r.files.length === base.length + 1, "the valid file reads: " + (r.read ? r.files.length + " parts" : r.err.message));
    // the central directory's CRC of the last part, changed by one bit: the data is intact, the checksum is not
    const z = u8(good), dv = new DataView(z.buffer);
    let e = -1; for (let i = z.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    let p = dv.getUint32(e + 16, true), last = p;
    for (let i = 0, n = dv.getUint16(e + 10, true); i < n; i++) { last = p; p += 46 + dv.getUint16(p + 28, true) + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true); }
    dv.setUint32(last + 16, dv.getUint32(last + 16, true) ^ 1, true);
    const bad = await outcome(ab(z));
    ok(!bad.read && bad.err.message === "מבנה הקובץ פגום", "a part whose checksum does not match is refused: " + (bad.read ? "read" : bad.err.message));
  }

  console.log("\n— hundreds of broken files: each reads or is refused in the tool's words, quickly —");
  {
    const rand = rng(1210);
    const pick = (n) => Math.floor(rand() * n);
    const kinds = { flip: 0, cut: 0, tail: 0, field: 0 }, seen = { read: 0, refused: 0 };
    const odd = [];
    for (let k = 0; k < 600; k++) {
      const z = u8(good), dv = new DataView(z.buffer), kind = ["flip", "cut", "tail", "field"][k % 4];
      kinds[kind]++;
      let buf;
      if (kind === "flip") { for (let j = 1 + pick(8); j > 0; j--) z[pick(z.length)] ^= 1 << pick(8); buf = ab(z); }
      else if (kind === "cut") buf = ab(z.subarray(0, pick(z.length)));
      else if (kind === "tail") { for (let j = 0; j < 4; j++) z[z.length - 1 - pick(Math.min(200, z.length))] = pick(256); buf = ab(z); }
      else {
        // a size or an offset in the directory at the end, set to something large or small
        let e = -1; for (let i = z.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
        const at = e + [10, 12, 16][pick(3)];
        dv.setUint32(at, [0xFFFFFFFF, 0x7FFFFFFF, 0, z.length + pick(1000)][pick(4)] >>> 0, true);
        buf = ab(z);
      }
      const r = await outcome(buf, { part: 1 << 20, total: 4 << 20 });
      if (r.read) seen.read++;
      else if (r.err && KNOWN.has(r.err.message)) seen.refused++;
      else odd.push(kind + ": " + (r.err ? (r.err.name + " " + r.err.message) : "?").slice(0, 90));
    }
    ok(odd.length === 0, "every broken file read or was refused in the tool's words (" + seen.read + " read, " + seen.refused + " refused" + (odd.length ? "; other: " + odd.slice(0, 3).join(" | ") : "") + ")");
    ok(seen.refused > 300, "most of them are refused: " + seen.refused + " of 600");
  }

  console.log("\n— a broken file never hangs the whole cleaning either —");
  {
    const rand = rng(77);
    const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
    const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
    let done = 0, hung = 0;
    for (let k = 0; k < 40; k++) {
      const z = u8(good);
      for (let j = 1 + Math.floor(rand() * 4); j > 0; j--) z[Math.floor(rand() * z.length)] ^= 1 << Math.floor(rand() * 8);
      try { await withTime(C.redactDocx(ab(z), [{ value: "דנה כהן", kind: "NAME", replacement: "" }], [], OPT), 5000); done++; }
      catch (e) { if (e.message === "HANG") hung++; else done++; }
    }
    ok(hung === 0 && done === 40, "40 broken files through the whole cleaning: each finished or stopped, none hung (" + hung + " hung)");
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
