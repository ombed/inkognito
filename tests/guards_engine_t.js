/* Guards on what the engine finds and what replaces it (engine/07-engine.js: the Engine constructor, detectSeen, repFor).
   Each block closes a gap found by planting a small bug in that code on purpose: every other suite stayed green. The
   result lock (bench/lock.js) saw one of them, but only as a difference from main, which a change made on purpose shows
   too. A bug there leaves a real name in the document, or changes which invented name a person gets. Invented names only. */
const C = require("./core.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
const R = (value, more) => ({ value, kind: "NAME", replacement: "", auto: true, ...(more || {}) });
// every replaced value of the document → what replaces it, keyed by the rule it came from
const reps = (text, rules) => {
  const e = new C.Engine(rules, [], OPT, text), out = {};
  for (const h of e.detect(text)) if (h.apply) out[h.base || h.text] = e.repFor({ ...h, pre: "" });
  return out;
};

console.log("\n— a pinned name that a label style drops does not hold its invented name back from the others —");
{
  /* A replacement pinned after a run (pinReps on the page) counts only while the style is "name"; under a label style it
     is dropped. It has to be dropped before the replacements already chosen are reserved, or the dropped name still
     blocks the invented name it held, and every other person in the document gets another invented name than the one
     the same document gives them without the pin. */
  const text = "נועה ברזילי הגישה תביעה. אורי שמש השיב לה.";
  const free = reps(text, [R("אורי שמש")])["אורי שמש"];
  ok(!!free && free !== "אורי שמש", "(without a pin, «אורי שמש» gets an invented name: " + free + ")");
  const out = reps(text, [R("נועה ברזילי", { replacement: free, pinned: true, style: "label" }), R("אורי שמש")]);
  ok(out["נועה ברזילי"] !== free, "the pinned «נועה ברזילי» under a label style is not given its pinned name: " + out["נועה ברזילי"]);
  ok(out["אורי שמש"] === free, `«אורי שמש» keeps the invented name it gets without the pin: ${out["אורי שמש"]}, expected ${free}`);
}

console.log("\n— a short surname of the document, written with a prefix letter, is never given to another person —");
{
  /* «וכהן» in the document is the real «כהן» with «ו» before it. The engine forbids the word without its prefix letter
     as an invented name, from four letters with the prefix (tests/forbidden_t.js holds the long words and the cut that
     must not happen). Here the shortest form: a three-letter surname of the invented pool, met only with a prefix. */
  const FIRST = ["נועה", "אורי", "דנה", "יואב", "מיכל", "עידו", "שירה", "גלעד"], SUR = ["ברזילי", "שמש", "שגיא", "אלמוג", "קלדרון", "רימון"];
  let found = null;
  for (const f of FIRST) for (const s of SUR) {
    if (found) break;
    const v = f + " " + s, fake = reps(v + " הגיש תביעה.", [R(v)])[v] || "", sur = fake.split(/\s+/).slice(-1)[0];
    if (sur.length === 3 && /^[א-ת]+$/.test(sur)) found = { v, fake, sur };
  }
  ok(!!found, "(some invented person gets a three-letter invented surname to test with)");
  if (found) {
    const text = found.v + " הגיש תביעה. העד ו" + found.sur + " השיב לשאלות.";
    const fake = reps(text, [R(found.v)])[found.v] || "";
    ok(!fake.split(/\s+/).includes(found.sur), `with «ו${found.sur}» in the document, «${found.v}» is not given «${found.sur}»: ${fake} (without it: ${found.fake})`);
  }
}

console.log("\n— a listed short name that is also a word is replaced as written; only its prefixed forms may wait for review —");
{
  /* «אור» is a name and a word. A form with a prefix letter that is itself a word («לאור») may be held for review
     instead of replaced; the name as it stands on the list never is: held, it stays in the document. */
  const text = "התובעת אור הגישה תביעה. אור טענה כי צדקה.";
  const e = new C.Engine([R("אור")], [], OPT, text);
  const hits = e.detect(text);
  const at = [...text.matchAll(/(?<![א-ת])אור(?![א-ת])/g)].map((m) => m.index);
  const done = at.filter((i) => hits.some((h) => h.apply && h.s === i && h.e === i + 3));
  ok(at.length === 2 && done.length === 2, `both «אור» are replaced, not held for review: ${done.length} of ${at.length}`);
}

console.log("\n— an approved body's own name, without its type word, is replaced on its own too —");
{
  /* «עמותת ברקאי» approved: «ברקאי» alone later in the text is the same body, like a surname alone is the same person.
     A one-word name is taken alone from five letters; below that a short word could be a plain word of the text. */
  const text = "עמותת ברקאי הגישה בקשה. לטענת ברקאי, הבקשה דחופה. גם בברקאי ידעו על כך.";
  const e = new C.Engine([{ value: "עמותת ברקאי", kind: "ORG", replacement: "", auto: true }], [], OPT, text);
  const hits = e.detect(text).filter((h) => h.apply);
  const at = [...text.matchAll(/ברקאי/g)].map((m) => m.index);
  const covered = at.filter((i) => hits.some((h) => h.s <= i && i + 5 <= h.e));
  ok(covered.length === at.length, `every «ברקאי» is replaced: ${covered.length} of ${at.length}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
