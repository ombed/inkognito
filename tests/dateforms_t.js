/* Dates in the forms v73 still missed, and numbers that only look like dates (the hunt of 11.10).

   v73 found a date in every usual spelling it knew. These still reached the AI real, though the help page
   says every date moves: «ביום 12 לחודש מרץ 2026», «12 בחודש מרץ, שנת 2026», «מארס», a month cut short with
   a geresh or a dot («בספט׳ 2025»), spaces after the dots («12. 3. 2026»), and a month and year with no day
   («במרץ 2026», «בחודש מרץ 2026», «03/2026» after a date word).
   The other side of the same rule: a three-level clause number («סעיף 5.2.10») went out as «5.9.10», a decimal
   before a time unit («ה-3.5 ימים») as a date, and once «ביום 12.3» was shifted, every other «12.3» of the
   document went with it, «סעיף 12.3» included.
   And two dates exactly one offset apart made the shifted one a real date of the document: the final check
   called it a date left behind and stopped the copy. A month and year moves by whole months, which would have
   made that the rule for a list of months; the offset now moves on until no shifted value is a real one.
   All text is invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(a === b, m + " — got «" + a + "», want «" + b + "»");
const OPT = { on: new Set(["DATE"]), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
// the tool's own defaults, so no other pattern takes the date's place
const ALL = { on: new Set(C.PAT.filter((p) => p.on).map((p) => p.n)), flag: new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)), mode: "real", near: false, body: false, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const dates = (text, opt) => new C.Engine([], [], opt || OPT, text).detect(text).filter((h) => h.type === "DATE");
const found = (text, opt) => dates(text, opt).map((h) => h.text).join(" | ");

console.log("\n— found, in every remaining usual form —");
for (const [text, want] of [
  // the month's word after «לחודש» or «בחודש», the year after «שנת»
  ["ביום 12 לחודש מרץ 2026 התקיים הדיון.", "12 לחודש מרץ 2026"],
  ["ביום 12 בחודש מרץ, שנת 2026 התקיים הדיון.", "12 בחודש מרץ, שנת 2026"],
  ["ביום 12 בחודש מרץ 2026 התקיים הדיון.", "12 בחודש מרץ 2026"],
  ["ביום 3 לחודש אוגוסט, 2025 נחתם ההסכם.", "3 לחודש אוגוסט, 2025"],
  ["עד ה-12 לחודש מרץ יוגש התצהיר.", "12 לחודש מרץ"],
  // March in its third spelling
  ["ביום 12 במארס 2026 התקיים הדיון.", "12 במארס 2026"],
  ["ביום 12 מארס 2026 התקיים הדיון.", "12 מארס 2026"],
  // a month cut short, with a Hebrew geresh, an apostrophe or a dot
  ["ב-12 בספט׳ 2025 עזב את הבית.", "12 בספט׳ 2025"],
  ["ב-12 ספט' 2025 עזב את הבית.", "12 ספט' 2025"],
  ["ב-12 בספט. 2025 עזב את הבית.", "12 בספט. 2025"],
  ["ב-3 בדצמ׳ 2025 נפגשו.", "3 בדצמ׳ 2025"],
  ["ב-1 בינו׳ 2026 נפגשו.", "1 בינו׳ 2026"],
  // spaces after the dots
  ["ביום 12. 3. 2026 התקיים הדיון.", "12. 3. 2026"],
  ["ביום 12.3. 2026 התקיים הדיון.", "12.3. 2026"],
  ["ביום 12/ 3/ 2026 התקיים הדיון.", "12/ 3/ 2026"],
  // a month and year with no day, in words: the month's name and a year are evidence enough
  ["במרץ 2026 עזב את הבית.", "מרץ 2026"],
  ["בחודש מרץ 2026 עזב את הבית.", "מרץ 2026"],
  ["בחודש מרץ, שנת 2026 עזב את הבית.", "מרץ, שנת 2026"],
  ["במארס 2026 עזב את הבית.", "מארס 2026"],
  ["הדיון נדחה לספט׳ 2025.", "ספט׳ 2025"],
  ["ספט' 2025: הדיון נדחה.", "ספט' 2025"],
  ["מאז אוגוסט 2024 לא שילם, וגם לא ממרץ 2025.", "אוגוסט 2024 | מרץ 2025"],
  // a month and year in numbers, after a month or date word, and the rest of a list that starts with one
  ["החל מחודש 03/2026 ישלם האב 2,500 ש״ח.", "03/2026"],
  ["תלוש השכר לחודש 03/2026 צורף.", "03/2026"],
  ["בתאריך 03/2026 עזב את הבית.", "03/2026"],
  ["תלושי השכר לחודשים 01/2026, 02/2026 ו-03/2026 צורפו.", "01/2026 | 02/2026 | 03/2026"],
  ["בחודשים 1.2026 עד 3.2026 לא שולמו מזונות.", "1.2026 | 3.2026"],
  ["תלושי השכר לחודשים 01/2026-03/2026 צורפו.", "01/2026 | 03/2026"],
]) {
  eq(found(text), want, "«" + text + "»");
  const d = dates(text, ALL);
  ok(d.map((h) => h.text).join(" | ") === want && d.every((h) => h.apply), "with the tool's defaults too, and shifted unasked: «" + text + "»");
}

console.log("\n— left alone: numbers that only look like dates —");
for (const text of [
  // three-level clause, regulation and appendix numbers, alone or in a list after the word
  "בהתאם לסעיף 5.2.10 להסכם הגירושין, האב ישלם מחצית מהוצאות החינוך.",
  "כאמור בסעיפים 7.1.12 ו-7.1.13 להסכם הממון.",
  "לפי תקנה 12.4.21 לתקנות.",
  "לפי ס' 4.1.10 להסכם.",
  "לפי ס׳ 4.1.10 להסכם.",
  "לפי סעיף 3.2.15 להסכם.",
  "בסעיפים 5.2.10-5.2.12 להסכם.",
  "בסעיפים 5.2.10, 5.2.11 ו-5.2.12 להסכם.",
  "בסעיפים 5.2.10 עד 5.2.12 להסכם.",
  "בתקנות 12.4.21 ו- 12.4.22 נקבע.",
  "בסעיף קטן 3.1.15 להסכם.",
  "נספח 3.1.15 צורף לבקשה.",
  "פרק 2.4.11 לתקנות.",
  "לפי סעיף 1.2.10.3 להסכם.",
  "בטבלה מופיע המספר 1.2.10.3 בלבד.",
  "גרסה 1.2.10 של התוכנה.",
  // a decimal before a time unit, and other units the list did not know
  "במשך ה-3.5 ימים שחלפו לא שילם.",
  "במשך ה-2.5 שבועות האחרונים.",
  "במשך 2.5 שבועות.",
  "תוך ה-1.5 שעות הראשונות.",
  "מה-1.5 שעות שנקבעו נותרה שעה.",
  "ה-1.5 חודשי שכר ישולמו בנפרד.",
  "ה-2.5 לילות בשבוע אצל האב.",
  "ה-2.5 מ״ג ביום, לפי המרשם.",
  "ה-2.5 דקות הראשונות של הדיון.",
  // a month's name with no year and no day, or a word that only starts like one
  "פעל במרץ רב.",
  "נפגש איתה בספט׳.",
  "3 מרצים הגיעו.",
  // a number and year that is not a month: no month or date word before it
  "לפי נוהל 3/2026 של משרד הרווחה.",
  "חוזר מנכ״ל 03/2026 עודכן.",
  // the fraction of a decimal before a month is not a day (public news sentences, iahlt)
  "המדד עמד על 4.8 בחודש ינואר ועל 3.9 בפברואר.",
  // a day that does not exist is not a date, and the month and year after it are not taken alone
  "ב-32 במרץ 2026.",
  "ב-32 בחודש מרץ 2026.",
]) eq(found(text), "", "«" + text + "»");

console.log("\n— still dates, next to those rules —");
for (const [text, want] of [
  ["ביום 5.2.10 נפגשו.", "5.2.10"],
  ["עד ה-1.3 רשאים הצדדים להגיש סיכומים.", "1.3"],
  ["עד ה-12.3, שבוע לפני הדיון, יוגש התצהיר.", "12.3"],
  ["תאריך: 12.3 שעה 10:00", "12.3"],
  ["יש להגיש עד ה-12.3 שעה 12:00.", "12.3"],
  ["ביום 12.3 שבועיים לפני הדיון הוגש התצהיר.", "12.3"],
  ["עד ה-12.3 יום ג׳ יוגש התצהיר.", "12.3"],
  ["בהתאם לסעיף 5 להסכם, ביום 1.2.10 נפגשו.", "1.2.10"],
  ["בין התאריכים 1.2.2026-3.2.2026 שהה בחו״ל.", "1.2.2026 | 3.2.2026"],
  ["ביום 1.2.2026/3.2.2026 שהה בחו״ל.", "1.2.2026 | 3.2.2026"],
  ["שילם 500 במרץ 2026.", "מרץ 2026"],
]) eq(found(text), want, "«" + text + "»");

console.log("\n— shifted, each in its own form —");
for (const [real, off, want] of [
  ["12 לחודש מרץ 2026", 45, "26 לחודש אפריל 2026"], ["12 בחודש מרץ, שנת 2026", 45, "26 בחודש אפריל, שנת 2026"],
  ["12 במארס 2026", 1, "13 במארס 2026"], ["12 במארס 2026", 45, "26 באפריל 2026"],
  ["12 בספט׳ 2025", 45, "27 באוק׳ 2025"], ["12 ספט' 2025", 45, "27 אוק' 2025"], ["12 בספט. 2025", 45, "27 באוק. 2025"],
  ["20 בפבר׳ 2026", 30, "22 במרץ 2026"], ["12 בספט׳", 45, "27 באוק׳"],
  ["12. 3. 2026", 45, "26. 4. 2026"], ["12.3. 2026", 45, "26.4. 2026"], ["12/ 3/ 2026", 45, "26/ 4/ 2026"],
  // a month and year moves by whole months, as near the document's days as a month can be: 45 days is one month
  ["מרץ 2026", 45, "אפריל 2026"], ["מרץ, שנת 2026", 45, "אפריל, שנת 2026"], ["דצמבר 2025", 45, "ינואר 2026"],
  ["ספט׳ 2025", 45, "אוק׳ 2025"], ["פבר׳ 2026", 30, "מרץ 2026"], ["מארס 2026", 400, "אפריל 2027"],
  ["03/2026", 45, "04/2026"], ["3/2026", 400, "4/2027"], ["12/2026", 30, "1/2027"], ["3.2026", 75, "5.2026"],
]) eq(C.fakeDate(real, off), want, real + " + " + off + " days");
for (const bad of ["31 בספט׳ 2025", "13/2026", "31 לחודש אפריל 2026"]) eq(C.fakeDate(bad, 10), null, "an impossible date is not shifted: " + bad);

console.log("\n— one document, one offset, every form —");
{
  const text = "ביום 12 לחודש מרץ 2026 נפגשו. במרץ 2026 עזב. ב-1 בספט׳ 2025 נישאו. ביום 12. 3. 2026 שוב. החל מחודש 03/2026 ישלם.";
  const eng = new C.Engine([], [], OPT, text);
  const hits = eng.detect(text).filter((h) => h.type === "DATE");
  eq(hits.map((h) => h.text).join(" | "), "12 לחודש מרץ 2026 | מרץ 2026 | 1 בספט׳ 2025 | 12. 3. 2026 | 03/2026", "all five found");
  for (const h of hits) eq(eng.repFor(h), C.fakeDate(h.text, eng.dateOff), "the document's offset, in the form of «" + h.text + "»");
}

console.log("\n— no shifted date is a real date of the same document —");
{
  // the offset a document gets from its text alone (before this change, its only offset)
  const base = (t) => 30 + C.hash32(C.norm(t)) % 371;
  // two dates exactly that offset apart: the first one, shifted, would be the second one
  let text = null, second = null;
  for (let k = 0; k < 800 && !text; k++) {
    const d = new Date(Date.UTC(2026, 1, 1 + 30 + k)), s = d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCFullYear();
    const t = "ביום 1.2.2026 התקיים דיון.\nהתגובה תוגש עד ליום " + s + ".";
    if (C.fakeDate("1.2.2026", base(t)) === s) { text = t; second = s; }
  }
  ok(!!text, "a document with two dates one offset apart was built");
  if (text) {
    const eng = new C.Engine([], [], OPT, text);
    const reps = eng.detect(text).filter((h) => h.type === "DATE").map((h) => eng.repFor(h));
    ok(eng.dateOff !== base(text), "the offset moved on from the one that collides: " + eng.dateOff);
    ok(reps.length === 2 && !reps.includes(second) && !reps.includes("1.2.2026"), "no shifted date is one of the real ones: " + reps.join(", ") + " (real: 1.2.2026, " + second + ")");
    eq(new C.Engine([], [], OPT, "ביום 1.2.2026 התקיים דיון.").dateOff, base("ביום 1.2.2026 התקיים דיון."), "a document with nothing to collide keeps the offset it had");
  }
  // a list of months: a whole-month shift would land each month on the next real one
  const months = "תלוש לחודש ינואר 2026 צורף. תלוש לחודש פברואר 2026 צורף. תלוש לחודש מרץ 2026 צורף. תלוש לחודש אפריל 2026 צורף. תלוש לחודש מאי 2026 צורף.";
  const me = new C.Engine([], [], OPT, months);
  const mh = me.detect(months).filter((h) => h.type === "DATE");
  const out = mh.map((h) => me.repFor(h));
  eq(mh.length, 5, "five months found");
  ok(out.length === 5 && !out.some((o) => mh.some((h) => h.text === o)), "no shifted month is a real month of the list: " + out.join(", "));
  const idx = (s) => { const p = C.parseDate(s); return p ? p.y * 12 + p.m : NaN; };
  ok(out.length === 5 && out.every((o, i) => i === 0 || idx(o) - idx(out[i - 1]) === 1), "and the months stay one apart: " + out.join(", "));
  // a shifted date in words would hold the real month and year («1 במרץ 2026» holds «מרץ 2026»): a document whose
  // own offset takes 26 January into March
  let t2 = null;
  for (let k = 0; k < 2000 && !t2; k++) {
    const t = "במרץ 2026 עזב את הבית. ביום 26 בינואר 2026 נפגשו (פגישה " + k + ").";
    if (/מרץ 2026/.test(C.fakeDate("26 בינואר 2026", base(t)))) t2 = t;
  }
  ok(!!t2, "a document whose offset moves 26 January into March was built");
  if (t2) {
    const e2 = new C.Engine([], [], OPT, t2);
    const h2 = e2.detect(t2).filter((h) => h.type === "DATE");
    eq(h2.map((h) => h.text).join(" | "), "מרץ 2026 | 26 בינואר 2026", "both found");
    const r2 = h2.map((h) => e2.repFor(h));
    ok(r2.length === 2 && !r2.some((r) => /מרץ 2026/.test(r)), "no shifted value holds the real «מרץ 2026»: " + r2.join(", "));
  }
}

console.log("\n— restored from the AI's answer, in its own spellings —");
{
  const P = [["12 לחודש מרץ 2026", "26 לחודש אפריל 2026"]];
  for (const said of ["26 לחודש אפריל 2026", "26 באפריל 2026", "26.4.2026", "26. 4. 2026", "26 באפר׳ 2026", "26 בחודש אפריל, שנת 2026", "April 26, 2026", "26 April 2026", "Apr 26, 2026"])
    eq(C.restoreNames("הדיון נקבע ל-" + said + ".", P).text, "הדיון נקבע ל-12 לחודש מרץ 2026.", "a date written by the AI as «" + said + "»");
  const S = [["12 בספט׳ 2025", "27 באוק׳ 2025"]];
  for (const said of ["27 באוק׳ 2025", "27 באוקטובר 2025", "27.10.2025", "27 אוק' 2025"])
    eq(C.restoreNames("ב-" + said + " עזב.", S).text, "ב-12 בספט׳ 2025 עזב.", "a month cut short, written as «" + said + "»");
  const M = [["מרץ 2026", "אפריל 2026"]];
  for (const [said, want] of [["באפריל 2026 עזב.", "במרץ 2026 עזב."], ["בחודש אפריל 2026 עזב.", "בחודש מרץ 2026 עזב."], ["באפר׳ 2026 עזב.", "במרץ 2026 עזב."],
    ["החל מ-04/2026 ישלם.", "החל מ-מרץ 2026 ישלם."], ["Since April 2026.", "Since מרץ 2026."], ["באפריל, 2026 עזב.", "במרץ 2026 עזב."]])
    eq(C.restoreNames(said, M).text, want, "a month and year, written as «" + said + "»");
  // a month and year the AI wrote inside a full date is that date's month, not the document's month and year
  for (const t of ["ב-27 באפריל 2026 נפגשו.", "ב-27 בחודש אפריל 2026 נפגשו.", "ב-27/04/2026 נפגשו.", "On 27 April 2026."])
    eq(C.restoreNames(t, M).text, t, "not taken out of a full date: «" + t + "»");
  const N = [["03/2026", "04/2026"]];
  eq(C.restoreNames("החל מחודש 04/2026 ועד 4/2026.", N).text, "החל מחודש 03/2026 ועד 03/2026.", "a month and year in numbers, with or without the zero");
  // one real day in two spellings shares one invented day: that is one value, not two people's pseudonym
  const two = C.restoreNames("ב-26 באפריל 2026 נפגשו.", [["12 במרץ 2026", "26 באפריל 2026"], ["12 במרס 2026", "26 באפריל 2026"]]);
  eq(two.text, "ב-12 במרץ 2026 נפגשו.", "one day in two spellings comes back");
  eq(two.conflict.length + two.left.length, 0, "and is neither a conflict nor listed as left");
}

console.log("\n— what cannot come back for sure is not guessed, and is listed —");
{
  const Y = [["12.3", "27.4"]];
  const r = C.restoreNames("ביום 27.4.2026 נפגשו.", Y);
  eq(r.text, "ביום 27.4.2026 נפגשו.", "a day and month that went out without a year, given one by the AI, is not restored into a full date");
  eq(JSON.stringify(r.left.map((x) => [x.fake, x.real, r.text.slice(x.at[0][0], x.at[0][1])])), JSON.stringify([["27.4", "12.3", "27.4.2026"]]), "and is listed with its real day and month");
  eq(C.restoreNames("ביום 27.4 נפגשו.", Y).text, "ביום 12.3 נפגשו.", "as it went out, it comes back");
  const F = [["22.12.2026", "4.7.2027"], ["23.12.2026", "5.7.2027"]];
  for (const [t, at] of [["נקבע ל-4 ביולי.", "4 ביולי"], ["נקבע ל-4.7.", "4.7"], ["נקבע ליום 4 לחודש יולי.", "4 לחודש יולי"]]) {
    const x = C.restoreNames(t, F);
    eq(x.text, t, "the year dropped: not restored, «" + t + "»");
    eq(JSON.stringify(x.left.map((l) => [l.fake, l.real, x.text.slice(l.at[0][0], l.at[0][1])])), JSON.stringify([["4.7.2027", "22.12.2026", at]]), "but listed with its real date: «" + t + "»");
  }
  const g = C.restoreNames("הדיונים יתקיימו בימים 4-5.7.2027.", F);
  eq(g.text, "הדיונים יתקיימו בימים 4-5.7.2027.", "the end of a range that starts with a bare day is not half restored («4-23.12.2026»)");
  eq(JSON.stringify(g.left.map((l) => [l.fake, l.real])), JSON.stringify([["5.7.2027", "23.12.2026"]]), "and is listed");
  eq(C.restoreNames("בין 4.7.2027-5.7.2027.", F).text, "בין 22.12.2026-23.12.2026.", "a range of two whole dates comes back whole");
  const done = C.restoreNames("הדיון ב-4.7.2027.", F);
  eq(done.text + " " + done.left.length, "הדיון ב-22.12.2026. 0", "a date that came back is not listed");
}

console.log("\n— the whole document: what goes out, and the final check —");
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
const js = fs.readFileSync(path.join(__dirname, "app.html"), "utf8").split("<script>")[1].split("</script>")[0]
  .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
  .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
const cut = js.indexOf("/* ══════════════════════════ ממשק ══════════════════════════ */");
const a = js.indexOf("function pseudoRX(p){"), b = js.indexOf("function livePairs(){");
fs.writeFileSync(path.join(__dirname, "dateforms-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx};\n");
const E = require("./dateforms-core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, base } = require("./structure-lib.js");
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docOf = (lines) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${WNS}><w:body>${lines.map((l) => P(R(l))).join("")}</w:body></w:document>`;
const run = async (lines) => {
  const res = await E.redactDocx(mkzip([...base, { name: "word/document.xml", body: docOf(lines) }]), [], [], ALL);
  return { res, out: res.preview.map((x) => x.text) };
};

(async () => {
  {
    const { res, out } = await run(["החלטה", "ביום 12.3 נפגשו הצדדים.", "לפי סעיף 12.3 להסכם, האב ישלם."]);
    ok(!out[1].includes("12.3") && out[2] === "לפי סעיף 12.3 להסכם, האב ישלם.", "the date moves, the clause with the same digits stays: " + out.join(" ⏎ "));
    ok(res.verification.passed, "and the final check does not call the clause a date left behind: " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["החלטה", "במשך ה-3.5 ימים שחלפו לא שילם.", "ביום 3.5 נפגשו."]);
    ok(out[1] === "במשך ה-3.5 ימים שחלפו לא שילם." && !out[2].includes("3.5"), "the date moves, the three and a half days stay: " + out.join(" ⏎ "));
    ok(res.verification.passed, "the final check passes: " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["הסכם", "ביום 1.2.10 נחתם ההסכם.", "בהתאם לסעיף 1.2.10 להסכם, האב ישלם."]);
    ok(!out[1].includes("1.2.10") && out[2] === "בהתאם לסעיף 1.2.10 להסכם, האב ישלם.", "a date and a clause written alike: only the date moves: " + out.join(" ⏎ "));
    ok(res.verification.passed, "the final check passes: " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["החלטה", "ביום 12.3 נפגשו הצדדים.", "וב-12.3 בערב שוב נפגשו."]);
    ok(!out.join(" ").includes("12.3") && out[1].replace(/ביום /, "").split(" ")[0] === out[2].replace(/וב-/, "").split(" ")[0], "the same day elsewhere still moves with it: " + out.join(" ⏎ "));
    ok(res.verification.passed, "the final check passes: " + JSON.stringify(res.verification.leaks));
  }
  {
    const lines = ["תלושי שכר", "תלוש לחודש ינואר 2026 צורף.", "תלוש לחודש פברואר 2026 צורף.", "תלוש לחודש מרץ 2026 צורף.", "תלוש לחודש אפריל 2026 צורף."];
    const { res, out } = await run(lines);
    ok(out.slice(1).every((l, i) => l !== lines[i + 1]), "every month of the list moves: " + out.join(" ⏎ "));
    ok(res.verification.passed, "and the final check passes: " + JSON.stringify(res.verification.leaks));
  }
  {
    const lines = ["תלושי שכר", "תלושי השכר לחודשים 01/2026, 02/2026 ו-03/2026 צורפו."];
    const { res, out } = await run(lines);
    ok(!/0[123]\/2026/.test(out[1]), "a list of months in numbers moves: " + out[1]);
    ok(res.verification.passed, "and the final check passes: " + JSON.stringify(res.verification.leaks));
  }
  {
    // two dates one offset apart (the offset a document of these lines got from its text before this change)
    let lines = null, second = null;
    for (let k = 0; k < 800 && !lines; k++) {
      const d = new Date(Date.UTC(2026, 1, 1 + 30 + k)), s = d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCFullYear();
      const l = ["החלטה", "ביום 1.2.2026 התקיים דיון.", "התגובה תוגש עד ליום " + s + "."];
      if (C.fakeDate("1.2.2026", 30 + C.hash32(C.norm(l.join("\n"))) % 371) === s) { lines = l; second = s; }
    }
    ok(!!lines, "a document with two dates one offset apart was built");
    if (lines) {
      const { res, out } = await run(lines);
      ok(!out[1].includes(second) && !out[2].includes(second), "the earlier date does not go out as the later one: " + out.join(" ⏎ "));
      ok(res.verification.passed, "and the final check passes (it stopped the copy here): " + JSON.stringify(res.verification.leaks));
    }
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
})();
