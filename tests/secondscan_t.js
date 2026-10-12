/* The second scan (the owner's decision of 12.10, «A»; the engineering audit: "the green status checks only the list").
   The final check confirms the listed values are gone; it cannot know what the tool never found. secondScan reads the
   result itself: numbers that look like identifiers, a known first name left that is not an everyday word, a word of a
   listed name left alone, a word one letter from a listed name, a word with a surname's ending. Nothing inside what the
   tool wrote, nothing she kept. bench/second-scan.js measures it on the corpus (12.10: 12 catches, 3 false alarms in 43
   documents). Invented names only. */
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
const scan = (text, opt) => C.secondScan([{ text, marks: (opt && opt.marks) || [] }], (opt && opt.allow) || [], (opt && opt.subs) || []);
const vals = (r) => r.map((x) => x.value).join(",");
const NAME = (v) => ({ value: v, kind: "NAME" });

console.log("\n— a known first name left in the result —");
{
  const r = scan("נכחו בדיון גם קארין ושלומית מהמשרד.");
  ok(vals(r) === "קארין,שלומית" && r.every((x) => x.kind === "name" && x.label === "שם"), "two names left, each a name: " + vals(r));
  ok(r[0].ctx && r[0].ctx.hit === "קארין" && r[0].ctx.pre.endsWith("גם "), "with the words around it: " + JSON.stringify(r[0].ctx));
  const t = "נכחו בדיון גם קארין ושלומית מהמשרד.", at = t.indexOf("קארין");
  ok(vals(scan(t, { marks: [{ s: at, e: at + 5 }] })) === "שלומית", "a name the tool wrote itself (inside its mark) is not a finding");
  ok(vals(scan(t, { allow: ["קארין"] })) === "שלומית", "a name she kept is not a finding");
  ok(!scan("בסוף הדיון גלית סיכמה את הדברים.").length, "a name that is also an everyday word (גלית) is not a finding: too many false alarms");
}

console.log("\n— a listed name in part, or written one letter off —");
{
  ok(vals(scan("בדיון השתתפה גם הורוביץ.", { subs: [NAME("רחל הורוביץ")] })) === "הורוביץ", "a listed surname left alone");
  ok(vals(scan("לדברי בושקילה, הבקשה נדחתה.", { subs: [NAME("אבי בוסקילה")] })) === "בושקילה", "one letter off a listed surname (בושקילה of בוסקילה)");
  ok(vals(scan("ולפי ובושקילה נדחתה.", { subs: [NAME("אבי בוסקילה")] })) === "בושקילה", "and behind a prefix letter, the word without it");
  ok(!scan("הנאשם היה מוכן לדיון.", { subs: [NAME("רונן מוכר")] }).length, "a short everyday word one letter off a listed one (מוכן, מוכר) is not a finding");
  ok(!scan("בן הגיע לדיון.", { subs: [NAME("אלה בן-רביב")] }).length, "a surname particle (בן) is not a word of the person");
}

console.log("\n— a surname's ending —");
{
  ok(vals(scan("לדברי רבינוביץ הבקשה נדחתה.")) === "רבינוביץ", "a word ending as a surname does (‑וביץ)");
  ok(!scan("הנתבע התחייב לשלם, ובהפסקה סוכמה עסקה.").length, "everyday words with such endings (התחייב, הפסקה, עסקה) are not findings");
}

console.log("\n— numbers that look like identifiers —");
{
  let id = ""; for (let n = 314277000; n < 314278000 && !id; n++) if (C.validID(String(n))) id = String(n);
  const r = scan("מספר הזהות " + id + " צורף, וכן הכתובת dana.k@example.com.");
  ok(r.some((x) => x.kind === "number" && /^ISRAELI_ID/.test(x.pat) && x.value === id), "a valid ID number left: " + vals(r));
  ok(r.some((x) => x.pat === "EMAIL" && x.value === "dana.k@example.com"), "an email left");
  ok(!scan("מספר הזהות 314277001 צורף.").some((x) => /^ISRAELI_ID/.test(x.pat)), "nine digits that are not a valid ID are not one");
}

console.log("\n— through a whole Word file —");
(async () => {
  const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
  const OPT = { on: ON, flag: new Set(), mode: "real", near: true, body: true, prefixes: "normal", styles: {} };
  const text = ["פרוטוקול דיון", "אבי בוסקילה הגיש את הבקשה.", "נכחו בדיון גם קארין ושלומית מהמשרד."];
  const res = await C.redactDocx(mkzip([...base, { name: "word/document.xml", body: doc(text.map((t) => P(R(t))).join("")) }]), [NAME("אבי בוסקילה")], [], OPT);
  ok(Array.isArray(res.second), "redactDocx returns the scan");
  ok(vals(res.second) === "קארין,שלומית", "the names it did not find are in it, the one it replaced is not: " + vals(res.second));
  ok(res.verification.passed, "and the list's own check still passes: the scan is what tells them apart");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
