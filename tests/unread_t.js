/* Whatever Word shows or keeps is read and replaced, or removed (the hunt of 11.10).

   Parts of a Word file no layer read stayed in the file she downloads: a section a document system
   imported as HTML, MHT, RTF, text or another Word file (w:altChunk), shown by Word as body text, never
   reached the preview, the copied text or the final check, and the bar was green; a date picker kept the
   real date (w:fullDate) behind the shifted one; and a picture's title or alt text in the old VML format, a
   link's ScreenTip, a form field's default and help text, a drop-down's other choices, a signature line's
   suggested signer and a mail merge's data source kept a listed name, so the bar turned red with nothing
   on the screen to fix, or an unlisted one, and it passed green. Whole files are built in memory and run
   through the real pipeline (tests/wordfile-lib.js); every name, number and address here is invented. */
const L = require("./wordfile-lib.js");
const { docx, P, R, part, CT, RT, copyOf, bar, outOf, left, problems } = L;
const E = L.core("unread");
const { ok, done } = L.suite();
const NAME = "רחל פרידמן", SUBS = [{ value: NAME, kind: "NAME", replacement: "יעל כהן" }];
const OPT = L.optsOf(E);
const run = async (o, subs = SUBS, extra) => { const res = await E.redactDocx(docx(o), subs, [], extra ? L.optsOf(E, extra) : OPT); return { res, o: await outOf(E, res), copy: copyOf(E, res) }; };
const ID = "039337423", PHONE = "052-1234567";
const chunkRel = (id, target) => `<Relationship Id="${id}" Type="${RT}/aFChunk" Target="${target}"/>`;
const chunkDoc = (target, body, ct) => ({ body: P(R("פתיח.")) + '<w:altChunk r:id="rId80"/>' + P(R("סוף.")), rels: [chunkRel("rId80", target)], parts: [{ name: "word/" + target, body, ct }] });

