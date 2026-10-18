/* The smaller findings of the outside review of 18.10, each as its class. Every name here is invented.

   F6: a case type before a case number («ת"א 48213-05-25», a civil claim) is not a place: the model read «ת"א» as Tel
   Aviv and the heading went out as another city. And «גרה בת"א מאז 2010» is not an address: a city's initials are a city
   after a verb of living, and a year after a word of time is not a house number; it was deleted as one.
   F7: a name with vowel marks is the same name: «מַרְגָּלִית» got no merge suggestion next to «מרגלית לנדאו», which the
   same name without marks gets, and two entries that differ only in vowel marks got two substitutes.
   F9: a double surname is family: «נועה גלעדי» and «אורי גלעדי-ורבר» got unrelated substitute surnames.
   F12: a substitute the AI misspelled («לנדא» of «לנדאו», «פרצ» of «פרץ», also after a prefix letter) stayed in the
   answer, half restored, while the screen said no invented detail was left. It is listed now, with the real word. */
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
const NAME = (v) => ({ value: v, kind: "NAME", replacement: "" });
const zipOf = (lines) => mkzip([...base, { name: "word/document.xml", body: doc(lines.map((l) => P(R(l))).join("")) }]);
const OPT = { on: new Set(C.PAT.filter((p) => p.on).map((p) => p.n).concat("PLACES")), flag: new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)),
  mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const out = async (lines, subs) => (await C.redactDocx(zipOf(lines), subs || [], [], OPT)).preview.slice(1).map((p) => p.text);

(async () => {
  console.log("\n— F6: a case type before its number is not a place; a city's initials and a year are not an address —");
  {
    const text = 'ת"א 48213-05-25 כהן נ\' לוי\nהוא גר בת"א שנים רבות.';
    const at = (s) => text.indexOf(s);
    // the model's own label for a place, as nerRun gives it to nerClean
    const LOC = Object.keys(C.NER_KIND || {}).find((k) => C.NER_KIND[k] === "PLACE") || "GPE";
    const caseType = C.nerClean([{ type: LOC, score: 0.99, s: at('ת"א 4'), e: at('ת"א 4') + 3 }], text).map((x) => x.value);
    const city = C.nerClean([{ type: LOC, score: 0.99, s: at('בת"א') + 1, e: at('בת"א') + 4 }], text).map((x) => [x.value, x.kind]);
    ok(!caseType.length, "the model's «ת\"א» before a case number is dropped: " + JSON.stringify(caseType));
    ok(city.length === 1 && city[0][0] === 'ת"א' && city[0][1] === "PLACE", "the city «ת\"א» stays a place: " + JSON.stringify(city));
    for (const [line, why] of [['גרה בת"א מאז 2010.', "a city's initials"], ["גרה בהדסים מאז 2010.", "a year after «מאז»"], ["התגורר בהרצליה משנת 1998 ועד היום.", "a year after «משנת»"]]) {
      const [o] = await out([line]);
      ok(o === line || !o.includes("ב.") && /(?:2010|1998)/.test(o), why + " is not a house number: «" + o + "»");
    }
    const [addr] = await out(["המבקשת מתגוררת בהנרקיס 9 בחיפה."]);
    ok(!/הנרקיס 9/.test(addr), "an address after a verb of living is still one: «" + addr + "»");
  }

  console.log("\n— F7: a name with vowel marks is the same name —");
  {
    ok(JSON.stringify(C.mergeSignals("מַרְגָּלִית", "מרגלית לנדאו")) === JSON.stringify(C.mergeSignals("מרגלית", "מרגלית לנדאו")) && C.mergeSignals("מַרְגָּלִית", "מרגלית לנדאו").length,
      "the same merge suggestion as without the marks: " + JSON.stringify(C.mergeSignals("מַרְגָּלִית", "מרגלית לנדאו")));
    const o = await out(["מרגלית לנדאו הגיעה לדיון.", "מַרְגָּלִית לַנְדָּאוּ הגיעה שוב."], [NAME("מרגלית לנדאו"), NAME("מַרְגָּלִית לַנְדָּאוּ")]);
    const a = o[0].replace(" הגיעה לדיון.", ""), b = o[1].replace(" הגיעה שוב.", "");
    ok(a === b && !/מרגלית|לנדאו/.test(a), "two entries that differ only in vowel marks get one substitute: «" + a + "», «" + b + "»");
  }

  console.log("\n— F9: a double surname is family, in either order —");
  for (const order of [["נועה גלעדי", "אורי גלעדי-ורבר"], ["אורי גלעדי-ורבר", "נועה גלעדי"], ["דנה שרעבי", "משה שרעבי־גולדנר"]]) {
    const o = (await out(order.map((n) => n + " הגיע לדיון."), order.map(NAME))).map((t) => t.replace(" הגיע לדיון.", ""));
    const [single, double] = order[0].includes("-") || order[0].includes("־") ? [o[1], o[0]] : [o[0], o[1]];
    const sur = single.split(" ").slice(1).join(" "), parts = double.split(" ").slice(1).join(" ").split(/[-־]/);
    ok(parts.length === 2 && parts[0] === sur && parts[1] !== sur && !/גלעדי|ורבר|שרעבי|גולדנר/.test(o.join(" ")), order.join(" + ") + ": «" + single + "», «" + double + "»");
  }
  {
    const o = await out(["אלה בן-רביב הגיעה.", "רביב לוי הגיע."], [NAME("אלה בן-רביב"), NAME("רביב לוי")]);
    ok(!/[-־]/.test(o[0].replace("הגיעה.", "")) || !/בן-רביב/.test(o[0]), "«בן-רביב» is one surname with its particle, not two: «" + o[0] + "»");
  }

  console.log("\n— F12: a substitute the AI misspelled is listed, with the real word —");
  {
    const PAIRS = [["מרגלית קורנגולד", "שולמית לנדאו"], ["דוד כהן", "יוסי פרץ"]];
    for (const [ans, fake, real] of [["שולמית לנדא הגישה את הבקשה.", "לנדא", "קורנגולד"], ["והגיעה ולנדא בעצמה.", "לנדא", "קורנגולד"], ["שולמית לנדאו נפגשה עם יוסי פרצ.", "פרצ", "כהן"]]) {
      const r = C.restoreNames(ans, PAIRS, [], {});
      ok(r.left.some((x) => x.fake === fake && x.real === real), "«" + ans + "»: " + JSON.stringify(r.left.map((x) => [x.fake, x.real])));
    }
    for (const ans of ["הבקשה של לנדאו התקבלה, ושולמית לנדאו חתמה.", "הם הלכו לגן הלאומי והשתלמו.", "יוסי פרץ אמר שלום."]) {
      const r = C.restoreNames(ans, PAIRS, [], {});
      ok(!r.left.length, "nothing left where nothing is misspelled: «" + r.text + "» " + JSON.stringify(r.left));
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
