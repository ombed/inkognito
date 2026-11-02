/* A value with a character the reader cannot see in it is still the value (the hunt of 11.10).

   WhatsApp exports and text copied from apps wrap names and numbers in direction marks (bidi isolates,
   embeddings), Word puts an optional hyphen inside a word, and a file may carry a BOM or a word joiner.
   Only LRM, RLM and the zero-width space and joiners were known: a listed name with any other one inside it,
   or around its words, was not found, and a phone or an ID with even a known one inside it was not found at
   all, and reached the AI under a green bar. The Hebrew maqaf was read as a vowel mark, so «לוי־אבקסיס» was
   not «לוי-אבקסיס». Detection now runs on the text as the reader sees it (squeeze, engine/02-hebrew.js), and
   the positions map back to the original. Every name here is invented. */
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
const zlib = require("zlib"), fs = require("fs"), path = require("path");
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const HERE = __dirname;
const E = require("./core.js");
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n));
const OPT = { on: ON, flag: FLAG, mode: "real", near: false, body: false, prefixes: "normal" };
const LISTED = [{ value: "רונית לוי", kind: "NAME", replacement: "" }];
const detect = (t, subs) => new C.Engine(subs || LISTED, [], OPT, t).detect(t);
// what the reader sees: the text without the characters that have no glyph
const seen = (s) => s.replace(/[­͏؜᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g, "");

const INVIS = {
  "soft hyphen": "­", "BOM / zero-width no-break space": "﻿", "word joiner": "⁠",
  "LRI": "⁦", "RLI": "⁧", "FSI": "⁨", "PDI": "⁩",
  "LRE": "‪", "RLE": "‫", "PDF": "‬", "LRO": "‭", "RLO": "‮",
  "Arabic letter mark": "؜", "combining grapheme joiner": "͏", "zero-width space": "​", "LRM": "‎", "RLM": "‏",
};

console.log("\n— a listed name, with a character the reader cannot see inside it or around its words —");
for (const [what, c] of Object.entries(INVIS)) {
  for (const [where, t] of [
    ["inside the first name", `הגיעה רו${c}נית לוי לדיון.`],
    ["between the words", `הגיעה רונית${c} לוי לדיון.`],
    ["around each word", `הגיעה ${c}רונית${c} ${c}לוי${c} לדיון.`],
  ]) {
    const h = detect(t).find((x) => x.src === "list");
    ok(h && seen(h.text) === "רונית לוי" && t.slice(h.s, h.e) === h.text, `${what}, ${where}: found, and the span is the name as she reads it (${h ? JSON.stringify(h.text) : "nothing"})`);
    // a direction mark before or after the name stays outside the span, so an isolate keeps its pair
    if (h && where === "around each word") ok(h.text[0] === "ר" && h.text[h.text.length - 1] === "י", `${what}: the marks before and after the name stay in the text`);
  }
}

console.log("\n— identifying numbers and dates, with a character the reader cannot see inside or around them —");
for (const [what, c] of Object.entries(INVIS)) {
  for (const [where, t, want, type] of [
    ["inside a mobile", `הטלפון 054-12${c}34567 נמסר.`, "054-1234567", /PHONE/],
    ["around a mobile", `הטלפון ${c}054-1234567${c} נמסר.`, "054-1234567", /PHONE/],
    ["inside an ID", `ת"ז 0345${c}67128 של האם.`, "034567128", /ID/],
    ["inside a date", `הדיון נקבע ליום 12.3.20${c}26 בבוקר.`, "12.3.2026", /DATE/],
  ]) {
    const h = detect(t, []).find((x) => type.test(x.type) && seen(x.text).includes(want));
    ok(!!h && t.slice(h.s, h.e) === h.text, `${what}, ${where}: found (${h ? JSON.stringify(h.text) + " " + h.type : "nothing"})`);
  }
}

console.log("\n— the maqaf is a hyphen —");
const M = "־";
for (const [listedAs, t] of [
  ["רונית לוי-אבקסיס", `הגיעה רונית לוי${M}אבקסיס לדיון.`],
  ["רונית לוי אבקסיס", `הגיעה רונית לוי${M}אבקסיס לדיון.`],
  [`רונית לוי${M}אבקסיס`, "הגיעה רונית לוי-אבקסיס לדיון."],
  [`רונית לוי${M}אבקסיס`, "הגיעה רונית לוי אבקסיס לדיון."],
]) {
  const h = detect(t, [{ value: listedAs, kind: "NAME", replacement: "" }]).find((x) => x.src === "list");
  ok(h && /אבקסיס$/.test(h.text) && h.text.startsWith("רונית"), `listed as «${listedAs}», written «${t.slice(6, 22)}»: found whole (${h ? JSON.stringify(h.text) : "nothing"})`);
}
{
  const t = `המשפחה גרה בתל${M}אביב מאז 2019.`;
  const h = detect(t, [{ value: "תל אביב", kind: "PLACE", replacement: "" }]).find((x) => x.src === "list");
  ok(h && /אביב$/.test(h.text), "a listed town written with a maqaf is found: " + (h ? JSON.stringify(h.text) : "nothing"));
  const d = detect(`הדיון נדחה ב${M}12.3.2026 לבקשת הצדדים.`, []).find((x) => x.type === "DATE");
  ok(d && d.text.includes("12.3.2026"), "a date after «ב» and a maqaf is still a date: " + (d ? JSON.stringify(d.text) : "nothing"));
}

console.log("\n— counterexamples: nothing new is found where nothing is hidden —");
for (const t of [
  "הגיעה רונית לוי לדיון.",
  "הטלפון 054-1234567 נמסר.",
  "הוגש תצהיר ביום 12.3.2026, ובו 14 סעיפים.",
  "בסעיף 5.2 לחוזה נקבע תשלום של 4,500 ש\"ח.",
  "בית המשפט קבע דיון נוסף בעוד 30 יום.",
]) {
  const plain = detect(t).map((h) => h.s + ":" + h.e + ":" + h.type).join(" ");
  // the same sentence with marks around every word finds the same values, in the same places as the reader sees them
  const wrapped = t.split(" ").map((w) => "⁧" + w + "⁩").join(" ");
  const back = detect(wrapped).map((h) => seen(h.text) + ":" + h.type).join(" ");
  const want = detect(t).map((h) => h.text + ":" + h.type).join(" ");
  ok(back === want, `«${t}»: wrapped in isolates, the same findings (${want || "none"}) — got ${back || "none"}`);
  ok(!/undefined|NaN/.test(plain), "positions are numbers: " + plain);
}
{
  // a word joiner between two words of a sentence glues them for the reader too: «רונית» inside «רוניתלוי» is not her
  const h = detect("כתבה רונית⁠לוי מכתב.", [{ value: "רונית", kind: "NAME", replacement: "" }]).find((x) => x.src === "list");
  ok(!h, "a word joiner that glues two words makes one word, as the reader sees it: " + (h ? JSON.stringify(h.text) : "nothing found"));
}

(async () => {
  console.log("\n— through the whole document: the name, its parts alone, and what reaches the AI —");
  const subs = [{ value: "רונית לוי-אבקסיס", kind: "NAME", replacement: "מרים הרשקוביץ" }];
  const body = P(R("המבקשת ⁧רונית לוי־אבקסיס⁩ הגישה בקשה.")) + P(R("לדברי אבק­סיס, הילדים גרים איתה.")) + P(R("הטלפון של המבקשת ‪054-12​34567‬."));
  const res = await E.redactDocx(mkzip([...base, { name: "word/document.xml", body: doc(body) }]), subs, [], OPT);
  const lines = res.preview.map((x) => x.text), out = lines.map(seen).join(" | ");
  ok(!/רונית|אבקסיס|לוי/.test(out), "no part of her name reaches the AI: " + out);
  ok(!/054-?1234567/.test(out.replace(/\s/g, "")), "nor her phone: " + out);
  ok(/מרים הרשקוביץ/.test(out) && /^לדברי הרשקוביץ/.test(seen(lines.find((l) => l.startsWith("לדברי")) || "")), "her pseudonym stands for the name and for the surname alone: " + out);
  const first = lines.find((l) => l.startsWith("המבקשת")) || "";
  ok(first.indexOf("⁧") >= 0 && first.indexOf("⁧") < first.indexOf("מרים") && first.indexOf("⁩") > first.indexOf("הרשקוביץ"), "the isolates around the name keep their pair around the pseudonym");

  console.log("\n— a double surname: each half alone is the same person —");
  for (const [value, rep, text, gone, want] of [
    ["רונית לוי-אבקסיס", "מרים הרשקוביץ", ["המבקשת רונית לוי-אבקסיס הגישה בקשה.", "לדברי אבקסיס, הילדים גרים איתה.", "גם לוי אמרה כך."], /אבקסיס|לוי/, /לדברי הרשקוביץ.*גם הרשקוביץ/],
    ["רונית לוי-אבקסיס", "מרים כהן-זילבר", ["המבקשת רונית לוי-אבקסיס הגישה בקשה.", "לדברי אבקסיס, הילדים גרים איתה.", "גם לוי אמרה כך."], /אבקסיס|לוי/, /לדברי זילבר.*גם כהן/],
    [`רונית לוי${M}אבקסיס`, "מרים הרשקוביץ", ["המבקשת רונית לוי־אבקסיס הגישה בקשה.", "לדברי אבקסיס, הילדים גרים איתה."], /אבקסיס|לוי/, /לדברי הרשקוביץ/],
  ]) {
    const r = await E.redactDocx(mkzip([...base, { name: "word/document.xml", body: doc(text.map((l) => P(R(l))).join("")) }]), [{ value, kind: "NAME", replacement: rep }], [], OPT);
    const o = r.preview.map((x) => x.text).join(" | ");
    ok(!gone.test(o) && want.test(o), `«${value}» as «${rep}»: ${o}`);
  }

  /* The particle of a double surname («בן», «בר», «בת») is not the person alone (bench doc m4, 12.10): since the halves
     came in (v73.6), «הילד בן שבע» became «הילד קרמר שבע» and «חגג בר מצווה» became «חגג דהן מצווה», and with the
     surname written twice, every «בן» in the document was asked about as «שם משותף». The other half still is the person. */
  console.log("\n— a double surname's particle alone is a word, not the person —");
  for (const [value, rep, text, keep, gone, also] of [
    ["אלה בן-רביב", "מרים הרשקוביץ", ["אלה בן-רביב הגיעה לפגישה.", "הילד בן שבע ולומד בכיתה ב.", "לדברי רביב, הכול בסדר."], "הילד בן שבע", /אלה|רביב/, "לדברי הרשקוביץ"],
    ["משה בר-לב", "יוסי כהן", ["משה בר-לב הגיע לדיון.", "הוא חגג בר מצווה בשנה שעברה."], "חגג בר מצווה", /משה|בר-לב/, ""],
    ["רחל בת-עזרא", "נועה שגב", ["רחל בת-עזרא הגישה תצהיר.", "הילדה בת שש ולומדת בגן.", "לדברי עזרא, הכול בסדר."], "הילדה בת שש", /רחל|עזרא/, "לדברי שגב"],
  ]) {
    const r = await E.redactDocx(mkzip([...base, { name: "word/document.xml", body: doc(text.map((l) => P(R(l))).join("")) }]), [{ value, kind: "NAME", replacement: rep }], [], OPT);
    const o = r.preview.map((x) => x.text).join(" | ");
    ok(o.includes(keep) && !gone.test(o) && (!also || o.includes(also)), `«${value}»: «${keep}» stays, the other half is still replaced: ${o}`);
  }
  {
    // the bench's m4: the surname with a maqaf and without one, two people to the engine
    const text = ["אלה בן-רביב הגיעה לפגישה.", "הילד בן שבע ולומד בכיתה ב.", "בן רביב תבדוק עם המשטרה."];
    const r = await E.redactDocx(mkzip([...base, { name: "word/document.xml", body: doc(text.map((l) => P(R(l))).join("")) }]), [{ value: "אלה בן-רביב", kind: "NAME" }, { value: "בן רביב", kind: "NAME" }], [], OPT);
    const o = r.preview.map((x) => x.text).join(" | ");
    ok(o.includes("הילד בן שבע") && !(r.flagged || []).some((f) => f.value === "בן"), "«בן» is neither replaced nor asked about: " + o + " · flagged " + (r.flagged || []).map((f) => f.value).join(","));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
