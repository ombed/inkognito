/* The notes of one version, from CHANGELOG.md, for its GitHub Release (the deploy job in hosted-build.yml):

     node scripts/release-notes.js v76.1

   The section runs from its heading ("## v76.1 — 2026-10-18 (PR #120)") to the next one. A version with no
   section is an error, so a release is never published without its notes. */
const fs = require("fs");
const path = require("path");

function notes(md, version) {
  const text = String(md).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## " + version + " ") || l === "## " + version);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n").trim() + "\n";
}

module.exports = { notes };

if (require.main === module) {
  const version = process.argv[2] || "";
  if (!/^v\d+(\.\d+)?$/.test(version)) { console.error("usage: node scripts/release-notes.js vNN[.k]"); process.exit(2); }
  const out = notes(fs.readFileSync(path.join(__dirname, "..", "CHANGELOG.md"), "utf8"), version);
  if (!out) { console.error(`CHANGELOG.md has no section for ${version}`); process.exit(1); }
  process.stdout.write(out);
}
