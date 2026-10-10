/* Every usual written form of an identifying number is found and deleted (the hunt of 11.10).

   Only one or two forms of each were known: an ID as nine digits, a mobile as 3+3+4, a bank account as
   bank-branch-account, ten kinds of case number, a link with https://www. Every other usual form reached
   the AI unchanged under a green bar: «ת"ז 034-567-123», «0547-712093», «(03) 6123456», «לחשבון מס' 123456»,
   «בתלה"מ 23456-07-24», «גוש 10802 חלקה 112», «m.facebook.com/…», «@handle». The same class as the dates of
   v73: one value, written in another usual form of itself. And the other side of it: numbers that identify
   no one (amounts, years, clause numbers, ages, page numbers) stay as they are. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the tool's own defaults: what is deleted unasked, and what is flagged for a look
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n));
const OPT = { on: ON, flag: FLAG, mode: "real", near: false, body: false, prefixes: "normal" };
const numbers = (t) => new C.Engine([], [], OPT, t).detect(t).filter((h) => h.src === "pattern" && h.type !== "DATE");

console.log("\n— found and deleted unasked, in every usual form —");
for (const [text, want] of [
  // identity and company numbers: the check digit after a dash, groups of three, מס' after the label
  ["המבקשת, ת\"ז מס' 03456712-3, הגישה בקשה.", "03456712-3"],
  ["המשיב, ת\"ז 034-567-123, לא התייצב.", "034-567-123"],
  ["המשיב, ת\"ז 034 567 123, לא התייצב.", "034 567 123"],
  ["המספר 03456712-3 נרשם בטופס.", "03456712-3"],
  ["החברה שבבעלות האב, ח.פ. 51-234567-8, משלמת לו שכר.", "51-234567-8"],
  ["מספר הביטוח הסוציאלי שלו 123-45-6789.", "123-45-6789"],
  // passports: מס', a nationality between the label and the number
  ["דרכון מס' 31234567 הונפק לאב.", "31234567"],
  ["לאב דרכון אוקראיני מספר FE123456.", "FE123456"],
  // phones: any grouping, a bracketed area code, spaces around the dash, abroad
  ["ניתן להשיג את האב בנייד 0547-712093 בכל שעה.", "0547-712093"],
  ["נייד 054-771-20-93.", "054-771-20-93"],
  ["נייד 054-1234-567.", "054-1234-567"],
  ["טל: (03) 6123456", "(03) 6123456"],
  ["טלפון 03 - 6123456 בשעות העבודה.", "03 - 6123456"],
  ["ניתן להשיג את האב בצרפת בטלפון +33 6 12 34 56 78 בשעות הערב.", "+33 6 12 34 56 78"],
  ["בארה\"ב בטלפון +1 (212) 555-0147 בשעות הערב.", "+1 (212) 555-0147"],
  ["הטלפון בבריטניה 00447700900123.", "00447700900123"],
  // a plate with spaces, after a word that says it is a vehicle
  ["הרכב מספר 12 345 67 נגרר.", "12 345 67"],
  // bank accounts as people write them, and a printed IBAN, whole
  ["המזונות יועברו לחשבון מס' 123456 בבנק הפועלים, סניף 612.", "123456"],
  ["המזונות יועברו לחשבון 12345/67 בבנק לאומי, סניף 802.", "12345/67"],
  ["המזונות יועברו לחשבון 0418822.", "0418822"],
  ["מספר חשבון: 12345678", "12345678"],
  ["חשבון מס' 41-88225", "41-88225"],
  ["IBAN: IL62 0108 0000 0009 9999 999", "IL62 0108 0000 0009 9999 999"],
  // case numbers of every kind: the type stays, the number goes
  ["בתלה\"מ 23456-07-24 נקבע דיון.", "23456-07-24"],
  ["צו ההגנה שניתן בה\"ט 34567-08-24 הוארך.", "34567-08-24"],
  ["הוגשה בקשה ליישוב סכסוך, י\"ס 45678-09-24.", "45678-09-24"],
  ["בע\"מ 1234/24 נדחתה.", "1234/24"],
  ["ת\"ע 78901-12-24 תלוי ועומד.", "78901-12-24"],
  ["התקיים דיון בתמ\"ש 12345-06-24 בפני כב' השופטת.", "12345-06-24"],
  ["תמ\"ש (ת\"א) 12345-06-24", "12345-06-24"],
  ["ההחלטה בתיק 12345-06-24 ניתנה אתמול.", "12345-06-24"],
  ["בית הדין הרבני האזורי, תיק מס' 1234567/2", "1234567/2"],
  ["תיק הוצל\"פ 512345-06-24 נפתח נגדו.", "512345-06-24"],
  // addresses without a street word, land registry, a moshav farm, a P.O. box
  ["הדירה הידועה כגוש 10802 חלקה 112 תת חלקה 5 רשומה על שם שני הצדדים.", "10802 | 112 | 5"],
  ["כחלקה 112 בגוש 10802.", "112 | 10802"],
  ["כתובת: הנרקיס 9, חיפה", "הנרקיס 9"],
  ["המבקשת מתגוררת ברח הנרקיס 9 בחיפה.", "ברח הנרקיס 9"],
  ["המבקשת מתגוררת ברח. הנרקיס 9 בחיפה.", "ברח. הנרקיס 9"],
  ["המשיב מתגורר במשק 45 במושב בית זית.", "45"],
  ["ת.ד. 4521, חיפה", "4521"],
  // a person's account: any subdomain, with or without https, more networks, a bare @handle
  ["ראו את הפוסט בכתובת https://m.facebook.com/noga.trachtengot.5 מיום שני.", "https://m.facebook.com/noga.trachtengot.5"],
  ["ראו את הפוסט בכתובת facebook.com/noga.trachtengot.5 מיום שני.", "facebook.com/noga.trachtengot.5"],
  ["בחשבון האינסטגרם @noga_trach85 פורסמו תמונות של הקטינים.", "@noga_trach85"],
  ["סרטון ב-https://www.tiktok.com/@noga_trach85 הוצג בדיון.", "https://www.tiktok.com/@noga_trach85"],
  ["הקבוצה בכתובת t.me/noga_group85 נסגרה.", "t.me/noga_group85"],
  // an e-mail after «ל-» without the hyphen
  ["כתבו ל-office@example.co.il לפרטים.", "office@example.co.il"],
]) {
  const h = numbers(text);
  const got = h.map((x) => x.text).join(" | ");
  ok(got === want && h.every((x) => x.apply), "«" + text + "» — got «" + got + "»" + (h.some((x) => !x.apply) ? " (only flagged)" : "") + ", want «" + want + "», deleted");
}

console.log("\n— left alone: numbers that identify no one —");
for (const text of [
  "הסכום הוא 1,234,567 ש\"ח.",
  "שכר של 12 345 ש\"ח בחודש.",
  "בשנים 2019-2021 גרו יחד.",
  "דין וחשבון 2025 הוגש לבית המשפט.",
  "בהתאם לסעיף 5.2 להסכם הגירושין.",
  "לפי סעיף 12.3 להסכם.",
  "הילדה בת 9 והילד בן 12.",
  "שיעור של 33.5% מההכנסה.",
  "בשעה 10:30 התחיל הדיון.",
  "יש להביא בחשבון 3 ילדים.",
  "בעמודים 12-14 לפרוטוקול.",
  "חוק הכשרות המשפטית והאפוטרופסות, תשכ\"ב-1962",
  "תקנה 12(א) לתקנות סדר הדין האזרחי, התשע\"ט-2018",
  "בתיק 2024 לא נמצא דבר.",
  "חלקה בנכס 50% וחלקו 50%.",
  "גוש דן הוא אזור מרכז הארץ.",
  "מזרח העיר 5 קילומטרים מכאן.",
  "המספרים 100 200 300 מופיעים בטבלה.",
]) {
  const h = numbers(text);
  ok(!h.length, "«" + text + "» — nothing found, got «" + h.map((x) => x.type + ":" + x.text).join(" | ") + "»");
}

console.log("\n— without a label, a check that fails means it is not an ID: skipped, not flagged —");
{
  // 123-456-789 fails the Israeli check digit; with no label it is just a number
  const h = numbers("המספרים בטבלה: 123-456-789 ו-987-654-321.");
  ok(!h.some((x) => /ID/.test(x.type)), "three groups of three without a label and without a valid check digit stay: " + h.map((x) => x.type + ":" + x.text).join(" | "));
  // after a label it is an ID whatever its check digit: a typo is no proof that it is harmless
  const l = numbers("ת\"ז 123-456-789");
  ok(l.some((x) => x.type === "ISRAELI_ID_LABELED" && x.text === "123-456-789" && x.apply), "after a label it is deleted: " + l.map((x) => x.type + ":" + x.text).join(" | "));
}

console.log("\n— and the text that reaches the AI —");
{
  const t = "ת\"ז 034-567-123, טלפון 0547-712093, חשבון מס' 123456, תלה\"מ 23456-07-24.";
  // the engine's own replacements, put in place from the end, as the page does
  const eng = new C.Engine([], [], { ...OPT, styles: { "*": "blank" } }, t);
  const hits = eng.detect(t).filter((h) => h.apply).sort((a, b) => b.s - a.s);
  let sent = t;
  for (const h of hits) sent = sent.slice(0, h.s) + eng.repFor(h) + sent.slice(h.e);
  ok(hits.length >= 4 && !/034-567-123|0547-712093|123456|23456-07-24/.test(sent) && /תלה"מ/.test(sent), "none of the four reaches the text, and the case type stays: «" + sent + "»");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
