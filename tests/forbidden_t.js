/* An invented name is never a real word of the document, in any of its forms (12.10). The engine forbids every word of
   the document as an invented name, so that a pseudonym is never a real person's name in the same text. It held the
   word as written: «ברקוביץ׳» with its geresh, «וברקוביץ» with its prefix letter. «ברקוביץ» is also a surname in the
   invented pool, so another person in a document with a real «יואב ברקוביץ׳» could be given it: since the secret key
   (v73.13) about once in a hundred keys, which is how the browser test UX #8 caught it. Invented names only. */
const crypto = require("crypto");
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
const forbiddenOf = (text) => new C.Engine([], [], OPT, text).forbidden;

console.log("\n— a word of the document is forbidden in its other forms too —");
{
  const f = forbiddenOf("מר יואב ברקוביץ׳ ענה, והעד וברקוביץ השיב. השופטת נועה קלדרון סיכמה.");
  ok(f.has("ברקוביץ"), "without its geresh («ברקוביץ׳» → «ברקוביץ»)");
  const g = forbiddenOf("העד וברקוביץ השיב.");
  ok(g.has("ברקוביץ"), "without its prefix letter («וברקוביץ» → «ברקוביץ»)");
  ok(!forbiddenOf("הוא אמר כן.").has("מר"), "a short word is not cut: «אמר» does not forbid «מר»");
}

console.log("\n— so no key gives another person that surname —");
{
  const text = "עו״ד רונן אלמליח פתח. מר יואב ברקוביץ׳ ענה. השופטת נועה קלדרון סיכמה.";
  const f = forbiddenOf(text);
  ok(C.POOL.he_s.includes("ברקוביץ"), "(«ברקוביץ» is in the invented surname pool)");
  let hits = 0;
  for (let i = 0; i < 400; i++) {
    C.setAliasKey(crypto.randomBytes(32).toString("hex"));
    for (const v of ["נועה קלדרון", "רונן אלמליח"]) if (/ברקוביץ/.test(C.fakeName(v, null, new Set(), f, new Set()))) hits++;
  }
  C.setAliasKey(null);
  ok(hits === 0, "800 invented names over 400 keys, none «… ברקוביץ»: " + hits);
}

/* A word joined by a hyphen or a maqaf is a word of the document too (the hunt of 1.11). The document held «מרכז-לוד»
   as one token, so «לוד» was free: Jerusalem became «לוד», and the paste-back turned the AI's «מחוזי מרכז-לוד» into
   «מרכז-ירושלים». The same for a person's or company's fake. Every example is invented. */
console.log("\n— a part of a hyphenated word is forbidden —");
{
  const f = forbiddenOf("התיק נדון בבית המשפט המחוזי מרכז-לוד ובבית משפט השלום בתל־אביב, ומבקר מטעם ומרכז-הגליל העיד. העד בן-דוד.");
  for (const w of ["לוד", "מרכז", "אביב", "הגליל"]) ok(f.has(w), "«" + w + "» is forbidden as a part of a hyphenated word");
  let lod = 0, org = 0;
  const g = forbiddenOf("הערעור הוגש למחוזי מרכז-לוד. המשיבה: גפן-אורנים בע\"מ.");
  for (let i = 0; i < 50; i++) {
    C.setAliasKey(crypto.createHash("sha256").update("forb-key-" + i).digest("hex"));
    for (const t of ["ירושלים", "רמלה", "באר שבע", "נתניה", "חיפה"]) if (C.fakePlace(t, new Set(), f) === "לוד") lod++;
    for (const v of ['מרלין השקעות בע"מ', 'טרבלון מערכות בע"מ', "סולמית ושות'"]) if (/אורנים|גפן/.test(C.fakeOrg(v, new Set(), g))) org++;
  }
  C.setAliasKey(null);
  ok(lod === 0, "250 invented towns over 50 keys, none «לוד»: " + lod);
  ok(org === 0, "150 invented companies over 50 keys, none named for a part of «גפן-אורנים»: " + org);
}

/* And the other way: an invented place that is a word of the document with a prefix letter. A real company «רימון
   לוגיסטיקה בע"מ» and an invented street «רחוב הרימון» read as one name to the AI and to the check. Invented examples. */
console.log("\n— an invented place is not a word of the document with a prefix letter —");
{
  const f = forbiddenOf("הספקית רימון לוגיסטיקה בע\"מ, והמחסן שבו. השופטת נעמה רצל.");
  let hits = 0;
  for (let i = 0; i < 50; i++) {
    C.setAliasKey(crypto.createHash("sha256").update("forb2-key-" + i).digest("hex"));
    for (const s of ["רחוב הנחושת 4", "רחוב התעשייה", "רחוב הברזל 12", "רחוב הסדנה"]) if (/הרימון/.test(C.fakePlace(s, new Set(), f))) hits++;
  }
  C.setAliasKey(null);
  ok(hits === 0, "200 invented streets over 50 keys, none «הרימון»: " + hits);
}

