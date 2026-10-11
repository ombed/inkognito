/* Restore and invented names that are also words (the hunt of 11.10, restore.md REAL high). v73.6 stopped picking a pool
   name that is a word for new cases, but a case saved before keeps it, and restore put the client back in place of the
   word: «השופטת דנה בבקשה» became «השופטת בארי בבקשה», «הממצא מלמד על» became «הממצא גולוברג על». A one-word invented
   name went back everywhere, with every prefix and no word check.

   - A one-word invented name that is also a word is never restored by guess: it is listed as left over, to check by hand.
     One that is no word comes back as a part of a name does: not after ה, a short one only after ו, ש, כש.
   - A part of a name that is a word in the pool's own list (WORDISH) is not restored alone either.
   - A title of the other gender («השופטת לוי» for a man's invented name) or another initial («ר' לוי» for «סרגיי לוי») is
     someone else: the surname does not come back there.
   - A short part after ל («לכהן», a verb) is not listed as left over, and a part the answer also uses as a word
     («המזרחי») is still listed where it stands bare. All names are invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const eq = (a, b, m) => ok(a === b, m + " — got «" + a + "», want «" + b + "»");
const leftOf = (r) => r.left.map((l) => l.fake + "×" + l.at.length).join(" | ");

console.log("\n— a one-word invented name that is also a word, from a case saved before v73.6 —");
{
  const r = C.restoreNames("השופטת דנה בבקשה ודחתה אותה. דנה תשהה אצל אביה בחגים.", [["בארי", "דנה"]]);
  eq(r.text, "השופטת דנה בבקשה ודחתה אותה. דנה תשהה אצל אביה בחגים.", "«דנה» is not put back by guess");
  ok(r.left.some((l) => l.fake === "דנה" && l.at.length === 2), "both places are listed to check by hand — left «" + leftOf(r) + "»");
}
for (const [real, fake, text, want] of [
  ["גולוברג", "מלמד", "הממצא מלמד על הקשר בין הצדדים.", "הממצא מלמד על הקשר בין הצדדים."],
  ["קרסנוסקי", "פרץ", "באותו ערב פרץ ויכוח בין הצדדים.", "באותו ערב פרץ ויכוח בין הצדדים."],
  ["יערה", "מירב", "יש לעשות את מירב המאמצים.", "יש לעשות את מירב המאמצים."],
]) eq(C.restoreNames(text, [[real, fake]]).text, want, "«" + fake + "» as a word stays");

console.log("\n— a one-word invented name that is no word comes back as a name does —");
{
  const r = C.restoreNames("אביגיל תשהה אצל אביה, ולאביגיל יש חדר משלה.", [["בארי", "אביגיל"]]);
  eq(r.text, "בארי תשהה אצל אביה, ולבארי יש חדר משלה.", "with and without a prefix");
}

console.log("\n— a part of a name that is a word in the pool's own list —");
{
  const pairs = [["נורית גולוברג", "מיכל מלמד"]];
  eq(C.restoreNames("הממצא מלמד על כך שמיכל מלמד צדקה.", pairs).text, "הממצא מלמד על כך שנורית גולוברג צדקה.", "the whole name comes back, the word stays");
}

console.log("\n— a title or an initial that belongs to someone else —");
{
  const pairs = [["עמנואל אלמגור", "סרגיי לוי"]];
  eq(C.restoreNames("וכב' השופטת לוי קבעה מועד לדיון.", pairs).text, "וכב' השופטת לוי קבעה מועד לדיון.", "a woman's title before a man's invented surname");
  eq(C.restoreNames("כב' השופטת ר' לוי קבעה מועד לדיון.", pairs).text, "כב' השופטת ר' לוי קבעה מועד לדיון.", "another initial before the surname");
  eq(C.restoreNames("מר לוי לא הגיע לדיון.", pairs).text, "מר אלמגור לא הגיע לדיון.", "the matching title still brings the surname back");
  eq(C.restoreNames("ס' לוי לא הגיע לדיון.", pairs).text, "ע' אלמגור לא הגיע לדיון.", "the matching initial with a geresh, as a whole name");
}

console.log("\n— what is listed as left over —");
{
  const r = C.restoreNames("אורי כהן ימשיך לכהן כאפוטרופוס.", [["יואב לוי", "אורי כהן"]]);
  eq(r.text, "יואב לוי ימשיך לכהן כאפוטרופוס.", "the verb «לכהן» stays");
  ok(!r.left.some((l) => l.fake === "כהן"), "and is not listed as a name left over — left «" + leftOf(r) + "»");
  const r2 = C.restoreNames("המזרחי הוא שם של עדה. מזרחי טענה כי הילדים מוזנחים.", [["נורית אלמגור", "אילנה מזרחי"]]);
  ok(r2.left.some((l) => l.fake === "מזרחי" && l.at.length === 1), "a bare part the answer also uses as a word is listed where it stands bare — left «" + leftOf(r2) + "»");
}

console.log("\n— invented names of an earlier document in this session (ux.md, the answer covers two documents) —");
{
  const r = C.restoreNames("סרגיי אלבז לא הגיע, ונועה ברק דיברה.", [["דנה לוי", "נועה ברק"]], ["סרגיי אלבז", "נועה ברק"]);
  eq(r.text, "סרגיי אלבז לא הגיע, ודנה לוי דיברה.", "this document's name comes back, the earlier one does not");
  ok(r.left.some((l) => l.fake === "סרגיי אלבז" && l.real === null && l.earlier) && !r.left.some((l) => l.fake === "נועה ברק"),
    "the earlier one is listed as left over, without a real name — left «" + leftOf(r) + "»");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
