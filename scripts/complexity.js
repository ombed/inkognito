/* The complexity numbers the review brief quotes, from one committed command, and the guard that keeps
   them from getting worse:
     node scripts/complexity.js [--top=10]   the list, highest first
     node scripts/complexity.js --baseline   writes scripts/complexity-baseline.json from the code as it is
     node scripts/complexity.js --check      fails when the code is worse than the baseline at GATE_BASE_REF
                                             (the PR's base, set in CI), or than the working tree's copy

   The brief's first list was typed from an ad-hoc eslint run that hit a parse error on
   engine/08-docx.js and skipped the file without saying so, so the function that builds the
   downloaded file, redactDocx, was missing from it (outside review, H15). This measures the
   bundle, redact-engine.js, instead of the sections, and also page-component.js, the screen's
   logic (index.html's text/x-dc script block until 13.10). A file that does not parse is an
   error here, not a silent skip.

   Scope: redact-engine.js, page-logic.js, scripts/harvest-shapes.js and page-component.js.
   Rules: eslint `complexity` above 12 and `max-depth` above 4.

   The guard (Track 2 of the stand-out plan, step 1, 18.10) compares names, not lines: a function is
   named by the functions and classes it sits in, so the baseline survives moved code and a formatter.
   What blocks is listed above compare(). Like the recall gate (bench/gate.js), it reads the baseline at
   the PR's base, so a change cannot pass by rewriting its own; a rise it lets through is named, with a
   reason, in scripts/complexity-accepted.json. tests/complexity_t.js fails while the committed baseline
   differs from the code, so the numbers on main are always the code's. */
const fs = require("fs");
const path = require("path");
const { Linter } = require("eslint");
const { builtinRules } = require("eslint/use-at-your-own-risk");

const ROOT = path.join(__dirname, "..");
const LIMIT = 12, DEPTH = 4;
const BASELINE = path.join(ROOT, "scripts", "complexity-baseline.json");
const ACCEPTED = path.join(ROOT, "scripts", "complexity-accepted.json");
const FN = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const CLASS = new Set(["ClassDeclaration", "ClassExpression"]);

// the app's logic as it was until 13.10: the body of a <script type="text/x-dc"> block, run by new Function
function appScript(html) {
  const open = html.indexOf('<script type="text/x-dc"');
  if (open < 0) throw new Error("index.html: no text/x-dc script block");
  const start = html.indexOf(">", open) + 1;
  const end = html.indexOf("</script>", start);
  return "(function(){\n" + html.slice(start, end) + "\n});";
}

function sources(root) {
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  return [
    { file: "redact-engine.js", code: read("redact-engine.js"), sourceType: "module" },
    { file: "page-logic.js", code: read("page-logic.js"), sourceType: "script" },
    { file: "scripts/harvest-shapes.js", code: read("scripts/harvest-shapes.js"), sourceType: "commonjs" },
    { file: "page-component.js", code: read("page-component.js"), sourceType: "script" },
  ];
}

// eslint's own complexity rule, run so that each report keeps the function it is about (the guard names a
// function by where it sits), and every function on the way, in source order, to number the unnamed ones
function counting(found, all) {
  const rule = builtinRules.get("complexity");
  return {
    meta: rule.meta,
    create(context) {
      const report = (d) => found.push({ node: d.node, name: d.data.name, value: d.data.complexity, line: d.loc.start.line });
      const visitors = rule.create(Object.create(context, { report: { value: report } }));
      for (const t of FN) {
        const prev = visitors[t];
        visitors[t] = prev ? (n) => { all.push(n); prev(n); } : (n) => all.push(n);
      }
      return visitors;
    },
  };
}

const dotted = (n) => n.type === "Identifier" ? n.name : n.type === "ThisExpression" ? "this"
  : n.type === "MemberExpression" && !n.computed && dotted(n.object) ? dotted(n.object) + "." + n.property.name : null;

// what the code calls a function or class: its own name, the variable, key or member it is given to, or nothing
function ownName(n) {
  const p = n.parent;
  if (n.id && n.id.name) return n.id.name;
  if (!p) return null;
  if (p.type === "VariableDeclarator" && p.init === n) return p.id.type === "Identifier" ? p.id.name : null;
  if ((p.type === "MethodDefinition" || p.type === "Property" || p.type === "PropertyDefinition") && p.value === n && !p.computed) {
    const k = p.key.type === "Literal" ? String(p.key.value) : p.key.name;
    return p.kind === "get" || p.kind === "set" ? p.kind + " " + k : k;
  }
  if (p.type === "AssignmentExpression" && p.right === n) return dotted(p.left);
  return null;
}

