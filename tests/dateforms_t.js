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
   The review of 11.10 found what that first round broke: a real date after a clause word, a number and a
   connector («כאמור בסעיף 4 עד 31.12.2026») and a day and month before a time word or a ש- clause («עד ה-12.3
   שבוע לפני», «מ-12.3 שניתנה») went out real under a green bar; an amount after a month's name («ביוני 2000
   ש״ח») moved as a year; a clause number in its own Word run stopped the copy as a date left behind; a footnote
   mark after a date hid it; long rows of numbers and the offset search took seconds to minutes, and the offset
   grew to years. The offset now stays in 30–400 days, and the final check counts a shifted date that is also a
   real one as written, not as left.
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
// a right-to-left mark, as text copied from a web page carries it
const RLM = String.fromCharCode(0x200f);

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
  // a direction mark between the day and the month: the whole date, not the month alone beside the real day
  ["ביום 12 " + RLM + "במרץ 2026 התקיים הדיון.", "12 " + RLM + "במרץ 2026"],
  ["ביום 12" + RLM + " במרץ " + RLM + "2026 התקיים הדיון.", "12" + RLM + " במרץ " + RLM + "2026"],
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
eq(C.fakeDate("12 " + RLM + "במרץ 2026", 45), "26 באפריל 2026", "a direction mark inside is dropped, the date is shifted");
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
  const base = (t) => C.dateOffBase(C.norm(t));
  // two dates exactly that offset apart: the first one, shifted, would be the second one
  let text = null, second = null;
  // the offset is whole weeks (12.10): each week, with a few wordings of the second line, until one collides
  for (let v = 0; v < 40 && !text; v++) for (let w = 5; w < 58 && !text; w++) {
    const d = new Date(Date.UTC(2026, 1, 1 + 7 * w)), s = d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCFullYear();
    const t = "ביום 1.2.2026 התקיים דיון.\nהתגובה תוגש עד ליום " + s + (v ? ", בקשה " + v : "") + ".";
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

console.log("\n— still dates, with a clause number, a unit or a time word near (review 11.10) —");
for (const [text, want] of [
  // a clause, regulation, exhibit or version word, a number and a connector: what follows is a date. A four-digit year
  // never is a clause number; a two-digit year is one only right after the word, or after a number of the same shape
  ["נספח 3 – 12.3.2026 – מכתב ההתראה.", "12.3.2026"],
  ["גרסה 2 - 1.3.2026: עדכון ההסכם.", "1.3.2026"],
  ["כאמור בסעיף 4 עד 31.12.2026 ישלם האב.", "31.12.2026"],
  ["בהתאם לתקנה 5, 12.3.2026 הוגשה הבקשה.", "12.3.2026"],
  ["כאמור בסעיפים 4 ו-5 ו-12.3.2026 נחתם.", "12.3.2026"],
  ["נספח 3 – 12.3.26 – מכתב ההתראה.", "12.3.26"],
  ["כאמור בסעיף 4 עד 31.12.26 ישלם האב.", "31.12.26"],
  ["בהתאם לתקנה 5, 12.3.26 הוגשה הבקשה.", "12.3.26"],
  ["כאמור בסעיף 4.1 עד 31.12.26 ישלם האב.", "31.12.26"],
  // the usual abbreviations guard their own clause number, not a date after another number
  ["כאמור בסע' 4.1.12 ובסע' 4 עד 31.12.26 ישלם האב.", "31.12.26"],
  ["לפי תק' 12.4.21 ולפי תק' 5, 12.3.2026 הוגשה.", "12.3.2026"],
  // a time word after a day and month: a count of time only in its count form, and only after a half
  ["יש להגיש את התצהיר עד ה-12.3 שבוע לפני הדיון.", "12.3"],
  ["עד ה-12.3 שבועיים לפני הדיון יוגש התצהיר.", "12.3"],
  ["הבקשה תוגש עד ה-1.3 חודש לפני המועד.", "1.3"],
  ["מה-1.9 שעות הביקור יורחבו.", "1.9"],
  ["עד ה-12.3 ימים ספורים לפני הדיון.", "12.3"],
  ["עד ה-12.5 שבועיים לפני הדיון יוגש התצהיר.", "12.5"],
  ["עד ה-12.5 שבוע לפני הדיון יוגש התצהיר.", "12.5"],
  ["במשך ה-3.5 ימים לא שילם, ועד ה-12.3 ימים ספורים לפני הדיון הגיש.", "12.3"],
  ["במשך ה-1.5 שנה האחרונות לא שילם, ועד ה-1.3 שנה לפני הדיון לא הגיש.", "1.3"],
  // a word that only starts like a unit
  ["עד ה-12.3 שנקבע כמועד אחרון לא הוגש דבר.", "12.3"],
  ["מה-3.5 שנות הנישואין גרו בחו\"ל, ועד ה-12.3 שנקבע לא חזרו.", "12.3"],
  ["ה-2.5 שקלים לשעה נוספו, ועד ה-12.3 שקלה הוועדה את הבקשה.", "12.3"],
  ["מה-1.3 מטרתו של ההסדר השתנתה.", "1.3"],
  // an amount after the month is no year, and the day and month stay a date; a tab is a table's next column
  ["ביום 12 ביוני 2000 ש\"ח הועברו לחשבון.", "12 ביוני"],
  ["שולם ב-1 בינואר\t1950\nוב-1 בפברואר\t2000", "1 בינואר | 1 בפברואר"],
  // a footnote mark after the sentence's dot, as text pasted from Word carries it
  ["ביום 12.3.2026.3 התקיים הדיון.", "12.3.2026"],
  ["ביום 12. 3. 2026.3 התקיים הדיון.", "12. 3. 2026"],
  // a direction mark between the month's name and the year: v73.6 reads the text without it, so the rule needs no
  // allowance of its own (these two failed before the merge of v73.6)
  ["במרץ" + RLM + " 2026 עזב את הבית.", "מרץ" + RLM + " 2026"],
  ["בחודש מרץ " + RLM + "2026 עזב את הבית.", "מרץ " + RLM + "2026"],
  // second review: after a year only a currency makes the number an amount. A unit word that is also a verb or a
  // count kept the year out, and the real year stayed beside a day that moved
  ["ביום 20 בדצמבר 2025 חדר הנאשם לדירה.", "20 בדצמבר 2025"],
  ["ביום 12 במרץ 2026 חדר הנאשם לדירה.", "12 במרץ 2026"],
  ["ביום 3 בינואר 2026 שקל בית המשפט את הבקשה.", "3 בינואר 2026"],
  ["במרץ 2026 חדר הנאשם לדירה ונטל ממנה תכשיטים.", "מרץ 2026"],
  ["בחודש ינואר 2026 גרם הנאשם נזק לרכבו של המתלונן.", "ינואר 2026"],
  ["ביולי 2025 פעמים רבות לא הגיע האב לביקורים.", "יולי 2025"],
  ["במרץ 2026 אלפי שקלים הועברו לאם.", "מרץ 2026"],
  ["במרץ 2026 אלף ש\"ח הועברו לאם.", "מרץ 2026"],
  ["במאי 2025 חדרים נוספים נשכרו.", "מאי 2025"],
  // a room is counted in the plural after a decimal: «חדר» alone is the verb
  ["עד ה-12.3 חדר הנאשם לדירה פעמיים.", "12.3"],
  // after a singular clause word «עד» ends the list, unless the number after it opens the same clause
  ["כאמור בסעיף 4.1.2 עד 31.12.26 ישלם האב.", "31.12.26"],
  ["כאמור בסעיף 4.1.2 ועד 31.12.26 ישלם האב.", "31.12.26"],
  // a plural list goes on at any depth, but a four-digit year is a date
  ["כאמור בסעיפים 4 ו-12.3.2026 נחתם.", "12.3.2026"],
]) eq(found(text), want, "«" + text + "»");

console.log("\n— left alone: an amount after a month's name, the clause abbreviations, units in their other forms (review 11.10) —");
for (const text of [
  // child support and other sums: «ביוני 2000 ש״ח» moved to «אפריל 2001», the amount with it
  "דמי המזונות לחודש יוני 2000 ש\"ח שולמו באיחור.",
  "בנובמבר 2000 ש\"ח ובדצמבר 2050 ש\"ח הועברו לחשבון האם.",
  "האם הוציאה באוגוסט 2030 ₪ על ציוד לבית הספר.",
  "האב שילם בינואר 1950 ש\"ח בלבד, ובפברואר לא שילם כלל.",
  "חודש\tסכום\nינואר\t1950\nפברואר\t2000\nמרץ\t2050",
  "האב ישלם עבור יוני 2000 ש\"ח ועבור נועה 1500 ש\"ח.",
  "שכר הדירה לספטמבר 1980 שקלים.",
  "בינואר 2000 שח הועברו לאם.",
  "ביולי 2000 דולר הועברו לחשבון.",
  "במרץ 1990 ש''ח שולמו.",
  // «סע׳» and «תק׳», in both spellings of the geresh, alone and in a list
  "כאמור בסע' 4.1.12 להסכם.",
  "לפי סע׳ 4.1.12 להסכם.",
  "בהתאם לתק' 12.4.21 לתקנות.",
  "בהתאם לתק׳ 12.4.21 לתקנות.",
  "בסע' 4.1.12 ו-4.1.13 להסכם.",
  // units in forms a prefix of the singular did not reach
  "ה-2.5 מיליוני שקלים יחולקו בין הצדדים.",
  "ה-2.5 דונמים שבמחלוקת.",
  // second review: after a plural clause word a list joined by ו or a comma goes on whatever the depth
  "כאמור בסעיפים 4 ו-5.2.10 להסכם הגירושין.",
  "בהתאם לתקנות 3 ו-12.4.21 לתקנות סדר הדין.",
  "כאמור בסעיפים 4.1 ו-5.2.10 להסכם.",
  "בסעיפים 4, 5.2.10 ו-6 להסכם.",
  "בנספחים 2 או 3.1.15 שצורפו.",
  // a range of clauses after a singular word: the number after «עד» opens the same clause
  "בסעיף 4.1.2 עד 4.1.15 להסכם.",
  "בהתאם לסעיף 4.1 עד 4.10.12 להסכם.",
]) {
  eq(found(text), "", "«" + text + "»");
  ok(dates(text, ALL).length === 0, "with the tool's defaults too: «" + text + "»");
}

console.log("\n— the offset stays in the range the owner chose, 30 to 400 days, and is found fast (review 11.10) —");
const MON = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const dayOf = (y, k) => new Date(Date.UTC(y, 0, 1 + k));
const dnum = (y, k) => { const d = dayOf(y, k); return d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCFullYear(); };
const dwords = (y, k) => { const d = dayOf(y, k); return d.getUTCDate() + " ב" + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); };
const pad2 = (n) => String(n).padStart(2, "0");
{
  for (const [name, text] of [
    ["sixty dates over two years and 24 months of salary slips", Array.from({ length: 60 }, (_, i) => (i + 1) + ". ביום " + dnum(2024, Math.floor(i * 730 / 60) + 3) + " אירע אירוע.").join("\n") +
      "\nתלושי השכר שצורפו: " + Array.from({ length: 24 }, (_, i) => MON[i % 12] + " " + (2024 + Math.floor(i / 12))).join(", ") + "."],
    ["a list of 96 months", Array.from({ length: 96 }, (_, i) => "תלוש לחודש " + MON[i % 12] + " " + (2019 + Math.floor(i / 12)) + " צורף.").join("\n")],
    ["a chat export over two years", Array.from({ length: 1500 }, (_, i) => "[" + dnum(2025, Math.floor(i / 2.05)) + ", " + pad2(i % 24) + ":" + pad2(i % 60) + "] האם: הודעה מספר " + i).join("\n")],
  ]) {
    const off = new C.Engine([], [], ALL, text).dateOff;
    ok(off >= 30 && off <= 400, name + ": the offset is " + off + " days");
  }
  const big = Array.from({ length: 1000 }, (_, i) => "ביום " + dwords(2018, i * 3) + " אירע אירוע מספר " + (i + 1) + ".").join("\n") + "\n" +
    Array.from({ length: 60 }, (_, i) => "תלוש לחודש " + MON[i % 12] + " " + (2020 + Math.floor(i / 12)) + " צורף.").join("\n");
  const t0 = Date.now(), off = new C.Engine([], [], ALL, big).dateOff, took = Date.now() - t0;
  ok(took < 2000 && off >= 30 && off <= 400, "a thousand dates and sixty months: the offset (" + off + " days) in " + took + " ms; it took 15 s");
}

