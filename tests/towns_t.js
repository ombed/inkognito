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
  "המבקשת גרה בר​עננה עם ילדיה.", "המשפחה עברה ל‏חדרה בקיץ.",
]) {
  const town = new C.Engine([], [], OPT, t).detect(t).find((h) => h.place === "רעננה" || h.place === "חדרה");
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
    ]) {
      const v = await E.verify(buf, plain, places);
      ok(v.passed === want, what + " — the final check " + (v.passed ? "passes" : "fails, leaks " + JSON.stringify(v.leaks.map((l) => l.value))) + ", want " + (want ? "pass" : "fail"));
    }
  }
})().then(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; });
