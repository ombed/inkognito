/* The second scan (secondScan, engine/08-docx.js; the owner's decision of 12.10) on the synthetic corpus: how often it
   catches a detail the cleaning left, and how often it raises a false alarm. The owner's bar before it ships: about one
   false alarm per document at most. Runs the chain as the benchmark does (no model, every suggestion accepted), then
   compares each finding with the key: a finding inside a detail that must be replaced is a catch; anything else is a
   false alarm. Synthetic documents only: the private set is never read here.

     node bench/second-scan.js            # totals, and the false alarms by document
*/
const E = require("./engine.js");
const { makeBench, KEY } = require("./lib.js");
const B = makeBench(E);
const n = (s) => E.norm(String(s || "")).replace(/\u0000/g, "").trim();
const words = (s) => n(s).split(/\s+/).filter(Boolean);

(async () => {
  let found = 0, caught = 0, alarms = 0;
  const byDoc = [], leakedPeople = new Set(), caughtLeaks = new Set();
  let docsLeaking = 0, docsAmber = 0;
  for (const doc of KEY.docs) {
    const r = await B.runDoc(null, doc);
    const s = B.scoreDoc(doc, r);
    for (const row of s.rows) if (row.leaked && /^P_|^NAME/.test(row.cat || "")) leakedPeople.add(doc.id + "|" + row.canonical);
    const leaks = s.rows.some((row) => row.leaked && /^P_|^NAME/.test(row.cat || ""));
    if (leaks) docsLeaking++;
    if (leaks && (r.second || []).length) docsAmber++;
    const must = doc.entities.filter((x) => x.must);
    const fa = [];
    for (const f of r.second || []) {
      found++;
      const v = n(f.value), bare = (w) => w.replace(/^[ובהלמכש]/, "");
      const hit = must.find((x) => (x.surfaces || [x.canonical]).some((sf) => words(sf).some((w) => w === v || bare(w) === v || w === bare(v) || bare(w) === bare(v)) || n(sf) === v));
      if (hit) { caught++; caughtLeaks.add(doc.id + "|" + hit.canonical); }
      else { alarms++; fa.push(f.kind + ":" + f.value); }
    }
    if (fa.length) byDoc.push(`${doc.id}: ${fa.join(", ")}`);
  }
  const docs = KEY.docs.length;
  console.log(`second scan on ${docs} synthetic documents: ${found} findings, ${caught} inside a detail that must go, ${alarms} false alarms (${(alarms / docs).toFixed(2)} per document)`);
  const hitLeaks = [...leakedPeople].filter((k) => caughtLeaks.has(k)).length;
  console.log(`people the cleaning left (leaked): ${leakedPeople.size}; the scan points at ${hitLeaks} of them`);
  console.log(`documents where a person was left: ${docsLeaking}; the status there turns amber instead of green in ${docsAmber}`);
  if (byDoc.length) console.log("\nfalse alarms by document:\n  " + byDoc.join("\n  "));
  /* --claims README.md: README's "Known limits" quotes these two numbers; they are held to the measurement on
     every change (CI, beside the blind test's figures), so a change that moves them updates the sentence with it.
     The outside review of 18.10 found 28 there where the measurement was 27. */
  const at = process.argv.indexOf("--claims");
  if (at > 0) {
    const md = require("fs").readFileSync(process.argv[at + 1], "utf8");
    const m = /turns (\d+) of the (\d+) benchmark documents that still leak a person amber; the other (\d+) still end green/.exec(md);
    const want = [docsAmber, docsLeaking, docsLeaking - docsAmber];
    if (!m) { console.log(`claims: ${process.argv[at + 1]} has no second-scan sentence`); process.exitCode = 1; }
    else if (m.slice(1).map(Number).join() !== want.join()) {
      console.log(`claims: README says ${m[1]} of ${m[2]}, the other ${m[3]}; measured ${want[0]} of ${want[1]}, the other ${want[2]}`);
      process.exitCode = 1;
    } else console.log(`claims: README's second-scan figures match the measurement (${want[0]} of ${want[1]})`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
