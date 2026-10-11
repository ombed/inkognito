/* Names in the slots the rules own, wherever the label sits (the hunt of 11.10).

   Without the model, the rules are the only thing that finds a name. They knew a speaker who opens a
   line («נגה טרכטנגוט: …»), a party after its role in the same line («התובעת: נגה טרכטנגוט»), a
   signature after «בכבוד רב» in the same line, and a «שם:» field. Every other usual form of the same
   slots reached the AI unchanged under a green bar:
   - a WhatsApp export, where a time stamp stands before every sender («[12.3.2026, 21:15] נגה …:»);
     the bench's own four chats found none of their six senders;
   - the label in its own cell or line: a caption laid out as a table, «בכבוד רב,» with the name on
     the next line, «לכבוד» above the addressee, a numbered witness list;
   - label variants: «שם פרטי:», «שם משפחה:», «שם האב:», «מאת:», «אל:» (and «פרטי» was proposed as a
     person);
   - an initial and a surname in a party slot («התובעת: נ. טרכטנגוט»).
   And the other side of it: a label followed by something that is not a name stays untouched.

   What she sees is what is checked: a name is auto-listed (the page's own rule for «מי בתיק»), or
   proposed, and with an empty list it is flagged for review, so the bar is not green. Every name and
   number here is invented. */
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
const fs = require("fs"), path = require("path");
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the page's options (index.html opts()): identifying details deleted, a name after a label flagged
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };

// a .docx of paragraphs and tables; a table is {table: rows}, a row a list of cells, a cell a paragraph or a list of them
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const TC = (c) => `<w:tc>${[].concat(c).filter((x) => x !== "").map(P).join("") || "<w:p/>"}</w:tc>`;
const TBL = (rows) => `<w:tbl>${rows.map((r) => `<w:tr>${r.map(TC).join("")}</w:tr>`).join("")}</w:tbl>`;
const docx = (items) => mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    items.map((x) => (typeof x === "string" ? P(x) : TBL(x.table))).join("") + "</w:body></w:document>" },
]);

/* What she is asked about, as the page builds it (index.html showPeople): a high-confidence name of two words
   or more, or a repeated speaker, fills «מי בתיק» by itself; the rest of what discover found is proposed when it
   has two words or more, is a speaker, or repeats; and with nothing on the list the review flags every name the
   anchors found, so the bar is not green until she decides. */
function autoList(cands) {
  const dt = new Set(cands.flatMap((c) => c.value.split(/\s+/)));
  return cands.filter((c) => {
    if (c.conf !== "high" || (!c.value.includes(" ") && !c.speaker)) return false;
    const w = c.value.split(/\s+/);
    if (w.length > 3 || !w.every((x) => x.length >= 2)) return false;
    return c.speaker || (w.every((x) => C.nameish(x, dt)) && w[0][0] !== "ו" && !w.some((x) => x[0] === "ה"));
  }).map((c) => c.value);
}
const proposed = (cands, auto) => cands.filter((c) => !auto.includes(c.value)).filter((c) => {
  const w = c.value.split(/\s+/);
  return w.length <= 3 && w.every((x) => x.length >= 2) && (w.length >= 2 || c.speaker || c.count >= 2);
}).map((c) => c.value);
async function scan(items) {
  const blocks = await C.readBlocks(docx(items));
  const cands = C.discover(blocks);
  const auto = autoList(cands), sug = proposed(cands, auto);
  const res = await C.redactDocx(docx(items), [], [], OPT);
  const flagged = res.flagged.filter((f) => f.label === "שם (לפי הקשר)").map((f) => f.value);
  return { cands, auto, sug, flagged, complete: res.verification.complete };
}
// the page's own auto list run through the pipeline: the text that would reach the AI
async function sent(items, list) {
  const res = await C.redactDocx(docx(items), list.map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], OPT);
  return res.preview.map((b) => b.text).join("\n");
}
const show = (r) => "auto «" + r.auto.join(" | ") + "», proposed «" + r.sug.join(" | ") + "», flagged «" + r.flagged.join(" | ") + "»";
/* want: [value, "auto"] fills the list by itself; [value, "asked"] is proposed or flagged. Either way the value is
   exactly the name, and with an empty list it is flagged in the review. */