// a function's name for the guard: the names of the functions and classes around it, outer first, joined by
// "/" ("make/Component/renderVals"); one without a name is numbered among the unnamed ones in the same place,
// in the order they appear ("nerFixRegExp/(anonymous 2)")
function namer(all) {
  const known = new Map(), unnamed = new Map();
  const keyOf = (n) => {
    if (known.has(n)) return known.get(n);
    let up = n.parent;
    while (up && !FN.has(up.type) && !CLASS.has(up.type)) up = up.parent;
    const outer = up ? keyOf(up) : "";
    let own = ownName(n);
    if (!own) { const k = (unnamed.get(outer) || 0) + 1; unnamed.set(outer, k); own = `(anonymous ${k})`; }
    const key = outer ? outer + "/" + own : own;
    known.set(n, key);
    return key;
  };
  for (const n of all) keyOf(n);
  return keyOf;
}

function measure(srcs) {
  const linter = new Linter({ configType: "flat" });
  const fns = [], deep = {}, taken = new Map();
  for (const s of srcs) {
    const found = [], all = [];
    const msgs = linter.verify(s.code, [{
      languageOptions: { ecmaVersion: "latest", sourceType: s.sourceType },
      plugins: { guard: { rules: { complexity: counting(found, all) } } },
      rules: { "guard/complexity": ["warn", LIMIT], "max-depth": ["warn", DEPTH] },
    }], { filename: s.file });
    const fatal = msgs.find((m) => m.fatal);
    if (fatal) throw new Error(`${s.file}: does not parse (${fatal.message}, line ${fatal.line})`);
    deep[s.file] = msgs.filter((m) => m.ruleId === "max-depth").length;
    const keyOf = namer(all);
    for (const f of found.sort((a, b) => a.node.range[0] - b.node.range[0])) {
      let key = keyOf(f.node);
      const n = (taken.get(key) || 0) + 1;
      taken.set(key, n);
      if (n > 1) key += "#" + n;
      fns.push({ file: s.file, line: f.line, name: f.name, key, value: f.value });
    }
  }
  fns.sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { fns, deep };
}

// the numbers the guard keeps: every function above the limit by name, the places nested too deep, and the
// files in the type checks (tsconfig.check.json)
function snapshot(root) {
  const { fns, deep } = measure(sources(root));
  const functions = {};
  for (const x of fns) functions[x.key] = x.value;
  const typed = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.check.json"), "utf8")).files.slice().sort();
  return { limit: LIMIT, deep: Object.values(deep).reduce((a, b) => a + b, 0), typed, functions, fns, perFile: deep };
}

const above = (functions, limit) => Object.values(functions).reduce((t, v) => t + Math.max(0, v - limit), 0);

/* What blocks: a function above the limit at the base that got more complex; a rise in the total above the
   limit (over every function above it, how far above), so a new function above the limit must be paid for,
   as splitting a long one pays for its parts (counting the functions instead would block that split); more
   places nested deeper than the limit; a file that left the type checks. A function the accepted list names
   with a reason may rise or be new, and its rise is left out of the total.
   accepted: [{ function: "<name>", reason: "…" }]; a reason is a sentence, not a mark (12 characters or more). */
function compare(base, cur, accepted) {
  const ok = new Map();
  for (const a of accepted || []) if (a && a.function && String(a.reason || "").trim().length >= 12) ok.set(a.function, a.reason);
  const limit = base.limit || LIMIT, blocking = [], allowed = [], better = [], used = new Set(), counted = {};
  for (const [k, v] of Object.entries(cur.functions)) {
    const was = base.functions[k];
    if (was !== undefined && v < was) better.push(`${k}: ${was} → ${v}`);
    if (was === undefined ? !ok.has(k) : v <= was) { counted[k] = v; continue; }
    if (ok.has(k)) {
      used.add(k);
      allowed.push(`${k}: ${was === undefined ? "new" : was} → ${v}, accepted: ${ok.get(k)}`);
      if (was !== undefined) counted[k] = was;
      continue;
    }
    blocking.push(`${k} got more complex: ${was} → ${v}`);
    counted[k] = was; // blocked once, here, not again through the total
  }
  for (const k of Object.keys(base.functions)) if (!(k in cur.functions)) better.push(`${k}: ${base.functions[k]} → not above ${limit}, or renamed`);
  const total = { base: above(base.functions, limit), cur: above(counted, limit) };
  if (total.cur > total.base) blocking.push(`the total above ${limit} rose: ${total.base} → ${total.cur}`);
  if (cur.deep > base.deep) blocking.push(`places nested deeper than ${DEPTH}: ${base.deep} → ${cur.deep}`);
  for (const f of base.typed || []) if (!(cur.typed || []).includes(f)) blocking.push(`${f} left the type checks`);
  const stale = [...ok.keys()].filter((k) => !used.has(k));
  const unexplained = (accepted || []).filter((a) => a && a.function && String(a.reason || "").trim().length < 12).map((a) => a.function);
  return { blocking, allowed, better, stale, unexplained, total };
}

