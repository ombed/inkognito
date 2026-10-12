/* The page runs only the scripts its policy names (the engineering audit of 12.10, item 4: one injected script could
   read the open document and every saved case, and the policy let one run: it allowed 'unsafe-inline', and
   'unsafe-eval' for the runtime that turned the component's text into code). Since 13.10.2026 the component's logic
   is page-component.js, a plain script, and the page's inline scripts are named in the policy by their SHA-256
   (scripts/page-parts.js). What must hold here; e2e/csp.spec.js sees it hold in the browser. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const P = require("../scripts/page-parts.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html"), js = read("page-component.js");
const policy = (h) => Object.fromEntries((h.match(P.CSP) || [])[2].split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

console.log("\n— the policy names what runs, and nothing else —");
const src = policy(html)["script-src"] || [];
ok(!src.includes("'unsafe-inline'"), "no 'unsafe-inline': an injected <script> or onerror does not run");
ok(!src.includes("'unsafe-eval'"), "no 'unsafe-eval': the page builds no code from text");
ok(src.includes("'wasm-unsafe-eval'"), "'wasm-unsafe-eval', for the model's WebAssembly");
const inline = P.inlineScripts(html), hashes = src.filter((x) => /^'sha256-/.test(x));
ok(inline.length === 2, "two inline scripts, the colours before the first paint and the boot: " + inline.length);
for (const code of inline) ok(hashes.includes(P.hashOf(code)), "named by its hash: " + code.trim().slice(0, 60));
ok(hashes.length === new Set(inline.map(P.hashOf)).size, "no hash of a script that is gone: " + hashes.length);
ok(P.withHashes(html) === html, "index.html's policy is as `npm run build:page` writes it");
{
  // a changed inline script is caught: its old hash no longer names it
  const changed = html.replace("console.log(", "console.info(");
  ok(changed !== html && P.withHashes(changed) !== changed, "a script changed by one word needs its hash written again");
}

console.log("\n— the component's logic is a file, not text the page turns into code —");
const m = html.match(P.XDC);
ok(!!m && m[2] === "", 'index.html\'s <script type="text/x-dc"> holds no text');
const at = (f) => html.indexOf('<script src="./' + f + '"></script>');
ok(at("page-component.js") > 0 && at("page-component.js") < at("support.js"), "page-component.js loads before the runtime");
ok(read("sw.js").includes('"./page-component.js"'), "the service worker keeps it for use offline");
{
  // it registers a factory that makes the class from DCLogic and React, as new Function made it from the text
  const win = {};
  vm.runInNewContext(js, { window: win });
  class DCLogic {}
  const C = win.__dcLogic && typeof win.__dcLogic.make === "function" ? win.__dcLogic.make(DCLogic, DCLogic, { createElement() {} }) : null;
  ok(typeof C === "function" && Object.getPrototypeOf(C.prototype) === DCLogic.prototype, "page-component.js registers class Component extends DCLogic");
}
ok(/function evalDcLogic\(src\) \{[\s\S]{0,700}window\.__dcLogic[\s\S]{0,300}pre\.make\.call\(/.test(read("support.js")),
  "the runtime takes it when the page holds no text (support.js, evalDcLogic)");
ok(P.logicOf(js).includes("class Component extends DCLogic"), "the logic sits between page-component.js's two lines");
{
  // as text, less the two test hooks scripts/build-design.js leaves out
  const canvas = (read("design/redact.dc.html").match(P.XDC) || [])[2] || "";
  ok(canvas.includes("class Component extends DCLogic") && canvas.length > P.logicOf(js).length * 0.99, "the design canvas carries the logic as text");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
