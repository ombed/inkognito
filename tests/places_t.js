/* The places screen and the evidence behind a decision.

   Two screens ask the user to decide about a word without showing the word in
   the document: "מי בתיק" shows a chip, the places screen shows a name and a
   box to type the substitute. The tool could offer to replace
   אזור, which is a town south of Tel Aviv and also the ordinary word for an
   area. There was no way to tell which one it was, because nothing on that
   screen comes from the document.

   Worse than the display: the places screen wrote its own scan of the
   settlement list, and did not apply the ambiguity guard the engine applies
   in findPlaces. Continuing from that screen writes a blanket replacement
   rule, so "באזור התעשייה" became "בעילבון התעשייה" — the industrial zone
   turned into a village in the Galilee.

   geoNames is the shared answer to the first: one scan, in the engine, with
   the same guard. examplesOf is the answer to the second: the sentences a
   value actually appears in, in the same shape the check screen already uses.
*/
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— geoNames: a settlement name that is also a word is not offered —");
{
  const t = "עמרי לוי מתגורר בחיפה. הוא עובד באזור התעשייה, וכל האזור סבל מהצפות.";
  const names = C.geoNames(t);
  ok(names.includes("חיפה"), "an unambiguous town is offered");
  ok(!names.includes("אזור"), "אזור is not offered for a distance-preserving swap");
}
{
  // every name on the guard list, in its ordinary sense
  const t = "ברחובות העיר, בשדרות הראשיות, באזור הזה, על הגשר ובעמק — כולם ראו.";
  const names = C.geoNames(t);
  ok(names.length === 0, "ordinary words are not settlements: got " + JSON.stringify(names));
}
{
  const t = "הדיון התקיים בבית שמש, והמשפחה עברה לקרית אונו.";
  const names = C.geoNames(t);
  ok(names.includes("בית שמש") && names.includes("קרית אונו"), "two-word towns still offered");
}
{
  // the guard removes it from that screen only. The engine still raises it,
  // marked for review, so a document about the real town is not lost.
  const hits = C.findPlaces("המשפחה עברה לאזור, ליד חולון.").filter((h) => h.place === "אזור");
  ok(hits.length === 1, "findPlaces still raises the ambiguous town");
  ok(hits.length === 1 && hits[0].review === true, "and marks it for review, not for replacement");
  ok(hits.length === 1 && hits[0].apply === false, "and does not apply it");
}

console.log("\n— examplesOf: the sentences behind a decision —");
{
  const blocks = [
    { part: "word/document.xml", text: "עמרי לוי מתגורר בחיפה מאז 2019." },
    { part: "word/document.xml", text: "לעמרי אין רכב. עמרי מגיע באוטובוס." },
  ];
  const ex = C.examplesOf(blocks, "עמרי", 3);
  ok(ex.length === 3, "three occurrences found across blocks, got " + ex.length);
  ok(ex.every((e) => typeof e.pre === "string" && typeof e.post === "string"), "each carries pre and post");
  ok(ex[0].hit === "עמרי", "the first hit is the bare name");
  ok(ex[1].hit === "לעמרי", "a prefixed form is shown as it appears in the text");
  ok(ex.some((e) => e.pre.includes("מתגורר") || e.post.includes("מתגורר")), "context comes from the document");
}
{
  const blocks = [{ part: "word/document.xml", text: "הוא עובד באזור התעשייה, וכל האזור סבל." }];
  const ex = C.examplesOf(blocks, "אזור", 5);
  ok(ex.length === 2, "both forms of the ambiguous word are shown, got " + ex.length);
  ok(ex.some((e) => e.post.includes("התעשייה")), "the industrial-zone sentence is one of them");
}
{
  const blocks = [{ part: "word/document.xml", text: "אין כאן כלום." }];
  ok(C.examplesOf(blocks, "עמרי", 3).length === 0, "a value that is absent has no examples");
  ok(C.examplesOf(blocks, "", 3).length === 0, "an empty value has no examples");
  ok(C.examplesOf(null, "עמרי", 3).length === 0, "no blocks is not a crash");
}
{
  const blocks = [{ part: "word/document.xml", text: "דנה. דנה. דנה. דנה. דנה." }];
  ok(C.examplesOf(blocks, "דנה", 2).length === 2, "the cap is honoured");
}

