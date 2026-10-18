/* scripts/engine-node.js, the one way Node loads the engine, and its contract with the tests that reach inside.

   Until 18.10, 22 suites and the benchmark each cut their own engine out of tests/app.html at text markers and
   patched a line in it, and the patch had matched nothing since 12.10. Here: the loader gives the engine with
   every name; every piece a test may swap, in Node or in the browser, can still be reassigned, so a rename
   fails here rather than quietly in the test that swaps it; a patch must match once; and no suite cuts the
   engine out of a page or patches its text again. */
const fs = require("fs");
const path = require("path");
const E = require("../scripts/engine-node.js");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const src = fs.readFileSync(path.join(ROOT, "redact-engine.js"), "utf8");

console.log("\n— the engine, with every name —");
{
  const shipped = [...(src.match(/^export\s*\{([\s\S]*?)\};?[ \t]*$/m) || ["", ""])[1].split(",").map((s) => s.trim()).filter(Boolean),
    ...[...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1])];
  const missing = shipped.filter((n) => !(n in E));
  ok(shipped.length > 100 && !missing.length, `every name the page can reach is there (${shipped.length}): missing ${missing}`);
  ok(typeof E.anchored === "function" && typeof E.flatten === "function", "and the insides the suites read");
  ok(require("./core.js") === E, "tests/core.js is the same engine");
}

console.log("\n— the pieces a test may swap can still be swapped —");
{
  const names = E.topNames(src);
  for (const [name, who] of Object.entries(E.SWAPPABLE)) {
    const kind = names.get(name);
    ok(kind === "function" || kind === "let" || kind === "var", `${name} (${who}) is a function or a variable the engine can be given: it is ${kind || "gone"}`);
  }
  ok(typeof E.Engine === "function" && typeof E.Engine.prototype.detect === "function", "Engine.prototype.detect, which the browser tests replace, is there");
  const keep = E.bodyNames, stand = () => [];
  const was = E.swap("bodyNames", stand);
  ok(was === keep, "a swap gives back the piece it replaced");
  E.swap("bodyNames", was);
  let refused = "";
  try { E.swap("norm", () => ""); } catch (e) { refused = e.message; }
  ok(/not a piece the tests may swap: norm/.test(refused), "a name not on the list is refused: " + refused);
}

console.log("\n— a patch must match once, and another text is another engine —");
{
  const throwsOn = (patches) => { try { E.load({ patches }); return ""; } catch (e) { return e.message; } };
  ok(/matches 0 times/.test(throwsOn([["a text the engine does not have", "x"]])), "a patch that matches nothing is an error");
  ok(/matches \d+ times/.test(throwsOn([["function ", "function "]])), "a patch that matches more than once is an error");
  const other = E.load({ patches: [["function anchored(text,ctx){", "function anchored(text,ctx){if(globalThis.__never)void 0;"]] });
  ok(other !== E && typeof other.anchored === "function" && other.anchored !== E.anchored, "a patched engine is a separate one");
  ok(E.load() === E, "the same text gives the same engine");
}

console.log("\n— no suite cuts the engine out of a page or patches its text —");
{
  // whole-page suites run tests/app.html in jsdom; the four blocked suites are records that never run (tests/run.js)
  const PAGE = new Set(["tok_t.js", "diag_t.js", "build-fixtures.js", "race_t.js", "theme_t.js", "ui.js", "flow.js"]);
  const own = fs.readdirSync(__dirname).filter((f) => f.endsWith(".js") && !f.endsWith("-core.js") && f !== "core.js" && f !== path.basename(__filename));
  const cuts = own.filter((f) => !PAGE.has(f) && /app\.html/.test(fs.readFileSync(path.join(__dirname, f), "utf8")));
  ok(!cuts.length, "only the whole-page suites read tests/app.html: " + cuts.join(", "));
  const patchRx = /\.replace\(\s*['"`]const (inflate|deflate)=/;
  const patched = [...own.map((f) => path.join(__dirname, f)), ...fs.readdirSync(path.join(ROOT, "bench")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "bench", f))]
    .filter((f) => patchRx.test(fs.readFileSync(f, "utf8")));
  ok(!patched.length, "nothing patches the engine's compression lines: " + patched.map((f) => path.relative(ROOT, f)).join(", "));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
