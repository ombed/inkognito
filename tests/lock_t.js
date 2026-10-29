/* bench/lock.js, the result lock: two engines on the same documents must give the same results, byte for byte.
   Here, quickly, on a few corpus documents: an engine against a second copy of itself is the same (the lock sees
   no noise); an engine with a planted change in a field the golden outputs never read (the second scan) is not;
   and the first difference is named by its place in the result. The full run is node bench/lock.js --suites.

   One set of choices is the page's own defaults: it is checked here against the page's opts(), and a planted change
   in a detector that only the page turns on (the case number) is found by it and by no other set. */
const fs = require("fs");
const path = require("path");
const L = require("../scripts/engine-node.js");
const { compare, corpusInputs, firstDiff, CHOICES, PAGE } = require("../bench/lock.js");

// the page's own Component class (page-component.js), with a stub DCLogic and a storage of its own, nothing global
function pageComponent() {
  const win = {}, store = new Map();
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  new Function("window", "localStorage", fs.readFileSync(path.join(__dirname, "..", "page-component.js"), "utf8"))(win, localStorage);
  class DCLogic { setState(p, cb) { this.state = { ...this.state, ...(typeof p === "function" ? p(this.state) : p) }; if (cb) cb(); } }
  return win.__dcLogic.make(DCLogic, null, null);
}

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
  ok(docs >= 40 && all.length === docs * 5, `${docs} documents × 5 sets of choices: ${all.length} runs`);
  // each set runs what its name says: the engine reads a number's style from styles["*"], and never read numStyle
  const black = CHOICES && CHOICES["black numbers, no near misses"] && CHOICES["black numbers, no near misses"](L);
  const eng = black && new L.Engine([], [], black, "");
  ok(eng && eng.styleFor({ type: "ISRAELI_ID" }) === "black" && black.near === false, "«black numbers» blacks an ID number: " + (eng && eng.styleFor({ type: "ISRAELI_ID" })));
}

console.log("\n— one set is the page's own defaults —");
{
  const p = new (pageComponent())();
  p.state = { ...p.state, E: L };
  const want = p.opts(), set = CHOICES && CHOICES[PAGE];
  const got = typeof set === "function" ? set(L) : {};
  // the page's key is made in the browser, at random; the lock's is fixed, so two runs cannot differ
  const key = /^[0-9a-f]{64}$/;
  ok(key.test(want.aliasKey) && key.test(got.aliasKey || ""), "both hold a secret key of the invented names: " + got.aliasKey);
  const asText = (o) => JSON.parse(JSON.stringify({ ...o, aliasKey: "@key" }, (k, v) => (v instanceof Set ? { "@set": [...v] } : v)));
  const d = firstDiff(asText(want), asText(got), "");
  ok(d === null, "the lock's set is what opts() gives on a fresh page: " + JSON.stringify(d));
  ok(want.on.has("CASE_NUMBER") && want.on.has("DATE") && !!CHOICES && !CHOICES[Object.keys(CHOICES)[0]](L).on.has("CASE_NUMBER"), "the page turns on what the other sets leave off (the case number)");
}

(async () => {
  console.log("\n— an engine and a second copy of itself are the same —");
  const some = all.filter((x) => /^corpus (a1|a2)\.docx/.test(x.label));
  const twin = L.load({ source: fs.readFileSync(path.join(__dirname, "..", "redact-engine.js"), "utf8") + "\n// a second copy\n" });
  ok(twin !== L, "a separate copy");
  const same = await compare(L, twin, some);
  ok(some.length === 10 && same.length === 0, `no difference in ${some.length} runs: ` + same.slice(0, 2).join(" | "));

  console.log("\n— a planted change the golden outputs cannot see is found —");
  const planted = L.load({ patches: [["function secondScan(preview,allow,subs,citeKeys){", "function secondScan(preview,allow,subs,citeKeys){if(preview.length>3)return [];"]] });
  const found = await compare(L, planted, some.slice(0, 1));
  ok(found.length === 1 && /\.second\.result\.second\[0\]/.test(found[0]), "the second scan's first finding, by its path: " + found.join(" | ").slice(0, 300));

  console.log("\n— a planted change in a detector only the page turns on is found —");
  // the case number takes one part after the first number instead of one or two («4471-02» of «4471-02-26»)
  const caseCut = L.load({ patches: [["(\\\\d{1,7}(?:[-/]\\\\d{1,4}){1,2})(?![\\\\d])`,1,null,3,1]", "(\\\\d{1,7}(?:[-/]\\\\d{1,4}){1,1})(?![\\\\d])`,1,null,3,1]"]] });
  const f2 = all.filter((x) => /^corpus f2\.docx/.test(x.label));
  const cut = await compare(L, caseCut, f2);
  ok(cut.length >= 1 && cut.every((d) => d.includes(`, ${PAGE}: `)), `found, and only by the page's defaults: ${cut.length} of ${f2.length} runs: ` + cut.join(" | ").slice(0, 300));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