/* Whole weeks (the owner's decision of 12.10, the outside review): «ביום חמישי, 12.3.2026» stays a Thursday. A shift
   of single days put the date on another weekday while the text still named the old one, and the AI reasoned on the
   wrong day. Still one offset per document, in the owner's range. */
console.log("\n— the offset is whole weeks: a weekday in the text still matches its date —");
{
  const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const parse = (s) => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null; };
  let n = 0;
  for (let k = 0; k < 40; k++) {
    const d = dayOf(2026, 7 + k * 9), real = dnum(2026, 7 + k * 9);
    const text = "ביום " + DAYS[d.getUTCDay()] + ", " + real + ", התקיים דיון בעניין המשמורת. מסמך " + (k + 1) + ".";
    const eng = new C.Engine([], [], ALL, text);
    const h = eng.detect(text).find((x) => x.type === "DATE");
    const out = h && parse(eng.repFor(h));
    const days = out ? Math.round((out - d) / 864e5) : NaN;
    if (eng.dateOff % 7 === 0 && days === eng.dateOff && out.getUTCDay() === d.getUTCDay() && days >= 30 && days <= 400) n++;
    else console.log("  ✗ " + text + " → " + (h ? eng.repFor(h) : "no date") + " (offset " + eng.dateOff + ")");
  }
  ok(n === 40, "40 documents: each date moves by whole weeks, within 30 to 400 days, onto the same weekday (" + n + " of 40)");
}

