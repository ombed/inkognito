/* scripts/release-notes.js: the notes of a version, from CHANGELOG.md, for its GitHub Release (the deploy job in
   .github/workflows/hosted-build.yml). A section runs from its heading to the next; a version is never mistaken
   for a longer one (v75 is not v75.1); and the version the page shows has a section, so a release is never
   tagged without its notes. */
const fs = require("fs");
const path = require("path");
const { notes } = require("../scripts/release-notes.js");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

console.log("\n— a section, and only its own —");
{
  const md = "# Changes\n\n## v2.1 — today\n\nfix\n\n## v2 — earlier (PR #2)\n\nfeature\nmore\n\n## v1 — first\n\nstart\n";
  ok(notes(md, "v2.1") === "## v2.1 — today\n\nfix\n", "the section of v2.1: " + JSON.stringify(notes(md, "v2.1")));
  ok(notes(md, "v2") === "## v2 — earlier (PR #2)\n\nfeature\nmore\n", "v2 is not v2.1: " + JSON.stringify(notes(md, "v2")));
  ok(notes(md, "v1") === "## v1 — first\n\nstart\n", "the last section runs to the end");
  ok(notes(md, "v3") === null, "a version with no section has no notes");
  ok(notes(md.replace(/\n/g, "\r\n"), "v2") === "## v2 — earlier (PR #2)\n\nfeature\nmore\n", "and CRLF reads the same");
}

console.log("\n— the version the page shows has its notes —");
{
  const v = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/id="ver"[^>]*>[^<]*?(v\d+(?:\.\d+)?)</) || [])[1];
  const md = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  ok(!!v && !!notes(md, v), `CHANGELOG.md has a section for ${v}, the version index.html shows`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
