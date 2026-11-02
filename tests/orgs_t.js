/* Organisations by head-word rules, not by a closed list.

   A group such as "חסידות נורבין" (invented) was offered as an organisation to
   fake, and "נורבין" alone turned into a person's name. The rule: a
   broad group (a Hasidic court, a movement, a party, a stream, a community)
   is not an identifier and is never offered; an institution with a type
   word (עמותת, מעון, בית ספר, מרפאת…) is offered and the fake keeps the type
   word; a name with neither head goes to review and never enters the list
   by itself. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— head words —");
for (const v of ["חסידות נורבין", "חסידי גור", "תנועת הנוער", "מפלגת העבודה", "עדת הבוכרים", "קהילת יוצאי צרפת"])
  ok(C.GROUP_HEADS.test(C.norm(v)), "group, never offered: " + v);
for (const [v, head] of [["עמותת שביל הלב", "עמותת"], ["מעון נעמת", "מעון"], ["בית ספר אורט", "בית ספר"], ["מרפאת טיפת חלב", "מרפאת"], ["קופת חולים מכבי", "קופת חולים"], ['ביה"ס רמות', 'ביה"ס']])
  ok(C.orgHead(v) === head, "institution head of " + v + ": " + C.orgHead(v));
for (const v of ["נורבין", "שביל הלב", "נרות מאירות"])
  ok(C.orgHead(v) === null && !C.GROUP_HEADS.test(v), "no head, review: " + v);

console.log("\n— fake keeps the type word, and is stable —");
{
  const a = C.fakeOrg("עמותת שביל הלב", new Set(), new Set());
  ok(/^עמותת \S+$/.test(a) && !/שביל|הלב/.test(a), "עמותת שביל הלב → " + a);
  ok(a === C.fakeOrg("עמותת שביל הלב", new Set(), new Set()), "same input, same fake");
  ok(a !== C.fakeOrg("עמותת אור החיים", new Set(), new Set()), "different input, different fake");
  const b = C.fakeOrg("בית ספר אורט", new Set(), new Set());
  ok(/^בית ספר \S+$/.test(b) && !/אורט/.test(b), "two-word head kept: " + b);
  // a fake already used goes to the next one
  const used = new Set([a]);
  const a2 = C.fakeOrg("עמותת שביל הלב", used, new Set());
  ok(a2 !== a && /^עמותת /.test(a2), "used fake is skipped: " + a2);
  // a tail that is a word of the document is forbidden
  const forb = new Set([C.norm(a.split(" ")[1])]);
  const a3 = C.fakeOrg("עמותת שביל הלב", new Set(), forb);
  ok(a3 !== a && /^עמותת /.test(a3), "forbidden tail is skipped: " + a3);
  // no head: a name is still produced, without inventing a type word
  const c = C.fakeOrg("נרות מאירות", new Set(), new Set());
  ok(c && !/\s/.test(c), "headless org gets a plain fake: " + c);
}

console.log("\n— the model's ORG candidates: group dropped, headless flagged —");
{
  const TEXT = "התורם שייך לחסידות נורבין. השיעור נערך בבית ספר אורט. עמותת שביל הלב ליוותה. נורבין מנהלת את המקום. משרד הרווחה השיב.";
  const E = (surface, type, score) => ({ s: TEXT.indexOf(surface), e: TEXT.indexOf(surface) + surface.length, type, score });
  const out = C.nerClean([
    E("חסידות נורבין", "ORG", 0.99), E("בית ספר אורט", "ORG", 0.98),
    E("עמותת שביל הלב", "ORG", 0.99), E("נורבין", "ORG", 0.9), E("משרד הרווחה", "ORG", 0.99),
  ], TEXT);
  const val = s => out.find(x => x.value === s);
  ok(!val("חסידות נורבין"), "group is dropped   (got: " + out.map(x => x.value).join(", ") + ")");
  ok(val("בית ספר אורט") && !val("בית ספר אורט").review, "institution offered as usual");
  ok(val("עמותת שביל הלב") && !val("עמותת שביל הלב").review, "עמותת offered as usual");
  ok(val("נורבין") && val("נורבין").review === true, "headless name flagged for review");
  ok(!val("משרד הרווחה"), "public body still never offered");
  // "המוסד לביטוח לאומי": the head-word peel took the ה off and turned a public
  // body into a private-looking "מוסד לביטוח לאומי" (three new false positives on the bench)
  const T2 = "התובעת פנתה למוסד לביטוח לאומי. המוסד לביטוח לאומי השיב.";
  const E2 = (surface, type, score) => ({ s: T2.lastIndexOf(surface), e: T2.lastIndexOf(surface) + surface.length, type, score });
  const out2 = C.nerClean([E2("המוסד לביטוח לאומי", "ORG", 0.99)], T2);
  ok(out2.length === 0, "a public body is not offered after the head-word peel: " + out2.map((x) => x.value).join(", "));
}

console.log("\n— end to end: the replacement keeps the head —");
{
  const OPT = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" };
  const text = "הילד שהה במעון של עמותת שביל הלב. לעמותת שביל הלב יש סניף.";
  const eng = new C.Engine([{ value: "עמותת שביל הלב", kind: "ORG", replacement: "" }], [], OPT, text);
  const hits = eng.detect(text);
  ok(hits.length === 2, "both occurrences hit: " + hits.length);
  const reps = hits.map(h => eng.repFor(h));
  ok(reps.every(r => /^ל?עמותת \S+$/.test(r) && !/שביל/.test(r)), "fake keeps עמותת: " + reps.join(" | "));
}

/* A company's fake keeps the company's legal suffix, and is never a person's first name, a town or a word that is
   also a name (the owner's decision of 2.11, Q6). «מרלין השקעות בע"מ» went out as «גלים» or «תמר»: the AI read a
   woman, «תמר» was never restored by the paste-back, and a one-word fake named a town («סביון»). And four companies
   in one document shared one fake in about a quarter of the keys («בנק ארז» for both banks), since fakeOrg never
   recorded its pick. Every example is invented. */
