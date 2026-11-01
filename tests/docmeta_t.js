/* The document's own details outside the two parts the properties pass knew by name (the bug hunt of 1.11).
   - A package written by .NET (System.IO.Packaging) keeps its core properties in
     package/services/metadata/core-properties/<id>.psmdcp: the author, the last editor and a title naming the client
     left with the file under a green bar, because only docProps/core.xml and docProps/app.xml were cleaned.
   - word/settings.xml kept the document's revision-session ids (w:rsids, w:rsidRoot) and its w14/w15 docId, the
     same ids already stripped from every paragraph and run because they link documents to one another.
   Invented names only. */
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
const C = require("./core.js");
const { mkzip } = require("./mkzip.js");
const { base, doc, P, R } = require("./structure-lib.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const TXT = new TextDecoder();
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };

const CORE_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties";
const core = (prefixed) => prefixed
  ? `<?xml version="1.0" encoding="utf-8"?><cp:coreProperties xmlns:cp="${CORE_NS}" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>נועה ברזילי</dc:creator><cp:lastModifiedBy>אורי קרמליץ</cp:lastModifiedBy><dc:title>תיק ברזילי נגד קרמליץ</dc:title><cp:keywords>מזונות</cp:keywords></cp:coreProperties>`
  : `<?xml version="1.0" encoding="utf-8"?><coreProperties xmlns="${CORE_NS}" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>נועה ברזילי</dc:creator><lastModifiedBy>אורי קרמליץ</lastModifiedBy><dc:title>תיק ברזילי נגד קרמליץ</dc:title></coreProperties>`;
const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w:zoom w:percent="100"/><w:rsids><w:rsidRoot w:val="00A1B2C3"/><w:rsid w:val="00A1B2C3"/><w:rsid w:val="00D4E5F6"/></w:rsids><w14:docId w14:val="1A2B3C4D"/><w15:docId w15:val="{6F1D2C3B-4A5E-4F60-8A9B-0C1D2E3F4A5B}"/><w:compat/></w:settings>`;

async function run(extra) {
  const files = [...base, { name: "word/document.xml", body: doc(P(R("הבקשה הוגשה."))) }, ...extra];
  const res = await C.redactDocx(mkzip(files), [], [], OPT);
  const parts = await C.unzip(await res.blob.arrayBuffer());
  const text = (n) => { const f = parts.find((x) => x.name === n); return f ? TXT.decode(f.data) : null; };
  return { res, text };
}

(async () => {
  console.log("\n— core properties in a .psmdcp part, as .NET writes them —");
  for (const prefixed of [true, false]) {
    const name = "package/services/metadata/core-properties/4f1a2b3c4d5e4f60.psmdcp";
    const { res, text } = await run([{ name, body: core(prefixed) }]);
    const t = text(name) || "";
    for (const v of ["נועה ברזילי", "אורי קרמליץ", "תיק ברזילי נגד קרמליץ", "מזונות"]) ok(!t.includes(v), (prefixed ? "cp: prefix" : "default namespace") + ": «" + v + "» is gone from the .psmdcp part");
    ok(res.structural.meta.some((m) => /^creator=/.test(m)), (prefixed ? "cp: prefix" : "default namespace") + ": the report names what was removed (" + res.structural.meta.join(" | ") + ")");
  }

  console.log("\n— the class: a properties part is known by what it holds, under any name —");
  {
    const name = "customProps/other-name.xml";
    const { text } = await run([{ name, body: core(true) }]);
    ok(!(text(name) || "").includes("נועה ברזילי"), "core properties under another name and folder are cleaned too");
    const plain = "word/notes-for-me.xml", body = `<?xml version="1.0"?><notes><creator>נועה ברזילי</creator></notes>`;
    const r2 = await run([{ name: plain, body }]);
    ok((r2.text(plain) || "").includes("<creator>"), "a part that is not a properties part keeps its structure (only the last pass may change its text)");
  }

  console.log("\n— word/settings.xml: no revision-session ids, no document id —");
  {
    const { text } = await run([{ name: "word/settings.xml", body: settings }]);
    const s = text("word/settings.xml") || "";
    ok(!/rsid/i.test(s), "no w:rsids, w:rsidRoot or w:rsid is left: " + (s.match(/<[^>]*rsid[^>]*>/gi) || []).join(" "));
    ok(!/docId/.test(s), "no w14:docId or w15:docId is left: " + (s.match(/<[^>]*docId[^>]*>/g) || []).join(" "));
    ok(/<w:zoom\b/.test(s) && /<w:compat\b/.test(s), "the rest of the settings stays");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
