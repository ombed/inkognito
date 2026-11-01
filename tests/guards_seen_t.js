/* What a person reads against the bytes in the file: behaviours no suite held (the mutation hunt of 1.11, round 2).

   A person reads «ת”ז», «054–7712093», «רונית לוי» or «בּרגר» the same whichever quote, dash, space, digit, letter form
   or hidden character the file carries; the matcher reads bytes. The engine folds them first (NM and norm, and the
   characters nobody sees, squeezed out or read as \0: engine/02-hebrew.js), and the final check reads the file the same
   way (verify, engine/08-docx.js). Each check here was found the same way: a small, likely edit to one of those (one
   character dropped from the table or from a class, one step skipped) broke it, and every suite and the result lock
   stayed green. A broken one means a real name, number or date stays in the document, comes back as someone else, or
   the final check passes a file that still holds it. Each section names the behaviour it protects; the commit that
   added it names the edit that proved it blind. The characters under test are written as escapes, and the lists of
   them are written out here, not read from the engine, so that a character dropped from the engine is missed here
   too. Every name and number here is invented. */
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const hex = (ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");

// the page's own defaults: every detector marked on is deleted unasked, the rest are flagged for a look
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const NAME = (value, replacement) => ({ value, kind: "NAME", replacement: replacement || "" });
const detect = (text, subs) => new C.Engine(subs || [], [], OPT, text).detect(text);
const show = (hs) => hs.map((h) => h.type + "«" + h.text + "»" + (h.apply ? "" : " asked")).join(", ") || "nothing";
// the identifying numbers found in a text
const numbers = (t) => detect(t).filter((h) => h.src === "pattern" && h.type !== "DATE");
// the listed value is replaced where the text writes it, whole, as written
const foundAs = (text, value, written) => detect(text, [NAME(value)]).some((h) => h.src === "list" && h.apply && h.text === written);

// a .docx of paragraphs, as slots2_t.js builds it, and any other part beside it
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const docx = (lines, more) => mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    lines.map((t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join("") + "</w:body></w:document>" },
  ...(more || []),
]);
// the numbering part: a list definition's name is an attribute the replacement does not reach, and a copy of a name left
// there is the final check's to see
const numbering = (name) => ({ name: "word/numbering.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  `<w:abstractNum w:abstractNumId="0"><w:name w:val="${esc(name)}"/></w:abstractNum></w:numbering>` });
async function partOf(res, name) {
  const f = (await C.unzip(await res.blob.arrayBuffer())).find((x) => x.name === name);
  return f ? new TextDecoder().decode(f.data) : "";
}

// what a person does not see: the characters the engine promises to read past (INVIS in engine/02-hebrew.js), written out
const HIDDEN = ["\u{ad}", "\u{34f}", "\u{61c}", "\u{180e}", "\u{200b}", "\u{200c}", "\u{200d}", "\u{200e}", "\u{200f}",
  "\u{202a}", "\u{202b}", "\u{202c}", "\u{202d}", "\u{202e}", "\u{2060}", "\u{2061}", "\u{2062}", "\u{2063}", "\u{2064}",
  "\u{2066}", "\u{2067}", "\u{2068}", "\u{2069}", "\u{206a}", "\u{206b}", "\u{206c}", "\u{206d}", "\u{206e}", "\u{206f}", "\u{feff}"];

console.log("\n— an ID number after its label is deleted whichever quote the label is written with —");
// Word's automatic quotes turn «ת"ז» into «ת”ז»; a six-digit number is found only through its label
for (const [what, q] of [["a straight quote", '"'], ["the gershayim", "\u{5f4}"], ["Word's closing quote", "\u{201d}"], ["Word's opening quote", "\u{201c}"]]) {
  const t = "לפי התעודה, ת" + q + "ז 412763 שייכת לסבתא.", hs = numbers(t);
  ok(hs.some((h) => h.text === "412763" && h.apply), what + ": «" + t + "» — got " + show(hs));
}

console.log("\n— a listed name with an apostrophe is found whichever apostrophe the document uses —");
for (const [what, a] of [["the geresh", "\u{5f3}"], ["Word's closing apostrophe", "\u{2019}"], ["Word's opening apostrophe", "\u{2018}"]]) {
  const w = "ג" + a + "ורג" + a + " חדאד";
  ok(foundAs("בדיון העיד " + w + " מטעם התובעת.", "ג'ורג' חדאד", w), what + ": «" + w + "» found as listed «ג'ורג' חדאד»");
}

console.log("\n— a double surname and a mobile number are read whichever dash joins them —");
for (const [what, d] of [["the maqaf", "\u{5be}"], ["a hyphen", "\u{2010}"], ["a non-breaking hyphen", "\u{2011}"], ["a figure dash", "\u{2012}"], ["an en dash", "\u{2013}"], ["an em dash", "\u{2014}"]]) {
  const w = "רונית לוי" + d + "אבקסיס";
  ok(foundAs("המבקשת " + w + " הגישה בקשה.", "רונית לוי-אבקסיס", w), what + ": the listed «רונית לוי-אבקסיס» found as written «" + w + "»");
  const num = "054" + d + "7712093", hs = numbers("ניתן להשיג את המבקשת בנייד " + num + " בשעות הערב.");
  ok(hs.some((h) => h.text === num && h.apply && /PHONE/.test(h.type)), what + ": the mobile «" + num + "» deleted — got " + show(hs));
}

console.log("\n— a mobile number written in other digits is deleted, whichever of the ten digits it holds —");
// 058-6123479 holds every digit once
for (const [what, zero] of [["full-width", 0xff10], ["Arabic-Indic", 0x660], ["Persian", 0x6f0]]) {
  const num = "058-6123479".replace(/\d/g, (d) => String.fromCodePoint(zero + Number(d))), hs = numbers("ניתן להשיג את האם בנייד " + num + " בשעות הערב.");
  ok(hs.some((h) => h.text === num && h.apply && /PHONE/.test(h.type)), what + " digits: «" + num + "» deleted — got " + show(hs));
}

console.log("\n— a name copied out of a PDF, with letters in their presentation forms, is read as its letters —");
{
  // which letter each form is comes from Unicode's own decomposition, not from the engine's table
  const forms = [];
  for (let cp = 0xfb1d; cp <= 0xfb4f; cp++) {
    const ch = String.fromCodePoint(cp), d = ch.normalize("NFKD");
    if (/^[\u{5d0}-\u{5ea}]\p{M}*$/u.test(d)) forms.push([ch, d[0]]);
  }
  const wrong = forms.filter(([ch, b]) => C.norm(ch) !== b).map(([ch]) => hex(ch) + " as " + JSON.stringify(C.norm(ch)));
  ok(forms.length >= 40 && !wrong.length, `each of the ${forms.length} presentation forms is read as its letter — read otherwise: ${wrong.join(", ") || "none"}`);
  // «בּ» as a PDF writes it, at the head of a listed surname
  const w = "נעמה \u{fb31}רגר";
  ok(foundAs("העידה גם " + w + " מהמשרד.", "נעמה ברגר", w), "the listed «נעמה ברגר» found as a PDF writes it, «" + w + "»");
}

console.log("\n— a vowel or cantillation mark inside a listed name hides nothing —");
{
  // every Hebrew mark, by Unicode's own category: the vowel points, the dots and the cantillation marks
  const marks = [];
  for (let cp = 0x591; cp <= 0x5c7; cp++) { const ch = String.fromCodePoint(cp); if (/\p{Mn}/u.test(ch)) marks.push(ch); }
  const missed = marks.filter((mk) => !foundAs("העידה נ" + mk + "עמי לנדאו מהמשרד.", "נעמי לנדאו", "נ" + mk + "עמי לנדאו"));
  ok(marks.length >= 50 && !missed.length, `with each of the ${marks.length} marks after its first letter, the listed «נעמי לנדאו» is found — missed: ${missed.map(hex).join(" ") || "none"}`);
  // a mark on a word's last letter, before the space: the surname written first, and a furtive patah
  for (const [value, w] of [["לנדאו מרגלית", "לַנְדָּאוּ מַרְגָּלִית"], ["יהושע כהן", "יְהוֹשֻׁעַ כהן"]])
    ok(foundAs("בדיון העיד " + w + " מטעם הנתבעת.", value, w), "the listed «" + value + "» found as written with vowel marks, «" + w + "»");
  // the name was offered as the document wrote it once, with vowel marks: listed so, it is still found where it is written plain
  ok(foundAs("מרגלית לנדאו חתמה על התצהיר.", "מַרְגָּלִית לַנְדָּאוּ", "מרגלית לנדאו"), "listed with vowel marks, «מרגלית לנדאו» is found where it is written plain");
}

console.log("\n— the vowel mark after a name's last letter goes with the name, also in a line with a direction mark —");
{
  // left behind, the real name's dagesh sits on the substitute's last letter («… דהןּ», the outside review of 18.10, F7)
  const w = "מַרְגָּלִית לַנְדָּאוּ";
  ok(foundAs("\u{200f}העידה " + w + ", ואחריה בנה.", "מרגלית לנדאו", w), "the listed «מרגלית לנדאו» is replaced with the dagesh on its last letter, «" + w + "»");
}

console.log("\n— a character nobody sees, inside a mobile number, hides nothing —");
{
  const missed = HIDDEN.filter((c) => {
    const num = "054-77" + c + "12093";
    return !numbers("ניתן להשיג את המבקשת בנייד " + num + " בשעות הערב.").some((h) => h.text === num && h.apply && /PHONE/.test(h.type));
  });
  ok(!missed.length, `with each of the ${HIDDEN.length} characters inside it, the mobile is deleted, the character with it — missed: ${missed.map(hex).join(" ") || "none"}`);
}

(async () => {
  console.log("\n— the final check sees a listed name left with a character nobody sees inside it —");
  {
    const missed = [];
    for (const c of HIDDEN) {
      const v = await C.verify(docx(["פרוטוקול הדיון.", "העידה נעמה ויס" + c + "בורד אתמול."]), ["נעמה ויסבורד"], [], [], []);
      if (v.passed || !v.leaks.some((l) => l.value === "נעמה ויסבורד")) missed.push(c);
    }
    ok(!missed.length, `with each of the ${HIDDEN.length} characters inside the surname, the name left is a leak — missed: ${missed.map(hex).join(" ") || "none"}`);
  }

  console.log("\n— the final check sees a listed name left with a no-break space between its words —");
  for (const [what, sp] of [["a no-break space", "\u{a0}"], ["a figure space", "\u{2007}"], ["a narrow no-break space", "\u{202f}"]]) {
    const v = await C.verify(docx(["פרוטוקול הדיון.", "העידה עו\"ד רונית" + sp + "לוי אתמול."]), ["רונית לוי"], [], [], []);
    ok(!v.passed && v.leaks.some((l) => l.value === "רונית לוי"), what + ": the name left is a leak — " + JSON.stringify(v.leaks));
  }
  {
    // through the whole chain: the name with a no-break space in a part the tool does not rewrite stays there, and the bar is not green
    const res = await C.redactDocx(docx(["העידה רונית לוי אתמול."], [numbering("רשימה של רונית\u{a0}לוי")]), [NAME("רונית לוי")], [], OPT);
    const left = (await partOf(res, "word/numbering.xml")).includes("רונית\u{a0}לוי");
    ok(!left || !res.verification.passed, "a name left in the numbering with a no-break space: left " + left + ", the final check passed " + res.verification.passed);
  }

  console.log("\n— the final check reads a value as a person reads it, on the list as in the file —");
  {
    // the list holds the name as the document wrote it once, with vowel marks; a copy written plain is left
    const v = await C.verify(docx(["פרוטוקול הדיון.", "מרגלית לנדאו חתמה על התצהיר."]), ["מַרְגָּלִית לַנְדָּאוּ"], [], [], []);
    ok(!v.passed, "a name listed with vowel marks, left written plain, is a leak — " + JSON.stringify(v.leaks));
    // a number found with a zero-width space inside it; a copy written plain is left
    const w = await C.verify(docx(["פרוטוקול הדיון.", "הטלפון של המבקשת 054-7712093."]), ["054-77\u{200b}12093"], [], [], []);
    ok(!w.passed, "a number found with a hidden character inside, left written plain, is a leak — " + JSON.stringify(w.leaks));
    // through the whole chain: the plain copy sits in a part the tool does not rewrite, and the bar is not green
    const V = "מַרְגָּלִית לַנְדָּאוּ";
    const res = await C.redactDocx(docx(["העידה " + V + " מהמשרד."], [numbering("מרגלית לנדאו")]), [NAME(V)], [], OPT);
    const left = (await partOf(res, "word/numbering.xml")).includes("מרגלית לנדאו");
    ok(!left || !res.verification.passed, "listed with vowel marks, a plain copy in the numbering: left " + left + ", the final check passed " + res.verification.passed);
  }

  console.log("\n— the final check sees a date left with direction marks around its separators —");
  {
    const v = await C.verify(docx(["פרוטוקול הדיון.", "הדיון נקבע ליום 12\u{200e}/\u{200e}03\u{200e}/\u{200e}2026 בבוקר."]), [], ["12/03/2026"], [], []);
    ok(!v.passed && v.leaks.some((l) => l.value === "12/03/2026"), "the real date left is a leak — " + JSON.stringify(v.leaks));
  }

  console.log("\n— a replacement chosen for a name holds for its spelling with vowel marks, whichever is listed first —");
  for (const order of [[NAME("מַרְגָּלִית לַנְדָּאוּ"), NAME("מרגלית לנדאו", "שולמית קורן")], [NAME("מרגלית לנדאו", "שולמית קורן"), NAME("מַרְגָּלִית לַנְדָּאוּ")]]) {
    const res = await C.redactDocx(docx(["העידה מַרְגָּלִית לַנְדָּאוּ מהמשרד.", "מרגלית לנדאו חתמה על התצהיר."]), order, [], OPT);
    const out = res.preview.map((p) => p.text);
    ok(out[0] === "העידה שולמית קורן מהמשרד." && out[1] === "שולמית קורן חתמה על התצהיר.",
      "listed «" + order.map((s) => s.value).join("» then «") + "»: both read «שולמית קורן» — got " + JSON.stringify(out));
  }

  console.log("\n— the second scan reads past the tool's own replacement after hidden marks —");
  {
    // a line that opens with a direction mark and an isolate; the tool wrote «דנה כהן», marked where the text has it, and a known first name was left right after
    const t = "\u{200f}\u{2067}דנה כהן\u{2069} ושלומית אמרו שיגיעו.", s = t.indexOf("דנה");
    const got = C.secondScan([{ text: t, marks: [{ s, e: s + "דנה כהן".length }] }], [], []).map((x) => x.value);
    ok(JSON.stringify(got) === JSON.stringify(["שלומית"]), "the name left after the replacement is raised, the replacement is not — got " + JSON.stringify(got));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