async function expect(items, want, label) {
  const r = await scan(items);
  const what = label || items.map((x) => (typeof x === "string" ? x : "[table]")).join(" ⏎ ");
  for (const [v, how] of want) {
    const seen = how === "auto" ? r.auto.includes(v) : r.auto.includes(v) || r.sug.includes(v) || r.flagged.includes(v);
    ok(seen && r.flagged.includes(v), "«" + what + "»: «" + v + "» " + (how === "auto" ? "auto-listed" : "proposed or flagged") + " and flagged with an empty list — " + show(r));
  }
  ok(!r.complete, "«" + what + "»: the bar is not green while a name waits");
  return r;
}
// nothing she would be asked about contains one of these words
async function untouched(items, words, label) {
  const r = await scan(items);
  const asked = [...r.auto, ...r.sug, ...r.flagged];
  const bad = asked.filter((v) => words.some((w) => v.split(/\s+/).includes(w)));
  ok(!bad.length, "«" + (label || items.map((x) => (typeof x === "string" ? x : "[table]")).join(" ⏎ ")) + "»: nothing proposed, got «" + bad.join(" | ") + "» — " + show(r));
}

(async () => {
  const N1 = "נגה טרכטנגוט", N2 = "אליאב פרוינדליך";

  console.log("\n— a chat export: the sender after every time stamp is a speaker —");
  // the same three lines in each usual export form; the first sender writes twice, the second once
  const chat = (stamp) => [stamp("21:15") + N1 + ": תחזיר את הילדים עד שמונה", stamp("21:16") + N2 + ": אני בדרך", stamp("21:20") + N1 + ": כבר שמונה וחצי"];
  for (const [form, stamp] of [
    ["iPhone", (t) => `[12.3.2026, ${t}] `],
    ["iPhone, with seconds", (t) => `[12.3.2026, ${t}:03] `],
    ["iPhone, slashes and leading zeros", (t) => `[12/03/2026, ${t}:03] `],
    ["iPhone, a direction mark before the stamp", (t) => `‎[12.3.2026, ${t}:03] `],
    ["iPhone, a direction mark before the name", (t) => `[12.3.2026, ${t}:03] ‎`],
    ["Android", (t) => `12.3.2026, ${t} - `],
    ["Android, a two-digit year", (t) => `12.3.26, ${t} - `],
    ["Android, no comma", (t) => `12/03/2026 ${t} - `],
    ["Android, a direction mark first", (t) => `‏12.3.2026, ${t} - `],
    ["English iPhone", (t) => `[3/12/26, ${t.replace("21", "9")}:03 PM] `],
    ["English iPhone, a narrow space before PM", (t) => `[3/12/26, ${t.replace("21", "9")}:03 PM] `],
    ["English Android", (t) => `3/12/26, ${t.replace("21", "9")} PM - `],
  ]) await expect(chat(stamp), [[N1, "auto"], [N2, "asked"]], form);
  // a contact saved with a symbol after the name, and a contact saved by first name only
  await expect(["[12.3.2026, 21:15] " + N1 + " 🌸: תחזיר את הילדים עד שמונה", "[12.3.2026, 21:20] " + N1 + " 🌸: כבר שמונה וחצי"], [[N1, "auto"]], "a symbol after the contact's name");
  await expect(["[12.3.2026, 21:15] נגה: תחזיר את הילדים עד שמונה", "[12.3.2026, 21:16] אליאב פרוינדליך: אני בדרך", "[12.3.2026, 21:20] נגה: כבר שמונה וחצי"], [["נגה", "auto"], [N2, "asked"]], "a contact saved by first name");

  console.log("\n— the bench's own chat exports: all six senders —");
  {
    const want = { c1: ["מיקי צח"], c2: ["מייסא סרחאן", "ליעד בן-עמיאל"], c3: ["ברהאנה וורקנה"], c4: ["פולינה סמירנובה", "קסאי אלמו"] };
    for (const [id, names] of Object.entries(want)) {
      const raw = fs.readFileSync(path.join(__dirname, "..", "bench", "corpus", id + ".docx"));
      const cands = C.discover(await C.readBlocks(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)));
      const auto = autoList(cands);
      // a sender whose words are no known name is proposed for one tap, not filled in: a dated log's label looks the same
      // (second review of 11.10: «איסוף מהגן», «חוג כדורגל» filled the list and changed the text under a green bar)
      for (const n of names) ok(cands.some((c) => c.value === n && c.speaker), id + ": the sender «" + n + "» is proposed — got «" + cands.map((c) => c.value + "/" + c.conf).join(" | ") + "»");
      // «אמא:» and «אבא:» write in these chats too, and are no one's name
      ok(!cands.some((c) => /^(?:אמא|אבא)$/.test(c.value)), id + ": «אמא» and «אבא» are not proposed");
    }
  }

  console.log("\n— a label in its own line: the name on the next line —");
  for (const [lines, want] of [
    // a caption in lines: the role, then the party
    [["התובעת:", N1, "נ ג ד", "הנתבע:", N2, "כתב תביעה למזונות"], [[N1, "auto"], [N2, "auto"]]],
    [["המבקשת -", N1, "נגד", "המשיב –", N2, "בקשה למתן צו הגנה"], [[N1, "auto"], [N2, "auto"]]],
    [["הקטינה:", "ליה טרכטנגוט", "באמצעות אמה"], [["ליה טרכטנגוט", "auto"]]],
    // the signature
    [["התובעת מבקשת לקבל את הבקשה.", "בכבוד רב,", "שירה ולדמן, עו\"ד", "ב\"כ התובעת"], [["שירה ולדמן", "asked"]]],
    [["התובעת מבקשת לקבל את הבקשה.", "בכבוד רב", "שירה ולדמן", "ב\"כ התובעת"], [["שירה ולדמן", "asked"]]],
    [["ולראיה באתי על החתום:", N1], [[N1, "asked"]]],
    // a signature line between the label and the name
    [["התובעת מבקשת לקבל את הבקשה.", "בכבוד רב,", "____________________", "שירה ולדמן, עו\"ד"], [["שירה ולדמן", "asked"]]],
    // «עדי» is a first name too: on its own line it is a person, not a witness list's heading
    [["התובעת:", "עדי טרכטנגוט", "נ ג ד", "הנתבע:", N2], [["עדי טרכטנגוט", "auto"], [N2, "auto"]]],
    // the addressee of a letter, the same line too
    [["לכבוד", N1, "רחוב הנרקיס 9", "חיפה"], [[N1, "asked"]]],
    [["לכבוד:", N1, "רחוב הנרקיס 9"], [[N1, "asked"]]],
    [["לכבוד,", N1], [[N1, "asked"]]],
    [["לכבוד " + N1, "רחוב הנרקיס 9", "חיפה"], [[N1, "asked"]]],
    // a field label on a line of its own
    [["שם:", N1, "כתובת:", "רחוב הנרקיס 9"], [[N1, "asked"]]],
    [["שם מלא:", N1], [[N1, "asked"]]],
    [["מאת:", N1, "אל:", N2], [[N1, "asked"], [N2, "asked"]]],
  ]) await expect(lines, want);

  console.log("\n— a witness list: every line of it is a name —");
  for (const [lines, want] of [
    [["רשימת עדי התובעת:", "1. " + N1, "2. " + N2], [[N1, "asked"], [N2, "asked"]]],
    [["רשימת עדים:", "1) " + N1, "2) " + N2], [[N1, "asked"], [N2, "asked"]]],
    [["רשימת העדים מטעם הנתבע:", "(1) " + N1, "(2) " + N2], [[N1, "asked"], [N2, "asked"]]],
    [["עדי התביעה:", "א. " + N1, "ב. " + N2], [[N1, "asked"], [N2, "asked"]]],
    [["רשימת עדי הנתבע", "- " + N1, "- " + N2], [[N1, "asked"], [N2, "asked"]]],
    // Word's own numbering is not in the text: the lines are bare
    [["רשימת עדי התובעת:", N1, N2, "התובעת מבקשת לזמן את העדים."], [[N1, "asked"], [N2, "asked"]]],
    // a title before the name, a role or a job after it
    [["רשימת עדי התובעת:", "1. " + N1 + " – אחות התובעת", "2. ד\"ר " + N2, "3. שירה ולדמן, עובדת סוציאלית"], [[N1, "asked"], ["שירה ולדמן", "asked"]]],
  ]) await expect(lines, want);

  console.log("\n— a label in its own table cell: the name in the other cell of the row —");
  // the finding's caption: claimant and lawyer in one cell, the defendant in the third row
  await expect([{ table: [[["התובעת:"], [N1, "ע\"י ב\"כ עו\"ד שירה ולדמן"]], [[""], ["נ ג ד"]], [["הנתבע:"], [N2]]] }, "כתב תביעה למזונות", "התובעת מבקשת לחייב את הנתבע במזונות הקטינים."],
    [[N1, "auto"], [N2, "auto"]], "a caption laid out as a table");
  await expect([{ table: [[["התובעת"], [N1]], [["הנתבע"], [N2]]] }, "כתב תביעה למזונות"], [[N1, "auto"], [N2, "auto"]], "the role without a colon in its cell");
  await expect([{ table: [[[N1], ["התובעת:"]], [[N2], ["הנתבע:"]]] }, "כתב תביעה למזונות"], [[N1, "auto"], [N2, "auto"]], "the label in the second cell, the name in the first");
  await expect([{ table: [[["התובעת:", N1, "ע\"י ב\"כ עו\"ד שירה ולדמן"]], [["נ ג ד"]], [["הנתבע:", N2]]] }, "כתב תביעה למזונות"],
    [[N1, "auto"], [N2, "auto"]], "a caption in one column: the label and the name in the same cell, a line each");
  await expect([{ table: [[["שם פרטי"], ["נגה"], ["שם משפחה"], ["טרכטנגוט"]], [["מספר זהות"], ["034567891"], ["שם האב"], ["אליאב"]]] }],
    [["נגה", "asked"], ["טרכטנגוט", "asked"], ["אליאב", "asked"]], "a form laid out as a table");
  // a table laid out left to right in a right-to-left document: each label comes after its value
  await expect([{ table: [[["טרכטנגוט"], ["שם משפחה"], ["נגה"], ["שם פרטי"]]] }], [["נגה", "asked"], ["טרכטנגוט", "asked"]], "a form whose labels follow their values");
  // a header row: the label is a column's title, and the names are in the column below it
  await expect([{ table: [[["שם הקטין"], ["ת.ז."], ["תאריך לידה"]], [["ליה טרכטנגוט"], ["034567891"], ["1.2.2015"]], [["עומר טרכטנגוט"], ["034567909"], ["3.4.2017"]]] }],
    [["ליה טרכטנגוט", "asked"], ["עומר טרכטנגוט", "asked"]], "a table of the children, with a header row");
  await expect([{ table: [[["שם העד"], ["תפקיד"]], [[N1], ["אחות התובעת"]], [[N2], ["שכן"]]] }], [[N1, "asked"], [N2, "asked"]], "a table of witnesses, with a header row");

  console.log("\n— parties in the plural: a list, or two names in the line —");
  for (const [lines, want] of [
    [["התובעים:", "1. " + N1, "2. " + N2, "נ ג ד", "הנתבע:", "שירה ולדמן"], [[N1, "auto"], [N2, "auto"], ["שירה ולדמן", "auto"]]],
    [["המשיבים -", "(1) " + N1, "(2) " + N2], [[N1, "auto"], [N2, "auto"]]],
    // «עומר» is also a town: the page proposes it rather than filling it in by itself
    [["הקטינים:", "1. ליה טרכטנגוט", "2. עומר טרכטנגוט"], [["ליה טרכטנגוט", "auto"], ["עומר טרכטנגוט", "asked"]]],
    [["התובעים: " + N1 + " ו" + N2], [[N1, "auto"], [N2, "auto"]]],
    [["המבקשים: " + N1 + ", " + N2], [[N1, "auto"], [N2, "auto"]]],
  ]) await expect(lines, want);

  console.log("\n— «בעניין:» before the party of a motion —");
  for (const [lines, want] of [
    [["בעניין: " + N1, "בקשה למתן צו הגנה"], [[N1, "asked"]]],
    [["בעניין: " + N1 + ", ילידת 1985, מרחוב הנרקיס 9 בחיפה"], [[N1, "asked"]]],
    [["בעניין:", N1, "המבקשת"], [[N1, "asked"]]],
  ]) await expect(lines, want);
  await expect([{ table: [[["מאת:"], [N1]], [["נשלח:"], ["יום שני 12 במרץ 2026 21:15"]], [["אל:"], [N2]], [["נושא:"], ["הסדרי ראייה"]]] }],
    [[N1, "asked"], [N2, "asked"]], "a printed e-mail header laid out as a table");

  console.log("\n— label variants in the same line —");
  for (const [lines, want] of [
    [["שם פרטי: נגה", "שם משפחה: טרכטנגוט", "שם האב: אליאב"], [["נגה", "asked"], ["טרכטנגוט", "asked"], ["אליאב", "asked"]]],
    [["שם האם: " + N1], [[N1, "asked"]]],
    [["שם הקטין/ה: ליה טרכטנגוט"], [["ליה טרכטנגוט", "asked"]]],
    [["שם הקטין(ה): ליה טרכטנגוט"], [["ליה טרכטנגוט", "asked"]]],
    [["שם פרטי ושם משפחה: " + N1], [[N1, "asked"]]],
    [["שם בן/בת הזוג: " + N2], [[N2, "asked"]]],
    [["שם נעורים: טרכטנגוט"], [["טרכטנגוט", "asked"]]],
    [["מאת: " + N1, "אל: " + N2, "נושא: הסדרי ראייה"], [[N1, "asked"], [N2, "asked"]]],
    [["מאת: " + N1 + " <noga.t@example.com>", "עותק: שירה ולדמן"], [[N1, "asked"], ["שירה ולדמן", "asked"]]],
    [["מאת: \"" + N1 + "\" <noga.t@example.com>", "אל: " + N2 + " [mailto:eliav.f@example.com]"], [[N1, "asked"], [N2, "asked"]]],
    // several recipients in one line, and a direction mark before the label
    [["אל: " + N1 + "; " + N2], [[N1, "asked"], [N2, "asked"]]],
    [["עותק: " + N1 + " ו" + N2], [[N1, "asked"], [N2, "asked"]]],
    [["אל: " + N1 + " <noga.t@example.com>; " + N2 + " <eliav.f@example.com>; שירה ולדמן"], [[N1, "asked"], [N2, "asked"], ["שירה ולדמן", "asked"]]],
    [["‏מאת: " + N1], [[N1, "asked"]]],
  ]) await expect(lines, want);

  console.log("\n— an initial and a surname in a party slot —");
  for (const [lines, want] of [
    [["התובעת: נ. טרכטנגוט", "הנתבע: א. פרוינדליך", "כתב תביעה למזונות"], [["טרכטנגוט", "asked"], ["פרוינדליך", "asked"]]],
    [["הנתבע: א' פרוינדליך"], [["פרוינדליך", "asked"]]],
    [["המבקשת - נ.טרכטנגוט"], [["טרכטנגוט", "asked"]]],
    [["התובעת:", "נ. טרכטנגוט", "נ ג ד", "הנתבע:", "א. פרוינדליך"], [["טרכטנגוט", "asked"], ["פרוינדליך", "asked"]]],
    // after a title, and in the other slots, the same
    [["עו\"ד ש. ולדמן הגישה את הבקשה.", "גב' נ. טרכטנגוט נכחה בדיון."], [["ולדמן", "asked"], ["טרכטנגוט", "asked"]]],
    [["מאת: נ. טרכטנגוט", "אל: א' פרוינדליך"], [["טרכטנגוט", "asked"], ["פרוינדליך", "asked"]]],
    [["לכבוד", "נ. טרכטנגוט", "רחוב הנרקיס 9"], [["טרכטנגוט", "asked"]]],
    [["התובעת מבקשת לקבל את הבקשה.", "בכבוד רב,", "ש. ולדמן, עו\"ד"], [["ולדמן", "asked"]]],
    [["שם: נ. טרכטנגוט", "כתובת: רחוב הנרקיס 9"], [["טרכטנגוט", "asked"]]],
  ]) await expect(lines, want);
  {
    // she replaces what the review flags: the surname goes, the initial stays, and the line still reads as an initial and a surname
    const lines = ["התובעת: נ. טרכטנגוט", "כתב תביעה למזונות"];
    const out = await sent(lines, (await scan(lines)).flagged);
    ok(!out.includes("טרכטנגוט") && /התובעת: נ\. [א-ת]/.test(out), "an initial and a surname go out as the initial and another surname: «" + out.split("\n")[0] + "»");
  }

  console.log("\n— and the text that reaches the AI —");
  {
    const cap = [{ table: [[["התובעת:"], [N1, "ע\"י ב\"כ עו\"ד שירה ולדמן"]], [[""], ["נ ג ד"]], [["הנתבע:"], [N2]]] }, "כתב תביעה למזונות", "התובעת מבקשת לחייב את הנתבע במזונות הקטינים."];
    const r = await scan(cap);
    const out = await sent(cap, r.auto);
    ok(!/טרכטנגוט|פרוינדליך/.test(out), "a caption table: both parties are replaced by the list she starts with — «" + out.replace(/\n/g, " ⏎ ") + "»");
    const lines = chat((t) => `[12.3.2026, ${t}] `);
    const c = await scan(lines);
    const o2 = await sent(lines, c.auto);
    ok(!o2.includes("טרכטנגוט") && /21:15\] [א-ת]+ [א-ת]+: תחזיר/.test(o2), "a chat: the sender who writes twice is replaced, the time stays — «" + o2.split("\n")[0] + "»");
    // the bench's c2: the sender «ליעד בן-עמיאל» is written «בן עמיאל» in a message, with a space
    const raw = fs.readFileSync(path.join(__dirname, "..", "bench", "corpus", "c2.docx"));
    const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    // she accepts the two proposed senders
    const auto = [...autoList(C.discover(await C.readBlocks(buf.slice(0)))), "מייסא סרחאן", "ליעד בן-עמיאל"];
    const r2 = await C.redactDocx(buf.slice(0), auto.map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], OPT);
    const o3 = r2.preview.map((b) => b.text).join("\n");
    ok(!/עמיאל|סרחאן/.test(o3), "the bench's c2: both senders, once accepted, and their surnames alone are gone — «" + o3.replace(/\n/g, " ⏎ ") + "»");
  }
  {
    // a part of a listed name, written another way: a space for the hyphen, vowel marks between the letters
    const o1 = await sent(["ליעד בן-עמיאל הגיש בקשה.", "בן עמיאל לא התייצב לדיון."], ["ליעד בן-עמיאל"]);
    ok(!o1.includes("עמיאל"), "a surname with a space where the list has a hyphen is replaced too — «" + o1.replace(/\n/g, " ⏎ ") + "»");
    const o2 = await sent(["נגה טרכטנגוט הגישה תביעה.", "הגב' טְרַכְטֶנְגוֹט מבקשת מזונות."], [N1]);
    ok(!o2.replace(/[֑-ׇ]/g, "").includes("טרכטנגוט"), "a surname with vowel marks is replaced too — «" + o2.replace(/\n/g, " ⏎ ") + "»");
  }

  console.log("\n— left alone: a label followed by something that is not a name —");
  for (const [items, words] of [
    // a court, a public body, an office, a role
    [["לכבוד", "בית המשפט הנכבד", "המבקשת מתכבדת להגיש בקשה זו."], ["בית", "המשפט", "הנכבד"]],
    [["לכבוד בית המשפט הנכבד", "המבקשת מתכבדת להגיש בקשה זו."], ["בית", "המשפט", "הנכבד"]],
    [["לכבוד", "בית המשפט לענייני משפחה בחיפה"], ["בית", "המשפט", "לענייני", "משפחה"]],
    [["לכבוד", "המוסד לביטוח לאומי", "סניף חיפה"], ["המוסד", "לביטוח", "לאומי", "סניף"]],
    [["לכבוד", "עיריית חיפה", "המחלקה לשירותים חברתיים"], ["עיריית", "המחלקה", "לשירותים"]],
    [["לכבוד", "ראש העירייה"], ["ראש", "העירייה"]],
    [["לכבוד", "מנהל המחלקה לשירותים חברתיים"], ["מנהל", "המחלקה"]],
    [["לכבוד", "פקידת הסעד לחוק הנוער"], ["פקידת", "הסעד"]],
    [["בכבוד רב,", "עמותת שביל הלב"], ["עמותת", "שביל", "הלב"]],
    // «לכבוד» in a sentence, not above an address
    [["לכבוד החג קיבלו הילדים מתנות מהאב."], ["החג", "קיבלו"]],
    [["הם הגיעו לכבוד בר המצווה של הבן."], ["בר", "המצווה"]],
    [["אל: לבית המשפט לענייני משפחה"], ["לבית", "המשפט"]],
    [["מאת: לשכת עורכי הדין"], ["לשכת", "עורכי"]],
    // a role followed by what she says, not who she is
    [["התובעת: אין לה התנגדות לבקשה."], ["אין", "לה", "התנגדות"]],
    [["התובעת:", "אין לה התנגדות לבקשה."], ["אין", "לה", "התנגדות"]],
    [["התובעת:", "הגישה תביעה למזונות הקטינים."], ["הגישה", "תביעה"]],
    [["התובעת:", "המשרד להגנת הסביבה"], ["המשרד", "להגנת", "הסביבה"]],
    [["התובעת: א. הגישה תביעה למזונות."], ["א.", "הגישה", "תביעה"]],
    // a sender or a recipient that is a body
    [["מאת: בית המשפט", "אל: הצדדים", "נושא: הודעה על דחיית דיון"], ["בית", "המשפט", "הצדדים", "הודעה"]],
    [["מאת: מזכירות בית המשפט"], ["מזכירות", "בית"]],
    [["אל: לשכת הרווחה חיפה"], ["לשכת", "הרווחה"]],
    [["אל: כל הצדדים"], ["כל", "הצדדים"]],
    [["אל: מזכירות בית המשפט; לשכת הרווחה"], ["מזכירות", "לשכת", "הרווחה"]],
    [["עותק: טרכטנגוט ושות', עורכי דין"], ["שות'", "עורכי", "דין"]],
    [["נשלח: יום שני, 12 במרץ 2026 21:15"], ["נשלח", "יום", "שני"]],
    // the signature of an office or a role
    [["בכבוד רב,", "ב\"כ התובעת"], ["ב\"כ", "התובעת"]],
    [["בכבוד רב,", "משרד עורכי דין"], ["משרד", "עורכי", "דין"]],
    // a witness list of roles and bodies
    [["רשימת עדי התובעת:", "1. התובעת", "2. עובדת סוציאלית מטעם לשכת הרווחה", "3. מנהל בית הספר", "4. נציג המוסד לביטוח לאומי"],
      ["התובעת", "עובדת", "סוציאלית", "מנהל", "נציג", "המוסד"]],
    [["רשימת עדים:", "1. ראו נספח א' לתצהיר"], ["ראו", "נספח"]],
    // a header row's other titles, a plural party followed by what it did, a motion's subject
    [[{ table: [[["שם העד"], ["תפקיד"]], [[N1], ["אחות התובעת"]]] }], ["תפקיד", "אחות"]],
    [["התובעים: הגישו תביעה למזונות הקטינים."], ["התובעים", "הגישו", "תביעה"]],
    [["התובעים:", "1. הגישו תביעה", "2. ביקשו סעד זמני"], ["הגישו", "תביעה", "ביקשו", "סעד"]],
    [["בעניין: בקשה לצו הגנה"], ["בקשה", "לצו"]],
    [["בעניין: הסדרי שהות"], ["הסדרי", "שהות"]],
    [["בעניין: חוק הכשרות המשפטית והאפוטרופסות, התשכ\"ב-1962"], ["חוק", "הכשרות"]],
    [["בעניין:", "בקשה למתן צו הגנה"], ["בקשה", "למתן"]],
    [[{ table: [[["הנתבע:"], ["לא התייצב לדיון"]]] }], ["לא", "התייצב"]],
    // a field followed by a subject, an empty form, an empty cell
    [["שם:", "בקשה לצו הגנה"], ["בקשה", "לצו", "הגנה"]],
    [["שם פרטי:", "שם משפחה:", "שם האב:"], ["פרטי", "משפחה", "האב"]],
    [[{ table: [[["שם:"], [""]], [["כתובת:"], ["רחוב הנרקיס 9"]]] }], ["כתובת", "רחוב", "הנרקיס"]],
    // a chat line whose sender is a phone number, a parent, a system line
    [["[12.3.2026, 21:15] ‎+972 54-771-2093: תחזיר את הילדים עד שמונה", "[12.3.2026, 21:16] ‎+972 54-771-2093: אני בדרך"], ["+972", "תחזיר"]],
    [["[12.3.2026, 21:15] אמא: כן, ואת צליל גם.", "[12.3.2026, 21:20] אמא: בסדר. תביא את התיק."], ["אמא"]],
    [["12.3.2026, 21:14 - ההודעות והשיחות מוצפנות מקצה לקצה. אף אחד מחוץ לצ'אט הזה לא יכול לקרוא אותן."], ["ההודעות", "והשיחות", "מוצפנות"]],
    [["12.3.2026, 21:15 - הודעה: המשיב לא התייצב לדיון."], ["הודעה"]],
  ]) await untouched(items, words);
  {
    // a name with a geresh after its first letter is not an initial
    const r = await scan(["התובעת: ג'ני טרכטנגוט", "כתב תביעה"]);
    ok(r.flagged.includes("ג'ני טרכטנגוט") && !r.flagged.includes("ני טרכטנגוט") && !r.flagged.includes("טרכטנגוט"), "«ג'ני» is a first name, not an initial — " + show(r));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
