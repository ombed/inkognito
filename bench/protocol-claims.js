/* The figures README quotes from the blind test, held to the measurement (the engineering audit, 12.10: "the site's
   figures come from CI"). CI runs `npm run bench:protocol -- --json <file>` with the model and then this, so a change
   that moves a figure cannot keep the old one in README: the PR updates the sentence in the same change.

     node bench/protocol-claims.js bench/protocol-result.json

   The sentence it reads is README's "A real document" line: "<n> of its <N> mentions of people is left", "<n> of <N>
   places", "<n> of <N> private bodies", "<n> of its <N> public bodies are replaced". */
const fs = require("fs"), path = require("path");
const file = process.argv[2];
if (!file) { console.error("usage: node bench/protocol-claims.js <protocol-result.json>"); process.exit(2); }
const got = JSON.parse(fs.readFileSync(file, "utf8"));
const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
const line = readme.split("\n").find((l) => l.includes("A real document") && l.includes("tests/protocol.txt")) || "";
const grab = (rx) => { const m = line.match(rx); return m ? [Number(m[1]), Number(m[2])] : null; };
const claims = {
  people: grab(/(\d+)\s+of its (\d+) mentions of people/),
  places: grab(/(\d+) of (\d+) places/),
  privateBodies: grab(/(\d+) of (\d+) private bodies/),
  publicBodies: grab(/(\d+) of its (\d+) public bodies are replaced/),
};
const measured = {
  people: [got.people.left, got.people.of], places: [got.places.left, got.places.of],
  privateBodies: [got.privateBodies.left, got.privateBodies.of], publicBodies: [got.publicBodies.changed, got.publicBodies.of],
};
let bad = 0;
for (const [k, said] of Object.entries(claims)) {
  const m = measured[k];
  if (!said) { console.log(`${k}: README's sentence no longer says it`); bad++; continue; }
  const same = said[0] === m[0] && said[1] === m[1];
  console.log(`${same ? "ok  " : "DIFF"} ${k}: README ${said[0]} of ${said[1]}, measured ${m[0]} of ${m[1]}`);
  if (!same) bad++;
}
if (!got.model) { console.log("the measurement ran without the model; README quotes it with the model"); bad++; }
process.exit(bad ? 1 : 0);