// what the baseline file holds: the snapshot, without the measurement's details
function baselineOf(s) {
  return { note: "Written by node scripts/complexity.js --baseline; read by --check and tests/complexity_t.js. Functions above the limit, by name.",
    limit: s.limit, deep: s.deep, typed: s.typed, functions: s.functions };
}

// the differences between two baselines that the committed file must not have
function differs(a, b) {
  const out = [];
  if (a.deep !== b.deep) out.push(`deep ${a.deep} → ${b.deep}`);
  if (JSON.stringify(a.typed) !== JSON.stringify(b.typed)) out.push("typed files");
  for (const k of new Set([...Object.keys(a.functions), ...Object.keys(b.functions)])) {
    if (a.functions[k] !== b.functions[k]) out.push(`${k}: ${a.functions[k] === undefined ? "absent" : a.functions[k]} → ${b.functions[k] === undefined ? "absent" : b.functions[k]}`);
  }
  return out;
}

module.exports = { measure, sources, appScript, snapshot, compare, baselineOf, differs, LIMIT, DEPTH, BASELINE, ACCEPTED };

if (require.main === module) {
  const s = snapshot(ROOT);
  if (process.argv.includes("--baseline")) {
    fs.writeFileSync(BASELINE, JSON.stringify(baselineOf(s), null, 1) + "\n");
    console.log(`wrote ${path.relative(ROOT, BASELINE)}: ${s.fns.length} functions above ${LIMIT}, total above ${LIMIT} ${above(s.functions, LIMIT)}`);
  } else if (process.argv.includes("--check")) {
    const { readBaseline } = require("../bench/gate.js");
    const ref = process.env.GATE_BASE_REF || "";
    let base = readBaseline(BASELINE, ref, null), from = ref ? `the baseline at ${ref}` : "the working tree's baseline";
    if (!base && ref) { base = readBaseline(BASELINE, "", null); from = `the working tree's baseline (none at ${ref})`; }
    if (!base) { console.log("complexity guard: no baseline yet; run node scripts/complexity.js --baseline"); process.exit(1); }
    const accepted = fs.existsSync(ACCEPTED) ? (JSON.parse(fs.readFileSync(ACCEPTED, "utf8")).accepted || []) : [];
    const d = compare(base, s, accepted);
    console.log(`complexity guard, against ${from}: total above ${LIMIT} ${d.total.base} → ${d.total.cur}, ${s.fns.length} functions above ${LIMIT}, highest ${s.fns.length ? s.fns[0].value : 0}`);
    for (const l of d.better) console.log("  better  " + l);
    for (const l of d.allowed) console.log("  allowed " + l);
    for (const l of d.blocking) console.log("  BLOCKS  " + l);
    for (const e of d.stale) console.log("  stale   " + e + " (in complexity-accepted.json, matches nothing: remove it)");
    for (const e of d.unexplained) console.log("  no reason " + e + " (complexity-accepted.json: a reason is a sentence)");
    if (d.blocking.length || d.unexplained.length) { console.log("complexity guard: blocking"); process.exit(1); }
  } else {
    const top = Number((process.argv.find((a) => a.startsWith("--top=")) || "--top=10").slice(6));
    for (const f of Object.keys(s.perFile)) {
      console.log(`${f}: ${s.fns.filter((x) => x.file === f).length} functions above ${LIMIT}, ${s.perFile[f]} places nested deeper than ${DEPTH}`);
    }
    console.log(`\n${s.fns.length} functions above ${LIMIT}, total above ${LIMIT} ${above(s.functions, LIMIT)}, ${s.deep} places nested deeper than ${DEPTH}`);
    console.log(`\ntop ${top} by complexity:`);
    for (const x of s.fns.slice(0, top)) console.log(`  ${String(x.value).padStart(4)}  ${x.name}  (${x.file}:${x.line})  ${x.key}`);
  }
}
