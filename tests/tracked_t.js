/* Accepting tracked changes is Word's «Accept All», with no editor left in the file (the hunt of 11.10).

   The FAQ promises the tool removes tracked changes and hidden details like the author's name. Only the
   six revision elements were known: the start and end marks of a moved paragraph and an inserted cell kept
   w:author (a Latin name passed green; a Hebrew one on her list turned the bar red with nothing on the
   screen to fix), and a clause deleted or moved away with Track Changes on left its paragraph behind as an
   empty automatic number, so every later clause number in her file was one higher than in the accepted
   document. Whole files are built in memory and run through the real pipeline (tests/wordfile-lib.js);
   every name here is invented. */
const L = require("./wordfile-lib.js");
const { docx, P, R, part, CT, copyOf, bar, outOf, left, problems } = L;
const E = L.core("tracked");
const { ok, done } = L.suite();
const NAME = "רחל פרידמן", SUBS = [{ value: NAME, kind: "NAME", replacement: "יעל כהן" }];
const OPT = L.optsOf(E);
const run = async (o, subs = SUBS) => { const res = await E.redactDocx(docx(o), subs, [], OPT); return { res, o: await outOf(E, res), copy: copyOf(E, res) }; };
const AT = (a) => `w:author="${a}" w:date="2026-03-01T10:00:00Z"`;
const NUM = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
const numbering = { name: "word/numbering.xml", ct: CT + "numbering+xml", rel: "numbering",
  body: part("numbering", '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>') };
