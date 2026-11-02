/* What the texts say about the tool, read against the tool itself (the check of 6.10).

   The tour, the README, the two Hebrew guides, the issue form and package.json are what a new user,
   a careful reader or a client's IT goes by, and they had drifted from the tool:
   - a deleted value is drawn on the review screen as a dashed chip with an eraser; until 6.10 it was
     the text ∅, and the tour and the guides still described the ∅;
   - the README's network table left out React, which every first visit loads from unpkg;
   - the trial guide gave the model as about 130 MB, and placed the review screen's parts on sides
     they are not on (and on a phone they are two tabs, not sides);
   - the issue form named a button the tool does not have;
   - the model-evaluation docs spelled out one computer's folders, and package.json pointed at an SSH
     alias that resolves on one computer only.
   Where it can, each check takes the fact from the code, so a change to the code fails here until the
   texts follow it. */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
// comments are for developers and may tell the mark's history; "//" after ":" is a URL, not a comment
const { pageWithLogic } = require("../scripts/page-parts.js"); // the page with its logic (page-component.js) in its place
const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

console.log("\n— the texts name the deletion mark the review screen draws —");
{
  const html = pageWithLogic();
  ok(/<sc-if value="\{\{ sg\.del \}\}"><svg [^>]*data-icon="eraser"/.test(html), "a deleted value is drawn with the eraser");
  for (const [f, text] of [["index.html", strip(html)], ["docs/trial-guide-he.md", read("docs/trial-guide-he.md")], ["docs/answer-sheet-he.md", read("docs/answer-sheet-he.md")]]) {
    const left = (text.match(/∅/g) || []).length;
    ok(left === 0, `${f} describes the eraser, not ∅ (${left} left)`);
  }
}

/* What users run is inkognito.co.il (the outside review of 12.10, the owner's wording of 12.10). There every library the
   code names at a CDN (support.js, the map's libraries in index.html) is served from the site itself: the hosted build
   (scripts/hosted.js, branch inkognito) copies each one, strips the CDN hosts from the page's policy, and stops if a CDN
   address is left. The README says so, and says the tool needs a connection to open; nothing promises it works offline. */
console.log("\n— the network section describes the site users run —");
{
  const md = read("README.md");
  const section = (md.split("## מה נטען מהרשת")[1] || "").split("\n## ")[0];
  ok(/inkognito\.co\.il/.test(section) && /לא פונה לאתרים אחרים/.test(section), "README.md: on inkognito.co.il the tool contacts no other site");
  ok(/צריך חיבור כדי להיפתח/.test(section), "README.md: the tool needs a connection to open");
  ok(!/unpkg\.com|cdn\.jsdelivr\.net/.test(section), "README.md: no CDN in the section on what users run");
  // the CDN addresses the code names, which the hosted build must serve from the site (still there in main's code)
  const support = read("support.js");
  ok(/var REACT_URL = "https:\/\/unpkg\.com\//.test(support), "support.js still names React at unpkg, which the hosted build replaces");
}

console.log("\n— nothing promises the tool works offline —");
{
  const offline = /(?:עובד|ייפתח|נפתח)[^.\n]{0,40}בלי (?:רשת|אינטרנט|חיבור)|בלי (?:רשת|אינטרנט|חיבור)[^.\n]{0,20}(?:עובד|ייפתח)|גם בלעדיו/;
  for (const [f, text] of [["README.md", read("README.md")], ["index.html", strip(pageWithLogic())]]) {
    const m = text.match(offline);
    ok(!m, `${f} promises no offline use${m ? ": «" + m[0] + "»" : ""}`);
  }
}

console.log("\n— the model's size is the size of the files the site ships —");
{
  const dir = "models/dictabert-parse-ner-37f4d6f/onnx";
  const parts = fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.part\d+$/.test(f));
  const mb = Math.round(parts.reduce((a, f) => a + fs.statSync(path.join(ROOT, dir, f)).size, 0) / 1e6);
  ok(parts.length === 4 && mb > 100, `the model's ${parts.length} parts weigh ${mb} MB`);
  for (const f of ["README.md", "docs/trial-guide-he.md", "docs/answer-sheet-he.md", "index.html"]) {
    const said = [...read(f).matchAll(/(\d+)\s*(?:MB|מגה)(?![A-Za-z])/g)].map((m) => Number(m[1]));
    ok(said.length > 0 && said.every((n) => n === mb), `${f} gives the model's size as ${mb} MB: ${said.join(", ")}`);
  }
}

console.log("\n— the guides name the review screen's parts, not their side —");
// at 1280 the document is on the right and the findings on the left; on a phone they are two tabs
for (const f of ["docs/trial-guide-he.md", "docs/answer-sheet-he.md"]) {
  const sides = [...read(f).matchAll(/(?<![א-ת])(?:מימין|משמאל|בצד הימני|בצד השמאלי)(?![א-ת])/g)].map((m) => m[0]);
  ok(sides.length === 0, `${f} places nothing by its side: ${sides.join(", ")}`);
}

