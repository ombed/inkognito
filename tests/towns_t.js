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
  const BAD = (n) => C.AMBIG.has(n) || C.TOWNWORD.has(n) || !!C.IDIOM[n];
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
const js = fs.readFileSync(path.join(__dirname, "app.html"), "utf8").split("<script>")[1].split("</script>")[0]
  .replace('const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");', "const inflate=async u8=>global.__inflate(u8);")
  .replace('const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");', "const deflate=async u8=>global.__deflate(u8);");
const cut = js.indexOf("/* ══════════════════════════ ממשק ══════════════════════════ */");
const a = js.indexOf("function pseudoRX(p){"), b = js.indexOf("function livePairs(){");
fs.writeFileSync(path.join(__dirname, "towns-core.js"), js.slice(0, cut) + "\n" + js.slice(a, b) + "\nmodule.exports={redactDocx,verify};\n");
const E = require("./towns-core.js");
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
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
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
      const v = await E.verify(buf, plain, places);
      ok(v.passed === want, what + " — the final check " + (v.passed ? "passes" : "fails, leaks " + JSON.stringify(v.leaks.map((l) => l.value))) + ", want " + (want ? "pass" : "fail"));
    }
  }
})().then(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; });
