/* The result lock (18.10): the engine at a base commit and the engine in the working tree, run side by side on
   the same documents with the same choices, must give the same results, byte for byte. A change meant to alter
   no behaviour, such as moving code, proves it here instead of claiming it.

   For each document it compares what a person or the page could see:
   - every field of redactDocx's result: what was replaced and what was flagged, the preview, the final check
     and the second scan, the names' map and the date offset;
   - every part of the output file, byte for byte (text, pictures, links, properties), and the file itself;
   - for the synthetic corpus also the text the reader found, what discover offered, the second run with every
     suggestion, near miss and flagged item accepted, and the restore of the redacted text. That is the benchmark's
     chain without the model, but not with the benchmark's choices: those are the five sets below.
   The golden outputs (bench/golden.js) keep only the redacted text of the corpus, and the recall gate counts
   entities; neither sees the rest.

   The documents: the synthetic corpus (bench/corpus), each with five sets of choices (CHOICES): four on bench/lib.js
   OPT, which turns on five detectors only, and the page's own defaults, which turn on every detector the engine
   marks on; and, with --suites, every document the Node suites hand to redactDocx, with the choices each suite
   handed it, recorded by a run of tests/run.js with LOCK_RECORD set (scripts/engine-node.js).

     node bench/lock.js                  # against main, or GATE_BASE_REF as CI sets it
     node bench/lock.js --base=<ref>     # against another commit
     node bench/lock.js --suites         # also every document the suites build (runs them first, a few minutes)
     node bench/lock.js --self           # the working tree against itself: shows that the lock sees no noise */
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { execFileSync, spawnSync } = require("child_process");
const L = require("../scripts/engine-node.js");
const { OPT } = require("./lib.js");

const ROOT = path.join(__dirname, "..");
const CORPUS = path.join(__dirname, "corpus");
// restore's "today" is fixed, so the clock cannot make two runs differ
const TODAY = { d: 18, m: 10, y: 2026 };
/* The sets of choices, each a function of the engine it is handed to, called afresh each run: the engine may change
   what it is handed. The first four are bench/lib.js OPT, which turns on five detectors only (the ID number, a mobile
   phone, an e-mail address, the place list and a street address) and leaves every other detector off, the date and
   the case number among them; the fifth is what the page hands the engine on a fresh visit, every detector the
   engine marks on. */
const fromOPT = (extra) => () => ({ ...OPT, on: new Set(OPT.on), flag: new Set(OPT.flag), body: true, ...extra });
const PAGE = "the page's defaults";
const CHOICES = {
  "five detectors": fromOPT({}),
  labels: fromOPT({ mode: "label" }),
  "black numbers, no near misses": fromOPT({ numStyle: "black", near: false }),
  "a secret key": fromOPT({ aliasKey: "5eed".repeat(16) }),
  /* page-component.js opts() with the page's first state: built from each engine's own list (E.PAT), as the page
     builds it from the engine it loads; the key of the invented names, which the page makes at random once per
     browser, is fixed here. tests/lock_t.js checks it against the page's opts(), so the two cannot drift apart. */
  [PAGE]: (E) => ({
    on: new Set([...E.PAT.filter((p) => p.on).map((p) => p.n), "PLACES"]),
    flag: new Set([...E.PAT.filter((p) => !p.on).map((p) => p.n), "NAME_ANCHORED"]),
    mode: "real", near: true, body: true, prefixes: "normal", aliasKey: "ab12".repeat(16), citeReplace: [],
    styles: { "*": "blank", DATE: "name" },
  }),
};
const choices = (name, E) => CHOICES[name](E);

const sha = (u8) => crypto.createHash("sha256").update(u8).digest("hex");
// what can be compared as text: sets and maps in their order, bytes by their hash, functions and undefined named
const plain = (k, v) => v instanceof Set ? { "@set": [...v] } : v instanceof Map ? { "@map": [...v] }
  : v instanceof Uint8Array || v instanceof ArrayBuffer ? { "@bytes": sha(new Uint8Array(v)) }
  : typeof v === "function" ? "@function" : v === undefined ? "@undefined" : v;

// a result of redactDocx: every field, and the file it wrote, part by part (unzipped by the same reader for both)
async function shot(res) {
  const { blob, ...rest } = res;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts = {};
  for (const f of await L.unzip(bytes.slice().buffer)) parts[f.name] = sha(f.data);
  return { result: rest, file: { zip: sha(bytes), parts } };
}
async function guarded(fn) {
  try { return await fn(); } catch (e) { return { threw: String(e && e.message || e) }; }
}

// one corpus document with one set of choices, the way the benchmark runs it without the model
async function corpusRun(E, buf, name) {
  const norm = (v) => E.norm(String(v || "")).trim();
  const add = (rules, value, kind, rep) => {
    const k = norm(value);
    if (!k || rules.some((r) => norm(r.value) === k)) return;
    rules.push({ value: String(value).trim(), kind: kind || "NAME", replacement: rep || "" });
  };
  const kindOf = (v) => E.cleanEntry(v).kind || "NAME";
  const out = {};
  const blocks = await E.readBlocks(buf.slice(0));
  out.read = blocks.map((b) => [b.part, b.text]);
  const cands = E.discover(blocks);
  out.discover = cands.map((c) => [c.value, c.why]);
  const rules = [];
  for (const c of cands) add(rules, c.value, kindOf(c.value));
  const r1 = await E.redactDocx(buf.slice(0), rules, [], choices(name, E));
  out.first = await shot(r1);
  const rules2 = rules.slice();
  for (const x of r1.verification.suggest || []) add(rules2, x.value, kindOf(x.value));
  for (const x of r1.verification.near || []) add(rules2, x.value, (x.near && x.near.kind) || "NAME", x.near && x.near.rep);
  for (const x of r1.flagged || []) add(rules2, x.value, kindOf(x.value));
  const r2 = await E.redactDocx(buf.slice(0), rules2, [], choices(name, E));
  out.second = await shot(r2);
  const outBlocks = await E.readBlocks(new Uint8Array(await r2.blob.arrayBuffer()).buffer);
  const text = outBlocks.map((b) => b.text).join("\n");
  out.restore = E.restoreNames(text, Object.entries(r2.map || {}), [], { off: r2.dateOff, today: TODAY });
  return out;
}

