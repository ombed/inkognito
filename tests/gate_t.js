/* The recall gate compares entities, not category totals (outside review, L19), and has no back door (outside
   review of 12.10): the baseline is read at the PR's base, and what got worse, is new and failing, or is gone
   blocks unless bench/gate-accepted.json names it with a reason. */
const { compare, decide, readBaseline } = require("../bench/gate.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const row = (doc, canonical, o) => ({ doc, cat: "P_FORMS", canonical, found: true, leaked: false, fp: 0, ...o });

// one entity fixed, another in the same category broken: the totals do not move
const base = { rows: [row("a1", "רחל פרידמן", { leaked: true }), row("a1", "דנה כהן")] };
const cur = { rows: [row("a1", "רחל פרידמן"), row("a1", "דנה כהן", { leaked: true })] };
const g = compare(base, cur);
ok(g.a.leaked === g.b.leaked, "the totals are the same, as before: " + g.a.leaked + " → " + g.b.leaked);
ok(g.worse.some((l) => l.includes("דנה כהן") && l.includes("now leaks")), "and the newly leaking entity is named: " + JSON.stringify(g.worse));
ok(g.better.some((l) => l.includes("רחל פרידמן")), "and so is the fixed one");

const g2 = compare(base, { rows: [...base.rows, row("s1", "שם חדש", { found: false, leaked: true })] });
ok(!g2.worse.length && g2.added.length === 1, "an entity new to the corpus is reported, not blocking: " + JSON.stringify(g2));

const g3 = compare(base, { rows: [base.rows[0], row("a1", "דנה כהן", { found: false })] });
ok(g3.worse.some((l) => l.includes("now missed")), "a newly missed entity is worse");
const g4 = compare(base, { rows: [base.rows[0], row("a1", "דנה כהן", { fp: 1 })] });
ok(g4.worse.some((l) => l.includes("fp 0 → 1")), "a new false positive is worse");

console.log("\n— what blocks, and how a regression is accepted —");
const KEY = "a1|P_FORMS|דנה כהן";
{
  const d = decide(g, []);
  ok(d.blocking.length === 1 && d.blocking[0].includes("דנה כהן"), "a worse entity blocks: " + JSON.stringify(d.blocking));
  const d2 = decide(g, [{ entity: KEY, reason: "the trade-off of the address fix: this form is asked about instead" }]);
  ok(!d2.blocking.length && d2.allowed.length === 1, "named with a reason, it is let through and said so: " + JSON.stringify(d2));
  const d3 = decide(g, [{ entity: KEY, reason: "ok" }]);
  ok(d3.blocking.length === 1 && d3.unexplained.includes(KEY), "a mark is not a reason: " + JSON.stringify(d3));
  const d4 = decide(g2, []);
  ok(d4.blocking.some((l) => l.startsWith("new") && l.includes("שם חדש")), "an entity new to the corpus and failing blocks: " + JSON.stringify(d4.blocking));
  const gGone = compare(base, { rows: [base.rows[0]] });
  ok(decide(gGone, []).blocking.some((l) => l.startsWith("gone") && l.includes("דנה כהן")), "an entity gone from the corpus blocks");
  const d5 = decide(compare(base, base), [{ entity: KEY, reason: "accepted in an earlier change, now in the baseline" }]);
  ok(!d5.blocking.length && d5.stale.includes(KEY), "an accepted entry that matches nothing is stale: " + JSON.stringify(d5));
}

console.log("\n— the baseline is read at the PR's base, not from the change under test —");
{
  // the change adds a leak and regenerates its own baseline: in the tree, base equals cur
  const fs = require("fs"), os = require("os"), path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-")), file = path.join(dir, "baseline-no-model.json");
  fs.writeFileSync(file, JSON.stringify(cur));
  const atMain = readBaseline(file, "origin/main", (spec) => { ok(spec.startsWith("origin/main:"), "read with git show at the ref: " + spec); return JSON.stringify(base); });
  ok(decide(compare(atMain, cur), []).blocking.length === 1, "the regenerated baseline does not hide the new leak");
  ok(decide(compare(readBaseline(file, "", null), cur), []).blocking.length === 0, "(read from the tree, as before, it would have)");
  ok(readBaseline(file, "origin/main", () => { throw new Error("no such path"); }) === null, "no baseline at the ref: null, and the gate says so");
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
