/* A date the AI computed from a shifted date (the owner's decision of 12.10, «A»; the engineering audit, H2). The
   document's dates go to the AI moved by whole weeks; the AI answers «45 days from 23.4.2026, that is until 7.6.2026».
   Until 12.10 the restore put back 23.4.2026, which the tool wrote, and left 7.6.2026 as it was: a deadline six weeks
   off. Now every other date in the answer, up to a year from the dates the tool wrote, moves back by the same offset
   and is marked for her to check; a date further away (a law of 1962), and a real date of the list, stay as written.
   Invented names and dates only. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const PAIRS = [["12.3.2026", "23.4.2026"], ["דנה כהן", "מיכל לוי"]];
const at = (r, i) => r.text.slice(r.dates[i].at[0][0], r.dates[i].at[0][1]);

console.log("\n— the deadline the AI computed comes back by the document's weeks, marked —");
{
  const ans = "הדיון של מיכל לוי היה ב-23.4.2026. המועד לערעור 45 יום, כלומר עד 7.6.2026.";
  const r = C.restoreNames(ans, PAIRS, [], { off: 42 });
  ok(r.text === "הדיון של דנה כהן היה ב-12.3.2026. המועד לערעור 45 יום, כלומר עד 26.4.2026.", "the name, the date the tool wrote and the computed one: " + r.text);
  ok(r.dates && r.dates.length === 1 && r.dates[0].was === "7.6.2026" && r.dates[0].now === "26.4.2026", "one date moved, from 7.6.2026 to 26.4.2026: " + JSON.stringify(r.dates));
  ok(r.dates && at(r, 0) === "26.4.2026", "its mark sits on it in the restored text, after the longer name before it: " + (r.dates && at(r, 0)));
  const wd = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  ok(wd(2026, 6, 7) === wd(2026, 4, 26), "whole weeks: the moved date keeps its weekday");
}

console.log("\n— in every way the AI writes a date —");
for (const [said, back] of [["עד 7 ביוני 2026", "עד 26 באפריל 2026"], ["עד 2026-06-07", "עד 2026-04-26"], ["ביום 7.6 נקבע דיון", "ביום 26.4 נקבע דיון"], ["עד 07/06/2026", "עד 26/04/2026"]]) {
  const r = C.restoreNames("ב-23.4.2026 הוגשה הבקשה. " + said + ".", PAIRS, [], { off: 42 });
  ok(r.text === "ב-12.3.2026 הוגשה הבקשה. " + back + ".", `«${said}» → «${back}»: ` + r.text);
}

console.log("\n— what stays as written —");
{
  const far = C.restoreNames("ב-23.4.2026 הוגשה הבקשה, לפי תקנה מיום 1.1.1990 ופסק דין מ-3.2.2028.", PAIRS, [], { off: 42 });
  ok(far.text.includes("1.1.1990") && far.text.includes("3.2.2028") && !far.dates.length, "dates more than a year from the document's stay: " + far.text);
  const real = C.restoreNames("ב-23.4.2026 הוגשה הבקשה, והדיון הקודם היה ב-12.3.2026.", PAIRS, [], { off: 42 });
  ok(!real.dates.length && (real.text.match(/12\.3\.2026/g) || []).length === 2, "a real date of the list in the answer (she wrote it in her question) is not moved: " + real.text);
  const month = C.restoreNames("ב-23.4.2026 הוגשה הבקשה. ההחלטה תינתן ביוני 2026.", PAIRS, [], { off: 42 });
  ok(month.text.endsWith("ביוני 2026.") && !month.dates.length, "a month without a day is not moved: " + month.text);
  // the tool's own shifted day and month, given a year by the AI: it is not this rule's (dateforms_t lists it)
  const ownForm = C.restoreNames("ביום 27.4.2026 נפגשו.", [["12.3", "27.4"]], [], { off: 46 });
  ok(ownForm.text === "ביום 27.4.2026 נפגשו." && !ownForm.dates.length, "the tool's own day and month with a year the AI added stays: " + ownForm.text);
  // the end of a range is not half moved, as with the dates the tool wrote
  const range = C.restoreNames("ב-23.4.2026 הוגשה הבקשה. הדיונים בימים 4-7.6.2026.", PAIRS, [], { off: 42 });
  ok(range.text.endsWith("בימים 4-7.6.2026.") && !range.dates.length, "a range's end stays: " + range.text);
  const noDates = C.restoreNames("מיכל לוי תגיש עד 7.6.2026.", [["דנה כהן", "מיכל לוי"]], [], { off: 42 });
  ok(noDates.text === "דנה כהן תגיש עד 7.6.2026." && !noDates.dates.length, "a document without dates moves nothing: the AI's date is not from a shifted one");
}

console.log("\n— the offset: the open document's, or one all the known dates agree on —");
{
  const ans = "ב-23.4.2026 הוגשה הבקשה. עד 7.6.2026.";
  const inferred = C.restoreNames(ans, PAIRS, []);
  ok(inferred.text.endsWith("עד 26.4.2026.") && inferred.dates.length === 1, "without the offset, the one the known dates agree on (a case loaded for restore only): " + inferred.text);
  const twoDocs = [...PAIRS, ["1.5.2026", "19.6.2026"]]; // a second document, moved 49 days
  const unsure = C.restoreNames(ans, twoDocs, []);
  ok(unsure.text.endsWith("עד 7.6.2026.") && !unsure.dates.length, "two documents with different offsets and no open one: nothing moves");
  const open = C.restoreNames(ans, twoDocs, [], { off: 42 });
  ok(open.text.endsWith("עד 26.4.2026.") && open.dates.length === 1, "with the open document's offset, it moves by that one");
}
console.log("\n— today's date is never moved (the owner's decision, 18.10) —");
{
  const ans = "ב-23.4.2026 הוגשה הבקשה. היום, 7.6.2026, טרם התקבלה תשובה.";
  const r = C.restoreNames(ans, PAIRS, [], { off: 42, today: { d: 7, m: 6, y: 2026 } });
  ok(r.text.includes("היום, 7.6.2026,") && !r.dates.length, "the AI's «today» stays: " + r.text);
  const other = C.restoreNames(ans, PAIRS, [], { off: 42, today: { d: 8, m: 6, y: 2026 } });
  ok(other.text.includes("היום, 26.4.2026,") && other.dates.length === 1, "any other day still moves, marked: " + other.text);
}

console.log("\n— a date the AI computed in words or in the Hebrew calendar moves back in its own form (review 18.10, F2) —");
{
  const words = C.restoreNames("ב-23.4.2026 הוגשה הבקשה. המועד: שבעה ביוני אלפיים עשרים ושש.", PAIRS, [], { off: 42 });
  ok(words.text.endsWith("המועד: עשרים ושישה באפריל אלפיים עשרים ושש.") && words.dates.length === 1 && words.dates[0].was === "שבעה ביוני אלפיים עשרים ושש",
    "in words: " + words.text + " " + JSON.stringify(words.dates));
  // 7.6.2026 is כ"ב בסיוון תשפ"ו; 42 days before, 26.4.2026, is ט' באייר תשפ"ו
  const heb = C.restoreNames("ב-23.4.2026 הוגשה הבקשה. המועד: כ\"ב בסיוון תשפ\"ו.", PAIRS, [], { off: 42 });
  ok(heb.text.endsWith("המועד: ט' באייר תשפ\"ו.") && heb.dates.length === 1, "in the Hebrew calendar: " + heb.text);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
