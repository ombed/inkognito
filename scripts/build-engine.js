/* redact-engine.js is generated:  node scripts/build-engine.js

   The engine is edited as the files under engine/, in the order their names sort, one per concept: reading
   a Word part's text, its links, its parts, writing inside runs, pictures, the redactDocx pipeline, the
   checks on the finished file, the model, restoring names and so on (until 18.10 the thirteen 08-* files
   were one file of 2,942 lines, engine/08-docx.js). This concatenates them, byte for byte, into the single
   file the page, the tests and the benchmark load. tests/engine_t.js fails when the generated file is
   stale, so an edit to redact-engine.js by hand is caught the next time the suite runs. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "engine");
const OUT = path.join(ROOT, "redact-engine.js");

function build() {
  const parts = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  if (!parts.length) throw new Error("engine/ is empty");
  return parts.map((f) => fs.readFileSync(path.join(DIR, f), "utf8")).join("");
}

if (require.main === module) {
  fs.writeFileSync(OUT, build());
  console.log("wrote redact-engine.js from engine/");
}
module.exports = { build, OUT, DIR };