// where two results first part: a path into them, and the two values there
function firstDiff(a, b, at) {
  if (a === b) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return { at, a, b };
  const keys = Array.isArray(a) ? [...Array(Math.max(a.length, b.length)).keys()] : [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], at + (Array.isArray(a) ? `[${k}]` : `.${k}`));
    if (d) return d;
  }
  if (!Array.isArray(a) && JSON.stringify(Object.keys(a)) !== JSON.stringify(Object.keys(b))) return { at: at + " (the order of its fields)", a: Object.keys(a), b: Object.keys(b) };
  return null;
}
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? "undefined" : s.length > 160 ? s.slice(0, 157) + "..." : s; };

/* Each run starts from a clean engine: the key of the invented names is kept between documents when a caller
   does not name one (the Engine constructor sets it only when its choices hold aliasKey; the page always does),
   so without this a run would depend on the runs before it. */
const fresh = (E) => { if (typeof E.setAliasKey === "function") E.setAliasKey(null); return E; };

// compares two engines on every input; each input gives a fresh copy of what it hands over
async function compare(oldE, newE, inputs) {
  const differs = [];
  for (const { label, run } of inputs) {
    const a = JSON.parse(JSON.stringify(await guarded(() => run(fresh(oldE))), plain));
    const b = JSON.parse(JSON.stringify(await guarded(() => run(fresh(newE))), plain));
    const d = firstDiff(a, b, "");
    if (d) differs.push(`${label}: ${d.at || "the result"}: ${short(d.a)} → ${short(d.b)}`);
  }
  return differs;
}

function corpusInputs() {
  const docs = fs.readdirSync(CORPUS).filter((f) => f.endsWith(".docx")).sort();
  return docs.flatMap((f) => {
    const bytes = fs.readFileSync(path.join(CORPUS, f));
    return Object.keys(CHOICES).map((name) => ({ label: `corpus ${f}, ${name}`, run: (E) => corpusRun(E, new Uint8Array(bytes).buffer, name) }));
  });
}

// the documents the Node suites build: recorded by running them with LOCK_RECORD, then given to each engine as handed
function suiteInputs(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const inputs = [];
  let skipped = 0;
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    if (raw.includes('"@fn":true')) { skipped++; continue; }
    const bytes = Buffer.from(JSON.parse(raw).docx, "base64");
    inputs.push({ label: `suite document ${f.slice(0, 12)}`, run: (E) => {
      const r = JSON.parse(raw, L.untagged);
      return E.redactDocx(new Uint8Array(bytes).buffer, r.subs, r.allow, r.opt).then(shot);
    } });
  }
  return { inputs, skipped };
}

module.exports = { compare, corpusInputs, suiteInputs, corpusRun, firstDiff, CHOICES, PAGE };

if (require.main === module) {
  (async () => {
    const t0 = Date.now();
    const self = process.argv.includes("--self");
    const ref = (process.argv.find((a) => a.startsWith("--base=")) || "").slice(7) || process.env.GATE_BASE_REF || "main";
    const here = fs.readFileSync(path.join(ROOT, "redact-engine.js"), "utf8");
    let oldSrc, from;
    if (self) { oldSrc = here + "\n// the second copy, for --self\n"; from = "the working tree itself"; }
    else {
      oldSrc = execFileSync("git", ["show", `${ref}:redact-engine.js`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8");
      from = `${ref} (${execFileSync("git", ["rev-parse", "--short", ref], { cwd: ROOT }).toString().trim()})`;
    }
    const oldE = L.load({ source: oldSrc }), newE = L;
    const corpus = corpusInputs();
    const differs = await compare(oldE, newE, corpus);
    console.log(`result lock against ${from}: ${corpus.length} corpus runs (${corpus.length / Object.keys(CHOICES).length} documents × ${Object.keys(CHOICES).length} sets of choices)`);
    if (process.argv.includes("--suites")) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inkognito-lock-"));
      const r = spawnSync(process.execPath, [path.join(ROOT, "tests", "run.js")], { cwd: ROOT, env: { ...process.env, LOCK_RECORD: dir }, stdio: "ignore" });
      const { inputs, skipped } = suiteInputs(dir);
      differs.push(...await compare(oldE, newE, inputs));
      console.log(`  and ${inputs.length} documents the suites build (${skipped} skipped: their choices hold a function${r.status ? "; the suites' run exited " + r.status : ""})`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    for (const d of differs.slice(0, 30)) console.log("  DIFFERS  " + d);
    if (differs.length > 30) console.log(`  … and ${differs.length - 30} more`);
    console.log(differs.length ? `result lock: ${differs.length} difference(s)` : `result lock: the same, byte for byte (${Math.round((Date.now() - t0) / 1000)} s)`);
    process.exitCode = differs.length ? 1 : 0;
  })().catch((e) => { console.error(e); process.exitCode = 2; });
}
