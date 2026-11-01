/* Dates: behaviours no suite held (the mutation hunt of 1.11, second round).

   Each check here was found the same way: a small, likely edit to the engine's date code (a spelling or a letter
   dropped from its list, a condition dropped from the offset search, a dash dropped from a pattern, a zero no
   longer written) broke it, and every suite stayed green; for all but two the result lock did too. A broken one
   means a real date reaches the AI, a shifted date lands on a real one, or a shifted date comes back wrong. Each
   section names the behaviour it protects; the commit that added it names the edit that proved it blind.
   Every date and text here is invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the page's own defaults: every detector marked on is deleted unasked, the rest are flagged for a look
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const DAY = 864e5;
const dayOf = (p) => (p && p.d != null && p.y != null ? Date.UTC(p.y, p.m - 1, p.d) / DAY : null);
// the document's dates as the engine finds them, and what each goes out as
const dates = (text) => {
  const eng = new C.Engine([], [], OPT, text);
  return { off: eng.dateOff, hits: eng.detect(text).filter((h) => h.type === "DATE").map((h) => ({ text: h.text, apply: h.apply, rep: eng.repFor(h) })) };
};
const show = (hits) => hits.map((h) => "«" + h.text + "» → «" + h.rep + "»" + (h.apply ? "" : " asked")).join(", ") || "no date";
// the date is found whole, deleted unasked, and goes out the document's offset later: a day by days, a month by months
const movedWhole = (text, date, what) => {
  const { off, hits } = dates(text);
  const h = hits.find((x) => x.text === date), p = C.parseDate(date), q = h && C.parseDate(h.rep);
  const moved = !!(p && q) && (p.d == null ? (q.y * 12 + q.m) - (p.y * 12 + p.m) === Math.round(off / 30.4375) : dayOf(q) - dayOf(p) === off);
  ok(!!h && h.apply && moved, what + ": «" + date + "» found whole and moved " + off + " days — got " + show(hits));
};

console.log("\n— a date in the Hebrew calendar is read in every spelling of its month, not only the one the tool writes —");
// the two halves of Adar need a leap year: תשפ"ד is one
for (const [mon, year] of [["איר", 'תשפ"ה'], ["סיון", 'תשפ"ה'], ["מרחשוון", 'תשפ"ה'], ["מרחשון", 'תשפ"ה'], ["חשון", 'תשפ"ה'], ["כסליו", 'תשפ"ה'],
  ["מנחם אב", 'תשפ"ה'], ["אדר א", 'תשפ"ד'], ["אדר ראשון", 'תשפ"ד'], ["אדר ב", 'תשפ"ד'], ["אדר שני", 'תשפ"ד']]) {
  const date = "ז' ב" + mon + " " + year;
  movedWhole("ניתן היום, " + date + ", בהעדר הצדדים.", date, "the month spelled «" + mon + "»");
}

console.log("\n— a Hebrew year that ends in a final letter is read: a birth date in 5720, 5740, 5750, 5780 or 5790 —");
for (const year of ['תש"ך', 'תש"ם', 'תש"ן', 'תש"ף', 'תש"ץ']) {
  const date = "ג' בתשרי " + year;
  movedWhole("המבקש נולד ביום " + date + ", כך לפי תעודת הלידה.", date, "the year «" + year + "»");
}

console.log("\n— a day or a year in words in its older spelling is read with its date, not left real beside a moved month —");
for (const day of ["ששה", "שלשה", "חמשה", "שלש", "שתים", "שלשים", "ששה עשר", "שלש עשרה", "עשרים ושלשה", "עשרים וששה", "עשרים וחמשה"]) {
  const date = day + " בינואר 2026";
  movedWhole("ההסכם נחתם ביום " + date + " בין הצדדים.", date, "the day «" + day + "»");
}
// and the year: read, so the date moves, rather than going out as a label the AI cannot count from
movedWhole("ההסכם נחתם ביום 5 במרץ אלפיים עשרים ושלש בין הצדדים.", "5 במרץ אלפיים עשרים ושלש", "the year «אלפיים עשרים ושלש»");

console.log("\n— a year of the 1900s in words is read with its date: a birth date as an affidavit writes it —");
for (const [text, date] of [
  ["הוא נולד ביום חמישה עשר במאי אלף תשע מאות שמונים ושבע.", "חמישה עשר במאי אלף תשע מאות שמונים ושבע"],
  ["הוא נולד בחמישה עשר במאי אלף תשע מאות שמונים ושבע.", "חמישה עשר במאי אלף תשע מאות שמונים ושבע"],
  ["הוא נולד ביום 15 במאי אלף תשע מאות שמונים ושבע.", "15 במאי אלף תשע מאות שמונים ושבע"],
  ["הוא עלה ארצה במאי אלף תשע מאות שמונים ושבע.", "מאי אלף תשע מאות שמונים ושבע"],
]) movedWhole(text, date, "a year of the 1900s in words");

console.log("\n— a two-digit year of 2000 to 2009 keeps its zero when the date moves —");
{
  const out = C.fakeDate("12.3.05", 35), q = C.parseDate(out);
  ok(out === "16.4.05" && !!q && q.y === 2005, "«12.3.05» + 35 days is «16.4.05», still a date of 2005 — got «" + out + "»");
  movedWhole("הקטינה נולדה ביום 12.3.05, והיא מתגוררת עם אמה.", "12.3.05", "a child's birth date with a two-digit year");
}

console.log("\n— no shifted date lands on a real date of the same document, in any of its forms —");
// the offset a document gets from its text alone, before the search moves it on
const base = (t) => C.dateOffBase(C.norm(t));
{
  // a day and month that the document's own offset takes onto its other day and month: the offset is whole weeks, so
  // each week, with a few wordings of the second line, until one collides
  let text = null, second = null;
  for (let v = 0; v < 60 && !text; v++) for (let w = 5; w < 58 && !text; w++) {
    const d = new Date(Date.UTC(2025, 1, 1 + 7 * w)), s = d.getUTCDate() + "." + (d.getUTCMonth() + 1);
    const t = "ביום 1.2 התקיים דיון.\nהתגובה תוגש עד ליום " + s + (v ? ", בקשה " + v : "") + ".";
    if (C.fakeDate("1.2", base(t)) === s) { text = t; second = s; }
  }
  ok(!!text, "a document whose own offset takes «1.2» onto its other day and month was built");
  if (text) {
    const { off, hits } = dates(text), reps = hits.map((h) => h.rep);
    ok(hits.length === 2 && !reps.includes("1.2") && !reps.includes(second), "no shifted day and month is a real one (1.2, " + second + "): " + show(hits) + ", offset " + off);
  }
}
{
  // a full date whose shifted day and month is a day and month the document wrote without a year
  let text = null, second = null;
  for (let v = 0; v < 60 && !text; v++) for (let w = 5; w < 58 && !text; w++) {
    const d = new Date(Date.UTC(2026, 1, 1 + 7 * w)), s = d.getUTCDate() + "." + (d.getUTCMonth() + 1);
    const t = "ביום 1.2.2026 התקיים דיון.\nהתגובה תוגש עד ליום " + s + (v ? ", בקשה " + v : "") + ".";
    if ((C.fakeDate("1.2.2026", base(t)) || "").startsWith(s + ".")) { text = t; second = s; }
  }
  ok(!!text, "a document whose own offset takes «1.2.2026» onto a day and month it wrote without a year was built");
  if (text) {
    const { off, hits } = dates(text), reps = hits.map((h) => h.rep);
    ok(hits.length === 2 && !reps.some((r) => r === second || r.startsWith(second + ".")), "no shifted date holds the real «" + second + "»: " + show(hits) + ", offset " + off);
  }
}
{
  // two months two apart, whose own offset is seven or eight weeks: a month and year moves by the nearest whole number
  // of months (shiftDate), two here, so the first one would land on the second
  let text = null;
  for (let k = 0; k < 400 && !text; k++) {
    const t = "תלוש לחודש ינואר 2026 צורף. תלוש לחודש מרץ 2026 צורף" + (k ? " (עמוד " + k + ")" : "") + ".";
    if (base(t) === 49 || base(t) === 56) text = t;
  }
  ok(!!text, "a document of two months two apart, whose own offset is seven or eight weeks, was built");
  if (text) {
    const { off, hits } = dates(text), reps = hits.map((h) => h.rep);
    ok(hits.length === 2 && !reps.includes("ינואר 2026") && !reps.includes("מרץ 2026"), "no shifted month is a real month of it: " + show(hits) + ", offset " + off);
  }
}

console.log("\n— every offset a document can get is whole weeks within the owner's 30 to 400 days, at both ends —");
{
  // four hundred short documents without a date reach every offset the text can give (53 of them)
  const seen = new Set(), bad = [];
  for (let k = 0; k < 400; k++) {
    const t = "בקשה למתן צו הגנה מספר " + k + ".", off = new C.Engine([], [], OPT, t).dateOff;
    seen.add(off);
    if (!(off >= 30 && off <= 400 && off % 7 === 0)) bad.push(k + ": " + off);
  }
  ok(seen.size >= 50 && !bad.length, seen.size + " different offsets, none outside 30–400 or not whole weeks: " + bad.slice(0, 5).join(" | ") + " (lowest " + Math.min(...seen) + ", highest " + Math.max(...seen) + ")");
}

console.log("\n— the end of a range the AI wrote with any dash is not half restored, and is listed —");
{
  const F = [["22.12.2026", "4.7.2027"], ["23.12.2026", "5.7.2027"]];
  const EN = String.fromCharCode(0x2013), EM = String.fromCharCode(0x2014), MAQAF = String.fromCharCode(0x05be);
  for (const [name, dash] of [["an en dash", EN], ["an en dash between spaces", " " + EN + " "], ["an em dash", EM], ["a maqaf", MAQAF]]) {
    const t = "הדיונים יתקיימו בימים 4" + dash + "5.7.2027.", r = C.restoreNames(t, F);
    ok(r.text === t && r.left.some((l) => l.fake === "5.7.2027" && l.real === "23.12.2026"),
      name + ": «" + t + "» → «" + r.text + "», listed " + JSON.stringify(r.left.map((l) => [l.fake, l.real])));
  }
}

console.log("\n— a shifted date in words or in the Hebrew calendar comes back when the AI writes it another way —");
{
  // the day in digits beside the year in words
  const W = [["ארבעה עשר בפברואר אלפיים עשרים וחמש", "שבעה בנובמבר אלפיים עשרים וחמש"]];
  const r = C.restoreNames("ההסכם נחתם ב-7 בנובמבר אלפיים עשרים וחמש.", W);
  ok(r.text === "ההסכם נחתם ב-ארבעה עשר בפברואר אלפיים עשרים וחמש.", "the day in digits, the year in words: " + r.text);
  // the second Adar as plain «אדר», which in a leap year is the second; 8 February 2024 + 35 days is 4 Adar II 5784
  const A = [['כ"ט בשבט תשפ"ד', 'ד\' באדר ב\' תשפ"ד']];
  const a = C.restoreNames('הדיון נקבע לד\' באדר תשפ"ד.', A);
  ok(a.text === 'הדיון נקבע לכ"ט בשבט תשפ"ד.', "Adar II written as plain «אדר»: " + a.text);
  // the year's last letter final where the tool wrote it plain (תש"ף, תש"פ); 1 October 2019 + 35 days
  const Y = [['ג\' בתשרי תש"פ', 'ח\' בחשוון תש"פ']];
  const y = C.restoreNames('הדיון נקבע לח\' בחשוון תש"ף.', Y);
  ok(y.text === 'הדיון נקבע לג\' בתשרי תש"פ.', "the year with its final letter: " + y.text);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
