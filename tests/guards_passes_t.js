/* The passes that clean a Word file: behaviours no suite held (the mutation hunt of 1.11, second round).

   Each check here was found the way tests/guards_numbers_t.js found its own: a small, likely edit to one of the
   passes (the last sweep over every part, the field codes and the links in them, the links parts, the file's own
   properties, the headers, footers and notes) and every suite and the result lock stayed green. A broken one means
   a name, an address or a property leaves with the file she downloads, mostly under a green bar, or the links of
   her own document stop working. Each section names the behaviour it protects; the commit that added it names the
   edit that proved it blind. Whole files are built in memory the way Word lays them out and run through the real
   pipeline (tests/wordfile-lib.js, which loads ./core.js with the browser's XML parser), and every part of the
   output is read back. Every name, address and number here is invented. */
const L = require("./wordfile-lib.js");
const { mkzip } = require("./mkzip.js");
const { docx, P, R, part, CT, RT, DEC, outOf, left, problems } = L;
const E = L.core();
const { ok, done } = L.suite();
const OPT = L.optsOf(E);
const enc = encodeURIComponent;
const run = async (o, subs = []) => { const res = await E.redactDocx(docx(o), subs, [], OPT); return { res, o: await outOf(E, res) }; };
// a part a document system or an add-in wrote into the package: no layer reads it, only the last pass
const dms = (inner) => ({ name: "word/dmsCase.xml", body: DEC + `<case xmlns="urn:example:dms">${inner}</case>` });
const dmsOut = (o) => ((o.text("word/dmsCase.xml") || "").match(/<case[^>]*>([\s\S]*)<\/case>/) || [, "(no part)"])[1];
// a field code: its instruction, in as many runs as Word split it into, and the text it shows
const FB = '<w:r><w:fldChar w:fldCharType="begin"/></w:r>', FS = '<w:r><w:fldChar w:fldCharType="separate"/></w:r>', FE = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
const instr = (t) => `<w:r><w:instrText xml:space="preserve">${t}</w:instrText></w:r>`;
const fld = (pieces, shown) => FB + pieces.map(instr).join("") + FS + R(shown) + FE;
const instrOf = (x) => (x.match(/<w:instrText[^>]*>[^<]*<\/w:instrText>/g) || []).map((s) => s.replace(/<[^>]+>/g, "")).join("|").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const targetOf = (rels, id) => { const m = new RegExp(`<Relationship [^>]*Id="${id}"[^>]*>`).exec(rels || ""); const t = m && /Target="([^"]*)"/.exec(m[0]); return t ? t[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&") : null; };
const link = (id, text) => `<w:hyperlink r:id="${id}">${R(text)}</w:hyperlink>`;

// an EMF picture as Word stores one: the header and a description, one text record (EMR_EXTTEXTOUTW) per line, the end
const u16le = (s) => { const a = new Uint8Array(2 * s.length); for (let i = 0; i < s.length; i++) { a[2 * i] = s.charCodeAt(i) & 255; a[2 * i + 1] = s.charCodeAt(i) >> 8; } return a; };
const le32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24], le16 = (v) => [v & 255, v >> 8];
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const has = (u, bytes) => Buffer.from(u).includes(Buffer.from(bytes));
function emf(lines) {
  const desc = u16le("Office\0\0"), descPad = cat(desc, new Uint8Array((4 - desc.length % 4) % 4));
  const text = (s) => { const str = u16le(s), pad = new Uint8Array((4 - str.length % 4) % 4), size = 76 + str.length + pad.length;
    return cat(new Uint8Array([...le32(84), ...le32(size), ...new Array(16).fill(0), ...le32(1), ...new Array(16).fill(0), ...le32(s.length), ...le32(76), ...le32(0), ...new Array(16).fill(0), ...le32(0)]), str, pad); };
  const recs = lines.map(text), eof = new Uint8Array([...le32(14), ...le32(20), ...le32(0), ...le32(16), ...le32(20)]);
  const total = 88 + descPad.length + recs.reduce((n, r) => n + r.length, 0) + eof.length;
  const head = new Uint8Array([...le32(1), ...le32(88 + descPad.length), ...new Array(32).fill(0), 0x20, 0x45, 0x4D, 0x46, ...le32(0x10000), ...le32(total), ...le32(lines.length + 2), ...le16(1), ...le16(0),
    ...le32(desc.length / 2), ...le32(88), ...le32(0), ...le32(1024), ...le32(768), ...le32(320), ...le32(240)]);
  return cat(head, descPad, ...recs, eof);
}
const picture = (id) => P(`<w:r><w:drawing><wp:inline><wp:extent cx="1905000" cy="571500"/><wp:docPr id="1" name="תמונה 1"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="תמונה 1"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`);