console.log("\n— the issue form names buttons the tool has —");
{
  const html = pageWithLogic();
  const dir = ".github/ISSUE_TEMPLATE";
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => /\.ya?ml$/.test(x))) {
    // a button is named in straight quotes or in «», after «הכפתור», «בכפתור» or «לחצתם (בכלי) (על)»
    const named = [...read(dir + "/" + f).matchAll(/(?:הכפתור|בכפתור|לחצ[א-ת]*(?:\s+בכלי)?(?:\s+על)?)\s+(?:"([^"]+)"|«([^»]+)»)/g)].map((m) => m[1] || m[2]);
    ok(named.length > 0, `${dir}/${f} names a button`);
    for (const n of named) ok(html.includes(">" + n + "<") || html.includes('"' + n + '"'), `${dir}/${f} names «${n}», a label index.html has`);
  }
}

console.log("\n— no text spells out one computer's folders —");
{
  let tracked = "";
  try { tracked = execSync('git ls-files -- docs bench .github "*.md"', { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (_) { /* the count below fails */ }
  const files = [...new Set(tracked.split("\n").filter((f) => /\.(?:md|txt|py|js|json|ya?ml|html)$/i.test(f)))];
  ok(files.length > 50, "git ls-files listed the docs: " + files.length + " text files; without it this check proves nothing");
  const local = /(?<![A-Za-z])[A-Za-z]:[\\/]+Users[\\/]|\/c\/Users\/|(?<![\w.-])Users[\\/]+Me(?![\w-])/i;
  const hits = files.filter((f) => local.test(read(f)));
  ok(hits.length === 0, "files with a local absolute path: " + hits.join(", "));
  // and package.json points at the repository's public address, not at one computer's SSH alias
  const repo = JSON.parse(read("package.json")).repository;
  ok(!!repo && repo.url === "https://github.com/ombed/inkognito", "package.json's repository is https://github.com/ombed/inkognito: " + (repo && repo.url));
}

/* The figures README quotes, against what measures them. The outside review of 18.10 found two that had drifted:
   the second scan's 28 where the measurement was 27, and test counts months old. The corpus and the leak figures
   come from the key and the gate's baselines, which the gate holds to every run; the test counts are lower bounds,
   true on main and on the hosted branch, which has more. The second scan needs a run of the chain, so CI checks it
   (bench/second-scan.js --claims README.md), as it checks the blind test's (bench/protocol-claims.js). */
console.log("\n— the figures README quotes —");
{
  const md = read("README.md");
  const key = JSON.parse(read("bench/key.json"));
  const ents = key.docs.flatMap((d) => d.entities), must = ents.filter((e) => e.must).length;
  const corpus = /(\d+) invented documents with (\d+) keyed entries: (\d+) identifying details the tool must replace and (\d+) traps/.exec(md);
  const corpusWant = [key.docs.length, ents.length, must, ents.length - must];
  ok(!!corpus && corpus.slice(1).map(Number).join() === corpusWant.join(), `the corpus: README says ${corpus && corpus.slice(1).join("/")}, the key holds ${corpusWant.join("/")}`);
  const leaks = (f) => JSON.parse(read(f)).rows.filter((r) => r.leaked && r.found !== null);
  const rules = leaks("bench/baseline-no-model.json"), model = leaks("bench/baseline-model.json");
  const recall = /the rules alone leave (\d+) of the (\d+) details somewhere in the output, in (\d+) of the documents; with the model, (\d+)\./.exec(md);
  const recallWant = [rules.length, must, new Set(rules.map((r) => r.doc)).size, model.length];
  ok(!!recall && recall.slice(1).map(Number).join() === recallWant.join(), `recall: README says ${recall && recall.slice(1).join("/")}, the gate's baselines ${recallWant.join("/")}`);
  const num = (s) => Number(String(s).replace(/,/g, ""));
  const tests = /more than ([\d,]+) Node checks and ([\d,]+) Playwright browser tests/.exec(md);
  const floors = Object.values(JSON.parse(read("tests/floors.json"))).reduce((a, b) => a + b, 0);
  const said = tests ? `README says more than ${tests[1]} and ${tests[2]}` : "README has no sentence \"more than <n> Node checks and <m> Playwright browser tests\"";
  ok(!!tests && floors > num(tests[1]), `Node checks: ${said}; the suites' floors add up to ${floors}`);
  const list = require("child_process").spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--list", "--reporter=json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
  let browser = 0;
  try {
    const walk = (s) => { for (const sp of s.specs || []) browser += (sp.tests || []).length; for (const c of s.suites || []) walk(c); };
    for (const s of JSON.parse(list.stdout).suites) walk(s);
  } catch (_) { browser = -1; }
  ok(!!tests && browser >= num(tests[2]), `browser tests: ${said}; Playwright lists ${browser}`);
  // the export password's rounds, and the model's download, as the code and the files have them
  const rounds = /PBKDF2 with ([\d,]+) rounds/.exec(md), iter = Number((/\biter:\s*(\d+)/.exec(read("page-logic.js")) || [])[1]);
  ok(!!rounds && num(rounds[1]) === iter, `the export password's rounds: README says ${rounds && rounds[1]}, page-logic.js uses ${iter}`);
  const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
  const weights = files(path.join(ROOT, "models")).filter((f) => /\.onnx(\.part\d+)?$/.test(f)).reduce((n, f) => n + fs.statSync(f).size, 0);
  const mb = /The model is a (\d+) MB download/.exec(md);
  ok(!!mb && num(mb[1]) === Math.round(weights / 1e6), `the model: README says ${mb && mb[1]} MB, its files hold ${(weights / 1e6).toFixed(1)} MB`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
