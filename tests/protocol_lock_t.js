/* The blind test cannot drift (the engineering audit, 12.10: "the held-out set is hash-locked, and the site's figures
   come from CI"). The public Knesset protocol and its answer key are locked by SHA-256 in bench/protocol.lock.json, so
   neither can change without that file changing in the same commit. And bench/protocol-claims.js, which CI runs on the
   model's measurement, must pass README's figures as they are and fail a figure that is off by one. */
const fs = require("fs"), path = require("path"), crypto = require("crypto"), os = require("os");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n")).digest("hex");

console.log("\n— the blind test and its key are the locked ones —");
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "bench", "protocol.lock.json"), "utf8"));
ok(Object.keys(lock.files).length === 2, "two files are locked: " + Object.keys(lock.files).join(", "));
for (const [f, h] of Object.entries(lock.files)) ok(sha(f) === h, f + " is the locked text (" + sha(f).slice(0, 12) + " = " + h.slice(0, 12) + ")");
const gold = JSON.parse(fs.readFileSync(path.join(ROOT, "bench", "model-eval", "gold", "protocol.json"), "utf8")).docs[0];
ok(gold.text === fs.readFileSync(path.join(ROOT, "tests", "protocol.txt"), "utf8").replace(/\r/g, ""), "the key was made on this text");

console.log("\n— the claims check passes README as it is, and catches a figure that is off —");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claims-"));
  const run = (res) => { const f = path.join(dir, "r.json"); fs.writeFileSync(f, JSON.stringify(res)); return spawnSync(process.execPath, [path.join(ROOT, "bench", "protocol-claims.js"), f], { encoding: "utf8" }); };
  // README's figures, as the measurement of 12.10 gave them
  const asSaid = { model: true, people: { left: 1, of: 71 }, places: { left: 0, of: 11 }, privateBodies: { left: 3, of: 27 }, publicBodies: { changed: 9, of: 18 } };
  const same = run(asSaid);
  ok(same.status === 0, "README's figures pass: " + same.stdout.trim().split("\n").join(" | "));
  for (const [k, field] of [["people", "left"], ["places", "of"], ["privateBodies", "left"], ["publicBodies", "changed"]]) {
    const r = run({ ...asSaid, [k]: { ...asSaid[k], [field]: asSaid[k][field] + 1 } });
    ok(r.status === 1 && /DIFF/.test(r.stdout), "one figure off, " + k + "." + field + ": refused");
  }
  ok(run({ ...asSaid, model: false }).status === 1, "a measurement without the model is refused (README quotes it with the model)");
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
