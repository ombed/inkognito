/* The guards of restore (restoreNames and leftOver in engine/08-docx.js) that no suite pinned (mutation check, 1.11).

   Restore puts the real names back into the AI's answer and lists what it could not put back. Each guard below was
   broken on purpose, one comparison or one condition at a time, and every suite still passed; the broken engine brought
   back the wrong person, dropped a letter of the answer, or reported a wrong state. Each check here fails on it.

   - A misspelt invented first name right before its invented surname brings the whole person back only within a small
     edit distance: one letter for a first name of up to four letters, two for a longer one. Two letters away from a
     four-letter name («גילת» for «גלית») is another person of the family, and only the surname comes back.
   - A known first name near the invented one («אורית» for «אורי») is someone else, however close.
   - A prefix letter before a misspelt invented first name («ו») stays in front of the real name.
   - A one-word invented name that is also a word, present in the answer, is listed as left over, never as not found.
   - One replacement word the person chose for two people («פלוני») is put back as neither, and is listed as left over
     with no real name; until now only a replacement of two words or more was listed.

   All names are invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(a === b, m + " — got «" + a + "», want «" + b + "»");

// two invented people: a four-letter invented first name and a five-letter one
const PAIRS = [["נועה ברזילי", "גלית שמעוני"], ["עמרי פלג", "סרגיי לוי"]];
const back = (t, pairs) => C.restoreNames(t, pairs || PAIRS);

console.log("\n— a misspelt invented first name before its invented surname: how far it may be —");
eq(back("גלת שמעוני העידה.").text, "נועה ברזילי העידה.", "one letter off a four-letter invented first name is the person");
eq(back("גילת שמעוני, אחותה, העידה.").text, "גילת ברזילי, אחותה, העידה.",
  "two letters off a four-letter invented first name is someone else: only the surname comes back");
eq(back("סרגאאי לוי העיד.").text, "עמרי פלג העיד.", "two letters off a five-letter invented first name is the person");

console.log("\n— a known first name near the invented one is someone else —");
eq(back("אורית שמעוני, אחותו, העידה.", [["נועה ברזילי", "אורי שמעוני"]]).text, "אורית ברזילי, אחותו, העידה.",
  "«אורית» is not «אורי» misspelt");

console.log("\n— a prefix letter before a misspelt invented first name —");
eq(back("וסרגאאי לוי העיד.").text, "ועמרי פלג העיד.", "the «ו» stays in front of the real name");

console.log("\n— a one-word invented name that is also a word —");
{
  const r = C.restoreNames("הוועדה דנה בבקשה.", [["בארי", "דנה"]]);
  ok(!r.missing.includes("דנה"), "«דנה» is in the answer, so it is not reported as not found — missing " + JSON.stringify(r.missing));
  ok(r.left.some((l) => l.fake === "דנה"), "it is listed as left over, to check by hand");
}

console.log("\n— one replacement word for two people —");
{
  const r = C.restoreNames("פלוני הגיש תביעה.", [["נועה ברזילי", "פלוני"], ["רון שגיא", "פלוני"]]);
  eq(r.text, "פלוני הגיש תביעה.", "it is put back as neither");
  ok(r.left.some((l) => l.fake === "פלוני" && l.real === null), "it is listed as left over, with no real name — left " + JSON.stringify(r.left));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
