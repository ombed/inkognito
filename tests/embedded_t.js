/* Files embedded in a Word file (the owner's decision of 12.10, «A», the wording approved; the engineering audit). A
   spreadsheet pasted as an object went out of the cleaning as it was, names and all, and its preview picture showed them
   too. Now each embedded object is replaced where it stood by «[כאן היה קובץ מוטמע, והוא הוסר]», everything under
   word/embeddings leaves the file, the preview picture leaves with it when nothing else uses it, and a chart whose data
   sat in an embedded workbook keeps what it shows without the link. The file still opens: no link to a missing part.
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
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };
const TXT = new TextDecoder();
const ON = new Set(C.PAT.filter((p) => p.on).map((p) => p.n));
const OPT = { on: ON, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal", styles: {} };
const NSS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const object = (img, emb) => `<w:p><w:r><w:object><v:shape id="_x0000_i1025" style="width:300pt;height:100pt"><v:imagedata r:id="${img}" o:title=""/></v:shape><o:OLEObject Type="Embed" ProgID="Excel.Sheet.12" ShapeID="_x0000_i1025" DrawAspect="Content" ObjectID="_1" r:id="${emb}"/></w:object></w:r></w:p>`;
const legacy = (img, emb) => `<w:p><w:r><w:pict><v:shape id="_x0000_i1026"><v:imagedata r:id="${img}"/></v:shape><o:OLEObject Type="Embed" ProgID="Word.Document.12" ShapeID="_x0000_i1026" r:id="${emb}"/></w:pict></w:r></w:p>`;
const docXml = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${NSS}><w:body>${body}</w:body></w:document>`;
const rels = (list) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, tg]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${tg}"/>`).join("")}</Relationships>`;
const types = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="emf" ContentType="image/x-emf"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/embeddings/Microsoft_Excel_Worksheet.xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>' +
  '<Override PartName="/word/embeddings/Microsoft_Word_Document.docx" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"/>' +
  '<Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>';
const chart = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart><c:plotArea/></c:chart><c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>';
const file = (extra) => mkzip([
  { name: "[Content_Types].xml", body: types },
  { name: "_rels/.rels", body: rels([["rId1", "officeDocument", "word/document.xml"]]) },
  { name: "word/document.xml", body: docXml(P("דנה כהן הגישה את הטבלה.") + object("rId5", "rId6") + legacy("rId8", "rId9") + P("הטבלה מצורפת לעיל.") + P("ושוב: התמונה המשותפת.")) },
  { name: "word/_rels/document.xml.rels", body: rels([["rId5", "image", "media/image1.emf"], ["rId6", "oleObject", "embeddings/Microsoft_Excel_Worksheet.xlsx"],
    ["rId7", "chart", "charts/chart1.xml"], ["rId8", "image", "media/image2.emf"], ["rId9", "package", "embeddings/Microsoft_Word_Document.docx"], ...(extra || [])]) },
  { name: "word/media/image1.emf", body: "EMF preview: Dana Cohen 052-1234567" },
  { name: "word/media/image2.emf", body: "EMF preview two: Dana Cohen" },
  { name: "word/embeddings/Microsoft_Excel_Worksheet.xlsx", body: "PK workbook: Dana Cohen, ID 314277062" },
  { name: "word/embeddings/Microsoft_Word_Document.docx", body: "PK document: Dana Cohen" },
  { name: "word/embeddings/Microsoft_Excel_Worksheet1.xlsx", body: "PK chart data: Dana Cohen" },
  { name: "word/charts/chart1.xml", body: chart },
  { name: "word/charts/_rels/chart1.xml.rels", body: rels([["rId1", "package", "../embeddings/Microsoft_Excel_Worksheet1.xlsx"]]) },
]);

(async () => {
  console.log("\n— the embedded files leave, a line stands where each was —");
  const res = await C.redactDocx(file(), [{ value: "דנה כהן", kind: "NAME", replacement: "" }], [], OPT);
  const parts = await C.unzip(await res.blob.arrayBuffer());
  const names = parts.map((f) => f.name), text = (n) => { const f = parts.find((x) => x.name === n); return f ? TXT.decode(f.data) : ""; };
  ok(!names.some((n) => /^word\/embeddings\//.test(n)), "nothing under word/embeddings is left: " + names.filter((n) => /embeddings/.test(n)).join(", "));
  ok(!names.includes("word/media/image1.emf") && !names.includes("word/media/image2.emf"), "the preview pictures left with them");
  const d = text("word/document.xml");
  ok((d.split(C.OBJ_NOTE).length - 1) === 2, "two lines «" + C.OBJ_NOTE + "», one where each object stood");
  ok(!/<w:object|OLEObject|imagedata/.test(d), "no object, OLE link or preview reference is left in the document");
  const r = text("word/_rels/document.xml.rels");
  ok(!/embeddings\/|image1\.emf|image2\.emf/.test(r) && /charts\/chart1\.xml/.test(r), "the document's links to them are gone; the chart's link stays");
  ok(!/externalData/.test(text("word/charts/chart1.xml")), "the chart keeps what it shows, without its link to the removed workbook");
  ok(!/embeddings/.test(text("word/charts/_rels/chart1.xml.rels")), "and its links file no longer points at it");
  ok(!/embeddings\//.test(text("[Content_Types].xml")), "the content types no longer name the removed parts");
  ok(res.structural.embedded === 3, "the report counts three embedded files: " + res.structural.embedded);
  ok(res.verification.passed, "the final check passes");
  ok(!parts.some((f) => TXT.decode(f.data).includes("Dana Cohen")), "nothing in the file says «Dana Cohen» any more");

  console.log("\n— a picture used elsewhere too stays —");
  const shared = await C.redactDocx(file([["rId10", "image", "media/image1.emf"]]), [], [], OPT);
  const sp = (await C.unzip(await shared.blob.arrayBuffer())).map((f) => f.name);
  ok(sp.includes("word/media/image1.emf") && !sp.includes("word/media/image2.emf"), "a preview picture another link uses stays; the one only the object used goes");

  console.log("\n— a file with no embedded object is as before —");
  const plain = await C.redactDocx(mkzip([{ name: "[Content_Types].xml", body: types }, { name: "word/document.xml", body: docXml(P("דנה כהן הגישה את הבקשה.")) }]), [{ value: "דנה כהן", kind: "NAME", replacement: "" }], [], OPT);
  ok(plain.structural.embedded === 0 && plain.verification.passed, "nothing removed, the check passes");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ " + (e && e.stack || e)); process.exitCode = 1; });
