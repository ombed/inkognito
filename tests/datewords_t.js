/* A date written in words or in the Hebrew calendar is a date (the outside review of 18.10, F2).

   «ביום חמישי, שנים עשר ביוני אלפיים עשרים וחמש», «14.2.2025 (ארבעה עשר בפברואר אלפיים עשרים וחמש)», «ניתן היום, כ"ג
   בתשרי תשפ"ה»: none of these was found or shifted. Next to the same day in digits, which moved, they showed how far the
   whole document had moved; a half-read one moved only its month («שנים עשר בדצמבר 2025»); and a deadline the AI computed
   from the real day came back moved again by the restore. Now the day and the year in words (1 to 31 in both genders,
   1900 to 2099) and the Hebrew calendar are read, shifted by the same whole weeks and written back in their own form; the
   AI's answer is read in them too. The calendar is checked against Intl's on every day of two centuries. Invented text. */
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
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(a === b, m + " — got «" + a + "», want «" + b + "»");
const zipOf = (lines) => mkzip([...base, { name: "word/document.xml", body: doc(lines.map((l) => P(R(l))).join("")) }]);
const OPT = { on: new Set(E.PAT.filter((p) => p.on).map((p) => p.n)), flag: new Set(), mode: "real", near: true, body: true, prefixes: "normal", styles: {} };
const DAY = 864e5;
const dayOf = (p) => p && p.d != null && p.y != null ? Date.UTC(p.y, p.m - 1, p.d) / DAY : null;