const crypto = require("crypto");
const KEYS = Array.from({ length: 50 }, (_, i) => crypto.createHash("sha256").update("orgs-key-" + i).digest("hex"));
const PERSONISH = (w) => C.POOL.he_f.includes(w) || C.POOL.he_m.includes(w) || C.POOL.ar_f.includes(w) || C.POOL.ar_m.includes(w) ||
  C.FEM.has(w) || C.MASC.has(w) || C.WORDLIKE.has(w);
const TOWNISH = (w) => !!C.PLACE_BY[w] || C.PLACES.some((p) => p.n === w);

console.log("\n— a company fake keeps its legal suffix, and its name is not a person or a town —");
{
  const cases = [
    ['מרלין השקעות בע"מ', ' בע"מ'], ['טרבלון מערכות בקרה בע"מ', ' בע"מ'], ["זיו ושות'", " ושות'"], ["ברקת ושות׳", " ושות'"],
    ['גלבוע תעשיות (2019) בע"מ', ' (2019) בע"מ'], ['טרילון ייזום בע"מ (2019)', ' בע"מ (2019)'], ["Norlux Ltd", " Ltd"],
  ];
  const bad = [];
  for (const key of KEYS) {
    C.setAliasKey(key);
    for (const [v, tail] of cases) {
      const f = C.fakeOrg(v, new Set(), new Set());
      const nf = C.norm(f || "");
      if (!f || !nf.endsWith(C.norm(tail))) { bad.push(v + " → " + f + " (suffix)"); continue; }
      const name = nf.slice(0, nf.length - C.norm(tail).length).trim();
      if (!name || /\s/.test(name) || PERSONISH(name) || TOWNISH(name)) bad.push(v + " → " + f + " (name part «" + name + "»)");
      if (C.norm(v).split(/\s+/).some((w) => w.length > 2 && name === w)) bad.push(v + " → " + f + " (a real word kept)");
    }
  }
  C.setAliasKey(null);
  ok(bad.length === 0, "suffix kept, name part not a person, word-name or town, over 50 keys: " + bad.slice(0, 6).join(" | "));
  // without a suffix nothing is added: a headless name still gets one word, a head keeps its head
  C.setAliasKey(KEYS[3]);
  const plain = C.fakeOrg("נרות מאירות", new Set(), new Set()), bank = C.fakeOrg("בנק הצפון", new Set(), new Set());
  C.setAliasKey(null);
  ok(plain && !/\s/.test(plain) && !PERSONISH(plain) && !TOWNISH(plain), "no suffix, no head: one plain word: " + plain);
  ok(/^בנק \S+$/.test(bank) && !PERSONISH(bank.split(" ")[1]) && !TOWNISH(bank.split(" ")[1]), "a head and no suffix: «בנק <word>»: " + bank);
}

