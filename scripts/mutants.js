/* Known mutants (node scripts/mutants.js). The outside review of 2026-09-20 deleted five
   of the engine's quiet passes one at a time and the whole suite stayed green. Each is
   kept here as a named mutant: the script applies it to engine/08-docx.js, rebuilds, runs
   the suite that should notice, and restores the file, also if it is interrupted. A mutant
   that SURVIVES means a test stopped guarding that pass.

   Manual, because it rewrites an engine file while it runs. Do not run it beside anything
   else that builds. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "engine", "08-docx.js");
const MUTANTS = [
  ["the name-part sweep for names the engine found", "  for(const r of applied) regPart(r.base||r.value,r.baseRep||r.rep,r.label);", "  ;", "tests/passes_t.js"],
  ["the hyperlink-target scrub", "    if(c===raw)return tag;", "    return tag;", "tests/passes_t.js"],
  ["the sweep's hands off a pseudonym already written", "  const pseudoWritten=[...new Set(applied.map(r=>norm(String(r.rep||\"\")).trim()).filter(w=>w.length>=2))];", "  const pseudoWritten=[];", "tests/chain_t.js"],
  ["stripComments", "function stripComments(doc){", "function stripComments(doc){return 0;", "tests/passes_t.js"],
  ["stripRsid", "function stripRsid(doc){let n=0;", "function stripRsid(doc){return 0;let n=0;", "tests/passes_t.js"],
  ["the shared reader's extra parts", "const isTextPart=n=>TEXTPART.test(n)||EXTRAPART.test(n);", "const isTextPart=n=>TEXTPART.test(n);", "tests/structure_t.js"],
  ["the scrub of links inside field codes", "  for(const dd of docs)if(TEXTPART.test(dd.f.name))scrubFields(dd.doc,ac.clean,rep.rels);", "  ;", "tests/links_t.js"],
  ["dropping the page-one thumbnail", "||f.name.startsWith(\"docProps/thumbnail.\")", "", "tests/structure_t.js"],
  ["stripHidden", "function stripHidden(doc){\n  let n=0;", "function stripHidden(doc){\n  return 0;let n=0;", "tests/structure_t.js"],
];
module.exports = { MUTANTS, FILE };

// run by hand only, since it rewrites the engine file; tests/mutants_t.js reads the list on every run of the suites
if (require.main === module) {
  const keep = fs.readFileSync(FILE, "utf8");
  const rebuild = () => cp.execSync("node scripts/build-engine.js && node tests/build-fixtures.js", { cwd: ROOT, stdio: "ignore" });
  const restore = () => { fs.writeFileSync(FILE, keep); rebuild(); };
  process.on("SIGINT", () => { restore(); process.exit(130); });
  let survived = 0;
  try {
    for (const [name, from, to, suite] of MUTANTS) {
      if (keep.split(from).length !== 2) { console.log("STALE    ".padEnd(10) + name + ": its anchor is no longer unique in the engine"); survived++; continue; }
      fs.writeFileSync(FILE, keep.replace(from, to));
      rebuild();
      let failed = false;
      try { cp.execSync("node " + suite, { cwd: ROOT, stdio: "ignore" }); } catch (_) { failed = true; }
      if (!failed) survived++;
      console.log((failed ? "caught" : "SURVIVED").padEnd(10) + name + "  (" + suite + ")");
    }
  } finally { restore(); }
  console.log(survived ? `\n${survived} mutant(s) survived` : "\nevery mutant was caught");
  process.exitCode = survived ? 1 : 0;
}
