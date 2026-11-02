/* Towns in every usual written form, and words that are only sometimes towns (the hunt of 11.10).

   Two failures of the places layer, one in each direction. A known town written in another usual
   spelling of itself was not found at all: «בתל-אביב», «בבאר-שבע», «בתל־אביב» with a Hebrew maqaf, every
   official «קריית X», «פתח תקוה», «זיכרון יעקב», «אום אל פחם». The places screen was empty, the bar green,
   and the town reached the AI. A name of several parts lost only its head: «מודיעין-מכבים-רעות» went out
   as «מעלה אדומים-מכבים-רעות», and the tail still named the city.
   The other way: a town whose name is also an everyday word, an inflection, a phrase of the case law or a
   first name was replaced on its own. «אני חוששת לשלומי» went out as «אני חוששת לראש העין» in a
   protection-order request, «ההליך תקוע» as «ההליך ניצנה», «הקטינה ישנה בחדרה» (her room) as a city,
   «המבקשת ערערה» (she appealed) as a village. Such a town is now replaced only with place context, and
   otherwise asked, as the ambiguous names are, and it is never chosen as a substitute: the product's rule
   holds both ways, a town that is replaced is a town.

   Every example is invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the tool's own defaults: every detector marked on, places on
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n));
const OPT = { on: ON, flag: FLAG, mode: "real", near: false, body: false, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const cities = (t) => C.findPlaces(t).filter((h) => h.type === "PLACE_CITY");

/* The places screen as the page fills it (index.html toPlaces, then geoApply with nothing touched):
   the distance map for the towns it may swap, a row for every other town found, a row that is also an
   ordinary word comes switched off. Then the engine runs over the text with those rules, as the page does. */