console.log("\n— distinct entities get distinct fakes in one document, in every key —");
{
  const OPT2 = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
  const orgs = ['מרלין השקעות בע"מ', 'טרבלון מערכות בע"מ', 'פלדור הנדסה בע"מ', "סולמית דירוג ושות'", "בנק הפועלים", "בנק דיסקונט", "עמותת שביל הלב", "עמותת נר תמיד"];
  const towns = ["נתניה", "רחובות", "חיפה", "עפולה"];
  const text = orgs.join(" חתמה עם ") + ". המשרדים ב" + towns.join(", ב") + ".";
  const subs = orgs.map((v) => ({ value: v, kind: "ORG", replacement: "" })).concat(towns.map((v) => ({ value: v, kind: "PLACE", replacement: "" })));
  const shared = [], tailShared = [];
  for (const key of KEYS) {
    const eng = new C.Engine(subs, [], { ...OPT2, aliasKey: key }, text);
    const reps = new Map();
    for (const h of eng.detect(text)) if (h.apply) reps.set(h.base, eng.repFor({ ...h, pre: "" }));
    const vals = [...reps.values()];
    if (reps.size !== orgs.length + towns.length || new Set(vals).size !== vals.length) shared.push(JSON.stringify([...reps]));
    // and no two entities share the distinctive word of their fakes, which the AI writes alone («גלים» for «גלים בע"מ»)
    const core = vals.map((r) => C.norm(r).replace(/\s(?:בע"מ|ושות')$/, "").replace(/^(?:בנק|עמותת)\s/, ""));
    if (new Set(core).size !== core.length) tailShared.push(core.join(", "));
  }
  C.setAliasKey(null);
  ok(shared.length === 0, "eight companies and four towns, twelve fakes in each of 50 keys: " + shared.length + " keys collide " + (shared[0] || ""));
  ok(tailShared.length === 0, "no two entities share the name word of their fakes: " + tailShared.length + " keys, " + (tailShared[0] || ""));
}

console.log("\n— every written form of a company gets the same fake, and its defined short name drops the suffix —");
{
  const OPT2 = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
  const full = 'מרלין השקעות בע"מ', short = "מרלין השקעות";
  const forms = ["ל", "מ", "ב", "ו", "ש", "כש", "וה"];
  const text = full + " (להלן: \"" + short + "\") חתמה. " + forms.map((p) => p + full).join(" ; ") + ". " + short + " תשלם, ול" + short + " אין חוב.";
  const subs = [{ value: full, kind: "ORG", replacement: "" }, { value: short, kind: "ORG", replacement: "", sameAs: full }];
  const bad = [];
  for (const key of KEYS.slice(0, 20)) {
    const eng = new C.Engine(subs, [], { ...OPT2, aliasKey: key }, text);
    const hits = eng.detect(text).filter((h) => h.apply);
    const fullHits = hits.filter((h) => h.base === full), shortHits = hits.filter((h) => h.base === short);
    if (fullHits.length !== 1 + forms.length || shortHits.length !== 3) { bad.push("hits " + hits.map((h) => h.text).join(",")); continue; }
    const fake = eng.repFor({ ...fullHits[0], pre: "" });
    const stem = fake.replace(/\s+בע"מ$/, "");
    if (!/\sבע"מ$/.test(fake)) bad.push("full: " + fake);
    // after ל, ב, כ or ה a fake that starts with ה drops it, as Hebrew does («להשקמה» is «לשקמה»)
    const same = (r, p) => { const n = C.norm(r); return n === C.norm(p + fake) || (fake[0] === "ה" && /[לבכה]$/.test(p) && n === C.norm(p + fake.slice(1))); };
    for (const h of fullHits) { const r = eng.repFor(h); if (!same(r, h.pre || "") || !r.endsWith('בע"מ')) bad.push(h.text + " → " + r + " (pre «" + (h.pre || "") + "»)"); }
    for (const h of shortHits) { const r = eng.repFor(h); if (!(r.endsWith(stem) || (stem[0] === "ה" && r.endsWith(stem.slice(1)))) || /בע"מ/.test(r)) bad.push(h.text + " → " + r + " (want " + stem + ")"); }
  }
  ok(bad.length === 0, "the full name in seven prefixed forms and the short name, over 20 keys: " + bad.slice(0, 4).join(" | "));
  // with a year before the suffix: the full fake keeps «(2019) בע"מ», the defined short name drops both
  const yf = 'גלבוע תעשיות (2019) בע"מ', ys = "גלבוע תעשיות", yt = yf + ' (להלן: "' + ys + '") חתמה, ו' + ys + " תשלם.";
  const ybad = [];
  for (const key of KEYS.slice(0, 10)) {
    const eng = new C.Engine([{ value: yf, kind: "ORG", replacement: "" }, { value: ys, kind: "ORG", replacement: "", sameAs: yf }], [], { ...OPT2, aliasKey: key }, yt);
    const o = {}; for (const h of eng.detect(yt)) if (h.apply && !(h.base in o)) o[h.base] = eng.repFor({ ...h, pre: "" });
    if (!/^\S+ \(2019\) בע"מ$/.test(o[yf] || "") || o[ys] !== (o[yf] || "").replace(/ \(2019\) בע"מ$/, "")) ybad.push(JSON.stringify(o));
  }
  ok(ybad.length === 0, "a year before the suffix is kept in the full fake and dropped from the short name: " + ybad.slice(0, 2).join(" | "));
}

console.log("\n— the paste-back returns a company the AI wrote without its suffix —");
{
  // the AI drops «בע"מ» and writes «חברת גרניט», «לגרניט»: that is the company too, as its defined short name is
  const pairs = [['מרלין השקעות בע"מ', 'גרניט בע"מ'], ["זיו ושות'", "קוורץ ושות'"], ["רחוב הנביאים 22", "רחוב הזית 22"], ["רחוב הברזל", "רחוב הרצל"], ["רחוב אחוזה", "רחוב השקד"], ["דנה כהן", "מיכל לוי"]];
  const r = C.restoreNames("חברת גרניט חתמה, ולגרניט אין חוב. משרד קוורץ ייצג. גרניט בע\"מ תשלם. מיכל לוי גרה ברחוב הזית 22.", pairs, []);
  ok(r.text === "חברת מרלין השקעות חתמה, ולמרלין השקעות אין חוב. משרד זיו ייצג. מרלין השקעות בע\"מ תשלם. דנה כהן גרה ברחוב הנביאים 22.", "restored: " + r.text);
  ok(!r.conflict.length, "two streets are not people: no initials form «רחוב ה.» shared by both: " + JSON.stringify(r.conflict));
  // a year before the suffix is part of it (Q6): «גלבוע תעשיות (2019) בע"מ» ← «טופז (2019) בע"מ», and the AI's «חברת טופז» is the company
  const y = C.restoreNames("חברת טופז חתמה. טופז (2019) בע\"מ תשלם.", [['גלבוע תעשיות (2019) בע"מ', 'טופז (2019) בע"מ']], []);
  ok(y.text === "חברת גלבוע תעשיות חתמה. גלבוע תעשיות (2019) בע\"מ תשלם.", "the year before the suffix: " + y.text);
}

console.log("\n— a law firm in the list of names is still a firm —");
{
  // «שושן ושות'» ticked as a name (the model tags a law firm as a person) went out as a man, «משה זילברמן»: the suffix
  // makes it a firm, whatever the list says
  const OPT2 = { on: new Set(), flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
  const text = "ב\"כ התובעת, עו\"ד משושן ושות', ומשרד בוזגלו ושות׳ הגישו. שושן ושות' ביקשו דחייה.";
  const bad = [];
  for (const key of KEYS.slice(0, 20)) {
    const eng = new C.Engine([{ value: "שושן ושות'", kind: "NAME", replacement: "" }, { value: "בוזגלו ושות׳", kind: "NAME", replacement: "" }], [], { ...OPT2, aliasKey: key }, text);
    for (const h of eng.detect(text).filter((x) => x.apply)) {
      const r = eng.repFor({ ...h, pre: "" }), w = C.norm(r).split(/\s+/);
      if (!/ושות'$/.test(C.norm(r)) || w.length !== 2 || PERSONISH(w[0]) || C.origin(r) === "ar") bad.push(h.text + " → " + r);
    }
  }
  ok(bad.length === 0, "a firm's fake keeps «ושות'» and is not a person, over 20 keys: " + bad.slice(0, 4).join(" | "));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
