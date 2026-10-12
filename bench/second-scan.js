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
})().catch((e) => { console.error(e); process.exit(1); });
