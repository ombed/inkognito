/* What every change does to the output (the engineering audit, 12.10: "output-diff review on a public corpus for every
   engine release"). The gate (bench/gate.js) counts entities: found, missed, leaked. It does not see a change in what
   the tool writes in their place, a date moved differently, a sentence with an extra space or a word replaced that
   was not a name. So the deterministic layers' output for each document of the synthetic corpus is kept in
   bench/golden/<doc>.txt, and a change that alters any of them fails until the files are updated in the same change:
   the pull request then shows, line by line, what the tool now writes.

     npm run bench:nomodel && node bench/golden.js            # check (CI)
     npm run bench:nomodel && node bench/golden.js --update   # after a change you meant: review the diff, commit it

   Synthetic documents only: the private set is never written here. */
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "golden"), OUT = path.join(__dirname, "outputs-no-model.json");
if (!fs.existsSync(OUT)) { console.error("no bench/outputs-no-model.json: run `npm run bench:nomodel` first"); process.exit(2); }
const outs = JSON.parse(fs.readFileSync(OUT, "utf8"));
const norm = (s) => String(s).replace(/\r\n/g, "\n");

if (process.argv.includes("--update")) {
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) if (f.endsWith(".txt") && !(f.slice(0, -4) in outs)) fs.rmSync(path.join(DIR, f));
  for (const [id, text] of Object.entries(outs)) fs.writeFileSync(path.join(DIR, id + ".txt"), norm(text) + "\n");
  console.log(`bench/golden: ${Object.keys(outs).length} outputs written`);
  process.exit(0);
}

const changed = [], lines = [];
const have = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4)) : [];
for (const id of have) if (!(id in outs)) changed.push(id + ": no longer in the corpus");
for (const [id, text] of Object.entries(outs)) {
  const f = path.join(DIR, id + ".txt");
  if (!fs.existsSync(f)) { changed.push(id + ": new, no golden output"); continue; }
  const want = norm(fs.readFileSync(f, "utf8")).replace(/\n$/, "").split("\n"), got = norm(text).split("\n");
  if (want.join("\n") === got.join("\n")) continue;
  let n = 0;
  for (let i = 0; i < Math.max(want.length, got.length); i++) if (want[i] !== got[i]) {
    if (n < 3) lines.push(`${id}:${i + 1}\n  - ${want[i] === undefined ? "(no line)" : want[i]}\n  + ${got[i] === undefined ? "(no line)" : got[i]}`);
    n++;
  }
  changed.push(`${id}: ${n} line(s) changed`);
}
const summary = changed.length
  ? `The output changed in ${changed.length} document(s) of the synthetic corpus:\n\n` + changed.map((c) => "- " + c).join("\n") + "\n\nFirst changed lines:\n\n```\n" + lines.join("\n") + "\n```\n\nIf the change is meant: `npm run bench:nomodel && node bench/golden.js --update`, review the diff, commit it.\n"
  : `The output is unchanged in all ${Object.keys(outs).length} documents of the synthetic corpus.\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## Output against bench/golden\n\n" + summary);
process.exit(changed.length ? 1 : 0);
