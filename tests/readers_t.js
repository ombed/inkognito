/* Every reader of the document reads the text a person reads (outside review of 18.10, F1 and F4; lens 1).

   A character nobody sees, inside a name that appears once, split the name in two for every reader that did not
   squeeze the text first. The model read «נעמה ויסבורד» with a zero-width space inside the surname as a first name
   and a stray word, so the surname reached the AI; the second scan read the two halves and raised neither; the
   final check looked for the listed name and did not see it with the character inside; the word reader of the body
   scan and the near-miss check split the word too. The status bar was green. The detection layers already read the
   squeezed text (tests/invisible_t.js, names on the list); this suite checks the others, with every character of
   the class the engine squeezes (derived from the engine, so the suite grows with it) and at every place inside the
   name. A vowel mark is read the same way by the word readers: it is inside the word, not a boundary.

   The model is a stand-in with the real pipeline's shape (transformers.js token classification): the tokenizer
   drops format characters as BERT's normalizer does, a word splits into pieces of at most three letters, only the
   first piece carries a label, and no offsets come back, so nerRun aligns the pieces itself. It knows the people of
   the document by what a reader sees. Every name here is invented. */
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
const HERE = __dirname;
const E = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, doc, base } = require("./structure-lib.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const zipOf = (lines) => mkzip([...base, { name: "word/document.xml", body: doc(lines.map((l) => P(R(l))).join("")) }]);
const NAME = (v) => ({ value: v, kind: "NAME", replacement: "" });
const OPT = { on: new Set(E.PAT.filter((p) => p.on).map((p) => p.n)), flag: new Set(), mode: "real", near: true, body: true, prefixes: "normal", styles: {} };

// the class, as the engine defines it: every character it squeezes out of what a reader sees
const CLASS = [];
for (let c = 0; c <= 0xffff; c++) if (!(c >= 0xd800 && c <= 0xdfff) && E.INVIS.test(String.fromCharCode(c))) CLASS.push(String.fromCharCode(c));
const hex = (ch) => "U+" + ch.charCodeAt(0).toString(16).padStart(4, "0");
const ANY = new RegExp("[" + CLASS.map((ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0")).join("") + "]");
const read = (s) => String(s).replace(new RegExp(ANY.source, "g"), "");   // what a person reads
// every way to put ch inside the word w: after each of its letters but the last
const inside = (w, ch) => [...Array(w.length - 1).keys()].map((i) => w.slice(0, i + 1) + ch + w.slice(i + 1));

// the stand-in for the model (see the header): seen collects every text it was given
function standIn(people, seen) {
  const known = people.map((p) => p.split(" "));
  return async (t) => {
    seen.push(t);
    const ws = t.replace(/\p{Cf}/gu, "").match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
    const lab = ws.map(() => "O");
    for (let i = 0; i < ws.length; i++) for (const k of known) {
      if (k.every((w, j) => ws[i + j] === w)) k.forEach((_, j) => { lab[i + j] = j ? "I-PER" : "B-PER"; });
    }
    const out = [];
    ws.forEach((w, i) => {
      for (let p = 0; p < w.length; p += 3) out.push({ entity: p ? "O" : lab[i], score: 0.99, word: (p ? "##" : "") + w.slice(p, p + 3) });
    });
    return out;
  };
}

/* The chain the product runs: the rule candidates and the model's names go on the list, the document is redacted,
   and the result is checked. For one document, as a person reads it: what was found, what is left of the people,
   whether the bar is green, and what the second scan raised. */
async function chain(lines, people) {
  const buf = zipOf(lines), seen = [];
  const model = standIn(people, seen);
  E.swap("nerLoad", async () => model);
  const blocks = await E.readBlocks(buf.slice(0));
  const log = console.log; console.log = () => {};   // nerRun reports its counts on the console
  let found; try { found = (await E.nerRun(blocks)).map((f) => f.value); } finally { console.log = log; }
  const rules = [...new Set([...E.discover(blocks).map((c) => c.value), ...found])].map(NAME);
  const res = await E.redactDocx(zipOf(lines), rules, [], OPT);
  const out = read(res.preview.map((p) => p.text).join("\n"));
  const left = people.flatMap((p) => p.split(" ")).filter((w) => new RegExp("(^|[^א-ת])" + w + "(?![א-ת])").test(out));
  return { found: found.map(read).sort(), left, passed: res.verification.passed, second: (res.second || []).map((s) => read(s.value)).sort(), seen, blocks };
}

(async () => {
  console.log(`\n— the class: ${CLASS.length} characters the engine squeezes —`);
  ok(CLASS.length >= 20 && CLASS.includes("\u200b") && CLASS.includes("\ufeff") && CLASS.includes("\u00ad"), "the zero-width space, the BOM and the soft hyphen are in it: " + CLASS.map(hex).join(" "));

  console.log("\n— the word reader: a hidden character or a vowel mark is inside the word —");
  for (const ch of CLASS) {
    const t = "העידה " + "ויס" + ch + "בורד" + " אתמול", ws = E.words(E.norm(t)), w = ws.find((x) => x.w.startsWith("ויס"));
    ok(w && w.w === "ויסבורד" && t.slice(w.s, w.e) === "ויס" + ch + "בורד", hex(ch) + ": one word, its place in the text: " + JSON.stringify(ws.map((x) => x.w)));
  }
  {
    const t = "העידה וַיסְבּוֹרְד אתמול", w = E.words(E.norm(t))[1];
    ok(w && w.w === "ויסבורד" && t.slice(w.s, w.e) === "וַיסְבּוֹרְד", "with vowel marks: one word, its place in the text: " + JSON.stringify(w));
  }

  console.log("\n— the model reads what a person reads —");
  const F1 = ["סיכום שיחה עם הלקוחה", "הלקוחה, גב' מירב אלקלעי, סיפרה כי השכן איים עליה.",
    "עוד סיפרה כי עמיתתה לעבודה, נעמה ויסבורד, ראתה את האירוע.", "מירב אלקלעי מבקשת לבדוק אפשרות לצו הרחקה."];
  const F1_PEOPLE = ["מירב אלקלעי", "נעמה ויסבורד"];
  const F4 = ["סיכום פגישה", "בנם, יהונתן ברדוגו, למד אצל המורה בשנה שעברה.", "האם, אורלי ברדוגו, ביקשה לבדוק."];
  const F4_PEOPLE = ["יהונתן ברדוגו", "אורלי ברדוגו"];
  const base1 = await chain(F1, F1_PEOPLE), base4 = await chain(F4, F4_PEOPLE);
  const sum = (r) => JSON.stringify({ found: r.found, left: r.left, passed: r.passed, second: r.second });
  ok(base1.found.includes("נעמה ויסבורד") && !base1.left.length && base1.passed, "control, F1 as written: found, replaced, green: " + sum(base1));
  ok(base4.found.includes("יהונתן ברדוגו") && !base4.left.length && base4.passed, "control, F4 as written: found, replaced, green: " + sum(base4));

  // each character of the class in the middle of the once-mentioned surname, and the two the review met at every place
  const variants = (lines, word, people) => [
    ...CLASS.map((ch) => ({ ch, w: word.slice(0, 3) + ch + word.slice(3) })),
    ...["\u200b", "\ufeff"].flatMap((ch) => inside(word, ch).map((w) => ({ ch, w }))),
  ].map((v) => ({ ...v, lines: lines.map((l) => l.replace(word, v.w)), people }));
  const cases = [
    ...variants(F1, "ויסבורד", F1_PEOPLE).map((v) => ({ ...v, base: base1, who: "F1 surname" })),
    ...variants(F4, "יהונתן", F4_PEOPLE).map((v) => ({ ...v, base: base4, who: "F4 first name" })),
  ];
  for (const c of cases) {
    const r = await chain(c.lines, c.people), tag = `${c.who}, ${hex(c.ch)} in «${read(c.w)}» at ${c.w.indexOf(c.ch)}`;
    ok(!r.seen.some((t) => ANY.test(t)), tag + ": the model was given a character nobody sees");
    ok(JSON.stringify(r.found) === JSON.stringify(c.base.found), tag + ": the model finds what it finds in the text as written: " + JSON.stringify(r.found));
    ok(!r.left.length && r.passed === c.base.passed && JSON.stringify(r.second) === JSON.stringify(c.base.second),
      tag + ": the result reads as the one of the text as written: " + JSON.stringify({ left: r.left, passed: r.passed, second: r.second }));
  }
  {
    // the leak report reads the model's spans in the blocks' own text (page-logic.js leakShape)
    const lines = F1.map((l) => l.replace("ויסבורד", "\u2068ויס\u200bבורד\u2069")), r = await chain(lines, F1_PEOPLE);
    const joined = r.blocks.map((x) => x.text).join("\n"), spans = E.nerLast().map((s) => read(joined.slice(s.s, s.e)));
    ok(spans.includes("נעמה ויסבורד") && spans.includes("מירב אלקלעי"), "the model's spans point at the names in the original text: " + JSON.stringify(spans));
  }

  console.log("\n— a speaker on a line of their own is read as a person reads the line —");
  {
    // JavaScript's \s takes the BOM for a space: the line split into two words of two letters and the speaker stayed (bench/invisible.js)
    const lines = (who) => ["תמלול שיחה", who, "קשה לי לומר בדיוק מתי זה התחיל, אבל זה היה מזמן.", "אורנה", "ומה קרה אחר כך עם הדירה שלכם?"];
    const speakers = async (who) => E.discover(await E.readBlocks(zipOf(lines(who)).slice(0))).map((c) => read(c.value));
    ok((await speakers("שקמונה")).includes("שקמונה"), "control: the speaker as written is proposed: " + JSON.stringify(await speakers("שקמונה")));
    for (const ch of CLASS) {
      const got = await speakers("שקמ" + ch + "ונה");
      ok(got.includes("שקמונה"), hex(ch) + ": the speaker with it inside is proposed, as read: " + JSON.stringify(got));
    }
  }

  console.log("\n— the second scan reads what a person reads —");
  const scan = (text, marks, subs) => E.secondScan([{ text, marks: marks || [] }], [], subs || []).map((s) => s.value);
  for (const ch of CLASS) {
    const t = "נכחו בדיון גם שלו" + ch + "מית מהמשרד.";
    ok(JSON.stringify(scan(t)) === JSON.stringify(["שלומית"]), hex(ch) + ": a known first name left with it inside is raised, as read: " + JSON.stringify(scan(t)));
  }
  {
    const t = "נכחו בדיון גם שְׁלוֹמִית מהמשרד.";
    ok(scan(t).length === 1 && read(scan(t)[0]).replace(/[֑-ׇ]/g, "") === "שלומית", "with vowel marks too: " + JSON.stringify(scan(t)));
    const s = "העידה גם ויס\u200bבורד מהמשרד.";
    ok(JSON.stringify(scan(s, [], [NAME("נעמה ויסבורד")])) === JSON.stringify(["ויסבורד"]), "a word of a listed name left alone, with it inside: " + JSON.stringify(scan(s, [], [NAME("נעמה ויסבורד")])));
    // the tool's own replacement is marked in the original text; after hidden characters the mark still covers it
    const w = "\u200f\u2068שלומית אדרי\u2069\u200f אמרה", at = w.indexOf("שלומית");
    ok(scan(w, [{ s: at, e: at + "שלומית אדרי".length }]).length === 0, "what the tool wrote is still not raised after hidden characters: " + JSON.stringify(scan(w, [{ s: at, e: at + 11 }])));
  }

  console.log("\n— the final check reads what a person reads —");
  for (const [label, left] of [["a zero-width space", "ויס\u200bבורד"], ["a BOM", "ויסבו\ufeffרד"], ["a soft hyphen", "ויס\u00adבורד"], ["vowel marks", "וַיסְבּוֹרְד"]]) {
    const res = await E.redactDocx(zipOf(["פרוטוקול.", "העידה נעמה " + left + " אתמול."]), [], [], OPT);
    const v = await E.verify(await res.blob.arrayBuffer(), ["נעמה ויסבורד"], [], [], []);
    ok(!v.passed && v.leaks.some((l) => l.value === "נעמה ויסבורד"), "a listed name left with " + label + " inside is a leak: " + JSON.stringify(v.leaks));
  }
  {
    const res = await E.redactDocx(zipOf(["פרוטוקול.", "העידה נעמה ויס\u200bבורד אתמול."]), [NAME("נעמה ויסבורד")], [], OPT);
    ok(res.verification.passed && !read(res.preview.map((p) => p.text).join("\n")).includes("ויסבורד"), "control: listed, it is replaced and the check passes");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
