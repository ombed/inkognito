/* scripts/complexity.js, the committed command behind the brief's complexity numbers
   (outside review, H15). The first list was typed from a run that skipped a file it
   could not parse and so left out redactDocx. Here: the function that builds the
   download is measured, the page's component logic (page-component.js) is measured, and a file
   that does not parse is an error rather than a silent skip.

   The guard (18.10): functions are named by where they sit, so the names survive moved lines and
   a formatter; compare() blocks what got worse and lets a split pay for its parts; and the
   committed baseline is always the code's own numbers, so the baseline at a PR's base is true. */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const { measure, sources, appScript, snapshot, compare, baselineOf, differs, BASELINE, ACCEPTED } = require("../scripts/complexity.js");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
// a made-up body with n branches: complexity n + 1
const ifs = (n) => Array.from({ length: n }, (_, i) => `if(x===${i})x++;`).join("");
const valuesOf = (code) => Object.fromEntries(measure([{ file: "made-up.js", code, sourceType: "script" }]).fns.map((x) => [x.key, x.value]));

console.log("\n— the repository as it is —");
const repo = snapshot(ROOT);
{
  const { fns } = repo;
  const names = fns.map((x) => x.name);
  ok(names.some((n) => /'redactDocx'/.test(n)), "redactDocx is in the list");
  // bodyNames left the list when it was split into steps; its scoring step, from the same file, stands in for it
  ok(names.some((n) => /'contextEvidence'/.test(n)), "contextEvidence (bodyNames' scoring step) is in the list");
  ok(fns.some((x) => x.file === "page-component.js"), "the page's component logic, page-component.js, is measured");
  ok(fns.every((x, i) => i === 0 || fns[i - 1].value >= x.value), "sorted by value, highest first");
  ok(new Set(fns.map((x) => x.key)).size === fns.length, "every function has a name of its own");
  ok(sources(ROOT).every((s) => s.file in repo.perFile), "every measured file is reported");
}

console.log("\n— the committed baseline is the code's numbers —");
{
  const committed = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const diff = differs(committed, baselineOf(repo));
  ok(!diff.length, `${path.relative(ROOT, BASELINE)} differs from the code; run node scripts/complexity.js --baseline and commit it: ` + diff.slice(0, 6).join("; "));
  const accepted = JSON.parse(fs.readFileSync(ACCEPTED, "utf8"));
  ok(Array.isArray(accepted.accepted), "scripts/complexity-accepted.json holds an accepted list");
}

console.log("\n— a file that does not parse is an error, not a skip —");
{
  let err = null;
  try { measure([{ file: "broken.js", code: "function f( {", sourceType: "script" }]); } catch (e) { err = e; }
  ok(err && /broken\.js: does not parse/.test(err.message), "throws naming the file: " + (err && err.message));
}

console.log("\n— a made-up function over the limit is counted —");
{
  const branches = Array.from({ length: 14 }, (_, i) => `if(x===${i})y++;`).join("");
  const { fns, deep } = measure([{ file: "made-up.js", code: `function busy(x){let y=0;${branches}return y}\nfunction calm(x){return x}`, sourceType: "script" }]);
  ok(fns.length === 1 && /'busy'/.test(fns[0].name) && fns[0].value === 15, "busy at 15, calm not listed: " + JSON.stringify(fns));
  ok(deep["made-up.js"] === 0, "no deep nesting");
}

console.log("\n— a function is named by where it sits —");
{
  const got = valuesOf([
    `class Shop { total(x){ ${ifs(13)} } }`,
    `function outer(x){ const inner = (y) => { ${ifs(13)} }; [1].map((x) => { ${ifs(13)} }); [2].forEach((x) => { ${ifs(13)} }); return inner; }`,
    `const handlers = { onSave(x){ ${ifs(13)} } };`,
    `window.app = { make: function (R) { class C { render(x){ ${ifs(13)} } } return C; } };`,
    `this.onKey = (x) => { ${ifs(13)} };`,
  ].join("\n"));
  const want = ["Shop/total", "outer/inner", "outer/(anonymous 1)", "outer/(anonymous 2)", "onSave", "make/C/render", "this.onKey"];
  ok(JSON.stringify(Object.keys(got).sort()) === JSON.stringify(want.slice().sort()), "names: " + JSON.stringify(Object.keys(got)));
  const twice = valuesOf(`function a(x){ ${ifs(13)} }\nfunction b(){ function a(x){ ${ifs(13)} } }\nconst o = { get v(){ const x=0; ${ifs(13)} }, set v(x){ ${ifs(13)} } };`);
  ok(JSON.stringify(Object.keys(twice).sort()) === JSON.stringify(["a", "b/a", "get v", "set v"]), "nested and accessor names stay apart: " + JSON.stringify(Object.keys(twice)));
}