function screen(text) {
  const all = C.geoNames(text), every = C.placesFound(text);
  const avoid = new Set([...all, ...every.map((p) => p.name)]);
  const forbid = new Set(C.norm(text).match(/[א-ת][א-ת'"׳״]*/g) || []);
  const geo = all.length >= 2 ? C.geoMap(all, 0, avoid, forbid) : null;
  const rules = [], rows = [];
  if (geo) for (const m of geo.map) { rules.push({ value: m.from, kind: "PLACE", replacement: m.to }); rows.push({ name: m.from, on: true }); }
  const inMap = new Set((geo ? geo.map : []).map((m) => m.from)), used = new Set((geo ? geo.map : []).map((m) => m.to));
  for (const p of every) {
    if (inMap.has(p.name)) continue;
    const to = C.fakePlace(p.name, used, forbid) || ""; if (to) used.add(to);
    const on = !p.ambiguous && !!to;
    rows.push({ name: p.name, on });
    if (on) rules.push({ value: p.name, kind: "PLACE", replacement: to });
  }
  return { rules, rows };
}
function sent(text) {
  const { rules, rows } = screen(text);
  const eng = new C.Engine(rules, [], OPT, text);
  const hits = eng.detect(text);
  let out = text;
  for (const h of hits.filter((x) => x.apply).sort((a, b) => b.s - a.s)) out = out.slice(0, h.s) + eng.repFor(h) + out.slice(h.e);
  return { out, rows, hits };
}
const words = (s) => s.split(/[\s־-]+/).filter(Boolean);

console.log("\n— found and replaced whole: a known town in every usual spelling —");
for (const [x, want] of [
  // a hyphen or a Hebrew maqaf where the list has a space, and spaces around a hyphen
  ["תל-אביב", "תל אביב"], ["תל־אביב", "תל אביב"], ["תל - אביב", "תל אביב"], ["תל  אביב", "תל אביב"],
  ["באר-שבע", "באר שבע"], ["פתח-תקווה", "פתח תקווה"], ["ראשון-לציון", "ראשון לציון"], ["בית-שמש", "בית שמש"],
  ["רמת-גן", "רמת גן"], ["כפר-סבא", "כפר סבא"], ["הוד-השרון", "הוד השרון"], ["בני-ברק", "בני ברק"], ["גבעת-שמואל", "גבעת שמואל"],
  ["קרית-אתא", "קרית אתא"], ["קריית־ביאליק", "קרית ביאליק"],
  // the official full spelling, and the short one
  ["קריית אתא", "קרית אתא"], ["קריית ביאליק", "קרית ביאליק"], ["קריית מוצקין", "קרית מוצקין"], ["קריית ים", "קרית ים"],
  ["קריית שמונה", "קרית שמונה"], ["קריית גת", "קרית גת"], ["קריית מלאכי", "קרית מלאכי"], ["קריית אונו", "קרית אונו"],
  ["קריית טבעון", "קרית טבעון"], ["קריית ארבע", "קרית ארבע"], ["קריית ענבים", "קרית ענבים"], ["קריית יערים", "קרית יערים"],
  ["קריית עקרון", "קרית עקרון"], ["פתח תקוה", "פתח תקווה"], ["פתח-תקוה", "פתח תקווה"], ["גני תקוה", "גני תקווה"],
  ["זיכרון יעקב", "זכרון יעקב"], ["זכרון-יעקב", "זכרון יעקב"], ["נווה צוף", "נוה צוף"],
  ["אום אל פחם", "אום אל-פחם"], ["אום-אל-פחם", "אום אל-פחם"], ["אום אל־פחם", "אום אל-פחם"], ["דאלית אל כרמל", "דאלית אל-כרמל"],
  // a name of several parts is one name, never its head with a tail left after it
  ["מודיעין-מכבים-רעות", "מודיעין-מכבים-רעות"], ["מודיעין מכבים רעות", "מודיעין-מכבים-רעות"],
  ["תל אביב-יפו", "תל אביב - יפו"], ["תל-אביב-יפו", "תל אביב - יפו"], ["תל אביב - יפו", "תל אביב - יפו"], ["תל אביב יפו", "תל אביב - יפו"],
  ["מעלות-תרשיחא", "מעלות-תרשיחא"], ["מעלות תרשיחא", "מעלות-תרשיחא"], ["יהוד-מונוסון", "יהוד-מונוסון"], ["פרדס חנה-כרכור", "פרדס חנה-כרכור"],
  ["מודיעין עילית", "מודיעין עילית"], ["נצרת עילית", "נוף הגליל"],
  // other spellings in common use
  ["נהרייה", "נהריה"], ["הרצלייה", "הרצליה"], ["יוקנעם", "יקנעם"], ["יוקנעם עילית", "יקנעם עילית"], ["סכנין", "סח'נין"],
  ["סחנין", "סח'נין"], ["עספיא", "עוספיא"], ["מגאר", "מג'אר"], ["כסיפה", "כסייפה"], ["דלית אל כרמל", "דאלית אל-כרמל"],
  ["דליית אל-כרמל", "דאלית אל-כרמל"], ["טירת הכרמל", "טירת כרמל"],
]) {
  const t = "המבקשת מתגוררת ב" + x + " עם ילדיה.";
  const h = cities(t);
  ok(h.length === 1 && h[0].text === x && h[0].place === want && h[0].apply,
    "«" + t + "» — found «" + h.map((y) => y.text + "=" + y.place + (y.apply ? "" : " (asked)")).join(" | ") + "», want «" + x + "=" + want + "», replaced");
  const names = C.placesFound(t).map((p) => p.name);
  ok(names.length === 1 && names[0] === want, "«" + t + "» — the places screen lists " + JSON.stringify(names) + ", want [" + want + "]");
  const { out } = sent(t);
  const left = words(x).filter((w) => w.length > 2 && out.includes(w));
  ok(!left.length, "«" + t + "» — went out as «" + out + "»: «" + left.join(" ") + "» is left");
}

console.log("\n— after a school or a hospital, the town in any spelling is the town, not the institution's name —");
for (const [t, x] of [
  ["בית הספר נמצא בתל-אביב.", "תל-אביב"], ["בית הספר בתל-אביב.", "תל-אביב"], ["בית הספר בתל אביב.", "תל אביב"],
  ["בית הספר נמצא בקריית ביאליק.", "קריית ביאליק"], ["בית החולים בנהרייה.", "נהרייה"], ["הוא לומד בתיכון בראשון־לציון.", "ראשון־לציון"],
]) {
  const { out, hits } = sent(t);
  // the places screen's rule takes the prefix letter with it; the places layer leaves it in the text
  const town = hits.find((h) => h.text === x || h.text === "ב" + x);
  ok(town && town.apply, "«" + t + "» — «" + x + "» " + (town ? "only asked" : "swallowed by «" + hits.map((h) => h.text).join(" | ") + "»"));
  ok(!words(x).some((w) => w.length > 2 && out.includes(w)), "«" + t + "» — went out as «" + out + "»");
}

console.log("\n— every «קרית X» in its official «קריית X» spelling, and every name of two words with a hyphen or a maqaf —");
{
  const gaz = C.GAZ || ["קרית יערים", "קרית נטפים", "קרית עקרון", "קרית שלמה"];
  const qiryat = [...C.PLACES.map((p) => p.n), ...gaz].filter((n) => /^קרית /.test(n));
  ok(qiryat.length >= 15, "the lists hold at least fifteen «קרית» towns: " + qiryat.length);
  for (const n of qiryat) {
    const x = n.replace(/^קרית /, "קריית "), h = cities("הוא עבר לגור ב" + x + " בשנה שעברה.");
    ok(h.length === 1 && h[0].text === x && h[0].place === n && h[0].apply, "«ב" + x + "» — found " + JSON.stringify(h.map((y) => y.text + "=" + y.place)));
  }
  for (const p of C.PLACES.filter((q) => /^[^\s-]+ [^\s-]+$/.test(q.n))) {
    for (const sep of ["-", "־"]) {
      const x = p.n.replace(" ", sep), h = cities("הוא עבר לגור ב" + x + " בשנה שעברה.");
      ok(h.length === 1 && h[0].text === x && h[0].place === p.n, "«ב" + x + "» — found " + JSON.stringify(h.map((y) => y.text + "=" + y.place)));
    }
  }
}

console.log("\n— left alone: phrases the other spellings must not reach —");
for (const t of [
  // a hyphenated name whose parts, with a space, are words: only with the hyphen is it the village
  "הוא הגיע אלי עד הבית.", "פנתה טל אל המשטרה בעצמה.",
  // the spelling folds are for whole words of a town's name, not for the words alone
  "נחתם זכרון דברים בין הצדדים.", "נחתם זיכרון דברים בין הצדדים.", "בקריית הממשלה התקיים הדיון.", "יש תקוה גדולה לשיקום.",
  "נווה מדבר של שקט ומנוחה.", "הילד לומד בבית-ספר קרוב.", "ההורים הגיעו לבית-משפט אחר.",
  // a town in an adjective or a longer word is not the town
  "הוא תל-אביבי מלידה.", "המבטא הירושלמי שלה בולט.",
]) {
  const h = cities(t).filter((x) => x.apply);
  ok(!h.length, "«" + t + "» — nothing replaced, got «" + h.map((x) => x.text + "=" + x.place).join(" | ") + "»");
}

console.log("\n— a doubled yod or vav is the full spelling of the same letter —");
// the review of the first round: only four stems were folded, and these went out as they were
for (const [x, want] of [
  ["נתנייה", "נתניה"], ["ירושליים", "ירושלים"], ["גבעתים", "גבעתיים"], ["טיבה", "טייבה"], ["באקה אל גרבייה", "באקה אל-גרביה"],
  ["ג'לג'ולייה", "ג'לג'וליה"], ["לקייה", "לקיה"], ["דבורייה", "דבוריה"], ["נהרייה", "נהריה"], ["הרצלייה", "הרצליה"],
  ["כסיפה", "כסייפה"], ["דליית אל-כרמל", "דאלית אל-כרמל"], ["דייר חנא", "דיר חנא"], ["דייר אל-אסד", "דיר אל-אסד"],
  // a slash between the parts of one name
  ["תל אביב/יפו", "תל אביב - יפו"], ["פרדס חנה/כרכור", "פרדס חנה-כרכור"],
]) {
  const t = "המבקשת מתגוררת ב" + x + " עם ילדיה.", h = cities(t);
  ok(h.length === 1 && h[0].text === x && h[0].place === want && h[0].apply, "«" + t + "» — found " + JSON.stringify(h.map((y) => y.text + "=" + y.place + (y.apply ? "" : " (asked)"))) + ", want «" + want + "»");
  const { out } = sent(t);
  ok(!words(x).some((w) => w.length > 2 && out.includes(w)), "«" + t + "» — went out as «" + out + "»");
}
{
  // generated, not typed (lens 10): every gazetteer name that is a coordinates town in another doubling is that town,
  // one row and one substitute; «דייר חנא» and «דיר חנא» were two
  const key = (s) => C.norm(s).replace(/\u0000/g, "").trim().split(/[ \t]*[-/][ \t]*|[ \t]+/).filter(Boolean).map((w) => w.replace(/(?<=.)([יו])\1(?=.)/g, "$1")).join(" ");
  const twin = new Map(C.PLACES.map((p) => [key(p.n), p.n]));
  const pairs = C.GAZ.filter((g) => twin.has(key(g)) && twin.get(key(g)) !== g).map((g) => [g, twin.get(key(g))]);
  ok(pairs.length >= 3, "gazetteer names that are coordinates towns in another doubling: " + JSON.stringify(pairs));
  for (const [g, p] of pairs) {
    const names = C.placesFound("הוא עבר לגור ב" + g + " בשנה שעברה.").map((r) => r.name);
    ok(names.length === 1 && names[0] === p, "«" + g + "» is «" + p + "»: the places screen lists " + JSON.stringify(names));
  }
}
for (const t of [
  // only a doubling: a single vav or yod is never added or dropped, and a doubled first name or verb is no town
  "הוא סגר את החלון בחדר.", "איילת סיפרה כי הקטינים מפחדים.", "דלייה ציירה ציור לאמה.", "הבית ייבנה בקרוב.", "הגשם מייתר את ההשקיה.",
  // a slash between two towns is two towns
]) {
  const h = cities(t).filter((x) => x.apply || x.review);
  ok(!h.length, "«" + t + "» — read as a town: " + JSON.stringify(h.map((x) => x.text + "=" + x.place)));
}
{
  const h = cities("הנסיעה חיפה/עכו נמשכת שעה.").map((x) => x.place);
  ok(h.includes("חיפה") && h.includes("עכו") && h.length === 2, "«חיפה/עכו» is two towns: " + JSON.stringify(h));
}

/* Every town on the list of towns that are also words, with the evidence for it: an ordinary sentence
   where the word is not the town (it must stay, asked), and a real mention (it must be replaced). */
const WORDS = {
  "שלומי": ["אני חוששת לשלומי ולשלום ילדיי, ולכן אבקש צו הגנה.", "המבקשת, תושבת שלומי, הגישה בקשה."],
  "תקוע": ["ההליך תקוע מזה חודשים, והצדדים לא נפגשו.", "המשפחה התגוררה בעבר בתקוע."],
  "אופקים": ["הקטין זקוק להרחבת אופקים ולמסגרת לימודית תומכת.", "המבקשת גרה באופקים עם ילדיה."],
  "רעננה": ["העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה.", "המשפחה עברה לרעננה בקיץ."],
  "מודיעין": ["חומר מודיעין שהוצג למשטרה לא הועבר לבית המשפט.", "הדירה נמצאת באזור מודיעין."],
  "חדרה": ["הקטינה ישנה בחדרה ולא יוצאת ממנו.", "הדיון נקבע בבית משפט השלום בחדרה."],
  "ערערה": ["המבקשת ערערה על ההחלטה.", "המשיב מתגורר בערערה מאז 2019."],
  "נתיבות": ["הגישור פתח לצדדים נתיבות חדשות.", "הם עברו לנתיבות לפני שנה."],
  "נחלים": ["בטיול הלכו לאורך נחלים ומעיינות.", "המשפחה גרה במושב נחלים."],
  "רכסים": ["מהחלון נראים רכסים ועמקים.", "הם גרים ברכסים עם הסבים."],
  "להבים": ["נמצאה סכין עם שני להבים.", "המשפחה עברה לגור בלהבים."],
  // two-word names that are phrases of the case law: the cornerstone, and the judge's eye
  "ראש פינה": ["עקרון טובת הילד היה לראש פינה בפסיקה.", "המשפחה עברה לראש פינה."],
  "עין השופט": ["הפרט הזה לא נעלם מעין השופט.", "המשפחה גרה בקיבוץ עין השופט."],
  "שוהם": ["שוהם בן שבע ולומד בכיתה ב'.", "המועצה המקומית שוהם הנפיקה את האישור."],
  "אילת": ["אילת מסרה כי לא תגיע לדיון.", "המבקשת גרה באילת עם בתה."],
  "אלעד": ["המשמורת עברה לאלעד לפני שנה.", "המבקש גר באלעד."],
  "עמנואל": ["עמנואל טען שלא ידע על הדיון.", "המבקשת נולדה בעמנואל."],
  "אלקנה": ["אלקנה הגיע לדיון באיחור.", "המבקש, תושב אלקנה, לא התייצב."],
  "אבשלום": ["אבשלום, אחיה של המבקשת, העיד.", "הם התגוררו באבשלום שנתיים."],
  "עמיעד": ["עמיעד ביקש דחייה של הדיון.", "המשפחה גרה בעמיעד."],
  "צופית": ["צופית, העובדת הסוציאלית, דיווחה על הביקור.", "הקטינים גדלו בצופית."],
};

console.log("\n— a word that is also a town: asked, never replaced on its own —");
for (const [w, [plain]] of Object.entries(WORDS)) {
  const h = cities(plain).filter((x) => x.place === w);
  ok(h.length === 1 && !h[0].apply && h[0].review, "«" + plain + "» — «" + w + "» " + (h.length ? (h[0].apply ? "is replaced" : "asked") : "not raised at all") + ", want asked");
  const row = C.placesFound(plain).find((p) => p.name === w);
  ok(row && row.ambiguous === true, "«" + plain + "» — the places screen offers «" + w + "» " + (row ? (row.ambiguous ? "off, as not only a town" : "on, as a town") : "nowhere"));
  ok(!C.geoNames(plain).includes(w), "«" + plain + "» — «" + w + "» is not put in the distance map");
  const { out } = sent(plain);
  ok(out === plain, "«" + plain + "» — went out as «" + out + "»");
}
for (const t of [
  // a first name: after «העיר» (he remarked) or «עבר ל» (passed to), the word is the person
  "העיר שלומי כי ההסדר אינו עובד.", "המשמורת עברה לעמנואל בהסכמה.",
  // a verb that is a residence verb, then a new clause: her room, not the city
  "הקטינה גרה אצל אמה וישנה בחדרה.",
  // «עוברים» is going through a hard time, three words away
  "אנחנו עוברים תקופה קשה ואני חוששת לשלומי.",
  // another town in the same sentence, but not next to it
  "הגישה רעננה, בחיפה ובתל אביב כאחד.", "בחיפה הבינו שההליך תקוע.",
  // a court nearby, but the word is not where the court sits
  "בית המשפט התחשב בשלומי ובשלום ילדיי.",
  // a number after it that is a case number, not a zip code
  "המבקשת ערערה 12345-06-24 נדחה.",
]) {
  const h = cities(t).filter((x) => [...Object.keys(WORDS)].includes(x.place) && x.apply);
  ok(!h.length, "«" + t + "» — replaced as a town: «" + h.map((x) => x.text).join(" | ") + "»");
}

console.log("\n— the same word where the text says it is a place: replaced —");
for (const [w, [, real]] of Object.entries(WORDS)) {
  const h = cities(real).filter((x) => x.place === w);
  ok(h.length === 1 && h[0].apply, "«" + real + "» — «" + w + "» " + (h.length ? (h[0].apply ? "replaced" : "only asked") : "not found") + ", want replaced");
  const { out } = sent(real);
  ok(!out.includes(w), "«" + real + "» — went out as «" + out + "»");
}
for (const [t, w] of [
  // each kind of evidence on its own
  ["המבקשת מתגוררת עם ילדיה בשלומי.", "שלומי"], ["נולדה בחדרה וגדלה בה.", "חדרה"], ["התיישבו בנחלים לפני עשור.", "נחלים"],
  ["עקרו מאופקים בשנה שעברה.", "אופקים"], ["תושבת רעננה.", "רעננה"], ["בעיר אלעד אין סניף.", "אלעד"], ["העיר רעננה אישרה את התוכנית.", "רעננה"],
  ["היישוב תקוע.", "תקוע"], ["עיריית אילת הודיעה.", "אילת"], ["משטרת אילת חקרה.", "אילת"],
  ["בבית המשפט לענייני משפחה ברעננה", "רעננה"], ["בבית הדין הרבני האזורי בחדרה", "חדרה"], ["לשכת הרווחה באופקים", "אופקים"],
  ["תחנת המשטרה בשוהם", "שוהם"], ["נפגשו בבית הספר \"אלונים\" בחדרה.", "חדרה"], ["בית החולים בחדרה", "חדרה"],
  ["ברחוב הנרקיס 9 ברעננה", "רעננה"], ["הנרקיס 9, רעננה", "רעננה"], ["רעננה 4310001", "רעננה"], ["יישוב: שוהם", "שוהם"],
  ["מקום מגורים: אופקים", "אופקים"], ["באזור רעננה", "רעננה"], ["מצפון לרעננה", "רעננה"],
  ["עברו מחיפה לרעננה.", "רעננה"], ["בין רעננה לכפר סבא", "רעננה"], ["בחיפה ובחדרה", "חדרה"], ["תל אביב-אילת", "אילת"],
]) {
  const h = cities(t).filter((x) => x.place === w);
  ok(h.length === 1 && h[0].apply, "«" + t + "» — «" + w + "» " + (h.length ? (h[0].apply ? "replaced" : "only asked") : "not found") + ", want replaced");
}

/* The review of the first round: 22 of 33 usual real mentions were only asked about, under an orange bar that
   does not block — a party heading, «ילידת חדרה», a court name without ב-, the case line, the home, the work,
   the school. Each kind of evidence below has its own sentence, and its counterexamples follow. */
const decided = (t, w) => cities(t).filter((x) => x.place === w);
console.log("\n— real mentions in the usual legal phrasing: replaced —");
for (const [t, w] of [
  ["פלונית אלמונית, ת\"ז 012345678, מרעננה", "רעננה"], ["פלונית אלמונית, ת\"ז 012345678, מרח' הנרקיס 9 רעננה", "רעננה"],
  ["פלונית אלמונית, ת\"ז 012345678, הנרקיס 9 רעננה", "רעננה"], ["פלונית אלמונית, ת\"ז 012345678, רחוב הנרקיס 9, רעננה", "רעננה"],
  ["המבקשת, ילידת חדרה, נשואה למשיב משנת 2010.", "חדרה"], ["המשיב, יליד אילת, עובד כמהנדס.", "אילת"],
  ["המבקשת, מאילת, הגישה את התביעה.", "אילת"], ["הדירה ברעננה רשומה על שם שני הצדדים.", "רעננה"],
  ["בני הזוג רכשו דירה במודיעין בשנת 2015.", "מודיעין"], ["הבית בשוהם נמכר בשנת 2020.", "שוהם"],
  ["המשיב עובד ברעננה כמנהל חשבונות.", "רעננה"], ["הקטינים לומדים בבית ספר יסודי באלעד.", "אלעד"],
  ["הקטינים לומדים באלעד.", "אלעד"], ["המבקשת עזבה את רעננה בשנת 2021.", "רעננה"],
  ["המשפחה עברה מנתיבות לבאר שבע.", "נתיבות"], ["הסדרי השהות יתקיימו במודיעין.", "מודיעין"],
  ["חילופי הקטינים ייעשו בתחנת הדלק בכניסה לרעננה.", "רעננה"], ["בית משפט השלום חדרה", "חדרה"],
  ["בית המשפט לענייני משפחה רעננה", "רעננה"], ["בבית המשפט לענייני משפחה בחדרה", "חדרה"],
  ["תמ\"ש 12345-06-24 (משפחה חדרה)", "חדרה"], ["לשכת הרווחה של עיריית אופקים", "אופקים"],
  ["המחלקה לשירותים חברתיים באופקים", "אופקים"], ["הצדדים גרו בחדרה ובחיפה.", "חדרה"],
  ["הצדדים גרו בחיפה, בחדרה ובנתניה.", "חדרה"], ["המשיב נוסע בין רעננה לתל אביב מדי יום.", "רעננה"],
  ["המשפחה מתגוררת בשוהם מאז 2012.", "שוהם"], ["הבית באלקנה נמכר.", "אלקנה"], ["המבקשת גרה בצופית.", "צופית"],
  // one more sentence for each new kind of evidence
  ["ילידי רעננה מקבלים הנחה בארנונה.", "רעננה"], ["המשיב, מנתיבות, לא התייצב לדיון.", "נתיבות"],
  ["לשכת הרווחה אופקים", "אופקים"], ["ת\"א 1234-05-24 (שלום אילת)", "אילת"], ["הגפן 12 נתיבות.", "נתיבות"],
  ["דירתם בחדרה נמכרה בשנה שעברה.", "חדרה"], ["היא מועסקת באופקים כגננת.", "אופקים"],
  ["הצדדים נפגשו בנתיבות לפני הדיון.", "נתיבות"], ["הם עזבו את נתיבות בשנה שעברה.", "נתיבות"],
  ["המבקש חזר לנתיבות לאחר הגירושין.", "נתיבות"], ["המשפחה עברה למודיעין לפני שנתיים.", "מודיעין"],
  ["ביציאה מנתיבות יש מחסום.", "נתיבות"],
]) {
  const h = decided(t, w);
  ok(h.length === 1 && h[0].apply, "«" + t + "» — «" + w + "» " + (h.length ? (h[0].apply ? "replaced" : "only asked") : "not found") + ", want replaced");
}

console.log("\n— counterexamples: where the same frames hold the word, it stays asked —");
for (const [t, w] of [
  // a clause reference, a page or a floor with a prefix letter, before a comma, is no address
  ["כאמור בסעיף 4, ערערה המבקשת על ההחלטה.", "ערערה"], ["כאמור בסע' 4, ערערה המבקשת על ההחלטה.", "ערערה"],
  ["לפי ס' 7, ערערה המבקשת על ההחלטה.", "ערערה"], ["כמפורט בפסקה 12, ערערה המבקשת על ההחלטה.", "ערערה"],
  ["כמפורט בנספח 3, ערערה המבקשת על ההחלטה.", "ערערה"], ["בקומה 2, חדרה של הקטינה צמוד לחדר ההורים.", "חדרה"],
  ["בעמוד 5, נתיבות הפעולה מפורטות בהרחבה.", "נתיבות"], ["כאמור בסעיף 4, אלעד לא שילם מזונות.", "אלעד"],
  ["בגיל 3, אלעד החל ללמוד בגן.", "אלעד"],
  // her room and an intelligence unit, after moving, sitting, studying, working and nearness
  ["לאחר הוויכוח הקטינה עברה לחדרה ונעלה את הדלת.", "חדרה"], ["החומר הועבר למודיעין המשטרתי לבדיקה.", "מודיעין"],
  ["המידע הועבר למודיעין של המשטרה.", "מודיעין"], ["הקטינה נסעה עם אביה ויצאה מחדרה רק בערב.", "חדרה"],
  ["הקטינה התיישבה בחדרה ובכתה.", "חדרה"], ["הקטין שוכן בחדרה של אחותו מאז הגירושין.", "חדרה"],
  ["המידע נאסף במרכז מודיעין משטרתי.", "מודיעין"], ["חדר השינה של האב נמצא בסמוך לחדרה של הקטינה.", "חדרה"],
  ["המיטה של האח ממוקמת סמוך לחדרה.", "חדרה"], ["הקטינה נמצאת בבית בחדרה.", "חדרה"],
  ["הקטינה לומדת בחדרה כל ערב.", "חדרה"], ["הפגישה עם העובדת הסוציאלית התקיימה בחדרה.", "חדרה"],
  ["הוא עובד במודיעין כבר שנתיים.", "מודיעין"], ["הקטינה חזרה לחדרה ונרדמה.", "חדרה"],
  ["היא עזבה את חדרה בבהלה.", "חדרה"], ["בכניסה לחדרה שלה תלויה תמונה.", "חדרה"],
  // the settling of a dispute, a verb or an adjective after a court, a first name after a court or a leave
  ["הליך היישוב תקוע מזה חודשים.", "תקוע"], ["ניסיון היישוב תקוע, והצדדים לא נפגשו.", "תקוע"],
  ["בבית המשפט המחוזי ערערה המבקשת על ההחלטה.", "ערערה"], ["התיק בבית משפט השלום תקוע מזה חודשים.", "תקוע"],
  ["בבית המשפט לענייני משפחה אלעד טען שלא ידע.", "אלעד"], ["המבקשת עזבה את אלעד לפני שנה.", "אלעד"],
  // a noun and its adjective, «restrained» between commas, an amount, a first name next to a town
  ["האם עובדת בחיפה ואופקים חדשים נפתחו בפניה.", "אופקים"], ["נסעה לתל אביב ולהבים חדים לא הייתה גישה.", "להבים"],
  ["היא מחפשת אופקים חדשים.", "אופקים"], ["הצדדים, מאופקים, ישבו בשקט.", "אופקים"],
  ["שילמה אילת 12345 ש\"ח בחודש מרץ.", "אילת"], ["בחיפה ואלעד נשאר בבית עם הילדים.", "אלעד"],
  ["הקטינה ביקשה לשבת בקרבת אלעד.", "אלעד"],
]) {
  const h = decided(t, w);
  ok(h.length === 1 && !h[0].apply && h[0].review, "«" + t + "» — «" + w + "» " + (h.length ? (h[0].apply ? "replaced as a town" : "asked") : "not raised at all") + ", want asked");
}

console.log("\n— still asked: a reader cannot tell from the sentence either —");
// «restrained» or «from Ofakim»; back to Hadera or to her room; recognised Ayelet or met in Eilat; to Ayelet
for (const [t, w] of [["שני הצדדים מאופקים.", "אופקים"], ["המבקשת חזרה לחדרה לאחר הפרידה.", "חדרה"],
  ["הצדדים הכירו באילת בשנת 2008.", "אילת"], ["המבקשת הגיעה לאילת עם הילדים.", "אילת"]]) {
  const h = decided(t, w);
  ok(h.length === 1 && !h[0].apply && h[0].review, "«" + t + "» — «" + w + "» " + (h.length ? (h[0].apply ? "replaced" : "asked") : "not raised") + ", want asked");
}

console.log("\n— a phrase spelled like a town: asked in its idiom, the town everywhere else —");
// the new spellings brought the idiom in its other spelling («פתח תקוה», «זיכרון», «נוה»); the full spelling was
// caught before too
for (const [t, w, want] of [
  ["ההסדר החדש פותח פתח תקוה לשיקום הקשר.", "פתח תקווה", false], ["יש בהחלטה פתח־תקווה לשיקום הקשר בין האב לבנו.", "פתח תקווה", false],
  ["ההחלטה נותנת פתח תקווה לאב.", "פתח תקווה", false], ["זיכרון יעקב מהאירוע מעורפל.", "זכרון יעקב", false],
  ["זיכרון־יעקב מן האירוע אינו מדויק.", "זכרון יעקב", false], ["זכרון יעקב על הוויכוח שונה מזה של אחיו.", "זכרון יעקב", false],
  ["הבית היה נוה שלום לילדים.", "נווה שלום", false], ["הבית שימש כנווה שלום לילדים.", "נווה שלום", false],
  ["המבקשת גרה בפתח תקוה.", "פתח תקווה", true], ["פתח תקווה היא עיר מגוריה של המבקשת.", "פתח תקווה", true],
  ["בית משפט השלום פתח תקווה", "פתח תקווה", true], ["הם עברו לפתח תקווה.", "פתח תקווה", true],
  ["בית המשפט פתח את הדיון בפתח תקווה.", "פתח תקווה", true], ["המשפחה גרה בזיכרון יעקב מאז 2010.", "זכרון יעקב", true],
  ["תושבי זכרון יעקב הגישו עתירה.", "זכרון יעקב", true], ["תושבת נווה שלום הגישה בקשה.", "נווה שלום", true],
]) {
  const h = decided(t, w);
  ok(h.length === 1 && h[0].apply === want, "«" + t + "» — «" + w + "» " + (h.length ? (h[0].apply ? "replaced" : "asked") : "not found") + ", want " + (want ? "replaced" : "asked"));
  if (!want) ok(C.placesFound(t).some((p) => p.name === w && p.ambiguous), "«" + t + "» — the places screen offers «" + w + "» switched off");
}

console.log("\n— the context check looks back a fixed distance: one long line costs what the same text costs in lines —");
{
  // it searched back to the start of the line for every listed town, so a text with no line breaks grew with the
  // square of its length (a pasted text, a PDF line run together): 1.5 seconds on 300,000 characters
  const w = ["רעננה", "חדרה", "שלומי", "תקוע", "אופקים", "מודיעין"];
  let one = "", lines = "";
  for (let i = 0; one.length < 200000; i++) { const s = "ואז נקודת מבט " + w[i % w.length] + " עלתה שוב,"; one += s + " "; lines += s + "\n"; }
  const best = (t) => { let m = Infinity; for (let k = 0; k < 3; k++) { const t0 = process.hrtime.bigint(); C.placesFound(t); m = Math.min(m, Number(process.hrtime.bigint() - t0) / 1e6); } return m; };
  const b = best(lines), a = best(one);
  ok(a < 3 * b + 30, "one line of " + one.length + " characters took " + a.toFixed(0) + " ms, the same text in lines " + b.toFixed(0) + " ms");
}

console.log("\n— the list and its evidence agree —");
{
  const listed = C.TOWNWORD ? [...C.TOWNWORD.keys()] : [];
  ok(listed.length > 0, "the engine keeps a list of towns that are also words");
  for (const w of listed) ok(w in WORDS, "«" + w + "» is on the list without a sentence here to show it is a word");
  for (const w of Object.keys(WORDS)) ok(listed.includes(w), "«" + w + "» has evidence here but is not on the engine's list");
  for (const w of listed) ok(C.PLACES.some((p) => p.n === w), "«" + w + "» is a town of the coordinates list");
  const alt = C.PLACE_ALT || {};
  ok(Object.keys(alt).length > 0, "the engine keeps the other spellings of particular towns");
  for (const [n, list] of Object.entries(alt)) for (const a of list) {
    const h = cities("הוא עבר לגור ב" + a + " בשנה שעברה.");
    ok(h.length === 1 && h[0].place === n, "«" + a + "» is a spelling of «" + n + "»: found " + JSON.stringify(h.map((y) => y.place)));
  }
}

console.log("\n— one town, one substitute, in every spelling —");
{
  const t = "המבקשת גרה בתל אביב. המשיב עבר לתל-אביב. הילדים לומדים בתל־אביב.";
  const { out, rows } = sent(t);
  ok(rows.length === 1 && rows[0].name === "תל אביב", "the places screen shows one row: " + JSON.stringify(rows));
  ok(!/(^|[^א-ת])[בל]?(תל|אביב)(?![א-ת])/.test(out), "none of the three spellings is left: «" + out + "»");
  const swap = (subs, text) => {
    const eng = new C.Engine(subs, [], OPT, text);
    let o = text;
    for (const h of eng.detect(text).filter((x) => x.apply).sort((a, b) => b.s - a.s)) o = o.slice(0, h.s) + eng.repFor(h) + o.slice(h.e);
    return o;
  };
  const o1 = swap([{ value: "תל אביב", kind: "PLACE", replacement: "נהריה" }], t);
  ok(o1 === "המבקשת גרה בנהריה. המשיב עבר לנהריה. הילדים לומדים בנהריה.", "each spelling gets the substitute chosen for the town: «" + o1 + "»");
  const t2 = "המבקשת גרה בקרית ביאליק ובנהריה. המשיב גר בקריית ביאליק ובנהרייה.";
  const o2 = swap([{ value: "קרית ביאליק", kind: "PLACE", replacement: "עפולה" }, { value: "נהריה", kind: "PLACE", replacement: "טבריה" }], t2);
  ok(o2 === "המבקשת גרה בעפולה ובטבריה. המשיב גר בעפולה ובטבריה.", "both spellings of each town, one substitute each: «" + o2 + "»");
}

console.log("\n— the places screen reads the text as detect does, without invisible marks —");
// detect drops invisible marks before it reads (v73.6); the screen read them as gaps, so a town that detect
// replaced was offered as a word, or not offered at all
for (const t of [
  "המבקשת גרה ב‏רעננה עם ילדיה.", "המבקשת גרה ב​רעננה עם ילדיה.", "המבקשת גרה ב⁦רעננה⁩ עם ילדיה.",
  "המבקשת גרה בר​עננה עם ילדיה.", "המשפחה עברה ל‏נתיבות בקיץ.",
]) {
  const town = new C.Engine([], [], OPT, t).detect(t).find((h) => h.place === "רעננה" || h.place === "נתיבות");
  ok(town && town.apply, JSON.stringify(t) + " — detect " + (town ? "only asks" : "finds nothing"));
  const row = C.placesFound(t).find((p) => p.name === (town ? town.place : ""));
  ok(row && !row.ambiguous, JSON.stringify(t) + " — the places screen " + (row ? "offers it as a word, switched off" : "does not offer it"));
  ok(town && C.geoNames(t).includes(town.place), JSON.stringify(t) + " — not in the distance map");
}

console.log("\n— a town that is also a word is never a substitute: «ערערה» in the AI's answer came back as the real town —");
{
  const W = new Set(Object.keys(WORDS));
  const bad = C.PLACES.map((p) => [p.n, C.fakePlace(p.n, new Set(), new Set())]).filter(([, f]) => W.has(f));
  ok(!bad.length, "no town gets a word as its substitute: " + JSON.stringify(bad));
  // each map takes a moment: four sets, and three variants of the first («קבוצה אחרת»)
  for (const [set, variants] of [[["בני ברק", "בית שמש", "חיפה"], 3], [["תל אביב", "חיפה", "באר שבע", "נתניה"], 1],
    [["ירושלים", "פתח תקווה", "אשקלון"], 1], [["קרית גת", "אשקלון", "באר שבע"], 1]]) {
    for (let v = 0; v < variants; v++) {
      const g = C.geoMap(set, v, [], new Set());
      const hit = g ? g.map.filter((m) => W.has(m.to)).map((m) => m.from + "→" + m.to) : [];
      ok(g && !hit.length, "the distance map for " + set.join(", ") + " (variant " + v + ") picks no word: " + JSON.stringify(hit));
    }
  }
}

console.log("\n— no pool and no map gives a word, a first name, a phrase or an ambiguous name as a substitute —");
{
  // «מושב» gave נחלים, צופית and אבשלום, «קיבוץ» עין השופט, עמיעד and מגן, «שכונה» נווה שלום, the general pool
  // פתח תקווה, and the distance map יבנה, שדרות and קדימה: each comes back from the AI's own words as the real town
  // an engine without the phrase list (before 11.10) still runs this check, on the names it has
  const IDIOMS = C.IDIOM || { "פתח תקווה": 1, "נווה שלום": 1, "זכרון יעקב": 1 };
  const BAD = (n) => (C.AMBIG && C.AMBIG.has(n)) || C.TOWNWORD.has(n) || !!IDIOMS[n];
  const values = [...C.PLACES.map((p) => p.n), ...C.GAZ.slice(0, 300)];
  for (const kind of ["מושב", "קיבוץ", "כפר", "שכונה", "רחוב", null]) {
    const got = new Set();
    for (const v of values) { const f = C.fakePlace(v, new Set(), new Set(), kind); if (f && BAD(f)) got.add(f); }
    ok(!got.size, "fakePlace for «" + (kind || "no kind") + "» over " + values.length + " towns gives none: " + JSON.stringify([...got]));
  }
  for (const [t, v] of [["המשפחה גרה במושב בית חנן.", "בית חנן"], ["המשפחה גרה בקיבוץ גבעת ברנר.", "גבעת ברנר"], ["המשפחה גרה בשכונת נווה יעקב.", "נווה יעקב"]]) {
    const eng = new C.Engine([{ value: v, kind: "PLACE" }], [], OPT, t);
    const h = eng.detect(t).find((x) => x.src === "list"), rep = h && eng.repFor(h);
    ok(rep && !BAD(rep), "«" + t + "» — the typed place «" + v + "» gets «" + rep + "»");
  }
  // sets where the map picked טירה, מעלות, יבנה, גדרה, נשר and זכרון יעקב (each map takes a moment)
  for (const set of [["אום אל-פחם", "קרית ביאליק", "יהוד"], ["עכו", "מעלה אדומים", "שפרעם"], ["אור יהודה", "יהוד", "בית דגן"],
    ["טמרה", "שפרעם", "כפר קאסם"], ["מגדל העמק", "קצרין", "יקנעם"], ["פרדס חנה", "כפר קאסם", "בית אל"]]) {
    const g = C.geoMap(set, 0, [], new Set());
    const hit = g ? g.map.filter((m) => BAD(m.to)).map((m) => m.from + "→" + m.to) : [];
    ok(g && !hit.length, "the distance map for " + set.join(", ") + " gives none: " + JSON.stringify(hit));
  }
}

console.log("\n— a name of several parts gets a substitute of the same character as the city at its head —");
for (const [whole, head] of [["מודיעין-מכבים-רעות", "מודיעין"], ["תל אביב - יפו", "תל אביב"], ["יהוד-מונוסון", "יהוד"], ["פרדס חנה-כרכור", "פרדס חנה"]]) {
  const f = C.fakePlace(whole, new Set(), new Set());
  ok(f && f !== head && C.atlasPenalty(head, f) !== Infinity, "«" + whole + "» → «" + f + "», a town like «" + head + "»");
}

console.log("\n— «don't replace» on a town holds for every spelling of it —");
for (const [allow, t] of [
  ["תל אביב", "המבקשת גרה בתל־אביב ועובדת בתל-אביב."], ["קרית ביאליק", "המבקשת גרה בקריית ביאליק."],
  ["נהריה", "המבקשת גרה בנהרייה."], ["פתח תקווה", "המבקשת גרה בפתח תקוה."],
]) {
  const h = new C.Engine([], [allow], OPT, t).detect(t).filter((x) => x.apply);
  ok(!h.length, "«" + allow + "» allowed, «" + t + "» — still replaced: «" + h.map((x) => x.text).join(" | ") + "»");
}

console.log("\n— a value she types matches the other spellings too —");
for (const [value, kind, t] of [
  ["קרית ביאליק", "PLACE", "המבקשת גרה בקריית ביאליק."], ["פתח תקווה", "PLACE", "המבקשת גרה בפתח-תקוה."],
  ["תל־אביב", "PLACE", "המבקשת גרה בתל אביב."], ["תל אביב", "PLACE", "המבקשת גרה בתל־אביב."],
  // a double surname: the document joins it with a maqaf, she typed a hyphen
  ["יעל אורן-כץ", "NAME", "העידה יעל אורן־כץ."], ["רונית בן־דוד", "NAME", "העידה רונית בן דוד."],
]) {
  const eng = new C.Engine([{ value, kind, replacement: kind === "NAME" ? "מיכל ברנע" : "עפולה" }], [], { ...OPT, on: new Set() }, t);
  const h = eng.detect(t).filter((x) => x.src === "list");
  ok(h.length === 1, "rule «" + value + "» on «" + t + "» — " + (h.length ? "found «" + h[0].text + "»" : "not found"));
  ok(C.examplesOf([{ part: "w", text: t }], value).length === 1, "rule «" + value + "» — its sentence is shown on the screen");
}

/* One city, one fake, however it is written (the hunt of 1.11). «תל אביב» found by the places layer and «תל אביב-יפו»
   ticked in the list were two keys of the map, so one copy read «כפר סבא» in one line and «חולון» in the next, and
   the AI saw two cities. The same for a street written «רחוב ביאליק» and «רח' ביאליק». And two towns never share one
   fake: «מנתניה לרחובות» went out as «מאשדוד לאשדוד», since fakePlace never recorded its pick. Every example is
   invented. */
console.log("\n— one city written several ways gets one fake; two towns never share one —");
{
  const crypto = require("crypto");
  const KEYS = Array.from({ length: 50 }, (_, i) => crypto.createHash("sha256").update("towns-key-" + i).digest("hex"));
  const O = { ...OPT, styles: {} };
  const text = "המשרד בתל אביב. הכתובת תל אביב-יפו, ובמכתב תל אביב - יפו, ושוב לתל-אביב-יפו. " +
    "הדירה ברחוב ביאליק 31, ובמכתב רח' ביאליק 31. הנכס עבר מנתניה לרחובות, ומשם לעפולה.";
  const subs = [{ value: "תל אביב-יפו", kind: "PLACE", replacement: "" }, { value: "רחוב ביאליק 31", kind: "PLACE", replacement: "" },
    { value: "רח' ביאליק 31", kind: "PLACE", replacement: "" }, { value: "נתניה", kind: "PLACE", replacement: "" }, { value: "רחובות", kind: "PLACE", replacement: "" }];
  const strip = (r, h) => (h.pre && r.startsWith(h.pre) ? r.slice(h.pre.length) : r);
  const bad = [];
  for (const key of KEYS) {
    const eng = new C.Engine(subs, [], { ...O, aliasKey: key }, text);
    const hits = eng.detect(text).filter((h) => h.apply);
    const rep = (rx) => hits.filter((h) => rx.test(C.norm(h.text))).map((h) => strip(eng.repFor(h), h));
    const tlv = rep(/תל[ -]אביב/), street = rep(/ביאליק/), towns = ["נתניה", "רחובות", "עפולה"].map((t) => rep(new RegExp(t))[0]);
    if (tlv.length < 4 || new Set(tlv).size !== 1) bad.push("תל אביב: " + tlv.join(" / "));
    /* one street: one invented name and number, and each spelling keeps its own head word («רחוב הירדן 31», «רח' הירדן
       31»), so that the paste-back returns each spelling to itself; one fake for both left both marked (the review of 2.11) */
    const core = street.map((r) => r.replace(/^(?:רחוב|רח')\s+/, ""));
    if (street.length !== 2 || new Set(core).size !== 1 || !/^\S.* 31$/.test(core[0] || "") || !street.some((r) => /^רחוב /.test(r)) || !street.some((r) => /^רח' /.test(r)))
      bad.push("street: " + street.join(" / "));
    const all = [tlv[0], street[0], ...towns];
    if (all.some((x) => !x) || new Set(all).size !== all.length) bad.push("distinct: " + all.join(" / "));
  }
  ok(bad.length === 0, "over 50 keys: " + bad.length + " keys wrong, " + bad.slice(0, 3).join(" | "));
  // a short name inside a longer town is another town: «יפו» alone is not «תל אביב-יפו», «כפר סבא» is not «סבא»
  const e2 = new C.Engine([{ value: "תל אביב-יפו", kind: "PLACE", replacement: "" }, { value: "כפר סבא", kind: "PLACE", replacement: "" }, { value: "יפו", kind: "PLACE", replacement: "" }], [], O, "תל אביב-יפו, כפר סבא ויפו.");
  const r2 = new Map(e2.detect("תל אביב-יפו, כפר סבא ויפו.").filter((h) => h.apply).map((h) => [h.base, strip(e2.repFor(h), h)]));
  ok(r2.size === 3 && new Set(r2.values()).size === 3, "three places, three fakes: " + JSON.stringify([...r2]));
}

/* Only the aliases of one municipality are one place (the review of 2.11). The fold took any «<known place>-<anything>»
   to its head, and «ערערה» / «ערערה-בנגב» (two towns), «מגדל» / «מגדל-העמק», «מצפה» / «מצפה-רמון» and «נווה-שאנן» /
   «נווה-יעקב» shared one fake in every key. And «תל-אביב-יפו» written with hyphens or maqafs throughout, as its own
   list value, was not folded at all. Every example is invented. */
console.log("\n— the aliases of one city share a fake, two places that share a head word do not —");
{
  const crypto = require("crypto");
  const KEYS = Array.from({ length: 20 }, (_, i) => crypto.createHash("sha256").update("fold-key-" + i).digest("hex"));
  const O = { ...OPT, styles: {} };
  const fakesOf = (a, b, key) => {
    const text = "התובע מ" + a + ", והנתבע מ" + b + ".";
    const eng = new C.Engine([{ value: a, kind: "PLACE", replacement: "" }, { value: b, kind: "PLACE", replacement: "" }], [], { ...O, aliasKey: key }, text);
    const o = {}; for (const h of eng.detect(text)) if (h.apply) o[h.base] = eng.repFor({ ...h, pre: "" });
    return o;
  };
  for (const [a, b] of [["ערערה", "ערערה-בנגב"], ["מגדל", "מגדל-העמק"], ["מצפה", "מצפה-רמון"], ["נווה-שאנן", "נווה-יעקב"], ["רמות", "רמות-השבים"]]) {
    let same = 0, ex = "";
    for (const key of KEYS) { const o = fakesOf(a, b, key); if (!o[a] || !o[b] || o[a] === o[b]) { same++; ex = JSON.stringify(o); } }
    ok(same === 0, "«" + a + "» and «" + b + "» are two places, two fakes in every key: " + same + "/20 " + ex);
  }
  for (const [a, b] of [["תל אביב", "תל-אביב-יפו"], ["תל אביב", "תל־אביב־יפו"], ["תל אביב", "תל אביב - יפו"], ["תל אביב", "תל אביב/יפו"],
    ["מודיעין", "מודיעין-מכבים-רעות"], ["יהוד", "יהוד-מונוסון"], ["פרדס חנה", "פרדס חנה-כרכור"]]) {
    let two = 0, ex = "";
    for (const key of KEYS) { const o = fakesOf(a, b, key); if (!o[a] || o[a] !== o[b]) { two++; ex = JSON.stringify(o); } }
    ok(two === 0, "«" + a + "» and «" + b + "» are one city, one fake in every key: " + two + "/20 " + ex);
  }
  // the restore and the page's self-check (promise 4) read a shared fake of two such spellings as one value, nothing else
  for (const [a, b, want] of [["תל אביב", "תל אביב-יפו", true], ["תל אביב", "תל־אביב־יפו", true], ["רחוב ביאליק 31", "רח' ביאליק 31", true],
    ["מודיעין", "מודיעין-מכבים-רעות", true], ["ערערה", "ערערה-בנגב", false], ["מגדל", "מגדל-העמק", false], ["נתניה", "רחובות", false],
    ["רחוב ביאליק 31", "רחוב ביאליק 33", false], ["רחוב הרצל", "הרצל", false], ["משה כהן", "משה-כהן", false], ["דנה לוי", "תל אביב", false]])
    ok(C.samePlaceSpelling(a, b) === want, "«" + a + "» / «" + b + "»: one place written two ways is " + want);
}

/* A town never becomes a bracketed label (Q11 v2: «נופל למאגר היישובים הכללי — לעולם לא לתווית»). Once the picks were
   recorded, the few towns of the same character ran out and the next town got «[מקום ז׳]»: seven Arab towns in one
   document gave 30 labels over 20 keys. Every example is invented. */
console.log("\n— many towns of one character in one document: every one gets a town, all distinct —");
{
  const crypto = require("crypto");
  const KEYS = Array.from({ length: 20 }, (_, i) => crypto.createHash("sha256").update("label-key-" + i).digest("hex"));
  const O = { ...OPT, styles: {} };
  for (const towns of [["נצרת", "אום אל-פחם", "רהט", "טייבה", "שפרעם", "טמרה", "סח'נין", "עראבה"],
    ["ירושלים", "תל אביב", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה", "באר שבע", "חולון", "בני ברק"]]) {
    const text = "הסניפים פועלים ב" + towns.join(", ב") + ".";
    let lab = 0, dup = 0, ex = "";
    for (const key of KEYS) {
      const eng = new C.Engine(towns.map((v) => ({ value: v, kind: "PLACE", replacement: "" })), [], { ...O, aliasKey: key }, text);
      const o = {}; for (const h of eng.detect(text)) if (h.apply) o[h.base] = eng.repFor({ ...h, pre: "" });
      const v = Object.values(o);
      if (v.some((x) => /^\[/.test(x)) || v.length !== towns.length) { lab++; ex = JSON.stringify(o); }
      if (new Set(v).size !== v.length) { dup++; ex = JSON.stringify(o); }
    }
    ok(lab === 0 && dup === 0, towns.length + " towns from «" + towns[0] + "»: no label, no shared fake, in every key: " + lab + " labels, " + dup + " shared " + ex.slice(0, 200));
  }
  // and each keeps its population (Q7 v3: «בלי אוכלוסייה שונה לעולם»): when the nearest few run out, the next pick is
  // still a town of the same population, not any tagged town («רמלה» became a moshav, «רהט» a Jewish town)
  // There are 8 mixed cities and 7 Bedouin towns, so a document with four or five of them leaves too few: then a Bedouin
  // or Druze town gets another Arabic-speaking town and a mixed city another city (the owner-authorized decision of 2.11).
  const ARABIC = new Set(["ערבי", "בדואי", "דרוזי"]);
  const pop = (n) => (C.ATLAS_TAGS[n] || "").split("|")[1] || "?";
  // an Arab, Bedouin or Druze town may move within ARABIC (never to a Jewish town); a mixed city, whose
  // three free peers run out at four, to another city (never a kibbutz or a moshav)
  const kind = (n) => (C.ATLAS_TAGS[n] || "").split("|")[0];
  const group = (t, f) => pop(t) === pop(f) || (ARABIC.has(pop(t)) && ARABIC.has(pop(f))) ||
    (pop(t) === "מעורב" && kind(f) === "עיר");
  for (const towns of [["ירושלים", "חיפה", "לוד", "רמלה"], ["רהט", "כסייפה", "תל שבע", "ערוער", "לקיה"],
    ["דאלית אל-כרמל", "עוספיא", "מג'אר", "ירכא"], ["נצרת", "שפרעם", "טמרה", "סח'נין", "עראבה", "טייבה"]]) {
    const text = "הסניפים פועלים ב" + towns.join(", ב") + ".";
    let n = 0, off = 0; const odd = new Set();
    for (const key of KEYS) {
      const eng = new C.Engine(towns.map((v) => ({ value: v, kind: "PLACE", replacement: "" })), [], { ...O, aliasKey: key }, text);
      const o = {}; for (const h of eng.detect(text)) if (h.apply) o[h.base] = eng.repFor({ ...h, pre: "" });
      for (const t of towns) { if (!o[t]) continue; n++; if (!group(t, o[t])) { off++; odd.add(t + "→" + o[t]); } }
    }
    ok(n > 0 && off === 0, towns.length + " towns from «" + towns[0] + "»: every fake keeps the population: " + off + "/" + n + " off " + [...odd].slice(0, 4).join(", "));
  }
  // a city stays a city when the nearest few run out (the review of 2.11: «ראשון לציון» became «כפר עזה» with six Gush Dan
  // cities in one document), and twelve Arab towns stay Arabic-speaking
  for (const towns of [["תל אביב", "רמת גן", "חולון", "ראשון לציון", "פתח תקווה", "הרצליה"],
    ["תל אביב", "רמת גן", "חולון", "ראשון לציון", "פתח תקווה", "הרצליה", "נתניה", "בת ים", "רחובות", "כפר סבא", "רעננה"],
    ["נצרת", "אום אל-פחם", "טירה", "טייבה", "טמרה", "סח'נין", "שפרעם", "כפר קאסם", "קלנסווה", "באקה אל-גרביה", "כפר כנא", "עראבה"]]) {
    const text = "הסניפים פועלים ב" + towns.join(", ב") + ".";
    let n = 0, off = 0; const odd = new Set();
    for (const key of KEYS) {
      const eng = new C.Engine(towns.map((v) => ({ value: v, kind: "PLACE", replacement: "" })), [], { ...O, aliasKey: key }, text);
      const o = {}; for (const h of eng.detect(text)) if (h.apply) o[h.base] = eng.repFor({ ...h, pre: "" });
      for (const t of towns) { if (!o[t]) continue; n++; if (!group(t, o[t]) || (kind(t) === "עיר" && C.ATLAS_RURAL.has(kind(o[t])))) { off++; odd.add(t + "→" + o[t]); } }
    }
    ok(n > 0 && off === 0, towns.length + " towns from «" + towns[0] + "»: a city stays a city, the population is kept: " + off + "/" + n + " off " + [...odd].slice(0, 4).join(", "));
  }
  // an ordinary word of the document inside a town's name does not remove the town («קלון» in «אשקלון»); a secret does
  const plain = new C.Engine([], [], O, "העבירה שבה הורשע יש עמה קלון, וציון הדיון נדחה.").forbidden;
  ok(!C.holdsDocWord("אשקלון", plain) && !C.holdsDocWord("לציון", plain), "an ordinary word of the document («קלון», «וציון») leaves «אשקלון» and «ראשון לציון» free");
  const sec = new C.Engine([{ value: "ציון כהן", kind: "NAME", replacement: "" }], [], O, "העד ציון כהן העיד.").forbidden;
  ok(C.holdsDocWord("לציון", sec), "a secret of the document («ציון כהן») inside a town's name still removes it: the final check would read it");
}

/* The town of an address is the same town written alone (the review of 2.11). «רחוב הנביאים 22, הרצליה» picked its
   town apart from «הרצליה» and recorded only its words, so it could be another town's fake: «… 22, כפר סבא» beside
   «חולון» ← «כפר סבא», and the paste-back gave «כפר סבא» to חולון. Every example is invented. */
console.log("\n— the town after a comma in an address gets the fake of that town —");
{
  const crypto = require("crypto");
  const KEYS = Array.from({ length: 50 }, (_, i) => crypto.createHash("sha256").update("addr-key-" + i).digest("hex"));
  const O = { ...OPT, styles: {} };
  const others = ["נתניה", "חולון", "רעננה", "רמת השרון"];
  const bad = [];
  for (const [addr, text] of [["רחוב הנביאים 22, הרצליה", "המשרד ברחוב הנביאים 22, הרצליה. סניפים בנתניה, בחולון, ברעננה וברמת השרון, והמחסן בהרצליה."],
    ["רחוב הנביאים 22, הרצליה", "המחסן בהרצליה. המשרד ברחוב הנביאים 22, הרצליה. סניפים בנתניה, בחולון, ברעננה וברמת השרון."]]) {
    for (const key of KEYS) {
      const subs = [addr, "הרצליה", ...others].map((v) => ({ value: v, kind: "PLACE", replacement: "" }));
      const eng = new C.Engine(subs, [], { ...O, aliasKey: key }, text);
      const o = {}; for (const h of eng.detect(text)) if (h.apply && !(h.base in o)) o[h.base] = eng.repFor({ ...h, pre: "" });
      const t = (o[addr] || "").split(/,\s*/)[1];
      if (!t || t !== o["הרצליה"] || others.some((x) => o[x] === t)) bad.push(JSON.stringify(o));
    }
  }
  ok(bad.length === 0, "the address town is the town's own fake and no other town's, either order, over 50 keys: " + bad.length + " " + (bad[0] || ""));
}

/* The whole document, through redactDocx. After the first pass a uniformity pass replaces every other
   occurrence of a value that was replaced once: «גרה ברעננה» was replaced, so «נקודת מבט רעננה» was too,
   although the places layer had asked about it. And the final check read every occurrence of a replaced
   value as a leak: the word that was asked about turned the bar red («האימות נכשל … אין לשלוח ואין
   להעתיק»), in the very document the change is for. */
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
const E = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, part, base } = require("./structure-lib.js");
const docOf = (lines, parts = []) => mkzip([...base, { name: "word/document.xml", body: doc(lines.map((l) => P(R(l))).join("")) }, ...parts]);
const shown = (res) => res.preview.map((x) => x.text);
const leaksOf = (res) => JSON.stringify((res.verification.leaks || []).map((l) => l.value));

(async () => {
  console.log("\n— the whole document: a word that was asked about is not replaced by the uniformity pass —");
  {
    const res = await E.redactDocx(docOf(["המבקשת גרה ברעננה עם ילדיה.", "העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה."]), [], [], OPT);
    const lines = res.preview.map((x) => x.text);
    ok(!lines[1].includes("רעננה"), "the town where she lives is replaced: «" + lines[1] + "»");
    ok(lines[2] === "העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה.", "the word stays as it is: «" + lines[2] + "»");
    ok(res.flagged.some((f) => f.value === "רעננה"), "and it is asked about: " + JSON.stringify(res.flagged.map((f) => f.value)));
    ok(res.verification.passed, "and the final check passes: the word that was asked about is no leak " + leaksOf(res));
  }
  {
    const res = await E.redactDocx(docOf(["המבקשת גרה ברעננה עם ילדיה.", "הדיון נקבע בבית המשפט לענייני משפחה ברעננה."]), [], [], OPT);
    const all = res.preview.map((x) => x.text).join("\n");
    ok(!all.includes("רעננה"), "every mention with place context is replaced: «" + all + "»");
    ok(!res.flagged.some((f) => f.value === "רעננה"), "and nothing about it is asked");
    ok(res.verification.passed, "and the final check passes " + leaksOf(res));
  }
  {
    const res = await E.redactDocx(docOf(["המבקשת מתגוררת במודיעין-מכבים-רעות.", "בית הספר נמצא בתל-אביב."]), [], [], OPT);
    const all = res.preview.map((x) => x.text).join("\n");
    ok(!/מודיעין|מכבים|רעות|אביב/.test(all), "a name of several parts and a hyphenated name go out whole: «" + all + "»");
    ok(res.verification.passed, "and the final check passes " + leaksOf(res));
  }

  console.log("\n— a mixed document passes the final check: the town is replaced where it is a place, the word is asked —");
  // the review's three documents, then every town on the list with its own two sentences, the real one first
  for (const [real, plain, w] of [
    ["המבקשת, תושבת שלומי, מבקשת צו הגנה.", "אני חוששת לשלומי ולשלום ילדיי.", "שלומי"],
    ["המשפחה מתגוררת בחדרה מאז 2015.", "הקטינה ישנה בחדרה.", "חדרה"],
    ["המשפחה עברה לראש-פינה.", "עקרון טובת הילד היה לראש פינה בפסיקה.", "ראש פינה"],
    ...Object.entries(WORDS).map(([x, [p, r]]) => [r, p, x]),
  ]) {
    for (const order of [[real, plain], [plain, real]]) {
      const res = await E.redactDocx(docOf(order), [], [], OPT);
      // the first line of every document is its heading
      const lines = shown(res), at = order.indexOf(real) + 1, wa = order.indexOf(plain) + 1;
      const left = C.placesFound(lines[at]).some((p) => p.name === w);
      ok(!left, "«" + real + "» — the place is replaced: «" + lines[at] + "»");
      ok(lines[wa] === plain, "«" + plain + "» — the word stays: «" + lines[wa] + "»");
      ok(res.verification.passed, "«" + real + "» with «" + plain + "» — the final check fails on the word " + leaksOf(res));
      ok(res.flagged.some((f) => C.norm(f.value).replace(/-/g, " ") === w && f.label === "יישוב"), "«" + plain + "» — asked as a town: " + JSON.stringify(res.flagged.map((f) => f.value)));
    }
  }
  {
    // the place in the header, the word in the body
    const res = await E.redactDocx(docOf(["העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה."], [{ name: "word/header1.xml", body: part("hdr", P(R("המבקשת, תושבת רעננה"))) }]), [], [], OPT);
    ok(res.verification.passed, "a place in the header and the word in the body — the final check passes " + leaksOf(res));
    ok(res.applied.some((r) => r.value === "רעננה" && r.part === "כותרת עליונה"), "and the header's town is replaced: " + JSON.stringify(res.applied.map((r) => r.value + "@" + r.part)));
  }
  {
    // a phrase and the town in one document: the uniformity pass and the final check take the phrase as a phrase
    const res = await E.redactDocx(docOf(["המבקשת גרה בפתח תקווה עם ילדיה.", "ההסדר החדש פותח פתח תקווה לשיקום הקשר."]), [], [], OPT);
    const lines = shown(res);
    ok(!lines[1].includes("פתח תקווה"), "«בפתח תקווה» where she lives is replaced: «" + lines[1] + "»");
    ok(lines[2] === "ההסדר החדש פותח פתח תקווה לשיקום הקשר.", "the phrase stays: «" + lines[2] + "»");
    ok(res.verification.passed, "and the final check passes " + leaksOf(res));
  }

  console.log("\n— a listed person's name that is also a town: the part alone is the person —");
  // The sweep of name parts skipped every part that was a town and left it to the places layer. That layer only
  // asks about a town it is not sure of, so «אלעד» of «אלעד כהן» reached the AI alone, under a bar that said
  // the names were replaced. A first-name town is the person in every form; any other town that is only asked
  // about is taken when it stands alone, and marked for review.
  const swept = async (lines, value) => {
    const res = await E.redactDocx(docOf(lines), [{ value, kind: "NAME" }], [], OPT);
    return { res, lines: shown(res).slice(1), asked: res.flagged.filter((f) => f.label === "יישוב").map((f) => f.value) };
  };
  const has = (line, w) => new RegExp("(^|[^א-ת])[בהולמכש]{0,2}" + w + "(?![א-ת])").test(line);
  for (const [value, line, w] of [
    ["אלעד כהן", "אלעד אמר שלא ידע על הדיון.", "אלעד"],
    ["שלומי לוי", "לדברי האם, שלומי לא שילם מזונות מאז מרץ.", "שלומי"],
    ["אילת ברק", "אילת סיפרה כי הקטינים מפחדים.", "אילת"],
    ["אסף כהן", "אסף אמר שלא ידע על הדיון.", "אסף"],
  ]) {
    const r = await swept(["התובע, " + value + ", הגיש תביעה למזונות.", line], value);
    ok(!has(r.lines[1], w), "«" + value + "» listed, «" + line + "» — went out as «" + r.lines[1] + "»");
    ok(!r.asked.includes(w), "«" + value + "» listed — «" + w + "» is not left as a town question: " + JSON.stringify(r.asked));
  }
  for (const [w, kind] of C.TOWNWORD) {
    if (kind === "word") continue;
    for (const [value, lines] of [
      [w + " כהן", ["התובע, " + w + " כהן, הגיש תביעה.", w + " טען שלא ידע על הדיון.", "המשיב העביר ל" + w + " את המסמכים."]],
      ["רונית " + w, ["המבקשת, רונית " + w + ", הגישה בקשה.", "לדברי " + w + ", הקטינים מפחדים.", "המשיב העביר ל" + w + " את המסמכים."]],
    ]) {
      const r = await swept(lines, value);
      ok(!has(r.lines[1], w), "«" + value + "» listed, «" + lines[1] + "» — went out as «" + r.lines[1] + "»");
      // a first name with a prefix letter is the person; «לשלומי» is also «for my wellbeing», so it stays asked
      if (kind === "name") ok(!has(r.lines[2], w), "«" + value + "» listed, «" + lines[2] + "» — went out as «" + r.lines[2] + "»");
      else ok(r.lines[2] === lines[2] && r.asked.includes(w), "«" + value + "» listed, «" + lines[2] + "» — the prefixed form is left and asked: «" + r.lines[2] + "» " + JSON.stringify(r.asked));
    }
  }
  {
    // the word, and the town where the text says it is a place, next to a listed person of that name
    const r = await swept(["המשיב, שלומי לוי, לא התייצב.", "אני חוששת לשלומי ולשלום ילדיי.", "המבקשת, תושבת שלומי, מבקשת צו הגנה."], "שלומי לוי");
    ok(r.lines[1] === "אני חוששת לשלומי ולשלום ילדיי.", "«לשלומי» for «my wellbeing» stays: «" + r.lines[1] + "»");
    ok(!has(r.lines[2], "שלומי") && r.res.applied.some((a) => a.value === "שלומי" && a.label === "יישוב"), "«תושבת שלומי» is replaced as a town: «" + r.lines[2] + "»");
    const g = await swept(["המבקשת, רונית גשר, הגישה בקשה.", "הצדדים ניסו לגשר על הפערים."], "רונית גשר");
    ok(g.lines[1] === "הצדדים ניסו לגשר על הפערים.", "«לגשר» (to mediate) stays when «רונית גשר» is listed: «" + g.lines[1] + "»");
    const e = await swept(["המבקשת, אילת ברק, גרה באילת עם בתה.", "אילת סיפרה כי הקטינים מפחדים."], "אילת ברק");
    const pseudo = e.res.applied.find((a) => a.label === "שם (חלק)");
    ok(!has(e.lines[0], "אילת") && (!pseudo || !e.lines[0].includes("ב" + pseudo.rep + " עם")), "«גרה באילת» next to «אילת ברק» is replaced as a town, not as her: «" + e.lines[0] + "»");
  }
  {
    // the whole class: every town the places layer only asks about, as a listed first name and surname
    const towns = C.PLACES.map((p) => p.n).filter((n) => !/\s/.test(n) && C.findPlaces("ואז " + n + " אמר.").some((h) => h.type === "PLACE_CITY" && !h.apply));
    ok(towns.length >= 50, "towns asked about without context: " + towns.length);
    let left = [];
    for (const n of towns) {
      const a = await swept(["התובע, " + n + " כהן, הגיש תביעה.", n + " אמר שלא ידע על הדיון."], n + " כהן");
      const b = await swept(["המבקשת, רונית " + n + ", הגישה בקשה.", "לדברי " + n + ", הקטינים מפחדים."], "רונית " + n);
      if (has(a.lines[1], n)) left.push(n + " (first name)");
      if (has(b.lines[1], n)) left.push(n + " (surname)");
    }
    ok(!left.length, "a listed name part that is a town, standing alone, is replaced: left " + JSON.stringify(left));
  }

  console.log("\n— the next document of a case: a word-town the case brings back is replaced only where it is a place —");
  {
    // The case map saved «שלומי» → its substitute from «תושבת שלומי», and the next document turned the pair into a
    // rule for every mention: «אני חוששת לשלומי» went out with the town (the review of the first round). The page's
    // own methods, cut out of index.html as tests/profile_t.js does: the map and kinds it saves, the rules it builds.
    const html = require("../scripts/page-parts.js").pageWithLogic();
    const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
    const member = (head) => { const m = code.match(new RegExp("\\n {2}" + head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?\\n {2}\\}")); return m ? m[0].trim() : null; };
    const method = (head, name) => new Function("return ({" + member(head) + "})." + name + ";")();
    const arrow = (name, args) => { const src = member(name + " = (" + args + ") => {"); return new Function("return function(" + args + ")" + src.slice(src.indexOf("=> {") + 3))(); };
    const P = {
      currentMap: method("currentMap(){", "currentMap"), currentKinds: method("currentKinds(){", "currentKinds"),
      caseKind: method("caseKind(value, replacement, kinds){", "caseKind"), mkRule: method("mkRule({value, kind, replacement, auto, g, ...rest}){", "mkRule"),
      applyProfile: method("applyProfile(prof, name){", "applyProfile"), addRule: arrow("addRule", "value, kind, rep, origin"),
    };
    ok(Object.values(P).every((f) => typeof f === "function"), "the page's case methods are found in index.html");
    const Ep = { norm: C.norm, KINDLBL: C.KINDLBL, CANON: C.CANON, parseDate: C.parseDate, PLACE_BY: C.PLACE_BY, trimEdges: C.trimEdges };
    const page = (st) => {
      const c = { state: { E: Ep, mode: "real", o: { numStyle: "blank" }, res: null, screen: "entry", peo: [], err: "", rules: [], allow: [], removed: [], ...st },
        constructor: { BAD_PROFILE: "bad" }, ran: 0, hist: 0, log: { add() {} }, pushHistory() { this.hist++; }, rerun() { this.ran++; }, openWith: () => [], logMiss() {}, recordLeak() {} };
      c.setState = (o, cb) => { c.state = { ...c.state, ...(typeof o === "function" ? o(c.state) : o) }; if (cb) cb(); };
      for (const [k, f] of Object.entries(P)) c[k] = f;
      return c;
    };
    // the next document of the case: what the page gives redactDocx after applyProfile
    const nextDoc = async (first, second) => {
      const r1 = await E.redactDocx(docOf(first), [], [], OPT);
      const one = page({ res: r1 });
      const prof = { v: 1, rules: [], map: one.currentMap(), kinds: one.currentKinds() };
      const two = page({});
      two.applyProfile(prof);
      const res = await E.redactDocx(docOf(second), two.state.rules, [], OPT);
      return { prof, rules: two.state.rules, res, lines: shown(res).slice(1) };
    };
    for (const [first, second, w, word] of [
      [["המבקשת, תושבת שלומי, מבקשת צו הגנה."], ["אני חוששת לשלומי ולשלום ילדיי.", "המבקשת, תושבת שלומי, חוזרת על בקשתה."], "שלומי", 0],
      [["המבקשת גרה ברעננה עם ילדיה."], ["העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה.", "המשפחה עברה לרעננה בקיץ."], "רעננה", 0],
      [["המשפחה מתגוררת בחדרה מאז 2015."], ["הקטינה ישנה בחדרה.", "בית משפט השלום חדרה"], "חדרה", 0],
      [["המבקשת גרה בפתח תקווה עם ילדיה."], ["ההסדר החדש פותח פתח תקווה לשיקום הקשר.", "הם עברו לפתח תקווה."], "פתח תקווה", 0],
    ]) {
      const { prof, rules, res, lines } = await nextDoc(first, second);
      const sub = prof.map[w], rule = rules.find((r) => r.value === w);
      ok(sub && rule && rule.kind === "PLACE" && rule.cond === true, "«" + w + "» comes back from the case as a place that holds where it is a place: " + JSON.stringify(rule));
      ok(lines[word] === second[word], "«" + second[word] + "» — the word stays in the next document: «" + lines[word] + "»");
      ok(!lines[1].includes(w) && lines[1].includes(sub), "«" + second[1] + "» — the place gets the case's substitute «" + sub + "»: «" + lines[1] + "»");
      ok(res.verification.passed, "«" + w + "» — the final check passes " + leaksOf(res));
      ok(res.flagged.some((f) => f.value === w && f.label === "יישוב") && !res.flagged.some((f) => f.label === "לא נמצא" && f.value === w), "«" + w + "» — the word is asked, and the town is not reported missing: " + JSON.stringify(res.flagged.map((f) => f.value + " (" + f.label + ")")));
    }
    {
      // only the word in the next document: nothing replaced, asked, and not reported missing from it
      const { res, lines } = await nextDoc(["המבקשת, תושבת שלומי, מבקשת צו הגנה."], ["אני חוששת לשלומי ולשלום ילדיי."]);
      ok(lines[0] === "אני חוששת לשלומי ולשלום ילדיי." && res.verification.passed, "a document with the word only: «" + lines[0] + "» " + leaksOf(res));
      ok(!res.flagged.some((f) => f.label === "לא נמצא"), "and «שלומי» is not reported missing: " + JSON.stringify(res.flagged.map((f) => f.value + " (" + f.label + ")")));
    }
    {
      // controls: a town that is only a town, and a rule she made herself, replace every mention as before
      const { rules, lines } = await nextDoc(["המבקשת גרה בחיפה עם ילדיה."], ["הקטינים לומדים בחיפה.", "חיפה היא עיר נמל."]);
      ok(!lines.some((l) => l.includes("חיפה")), "a town that is only a town comes back for every mention: " + JSON.stringify(lines) + " " + JSON.stringify(rules));
      const res = await E.redactDocx(docOf(["אני חוששת לשלומי ולשלום ילדיי."]), [{ value: "שלומי", kind: "PLACE", replacement: "יהוד" }], [], OPT);
      ok(shown(res)[1] === "אני חוששת ליהוד ולשלום ילדיי.", "a place rule she made herself still holds for every mention: «" + shown(res)[1] + "»");
      const one = page({ res: null });
      one.applyProfile({ v: 1, rules: [], map: { "מיכאל פלדמן": "יואב כרמי", "שלומי": "יהוד" }, kinds: { "מיכאל פלדמן": "NAME", "שלומי": "PLACE" } });
      const pr = one.state.rules.find((r) => r.value === "מיכאל פלדמן");
      ok(pr && pr.kind === "NAME" && !pr.cond, "a person from the case is a rule as before: " + JSON.stringify(pr));
    }
    {
      // her own decision on that town makes it a rule for every mention; before, «replace» found the rule already listed
      const c = page({ res: {}, rules: [{ value: "שלומי", kind: "PLACE", replacement: "יהוד", auto: true, cond: true }] });
      c.addRule("שלומי", "PLACE", "", "review");
      ok(c.state.rules.length === 1 && c.state.rules[0].cond === false && c.state.rules[0].replacement === "יהוד" && c.ran === 1 && c.hist === 1,
        "«replace» on the asked town turns the case's rule into her rule, keeps its substitute, can be undone and runs again: " + JSON.stringify(c.state.rules) + " ran " + c.ran);
      const d = page({ res: {}, rules: [{ value: "שלומי", kind: "PLACE", replacement: "יהוד", auto: true, cond: true }] });
      d.addRule("שלומי", "NAME", "", "review");
      ok(d.state.rules[0].cond === true && d.ran === 0 && /כבר ברשימה/.test(d.state.err), "a person of that name is another decision: the place rule stays, and the screen says it is listed");
    }
  }

  /* One place written two ways comes back from the paste-back (the review of 2.11). Once the two spellings shared one
     fake, restoreNames read a fake with two reals as «belongs to more than one» and left both marked: «רחוב ביאליק 31» and
     «רח' ביאליק 31» in every key, «תל אביב» and «תל אביב-יפו» too. A street keeps its own head word in its fake, so each
     spelling returns to itself; a city's two spellings return as its first. Every example is invented. */
  console.log("\n— the paste-back of the clean copy returns one place written two ways —");
  {
    const crypto = require("crypto");
    const lines = ["הדירה ברחוב ביאליק 31 תושכר לשוכרת.", "המשכיר מתגורר ברח' ביאליק 31.", "המשרד בתל אביב.", "הכתובת הרשומה: תל אביב-יפו.", "השוכרת עוברת מחולון."];
    const rules = [{ value: "רחוב ביאליק 31", kind: "PLACE", replacement: "" }, { value: "רח' ביאליק 31", kind: "PLACE", replacement: "" },
      { value: "תל אביב", kind: "PLACE", replacement: "" }, { value: "תל אביב-יפו", kind: "PLACE", replacement: "" }, { value: "חולון", kind: "PLACE", replacement: "" }];
    const bad = [];
    for (let i = 0; i < 10; i++) {
      const key = crypto.createHash("sha256").update("pb-key-" + i).digest("hex");
      const res = await E.redactDocx(docOf(lines), rules, [], { ...OPT, styles: {}, aliasKey: key });
      const clean = shown(res).join("\n"), map = {};
      for (const a of res.applied || []) { const v = a.base || a.value, rp = a.baseRep || a.rep; if (v && rp && !(v in map)) map[v] = rp; }
      const pairs = Object.entries(E.restorePairs({}, map));
      const back = E.restoreNames(clean, pairs, []);
      const fakes = Object.values(map);
      const want = ["ברחוב ביאליק 31 תושכר", "ברח' ביאליק 31.", "המשרד בתל אביב.", "מחולון."];
      if (back.conflict.length || want.some((w) => !back.text.includes(w)) || !/הרשומה: תל אביב(?:-יפו)?\./.test(back.text) || fakes.some((f) => back.text.includes(f)))
        bad.push(clean.replace(/\n/g, " / ") + " ⇒ " + back.text.replace(/\n/g, " / ") + " conflict " + JSON.stringify(back.conflict));
      // and the street the AI writes without its number comes back too
      const st = map["רחוב ביאליק 31"], ab = map["רח' ביאליק 31"];
      if (!st || !ab) { bad.push("map " + JSON.stringify(map)); continue; }
      const ai = E.restoreNames("לפי הסיכום, " + st.replace(/ 31$/, "") + " ו" + ab.replace(/ 31$/, "") + " הם אותו רחוב.", pairs, []);
      if (ai.text !== "לפי הסיכום, רחוב ביאליק ורח' ביאליק הם אותו רחוב.") bad.push("AI form: " + ai.text);
    }
    ok(bad.length === 0, "two streets' and two cities' spellings return, nothing left marked, over 10 keys: " + bad.length + " " + bad.slice(0, 2).join(" | "));
  }

  /* The AI rewrites a street fake (the review of 2.11): it drops the town after the comma, drops the house number, writes
     «רח'» for «רחוב» or drops the head word. Each of those forms came back fake, sometimes beside the real town; main's fake
     was a town, and every form of it came back. Every example is invented. */
  console.log("\n— the AI's forms of a street fake come back —");
  {
    const crypto = require("crypto");
    const lines = ["המשרד הרשום של החברה ברחוב הנביאים 22, הרצליה.", "הסניף השני פועל בהרצליה ובחולון."];
    const rules = [{ value: "רחוב הנביאים 22, הרצליה", kind: "PLACE", replacement: "" }, { value: "הרצליה", kind: "PLACE", replacement: "" },
      { value: "חולון", kind: "PLACE", replacement: "" }];
    const bad = [];
    for (let i = 0; i < 10; i++) {
      const key = crypto.createHash("sha256").update("street-ai-" + i).digest("hex");
      const res = await E.redactDocx(docOf(lines), rules, [], { ...OPT, styles: {}, aliasKey: key });
      const map = {};
      for (const a of res.applied || []) { const v = a.base || a.value, rp = a.baseRep || a.rep; if (v && rp && !(v in map)) map[v] = rp; }
      const pairs = Object.entries(E.restorePairs({}, map)), st = map["רחוב הנביאים 22, הרצליה"], town = map["הרצליה"];
      const m = st && /^רחוב (.+) 22, (.+)$/.exec(st);
      if (!m || !town) { bad.push("map " + JSON.stringify(map)); continue; }
      for (const [ai, want] of [["המשרד ברחוב " + m[1] + " 22.", "המשרד ברחוב הנביאים 22."], ["המשרד ברחוב " + m[1] + ".", "המשרד ברחוב הנביאים."],
        ["המשרד ברח' " + m[1] + " 22.", "המשרד ברח' הנביאים 22."], ["המשרד ברח' " + m[1] + ", " + town + ".", "המשרד ברח' הנביאים, הרצליה."],
        ["המשרד ברחוב " + m[1] + " 22 ב" + town + ".", "המשרד ברחוב הנביאים 22 בהרצליה."]]) {
        const back = E.restoreNames(ai, pairs, []);
        if (back.text !== want) bad.push(ai + " ⇒ " + back.text);
      }
    }
    ok(bad.length === 0, "a street fake without its town, its number or its head word, or with «רח'», comes back, over 10 keys: " + bad.length + " " + bad.slice(0, 3).join(" | "));
  }

  /* Two streets never share a fake, also a fake of two words: noteFake records the words of a fake, and «בן גוריון» was
     free for a second street (the review of 2.11). And the name and number without «רחוב» is not a form: «העצמאות 12»
     caught «העצמאות 12.5 מיליון». Every example is invented. */
  console.log("\n— many streets in one document, each its own fake; no bare name-and-number form —");
  {
    const crypto = require("crypto");
    const streets = ["רחוב המסגר 4", "רחוב ז'בוטינסקי 33", "רחוב הסדנאות 9", "רחוב הארבעה 12", "רחוב המלאכה 7", "רחוב הנביאים 22",
      "רחוב החשמונאים 90", "רחוב הברזל 3", "רחוב העמל 15", "רחוב הנחושת 6"];
    const text = "המשרדים ב" + streets.join(", ב") + ".";
    let dup = 0, ex = "", bare = 0;
    for (let i = 0; i < 20; i++) {
      const key = crypto.createHash("sha256").update("streets-key-" + i).digest("hex");
      const eng = new C.Engine(streets.map((v) => ({ value: v, kind: "PLACE", replacement: "" })), [], { ...OPT, styles: {}, aliasKey: key }, text);
      const o = {}; for (const h of eng.detect(text)) if (h.apply) o[h.base] = eng.repFor({ ...h, pre: "" });
      const names = Object.values(o).map((f) => f.replace(/^רחוב\s+/, "").replace(/\s+\d+$/, ""));
      if (new Set(names).size !== names.length) { dup++; ex = JSON.stringify(o); }
      const f = o["רחוב הארבעה 12"], nm = f && f.replace(/^רחוב\s+/, "").replace(/\s+\d+$/, "");
      if (nm && C.restoreNames("הסכום הוא " + nm + " 12.5 מיליון.", Object.entries(C.restorePairs({}, o)), []).text !== "הסכום הוא " + nm + " 12.5 מיליון.") bare++;
    }
    ok(dup === 0, "ten streets, 20 keys: no two share a fake street name: " + dup + " " + ex.slice(0, 200));
    ok(bare === 0, "the fake name and number without «רחוב», before «.5 מיליון», is not restored: " + bare);
  }

  console.log("\n— the final check still sees a word-town left where the text says it is a place —");
  {
    const one = (lines, parts) => docOf(lines, parts);
    for (const [what, buf, plain, places, want] of [
      ["the place itself", one(["המבקשת גרה ברעננה עם ילדיה."]), [], ["רעננה"], false],
      ["the word only", one(["העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה."]), [], ["רעננה"], true],
      ["the word only, as a plain secret (a rule she typed)", one(["העובדת הסוציאלית הביאה לתיק נקודת מבט רעננה."]), ["רעננה"], [], false],
      ["the place split across two runs", mkzip([...base, { name: "word/document.xml", body: doc(P(R("המבקשת גרה ב") + R("רעננה עם ילדיה."))) }]), [], ["רעננה"], false],
      ["the place in a header", one(["פרוטוקול."], [{ name: "word/header1.xml", body: part("hdr", P(R("המבקשת, תושבת רעננה"))) }]), [], ["רעננה"], false],
      ["the place behind a direction mark", one(["המבקשת גרה ב‏רעננה עם ילדיה."]), [], ["רעננה"], false],
      ["a two-word town in another spelling", one(["המשפחה עברה לראש-פינה."]), [], ["ראש פינה"], false],
      ["a first-name town as a person", one(["אני חוששת לשלומי ולשלום ילדיי."]), [], ["שלומי"], true],
      ["a first-name town as a place", one(["המבקשת, תושבת שלומי, מבקשת צו הגנה."]), [], ["שלומי"], false],
      ["a phrase-town left as the town", one(["המבקשת גרה בפתח תקווה עם ילדיה."]), [], ["פתח תקווה"], false],
      ["the phrase only", one(["ההסדר החדש פותח פתח תקווה לשיקום הקשר."]), [], ["פתח תקווה"], true],
    ]) {
      // verify(buf, secrets, dates, fakes, placeSecrets): the dates and the dates written are the dates' own lists
      const v = await E.verify(buf, plain, [], [], places);
      ok(v.passed === want, what + " — the final check " + (v.passed ? "passes" : "fails, leaks " + JSON.stringify(v.leaks.map((l) => l.value))) + ", want " + (want ? "pass" : "fail"));
    }
  }
})().then(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; });
