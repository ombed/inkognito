/* Builds engine/05-common.js: common Hebrew words, in the forms they are written, that are not a person's name. A layer
   that proposes a name for her to check does not propose a value whose every word is one of them (the second blind
   test: in public Supreme Court rulings, «מאסר», «נקבע», «במסגרתה», «עליו» were proposed as names).

   Sources, both outside the repository (only the list comes in):
   1. IAHLT hebrew_named_entities_open_dataset (Apache-2.0; github.com/IAHLT/hebrew_named_entities_open_dataset,
      unique_hebrew_samples_no_duplicates.jsonl): news sentences with their named entities marked. A word is common
      when it appears at least three times outside every entity, at most once inside a person's name, and less than
      a third of the time inside a place.
   2. A spread sample of decisions from LevMuchnik/SupremeCourtOfIsrael (Hugging Face, OpenRAIL), for the legal
      words news lacks: a word in at least half a percent of the decisions, never right after a title (עו"ד, השופט,
      גב'…), an initial or a known first name, never in the decisions' name fields (judges, lawyers, parties), and
      not used in a person's name in (1).
   Never in the list: a known first name, a name that doubles as a word (WORDLIKE), the pool of invented names, a known
   town, a word under three letters. The output is sorted, so the same sources give the same file.

   usage: node scripts/build-common-words.js <iahlt.jsonl> <rulings-sample.json>   (writes engine/05-common.js) */
const fs = require("fs"), path = require("path");
const E = require("../bench/engine.js");
const [iahlt, rulings] = process.argv.slice(2);
if (!iahlt || !rulings) { console.error("usage: node scripts/build-common-words.js <iahlt.jsonl> <rulings-sample.json>"); process.exit(2); }
const clean = (s) => E.norm(String(s || "").replace(/[֑-ׇ]/g, ""));
const WRX = /[א-ת](?:[א-ת"']*[א-ת])?/gu;
const inc = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);

// never in the list
const pool = Object.values(E.POOL || {}).flat();
const NAMES = new Set([...E.KNOWN_FIRST, ...E.WORDLIKE, ...pool].map(clean));
// a town in a spelling the gazetteer lacks, and first names that are also words, found by reading the list and testing
// 170 first names against it (13.10)
const NOT_COMMON = new Set(["ירושלם", "אושרה", "אהובה", "לבנה"]);
const isPlace = (w) => NOT_COMMON.has(w) || NOT_COMMON.has(w.replace(/^[ובלמכשה]/u, "")) || !!(E.PLACE_BY && (E.PLACE_BY[w] || E.PLACE_BY[w.replace(/^[ובלמכשה]/u, "")]));
const plainWord = (w) => w.length >= 3 && !/["']/.test(w) && !NAMES.has(w) && !isPlace(w);

// 1. news, with its entities
const plain = new Map(), per = new Map(), place = new Map();
for (const line of fs.readFileSync(iahlt, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const j = JSON.parse(line), t = clean(j.text), lab = j.label || [];
  for (const m of t.matchAll(WRX)) {
    const s = m.index, e = s + m[0].length, at = lab.find(([a, b]) => a < e && s < b), type = at && at[2];
    if (type === "PER") inc(per, m[0]); else if (type === "GPE" || type === "LOC" || type === "FAC") inc(place, m[0]);
    else if (!type || type === "TIMEX" || type === "TTL") inc(plain, m[0]);
  }
}
// a word ever written as (part of) a person's name is out: «מזל», «אושרה» are first names that news rarely shows as such
const news = new Set();
for (const [w, p] of plain) if (plainWord(w) && p >= 3 && !per.has(w) && (place.get(w) || 0) < p / 2) news.add(w);

// 2. decisions, for the legal words news lacks
// the sample is runs of 100 consecutive decisions across the dataset: one case's names repeat inside its run, so a
// legal word must also appear in at least six of the runs
const rows = JSON.parse(fs.readFileSync(rulings, "utf8")).map((r, i) => ({ ...r, run: Math.floor(i / 100) })).filter((r) => r.text && r.text.length > 200);
const runs = new Map();
const fieldNames = new Set(rows.flatMap((r) => (r.names || []).flatMap((x) => clean(x).match(WRX) || [])));
const TITLE = /^(?:עו"ד|עוה"ד|השופט|השופטת|השופטים|הנשיא|הנשיאה|לנשיא|לנשיאה|כב'|כבוד|מר|גב'|ד"ר|פרופ'|הרב|רו"ח|הנ"ל)$/u;
const df = new Map(), afterName = new Map();
for (const r of rows) {
  const ws = clean(r.text).match(/\S+/g) || [], seen = new Set();
  for (let i = 0; i < ws.length; i++) {
    const w = (ws[i].match(WRX) || [""])[0]; if (!w) continue;
    if (!seen.has(w)) { seen.add(w); inc(df, w); if (!runs.has(w)) runs.set(w, new Set()); runs.get(w).add(r.run); }
    const prev = ws[i - 1] || "";
    if (TITLE.test(prev) || /^[א-ת]['׳]$/u.test(prev) || E.KNOWN_FIRST.has(prev)) inc(afterName, w);
  }
}
const legal = new Set();
for (const [w, d] of df) if (plainWord(w) && d >= rows.length * 0.005 && runs.get(w).size >= 6 && !afterName.has(w) && !fieldNames.has(w) && (per.get(w) || 0) <= 1) legal.add(w);

// and no word of the decisions' name fields (judges, lawyers, parties) on either side: real names, many of them first
// names that are also words. They only filter; none of them is written out
const words = [...new Set([...news, ...legal])].filter((w) => !fieldNames.has(w)).sort();
const out = `/* ══════════════════════════ מילים נפוצות ══════════════════════════ */
/* נוצר בידי scripts/build-common-words.js — לא לערוך ביד. מילים נפוצות בעברית, בצורות שבהן הן נכתבות, שאינן שם של אדם.
   שכבה שמציעה שם לבדיקה אינה מציעה ערך שכל המילים בו נפוצות (worthAsking): בבדיקה העיוורת השנייה הוצעו כשמות «מאסר»,
   «נקבע», «במסגרתה», «עליו». מקורות: IAHLT hebrew_named_entities_open_dataset (Apache-2.0) — מילים שמופיעות לפחות שלוש
   פעמים מחוץ לכל ישות ולכל היותר פעם אחת בשם של אדם; ומדגם של ${rows.length} החלטות מ-LevMuchnik/SupremeCourtOfIsrael (OpenRAIL)
   — מילים בחצי אחוז מהן ובשש מעשרים הריצות שבמדגם, אף פעם לא אחרי תואר, ראשי תיבות של שם או שם פרטי מוכר, ולא בשדות השמות. בלי שמות פרטיים מוכרים,
   בלי מאגר השמות הבדויים, בלי יישובים ובלי מילים של פחות משלוש אותיות. ${words.length} מילים. */
const COMMON_WORDS=new Set(${JSON.stringify(words.join(" "))}.split(" "));
`;
fs.writeFileSync(path.join(__dirname, "..", "engine", "05-common.js"), out);
console.log(`engine/05-common.js: ${words.length} words (news ${news.size}, decisions ${legal.size}, both ${news.size + legal.size - words.length}), ${Math.round(out.length / 1024)} KB`);
