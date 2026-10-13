/* Citations of other cases stay as written (the owner's decision, 13.10; engine/07-cite.js): «ע"א 1234/90 כהן נ' לוי,
   פ"ד מה(2) 233» keeps its names and its number, because they are not this case's and the AI needs them to read the
   ruling. Still replaced: this case's own number (the heading, before «פסק-דין»), a bare number with no parties, and a
   citation that holds anything replaced elsewhere — an earlier proceeding between this case's own parties. Every name
   here is invented. Plus two gaps the second blind test found: a company named by its ending («… בע"מ») went only to
   review, and case types such as «עע"מ» with a plain mem were not case numbers at all. */
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
const js = fs.readFileSync("app.html", "utf8").split("<script>")[1].split("</script>")[0]
  .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
  .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
const cut = js.indexOf("/* ══════════════════════════ ממשק ══════════════════════════ */");
const a = js.indexOf("function pseudoRX(p){"), b = js.indexOf("function livePairs(){");
// an engine from before the feature lacks the cite functions: they come out null, and the checks say what fails
const opt = (n) => `${n}:typeof ${n}!=="undefined"?${n}:null`;
fs.writeFileSync("cite-core.js", js.slice(0, cut) + "\n" + js.slice(a, b) + `\nmodule.exports={redactDocx,unzip,TXT,PAT,norm,nerClean,${["citeSpans", "citeKey", "citeListKeys", "citeOnly", "ORG_TAIL"].map(opt).join(",")}};\n`);
const C = require("./cite-core.js");
const { mkzip } = require("./mkzip.js");
const { NS, P, R, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const docx = (paras) => mkzip([...base, { name: "word/document.xml",
  body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NS}><w:body>` + paras.map((t) => P(R(esc(t)))).join("") + "</w:body></w:document>" }]);
// the product's option set: every detector marked on, places on, the rest flagged (bench/lib.js makeBench)
const OPT = { on: new Set([...C.PAT.filter((p) => p.on).map((p) => p.n), "PLACES"]), flag: new Set(["NAME_ANCHORED", ...C.PAT.filter((p) => !p.on).map((p) => p.n)]), mode: "real", near: true, prefixes: "normal" };
const LIST = [{ value: "אלפא שיווק בע\"מ", kind: "ORG", replacement: "" }, { value: "יורם שטרנפלד", kind: "NAME", replacement: "" }];
const KEPT = "ע\"א 1234/90 כהן נ' לוי, פ\"ד מה(2) 233";
const RULING = [
  "בבית המשפט העליון",
  "ע\"א 4711/19",
  "המערערת: אלפא שיווק בע\"מ",
  "נגד",
  "המשיב: יורם שטרנפלד",
  "פסק-דין",
  `כפי שנקבע ב${KEPT}, הנטל על התובע.`,
  "ראו גם רע\"א 5678/12 גרינברג נ' שטרנפלד (פורסם בנבו), שם נדונה אותה מחלוקת.",
  "בהליך הקודם, ע\"א 4711/19 אלפא שיווק בע\"מ נ' שטרנפלד, נדחתה הבקשה.",
  "המשיב הורשע בעבר בת\"פ 12345-06-15 ונידון למאסר על תנאי.",
  "וכן ע\"א 2468/05 יוסי ברקמן נ' דוד אלמגור, פ\"ד ס(1) 77.",
];
const outText = async (res) => { const f = (await C.unzip(await res.blob.arrayBuffer())).find((x) => x.name === "word/document.xml");
  return C.TXT.decode(f.data).replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, ""); };

(async () => {
  console.log("\n— a citation of another case stays as written; this case's own number and parties do not —");
  const res = await C.redactDocx(docx(RULING), LIST, [], OPT);
  const t = await outText(res);
  ok(t.includes(KEPT), "the precedent stays whole, names and number: " + JSON.stringify((t.split("\n").find((l) => l.startsWith("כפי")) || "").slice(0, 90)));
  ok(t.includes("יוסי ברקמן נ' דוד אלמגור") && t.includes("2468/05"), "a second precedent stays too");
  ok(!t.includes("4711/19"), "this case's own number is replaced everywhere, also where it is cited with its parties");
  ok(!t.includes("שטרנפלד"), "a citation naming this case's party is an earlier proceeding: replaced, the party with it");
  ok(!t.includes("5678/12"), "and its number with it");
  ok(!t.includes("12345-06-15"), "a bare number with no parties is this case's history: replaced");
  ok(!t.includes("אלפא שיווק"), "the company that is a party here is replaced");
  ok(res.verification.passed, "the final check passes: nothing replaced elsewhere is left inside a kept citation: " + JSON.stringify(res.verification.leaks || []));
  ok(Array.isArray(res.cited) && res.cited.length === 2, "the result lists the two kept citations: " + JSON.stringify(res.cited));
  ok(!(res.second || []).some((x) => /יוסי|דוד|ברקמן|אלמגור/.test(x.value)), "the second check does not put the precedents' names to her: " + JSON.stringify((res.second || []).map((x) => x.value)));

  console.log("\n— an earlier proceeding between this case's parties is replaced even when the tool missed the parties —");
  // the held-out half of the second blind test: the party was not found elsewhere, so the citation of the earlier
  // proceeding looked like a precedent, and this case's own number stayed with it. The heading names the parties
  const R2 = ["בבית המשפט העליון", "ע\"א 4712/19", "המערערת: דלתא שירותי דוגמה בע\"מ", "נגד", "המשיב: אבנר גוטליב", "פסק-דין",
    "בהליך קודם, רע\"א 9999/15 דלתא שירותי דוגמה בע\"מ נ' גוטליב, נדחתה בקשה דומה.", "וכן ע\"א 1357/02 רוזנטל נ' קורן, פ\"ד נו(3) 12."];
  const t5 = await outText(await C.redactDocx(docx(R2), [], [], OPT));
  ok(!t5.includes("9999/15"), "the earlier proceeding's number is replaced, though nothing in the list ties it to the case: " + JSON.stringify((t5.split("\n").find((l) => l.startsWith("בהליך")) || "").slice(0, 80)));
  ok(t5.includes("ע\"א 1357/02 רוזנטל נ' קורן"), "a precedent whose parties are not in the heading stays");

  // the heading's parties are read like a lawyer reads them: a public body (also wrapped over two lines) and the bench tie
  // nothing; a party named on the line after its role does
  const R3 = ["בבית המשפט העליון", "עע\"מ 3131/20", "לפני: כבוד השופט ש' ברקאי", "המערערים:", "1. ועדת המשנה להתנגדויות - מועצת", "התכנון העליונה",
    "נגד", "המשיב:", "אבנר גוטליב", "פסק-דין",
    "ראו בג\"ץ 5555/12 ארגון דוגמה נ' ועדת המשנה להתנגדויות של מועצת התכנון העליונה, פ\"ד סו(1) 1.",
    "וכן ע\"א 7777/08 ברקאי נ' שמעוני, פ\"ד סג(2) 5.",
    "ובהליך קודם, רע\"א 8888/16 גוטליב נ' הוועדה המקומית, נדחתה הבקשה."];
  const t6 = await outText(await C.redactDocx(docx(R3), [], [], OPT));
  ok(t6.includes("5555/12"), "a precedent against the same public body stays: the body is no party to tie it to the case");
  ok(t6.includes("7777/08"), "a precedent whose party shares the judge's surname stays: the bench is no party");
  ok(!t6.includes("8888/16"), "the respondent named on the line after «המשיב:» ties the earlier proceeding to the case");

  console.log("\n— she can still replace a kept citation, and the feature can be turned off —");
  const key = C.citeKey ? C.citeKey(C.norm(KEPT.split(",")[0])) : "";
  const res2 = await C.redactDocx(docx(RULING), LIST, [], { ...OPT, citeReplace: [key] });
  const t2 = await outText(res2);
  ok(!t2.includes("1234/90") && t2.includes("2468/05"), "citeReplace replaces that citation's number, and only that one");
  const t3 = await outText(await C.redactDocx(docx(RULING), LIST, [], { ...OPT, cite: false }));
  ok(!t3.includes("1234/90") && !t3.includes("2468/05"), "cite:false replaces every case number, as before");

  console.log("\n— the list of names leaves out a precedent's parties, and keeps an earlier proceeding's —");
  const lk = C.citeListKeys ? C.citeListKeys(RULING.join("\n"), ["יורם שטרנפלד", "גרינברג", "יוסי ברקמן", "דוד אלמגור", "כהן"]) : null;
  ok(!!lk && C.citeOnly("יוסי ברקמן", RULING, lk), "a precedent's party, found only inside a kept citation, is not put on the list");
  ok(!!lk && !C.citeOnly("גרינברג", RULING, lk), "the other side of an earlier proceeding with this case's party stays on the list, so it is replaced");
  ok(!!lk && !C.citeOnly("יורם שטרנפלד", RULING, lk), "this case's own party stays on the list");

  console.log("\n— case types that were missing are case numbers, so this case's own number goes —");
  for (const [type, num] of [["עע\"מ", "2222/20"], ["עפ\"ג", "35511-02-19"], ["בר\"מ", "4040/18"], ["דנ\"א", "777/21"], ["רע\"ב", "5151/17"]]) {
    const t4 = await outText(await C.redactDocx(docx(["בבית המשפט העליון", `${type} ${num}`, "פסק-דין", `בערעור זה (${type} ${num}) נטען כי השומה שגויה.`]), [], [], OPT));
    ok(!t4.includes(num), `${type} ${num}: replaced in the heading and in the text: ` + JSON.stringify(t4.replace(/\s+/g, " ").slice(0, 90)));
  }

  console.log("\n— a company named by its ending is a company: on the list, not only a suggestion —");
  const T = "התובעת, שמשון דוגמאות בע\"מ, הגישה ערעור. גם גמא בע\"מ (בפירוק) הגישה.";
  const ent = (v) => ({ type: "ORG", score: 0.99, s: T.indexOf(v), e: T.indexOf(v) + v.length });
  const out = C.nerClean([ent("שמשון דוגמאות בע\"מ"), ent("גמא בע\"מ (בפירוק)")], T);
  const of = (v) => out.find((x) => C.norm(x.value).includes(C.norm(v)));
  ok(of("שמשון דוגמאות") && !of("שמשון דוגמאות").review, "«… בע\"מ» is not marked for review: " + JSON.stringify(out.map((x) => [x.value, x.kind, !!x.review])));
  ok(!!C.ORG_TAIL && C.ORG_TAIL.test(C.norm("גמא בע\"מ (בפירוק)")) && C.ORG_TAIL.test("Acme Ltd") && !C.ORG_TAIL.test("שביל הלב"), "the endings, with a status in parentheses; a plain name has none");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
