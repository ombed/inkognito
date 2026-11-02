/* The second review of fix-names (11.10), with the model off. Every document is invented.

   - A name read next to a lone label (the next line, the next cell, a column under a header) fills «מי בתיק» by itself
     only with evidence of a name: a known name, a legal caption (a «נגד» line, a numbered party list, party details
     under the name or in the table), a known name under the party label beside it, or the same name elsewhere in the
     document. «המבקשת:» over «מהנדסת תוכנה» filled the list and changed the text under a green bar.
   - A sender after a chat stamp fills the list by itself only when one of its words is a known name, and every word
     is checked as a slot's word is: «איסוף מהגן» or «חוג כדורגל» twice in a dated log filled the list.
   - A surname that opens with ו stays with its first name: «התובע: אורי וקנין נגד חברת הביטוח» listed «קנין נגד» by
     itself, and «לכבוד שירה ולדמן היקרה,» asked only about «שירה», so «ולדמן» went out beside an invented first name.
   - A role inside a name field («שם התובעת: …») is the role's, which fills the list; a surname after a known first
     name may end like a plural or look like a verbal noun («אורי נסים», «אורי מימון»).
   - Occupations, statuses, pleas, log labels, office titles, ranks, firms and things named in a «שם X:» field are not
     people; a plural party line goes through the slot checks. */
