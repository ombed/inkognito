/* Nothing of the document is printed to the console (the outside review of 18.10, F10).

   The model's first raw prediction was printed whole, with its word: the review saw the document's first word in the
   console, and a document that opens with a name would have shown the name. The session log has its text guard; the
   console had none. And a layer that failed printed its error whole, whose message can quote what it was reading.
   Here the console is captured while a document goes through the model (a stand-in with the real pipeline's shape),
   the body scan, the label scan and the whole redaction, with each layer also broken on purpose by an error that
   quotes the document; no distinctive word of the document may reach the console. Every name here is invented. */
const xd = require("@xmldom/xmldom");
global.DOMParser = xd.DOMParser; global.XMLSerializer = xd.XMLSerializer;
{
  const p = new xd.DOMParser().parseFromString("<a><b/></a>", "application/xml");
  for (const proto of [Object.getPrototypeOf(p.documentElement), Object.getPrototypeOf(p)]) {
    if (!("children" in proto)) Object.defineProperty(proto, "children", { get() { return Array.from(this.childNodes || []).filter((n) => n.nodeType === 1); } });
    if (!proto.remove) proto.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
    if (!proto.querySelector) proto.querySelector = function (t) { const l = this.getElementsByTagName(t); return l && l.length ? l[0] : null; };
  }
}
const zlib = require("zlib"), fs = require("fs"), path = require("path");
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const HERE = __dirname;
const E = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { P, R, NS, base } = require("./structure-lib.js");
// the document opens with a name (structure-lib's doc() opens with a title of its own)
const doc = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NS}><w:body>${body}</w:body></w:document>`;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const LINES = ["זלמנוביץ קרמניצר הגיש תביעה נגד אבוטבול שקמונה.", "שם: זלמנוביץ קרמניצר", "העדה תמרוני אבוטבול סיפרה על המקרה."];
const WORDS = ["זלמנוביץ", "קרמניצר", "אבוטבול", "שקמונה", "תמרוני"];
const zipOf = () => mkzip([...base, { name: "word/document.xml", body: doc(LINES.map((l) => P(R(l))).join("")) }]);
const OPT = { on: new Set(E.PAT.filter((p) => p.on).map((p) => p.n)), flag: new Set(), mode: "real", near: true, body: true, prefixes: "normal", styles: {} };
// a stand-in for the model with the pipeline's shape: every word a token, the names tagged
const model = async (t) => (t.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || []).map((w) => ({ entity: WORDS.includes(w) ? "B-PER" : "O", score: 0.99, word: w, index: 0 }));
// what the console received while f ran
async function printed(f) {
  const got = [], keep = {};
  for (const k of ["log", "warn", "error", "info", "debug"]) { keep[k] = console[k]; console[k] = (...a) => got.push(a.map((x) => (x instanceof Error ? String(x.stack || x) : typeof x === "string" ? x : JSON.stringify(x))).join(" ")); }
  try { await f(); } catch (e) { got.push("THREW " + String(e && e.stack || e)); } finally { Object.assign(console, keep); }
  return got.join("\n");
}
const quoted = (out) => WORDS.filter((w) => out.includes(w));

(async () => {
  console.log("\n— the model's run prints counts, never a word —");
  {
    E.swap("nerLoad", async () => model);
    const out = await printed(async () => E.nerRun(await E.readBlocks(zipOf().slice(0))));
    ok(out.length > 0, "something is printed (the counts)");
    ok(!quoted(out).length, "no word of the document: " + quoted(out).join(", "));
  }

  console.log("\n— a layer that fails says that it failed and where, not what it was reading —");
  const quoting = () => { throw new Error("נכשל על: " + LINES.join(" | ")); };
  {
    E.swap("nerLoad", async () => async (t) => { throw new Error("chunk failed: " + t); });
    const out = await printed(async () => E.nerRun(await E.readBlocks(zipOf().slice(0))));
    ok(!quoted(out).length, "a model chunk that fails: " + quoted(out).join(", "));
  }
  {
    E.swap("bodyNames", quoting);
    const out = await printed(() => E.redactDocx(zipOf(), [], [], OPT));
    ok(/סריקת גוף הטקסט נכשלה/.test(out), "the body scan's failure is still said");
    ok(!quoted(out).length, "the body scan that fails: " + quoted(out).join(", "));
  }
  {
    E.swap("nameish", quoting);
    const out = await printed(() => E.redactDocx(zipOf(), [], [], OPT));
    ok(!quoted(out).length, "the label scan that fails: " + quoted(out).join(", "));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
