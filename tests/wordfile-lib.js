/* Shared by tests/wordtext_t.js, tests/tracked_t.js and tests/unread_t.js (the hunt of 11.10).

   A whole .docx is built in memory the way Word lays it out, run through the real pipeline, and every
   part of the file she downloads is read back, word/_rels/*.rels and docProps included. The XML parser
   is jsdom's, as in the browser: xmldom accepts characters the browser refuses (U+000B), and a suite on
   xmldom would pass where the page says «XML פגום». Every name, number and address here is invented. */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { JSDOM } = require("jsdom");
const win = new JSDOM("<!doctype html><html><body></body></html>").window;
global.DOMParser = win.DOMParser; global.XMLSerializer = win.XMLSerializer;
global.__deflate = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)));
global.__inflate = (b) => new Uint8Array(zlib.inflateRawSync(Buffer.from(b)));
const { mkzip } = require("./mkzip.js");
const HERE = __dirname;

// the engine, as every suite loads it (scripts/engine-node.js); it reads the parser above when it parses
function core() {
  return require("./core.js");
}
// text-to-docx.js, the page's converter for pasted text and PDF text, with the engine it asks for
function textToDocxOf(E) {
  const src = fs.readFileSync(path.join(HERE, "..", "text-to-docx.js"), "utf8").replace(/^export\s+(?=async\s+function)/m, "");
  return new Function("window", src + "\nreturn textToDocx;")({ __RE: E });
}