/* Nor a word of the document inside a longer word. The final check reads a secret anywhere in the text, so «בנק צאלון»
   failed it in a letter that named a man «אלון» (the hunt of 1.11), and the bar went red. A town «הרצליה» beside a real
   «רחוב הרצל» is the same trap. Invented examples. */
console.log("\n— an invented company or town does not hold a secret of the document inside it —");
{
  /* what the check reads is the secrets, the values replaced, not every word: «הלום» and «הרצל» are secrets here (an
     ordinary word inside a fake is no leak, and removing such fakes ran the pools out: tests/towns_t.js) */
  const f = new C.Engine([{ value: "דניאל הלום", kind: "NAME", replacement: "" }, { value: "רחוב הרצל 5", kind: "PLACE", replacement: "" }], [], OPT,
    "העד דניאל הלום העיד. המשרד ברחוב הרצל 5. השופט רענן כספי.").forbidden;
  let org = 0, town = 0;
  for (let i = 0; i < 50; i++) {
    C.setAliasKey(crypto.createHash("sha256").update("forb3-key-" + i).digest("hex"));
    for (const v of ['מרלין השקעות בע"מ', 'טרבלון מערכות בע"מ', "סולמית ושות'", "בנק הצפון"]) if (/הלום/.test(C.fakeOrg(v, new Set(), f))) org++;
    for (const t of ["תל אביב", "נתניה", "חיפה", "רמת גן", "כפר סבא", "הוד השרון", "רעננה", "פתח תקווה"]) if (/הרצל/.test(C.fakePlace(t, new Set(), f))) town++;
  }
  C.setAliasKey(null);
  ok(org === 0, "200 invented companies over 50 keys, none holding «הלום»: " + org);
  ok(town === 0, "400 invented towns over 50 keys, none holding «הרצל»: " + town);
}
/* Nor a fake one letter away from a word of the document. The paste-back marks such a word as a fake the AI garbled
   (nearOf), so in an agreement that says «הקניין», «שימור» and «נחתם», a fake surname «קנין» left «הקניין» marked in the
   AI's answer, in 13 of 40 keys (the review of 2.11). Invented examples. */
console.log("\n— no fake name one letter away from a word of the document —");
{
  const text = "הקניין במניות יושלם במועד ההשלמה. מענק שימור ישולם לעובדים. ההסכם נחתם בין הצדדים. הקונה ושלומית ברנר, " +
    "יואב קדמי, רינה אפשטיין, אסף מזרחי ונגה טל חתמו. המניות, המחאות, ההתחייבויות והמסמכים נמסרו.";
  const names = ["שלומית ברנר", "יואב קדמי", "רינה אפשטיין", "אסף מזרחי", "נגה טל"];
  // what counts is the paste-back itself: the document's own words, pasted back with this key's pairs, mark nothing
  const words = text.replace(/[^א-ת\s]/g, " ");
  const bad = [];
  for (let i = 0; i < 60; i++) {
    const key = crypto.createHash("sha256").update("near-key-" + i).digest("hex");
    const eng = new C.Engine(names.map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], { ...OPT, aliasKey: key }, text);
    const map = {}; for (const h of eng.detect(text)) if (h.apply) map[h.base || h.text] = String(eng.repFor({ ...h, pre: "" }));
    const prose = words.split(/\s+/).filter((w) => !Object.keys(map).some((r) => r.split(" ").includes(w))).join(" ");
    const r = C.restoreNames(prose, Object.entries(C.restorePairs({}, map)), [], {});
    for (const x of r.left) bad.push(x.fake + "~" + JSON.stringify(map));
  }
  C.setAliasKey(null);
  ok(bad.length === 0, "60 keys: the document's own words, pasted back, mark nothing as a garbled fake: " + bad.length + " " + [...new Set(bad)].slice(0, 3).join(" | ").slice(0, 300));
  /* The rule is a preference, not a ban (the review of 2.11): in a long document it ran the pools out, and people got
     numbered names («תומר 60 גבאי») whose AI forms never came back. Here the document holds a word one letter from every
     name of the Hebrew pools, so every name is near; still no one gets a number. */
  const near1 = (w) => w + "ה";
  const crowd = ["he_f", "he_m", "he_s"].flatMap((k) => C.POOL[k]).map(near1).join(" ");
  const people = ["שרית גולן", "מיכל ברק", "דורית שמש", "יעל נבון", "אבי דגן", "רון אלון", "עידו סער", "גיל רז", "נועה פז", "תמר גל"];
  let numbered = 0, ex2 = "";
  for (let i = 0; i < 20; i++) {
    const key = crypto.createHash("sha256").update("crowd-key-" + i).digest("hex");
    const t = people.join(", ") + ". " + crowd;
    const eng = new C.Engine(people.map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], { ...OPT, aliasKey: key }, t);
    for (const h of eng.detect(t)) if (h.apply) { const f = String(eng.repFor({ ...h, pre: "" })); if (/\d/.test(f)) { numbered++; ex2 = f; } }
  }
  C.setAliasKey(null);
  ok(numbered === 0, "every pool name near a word of the document: still no numbered name, over 20 keys: " + numbered + " " + ex2);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
