/* scripts/mutants.js, checked on every run of the suites. Each mutant names a quiet pass of the engine and
   the suite that must notice when it is deleted, and finds the pass by a piece of its text. On 11.10 the link
   scrub was rewritten (664642f) and two of the nine pieces left the engine; the manual run then reported
   those two as stale, and nobody ran it for a week, so two passes went unguarded without anyone knowing.
   Here each piece must be in exactly one engine file (engine/*.js), once, the day a change lands, so a pass
   can move between files and still be found. The mutation itself still runs by hand: npm run mutants. */
const fs = require("fs");
const path = require("path");
const { MUTANTS, fileOf } = require("../scripts/mutants.js");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— every mutant still points at its pass —");
ok(MUTANTS.length >= 9, "nine mutants or more: " + MUTANTS.length);
for (const [name, from, to, suite] of MUTANTS) {
  ok(!!fileOf(from), `${name}: its anchor is not in exactly one engine file, once; point it at the pass as the code is now`);
  ok(from !== to, `${name}: the mutant changes its anchor`);
  ok(fs.existsSync(path.join(ROOT, suite)), `${name}: its suite ${suite} exists`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