console.log("\n— the names survive moved lines and a formatter —");
{
  const before = valuesOf(`function f(x){${ifs(13)}}\nfunction g(x){${ifs(14)}}`);
  const after = valuesOf(`\n\n// moved and laid out again\nfunction g(x) {\n  ${ifs(14).replace(/;/g, ";\n  ")}\n}\n\nfunction f(x) {\n  ${ifs(13).replace(/;/g, ";\n  ")}\n}\n`);
  const sorted = (o) => JSON.stringify(Object.entries(o).sort());
  ok(sorted(before) === sorted({ f: 14, g: 15 }) && sorted(after) === sorted(before), "same names, same numbers: " + JSON.stringify([before, after]));
}

console.log("\n— the guard —");
{
  const base = { limit: 12, deep: 3, typed: ["a.js", "b.js"], functions: { big: 40, mid: 20 } };
  const cur = (functions, more) => ({ limit: 12, deep: 3, typed: ["a.js", "b.js"], functions, ...more });
  const reason = "a leak fix needs one more branch here";

  ok(!compare(base, cur({ big: 40, mid: 20 })).blocking.length, "the same numbers pass");
  let d = compare(base, cur({ big: 41, mid: 20 }));
  ok(d.blocking.length === 1 && /^big got more complex: 40 → 41$/.test(d.blocking[0]), "a function above the limit that got more complex blocks, once: " + d.blocking);
  d = compare(base, cur({ big: 41, mid: 20 }), [{ function: "big", reason }]);
  ok(!d.blocking.length && d.allowed.length === 1 && d.total.cur === d.total.base, "a rise named with a reason passes, and leaves the total alone: " + JSON.stringify(d));
  d = compare(base, cur({ big: 41, mid: 20 }), [{ function: "big", reason: "ok" }]);
  ok(d.blocking.length === 1 && d.unexplained[0] === "big", "a reason must be a sentence: " + JSON.stringify(d));

  d = compare(base, cur({ "big/a": 15, "big/b": 15, "big/c": 15, mid: 20 }));
  ok(!d.blocking.length && d.total.base === 36 && d.total.cur === 17, "a long function split into parts still above the limit passes: " + JSON.stringify(d.total) + " " + d.blocking);
  d = compare(base, cur({ big: 40, mid: 20, fresh: 14 }));
  ok(d.blocking.length === 1 && /^the total above 12 rose: 36 → 38$/.test(d.blocking[0]), "a new function above the limit must be paid for: " + d.blocking);
  ok(!compare(base, cur({ big: 38, mid: 20, fresh: 14 })).blocking.length, "...and passes when another got simpler by as much");
  d = compare(base, cur({ big: 40, mid: 20, fresh: 30 }), [{ function: "fresh", reason: "a new reader for a new kind of picture" }]);
  ok(!d.blocking.length && d.total.cur === 36, "a new function named with a reason passes, outside the total: " + JSON.stringify(d));

  ok(compare(base, cur({ big: 40, mid: 20 }, { deep: 4 })).blocking.some((l) => /nested deeper than 4: 3 → 4/.test(l)), "deeper nesting blocks");
  ok(compare(base, cur({ big: 40, mid: 20 }, { typed: ["a.js"] })).blocking.some((l) => /^b\.js left the type checks$/.test(l)), "a file that leaves the type checks blocks");
  d = compare(base, cur({ big: 40, mid: 20 }), [{ function: "mid", reason: "accepted for an earlier change" }]);
  ok(d.stale[0] === "mid" && !d.blocking.length, "an accepted entry that matches nothing is reported as stale");
  d = compare(base, cur({ big: 30 }));
  ok(d.better.length === 2 && !d.blocking.length, "what got better is listed: " + d.better);
}

console.log("\n— the command, against the working tree's baseline —");
{
  const env = { ...process.env, GATE_BASE_REF: "" };
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, "scripts", "complexity.js"), "--check"], { cwd: ROOT, env, encoding: "utf8" });
  ok(r.status === 0 && /complexity guard, against the working tree's baseline/.test(r.stdout), "passes on the code as committed: " + (r.stdout + r.stderr).slice(0, 300));
}

console.log("\n— the app script is cut from its script tag —");
{
  const s = appScript('<p>x</p><script type="text/x-dc" data-a="1">let a=1;</script><script>b()</script>');
  ok(s.includes("let a=1;") && !s.includes("b()"), "only the text/x-dc block");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
