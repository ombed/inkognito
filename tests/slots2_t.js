/* The review of the slot work (11.10): what the slots read that is not a name, and the forms they still missed.

   tests/slots_t.js taught the rules to read a name wherever its label sits. The review fed them ordinary
   documents and found the other side of it, with the model off:
   - a hearing protocol, the role alone on its line and the statement below it: the opening words of
     statements filled «מי בתיק» by themselves and were replaced in the text that reaches the AI;
   - a dated log («12.3.2026, 16:00 - איסוף: …») read as a chat, its labels listed as people;
   - a mail line cut a surname at a ו inside it when a title, a tab or a soft break followed the name;
   - a «שם» field read a whole column (exhibits, contacts) and one-column boxes past the name;
   - a couple sharing a surname («נגה ואליאב טרכטנגוט») listed as one garbled name, the surname sent out;
   - office titles, holidays, subjects, «לא ידוע», «ר' תצהיר» proposed as people (the bar went amber);
   - and the siblings of each fixed form: a time-first chat stamp, a direction mark before the name,
     signatures, field labels, addressee lines, English mail labels, two initials.
   What she sees is what is checked (the page's own rule for «מי בתיק», as in slots_t.js), and what reaches
   the AI when she starts with that list. Every name and number here is invented. */
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

// the page's options (page-component.js opts()), as in slots_t.js
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };

