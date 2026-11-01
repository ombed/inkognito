/* Places: the town that is found, the address that is deleted, and the substitute a town gets — behaviours no suite
   held (the mutation hunt of 1.11, second round).

   Each check here was found the way guards_numbers_t.js was: a small, likely edit to the places layer
   (engine/06-model.js) — one letter dropped from a list, a bound moved by one, a set no longer consulted — broke it,
   and every suite and the result lock stayed green. A broken one means a town or a street reaches the AI, or a town
   gets a substitute that is itself a real place of the case, and the answer's town comes back as the wrong one. Each
   section names the behaviour it protects; the commit that added it names the edit that proved it blind.
   Every street and address here is invented. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

// the page's own defaults: every detector marked on is deleted unasked, places on
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n));
const OPT = { on: ON, flag: FLAG, mode: "real", near: false, body: false, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const found = (t) => new C.Engine([], [], OPT, t).detect(t).filter((h) => h.src === "pattern" && h.type !== "DATE");
const show = (hs) => hs.map((h) => h.type + "«" + h.text + "»" + (h.apply ? "" : " asked")).join(", ") || "nothing";
// the town is found and replaced without asking
const town = (text, place) => {
  const hs = found(text).filter((h) => h.type === "PLACE_CITY" && h.place === place);
  ok(hs.length === 1 && hs[0].apply, "«" + text + "»: «" + place + "» replaced — got " + show(found(text)));
};
// the address is found whole and deleted without asking (a prefix letter before it goes with it)
const deleted = (text, value) => {
  const hs = found(text).filter((h) => /^ADDRESS/.test(h.type));
  const whole = [value, ...[..."בהולמכש"].map((p) => p + value)];
  ok(hs.some((h) => whole.includes(h.text) && h.apply), "«" + text + "»: «" + value + "» deleted — got " + show(found(text)));
};
// the towns a distance map gives as substitutes
const targets = (g) => (g ? g.map.map((m) => m.to) : []);

console.log("\n— the distance map never gives a town the document keeps, or a substitute the case already gave —");
{
  // avoid (the places screen): every town found in the document, those left out of the map too, and every substitute
  // the case already gave. A target from it is two places under one name: the AI reads one town where there were two,
  // and the town in its answer comes back as the wrong one
  for (const names of [["חיפה", "עכו", "נהריה"], ["תל אביב", "רמת גן", "חולון"], ["באר שבע", "דימונה", "ערד"]]) {
    for (const t of targets(C.geoMap(names, 0, [], new Set()))) {
      const g = C.geoMap(names, 0, [t], new Set());
      ok(g && !targets(g).includes(t), names.join(", ") + " with «" + t + "» to avoid — the map gives " + JSON.stringify(targets(g)));
    }
  }
}

console.log("\n— the distance map gives each town its own substitute, also for towns next to each other —");
{
  // two towns under one substitute cannot be told apart by the AI, and restore cannot say which one to bring back
  for (const names of [["רמת גן", "גבעתיים", "בני ברק", "תל אביב"], ["חיפה", "קרית ביאליק", "קרית מוצקין", "קרית ים"], ["באר שבע", "עומר", "להבים", "מיתר"]]) {
    for (let v = 0; v < 2; v++) {
      const t = targets(C.geoMap(names, v, [], new Set()));
      ok(t.length === names.length && new Set(t).size === t.length, names.join(", ") + " (variant " + v + ") — the map gives " + JSON.stringify(t));
    }
  }
}

console.log("\n— a town the document writes after any prefix letter is never a substitute —");
{
  // forbidden is the document's own words, as written. «בחיפה» in the text is Haifa: «חיפה» as the substitute of another
  // town puts a real town of the case in the wrong role. Every prefix letter, not only ל.
  // The map: the towns found are also in avoid; this is what keeps out a town one of whose words the text uses
  {
    const names = ["באר שבע", "דימונה", "ערד"];
    const t = targets(C.geoMap(names, 0, [], new Set()))[0], w = C.norm(t).split(/\s+/)[0];
    for (const p of "בלמוהשכ") {
      const g = C.geoMap(names, 0, [], new Set([p + w]));
      ok(g && !targets(g).includes(t), "the map for " + names.join(", ") + ": «" + p + w + "» in the document rules out «" + t + "» — got " + JSON.stringify(targets(g)));
    }
  }
  // fakePlace: the places screen's row for a town outside the map takes the document's words as written, and not the
  // towns found, so this is all that keeps a town of the document from becoming another town's substitute
  for (const v of ["ירושלים", "לוד", "באר שבע"]) {
    const t = C.fakePlace(v, new Set(), new Set()), w = C.norm(t).split(/\s+/)[0];
    for (const p of "בלמוהשכ") {
      const f = C.fakePlace(v, new Set(), new Set([p + w]));
      ok(f && f !== t, "a substitute for «" + v + "»: «" + p + w + "» in the document rules out «" + t + "» — got «" + f + "»");
    }
  }
}

console.log("\n— a town after «ו» and a prefix letter is found, as after the letter alone —");
for (const [text, place] of [
  // «and in», «and to», «and from»
  ["המשפחה גרה בנתניה ובחיפה.", "חיפה"], ["הם נסעו לירושלים ולחיפה בקיץ.", "חיפה"], ["הם הגיעו מירושלים ומחיפה.", "חיפה"],
  ["הם גרים בחיפה.", "חיפה"], ["הם עברו לחיפה.", "חיפה"], ["הוא חזר מחיפה.", "חיפה"], ["ירושלים וחיפה רחוקות זו מזו.", "חיפה"],
  ["אמרה שחיפה קרובה לעבודתה.", "חיפה"],
]) town(text, place);
{
  // a town that is a rule (the places screen's, or one she typed) takes every prefix the list knows, two-letter ones too:
  // «שבחיפה» (that is in Haifa), «שמחיפה», «שלחיפה»
  const OFF = { ...OPT, on: new Set() };
  const subs = [{ value: "חיפה", kind: "PLACE", replacement: "עכו" }, { value: "תל אביב", kind: "PLACE", replacement: "נהריה" }];
  for (const [text, want] of [["הדירה שבחיפה נמכרה בשנה שעברה.", "הדירה שבעכו נמכרה בשנה שעברה."], ["המשפחה שמחיפה הגיעה לדיון.", "המשפחה שמעכו הגיעה לדיון."],
    ["הנסיעה שלחיפה נדחתה.", "הנסיעה שלעכו נדחתה."], ["בית המשפט שבתל אביב דחה את הבקשה.", "בית המשפט שבנהריה דחה את הבקשה."]]) {
    const eng = new C.Engine(subs, [], OFF, text);
    let out = text;
    for (const h of eng.detect(text).filter((x) => x.apply).sort((a, b) => b.s - a.s)) out = out.slice(0, h.s) + eng.repFor(h) + out.slice(h.e);
    ok(out === want, "a place rule on «" + text + "» — went out as «" + out + "»");
  }
}

console.log("\n— a town that is also a word: the verb that makes it a place counts up to its limit of words before it —");
// placeCtx: «עד שלוש מילים» after a verb of living, a home, a stay or work; two after travel or a move. Short of it the
// town is only asked, under an orange bar that does not block. Each family at its own limit
for (const [text, place] of [
  ["המשפחה גרה כבר שנים רבות ברעננה.", "רעננה"], ["בני הזוג קנו לפני עשר שנים ברעננה.", "רעננה"],
  ["הקטינים לומדים כבר שלוש שנים ברעננה.", "רעננה"], ["המשיב עובד מזה שנים רבות ברעננה.", "רעננה"],
  ["המשפחה נסעה בחופשת הקיץ לרעננה.", "רעננה"], ["המשפחה עברה לפני שנתיים לרעננה.", "רעננה"],
]) town(text, place);

console.log("\n— every street word, with no verb of living before it —");
// only the street word says it is an address here: no label and no verb of living
for (const w of ["רחוב", "רח'", "רח.", "שדרות", "שד'", "סמטת", "סמטה", "דרך", "שכונת", "כיכר", "ככר", "מעלה", "נחל", "משעול"])
  deleted("הדירה ב" + w + " הגפן 4 נמכרה בשנה שעברה.", w + " הגפן 4");

console.log("\n— a street name of four words after the street word —");
deleted("הדירה ברחוב שבעת עצי התאנה העתיקים 7 נמכרה.", "רחוב שבעת עצי התאנה העתיקים 7");

console.log("\n— every form of a verb of living before a street without a street word —");
for (const v of ["גר", "גרה", "גרים", "גרות", "גרו", "מתגורר", "מתגוררת", "מתגוררים", "מתגוררות", "התגורר", "התגוררה", "התגוררו",
  "המתגורר", "המתגוררת", "המתגוררים", "המתגוררות", "מקום מגוריו", "מקום מגוריה", "מקום מגוריהם", "מקום מגוריהן"])
  deleted("לפי התסקיר, " + v + " בהגפן 4 בחיפה.", "הגפן 4");

console.log("\n— an address label of three words before its colon —");
// «כתובת למסירת כתבי בי-דין:» is how a claim gives a party's address for service
deleted("כתובת למסירת כתבי בי-דין: הגפן 4, חיפה", "הגפן 4");
deleted("המען להמצאת כתבי בי-דין: הגפן 4, חיפה", "הגפן 4");
// and the place of residence as a label, with or without the article
deleted("מקום מגורים: הגפן 4, חיפה", "הגפן 4");
deleted("מקום המגורים: הגפן 4, חיפה", "הגפן 4");

console.log("\n— a town's substitute keeps its population, also where the population has few towns —");
{
  // the atlas: another population is never a substitute (atlasPenalty). The pool of the nearest in character takes at
  // least six; a Bedouin town has five of its own, and only the population filter keeps every other town out
  const pop = (n) => C.atlasTags(n)["אוכלוסייה"];
  const bad = C.PLACES.map((p) => [p.n, C.fakePlace(p.n, new Set(), new Set())]).filter(([n, f]) => !f || pop(f) !== pop(n));
  ok(!bad.length, "every town of the coordinates list gets a town of its population — not: " + JSON.stringify(bad.map(([n, f]) => n + " (" + pop(n) + ") → " + f + " (" + (f && pop(f)) + ")")));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
