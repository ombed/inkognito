/* Restore when the AI writes an invented name differently (the hunt of 11.10, restore.md REAL medium). Only the exact
   spelling came back, and a lone surname came back beside the AI's spelling of the invented first name: «סרגי לוי» became
   «סרגי אלמגור», a person who does not exist, under «הוחזרו». Now every usual form of an invented person comes back as the
   whole person: another Hebrew spelling (a doubled or single yod or vav, ב as וו, a final geresh), the English spelling of
   a pool name, initials, and a first name the AI misspelled right before the invented surname. A form is always the whole
   name, so an everyday word alone never comes back as someone. All names are invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(a === b, m + " — got «" + a + "», want «" + b + "»");

// the finding's document: two parents of one family, and their town
const PAIRS = [["נורית אלמגור", "אילנה מזרחי"], ["עמנואל אלמגור", "סרגיי לוי"], ["נס ציונה", "כפר יונה"]];
const back = (t, pairs) => C.restoreNames(t, pairs || PAIRS);

console.log("\n— another Hebrew spelling of an invented name —");
eq(back("סרגי לוי לא שילם מזונות, ואילנה מזרחי ביקשה צו.").text, "עמנואל אלמגור לא שילם מזונות, ונורית אלמגור ביקשה צו.",
  "«סרגי לוי» is «סרגיי לוי»");
for (const [real, fake, written] of [
  ["תמר רוזן", "חוה ברקוביץ", "חווה ברקוביץ"],
  ["תמר רוזן", "חוה ברקוביץ", "חוה ברקוביץ'"],
  ["תמר רוזן", "סבטלנה גבאי", "סווטלנה גבאי"],
  ["רון כץ", "אייל שטרן", "איל שטרן"],
  ["רון כץ", "ולדימיר כהן", "וולדימיר כהן"],
]) {
  const r = back("לדברי " + written + ", הצדדים נפגשו.", [[real, fake]]);
  eq(r.text, "לדברי " + real + ", הצדדים נפגשו.", "«" + written + "» is «" + fake + "»");
}

console.log("\n— the English spelling —");
eq(back("I, Ilana Mizrahi, ask that Sergei Levi pay support.").text, "I, נורית אלמגור, ask that עמנואל אלמגור pay support.",
  "«Ilana Mizrahi» and «Sergei Levi» come back");

console.log("\n— initials —");
eq(back("א. מזרחי טענה כי ס. לוי לא שילם.").text, "נ. אלמגור טענה כי ע. אלמגור לא שילם.", "an initial before the invented surname");
eq(back("לדברי אילנה מ., המצב השתפר.").text, "לדברי נורית א., המצב השתפר.", "the invented first name and the surname's initial");

console.log("\n— a first name the AI misspelled, right before the invented surname —");
{
  const r = back("סרגאי לוי לא הגיע לדיון.");
  eq(r.text, "עמנואל אלמגור לא הגיע לדיון.", "the whole person comes back, not «סרגאי אלמגור»");
  const r2 = back("וסרגי לוי לא הגיע.");
  eq(r2.text, "ועמנואל אלמגור לא הגיע.", "with a prefix letter on the misspelled first name");
}

console.log("\n— what stays as it is —");
{
  // an everyday word that looks like a form of an invented first name, alone: not a person
  const r = back("שיירה של משאיות חסמה את הדרך.", [["תמר רוזן", "שירה כהן"]]);
  eq(r.text, "שיירה של משאיות חסמה את הדרך.", "«שיירה» alone is a convoy, not «שירה»");
  // another known first name before the invented surname is someone else of the family: only the surname comes back, as before
  const r2 = back("יעל לוי, אחותו, העידה.");
  eq(r2.text, "יעל אלמגור, אחותו, העידה.", "a known first name keeps its own name");
  // the exact spelling still comes back, and the place too
  eq(back("סרגיי לוי עבר לכפר יונה.").text, "עמנואל אלמגור עבר לנס ציונה.", "the exact forms");
  // a two-letter Latin word or a Hebrew form that is another pool name is never made a form of someone
  ok(!/נורית|עמנואל/.test(back("Or and Tal left early.").text), "short English words stay");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