// a paragraph whose mark is itself a tracked change (Word writes it in the paragraph mark's run properties)
const markP = (inner, kind, a, num = true) => `<w:p><w:pPr>${num ? NUM : ""}<w:rPr><w:${kind} w:id="${Math.floor(Math.random() * 1e6)}" ${AT(a)}/></w:rPr></w:pPr>${inner}</w:p>`;
const numP = (inner) => `<w:p><w:pPr>${NUM}</w:pPr>${inner}</w:p>`;
const paras = (x) => [...x.matchAll(/<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
const texts = (p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
const authors = (o) => o.xml.filter(({ t }) => /\s[\w]+:(?:author|initials|ed)="[^"]+"/.test(t)).map(({ name }) => name);

(async () => {
  console.log("\n— the editor's name leaves with the changes —");
  {
    const mv = (a) => `<w:moveFromRangeStart w:id="1" ${AT(a)} w:name="move1"/>` + markP(`<w:moveFrom w:id="2" ${AT(a)}>${R("סעיף שהועבר.")}</w:moveFrom>`, "moveFrom", a) + `<w:moveFromRangeEnd w:id="1"/>` +
      numP(R("סעיף אחר.")) +
      `<w:moveToRangeStart w:id="3" ${AT(a)} w:name="move1"/>` + markP(`<w:moveTo w:id="4" ${AT(a)}>${R("סעיף שהועבר.")}</w:moveTo>`, "moveTo", a) + `<w:moveToRangeEnd w:id="3"/>`;
    let r = await run({ body: P(R(`${NAME} הגישה.`)) + mv("Rachel Friedman"), parts: [numbering] });
    ok(!left(r.o, "Rachel").length && !left(r.o, "Friedman").length, "a moved clause: the editor's Latin name is gone: " + left(r.o, "Friedman"));
    ok(!authors(r.o).length, "no author is left in any part: " + authors(r.o));
    const body = r.o.text("word/document.xml");
    const nums = paras(body).filter((p) => p.includes("<w:numPr>"));
    ok(nums.length === 2 && nums.every((p) => texts(p)), "the paragraph it moved from is gone, not an empty number: " + nums.map(texts).join(" | "));
    ok(r.copy === "יעל כהן הגישה.\n1. סעיף אחר.\n2. סעיף שהועבר.", "the copied text numbers the accepted document: " + JSON.stringify(r.copy));
    r = await run({ body: P(R(`${NAME} הגישה.`)) + mv(NAME), parts: [numbering] });
    ok(r.res.verification.passed, "a Hebrew editor's name on her list: the bar is not red with nothing to fix: " + JSON.stringify(r.res.verification.leaks));
    ok(!left(r.o, "פרידמן").length, "and the name is nowhere in the file: " + left(r.o, "פרידמן"));
  }
  {
    const cell = (mark) => `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:tcPr>${mark}</w:tcPr>${P(R("תא"))}</w:tc></w:tr></w:tbl>` + P(R(""));
    for (const [what, mark] of [["an inserted cell", `<w:cellIns w:id="7" ${AT("Rachel Friedman")}/>`], ["a deleted cell", `<w:cellDel w:id="8" ${AT("Rachel Friedman")}/>`],
      ["merged cells", `<w:cellMerge w:id="9" ${AT("Rachel Friedman")} w:vMerge="rest"/>`]]) {
      const r = await run({ body: P(R(`${NAME} הגישה.`)) + cell(mark) });
      ok(!left(r.o, "Friedman").length && !problems(r.o).length, `${what}: no editor's name, and the file is whole: ` + left(r.o, "Friedman") + problems(r.o));
    }
    const cx = await run({ body: `<w:customXmlInsRangeStart w:id="5" ${AT("Rachel Friedman")}/>` + P(R("טקסט.")) + '<w:customXmlInsRangeEnd w:id="5"/>' +
      `<w:customXmlDelRangeStart w:id="6" ${AT("Rachel Friedman")}/>` + P(R("עוד.")) + '<w:customXmlDelRangeEnd w:id="6"/>' +
      `<w:customXmlMoveFromRangeStart w:id="7" ${AT("Rachel Friedman")}/>` + P(R("ועוד.")) + '<w:customXmlMoveFromRangeEnd w:id="7"/>' });
    ok(!left(cx.o, "Friedman").length && !problems(cx.o).length, "the custom XML revision marks: " + left(cx.o, "Friedman"));
    const tg = await run({ body: `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/><w:tblGridChange w:id="11"><w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid></w:tblGridChange></w:tblGrid><w:tr><w:tc>${P(R("תא"))}</w:tc></w:tr></w:tbl>` + P(R("")) });
    ok(!tg.o.text("word/document.xml").includes("tblGridChange"), "a tracked change to the table grid is accepted too");
  }
  {
    // a change to a style and to a list level, recorded in the styles and numbering parts
    const styles = part("styles", `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:b/><w:rPrChange w:id="21" ${AT("Rachel Friedman")}><w:rPr/></w:rPrChange></w:rPr></w:style>`);
    const num = { ...numbering, body: part("numbering", `<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720"/><w:pPrChange w:id="22" ${AT("Rachel Friedman")}><w:pPr/></w:pPrChange></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`) };
    const r = await run({ styles, body: numP(R("סעיף.")), parts: [num] });
    ok(!left(r.o, "Friedman").length, "a tracked change inside the styles or the list definitions: " + left(r.o, "Friedman"));
    // an editing permission for one person (Restrict Editing → exceptions)
    const pm = await run({ body: P('<w:permStart w:id="1" w:ed="rachel.friedman@example.com"/>' + R("פסקה שהיא רשאית לערוך.") + '<w:permEnd w:id="1"/>') });
    ok(!left(pm.o, "rachel.friedman").length && !problems(pm.o).length, "an editing permission in her name: " + left(pm.o, "rachel.friedman"));
    // a header and a footnote are accepted like the body
    const hdr = part("hdr", P(`<w:ins w:id="31" ${AT("Rachel Friedman")}>${R("כותרת")}</w:ins>`));
    const fn = part("footnotes", `<w:footnote w:id="1">${P('<w:r><w:footnoteRef/></w:r>' + `<w:del w:id="32" ${AT("Rachel Friedman")}><w:r><w:delText>נמחק</w:delText></w:r></w:del>` + R(" הערה."))}</w:footnote>`);
    const hf = await run({ body: P(R("טענה.") + '<w:r><w:footnoteReference w:id="1"/></w:r>'), parts: [{ name: "word/header1.xml", body: hdr, ct: CT + "header+xml", rel: "header" }, { name: "word/footnotes.xml", body: fn, ct: CT + "footnotes+xml", rel: "footnotes" }] });
    ok(!left(hf.o, "Friedman").length && !left(hf.o, "נמחק").length, "a header and a footnote are accepted like the body: " + left(hf.o, "Friedman"));
    // the file's own record of who edited it
    const people = part("people", `<w15:person w15:author="Rachel Friedman"><w15:presenceInfo w15:providerId="None" w15:userId="Rachel Friedman"/></w15:person>`, L.WNS + ' xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"');
    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Rachel Friedman</dc:creator><cp:lastModifiedBy>Rachel Friedman</cp:lastModifiedBy></cp:coreProperties>';
    const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Manager>Rachel Friedman</Manager><Company>Rachel Friedman</Company></Properties>';
    const pr = await run({ core, app, body: P(R("טקסט.")), parts: [{ name: "word/people.xml", body: people, ct: CT + "people+xml", rel: "people" }] });
    ok(!left(pr.o, "Friedman").length && !problems(pr.o).length, "people.xml, the creator, the last editor, the manager and the company: " + left(pr.o, "Friedman"));
  }

  console.log("\n— a clause deleted with Track Changes on leaves no empty number —");
  {
    const r = await run({ body: numP(R("המבקשת מתגוררת בעיר.")) + markP(`<w:del w:id="90" ${AT("adv")}><w:r><w:delText>סעיף שנמחק במעקב שינויים.</w:delText></w:r></w:del>`, "del", "adv") + numP(R(`${NAME} עובדת כמורה.`)), parts: [numbering] });
    const nums = paras(r.o.text("word/document.xml")).filter((p) => p.includes("<w:numPr>"));
    ok(nums.length === 2 && nums.every((p) => texts(p)), "Word's «Accept All» leaves two numbered clauses: " + nums.map(texts).join(" | "));
    ok(r.copy === "1. המבקשת מתגוררת בעיר.\n2. יעל כהן עובדת כמורה.", "and the copied text numbers them 1 and 2: " + JSON.stringify(r.copy));
    // two clauses deleted one after the other
    const two = await run({ body: numP(R("ראשון.")) + markP(`<w:del w:id="91" ${AT("adv")}><w:r><w:delText>שני.</w:delText></w:r></w:del>`, "del", "adv") + markP(`<w:del w:id="92" ${AT("adv")}><w:r><w:delText>שלישי.</w:delText></w:r></w:del>`, "del", "adv") + numP(R("רביעי.")), parts: [numbering] });
    ok(two.copy === "1. ראשון.\n2. רביעי.", "two clauses deleted in a row: " + JSON.stringify(two.copy));
    // a deletion from the end of one paragraph into the next joins them, as Word does
    const join = await run({ body: markP(R("המבקשת ") + `<w:del w:id="93" ${AT("adv")}><w:r><w:delText>גרה בעיר.</w:delText></w:r></w:del>`, "del", "adv", false) + P(`<w:del w:id="94" ${AT("adv")}><w:r><w:delText>היא </w:delText></w:r></w:del>` + R("עובדת כמורה.")) });
    ok(join.copy === "המבקשת עובדת כמורה.", "a deletion across two paragraphs joins them: " + JSON.stringify(join.copy));
    ok(paras(join.o.text("word/document.xml")).length === 1, "into one paragraph");
    // an inserted paragraph mark is accepted: the paragraph stays
    const insd = await run({ body: numP(R("ראשון.")) + markP(`<w:ins w:id="95" ${AT("adv")}>${R("סעיף חדש.")}</w:ins>`, "ins", "adv") + numP(R("אחרון.")), parts: [numbering] });
    ok(insd.copy === "1. ראשון.\n2. סעיף חדש.\n3. אחרון.", "an inserted clause stays, numbered: " + JSON.stringify(insd.copy));
    // counterexamples: an emptied paragraph whose mark was kept stays, and so does the last paragraph of a cell
    const kept = await run({ body: P(R("לפני.")) + P(`<w:del w:id="96" ${AT("adv")}><w:r><w:delText>כל הטקסט נמחק</w:delText></w:r></w:del>`) + P(R("אחרי.")) });
    ok(paras(kept.o.text("word/document.xml")).length === 3, "a paragraph emptied but not deleted stays, as in Word");
    const lastInCell = await run({ body: `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc>${markP(`<w:del w:id="97" ${AT("adv")}><w:r><w:delText>תא</w:delText></w:r></w:del>`, "del", "adv", false)}</w:tc></w:tr></w:tbl>` + P(R("אחרי הטבלה.")) });
    ok(!problems(lastInCell.o).length && /<w:tc>[\s\S]*<w:p[ >\/][\s\S]*<\/w:tc>/.test(lastInCell.o.text("word/document.xml")), "the last paragraph of a cell is kept, so the cell stays whole");
    // a section break is kept
    const sect = await run({ body: `<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr><w:rPr><w:del w:id="98" ${AT("adv")}/></w:rPr></w:pPr></w:p>` + P(R("פרק שני.")) });
    ok(sect.o.text("word/document.xml").split("<w:sectPr>").length === 3, "a paragraph that ends a section is kept");
  }
  {
    const row = (inner, del) => `<w:tr>${del ? `<w:trPr><w:del w:id="${Math.floor(Math.random() * 1e6)}" ${AT("adv")}/></w:trPr>` : ""}<w:tc>${P(inner)}</w:tc></w:tr>`;
    const tbl = (rows) => `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid>${rows}</w:tbl>`;
    const r = await run({ body: P(R("שורה מעל.")) + tbl(row(R("שורה ראשונה")) + row(`<w:del w:id="93" ${AT("adv")}><w:r><w:delText>שורה שנמחקה</w:delText></w:r></w:del>`, true) + row(R("שורה שלישית"))) + P(R(NAME)) });
    ok((r.o.text("word/document.xml").match(/<w:tr[ >]/g) || []).length === 2, "a row deleted with Track Changes on is gone: " + (r.o.text("word/document.xml").match(/<w:tr[ >]/g) || []).length + " rows");
    const all = await run({ body: P(R("לפני.")) + tbl(row(`<w:del w:id="94" ${AT("adv")}><w:r><w:delText>שורה יחידה</w:delText></w:r></w:del>`, true)) + P(R("אחרי.")) });
    ok(!all.o.text("word/document.xml").includes("<w:tbl>") && !problems(all.o).length, "a table whose every row was deleted is gone, and the file is whole");
    ok(all.copy === "לפני.\nאחרי.", "the copied text: " + JSON.stringify(all.copy));
  }
  done();
})().catch((e) => { console.log("  ✗ the suite threw: " + (e && e.stack || e)); console.log("\n0 passed, 1 failed"); process.exitCode = 1; });
