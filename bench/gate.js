/* Recall gate. Compares the benchmark just run against the committed baseline, entity by entity, and blocks on
   any entity that got worse (GATE_BLOCKING=1, as CI runs it).

   It used to tally counts per category, so fixing one entity's leak while breaking another
   in the same category read "71 → 71" and passed (outside review, L19). An entity is now
   compared with itself: document, category and canonical name.

   No back door (outside review of 12.10). The gate read its baseline from the change under test, so a change that
   added a leak and regenerated the baseline in the same commit passed, and an entity new to the corpus or gone
   from it never blocked: with a coding agent writing the change, regenerating the baseline is the easy way out.
   - GATE_BASE_REF (CI sets it to the base of the PR, or to the commit before a push) is where the baseline is read,
     with git show: the change's own copy of the baseline does not count.
   - Every entity that got worse, that is new and failing, or that is gone from the corpus blocks, unless
     bench/gate-accepted.json names it with a reason written by hand. Accepting a regression stays possible
     (decision Q7, docs/PLAN-v18.md); it is now said, entity by entity, where a reviewer reads it. An entry that
     matches nothing is reported as stale, so the file is emptied once its baseline has moved on.
   - --model gates the model-on run (results.json against baseline-model.json) the same way. */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const id = (row) => row.doc + "|" + row.cat + "|" + row.canonical;
function compare(base, cur) {
  const before = new Map((base.rows || []).map((r) => [id(r), r]));
  const worse = [], better = [], added = [], gone = [];
  for (const r of cur.rows || []) {
    const b = before.get(id(r));
    if (!b) { if (r.leaked || r.found === false || r.fp) added.push(`${id(r)}: ${r.leaked ? "leaked" : r.found === false ? "missed" : "fp " + r.fp}`); continue; }
    before.delete(id(r));
    if (r.leaked && !b.leaked) worse.push(`${id(r)}: now leaks`);
    if (!r.leaked && b.leaked) better.push(`${id(r)}: no longer leaks`);
    if (r.found === false && b.found !== false) worse.push(`${id(r)}: now missed`);
    if (r.found !== false && b.found === false) better.push(`${id(r)}: now found`);
    if ((r.fp || 0) > (b.fp || 0)) worse.push(`${id(r)}: fp ${b.fp || 0} → ${r.fp}`);
    if ((r.fp || 0) < (b.fp || 0)) better.push(`${id(r)}: fp ${b.fp} → ${r.fp || 0}`);
  }
  for (const k of before.keys()) gone.push(k);
  const sum = (r, f) => (r.rows || []).filter(f).length;
  const totals = (r) => ({ leaked: sum(r, (x) => x.leaked), missed: sum(r, (x) => x.found === false), fp: (r.rows || []).reduce((n, x) => n + (x.fp || 0), 0) });
  return { worse, better, added, gone, a: totals(base), b: totals(cur) };
}

/* What blocks: every worse, new-and-failing or gone entity that the accepted list does not name with a reason.
   accepted: [{ entity: "doc|cat|canonical", reason: "…" }]; a reason is a sentence, not a mark (12 characters or more). */
function decide(g, accepted) {
  const ok = new Map();
  for (const a of accepted || []) if (a && a.entity && String(a.reason || "").trim().length >= 12) ok.set(a.entity, a);
  const entityOf = (line) => line.split(": ")[0];
  const lines = [...g.worse.map((l) => ["worse", l]), ...g.added.map((l) => ["new", l]), ...g.gone.map((l) => ["gone", l])];
  const used = new Set(), blocking = [], allowed = [];
  for (const [kind, line] of lines) {
    const e = entityOf(line);
    if (ok.has(e)) { used.add(e); allowed.push(`${kind} ${line} — accepted: ${ok.get(e).reason}`); } else blocking.push(`${kind} ${line}`);
  }
  const stale = [...ok.keys()].filter((e) => !used.has(e));
  const unexplained = (accepted || []).filter((a) => a && a.entity && String(a.reason || "").trim().length < 12).map((a) => a.entity);
  return { blocking, allowed, stale, unexplained };
}

// the baseline at a git ref (the PR's base), or the working tree's copy when no ref is given; null when there is none
function readBaseline(file, ref, gitShow) {
  if (!ref) return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const rel = path.relative(path.join(__dirname, ".."), file).split(path.sep).join("/");
  const show = gitShow || ((spec) => execFileSync("git", ["show", spec], { cwd: path.join(__dirname, ".."), maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8"));
  try { return JSON.parse(show(`${ref}:${rel}`)); } catch (_) { return null; }
}

if (require.main === module) {
  const HERE = __dirname, model = process.argv.includes("--model");
  const cur = JSON.parse(fs.readFileSync(path.join(HERE, model ? "results.json" : "results-no-model.json"), "utf8"));
  const basePath = path.join(HERE, model ? "baseline-model.json" : "baseline-no-model.json");
  const ref = process.env.GATE_BASE_REF || "";
  const base = readBaseline(basePath, ref, null);
  if (!base) {
    console.log(`gate${model ? " (model)" : ""}: no baseline ${ref ? "at " + ref : "yet"}; copy ${model ? "results.json to baseline-model.json" : "results-no-model.json to baseline-no-model.json"} to start comparing`);
    process.exit(0);
  }
  const acceptedPath = path.join(HERE, "gate-accepted.json");
  const accepted = fs.existsSync(acceptedPath) ? (JSON.parse(fs.readFileSync(acceptedPath, "utf8")).accepted || []) : [];
  const g = compare(base, cur), d = decide(g, accepted);
  console.log(`gate${model ? " (model)" : ""}: leaks ${g.a.leaked} → ${g.b.leaked}, missed ${g.a.missed} → ${g.b.missed}, fp ${g.a.fp} → ${g.b.fp}` + (ref ? ` (baseline at ${ref})` : ""));
  for (const l of g.better) console.log("  better  " + l);
  for (const l of d.allowed) console.log("  allowed " + l);
  for (const l of d.blocking) console.log("  BLOCKS  " + l);
  for (const e of d.stale) console.log("  stale   " + e + " (in gate-accepted.json, matches nothing: remove it)");
  for (const e of d.unexplained) console.log("  no reason " + e + " (gate-accepted.json: a reason is a sentence)");
  if (d.blocking.length && process.env.GATE_BLOCKING) { console.log("gate: blocking"); process.exit(1); }
  if (d.blocking.length) console.log("gate: report only, not blocking");
}
module.exports = { compare, decide, readBaseline };