(async () => {
  console.log("\n— the last pass, over a part no layer reads: the longer of two listed names goes first —");
  {
    // one person under two names, both on her list: the surname she had, and the double surname she has now
    const subs = [{ value: "דנה לוי", kind: "NAME", replacement: "יעל כהן" }, { value: "דנה לוי-שגיא", kind: "NAME", replacement: "יעל כהן-גל" }];
    const r = await run({ body: P(R("המבקשת דנה לוי-שגיא (בעבר דנה לוי) הגישה את הבקשה.")), files: [dms("<client>דנה לוי-שגיא</client><formerly>דנה לוי</formerly>")] }, subs);
    const x = dmsOut(r.o);
    ok(!left(r.o, "שגיא").length && !left(r.o, "לוי").length && x.includes("<client>יעל כהן-גל</client>") && r.res.verification.passed,
      "the double surname is replaced whole, not cut by the shorter name into «…-שגיא»: " + x + " " + JSON.stringify(r.res.verification.leaks));
  }

  console.log("\n— the last pass finds a listed name the way XML writes it inside an attribute —");
  {
    const FIRM = 'אלון-גל בע"מ';
    const r = await run({ body: P(R(`המבקשת עובדת בחברת ${FIRM} כמנהלת חשבונות.`)), files: [dms('<field name="employer" value="אלון-גל בע&quot;מ"/>')] }, [{ value: FIRM, kind: "ORG", replacement: "חברה א" }]);
    ok(!left(r.o, "אלון-גל").length && r.res.verification.passed, "a company name with gershayim, written &quot; in an attribute, is replaced: " + dmsOut(r.o));
  }

  console.log("\n— a picture's text (EMF): every word of a listed name is replaced on its own, a word of three letters too —");
  {
    const NAME = "שושנה סבג", pic = emf(["הוגש בידי " + NAME, "שושנה", "סבג"]);
    const r = await run({ body: P(R(`${NAME} צירפה תרשים.`)) + picture("rId60"), rels: [`<Relationship Id="rId60" Type="${RT}/image" Target="media/image1.emf"/>`],
      files: [{ name: "word/media/image1.emf", body: pic }] }, [{ value: NAME, kind: "NAME", replacement: "רבקה דהן" }]);
    const out = (r.o.files.find((f) => f.name === "word/media/image1.emf") || {}).data || new Uint8Array(0);
    ok(out.length === pic.length && !has(out, u16le("סבג")) && !has(out, u16le("שושנה")) && has(out, u16le("דהן")) && r.res.verification.passed,
      "the surname of three letters, alone in its own record, is replaced at the same length: " + JSON.stringify({ length: [out.length, pic.length], left: has(out, u16le("סבג")) }));
  }

  console.log("\n— a table of contents keeps its links to its own headings —");
  {
    // Word writes each line of a table of contents as a HYPERLINK field to a bookmark (\l): an internal link, not an address
    const toc = P(FB + instr(' TOC \\o "1-3" \\h \\z \\u ') + FS + FB + instr(' HYPERLINK \\l "_Toc190000001" \\h ') + FS + R("פרק א: העובדות") + FE) +
      P(FB + instr(' HYPERLINK \\l "_Toc190000002" \\h ') + FS + R("פרק ב: הטענות") + FE + FE);
    const heads = P('<w:bookmarkStart w:id="1" w:name="_Toc190000001"/>' + R("פרק א: העובדות") + '<w:bookmarkEnd w:id="1"/>') + P(R("רחל פרידמן הגישה את הבקשה.")) +
      P('<w:bookmarkStart w:id="2" w:name="_Toc190000002"/>' + R("פרק ב: הטענות") + '<w:bookmarkEnd w:id="2"/>');
    const r = await run({ body: toc + heads }, [{ value: "רחל פרידמן", kind: "NAME", replacement: "יעל כהן" }]);
    const ins = instrOf(r.o.text("word/document.xml"));
    ok(ins.includes('HYPERLINK \\l "_Toc190000001"') && ins.includes('HYPERLINK \\l "_Toc190000002"') && !r.res.structural.rels.length,
      "each line still points at its heading, and none is counted as a cleaned link: " + JSON.stringify({ ins, cleaned: r.res.structural.rels }));
  }

  console.log("\n— a header, a footer and a note: a link Word split over two runs is read whole —");
  for (const [where, name, root, ct, wrap, ref] of [
    ["a header", "word/header1.xml", "hdr", "header", (x) => P(x), ""],
    ["a footer", "word/footer1.xml", "ftr", "footer", (x) => P(x), ""],
    ["a footnote", "word/footnotes.xml", "footnotes", "footnotes", (x) => `<w:footnote w:id="1">${P('<w:r><w:footnoteRef/></w:r>' + x)}</w:footnote>`, '<w:r><w:footnoteReference w:id="1"/></w:r>'],
    ["an endnote", "word/endnotes.xml", "endnotes", "endnotes", (x) => `<w:endnote w:id="1">${P('<w:r><w:endnoteRef/></w:r>' + x)}</w:endnote>`, '<w:r><w:endnoteReference w:id="1"/></w:r>'],
  ]) {
    const r = await run({ body: P(R("המבקשת הגישה את הבקשה.") + ref), parts: [{ name, body: part(root, wrap(R("לפניות: ") + fld([' HYPERLINK "mailto:dana.sagi', '7@example.com" '], "כתבו לה"))), ct: CT + ct + "+xml", rel: ct }] });
    const x = r.o.text(name) || "";
    ok(!left(r.o, "7@example.com").length && !left(r.o, "dana.sagi").length && /^\s*HYPERLINK\s+"#"\s*$/.test(instrOf(x)) && x.includes("כתבו לה"),
      `${where}: the address leaves as «#» and the field keeps its text: ` + JSON.stringify(instrOf(x)));
  }

  console.log("\n— a link written without TargetMode: a mail, a file, a drive and a share target still go —");
  {
    // some programs write a link's relationship without TargetMode="External"; a web address there is tested in tests/links_t.js
    const T = [["a mailto target", "mailto:dana.sagi3@example.com", "dana.sagi3"], ["a file target", "file:///C:/Users/dana.sagi4/Documents/x.docx", "dana.sagi4"],
      ["a drive path", "C:\\Users\\dana.sagi5\\Documents\\x.docx", "dana.sagi5"], ["a network share", "\\\\fileserver\\clients\\dana.sagi6\\x.docx", "dana.sagi6"]];
    const r = await run({ body: P(R("ראו את הקישורים: ") + T.map((_, i) => link("rIdT" + i, "קישור " + (i + 1))).join(R(" "))),
      rels: T.map(([, t], i) => `<Relationship Id="rIdT${i}" Type="${RT}/hyperlink" Target="${t}"/>`) });
    const rels = r.o.text("word/_rels/document.xml.rels");
    T.forEach(([what, , secret], i) => ok(targetOf(rels, "rIdT" + i) === "#" && !left(r.o, secret).length, `${what}: the target is «${targetOf(rels, "rIdT" + i)}»`));
  }

  console.log("\n— a server on the office network named by its IP address: the target leaves as «#» —");
  {
    const url = `http://10.0.0.12/clients/${enc("אורית לוין")}/${enc("תצהיר")}.docx`;
    const r = await run({ body: P(R("ראו את ") + link("rId70", "התצהיר") + R(".")), rels: [`<Relationship Id="rId70" Type="${RT}/hyperlink" Target="${url}" TargetMode="External"/>`] });
    const t = targetOf(r.o.text("word/_rels/document.xml.rels"), "rId70");
    ok(t === "#" && !left(r.o, "אורית לוין").length && !left(r.o, "10.0.0.12").length, "the client's folder on the office server does not leave with the file: " + t);
  }

  console.log("\n— a + between the parts of a listed name in a link's path is read as a space —");
  {
    // a file a system saved under the client's name, surname first, with + for the space; tests/links_t.js holds _, %20 and the dot
    const url = `https://files.example.org/docs/${enc("שגיא")}+${enc("דנה")}.pdf`;
    const r = await run({ body: P(R("דנה שגיא הגישה. ") + link("rId71", "הקובץ")), rels: [`<Relationship Id="rId71" Type="${RT}/hyperlink" Target="${url}" TargetMode="External"/>`] },
      [{ value: "דנה שגיא", kind: "NAME", replacement: "יעל כהן" }]);
    const t = targetOf(r.o.text("word/_rels/document.xml.rels"), "rId71") || "";
    let d = t; try { d = decodeURIComponent(t); } catch (_) { /* as it is */ }
    ok(!/שגיא|דנה/.test(d) && d.startsWith("https://files.example.org/docs/") && r.res.verification.passed, "no part of the name is left in the address, and the rest of it stays: " + d);
  }

  console.log("\n— the file's own properties keep no person, title, path or date —");
  {
    // the Summary tab of Word's Properties, and what Word and a document system write there by themselves; nothing is listed
    const core = DEC + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      "<dc:title>תסקיר בעניין רחל פרידמן</dc:title><dc:subject>מזונות רחל פרידמן</dc:subject><dc:creator>Noa Barak</dc:creator><cp:keywords>פרידמן; מזונות; תיק 4417</cp:keywords>" +
      '<dc:description>טיוטה לעיון של עו"ד נועה ברק</dc:description><cp:lastModifiedBy>Noa Barak</cp:lastModifiedBy><cp:revision>14</cp:revision><cp:lastPrinted>2026-02-11T09:12:00Z</cp:lastPrinted>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">2026-01-04T08:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-02-11T09:10:00Z</dcterms:modified>' +
      "<cp:category>תיק רחל פרידמן</cp:category><cp:contentStatus>טיוטה של נועה ברק</cp:contentStatus><dc:identifier>DMS-4417-26</dc:identifier></cp:coreProperties>";
    const app = DEC + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      "<Template>מכתב ללקוח של נועה ברק.dotm</Template><TotalTime>128</TotalTime><Application>Microsoft Office Word</Application><Manager>נועה ברק</Manager><Company>ברק ושות'</Company>" +
      '<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>כותרת</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>' +
      '<TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>תסקיר בעניין רחל פרידמן</vt:lpstr></vt:vector></TitlesOfParts>' +
      "<HyperlinkBase>C:\\Users\\noa.barak\\Documents\\לקוחות\\פרידמן\\</HyperlinkBase></Properties>";
    const r = await run({ core, app, body: P(R("המבקשת הגישה את הבקשה.")) });
    const read = (n) => { const d = new L.win.DOMParser().parseFromString(r.o.text(n) || "", "application/xml"); return (ln) => Array.from(d.getElementsByTagName("*")).filter((e) => e.localName === ln).map((e) => e.textContent.trim()).join(""); };
    const c = read("docProps/core.xml"), a = read("docProps/app.xml");
    const fullC = ["title", "subject", "creator", "keywords", "description", "lastModifiedBy", "lastPrinted", "category", "contentStatus", "identifier"].filter((k) => c(k));
    const fullA = ["Template", "Manager", "Company", "TitlesOfParts", "HyperlinkBase"].filter((k) => a(k));
    ok(!fullC.length, "docProps/core.xml: every property that names a person, a subject or a case is emptied; still filled: " + fullC.map((k) => k + "=" + c(k)).join(", "));
    ok(!fullA.length, "docProps/app.xml: the manager, the company, the template, the title's copy and the base path for links are emptied; still filled: " + fullA.map((k) => k + "=" + a(k)).join(", "));
    ok(c("created") === "1970-01-01T00:00:00Z" && c("modified") === "1970-01-01T00:00:00Z" && c("revision") === "1", "and the dates and the revision count tell nothing: " + [c("created"), c("modified"), c("revision")].join(" "));
    ok(!left(r.o, "פרידמן").length && !left(r.o, "נועה ברק").length && !left(r.o, "Barak").length && !problems(r.o).length, "so no part of the file names them: " + left(r.o, "פרידמן").concat(left(r.o, "נועה ברק")));
  }

  console.log("\n— the file's custom properties leave with the file —");
  {
    // a document system stores the client and the case in docProps/custom.xml; nothing here is on her list
    const custom = DEC + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="ClientName"><vt:lpwstr>אורית לוין</vt:lpwstr></property>' +
      '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="ClientMail"><vt:lpwstr>orit.levin@example.com</vt:lpwstr></property></Properties>';
    const buf = docx({ body: P(R("המבקשת הגישה את הבקשה.")), parts: [{ name: "docProps/custom.xml", body: custom, ct: "application/vnd.openxmlformats-officedocument.custom-properties+xml" }] });
    // the package's own links part points at it, as Word writes it
    const files = (await E.unzip(buf)).map((f) => ({ name: f.name, body: f.name === "_rels/.rels" ? E.TXT.decode(f.data).replace("</Relationships>", `<Relationship Id="rId4" Type="${RT}/custom-properties" Target="docProps/custom.xml"/></Relationships>`) : f.data }));
    const res = await E.redactDocx(mkzip(files), [], [], OPT), o = await outOf(E, res);
    ok(!o.names.includes("docProps/custom.xml") && !left(o, "אורית לוין").length && !left(o, "orit.levin").length, "the part is not in the file, and nothing of it is: " + o.names.filter((n) => n.startsWith("docProps/")).join(", "));
    ok(res.structural.dropped.includes("docProps/custom.xml") && !problems(o).length && !/custom\.xml/.test(o.text("_rels/.rels") + o.text("[Content_Types].xml")), "it is counted as removed, and nothing points at it: " + problems(o));
  }

  done();
})().catch((e) => { console.log("  ✗ the suite threw: " + (e && e.stack || e)); console.log("\n0 passed, 1 failed"); process.exitCode = 1; });