(async () => {

console.log("\n— the Hebrew calendar agrees with Intl's on every day from 1900 to 2100 —");
if (!E.rdToHeb) ok(false, "the engine has no Hebrew calendar"); else {
  const fmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  const MONTH = { Nisan: 1, Iyar: 2, Sivan: 3, Tamuz: 4, Av: 5, Elul: 6, Tishri: 7, Heshvan: 8, Kislev: 9, Tevet: 10, Shevat: 11, "Adar I": 12, Adar: 12, "Adar II": 13 };
  let n = 0, bad = [];
  for (let rd = E.gregToRD(1, 1, 1900); rd <= E.gregToRD(31, 12, 2100); rd++) {
    const g = E.rdToGreg(rd), h = E.rdToHeb(rd); n++;
    const pt = Object.fromEntries(fmt.formatToParts(new Date(Date.UTC(g.y, g.m - 1, g.d))).map((x) => [x.type, x.value]));
    if (+pt.day !== h.d || MONTH[pt.month] !== h.m || +pt.year !== h.y || E.hebToRD(h.d, h.m, h.y) !== rd) bad.push(JSON.stringify({ g, h, pt }));
  }
  ok(n > 73000 && !bad.length, n + " days, each the same Hebrew day both ways: " + bad.slice(0, 3).join(" "));
}

console.log("\n— every day of the month and every year, in words, read back as written —");
if (!E.numWords) ok(false, "the engine has no numbers in words"); else {
  let bad = [];
  // the gender is kept where the two words differ («שלוש», «שלושה»); «עשרים» and «שמונה» are both
  for (let d = 1; d <= 31; d++) for (const f of [false, true]) { const w = E.numWords(d, f), r = E.DAYW.get(w); if (!r || r.n !== d || (E.numWords(d, !f) !== w && r.f !== f)) bad.push(w); }
  ok(!bad.length, "days 1 to 31, masculine and feminine: " + bad.join(" | "));
  bad = [];
  for (let y = 1900; y <= 2099; y++) for (const st of [{}, { f: false }, { and: true }, { bare: true }]) { const w = E.yearWords(y, st), r = E.YEARW.get(w); if (!r || r.y !== y) bad.push(y + ":" + w); }
  ok(!bad.length, "years 1900 to 2099 in each way they are written: " + bad.slice(0, 5).join(" | "));
  eq(E.yearWords(2025), "אלפיים עשרים וחמש", "2025");
  eq(E.yearWords(2010), "אלפיים ועשר", "2010");
  eq(E.yearWords(1998), "אלף תשע מאות תשעים ושמונה", "1998");
  ok(E.YEARW.get("אלפיים עשרים וחמישה").y === 2025 && E.YEARW.get("אלפיים ועשרים וחמש").y === 2025 && E.YEARW.get("אלפיים עשרים").y === 2020, "and the ways people also write them");
  ok(!E.DAYW.has("שנים"), "«שנים» alone is not two: it is also years («לפני שנים בינואר»)");
}

console.log("\n— each form is read, shifted by whole weeks and written in its own form —");
for (const [s, want] of [
  ["ארבעה עשר בפברואר אלפיים עשרים וחמש", "שבעה בנובמבר אלפיים עשרים וחמש"],
  ["שנים עשר ביוני 2025", "חמישה במרץ 2026"],
  ["שתים עשרה ביוני 2025", "חמש במרץ 2026"],
  ["12 ביוני אלפיים עשרים וחמש", "5 במרץ אלפיים עשרים ושש"],
  ["שנים עשר בחודש יוני שנת אלפיים עשרים וחמש", "חמישה בחודש מרץ שנת אלפיים עשרים ושש"],
  ["יוני אלפיים עשרים וחמש", "מרץ אלפיים עשרים ושש"],
  ['כ"ג בתשרי תשפ"ה', 'כ"ב בתמוז תשפ"ה'],
  ["כ״ג בתשרי התשפ״ה", "כ״ב בתמוז התשפ״ה"],
  ["ט׳ באב ה׳תשפ״ד", "ח׳ באייר ה׳תשפ״ה"],
  ['א\' באדר ב\' תשפ"ד', 'א\' בכסלו תשפ"ה'],
  ['ל\' בחשוון תשפ"ה', 'ל\' באב תשפ"ה'],
  // as older decisions write them: the day and Adar's half without a geresh, written back the same way
  ['ד באדר ב תשנ"ז', 'ה בכסלו תשנ"ח'],
  ['כג בתשרי תשפ"ה', 'כב בתמוז תשפ"ה'],
]) {
  const p = E.parseDate(s), got = E.fakeDate(s, 266), q = E.parseDate(got);
  eq(got, want, "«" + s + "» + 38 weeks");
  // a month and year move by whole months, the nearest to the same days (shiftDate)
  ok(p && q && (p.d == null ? (q.y * 12 + q.m) - (p.y * 12 + p.m) === 9 : dayOf(q) - dayOf(p) === 266), "«" + s + "»: the written date is 266 days later: " + JSON.stringify([p && [p.d, p.m, p.y], q && [q.d, q.m, q.y]]));
  eq(E.fakeDate(got, -266), s, "«" + got + "» back");
}

console.log("\n— every eleventh day of forty years, in every form, round trip —");
if (!E.rdToHeb || !E.numWords) ok(false, "the engine has neither"); else {
  const HEB = { 1: "ניסן", 2: "אייר", 3: "סיוון", 4: "תמוז", 5: "אב", 6: "אלול", 7: "תשרי", 8: "חשוון", 9: "כסלו", 10: "טבת", 11: "שבט" };
  const gem = (n) => { const L = [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"], [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"], [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"], [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"], [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"]];
    let s = ""; for (const [v, c] of L.slice(0, 4)) while (n >= v) { s += c; n -= v; } if (n === 15 || n === 16) return s + "ט" + (n === 15 ? "ו" : "ז"); for (const [v, c] of L.slice(4)) if (n >= v) { s += c; n -= v; } return s; };
  const mark = (s) => (s.length === 1 ? s + "'" : s.slice(0, -1) + '"' + s.slice(-1));
  const MON = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  let n = 0; const bad = [];
  for (let k = Date.UTC(2000, 0, 1) / DAY; k <= Date.UTC(2040, 0, 1) / DAY; k += 11) {
    const t = new Date(k * DAY), d = t.getUTCDate(), m = t.getUTCMonth() + 1, y = t.getUTCFullYear(), off = 35 + 7 * (k % 53);
    const h = E.rdToHeb(E.gregToRD(d, m, y));
    const forms = [E.numWords(d, false) + " ב" + MON[m - 1] + " " + E.yearWords(y), E.numWords(d, true) + " ב" + MON[m - 1] + " " + y, d + " ב" + MON[m - 1] + " " + E.yearWords(y)];
    if (HEB[h.m]) forms.push(mark(gem(h.d)) + " ב" + HEB[h.m] + " " + mark(gem(h.y - 5000)));
    for (const s of forms) {
      n++;
      // back exactly as written, unless the moved day is a word both genders share («עשרים»): then the day comes back right
      const p = E.parseDate(s), f = E.fakeDate(s, off), q = E.parseDate(f), back = E.fakeDate(f, -off), r = E.parseDate(back);
      // and a Hebrew year may come back with its last letter final or not («תש"פ», «תש"ף»: both are written)
      const shared = q && q.dw && E.numWords(q.d, false) === E.numWords(q.d, true);
      const fin = (x) => String(x).replace(/[ךםןףץ]/g, (c) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" })[c]);
      if (!p || dayOf(p) !== k || !q || dayOf(q) !== k + off || !r || dayOf(r) !== k || (!shared && fin(back) !== fin(s))) bad.push(s + " → " + f + " → " + back);
    }
  }
  ok(n > 4000 && !bad.length, n + " dates read, shifted and back: " + bad.slice(0, 4).join(" | "));
}

console.log("\n— a whole document: one day in two forms is one new day, and nothing real is left —");
{
  const lines = ["הסכם", "הסכם זה נחתם ביום 14.2.2025 (ארבעה עשר בפברואר אלפיים עשרים וחמש) בין הצדדים.",
    "התשלום הראשון ישולם ביום שנים עשר ביוני 2025.", "התשלום השני ישולם ביום 12 ביוני 2025.",
    "הדיון הקודם התקיים ביום חמישי, שנים עשר ביוני אלפיים עשרים וחמש.", "ניתן היום, כ\"ג בתשרי תשפ\"ה (25 באוקטובר 2024), בהעדר הצדדים."];
  {
    const r = await E.redactDocx(zipOf(lines), [], [], OPT);
    const out = r.preview.slice(2).map((p) => p.text);   // after doc()'s first line and the title
    const days = (s) => { const found = []; for (const m of s.matchAll(new RegExp(E.PAT.find((p) => p.n === "DATE").rx.source, "gu"))) { const p = E.parseDate(m[0]); if (p) found.push(dayOf(p)); } return found; };
    const d1 = days(out[0]), d2 = days(out[1]), d3 = days(out[2]), d4 = days(out[3]), d5 = days(out[4]);
    ok(d1.length === 2 && d1[0] === d1[1], "the digits and the words of 14.2.2025 are one new day: " + out[0]);
    ok(d2.length === 1 && d3.length === 1 && d2[0] === d3[0] && d4[0] === d2[0], "12 June in words, in digits and with the year in words: one new day: " + [out[1], out[2], out[3]].join(" / "));
    ok(d5.length === 2 && d5[0] === d5[1], "the Hebrew date and the one in brackets are one new day: " + out[4]);
    ok(!/ארבעה עשר בפברואר|שנים עשר ביוני|כ"ג בתשרי|תשפ"ה \(25/.test(out.join(" ")) && r.verification.passed, "no real date is left, and the final check passes: " + out.join(" / "));
    ok(new Date(d4[0] * DAY).getUTCDay() === 4, "Thursday stays Thursday: whole weeks");
  }
}

console.log("\n— left alone: words that only look like a date —");
{
  const lines = ["סיכום", "לפני שנים בינואר 2020 עבר לגור בעיר.", "יום אחד בינואר 2020 הגיע למשרד.", "נולדו שלושה בינואר ושניים בפברואר.",
    "ט\"ו בשבט חל השבוע.", "בשנת אלפיים עשרים וחמש יוגש הדוח.", "ל' בטבת תשפ\"ה אינו יום בלוח.", "הלכו יד ביד בשנת תשפ\"ה."];
  {
    const r = await E.redactDocx(zipOf(lines), [], [], OPT);
    const out = r.preview.slice(2).map((p) => p.text);   // after doc()'s first line and the title
    ok(/^לפני שנים ב[א-ת]+ 20\d\d /.test(out[0]), "«שנים» of time is not two (the month and year move as a month and year): " + out[0]);
    ok(/^יום אחד ב[א-ת]+ 20\d\d /.test(out[1]), "«יום אחד» is not the first of the month: " + out[1]);
    eq(out[2], lines[3], "a count before a month");
    eq(out[3], lines[4], "a holiday, without a year");
    eq(out[4], lines[5], "a year alone");
    eq(out[5], lines[6], "a Hebrew day the month does not have");
    eq(out[6], lines[7], "two letters that are a word, and a Hebrew year, without a month between them");
  }
}

console.log("\n— the AI's answer: a shifted date written another way comes back —");
{
  const PAIRS = [["ארבעה עשר בפברואר אלפיים עשרים וחמש", "שבעה בנובמבר אלפיים עשרים וחמש"], ['כ"ג בתשרי תשפ"ה', 'כ"ב בתמוז תשפ"ה']];
  for (const [said, back] of [
    ["ההסכם נחתם ב-7 בנובמבר 2025.", "ההסכם נחתם ב-ארבעה עשר בפברואר אלפיים עשרים וחמש."],
    ["ההסכם נחתם ביום 7.11.2025.", "ההסכם נחתם ביום ארבעה עשר בפברואר אלפיים עשרים וחמש."],
    ["ההסכם נחתם בשבעה בנובמבר 2025.", "ההסכם נחתם בארבעה עשר בפברואר אלפיים עשרים וחמש."],
    ["פסק הדין ניתן בכ״ב תמוז ה׳תשפ״ה.", 'פסק הדין ניתן בכ"ג בתשרי תשפ"ה.'],
    ["פסק הדין ניתן ב-18 ביולי 2025.", 'פסק הדין ניתן ב-כ"ג בתשרי תשפ"ה.'],
  ]) {
    const r = E.restoreNames(said, PAIRS, [], { off: 266 });
    eq(r.text, back, "«" + said + "»");
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