const NS = [
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
  'xmlns:o="urn:schemas-microsoft-com:office:office"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
  'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'mc:Ignorable="w14 w15"',
].join(" ");
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const DEC = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.";
const P = (inner, ppr = "") => `<w:p>${ppr}${inner}</w:p>`;
const R = (t, rpr = "") => `<w:r>${rpr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const part = (root, body, ns = WNS) => DEC + `<w:${root} ${ns}>${body}</w:${root}>`;

/* o.body: the body of word/document.xml. o.parts: [{name, body, ct, rel}], where rel is the
   relationship type under the officeDocument namespace ("footnotes", "header", …) for a part that
   document.xml points at. o.rels: extra <Relationship> strings for document.xml.rels. o.files: raw
   files added as they are (a part's own .rels, a picture). o.core, o.app, o.settings, o.styles:
   the bodies of those parts, when a case needs its own. */
function docx(o) {
  const parts = o.parts || [];
  const ov = [["/word/document.xml", CT + "document.main+xml"], ["/word/styles.xml", CT + "styles+xml"], ["/word/settings.xml", CT + "settings+xml"],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"], ["/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml"],
    ...parts.filter((x) => x.ct).map((x) => ["/" + x.name, x.ct])];
  const types = DEC + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="htm" ContentType="application/xhtml+xml"/><Default Extension="mht" ContentType="message/rfc822"/><Default Extension="rtf" ContentType="application/rtf"/><Default Extension="txt" ContentType="text/plain"/><Default Extension="png" ContentType="image/png"/>' +
    ov.map(([p, c]) => `<Override PartName="${p}" ContentType="${c}"/>`).join("") + "</Types>";
  const rootRels = DEC + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${RT}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${RT}/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  let n = 100;
  const docRels = DEC + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${RT}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${RT}/settings" Target="settings.xml"/>` +
    parts.filter((x) => x.rel).map((x) => `<Relationship Id="rId${n++}" Type="${RT}/${x.rel}" Target="${x.name.replace(/^word\//, "")}"/>`).join("") + (o.rels || []).join("") + "</Relationships>";
  const files = [
    { name: "[Content_Types].xml", body: types }, { name: "_rels/.rels", body: rootRels },
    { name: "word/document.xml", body: DEC + `<w:document ${NS}><w:body>${o.body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:bidi/></w:sectPr></w:body></w:document>` },
    { name: "word/_rels/document.xml.rels", body: docRels },
    { name: "word/styles.xml", body: o.styles || part("styles", '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>') },
    { name: "word/settings.xml", body: o.settings || part("settings", '<w:zoom w:percent="100"/>', WNS + ' xmlns:r="' + RT + '"') },
    { name: "docProps/core.xml", body: o.core || DEC + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>user</dc:creator><cp:lastModifiedBy>user</cp:lastModifiedBy><cp:revision>2</cp:revision></cp:coreProperties>' },
    { name: "docProps/app.xml", body: o.app || DEC + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application><Company></Company></Properties>' },
    ...parts.map((x) => ({ name: x.name, body: x.body })),
    ...(o.files || []),
  ];
  return mkzip(files);
}

// the page's options (page-component.js opts()), with the place list on
const optsOf = (E, extra) => ({ on: new Set(E.PAT.filter((p) => p.on).map((p) => p.n).concat("PLACES")), flag: new Set(E.PAT.filter((p) => !p.on).map((p) => p.n).concat("NAME_ANCHORED")),
  mode: "real", near: true, body: true, prefixes: "normal", styles: { "*": "blank", DATE: "name" }, ...(extra || {}) });
// the text «העתקה ל־AI» copies (page-component.js redactedText)
const copyOf = (E, res) => res.preview.filter((b) => !E.hiddenPart(b.part)).map((b) => b.text).join("\n").replace(/\n{3,}/g, "\n\n").trim();
// the bar (page-component.js): red when the final check failed, green only when nothing is open
const bar = (v) => !v.passed ? "red" : v.complete ? "green" : "open";

// every part of the file she downloads, as text
async function outOf(E, res) {
  const files = await E.unzip(await res.blob.arrayBuffer());
  const text = (n) => { const f = files.find((x) => x.name === n); return f ? E.TXT.decode(f.data) : null; };
  const xml = files.filter((f) => /\.(xml|rels|htm|html|mht|rtf|txt)$/.test(f.name)).map((f) => ({ name: f.name, t: E.TXT.decode(f.data) }));
  return { files, text, xml, names: files.map((f) => f.name) };
}
// the parts where a string survives: as written, with the tags removed, or percent-encoded
function left(o, s) {
  const out = [];
  for (const { name, t } of o.xml) {
    let dec = t; try { dec = t.replace(/(%[0-9A-Fa-f]{2})+/g, (x) => { try { return decodeURIComponent(x); } catch (_) { return x; } }); } catch (_) { /* as is */ }
    if (t.includes(s) || dec.includes(s) || t.replace(/<[^>]+>/g, "").includes(s)) out.push(name);
  }
  return out;
}
// the browser's parser accepts every XML part, and every internal relationship points at a part that exists
function problems(o) {
  const out = [], names = new Set(o.names);
  for (const { name, t } of o.xml) {
    if (!/\.(xml|rels)$/.test(name)) continue;
    const d = new win.DOMParser().parseFromString(t, "application/xml");
    if (d.querySelector("parsererror")) out.push("not well-formed: " + name);
  }
  for (const { name, t } of o.xml.filter((x) => x.name.endsWith(".rels"))) {
    const dir = name.replace(/_rels\/[^/]*\.rels$/, "");
    for (const m of t.matchAll(/<Relationship\b[^>]*>/g)) {
      if (/TargetMode="External"/.test(m[0])) continue;
      const tg = (/Target="([^"]+)"/.exec(m[0]) || [])[1]; if (!tg) continue;
      const p = tg.startsWith("/") ? tg.slice(1) : path.posix.normalize(dir + tg);
      if (!names.has(p)) out.push(`relationship to a missing part: ${name} -> ${tg}`);
    }
  }
  return out;
}
function suite() {
  let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
  const done = () => { console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; };
  return { ok, done };
}

module.exports = { core, textToDocxOf, docx, P, R, part, NS, WNS, DEC, RT, CT, optsOf, copyOf, bar, outOf, left, problems, suite, win };