const fs = require("fs"), path = require("path");
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
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const CASES = require("./slots3-cases.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n)); ON.add("PLACES");
const FLAG = new Set(C.PAT.filter((p) => !p.on).map((p) => p.n)); FLAG.add("NAME_ANCHORED");
const OPT = { on: ON, flag: FLAG, mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" } };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const TC = (c) => `<w:tc>${[].concat(c).filter((x) => x !== "").map(P).join("") || "<w:p/>"}</w:tc>`;
const TBL = (rows) => `<w:tbl>${rows.map((r) => `<w:tr>${r.map(TC).join("")}</w:tr>`).join("")}</w:tbl>`;
const docx = (items) => mkzip([
  { name: "[Content_Types].xml", body: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
  { name: "_rels/.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  { name: "word/document.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    items.map((x) => (typeof x === "string" ? P(x) : x.raw ? x.raw : TBL(x.table))).join("") + "</w:body></w:document>" },
]);
// the page's rules for «מי בתיק» (as tests/slots_t.js mirrors page-component.js showPeople)
function autoList(cands) {
  const dt = new Set(cands.flatMap((c) => c.value.split(/\s+/)));
  return cands.filter((c) => {
    if (c.conf !== "high" || (!c.value.includes(" ") && !c.speaker)) return false;
    const w = c.value.split(/\s+/);
    if (w.length > 3 || !w.every((x) => x.length >= 2)) return false;
    return c.speaker || (w.every((x) => C.nameish(x, dt)) && w[0][0] !== "ו" && !w.some((x) => x[0] === "ה"));
  }).map((c) => c.value);
}
const proposed = (cands, auto) => cands.filter((c) => !auto.includes(c.value)).filter((c) => {
  const w = c.value.split(/\s+/);
  return w.length <= 3 && w.every((x) => x.length >= 2) && (w.length >= 2 || c.speaker || c.count >= 2);
}).map((c) => c.value);
// what the page lists and asks, and what reaches the AI with a list (by default the one it fills by itself)
async function run(items, list) {
  const cands = C.discover(await C.readBlocks(docx(items)));
  const auto = autoList(cands), sug = proposed(cands, auto);
  const res = await C.redactDocx(docx(items), (list || auto).map((v) => ({ value: v, kind: "NAME", replacement: "" })), [], OPT);
  const flagged = res.flagged.filter((f) => f.label === "שם (לפי הקשר)").map((f) => f.value);
  return { cands, auto, sug, flagged, out: res.preview.map((b) => b.text).join("\n"), done: !!res.verification.complete };
}
const show = (r) => "auto «" + r.auto.join(" | ") + "», proposed «" + r.sug.join(" | ") + "», asked «" + r.flagged.join(" | ") + "» → «" + r.out.replace(/\n/g, " ⏎ ") + "»";
const textOf = (items) => items.flatMap((x) => (typeof x === "string" ? [x] : x.table ? x.table.flat(2) : [])).join(" ");

(async () => {
  /* the review's three counterexample files. A few of them were asked about by v73.6 too, by the layers that read a word
     the document repeats; they are named here, and must at least fill nothing by themselves */
  const ALSO_BEFORE = new Set(["P6", "P12", "P13", "P14", "P15", "Q4", "Q5", "A4", "A17"]);
  for (const [file, label] of [["proto", "a role over an occupation, a status or a plea"], ["logs", "a dated log's two-word label"], ["fp", "ordinary legal Hebrew near the slots"]]) {
    console.log("\n— " + label + " (" + CASES[file].length + " documents) —");
    for (const c of CASES[file]) {
      const r = await run(c.items);
      const junk = (vs) => vs.filter((v) => c.words.some((w) => v.split(/\s+/).includes(w)));
      const id = c.id.split(" ")[0];
      ok(!junk(r.auto).length, c.id + ": fills nothing by itself — " + show(r));
      if (!ALSO_BEFORE.has(id)) ok(!junk([...r.sug, ...r.flagged]).length, c.id + ": asks nothing about it — " + show(r));
      // with nothing listed, what reaches the AI is the document's own text
      if (!r.auto.length) ok(c.words.every((w) => r.out.includes(w) || !textOf(c.items).includes(w)), c.id + ": the text reaches the AI as written — " + show(r));
    }
  }

  console.log("\n— a surname that opens with ו, with more after it on the line (5 names × 13 continuations × 4 labels) —");
  {
    const names = [["שירה", "ולדמן"], ["אורי", "וקנין"], ["דנה", "וייס"], ["יואב", "ורד"], ["מיכל", "וולך"]];
    const after = ["נגד חברת הביטוח", "ילידת 1985", "מחיפה", "תושבת חיפה", "מהנדס תוכנה", "שכנה של המשיב", "ע\"י ב\"כ עו\"ד אליאב פרוינדליך",
      "ת.ז. 034567891", ", ת.ז. 034567891", "היקרה,", "מנהל חשבונות", "ואח'", "בע\"מ"];
    const frames = [["role", (n) => "התובעת: " + n], ["matter", (n) => "בעניין: " + n], ["mail", (n) => "מאת: " + n], ["addressee", (n) => "לכבוד " + n]];
    let rows = 0, garbled = [], firstOnly = [], lostRole = [];
    for (const [fn, sn] of names) for (const [fk, f] of frames) for (const a of after) {
      const full = fn + " " + sn, line = f(full) + (a.startsWith(",") ? a : " " + a);
      const r = await run([line]);
      const all = [...new Set([...r.cands.map((c) => c.value), ...r.flagged])];
      rows++;
      if (all.some((v) => v !== full && v.includes(sn.slice(1)) && !v.includes(sn))) garbled.push(line + " «" + all.join(" | ") + "»");
      if (!all.includes(full) && all.includes(fn)) firstOnly.push(line + " «" + all.join(" | ") + "»");
      if (fk === "role" && !/^(?:בע"מ)$/.test(a) && !all.includes(full)) lostRole.push(line + " «" + all.join(" | ") + "»");
    }
    ok(!garbled.length, "no candidate splits the surname from its ו (" + garbled.length + " of " + rows + "): " + garbled.slice(0, 3).join(" · "));
    ok(!firstOnly.length, "no line asks only about the first name (" + firstOnly.length + " of " + rows + "): " + firstOnly.slice(0, 3).join(" · "));
    ok(!lostRole.length, "after a role on the same line the whole name is read (" + lostRole.length + "): " + lostRole.slice(0, 3).join(" · "));
  }
  for (const [items, want, keep, label] of [
    [["התובע: אורי וקנין נגד חברת הביטוח"], "אורי וקנין", "נגד חברת הביטוח", "the role's name, then «נגד»"],
    [["התובעת: שירה ולדמן ילידת 1985"], "שירה ולדמן", "ילידת 1985", "the role's name, then the year of birth"],
    [["המבקשת: דנה וולפסון תושבת חיפה"], "דנה וולפסון", "תושבת", "the role's name, then the residence"],
  ]) {
    const r = await run(items);
    ok(r.auto.includes(want) && r.out.includes(keep) && !r.out.includes(want.split(" ")[1].slice(1)), label + ": the whole name fills the list, the rest of the line stays — " + show(r));
  }
  for (const [items, want, label] of [
    [["לכבוד שירה ולדמן היקרה,", "שלום רב,"], "שירה ולדמן", "a letter to a person whose surname opens with ו"],
    [["מאת: אורי וקנין מנהל חשבונות", "נשלח: יום ראשון"], "אורי וקנין", "a mail line, a job after the name"],
    [["העתק: יואב וולך מנהל המחלקה"], "יואב וולך", "a copy line, a job after the name"],
    [["לכבוד", "דנה וייס מנהלת הלשכה"], "דנה וייס", "«לכבוד» over the name and a job"],
  ]) {
    const r = await run(items);
    const all = [...r.auto, ...r.sug, ...r.flagged];
    ok(all.includes(want) && !all.includes(want.split(" ")[0]), label + ": the whole name is asked about, not the first name alone — " + show(r));
    const r2 = await run(items, [want]);
    ok(!r2.out.includes(want.split(" ")[1]), label + ": once accepted, the surname is gone — " + show(r2));
  }

  console.log("\n— a relative after the name is not its surname —");
  for (const [items, kin] of [[["התובעת: נגה ובתה"], "בתה"], [["לכבוד נגה ומשפחתה"], "משפחתה"], [["מאת: נגה וילדיה"], "ילדיה"], [["המבקש: אורי ואשתו"], "אשתו"]]) {
    const r = await run(items);
    const all = [...r.cands.map((c) => c.value), ...r.flagged];
    ok(!all.some((v) => v.includes(kin)), "«" + items[0] + "»: «" + kin + "» is not part of a name — " + show(r));
  }
  {
    // a couple's second first name that is also a word of kinship is still a name
    const r = await run(["התובעת: נגה ובני כהן"]);
    ok([...r.auto, ...r.sug, ...r.flagged].includes("בני כהן"), "«נגה ובני כהן»: a couple, «בני כהן» is found — " + show(r));
  }

  console.log("\n— a party's name in a name field, and surnames that end like a plural —");
  for (const role of ["התובעת", "התובע", "הנתבעת", "המבקשת", "המבקש", "המשיב", "הקטין", "הקטינה", "המנוח", "המנוחה", "המערער"]) {
    const r = await run(["שם " + role + ": נגה טרכטנגוט"]);
    ok(r.auto.includes("נגה טרכטנגוט"), "«שם " + role + ":» fills the list as the role does — " + show(r));
  }
  for (const sur of ["נסים", "מימון", "טובים", "מרגליות", "כרים", "סלים", "שלבי"]) {
    for (const items of [["התובע: אורי " + sur], ["התובע:", "אורי " + sur]]) {
      const r = await run(items);
      ok(r.auto.includes("אורי " + sur), "«" + items.join(" ⏎ ") + "»: the surname is a surname — " + show(r));
    }
  }

  console.log("\n— party tables: a role over an occupation, a status or an income —");
  const T = (rows) => ({ table: rows.map((r) => r.map((c) => [c])) });
  for (const [label, items, words] of [
    ["T1 an empty corner, roles over occupation and income", [T([["", "התובעת", "הנתבע"], ["עיסוק", "מהנדסת תוכנה", "מכונאי רכב"], ["הכנסה חודשית", "25,000", "12,000"]])], ["מהנדסת", "מכונאי"]],
    ["T3 roles over occupations", [T([["התובעת", "הנתבע"], ["מהנדסת תוכנה", "מכונאי רכב"]])], ["מהנדסת", "מכונאי"]],
    ["T5 the role first, then occupation and income", [T([["התובעת", "מהנדסת תוכנה", "25,000"], ["הנתבע", "מכונאי רכב", "12,000"]])], ["מהנדסת", "מכונאי"]],
    ["T6 roles over statuses", [T([["התובעת", "הנתבע"], ["אלמנה צעירה", "נשוי בשנית"]])], ["אלמנה", "נשוי"]],
    ["T9 songs under «שם השיר»", [T([["שם השיר", "מבצע"], ["ירושלים של זהב", "נעמי שמר"]])], ["מבצע", "ירושלים"]],
    ["T10 models under «שם הדגם»", [T([["שם הדגם", "שנה"], ["טויוטה קורולה", "2018"]])], ["טויוטה", "קורולה"]],
  ]) {
    const r = await run(items);
    const junk = [...r.auto, ...r.sug, ...r.flagged].filter((v) => words.some((w) => v.split(/\s+/).includes(w)));
    ok(!junk.length, label + ": no occupation, status or thing is a person — " + show(r));
  }
  {
    // the same table with the names in the row under the roles: the names fill the list, the jobs below them do not
    const r = await run([T([["התובעת", "הנתבע"], ["נגה טרכטנגוט", "אליאב פרוינדליך"], ["מהנדסת תוכנה", "מכונאי רכב"]])]);
    ok(r.auto.includes("נגה טרכטנגוט") && r.auto.includes("אליאב פרוינדליך") && !r.auto.some((v) => /מהנדסת|מכונאי/.test(v)),
      "T7 names in the row under the roles fill the list, the jobs do not — " + show(r));
  }

  console.log("\n— a caption's evidence, and its counterexample —");
  for (const [items, label] of [
    [["התובעת:", "נגה טרכטנגוט", "נ ג ד", "הנתבע:", "אליאב פרוינדליך"], "a «נגד» line between the parties"],
    [["המשיבים -", "(1) נגה טרכטנגוט", "(2) אליאב פרוינדליך"], "a numbered list of parties"],
    [["הקטינה:", "ליה טרכטנגוט", "באמצעות אמה"], "party details under the name"],
    [[{ table: [[["התובעת:"], ["נגה טרכטנגוט"]], [["הנתבע:"], ["אליאב פרוינדליך"]]] }], "a known name under the other party's label in the table"],
  ]) {
    const r = await run(items);
    const want = items.flatMap((x) => (typeof x === "string" ? [x] : [])).map((x) => x.replace(/^\(\d\)\s*/, "")).filter((x) => /טרכטנגוט|פרוינדליך/.test(x));
    ok(want.every((n) => r.auto.includes(n)), label + ": the caption's names fill the list — " + show(r));
  }
  {
    // the same two lines without any of that: a description is asked about at most, never listed
    const r = await run(["המבקשת:", "סטודנטית לרפואה"]);
    ok(!r.auto.length && r.out.includes("סטודנטית לרפואה"), "a role over a description alone: nothing fills the list — " + show(r));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