console.log("\n— a long row of numbers is read in linear time (review 11.10) —");
for (const [name, text] of [
  ["4,000 amounts in one paragraph", "סכומים: " + Array.from({ length: 4000 }, (_, i) => (i % 9 + 1) + "," + String((i * 37) % 1000).padStart(3, "0")).join(", ")],
  ["20,000 months and years with no date word before them", "הסכומים " + Array.from({ length: 20000 }, (_, i) => pad2(i % 12 + 1) + "/" + (2000 + Math.floor(i / 12) % 99)).join(", ") + "."],
]) {
  const t0 = Date.now(), e = new C.Engine([], [], ALL, text); e.detect(text);
  const took = Date.now() - t0;
  ok(took < 2000, name + ": read in " + took + " ms; it took tens of seconds");
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
const E = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, base } = require("./structure-lib.js");
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
// a line is one run, or a list of runs, as Word splits a paragraph at each editing session
const bodyOf = (lines) => lines.map((l) => P((Array.isArray(l) ? l : [l]).map((r) => R(r)).join(""))).join("");
const xmlOf = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${WNS}><w:body>${body}</w:body></w:document>`;
const docOf = (lines) => xmlOf(bodyOf(lines));
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
    // the offset is whole weeks (12.10): each week, with a few wordings of the last line, until one collides
    for (let v = 0; v < 40 && !lines; v++) for (let w = 5; w < 58 && !lines; w++) {
      const d = new Date(Date.UTC(2026, 1, 1 + 7 * w)), s = d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCFullYear();
      const l = ["החלטה", "ביום 1.2.2026 התקיים דיון.", "התגובה תוגש עד ליום " + s + (v ? ", בקשה " + v : "") + "."];
      if (C.fakeDate("1.2.2026", C.dateOffBase(C.norm(l.join("\n")))) === s) { lines = l; second = s; }
    }
    ok(!!lines, "a document with two dates one offset apart was built");
    if (lines) {
      const { res, out } = await run(lines);
      ok(!out[1].includes(second) && !out[2].includes(second), "the earlier date does not go out as the later one: " + out.join(" ⏎ "));
      ok(res.verification.passed, "and the final check passes (it stopped the copy here): " + JSON.stringify(res.verification.leaks));
    }
  }
  // review 11.10, in the whole pipeline with the tool's defaults: each of these went out real under a green bar
  {
    const { res, out } = await run(["הסכם", "ביום 1.1.2026 נחתם ההסכם.", "האב ישלם לפי סעיף 4 עד 31.12.2026."]);
    ok(!out[2].includes("31.12.2026") && res.verification.passed, "a date after a clause word, a number and «עד» moves: " + out[2]);
  }
  // the day found once, again after a preposition and before a ש- clause or a time word that is no count
  for (const [first, line, day] of [
    ["ביום 12.3 התקיים דיון.", "בהחלטה מ-12.3 שניתנה במעמד הצדדים נקבע כי האב ישלם.", "12.3"],
    ["ביום 12.3 התקיים דיון.", "בדיון ב-12.3 שנערך בפני השופטת הוחלט כך.", "12.3"],
    ["ביום 12.3 התקיים דיון.", "הדיון נדחה ל-12.3 שנקבע מראש.", "12.3"],
    ["ביום 12.3 התקיים דיון.", "עד ה-12.3 שנקבע כמועד אחרון לא הוגש דבר.", "12.3"],
    ["ביום 12.3 התקיים דיון.", "התצהיר הוגש ב-12.3 ימים ספורים לפני הדיון.", "12.3"],
    ["ביום 12.3 התקיים דיון.", "הבקשה הוגשה ב-12.3 חודש לפני המועד.", "12.3"],
    ["ביום 15.10 התקיים דיון.", "בהחלטה מ-15.10 שניתנה במעמד הצדדים נקבע כך.", "15.10"],
  ]) {
    const { res, out } = await run(["החלטה", first, line]);
    ok(!out[2].includes(day) && res.verification.passed, "the same day moves: «" + line + "» → «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  // an amount or a count of time keeps its number; the same day beside it, as a date, moves
  for (const [first, line, keep, day] of [
    ["ביום 12.3 נפגשו.", "הועברו 12.3 מיליון ש\"ח, וב-12.3 שנערך דיון נוסף הוחלט כך.", "הועברו 12.3 מיליון ש\"ח, וב-", "12.3"],
    ["ביום 13.5 נפגשו.", "במשך 13.5 ימים לא שילם, וב-13.5 שנערך דיון נוסף הוחלט כך.", "במשך 13.5 ימים לא שילם, וב-", "13.5"],
  ]) {
    const { res, out } = await run(["החלטה", first, line]);
    ok(out[2].startsWith(keep) && !out[2].slice(keep.length).includes(day) && res.verification.passed, "the amount stays, the date moves: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  // Word splits a paragraph into runs at each editing session and language switch: the final check reads the text
  for (const [lines, keep] of [
    [["החלטה", "ביום 12.3 נפגשו הצדדים.", ["לפי סעיף ", "12.3", " להסכם, האב ישלם."]], "לפי סעיף 12.3 להסכם, האב ישלם."],
    [["החלטה", "ביום 3.5 נפגשו.", ["במשך ה-", "3.5", " ימים שחלפו לא שילם."]], "במשך ה-3.5 ימים שחלפו לא שילם."],
    [["הסכם", "החל מה-1.9 ישלם האב את דמי החוג.", ["כאמור בסעיף ", "1.9", " להלן."]], "כאמור בסעיף 1.9 להלן."],
  ]) {
    const { res, out } = await run(lines);
    ok(out[2] === keep && res.verification.passed, "a clause number or a count in its own run stays and stops nothing: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res } = await run(["החלטה", "ביום 1.3 נפגשו, וביום 12.3 שוב.", ["נקבע ", "1.3", " כמועד."], ["לפי סעיף ", "12.3", " להסכם."]]);
    eq(JSON.stringify(res.verification.leaks.map((l) => l.value)), '["1.3"]', "split into runs: the real day left in the text is caught, the clause is not");
  }
  // a direction mark beside the number: the sweep and the final check read past it, as the reader does
  for (const line of ["הועברו ה-12.3" + RLM + " מיליון ש\"ח לחשבון.", "לפי סעיף" + RLM + " 12.3 להסכם."]) {
    const { res, out } = await run(["החלטה", "ביום 12.3 נפגשו.", line]);
    ok(out[2] === line && res.verification.passed, "an amount or a clause with a direction mark stays: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  // two years of months: within 400 days some months land on other real months of the list. They were written as
  // pseudonyms, so they are no leak
  {
    const lines = ["תלושי שכר", ...Array.from({ length: 24 }, (_, i) => "תלוש לחודש " + MON[i % 12] + " " + (2024 + Math.floor(i / 12)) + " צורף.")];
    const off = new C.Engine([], [], ALL, lines.join("\n")).dateOff;
    const { res, out } = await run(lines);
    ok(off >= 30 && off <= 400 && out.slice(1).every((l, i) => l !== lines[i + 1]) && res.verification.passed,
      "24 months: offset " + off + " days, every month moves, the final check passes: " + JSON.stringify(res.verification.leaks));
  }
  // the final check itself
  {
    const zipOf = (body) => mkzip([...base, { name: "word/document.xml", body: xmlOf(body) }]);
    const twice = zipOf(bodyOf(["ביום 26.4.2026 נפגשו.", "ביום 26.4.2026 שוב נפגשו."]));
    const once = await E.verify(twice, [], ["26.4.2026"], ["26.4.2026"]), both = await E.verify(twice, [], ["26.4.2026"], ["26.4.2026", "26.4.2026"]);
    ok(!once.passed && both.passed, "a real date that is also a written pseudonym counts as written; one more is the real one left (" + once.passed + ", " + both.passed + ")");
    const fn = await E.verify(zipOf(bodyOf(["ביום 12.3.2026.3 התקיים הדיון."])), [], ["12.3.2026"], []);
    ok(!fn.passed, "a real date before a footnote mark is a date left behind");
    const at = await E.verify(zipOf(bodyOf([["לפי סעיף ", "12.3", " להסכם."]]) + '<w:p><w:pPr><w:pStyle w:val="12.3.2026"/></w:pPr></w:p>'), [], ["12.3", "12.3.2026"], []);
    eq(JSON.stringify(at.leaks.map((l) => l.value)), '["12.3.2026"]', "attribute values are read; a clause number split from its word is not a date");
  }
  console.log("\n— second review: one day is one date, a clause list of mixed depth, a unit that is also a verb —");
  {
    // the year beside a verb: both mentions of the same day get the same pseudonym, and none keeps the real day
    const line = "ביום 20 בדצמבר 2025 חדר הנאשם לדירה, וביום 20 בדצמבר 2025, בשעה 22:00, נעצר.";
    const { res, out } = await run(["הכרעת דין", line]);
    const got = out[1].match(/\d{1,2} ב[א-ת]+ \d{4}/g) || [];
    ok(got.length === 2 && got[0] === got[1] && !out[1].includes("20 בדצמבר 2025") && res.verification.passed,
      "the same day twice becomes the same date twice: «" + out[1] + "» " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["הכרעת דין", "ביום 12 בנובמבר 2025 חדר הנאשם לדירה.", "ביום 12 בנובמבר 2025, בשעה 22:00, נעצר הנאשם."]);
    const d = out.slice(1).map((t) => (t.match(/\d{1,2} ב[א-ת]+ \d{4}/) || [""])[0]);
    ok(d[0] && d[0] === d[1] && d[0] !== "12 בנובמבר 2025" && res.verification.passed,
      "the year moves with its day, before a verb too: «" + out.slice(1).join(" ⏎ ") + "»");
  }
  // the sweep: the same number in a plural clause list stays, as in a list of one shape
  for (const line of ["כאמור בסעיפים 4 ו-12.3 להסכם.", "כאמור בסעיפים 4.1.2 ו-12.3 להסכם."]) {
    const { res, out } = await run(["החלטה", "ביום 12.3 נפגשו הצדדים.", line]);
    ok(!out[1].includes("12.3") && out[2] === line && res.verification.passed, "the clause in a list of mixed depth stays: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["הסכם", "ביום 4.5 נחתם ההסכם.", "בסעיף 4.1 עד 4.5 להסכם נקבעו המועדים."]);
    ok(!out[1].includes("4.5") && out[2] === "בסעיף 4.1 עד 4.5 להסכם נקבעו המועדים." && res.verification.passed,
      "a range of clauses after «עד» stays: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["הסכם", "ביום 12.3 נחתם ההסכם.", "כאמור בסעיף 4 עד 12.3 ישלם האב."]);
    ok(!out[2].includes("12.3") && res.verification.passed, "a day after «עד» and another clause moves: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  // «חדר», «גרם» and «שקל» are verbs too: with ב-, מ- or ל- on the number the day moves; a weight keeps its number
  for (const line of ["ב-12.3 חדר הנאשם לדירת המתלוננת.", "ב-12.3 גרם הנאשם נזק לרכב.", "ב-12.3 שקל בית המשפט את הבקשה ודחה אותה.", "וב-12.3 גרם הנאשם נזק נוסף.", "מ-12.3 שקל האב לעזוב את הבית."]) {
    const { res, out } = await run(["הכרעת דין", "ביום 12.3 התקיים מפגש בין הנאשם למתלוננת.", line]);
    ok(!out[2].includes("12.3") && res.verification.passed, "the same day before a verb moves: «" + line + "» → «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  // a month and a year before a currency is a month and an amount, also when the same month and year is a date elsewhere
  for (const line of ["דמי המזונות לחודש יוני 2000 ש\"ח שולמו באיחור.", "האב שילם ביוני 2000 ₪ בלבד."]) {
    const { res, out } = await run(["החלטה", "ביוני 2000 נולד האב.", line]);
    ok(!out[1].includes("יוני 2000") && out[2] === line && res.verification.passed, "the amount keeps its number: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  {
    const { res, out } = await run(["החלטה", "ביום 12 ביוני 2000 נולד האב.", "ביום 12 ביוני 2000 ש\"ח הועברו."]);
    ok(!out[2].includes("12 ביוני") && res.verification.passed, "a day before the month still moves: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  for (const line of ["הנאשם החזיק 12.3 גרם קנבוס.", "נתפסו 12.3 גרם של חומר.", "בתיק נמצאו 2.5 חדרים ריקים, ו-12.3 גרם סם."]) {
    const { res, out } = await run(["הכרעת דין", "ביום 12.3 נתפס הנאשם.", line]);
    ok(!out[1].includes("12.3") && out[2] === line && res.verification.passed, "a weight keeps its number: «" + out[2] + "» " + JSON.stringify(res.verification.leaks));
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
})();
