/* Guards on the two detectors that read running text for names. bodyNames (engine/05-bodynames.js) proposes names by
   the words around them, on a ladder of evidence: three points propose a name on their own, two need a second piece of
   evidence. secondScan (engine/08-docx.js) reads the finished result for names left behind. Each check here pins one
   behaviour that a small edit could break while every other suite stayed green: a mutation run (1.11) changed one
   condition at a time and found these blind. Invented names only. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const body = (texts, known) => C.bodyNames(texts.map((text) => ({ part: "w", text })), known || []).map((c) => c.value);
const scan = (text, subs) => C.secondScan([{ text, marks: [] }], [], subs || []).map((x) => x.value);
const NAME = (v) => ({ value: v, kind: "NAME" });

console.log("\n— body layer: a prefix letter without the article is evidence of a name —");
{
  // «ליווי» right before the name gives two points, one short of a proposal. «לאלמוגית» adds two: a prefix letter with
  // no ה' after it, on a word the document also writes bare, is how a first name looks («השליו» would be a noun)
  const got = body(["הוחלט על ליווי לאלמוגית בבית הספר.", "בתיק נזכרה גם אלמוגית."]);
  ok(got.includes("אלמוגית"), "care word + «לאלמוגית» proposes אלמוגית: " + got.join(", "));
}

console.log("\n— body layer: a care word up to two words before the name counts —");
{
  // «ליווי צמוד לאלמוגית»: the care word is two words back. Without it only the prefix letter is left, which never proposes alone
  const got = body(["הוחלט על ליווי צמוד לאלמוגית בבית הספר.", "בתיק נזכרה גם אלמוגית."]);
  ok(got.includes("אלמוגית"), "«ליווי צמוד לאלמוגית» proposes אלמוגית: " + got.join(", "));
}

console.log("\n— body layer: the two-word name is tried before the one-word name —");
{
  // «לדברי» is evidence for whatever follows it. Tried first, «נועה» alone would take it, and «ברזילי» would stay
  const got = body(["לדברי נועה ברזילי, הבקשה נדחתה."]);
  ok(got.includes("נועה ברזילי") && !got.includes("נועה"), "the full name, not the first name alone: " + got.join(", "));
}

console.log("\n— body layer: a surname is proposed with the first name written before it —");
{
  // the evidence is around «גבריאלי» alone; the document also writes «סיגלית גבריאלי» at the start of a paragraph.
  // Proposing only the surname would leave the first name in the text
  const got = body(["לדברי גבריאלי, הבקשה נדחתה.", "סיגלית גבריאלי."]);
  ok(got.includes("סיגלית גבריאלי") && !got.includes("גבריאלי"), "the full name, not the surname alone: " + got.join(", "));
}

console.log("\n— second scan: a listed name written with one letter more or one less —");
{
  ok(scan("לדברי ברזילאי הבקשה נדחתה.", [NAME("נועה ברזילי")]).includes("ברזילאי"), "one letter added (ברזילאי of ברזילי)");
  ok(scan("לדברי ברזלי הבקשה נדחתה.", [NAME("נועה ברזילי")]).includes("ברזלי"), "one letter dropped (ברזלי of ברזילי)");
}

console.log("\n— second scan: a three-letter word of a listed name left alone —");
{
  ok(scan("לדברי גלר הבקשה נדחתה.", [NAME("נועה גלר")]).includes("גלר"), "a listed three-letter surname (גלר) left alone");
  ok(!scan("לדברי גלר הבקשה נדחתה.").length, "(and not without the list: it is the list that makes it a name)");
}

console.log("\n— second scan: a surname ending on a five-letter word —");
{
  ok(scan("לדברי ברסקי הבקשה נדחתה.").includes("ברסקי"), "ברסקי (‑סקי, five letters)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
