/* A person's name in Latin letters inside a Hebrew document (the hunt of 11.10, leaks.md ADDED high): a foreign parent in a
   Hague-return case, a foreign lawyer, an e-mail sender. Every rule read Hebrew letters only: «קלייר דובואה-לוי (Claire
   Dubois-Levi)» went out as «אנה גולדשטיין (Claire Dubois-Levi)» under a green bar, and a filing with Latin names only came
   back with nothing listed, proposed or flagged.

   - A Latin name in brackets right before or after a person's Hebrew name is the same person: it gets the Latin spelling of
     the same invented name, the final check looks for it, and the answer's Latin form comes back.
   - The label rules (party, title, name field, «מאת:», «לכבוד», signature) read a Latin name too, an English title before
     it stays, and a company or a convention is no person. All names are invented. */
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
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "name", DATE: "name" } };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const docx = (lines) => mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    lines.map(P).join("") + "</w:body></w:document>" },
]);
// what the page lists, proposes and sends, with a list (by default: the page's own list and every proposal accepted)
async function run(lines, list) {
  const cands = C.discover(await C.readBlocks(docx(lines)));
  const use = list || cands.map((c) => c.value);
  const res = await C.redactDocx(docx(lines), use.map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], OPT);
  return { cands: cands.map((c) => c.value), res, out: res.preview.map((b) => b.text).join("\n"), done: !!res.verification.passed };
}
const repOf = (r, v) => { const a = r.res.applied.find((x) => (x.base || x.value) === v); return a ? (a.baseRep || a.rep) : null; };
const show = (r) => "«" + r.out.replace(/\n/g, " ⏎ ") + "» candidates «" + r.cands.join(" | ") + "»";
const LATIN_ONLY = /^[A-Za-z' -]+$/;

(async () => {
  console.log("\n— a Latin name in brackets beside a person's Hebrew name is the same person —");
  for (const [line, heb, lat] of [
    ["התובעת: קלייר דובואה-לוי (Claire Dubois-Levi), אזרחית צרפת, הגישה בקשה.", "קלייר דובואה-לוי", "Claire Dubois-Levi"],
    ["הנתבע: Marc Dubois (מארק דובואה), דרכון צרפתי.", "מארק דובואה", "Marc Dubois"],
    ["הקטינה לאה דובואה (Léa Dubois) הובאה לישראל ללא הסכמת האב.", "לאה דובואה", "Léa Dubois"],
    ["העד חואן דה לה קרוז (Juan de la Cruz) העיד מחו\"ל.", "חואן דה לה קרוז", "Juan de la Cruz"],
    ["המשיב יוסף חטיב [Yousef Khatib] לא התייצב.", "יוסף חטיב", "Yousef Khatib"],
    ["הבקשה של אנה שמידט ( Anna SCHMIDT ) נדחתה.", "אנה שמידט", "Anna SCHMIDT"],
  ]) {
    const r = await run([line], [heb]);
    ok(!r.out.includes(lat) && !r.out.includes(heb) && r.done, "«" + lat + "» goes with «" + heb + "» — " + show(r));
    const h = repOf(r, heb), l = repOf(r, lat);
    ok(!!h && !!l && LATIN_ONLY.test(l) && r.out.includes(l) && l.split(/\s+/).length === h.split(/\s+/).length,
      "«" + lat + "» gets the Latin spelling of the same invented name: «" + h + "» / «" + l + "»");
    // the AI writes the Latin form in its answer: it comes back to the real Latin name
    const pairs = r.res.applied.map((a) => [a.base || a.value, a.baseRep || a.rep]);
    const back = C.restoreNames("Per the filing, " + l + " asked the court to act.", pairs);
    ok(back.text.includes(lat), "the answer's «" + l + "» comes back as «" + lat + "» — «" + back.text + "»");
  }
  {
    // the same Latin name elsewhere in the document goes too, and the final check looks for it
    const r = await run(["התובעת: קלייר דובואה-לוי (Claire Dubois-Levi)", "The statement was signed by Claire Dubois-Levi in Lyon."], ["קלייר דובואה-לוי"]);
    ok(!r.out.includes("Claire Dubois-Levi") && r.done, "the Latin name alone in another paragraph is replaced too — " + show(r));
  }

  console.log("\n— a Latin name after the labels the rules know —");
  for (const [line, want] of [
    ["התובעת: Claire Dubois-Levi", "Claire Dubois-Levi"],
    ["הנתבע - Marc Dubois", "Marc Dubois"],
    ["עו\"ד Pierre Martin הגיש תצהיר.", "Pierre Martin"],
    ["שם המבקש: Marc Dubois", "Marc Dubois"],
    ["מאת: Claire Dubois-Levi <claire@example.fr>", "Claire Dubois-Levi"],
    ["לכבוד Mr. John Smith", "John Smith"],
    ["בכבוד רב, Sophie Laurent", "Sophie Laurent"],
  ]) {
    const r = await run([line]);
    ok(r.cands.includes(want) && !r.out.includes(want), "«" + line + "»: «" + want + "» is found and replaced — " + show(r));
  }
  {
    // the label says who: a minor girl gets a woman's invented name, here as on a Hebrew name
    const e = new C.Engine([], [], OPT, "x"), t = "הקטינה: Léa Dubois";
    const h = e.detect(t).find((x) => x.text === "Léa Dubois");
    ok(!!h && h.g === "f", "«הקטינה:» gives the gender: " + (h ? h.g : "no hit"));
  }

  console.log("\n— what is not a person —");
  for (const line of ["התובעת: Microsoft Israel Ltd", "הנתבעת: Google Ireland Limited Company", "אמנת האג (Hague Convention) חלה על הבקשה.",
    "לכבוד The Supreme Court", "הוגש בקובץ PDF דרך WhatsApp.", "דנה שגיא (Tel Aviv) הגישה."]) {
    const r = await run([line]);
    const latin = r.cands.filter((v) => /[A-Za-z]/.test(v));
    ok(!latin.length, "«" + line + "»: nothing Latin is proposed — «" + latin.join(" | ") + "»");
  }

  console.log("\n— the hunt's Hague-return filing, end to end —");
  {
    const lines = ["התובעת: קלייר דובואה-לוי (Claire Dubois-Levi)", "נ ג ד", "הנתבע: מארק דובואה (Marc Dubois), דרכון צרפתי",
      "בקשה להחזרת קטינה לפי אמנת האג", "1. הקטינה לאה דובואה (Léa Dubois) הובאה לישראל על ידי האם ללא הסכמת האב."];
    const r = await run(lines);
    ok(!/Claire|Dubois|Marc|Léa/.test(r.out) && r.done, "no real Latin name is left, and the final check passes — " + show(r));
    const r2 = await run(["התובעת: Claire Dubois-Levi", "נ ג ד", "הנתבע: Marc Dubois, דרכון צרפתי", "בקשה להחזרת קטינה לפי אמנת האג"]);
    ok(r2.cands.includes("Claire Dubois-Levi") && r2.cands.includes("Marc Dubois") && !/Claire|Dubois|Marc/.test(r2.out),
      "the same filing with Latin names only: both parties are found — " + show(r2));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
