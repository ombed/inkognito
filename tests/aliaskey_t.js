/* The engineering audit of 12.10, checked, and the owner's decision to key invented names. Invented names only.
   - Invented names, places and bodies came from a public hash of the real value: with the code and a list of suspects,
     anyone holding the text the AI saw could compute each suspect's invented name and confirm who is in it, and the
     same person got the same invented name for every lawyer. With a key (256 bits, kept in the account's browser) the
     seed is HMAC-SHA-256: the same invented name across her documents, and none an outsider can compute.
   - origin(): any name with an apostrophe counted as Arabic («יואב ברקוביץ'»).
   - pickFrom(): a stride of 7 over the 28 Arabic surnames tried 4 of them; its fallback could give two people one name.
   - Full-width and Arabic-Indic digits, and Hebrew presentation forms from PDFs, were not folded: IDs not found.
   - The ZIP reader took two entries of one name: the tool would clean one, and Word could show the other. */
const crypto = require("crypto");
const zlib = require("zlib");
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const K1 = "0123456789abcdef".repeat(4), K2 = "fedcba9876543210".repeat(4);
const NAMES = ["דנה כהן", "יואב לוי", "מיכל אברהם", "רונית שגיא", "עמית ברק", "נועה פרידמן", "אורי גולן", "שירה מזרחי", "דוד ביטון",
  "רחל אזולאי", "יוסי דהן", "ליאת כרמי", "אבי פרץ", "הדס שמעוני", "גיל נבון", "טל רוזן", "מאיה לנדאו", "עידו שושן", "רותם אלון", "חן ויס"];
const fake = (v) => C.fakeName(v, null, new Set(), new Set(), new Set());

console.log("\n— HMAC-SHA-256 as Node computes it —");
for (const key of [K1, K2]) for (const m of ["", "דנה כהן", "s" + "דנה כהן", "x".repeat(130)]) {
  const ref = crypto.createHmac("sha256", Buffer.from(key, "hex")).update(m, "utf8").digest().readUInt32BE(0);
  ok(C.hmac32(key, m) === ref, `hmac32 of ${JSON.stringify(m).slice(0, 16)}: ${C.hmac32(key, m)} = ${ref}`);
}
ok(C.sha256Sync(new TextEncoder().encode("abc")).every((b, i) => b === crypto.createHash("sha256").update("abc").digest()[i]), "sha256 of «abc»");

console.log("\n— a key: what outsiders compute is not what she gets —");
{
  ok(!C.setAliasKey("short") && !C.setAliasKey("g".repeat(64)) && !C.setAliasKey(null), "a key that is not 64 hex characters is refused");
  C.setAliasKey(null); const open = NAMES.map(fake);
  C.setAliasKey(K1); const k1 = NAMES.map(fake), again = NAMES.map(fake);
  C.setAliasKey(K2); const k2 = NAMES.map(fake);
  C.setAliasKey(null);
  const differ = (a, b) => a.filter((x, i) => x !== b[i]).length;
  ok(differ(k1, open) >= 17, `with a key, ${differ(k1, open)} of 20 invented names differ from the public ones`);
  ok(differ(k1, again) === 0, "the same key gives the same invented names (her documents stay consistent)");
  ok(differ(k1, k2) >= 17, `another key gives other names: ${differ(k1, k2)} of 20 (another lawyer's documents do not link)`);
  ok(differ(NAMES.map(fake), open) === 0, "without a key, the public names as before (tests, Node)");
}
{
  // through the engine, as the page runs it: the key comes in the options. Options that do not name the key leave it
  // as it is (no silent fall back to the public names); null clears it.
  const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
  const base = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
  const text = "דנה כהן הגישה תביעה נגד יואב לוי.";
  const rep = (o) => { const e = new C.Engine([{ value: "דנה כהן", kind: "NAME", replacement: "", auto: true }], [], o, text); return e.detect(text).filter((h) => h.apply).map((h) => e.repFor({ ...h, pre: "" }))[0]; };
  const open = rep({ ...base, aliasKey: null }), keyed = rep({ ...base, aliasKey: K1 }), kept = rep(base), cleared = rep({ ...base, aliasKey: null });
  ok(keyed && keyed !== open, `the page's key reaches the engine: «${keyed}», not «${open}»`);
  ok(kept === keyed, "an engine whose options do not name the key keeps it: «" + kept + "»");
  ok(cleared === open, "aliasKey: null clears it: «" + cleared + "»");
}
{
  const towns = ["חיפה", "נתניה", "רחובות", "עפולה", "אילת", "טבריה", "קריית שמונה", "דימונה", "יבנה", "כרמיאל"];
  const pl = (t) => C.fakePlace(t, new Set(), new Set());
  C.setAliasKey(null); const open = towns.map(pl);
  C.setAliasKey(K1); const keyed = towns.map(pl);
  C.setAliasKey(null);
  ok(keyed.filter((x, i) => x !== open[i]).length >= 8, "an invented town is keyed too (a public 1,100-town list made every one reversible): " + keyed.join(", "));
}