console.log("\n— fakePlace: a town gets a town, not a bracketed label —");
{
  // Places were the one kind with no substitute generator. A name became
  // "מיכל ברנע"; a town became "[יישוב א׳]" — a label sitting inside the
  // sentence, breaking the reading and announcing that something was hidden.
  // The only source of a real town name was the places screen, so everything
  // it did not offer fell through to the label.
  const a = C.fakePlace("לוד", new Set(), new Set());
  ok(typeof a === "string" && a.length > 1, "a substitute is produced");
  ok(!/^\[/.test(a), "it is not a bracketed label: " + a);
  ok(a !== "לוד", "and not the town itself");

  ok(C.fakePlace("לוד", new Set(), new Set()) === a, "the same town gives the same substitute every run");
  ok(C.fakePlace("חיפה", new Set(), new Set()) !== a, "a different town gives a different one");
}
{
  // a substitute must not be a word the document already uses, or the reader
  // cannot tell the replacement from the original text
  const forbidden = new Set(["שמש", "בית"]);
  const v = C.fakePlace("לוד", new Set(), forbidden);
  ok(v !== "בית שמש", "a two-word town is rejected when either word is in the document");
  ok(!"בית שמש".split(" ").some((w) => v.includes(w)) || v.split(" ").every((w) => !forbidden.has(w)),
    "no word of the substitute appears in the document: " + v);
}
{
  const used = new Set();
  const seen = [];
  for (const town of ["לוד", "חיפה", "ערד", "יבנה", "נשר"]) {
    const v = C.fakePlace(town, used, new Set());
    ok(!used.has(v), "a substitute already taken is not handed out twice: " + v);
    used.add(v); seen.push(v);
  }
  ok(new Set(seen).size === seen.length, "five towns get five distinct substitutes");
}

console.log("\n— a street stays a street: the head word in the value is kept, the name comes from the street pool —");
{
  /* The model's place span often holds the street word itself («רחוב הנביאים 22»), not only the name after it.
     placeKind looked only at the text before the span, found nothing, and fakePlace gave a town: «מרחוב משה שרת 94»
     went out as «מערד 94», and «רחוב הנביאים 22» as «מנצרת» with the house number gone (the hunt of 1.11).
     Every example is invented. */
  const crypto = require("crypto");
  const KEYS = Array.from({ length: 50 }, (_, i) => crypto.createHash("sha256").update("street-key-" + i).digest("hex"));
  const isTown = (w) => !!C.PLACE_BY[w] || C.PLACES.some((p) => p.n === w);
  const cases = [
    ["רחוב הנחושת", /^רחוב (\S.*)$/],
    ["רחוב הנביאים 22", /^רחוב (\S.*?) 22$/],
    ["רחוב משה שרת 94", /^רחוב (\S.*?) 94$/],
    ["רח' ביאליק 31א", /^רח' (\S.*?) 31א$/],
    ["שדרות התאנים 7", /^שדרות (\S.*?) 7$/],
    ["שד' הגבורה", /^שד' (\S.*)$/],
    ["דרך השלום 120", /^דרך (\S.*?) 120$/],
    ["ברחוב הנביאים 22", /^ברחוב (\S.*?) 22$/],
    ["מרחוב משה שרת 94", /^מרחוב (\S.*?) 94$/],
    ["ורחוב הזמיר", /^ורחוב (\S.*)$/],
    ["שכונת הפרחים", /^שכונת (\S.*)$/],
  ];
  const bad = [];
  for (const key of KEYS) {
    C.setAliasKey(key);
    for (const [v, rx] of cases) {
      const f = C.fakePlace(v, new Set(), new Set());
      const m = rx.exec(f || "");
      if (!m) { bad.push(v + " → " + f); continue; }
      if (isTown(m[1]) || m[1].split(" ").every((w) => v.split(/\s+/).includes(w))) bad.push(v + " → " + f + " (name «" + m[1] + "»)");
    }
    // the number and street only: a town after a comma gets a town, never the real one
    const t = C.fakePlace("רחוב הנביאים 22, הרצליה", new Set(), new Set());
    if (!/^רחוב \S.*? 22, \S/.test(t || "") || /הרצליה|הנביאים/.test(t)) bad.push("with town → " + t);
    // a town is still a town, also one whose name is a head word (שדרות) or starts like one
    for (const town of ["הרצליה", "שדרות", "רחובות"]) {
      const g = C.fakePlace(town, new Set(), new Set());
      if (!g || /^(?:רחוב|רח'|שדרות|שד'|דרך|שכונת)\s/.test(g) || !isTown(g) || g === town) bad.push(town + " → " + g);
    }
  }
  C.setAliasKey(null);
  ok(bad.length === 0, "streets keep their head and number, towns stay towns, over 50 keys: " + bad.slice(0, 6).join(" | "));
}

console.log("\n— the ambiguous list holds only names that really are something else —");
{
  /* A row said לוד — "also an ordinary word", but Lod is a city name and
     nothing else, not remotely like אזור. Fourteen
     entries were like that: real town names sitting in a list whose stated
     criterion is settlement names that are also ordinary Hebrew words. They
     cost those towns their place in the distance-preserving map and put a
     false note beside them on screen. A short name is still held for review by
     the length rule in findPlaces, so nothing here needed them. */
  const pureTowns = ["לוד", "ערד", "מטולה", "עתלית", "מגידו", "ענתות", "כורזים",
    "דבוריה", "עילבון", "פרדסיה", "דגניה", "ראמה", "טמרה", "נחף"];
  for (const t of pureTowns) {
    const found = C.placesFound("המשפחה עברה ל" + t + " בשנה שעברה.").find((x) => x.name === t);
    ok(found, t + " is still recognised as a settlement");
    ok(found && found.ambiguous === false, t + " is not marked as anything but a town");
  }
  // ראש, עמק and כפר stay on the list for a different reason: they are the head
  // words of two-word towns, not settlements in their own right, so they are
  // not checked here.
  for (const w of ["אזור", "גשר", "קדימה", "רחובות", "נשר", "טירה"]) {
    const found = C.placesFound("הם היו ב" + w + " אתמול.").find((x) => x.name === w);
    ok(found && found.ambiguous === true, w + " is genuinely also an ordinary word");
  }
  const names = C.geoNames("המשפחה עברה מלוד לערד, ומשם למטולה ולחיפה.");
  for (const t of ["לוד", "ערד", "מטולה"]) ok(names.includes(t), t + " can be mapped with distances again");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