(async () => {
  console.log("\n— a section imported from another file (altChunk) —");
  {
    const html = `<html><head><meta charset="utf-8"><title>${NAME}</title><style>p{color:red}</style></head><body dir="rtl"><h1>מכתב</h1><p>לכבוד עו"ד <b>${NAME}</b>, רחוב הזית 12, חיפה.</p><p>המבקשת <b>${NAME}</b> הגישה את הבקשה לבית המשפט.</p><p>ת&quot;ז ${ID} &amp; טלפון ${PHONE}.</p><table><tr><td>שורה</td><td>בטבלה</td></tr></table></body></html>`;
    const r = await run(chunkDoc("afchunk.htm", html, "application/xhtml+xml"), []);
    ok(!r.o.names.includes("word/afchunk.htm"), "the imported HTML part does not leave with the file: " + r.o.names.filter((n) => /afchunk/.test(n)));
    ok(!left(r.o, ID).length && !left(r.o, PHONE).length, "the ID and the phone in it are replaced: " + left(r.o, ID).concat(left(r.o, PHONE)));
    ok(r.res.verification.suggest.some((x) => x.value === NAME), "the unlisted name in it is put in front of her: " + JSON.stringify(r.res.verification.suggest.map((x) => x.value)));
    ok(bar(r.res.verification) !== "green", "so the bar is not green");
    const lines = r.copy.split("\n");
    ok(lines[0] === "פתיח." && lines.includes("מכתב") && lines.some((l) => l.startsWith(`לכבוד עו"ד ${NAME}`)) && lines.includes("שורה") && lines.includes("בטבלה") && lines[lines.length - 1] === "סוף.", "its text is read in its place: " + JSON.stringify(lines));
    ok(!r.copy.includes("color:red") && !r.copy.includes("<") && !r.copy.includes("&quot;"), "as text, without markup: " + JSON.stringify(r.copy));
    ok(!problems(r.o).length, "the file is whole: " + problems(r.o));
    ok(!/afchunk/.test(r.o.text("word/_rels/document.xml.rels")) && !/altChunk/.test(r.o.text("word/document.xml")), "and nothing points at the removed part");
    const listed = await run(chunkDoc("afchunk.htm", html, "application/xhtml+xml"));
    ok(!left(listed.o, "פרידמן").length && listed.res.verification.passed, "a listed name in it is replaced like any other: " + left(listed.o, "פרידמן"));
    // the review of 11.10: markup without html/body/p, and WordprocessingML as XML, were pasted in as text, tags and all
    for (const [what, file, body] of [
      ["an HTML fragment", "afchunk.htm", `<strong>${NAME}</strong> <span>הגישה</span> <ul><li>תצהיר</li></ul>`],
      ["a Flat OPC XML chunk", "afchunk.xml", `<?xml version="1.0"?><pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage"><pkg:part pkg:name="/word/document.xml"><pkg:xmlData><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${NAME}</w:t></w:r><w:r><w:t xml:space="preserve"> הגישה.</w:t></w:r></w:p></w:body></w:document></pkg:xmlData></pkg:part><pkg:part pkg:name="/word/media/image1.png"><pkg:binaryData>iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk</pkg:binaryData></pkg:part></pkg:package>`],
    ]) {
      const c = await run(chunkDoc(file, body, "application/xhtml+xml"));
      ok(!c.copy.includes("<") && !/pkg:|w:t|iVBOR/.test(c.copy) && !left(c.o, "פרידמן").length, `${what}: read as text, without its tags, and the name in it replaced: ${JSON.stringify(c.copy)}`);
    }
  }
  {
    const qp = (s) => Array.from(Buffer.from(s, "utf8")).map((b) => (b >= 33 && b <= 126 && b !== 61) ? String.fromCharCode(b) : "=" + b.toString(16).toUpperCase().padStart(2, "0")).join("").replace(/(.{70})/g, "$1=\r\n");
    const mht = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="----=_NextPart_01"\r\n\r\n------=_NextPart_01\r\nContent-Location: file:///C:/x.htm\r\nContent-Transfer-Encoding: quoted-printable\r\nContent-Type: text/html; charset="utf-8"\r\n\r\n` +
      qp(`<html><body><p>המבקשת ${NAME} מתגוררת ברחוב הזית 12.</p><p>טלפון ${PHONE}</p></body></html>`) + "\r\n\r\n------=_NextPart_01--\r\n";
    const r = await run(chunkDoc("afchunk.mht", mht, "message/rfc822"));
    ok(!r.o.names.includes("word/afchunk.mht") && !left(r.o, "פרידמן").length && !left(r.o, PHONE).length, "an imported MHT section is read and replaced: " + JSON.stringify(r.copy));
    ok(r.copy.includes("המבקשת יעל כהן מתגוררת"), "in its place in the copied text: " + JSON.stringify(r.copy));
    const txt = await run(chunkDoc("afchunk.txt", `המבקשת ${NAME} הגישה.\r\nטלפון ${PHONE}.`, "text/plain"));
    ok(!txt.o.names.includes("word/afchunk.txt") && !left(txt.o, "פרידמן").length && txt.copy.includes("המבקשת יעל כהן הגישה."), "an imported text section: " + JSON.stringify(txt.copy));
    // RTF as Word writes Hebrew: code page 1255 bytes, and \u with a fallback character
    const he = (s) => [...s].map((c) => { const code = c.charCodeAt(0); return code >= 0x5d0 && code <= 0x5ea ? "\\'" + (code - 0x5d0 + 0xe0).toString(16) : c; }).join("");
    const rtf = `{\\rtf1\\ansi\\ansicpg1255\\deff0{\\fonttbl{\\f0\\fnil David;}}{\\colortbl;\\red255\\green0\\blue0;}{\\*\\generator Writer;}\\rtlpar\\f0 ${he("המבקשת " + NAME)} \\u1492?\\u1490?\\u1497?\\u1513?\\u1492? ${he("בקשה.")}\\par ${he("טלפון")} ${PHONE}\\par}`;
    const rr = await run(chunkDoc("afchunk.rtf", rtf, "application/rtf"));
    ok(!rr.o.names.includes("word/afchunk.rtf") && !left(rr.o, "פרידמן").length && !left(rr.o, PHONE).length, "an imported RTF section is read and replaced: " + JSON.stringify(rr.copy));
    ok(rr.copy.includes("המבקשת יעל כהן הגישה בקשה."), "its Hebrew is read from the code page and from \\u: " + JSON.stringify(rr.copy));
    // another Word file imported whole
    const inner = docx({ body: P(R(`המבקשת ${NAME} הגישה.`)) + P(R(`טלפון ${PHONE}`)) });
    const dx = await run({ ...chunkDoc("afchunk.docx", "", null), files: [{ name: "word/afchunk.docx", body: inner }], parts: [] });
    ok(!dx.o.names.includes("word/afchunk.docx") && !dx.o.xml.some((x) => x.t.includes("PK")) && dx.copy.includes("המבקשת יעל כהן הגישה."), "an imported Word file is read and replaced: " + JSON.stringify(dx.copy));
    // a part that cannot be read is removed rather than sent
    const bin = await run({ ...chunkDoc("afchunk.bin", "", null), files: [{ name: "word/afchunk.bin", body: Buffer.from([0, 1, 2, 3, 0xd7, 0xa8, 0xd7, 0x97, 0xd7, 0x9c]) }], parts: [] });
    ok(!bin.o.names.includes("word/afchunk.bin") && !problems(bin.o).length && !/altChunk|afchunk/.test(bin.o.text("word/document.xml") + bin.o.text("word/_rels/document.xml.rels")), "a section that cannot be read is removed, and nothing points at it");
    ok(bin.res.structural.dropped.includes("word/afchunk.bin"), "and it is counted among the removed parts");
    // in a table cell, removing the section still leaves the cell a paragraph
    const cell = await run({ body: `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:altChunk r:id="rId80"/></w:tc></w:tr></w:tbl>` + P(R("סוף.")), rels: [chunkRel("rId80", "afchunk.bin")], files: [{ name: "word/afchunk.bin", body: Buffer.from([0, 1, 2]) }] });
    ok(!problems(cell.o).length && /<w:tc>\s*<w:p[ >\/]/.test(cell.o.text("word/document.xml")), "a cell that held only the section keeps a paragraph");
  }

  console.log("\n— a date picker keeps no real date behind the shifted one —");
  {
    const picker = (full, shown) => `<w:sdt><w:sdtPr><w:date w:fullDate="${full}"><w:dateFormat w:val="d.M.yyyy"/><w:lid w:val="he-IL"/><w:storeMappedDataAs w:val="dateTime"/><w:calendar w:val="gregorian"/></w:date></w:sdtPr><w:sdtContent>${P(R(shown))}</w:sdtContent></w:sdt>`;
    const r = await run({ body: P(R(`${NAME} הגישה.`)) + picker("2026-03-01T00:00:00Z", "1.3.2026") });
    const x = r.o.text("word/document.xml");
    const shown = (r.copy.split("\n").find((l) => /^\d/.test(l)) || "").trim();
    const full = (/w:fullDate="([^"]*)"/.exec(x) || [])[1] || "";
    const p = E.parseDate(shown);
    ok(!x.includes("2026-03-01") && !x.includes("1.3.2026"), "the real date is gone from the date picker: " + full + " / " + shown);
    ok(p && full === `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T00:00:00Z`, "it stores the shifted date it shows, so Word's calendar opens there: " + full + " for " + shown);
    const del = await run({ body: picker("2026-03-01T00:00:00Z", "1.3.2026") }, SUBS, { styles: { "*": "blank", DATE: "blank" } });
    ok(!del.o.text("word/document.xml").includes("2026-03-01") && !del.o.text("word/document.xml").includes("w:fullDate"), "when the date is deleted, the stored one goes too");
    const kept = await E.redactDocx(docx({ body: picker("2026-03-01T00:00:00Z", "1.3.2026") }), SUBS, ["1.3.2026"], OPT);
    ok((await outOf(E, kept)).text("word/document.xml").includes('w:fullDate="2026-03-01T00:00:00Z"'), "a date she keeps keeps its stored date");
  }

  console.log("\n— data a content control is bound to —");
  {
    const bound = `<w:sdt><w:sdtPr><w:dataBinding w:prefixMappings="xmlns:ns0='urn:firm'" w:xpath="/ns0:case[1]/ns0:client[1]" w:storeItemID="{11111111-2222-3333-4444-555555555555}"/><w:text/></w:sdtPr><w:sdtContent>${P(R(NAME))}</w:sdtContent></w:sdt>`;
    const files = [{ name: "customXml/item1.xml", body: `<?xml version="1.0"?><case xmlns="urn:firm"><client>${NAME}</client><phone>${PHONE}</phone></case>` },
      { name: "customXml/itemProps1.xml", body: '<?xml version="1.0"?><ds:datastoreItem ds:itemID="{11111111-2222-3333-4444-555555555555}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"/>' },
      { name: "customXml/_rels/item1.xml.rels", body: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/></Relationships>' }];
    const r = await run({ body: bound, rels: [`<Relationship Id="rId90" Type="${RT}/customXml" Target="../customXml/item1.xml"/>`], files });
    ok(!r.o.names.some((n) => /customXml/i.test(n)) && !left(r.o, "פרידמן").length && !left(r.o, PHONE).length, "the bound data does not leave with the file: " + r.o.names.filter((n) => /customXml/i.test(n)));
    ok(!r.o.text("word/document.xml").includes("dataBinding"), "and the control is no longer bound to it, so Word keeps the replaced text rather than fetching empty data");
    ok(!problems(r.o).length, "the file is whole: " + problems(r.o));
  }

  console.log("\n— a picture's title and alt text, a ScreenTip, form fields, drop-down choices, a signature line —");
  {
    const vml = (alt, title) => P(`<w:r><w:pict><v:shape id="_x0000_i1025" type="#_x0000_t75" alt="${alt}" style="width:100pt;height:80pt"><v:imagedata r:id="rId30" o:title="${title}"/></v:shape></w:pict></w:r>`);
    const pic = { rels: [`<Relationship Id="rId30" Type="${RT}/image" Target="media/image1.png"/>`], files: [{ name: "word/media/image1.png", body: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }] };
    const cases = [
      ["an old-style picture's alt text and title", vml(`${NAME} בדיון`, `${NAME} - תעודת זהות`), pic],
      ["a link's ScreenTip", P(R("ראו ") + `<w:hyperlink w:anchor="x" w:tooltip="הפרופיל של ${NAME}">${R("לפרופיל")}</w:hyperlink>`), {}],
      ["the ScreenTip of a link on a picture", P(`<w:r><w:drawing><wp:inline><wp:extent cx="1" cy="1"/><wp:docPr id="3" name="Picture 3"><a:hlinkClick r:id="rId31" tooltip="הפרופיל של ${NAME}"/></wp:docPr></wp:inline></w:drawing></w:r>`),
        { rels: [`<Relationship Id="rId31" Type="${RT}/hyperlink" Target="https://www.gov.il/he" TargetMode="External"/>`] }],
      ["a form field's default, help and status text", P(`<w:r><w:fldChar w:fldCharType="begin"><w:ffData><w:name w:val="Text1"/><w:enabled/><w:calcOnExit w:val="0"/><w:helpText w:type="text" w:val="שם המבקשת: ${NAME}"/><w:statusText w:type="text" w:val="${NAME}"/><w:textInput><w:default w:val="${NAME}"/></w:textInput></w:ffData></w:fldChar></w:r><w:r><w:instrText xml:space="preserve"> FORMTEXT </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>` + R("נועה גל") + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'), {}],
      ["an old drop-down form field's choices", P(`<w:r><w:fldChar w:fldCharType="begin"><w:ffData><w:name w:val="Dropdown1"/><w:enabled/><w:ddList><w:listEntry w:val="נועה גל"/><w:listEntry w:val="${NAME}"/></w:ddList></w:ffData></w:fldChar></w:r><w:r><w:instrText xml:space="preserve"> FORMDROPDOWN </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`), {}],
      ["a drop-down control's other choices", `<w:sdt><w:sdtPr><w:dropDownList><w:listItem w:displayText="${NAME}" w:value="${NAME}"/><w:listItem w:displayText="נועה גל" w:value="נועה גל"/></w:dropDownList></w:sdtPr><w:sdtContent>${P(R("נועה גל"))}</w:sdtContent></w:sdt>`, {}],
      // the review of 11.10: the value last picked in a drop-down or combo box
      ["a drop-down control's last picked value", `<w:sdt><w:sdtPr><w:dropDownList w:lastValue="${NAME}"><w:listItem w:displayText="נועה גל" w:value="נועה גל"/></w:dropDownList></w:sdtPr><w:sdtContent>${P(R("נועה גל"))}</w:sdtContent></w:sdt>`, {}],
      ["a combo box's last picked value", `<w:sdt><w:sdtPr><w:comboBox w:lastValue="${NAME}"><w:listItem w:displayText="נועה גל" w:value="נועה גל"/></w:comboBox></w:sdtPr><w:sdtContent>${P(R("נועה גל"))}</w:sdtContent></w:sdt>`, {}],
      ["a signature line's suggested signer", P(`<w:r><w:pict><v:shape id="sig" type="#_x0000_t75" style="width:192pt;height:96pt"><v:imagedata r:id="rId30" o:title=""/><o:signatureline v:ext="edit" id="{00000000-0000-0000-0000-000000000001}" provid="{00000000-0000-0000-0000-000000000000}" o:suggestedsigner="${NAME}" o:suggestedsigner2="המבקשת" o:suggestedsigneremail="rachel.f@example.com" issignatureline="t"/></v:shape></w:pict></w:r>`), pic],
    ];
    for (const [what, body, more] of cases) {
      const r = await run({ body: P(R(`${NAME} הגישה.`)) + body, ...more });
      ok(!left(r.o, "פרידמן").length, `${what}: a listed name is replaced: ` + left(r.o, "פרידמן"));
      ok(r.res.verification.passed, `${what}: the bar is not red with nothing to fix: ` + JSON.stringify(r.res.verification.leaks));
      ok(!problems(r.o).length, `${what}: the file is whole: ` + problems(r.o));
      ok(!r.copy.includes("הפרופיל של") && !r.copy.includes("תעודת זהות") && !r.copy.includes("שם המבקשת:"),`${what}: and it is not copied as if it were body text: ` + JSON.stringify(r.copy));
    }
    // with nothing on her list, a name in a picture's text is put in front of her, as in its alt text
    const sigCase = cases.find((c) => /signature line/.test(c[0]));
    for (const [what, body, more] of [cases[0], sigCase]) {
      const r = await run({ body: P(R("הבקשה הוגשה היום.")) + body, ...more }, []);
      ok(r.res.verification.suggest.some((x) => x.value === NAME), `${what}: an unlisted name is put in front of her: ` + JSON.stringify(r.res.verification.suggest.map((x) => x.value)));
    }
    const sig = await run({ body: sigCase[1], ...sigCase[2] });
    ok(!left(sig.o, "rachel.f@example.com").length, "the suggested signer's e-mail is replaced: " + left(sig.o, "rachel.f"));
  }
  {
    // a mail merge keeps the path to her data file and the query that picked the client
    const settings = part("settings", `<w:mailMerge><w:mainDocumentType w:val="formLetters"/><w:linkToQuery/><w:dataType w:val="native"/><w:connectString w:val="Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\Users\\adv\\Documents\\תיק ${NAME}.xlsx"/><w:query w:val="SELECT * FROM \`לקוחות\` WHERE שם = '${NAME}'"/><w:dataSource r:id="rId1"/></w:mailMerge>`, L.WNS + ' xmlns:r="' + RT + '"');
    const r = await run({ settings, body: P(R("לכבוד הלקוחה.")) });
    ok(!left(r.o, "פרידמן").length && !r.o.text("word/settings.xml").includes("mailMerge"), "a mail merge's data source and query are removed: " + left(r.o, "פרידמן"));
    ok(r.res.verification.passed && !problems(r.o).length, "the bar is not red, and the file is whole: " + problems(r.o));
  }
  {
    // a building block named after the client
    const gl = part("glossaryDocument", `<w:docParts><w:docPart><w:docPartPr><w:name w:val="חתימה ${NAME}"/><w:description w:val="כתובת של ${NAME}"/><w:category><w:name w:val="General"/><w:gallery w:val="autoTxt"/></w:category></w:docPartPr><w:docPartBody>${P(R("בברכה"))}</w:docPartBody></w:docPart></w:docParts>`);
    const r = await run({ body: P(R(`${NAME} הגישה.`)), parts: [{ name: "word/glossary/document.xml", body: gl, ct: CT + "document.glossary+xml", rel: "glossaryDocument" }] });
    ok(!left(r.o, "פרידמן").length && r.res.verification.passed, "a building block's name and description: " + left(r.o, "פרידמן"));
    // the building blocks have their own settings, with their own document variables
    const gs = part("settings", `<w:docVars><w:docVar w:name="client" w:val="${NAME}"/></w:docVars>`);
    const g2 = await run({ body: P(R("הבקשה הוגשה היום.")), parts: [{ name: "word/glossary/document.xml", body: part("glossaryDocument", "<w:docParts/>"), ct: CT + "document.glossary+xml", rel: "glossaryDocument" },
      { name: "word/glossary/settings.xml", body: gs, ct: CT + "settings+xml" }] }, []);
    ok(!left(g2.o, "פרידמן").length, "a document variable in the building blocks' settings is removed with nothing on her list: " + left(g2.o, "פרידמן"));
  }
  done();
})().catch((e) => { console.log("  ✗ the suite threw: " + (e && e.stack || e)); console.log("\n0 passed, 1 failed"); process.exitCode = 1; });
