/* What the texts say about the tool, read against the tool itself (the check of 6.10).

   A deleted value is drawn on the review screen as a dashed chip with an eraser; until 6.10 it was
   the text ∅. The tour's step on the review screen and the two Hebrew guides still described the ∅,
   so a new user looked for a mark the screen no longer shows. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
// comments are for developers and may tell the mark's history; "//" after ":" is a URL, not a comment
const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");

console.log("\n— the texts name the deletion mark the review screen draws —");
{
  const html = read("index.html");
  ok(/<sc-if value="\{\{ sg\.del \}\}"><svg [^>]*data-icon="eraser"/.test(html), "a deleted value is drawn with the eraser");
  for (const [f, text] of [["index.html", strip(html)], ["docs/trial-guide-he.md", read("docs/trial-guide-he.md")], ["docs/answer-sheet-he.md", read("docs/answer-sheet-he.md")]]) {
    const left = (text.match(/∅/g) || []).length;
    ok(left === 0, `${f} describes the eraser, not ∅ (${left} left)`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