// a .docx of paragraphs, tables ({table: rows}) and raw paragraphs ({raw: "<w:p>…</w:p>"}, for a soft break)
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const TC = (c) => `<w:tc>${[].concat(c).filter((x) => x !== "").map(P).join("") || "<w:p/>"}</w:tc>`;
const TBL = (rows) => `<w:tbl>${rows.map((r) => `<w:tr>${r.map(TC).join("")}</w:tr>`).join("")}</w:tbl>`;
const docx = (items) => mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    items.map((x) => (typeof x === "string" ? P(x) : x.raw ? x.raw : TBL(x.table))).join("") + "</w:body></w:document>" },
]);
// one paragraph whose lines are joined by soft breaks (<w:br/>), as a printed e-mail header often is
const BR = (...lines) => ({ raw: "<w:p>" + lines.map((t, i) => `<w:r>${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join("") + "</w:p>" });

// the page's rule for «מי בתיק» (page-component.js showPeople), as slots_t.js mirrors it
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
const rules = (list) => list.map((v) => ({ value: v, kind: "NAME", replacement: "" }));
async function scan(items) {
  const cands = C.discover(await C.readBlocks(docx(items)));
  const auto = autoList(cands), sug = proposed(cands, auto);
  const res = await C.redactDocx(docx(items), [], [], OPT);
  const flagged = res.flagged.filter((f) => f.label === "שם (לפי הקשר)").map((f) => f.value);
  return { cands, auto, sug, flagged, complete: res.verification.complete };
}
// what reaches the AI when she starts with the list the page fills by itself, and whether the bar is green then
async function withAuto(items) {
  const r = await scan(items);
  const res = await C.redactDocx(docx(items), rules(r.auto), [], OPT);
  return { ...r, out: res.preview.map((b) => b.text).join("\n"), done: res.verification.complete };
}
const plain = (items) => items.flatMap((x) => (typeof x === "string" ? [x] : x.raw ? [] : x.table.flat(2))).filter(Boolean);
const what = (items) => items.map((x) => (typeof x === "string" ? x : x.raw ? "[soft breaks]" : "[table]")).join(" ⏎ ");
const show = (r) => "auto «" + r.auto.join(" | ") + "», proposed «" + r.sug.join(" | ") + "», flagged «" + r.flagged.join(" | ") + "»";
// want: [value, "auto"] fills the list by itself; [value, "asked"] is proposed or flagged; either way flagged with an empty list
async function expect(items, want, label) {
  const r = await scan(items);
  for (const [v, how] of want) {
    const seen = how === "auto" ? r.auto.includes(v) : r.auto.includes(v) || r.sug.includes(v) || r.flagged.includes(v);
    ok(seen && r.flagged.includes(v), "«" + (label || what(items)) + "»: «" + v + "» " + (how === "auto" ? "auto-listed" : "proposed or flagged") + " and flagged with an empty list — " + show(r));
  }
  ok(!r.complete, "«" + (label || what(items)) + "»: the bar is not green while a name waits");
  return r;
}
// nothing she is asked about holds one of these words
async function untouched(items, words, label) {
  const r = await scan(items);
  const bad = [...r.auto, ...r.sug, ...r.flagged].filter((v) => words.some((w) => v.split(/\s+/).includes(w)));
  ok(!bad.length, "«" + (label || what(items)) + "»: nothing proposed, got «" + bad.join(" | ") + "» — " + show(r));
  return r;
}
// a document with no one in it: nothing listed or asked, the bar is green, and the text reaches the AI as it is
async function clean(items, label) {
  const r = await withAuto(items);
  const asked = [...new Set([...r.auto, ...r.sug, ...r.flagged])];
  ok(!asked.length && r.complete, "«" + label + "»: nothing listed or asked, a green bar — " + show(r));
  ok(r.out === plain(items).join("\n"), "«" + label + "»: the text reaches the AI unchanged — «" + r.out.replace(/\n/g, " ⏎ ").slice(0, 300) + "»");
}

(async () => {
  const N1 = "נגה טרכטנגוט", N2 = "אליאב פרוינדליך";

  console.log("\n— a hearing protocol: the statement under a role is not a name —");
  {
    // the usual layout: the speaker's role alone on its line, what was said below it
    const said = [
      "מסכימה.", "מסכים להצעה.", "מבקשת להוסיף שהאב לא שילם.", "מאשרת את הדברים.", "רוצה שהילדים יגורו איתי.",
      "מתחייב להעביר את המזונות עד העשירי בכל חודש.", "חוזרת על טענותיי.", "מוכנה לגישור.", "שמעתי את ההצעה ואני מקבלת אותה.",
      "הבנתי.", "תודה רבה.", "הילדים צריכים את שני ההורים.", "מבקש דחייה של שבועיים.", "מודה בעובדות.", "מכחיש את הטענות.",
      "שילמתי הכול.", "מסכימה להסדר השהות המוצע.", "מבקשת צו הגנה.", "עובד במשמרות לילה.", "גרה בדירה שכורה.",
      "מתנגד נחרצות", "מסכים חלקית", "חוזרת על הבקשה", "נכון", "לא נכון",
    ];
    const role = (i) => (i % 2 ? "המשיב:" : "המבקשת:");
    await clean(["פרוטוקול דיון", ...said.flatMap((s, i) => [role(i), s]), "החלטה", "ההסכם מאושר."], "25 statements, each under its role on its own line");
    await clean(["פרוטוקול דיון", { table: said.map((s, i) => [[role(i)], [s]]) }], "the same statements in a two-column table");
    await clean(["פרוטוקול דיון", { table: said.map((s, i) => [[i % 2 ? "המשיב" : "המבקשת"], [s]]) }], "the same table, the role without a colon");
    await clean(["פרוטוקול דיון", ...said.flatMap((s, i) => [i % 2 ? "המשיב -" : "המבקשת –", s])], "the role with a dash");
    await clean(["פרוטוקול דיון", ...said.flatMap((s, i) => [i % 2 ? "הנתבעים:" : "התובעים:", s])], "a plural role over each statement");
    await clean(["פרוטוקול דיון", "ב\"כ המבקשת:", "אנו מבקשים לאשר את ההסכם שהוגש.", "המבקשת:", "מבקשת לאשר את ההסכם.", "המשיב:", "מסכים לבקשה.",
      "המבקשת:", "מבינה את משמעות ההסכם.", "המשיב:", "מתחייב לשלם במועד.", "המבקשת:", "מוותרת על כל טענה נוספת.", "המשיב:", "מאשר את דברי המבקשת.",
      "החלטה", "ההסכם מאושר וניתן לו תוקף של פסק דין."], "a protocol of an agreement");
    // the short forms: one or two words, with or without a period
    await clean(["התובעת:", "נכון.", "הנתבע:", "לא נכון.", "התובעת:", "מסכימה.", "הנתבע:", "מתנגד."], "short answers with a period");
    await clean(["התובעת:", "נכון", "הנתבע:", "מתנגד", "התובעת:", "נכון", "הנתבע:", "מתנגד"], "short answers without a period");
    await clean(["התובעת:", "חוזרת על הבקשה", "הנתבע:", "מסכים חלקית", "התובעת:", "חוזרת על הבקשה"], "two-word answers");
    // a single exchange, too short to look like a protocol
    await clean(["המשיב:", "מתנגד נחרצות לבקשה"], "a single statement without a period");
    // the role and a dash before what was said, in one line: at most asked about, never listed by itself
    const r = await withAuto(["התובעת - מסכימה בהחלט", "הנתבע - מתנגד נחרצות"]);
    ok(!r.auto.length && r.out === "התובעת - מסכימה בהחלט\nהנתבע - מתנגד נחרצות", "a statement after a role and a dash in one line is not listed by itself — " + show(r));
  }
  console.log("\n— a caption over a hearing: the parties' names under their roles are read (bug hunt of 1.11) —");
  {
    // the caption's role labels were counted with the hearing's turns; once most labels in the part stood over speech, no
    // label read its neighbour, and both names stayed in the text with nothing asked and a green bar
    const hear = ["פרוטוקול הדיון", "התובעת:", "חוזרת על הבקשה ומבקשת להורות על מזונות זמניים.", "הנתבע:", "מתנגד לבקשה, אין לו הכנסה קבועה.",
      "התובעת:", "הוא עובד בחברה של אחיו ומקבל משכורת.", "הנתבע:", "זה לא נכון, אני מובטל מאז הקיץ."];
    await expect(["התובעת:", N1, "נ ג ד", "הנתבע:", N2, ...hear], [[N1, "auto"], [N2, "auto"]], "a caption over two turns per side");
    await expect([{ table: [[["התובעת:"], [N1]], [[""], ["נ ג ד"]], [["הנתבע:"], [N2]]] }, ...hear], [[N1, "auto"], [N2, "auto"]], "the caption as a table");
    await expect(["התובעת:", N1, "הנתבע:", N2, ...hear], [[N1, "auto"], [N2, "auto"]], "a caption without «נגד»");
    await clean(hear, "the same hearing without a caption");
  }
  // the same cause in a table and under a plural label: a value or a sub-heading is not a party
  await clean([{ table: [[["התובעת"], ["שכר חודשי"]], [["הנתבע"], ["הכנסות מעסק"]]] }, "שכר חודשי של התובעת הוא 9,000 ש\"ח."], "an income table");
  await clean(["המבקשים –", "פרטים אישיים", "מצב משפחתי", "פרטים אישיים נוספים מפורטים בנספח א'."], "a plural party over sub-headings");
  await clean([{ table: [[["המבקשת"], ["המשיב"]], [["עובדת"], ["מובטל"]]] }], "an employment table");
  await clean([{ table: [[["התובעת"], ["הנתבע"]], [["דירה ברחוב הנרקיס"], ["רכב פרטי"]]] }], "an assets table");
  await clean([{ table: [[["הנתבע"], ["דמי מזונות"]], [["המשיב"], ["חייל בשירות סדיר"]]] }], "a role beside a value");
  // and a caption is still read: a name alone in its line fills the list, a name with more after it is asked about
  await expect(["התובעת:", N1 + ", ת.ז. 034567891", "מרחוב הנרקיס 9, חיפה", "נ ג ד", "הנתבע:", N2 + ", ת.ז. 034567909"], [[N1, "asked"], [N2, "asked"]], "a caption with the ID after each name");
  await expect([{ table: [[["התובעת:"], [N1 + " ע\"י ב\"כ עו\"ד שירה ולדמן"]], [["הנתבע:"], [N2]]] }], [[N1, "asked"], [N2, "auto"]], "a caption table, the lawyer after the name");

  console.log("\n— a dated log is not a chat: its labels are not senders —");
  for (const [lines, words] of [
    [["12.3.2026, 16:00 - איסוף: האב אסף את הילדים מהגן.", "13.3.2026, 19:00 - החזרה: האב החזיר את הילדים באיחור.", "14.3.2026, 16:00 - איסוף: האב לא הגיע.", "15.3.2026, 19:00 - החזרה: הילדים חזרו רעבים."], ["איסוף", "החזרה"]],
    [["12.3.2026 21:15 – אירוע: האב צעק על הקטינה.", "14.3.2026 20:00 – אירוע: האב איחר שוב."], ["אירוע"]],
    [["12.3.2026, 08:00 - תזכורת: להביא את התיק", "13.3.2026, 08:00 - תזכורת: לשלם מזונות"], ["תזכורת"]],
    [["12.03.2026 09:30 ביקור: האב הגיע לבית הספר.", "15.03.2026 09:30 ביקור: האב הגיע שוב."], ["ביקור"]],
    [["1.3.2026, 10:00 - העברה: 2,000 ש\"ח", "1.4.2026, 10:00 - העברה: 1,500 ש\"ח"], ["העברה"]],
    [["12.3.2026, 16:00 - שיחת וידאו: האב לא ענה.", "13.3.2026, 16:00 - שיחת וידאו: האב ענה."], ["שיחת", "וידאו"]],
    [["12.3.2026, 16:00 - גן: הילדה נאספה.", "13.3.2026, 16:00 - גן: הילדה לא נאספה."], ["גן"]],
    [["[12.3.2026, 21:15] מספר לא ידוע: שלום", "[12.3.2026, 21:16] מספר לא ידוע: מי זה?"], ["מספר", "ידוע"]],
    // the same labels in other log forms
    [["[12.3.2026, 16:00] איסוף: האב אסף את הילדים.", "[13.3.2026, 16:00] איסוף: האב לא הגיע."], ["איסוף"]],
    [["12.3.2026, 16:00 - טיפול: הילד נלקח לרופא.", "19.3.2026, 16:00 - טיפול: ביקורת."], ["טיפול"]],
    [["12.3.2026, 16:00 - הסעה: האב איחר.", "13.3.2026, 16:00 - הסעה: האם הסיעה."], ["הסעה"]],
  ]) await untouched(lines, words);
  for (const [items, label] of [
    [["12.3.2026, 16:00 - איסוף: האב אסף את הילדים מהגן.", "13.3.2026, 19:00 - החזרה: האב החזיר את הילדים באיחור.", "14.3.2026, 16:00 - איסוף: האב לא הגיע.", "15.3.2026, 19:00 - החזרה: הילדים חזרו רעבים.", "האב אחראי על איסוף הילדים ועל החזרה בזמן."], "a pickup log"],
    [["12.3.2026 21:15 – אירוע: האב צעק על הקטינה.", "14.3.2026 20:00 – אירוע: האב איחר שוב.", "כל אירוע תועד ביומן."], "an incident log"],
  ]) {
    // the dates move by the page's own date shift; everything else reaches the AI as it is
    const r = await withAuto(items), undated = (s) => s.replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g, "D");
    ok(!r.auto.length && undated(r.out) === undated(plain(items).join("\n")), "«" + label + "»: nothing is listed by itself, and the text reaches the AI unchanged — «" + r.out.replace(/\n/g, " ⏎ ") + "»");
  }
  {
    // a contact saved by a first name the lists do not know is asked about, not listed by itself
    const r = await scan(["[12.3.2026, 21:15] ליעד: תחזיר את הילדים עד שמונה", "[12.3.2026, 21:20] ליעד: כבר שמונה וחצי"]);
    ok(!r.auto.includes("ליעד") && (r.sug.includes("ליעד") || r.flagged.includes("ליעד")), "a one-word contact the lists do not know is asked about, not listed by itself — " + show(r));
  }

  console.log("\n— a mail line: the whole name, never cut inside the surname —");
  for (const [items, want, label] of [
    [["מאת: " + N1 + " עו\"ד"], [[N1, "asked"]], "a title after the name"],
    [["מאת: " + N1 + "\tנשלח: 12.3.2026"], [[N1, "asked"]], "a tab, then the date"],
    [[BR("מאת: " + N1, "נשלח: יום שני 12 במרץ 2026")], [[N1, "asked"]], "a soft break, then the date"],
    [[BR("מאת: " + N1, "אל: " + N2)], [[N1, "asked"], [N2, "asked"]], "a header in one paragraph with soft breaks"],
    [["אל: " + N2 + ", " + N1 + " עו\"ד"], [[N2, "asked"], [N1, "asked"]], "a second recipient with a title"],
    [["עותק: " + N1 + " עו\"ד"], [[N1, "asked"]], "a copy line with a title"],
    // a ו inside the surname, then a dash and a job
    [["מאת: נגה אוחיון - מנהלת"], [["נגה אוחיון", "asked"]], "a dash and a job after the name"],
  ]) {
    const r = await expect(items, want, label);
    ok(![...r.auto, ...r.sug, ...r.flagged].some((v) => /טרכטנג$|אוחי$|פרוינדלי$/.test(v)), "«" + label + "»: no name cut short — " + show(r));
  }
  {
    // she accepts what is proposed: the name is gone everywhere it appears
    const items = [BR("מאת: " + N1, "נשלח: יום שני 12 במרץ 2026"), N1 + " כתבה שוב."];
    const r = await scan(items);
    const res = await C.redactDocx(docx(items), rules([...r.auto, ...r.sug, ...r.flagged]), [], OPT);
    const out = res.preview.map((b) => b.text).join("\n");
    ok(!out.includes("טרכטנגוט"), "accepting what a soft-break header proposes removes the name — «" + out.replace(/\n/g, " ⏎ ") + "»");
  }

  console.log("\n— a name field reads names, not a column of other things —");
  for (const [items, words, label] of [
    [[{ table: [[["נספח"], ["שם"], ["עמוד"]], [["א"], ["תצהיר התובעת"], ["3"]], [["ב"], ["תלושי שכר"], ["7"]], [["ג"], ["חוות דעת פסיכולוגית"], ["12"]], [["ד"], ["אישור מעסיק"], ["15"]]] }], ["תצהיר", "תלושי", "שכר", "חוות", "דעת", "אישור", "מעסיק"], "an exhibits table"],
    [[{ table: [[["שם"], ["כתובת"], ["טלפון"]], [["קופת חולים מאוחדת"], ["רחוב הנרקיס 9"], ["04-1234567"]], [["מתנ\"ס כרמל"], ["רחוב הגפן 3"], ["04-7654321"]], [["מרכז קשר"], ["רחוב הזית 1"], ["04-1111111"]]] }], ["קופת", "חולים", "מאוחדת", "מתנ\"ס", "כרמל", "מרכז", "קשר"], "a contacts table"],
    [[{ table: [[["שם"], ["תפקיד"]], [["מנהלת הגן"], ["עדה"]], [["רופאת המשפחה"], ["עדה"]]] }], ["מנהלת", "רופאת"], "a table of roles under «שם»"],
    [[{ table: [[["שם הקטין"], ["ת.ז."]], [["טרם נקבע"], ["-"]]] }], ["טרם", "נקבע"], "a children's table with no name yet"],
    [[{ table: [[["שם:"]], [[N1]], [["ת.ז. 034567891"]], [["חיפה"]], [["נשואה ואם לשניים"]]] }], ["חיפה", "נשואה"], "a one-column box: the lines after the name"],
    [[{ table: [[["שם:"]], [[N1]], [["חיפה"]]] }], ["חיפה"], "a one-column box: a town after the name"],
    [["שם:", "חסוי"], ["חסוי"], "a field whose value is withheld"],
  ]) await untouched(items, words, label);
  await expect([{ table: [[["שם:"]], [[N1]], [["ת.ז. 034567891"]], [["חיפה"]]] }], [[N1, "asked"]], "a one-column box: the name is still asked about");

  console.log("\n— a couple sharing a surname —");
  for (const [items, label] of [
    [["המבקשים:", "נגה ואליאב טרכטנגוט", "בקשה לאישור הסכם גירושין"], "a plural party, the couple on the next line"],
    [["המבקשים: נגה ואליאב טרכטנגוט", "בקשה לאישור הסכם גירושין"], "a plural party, the couple on the same line"],
    [["התובעת: נגה ואליאב טרכטנגוט", "כתב תביעה"], "a singular role over a couple"],
    [[{ table: [[["המבקשים:"], ["נגה ואליאב טרכטנגוט"]]] }, "בקשה לאישור הסכם גירושין"], "a caption table over a couple"],
    [["המבקשים: נגה ו-אליאב טרכטנגוט", "בקשה לאישור הסכם"], "a couple joined by ו-"],
  ]) {
    const r = await withAuto(items);
    ok(![...r.auto, ...r.sug].some((v) => v.split(/\s+/).slice(1).some((w) => w[0] === "ו")), "«" + label + "»: two people are not one garbled name — " + show(r));
    ok(r.auto.includes("אליאב טרכטנגוט") || r.sug.includes("אליאב טרכטנגוט"), "«" + label + "»: the second person is found with the surname — " + show(r));
    ok(r.flagged.includes("נגה"), "«" + label + "»: the first is asked about — " + show(r));
    ok(!(r.out.includes("טרכטנגוט") && r.done), "«" + label + "»: the surname does not go out under a green bar — «" + r.out.replace(/\n/g, " ⏎ ") + "»");
  }
  // a surname that opens with ו is still one person, and two full names are still two
  await expect(["התובעת: שירה ולדמן", "כתב תביעה"], [["שירה ולדמן", "auto"]], "a surname that opens with ו");
  await expect(["המבקשים: " + N1 + " ו-" + N2, "בקשה לאישור הסכם"], [[N1, "auto"], [N2, "auto"]], "two full names");

  console.log("\n— left alone: what the slots proposed that is not a person —");
  for (const [items, words] of [
    // an initial that is a reference or a sub-clause
    [["התובעת: ר' תצהיר האם, סעיף 4."], ["תצהיר", "האם"]],
    [["המשיבה – ר' ההחלטה מיום 12.3.2026."], ["ההחלטה"]],
    [["התובעים: א. פירוק השיתוף בדירה"], ["פירוק", "השיתוף"]],
    [["הנתבע: ר' נספח ג' לכתב ההגנה."], ["נספח", "לכתב"]],
    // a copy line, a sender or an addressee that is a client, an office or a title
    [["העתק: מרשתי"], ["מרשתי"]], [["העתק: מרשי"], ["מרשי"]], [["העתק: גזברות"], ["גזברות"]],
    [["מאת: רשם המקרקעין"], ["רשם", "המקרקעין"]], [["מאת: תמיכה טכנית"], ["תמיכה", "טכנית"]],
    [["לכבוד", "רשם המקרקעין", "ירושלים"], ["רשם", "המקרקעין"]], [["לכבוד", "רואה החשבון"], ["רואה", "החשבון"]],
    [["לכבוד", "שמאי המקרקעין"], ["שמאי", "המקרקעין"]], [["לכבוד", "רשם הירושות"], ["רשם", "הירושות"]],
    [["לכבוד", "שופט התורן"], ["שופט", "התורן"]], [["לכבוד", "מרשתך"], ["מרשתך"]], [["לכבוד", "רבותיי,", "הנדון: הסדרי שהות"], ["רבותיי"]],
    [["לכבוד", "נוטריון מוסמך"], ["נוטריון", "מוסמך"]],
    // «לכבוד» opens a sentence
    [["לכבוד פסח, קיבלו הילדים מתנות מהאב."], ["פסח"]], [["לכבוד חנוכה, נסעו הילדים לסבתא."], ["חנוכה"]],
    [["לכבוד יום ההולדת, ערכה האם מסיבה."], ["יום", "ההולדת"]],
    // a signature label over a greeting
    [["בכבוד רב,", "תודה מראש"], ["תודה", "מראש"]],
    // a motion's subject
    [["בעניין: אימוץ"], ["אימוץ"]], [["בעניין: ירושה"], ["ירושה"]], [["בעניין: גירושין"], ["גירושין"]],
    [["בעניין: פירוק שיתוף"], ["פירוק", "שיתוף"]], [["בעניין: יישוב סכסוך"], ["יישוב", "סכסוך"]], [["בעניין: מינוי אפוטרופוס"], ["מינוי"]],
    // a field whose value says there is no name
    [["שם פרטי: לא ידוע"], ["ידוע"]], [["שם האב: לא רשום"], ["רשום"]], [["שם פרטי: חסוי"], ["חסוי"]],
    [["שם משפחה: כנ\"ל"], ["כנ\"ל"]], [["שם האב: נפטר"], ["נפטר"]],
    // a plural role in prose or before what the parties are
    [["הסכסוך בין התובעים - שהינם אחים - נמשך שנים."], ["שהינם", "אחים"]],
    [["המערערים: יורשי המנוח"], ["יורשי", "המנוח"]], [["המשיבים: בני הזוג"], ["בני", "הזוג"]],
    // a witness list of documents
    [["רשימת עדים ומסמכים:", "1. " + N1, "2. תצהיר התובעת", "3. חוות דעת המומחה"], ["תצהיר", "חוות", "דעת"]],
  ]) await untouched(items, words);
  // and the same slots still read a name
  await expect(["לכבוד " + N1 + ", רחוב הנרקיס 9, חיפה"], [[N1, "asked"]], "an addressee and an address on the same line");
  await expect(["לכבוד עו\"ד שירה ולדמן, ב\"כ התובעת"], [["שירה ולדמן", "asked"]], "an addressee with a title and a role");
  await expect(["בעניין: " + N1 + ", ילידת 1985"], [[N1, "asked"]], "a motion about a person");

  console.log("\n— the siblings of each fixed form —");
  {
    const chat = (stamp) => [stamp("21:15") + N1 + ": תחזיר את הילדים עד שמונה", stamp("21:16") + N2 + ": אני בדרך", stamp("21:20") + N1 + ": כבר שמונה וחצי"];
    for (const [form, stamp] of [
      ["WhatsApp Web, the time first", (t) => `[${t}, 12.3.2026] `],
      ["WhatsApp Web, the time first and slashes", (t) => `[${t}, 12/3/2026] `],
      ["WhatsApp Web in English, the time first", (t) => `[${t.replace("21", "9")} PM, 3/12/2026] `],
      ["the time first with seconds", (t) => `[${t}:03, 12.3.2026] `],
    ]) await expect(chat(stamp), [[N1, "auto"], [N2, "asked"]], form);
  }
  const RLM = "‏", LRM = "‎";
  for (const [items, want, label] of [
    // a direction mark opens the line the label reads
    [["התובעת:", RLM + N1, "נ ג ד", "הנתבע:", RLM + N2], [[N1, "auto"], [N2, "auto"]], "a role alone, a direction mark before the name"],
    [["לכבוד", RLM + N1, "רחוב הנרקיס 9"], [[N1, "asked"]], "«לכבוד» alone, a direction mark before the name"],
    [["בכבוד רב,", LRM + N1], [[N1, "asked"]], "a signature, a direction mark before the name"],
    [[{ table: [[["התובעת:"], [RLM + N1]], [["הנתבע:"], [RLM + N2]]] }], [[N1, "auto"], [N2, "auto"]], "a caption table, a direction mark in each name cell"],
    [["רשימת עדים:", RLM + "1. " + N1, RLM + "2. " + N2], [[N1, "asked"], [N2, "asked"]], "a witness list, a direction mark before each number"],
    [["התובעת: " + RLM + N1, "הנתבע: " + N2], [[N1, "auto"], [N2, "auto"]], "a direction mark inside the same line"],
    // signatures
    [["בברכה,", N1], [[N1, "asked"]], "«בברכה,» over the name"],
    [["ולראייה באתי על החתום:", N1], [[N1, "asked"]], "«ולראייה» with a double yod"],
    [["בכבוד רב ובברכה,", N1], [[N1, "asked"]], "«בכבוד רב ובברכה,» over the name"],
    [["ולראיה באנו על החתום:", N1], [[N1, "asked"]], "«ולראיה באנו על החתום»"],
    [["בברכה, " + N1], [[N1, "asked"]], "«בברכה,» and the name in one line"],
    // name fields, as one class
    [["שם בעל החשבון: " + N1], [[N1, "asked"]], "«שם בעל החשבון:»"],
    [["שם המוטב: " + N1], [[N1, "asked"]], "«שם המוטב:»"],
    [["שם העובד/ת: " + N1], [[N1, "asked"]], "«שם העובד/ת:»"],
    [["שם התלמיד/ה: ליה טרכטנגוט"], [["ליה טרכטנגוט", "asked"]], "«שם התלמיד/ה:»"],
    [["שם ההורה: " + N1], [[N1, "asked"]], "«שם ההורה:»"],
    [["שם הנפטר/ת: " + N2], [[N2, "asked"]], "«שם הנפטר/ת:»"],
    [[{ table: [[["שם בעל החשבון"], [N1]]] }], [[N1, "asked"]], "«שם בעל החשבון» in a cell"],
    [[{ table: [[["שם המבקשת"], ["\"" + N1 + "\""]]] }], [[N1, "asked"]], "a field value in quotes, in a table"],
    [["שם המבקשת: \"" + N1 + "\""], [[N1, "asked"]], "a field value in quotes"],
    // an addressee line that goes on past the name
    [["לכבוד", N1 + " ו" + N2, "רחוב הנרקיס 9"], [[N1, "asked"], [N2, "asked"]], "two addressees joined by ו"],
    [["לכבוד", N1 + " (ת.ז. 034567891)"], [[N1, "asked"]], "an addressee and an ID in brackets"],
    [["לכבוד", N1 + " - באמצעות דואר רשום"], [[N1, "asked"]], "an addressee, then how it is sent"],
    [["לכבוד " + N1 + " ו/או " + N2], [[N1, "asked"], [N2, "asked"]], "«לכבוד X ו/או Y»"],
    [["לכבוד", N1 + " מרחוב הנרקיס 9, חיפה"], [[N1, "asked"]], "an addressee and an address in one line"],
    // printed mail with English labels, and the plural copy label
    [["From: " + N1 + " <noga.t@example.com>", "Sent: Monday, March 12, 2026 9:15 PM", "To: " + N2, "Subject: הסדרי ראייה"], [[N1, "asked"], [N2, "asked"]], "English mail labels"],
    [["העתקים: " + N1 + "; " + N2], [[N1, "asked"], [N2, "asked"]], "«העתקים:»"],
    [["Cc: " + N1], [[N1, "asked"]], "«Cc:»"],
    // two initials before the surname
    [["התובעת: נ.ש. טרכטנגוט"], [["טרכטנגוט", "asked"]], "two initials in a party slot"],
    [["עו\"ד ש.ב. ולדמן הגישה את הבקשה."], [["ולדמן", "asked"]], "two initials after a title"],
  ]) await expect(items, want, label);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
