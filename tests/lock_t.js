/* bench/lock.js, the result lock: two engines on the same documents must give the same results, byte for byte.
   Here, quickly, on a few corpus documents: an engine against a second copy of itself is the same (the lock sees
   no noise); an engine with a planted change in a field the golden outputs never read (the second scan) is not;
   and the first difference is named by its place in the result. The full run is node bench/lock.js --suites. */
const fs = require("fs");
const path = require("path");
const L = require("../scripts/engine-node.js");
const { compare, corpusInputs, firstDiff } = require("../bench/lock.js");

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— where two results first part —");
{
  ok(firstDiff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }, "") === null, "the same is the same");
  const d = firstDiff({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }, "");
  ok(d && d.at === ".a[1].b" && d.a === 2 && d.b === 3, "a changed value is named by its path: " + JSON.stringify(d));
  ok(firstDiff({ a: [1] }, { a: [1, 2] }, "").at === ".a[1]", "a value that appeared");
  ok(/order of its fields/.test(firstDiff({ a: 1, b: 2 }, { b: 2, a: 1 }, "").at), "and fields in another order");
}

console.log("\n— the corpus, with every set of choices —");
const all = corpusInputs();
{
  const docs = fs.readdirSync(path.join(__dirname, "..", "bench", "corpus")).filter((f) => f.endsWith(".docx")).length;
  ok(docs >= 40 && all.length === docs * 4, `${docs} documents × 4 sets of choices: ${all.length} runs`);
}

(async () => {
  console.log("\n— an engine and a second copy of itself are the same —");
  const some = all.filter((x) => /^corpus (a1|a2)\.docx/.test(x.label));
  const twin = L.load({ source: fs.readFileSync(path.join(__dirname, "..", "redact-engine.js"), "utf8") + "\n// a second copy\n" });
  ok(twin !== L, "a separate copy");
  const same = await compare(L, twin, some);
  ok(some.length === 8 && same.length === 0, `no difference in ${some.length} runs: ` + same.slice(0, 2).join(" | "));

  console.log("\n— a planted change the golden outputs cannot see is found —");
  const planted = L.load({ patches: [["function secondScan(preview,allow,subs,citeKeys){", "function secondScan(preview,allow,subs,citeKeys){if(preview.length>3)return [];"]] });
  const found = await compare(L, planted, some.slice(0, 1));
  ok(found.length === 1 && /\.second\.result\.second\[0\]/.test(found[0]), "the second scan's first finding, by its path: " + found.join(" | ").slice(0, 300));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
