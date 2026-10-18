/* The engine in Node: the one way the Node suites, the benchmark and the scripts load redact-engine.js.

   redact-engine.js is an ES module for the browser. Node gets a CommonJS copy of it that exports every
   top-level name, because the suites read the engine's insides as well as what the page uses. The copy is
   written once for each text of the engine, to the system's temp folder, and required from there, so two
   texts (main's engine beside the one being changed) are two separate engines. The browser pieces the engine
   expects are put in place first: an XML parser (xmldom, with the three DOM methods the engine uses that
   xmldom lacks) and `window`. Compression needs nothing: Node has DecompressionStream and CompressionStream,
   as the browser does.

   Until 18.10, 22 suites and the benchmark each cut their own copy out of tests/app.html at text markers and
   patched a line in it; the patch had matched nothing since 12.10, and nothing could tell.

   A test that swaps a piece of the engine, to see what happens when it fails, does it with swap(name, value),
   and only for a name in SWAPPABLE. The list is the contract between the engine and every test that reaches
   inside it, here and in the browser: tests/enginenode_t.js checks that each name can still be reassigned, so
   a rename fails there, not quietly in the test that swaps it.

     const E = require("../scripts/engine-node.js");                // the engine in the working tree
     const old = E.load({ source: text });                           // another text, e.g. from git show
     const swept = E.load({ patches: [[from, to]] });                // each patch must match exactly once
     const was = E.swap("bodyNames", () => { throw new Error(); });  // gives back the piece it replaced */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { Linter } = require("eslint");
const xd = require("@xmldom/xmldom");

const SRC = path.join(__dirname, "..", "redact-engine.js");
const DIR = path.join(os.tmpdir(), "inkognito-engine");

// every piece a test replaces, and who replaces it
const SWAPPABLE = {
  bodyNames: "tests/failopen_t.js, tests/console_t.js; e2e: a layer that throws",
  nameish: "tests/failopen_t.js, tests/console_t.js",
  foldEvidence: "tests/failopen_t.js",
  nerLoad: "tests/failopen_t.js, tests/console_t.js, tests/readers_t.js: a stand-in model",
  nerEnv: "tests/diag_t.js; e2e/helpers.js serveEngineWithStub",
  nerCached: "e2e/helpers.js serveEngineWithStub",
  nerRun: "e2e/helpers.js serveEngineWithStub; e2e specs with a slow or failing model",
  redactDocx: "e2e specs that hold the engine mid-run",
  jsonRes: "tests/diag_t.js: the model cache's reply",
  RAW_FETCH: "tests/diag_t.js: the model's download",
};
// what the browser tests replace that is not a name: a method on a class the engine keeps
const SWAPPABLE_METHODS = { "Engine.prototype.detect": "e2e specs where detection throws" };

// xmldom lacks children, querySelector and remove(); the engine uses all three
function shims() {
  if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
  if (typeof global.DOMParser === "undefined") global.DOMParser = xd.DOMParser;
  if (typeof global.XMLSerializer === "undefined") global.XMLSerializer = xd.XMLSerializer;
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", {
      get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
    if (!proto.querySelector) proto.querySelector = function (t) {
      const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
    if (!proto.remove) proto.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
  }
}

// the engine's top-level names and how each is declared: function, class, const, let or var
function topNames(src) {
  const linter = new Linter({ configType: "flat" });
  const msgs = linter.verify(src, [{ languageOptions: { ecmaVersion: "latest", sourceType: "module" } }]);
  const fatal = msgs.find((m) => m.fatal);
  if (fatal) throw new Error(`redact-engine.js does not parse: ${fatal.message}, line ${fatal.line}`);
  const names = new Map();
  const bind = (id, kind) => {
    if (!id) return;
    if (id.type === "Identifier") names.set(id.name, kind);
    else if (id.type === "ObjectPattern") for (const p of id.properties) bind(p.type === "RestElement" ? p.argument : p.value, kind);
    else if (id.type === "ArrayPattern") for (const e of id.elements) bind(e && (e.type === "RestElement" ? e.argument : e), kind);
    else if (id.type === "AssignmentPattern") bind(id.left, kind);
  };
  for (const st of linter.getSourceCode().ast.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (!d) continue;
    if (d.type === "FunctionDeclaration") bind(d.id, "function");
    else if (d.type === "ClassDeclaration") bind(d.id, "class");
    else if (d.type === "VariableDeclaration") for (const v of d.declarations) bind(v.id, d.kind);
  }
  return names;
}

// the CommonJS text: the engine without its export statements, a swap for the listed pieces, every name exported
function commonjs(source, patches) {
  // LF throughout, so a multi-line patch matches whatever the checkout's line endings are
  let src = String(source).replace(/\r\n/g, "\n");
  for (const [from, to] of patches || []) {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`patch matches ${n} times, need exactly 1: ${String(from).slice(0, 60)}`);
    src = src.replace(from, () => to);
  }
  const names = topNames(src);
  for (const own of ["swap", "load", "SWAPPABLE"]) if (names.has(own)) throw new Error(`the engine declares ${own}, a name the loader adds`);
  src = src.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, "").replace(/^export\s*\{[\s\S]*?\};?[ \t]*$/gm, "");
  const cases = Object.keys(SWAPPABLE).filter((n) => ["function", "let", "var"].includes(names.get(n)))
    .map((n) => `case ${JSON.stringify(n)}:{const was=${n};${n}=value;return was}`).join("");
  return 'if (typeof globalThis.window === "undefined") globalThis.window = globalThis;\n' + src +
    `\nfunction __swap(name,value){switch(name){${cases}default:throw new Error("not a piece the tests may swap: "+name)}}` +
    `\nmodule.exports={${[...names.keys()].join(",")},swap:__swap};\n`;
}

// one file per engine text, patches and version of this loader: reading the engine again is skipped when it exists
const SELF = crypto.createHash("sha1").update(fs.readFileSync(path.join(__dirname, "engine-node.js"))).digest("hex");
function load(o) {
  const opt = o || {};
  shims();
  const source = opt.source != null ? String(opt.source) : fs.readFileSync(SRC, "utf8");
  const key = crypto.createHash("sha1").update(SELF).update(source).update(JSON.stringify(opt.patches || [])).digest("hex");
  const file = path.join(DIR, key.slice(0, 16) + ".cjs");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = file + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, commonjs(source, opt.patches));
    fs.renameSync(tmp, file);
  }
  const E = require(file);
  return Object.assign(E, { load, SWAPPABLE, SWAPPABLE_METHODS });
}

module.exports = load();
module.exports.topNames = topNames;
module.exports.commonjs = commonjs;
