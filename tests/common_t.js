/* A suggestion for her to check is a possible name, not an everyday word (engine/05-common.js, worthAsking in
   engine/05-bodynames.js). In public Supreme Court rulings the end-of-run check, the anchored names and the one-tap list
   proposed «במסגרתה», «עליו», «עונש מאסר», «ע"א» as names: accepting them all changed about a thousand words of the
   held-out half (the second blind test, 13.10). A suggestion is shown when at least one of its words is not a common
   word. The other side matters as much: a name, also one that is a word («שמש», «גל», «מזל»), is still proposed, and so
   is a real name in prose that nothing put on the list. Every name here is invented. */
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
const zlib = require("zlib"), fs = require("fs");
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { NS, P, R, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const docx = (paras) => mkzip([...base, { name: "word/document.xml",
  body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NS}><w:body>` + paras.map((t) => P(R(esc(t)))).join("") + "</w:body></w:document>" }]);
const OPT = { on: new Set([...C.PAT.filter((p) => p.on).map((p) => p.n), "PLACES"]), flag: new Set(["NAME_ANCHORED", ...C.PAT.filter((p) => !p.on).map((p) => p.n)]), mode: "real", near: true, prefixes: "normal", body: true };
const ask = (v) => !!C.worthAsking && C.worthAsking(v);

(async () => {
  console.log("\n— an everyday word is not worth asking about; a name is, also one that is a word —");
  for (const v of ["במסגרתה", "עליו", "עליהן", "לטענתה", "בעת ביצוע", "עונש מאסר", "ע\"א", "בע\"א", "א'", "27.5.2015"])
    ok(!!C.worthAsking && !ask(v), `«${v}» is not proposed as a name`);
  for (const v of ["כהן", "ממן", "מלכה", "שמש", "גל", "ישראל", "מזל", "אושרה", "אהובה", "לבנה", "יוסי כהן", "ולדימיר פטרוב", "בוסקילה", "דהן", "John"])
    ok(ask(v), `«${v}» is still proposed: a name, or a name that doubles as a word`);
  // a company ending or an institution's head word is evidence of a name even when the words are common
  for (const v of ["שקד בע\"מ", "עמותת הרימון", "חברת אורנים"]) ok(ask(v), `«${v}» is still proposed: a company or an institution`);

  console.log("\n— the end-of-run check on a ruling: no everyday word, and the name nothing listed —");
  const RULING = [
    "בבית המשפט העליון", "ע\"א 4713/19", "פסק-דין",
    "המשיבה הגישה בקשה נוספת, במסגרתה ביקשו המערערים ארכה של שלושים יום.",
    "בית המשפט קבע כי עליו חתמו שני הצדדים, ולגבי תוכנו של ההסכם לא הייתה מחלוקת.",
    "לדברי מרגלית אזולאי, ההסכם נחתם בנוכחות שני עדים, ומרגלית אזולאי חזרה על כך בעדותה.",
  ];
  const res = await C.redactDocx(docx(RULING), [], [], OPT);
  const sug = ((res.verification || {}).suggest || []).map((x) => x.value);
  ok(!sug.some((v) => /במסגרתה|^עליו$|תוכנו/.test(v)), "no everyday word among the suggestions: " + JSON.stringify(sug));
  ok(sug.some((v) => /אזולאי/.test(v)), "a prose name that nothing listed is still put to her: " + JSON.stringify(sug));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