console.log("\n— origin(): an apostrophe alone is not Arabic —");
for (const [v, want] of [["יואב ברקוביץ'", "he"], ["דנה ברקוביץ׳", "he"], ["ג'ון סמית", "he"], ["ח'אלד עבאס", "ar"], ["ע'סאן ח'ורי", "ar"]])
  ok(C.origin(v) === want, `origin(«${v}») = ${C.origin(v)}, want ${want}`);

console.log("\n— pickFrom(): every name of the pool can be reached, and no two people share one —");
{
  const pool = C.POOL.ar_s;
  ok(pool.length % 7 === 0, "(the Arabic surnames are " + pool.length + ", a multiple of 7)");
  let reached = 0;
  for (const last of pool) {
    const used = new Set(pool.filter((x) => x !== last));
    if (C.pickFrom(pool, 12345, used, new Set()) === last) reached++;
  }
  ok(reached === pool.length, `with all but one taken, the free one is found for ${reached} of ${pool.length}`);
  const used = new Set(pool), got = new Set();
  for (let i = 0; i < 30; i++) { const v = C.pickFrom(pool, 777, used, new Set()); ok(!used.has(v), "the fallback is free: " + v); used.add(v); got.add(v); }
  ok(got.size === 30, "thirty fallbacks, thirty different names");
}

console.log("\n— digits and letters other forms of writing use —");
{
  ok(C.norm("３１４") === "314" && C.norm("٣١٤") === "314" && C.norm("۳۱۴") === "314", "full-width, Arabic-Indic and Persian digits fold to ASCII");
  ok(C.norm("שׁוּוֹ") === "שוו", "Hebrew presentation forms fold to their letters");
  ok(C.norm("שׁוּוֹ").length === 3, "one character for one: positions stay");
  const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
  const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
  for (const [label, digits] of [["full-width", "３１４２７７０６２"], ["Arabic-Indic", "٣١٤٢٧٧٠٦٢"]]) {
    const text = "ת\"ז " + digits + " צורפה לבקשה.";
    const e = new C.Engine([], [], OPT, text);
    ok(e.detect(text).some((h) => h.apply && /ID/.test(h.type)), `an ID in ${label} digits is found`);
  }
}

console.log("\n— a Word file with two entries of one name is refused —");
(async () => {
  const ab = (z) => (z instanceof ArrayBuffer ? z : z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength));
  const body = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>דנה כהן</w:t></w:r></w:p></w:body></w:document>';
  const zip = mkzip([{ name: "word/document.xml", body }, { name: "word/document.xml", body: body.replace("דנה כהן", "שם אחר") }]);
  let err = null;
  try { await C.unzip(ab(zip)); } catch (e) { err = e; }
  ok(err && /פגום/.test(String(err.message)), "two document.xml entries: «" + (err ? err.message : "accepted") + "»");
  const one = mkzip([{ name: "word/document.xml", body }]);
  const files = await C.unzip(ab(one));
  ok(files.length === 1 && new TextDecoder().decode(files[0].data).includes("דנה כהן"), "one entry reads as before");
  const refused = async (z, caps) => { try { await C.unzip(ab(z), caps); return ""; } catch (e) { return String(e.message); } };
  // Word compares part names without case: word/Document.xml beside word/document.xml is the same part twice
  ok(/פגום/.test(await refused(mkzip([{ name: "word/document.xml", body }, { name: "word/Document.xml", body }]))), "the same name in other letter case is refused too");
  // a part that inflates past its limit, and parts that together pass the file's limit (small limits stand in for 256 and 512 MB)
  const big = "א".repeat(600);
  ok(/פגום/.test(await refused(mkzip([{ name: "word/document.xml", body: big + big }]), { part: 1000, total: 5000 })), "a part past the part limit is refused");
  ok(/פגום/.test(await refused(mkzip([{ name: "word/a.xml", body: big }, { name: "word/b.xml", body: big }, { name: "word/c.xml", body: big }]), { part: 1500, total: 3000 })), "parts past the file's limit together are refused");
  ok((await refused(mkzip([{ name: "word/a.xml", body: big }, { name: "word/b.xml", body: big }]), { part: 1500, total: 3000 })) === "", "under both limits, the file reads");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
