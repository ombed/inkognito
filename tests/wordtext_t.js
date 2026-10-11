/* What a reader sees in a Word file is what every layer reads, and what is copied to the AI (the hunt of 11.10).

   1. Word keeps a tab, a positional tab, a line break, a soft hyphen and a non-breaking hyphen as
      elements, not characters. The positional tab had no character at all: a three-part header
      («רחל פרידמן ⇥ בקשה למזונות ⇥ עמוד 1») read as one glued word, only the first name was replaced,
      the real surname went to the AI next to an invented first name, and the bar was green. A missing
      space after a surname that ends in a final letter («פרידמןהגישה») did the same.
   2. The copied text dropped what Word writes itself: automatic clause numbers («סעיף 2» pointed at
      nothing) and footnote marks (the notes came at the end with no anchor), and it held every text box
      twice (the shape and its fallback). Word's never-shown placeholder text was copied too.
   3. Text pasted from Word or copied from a PDF can hold characters XML 1.0 cannot store (U+000B is
      Word's manual line break): the page failed with «XML פגום», and trying again could not help.

   Whole files are built in memory and run through the real pipeline (tests/wordfile-lib.js). */
const L = require("./wordfile-lib.js");
const { docx, P, R, part, CT, copyOf, bar, outOf, left, problems } = L;
const E = L.core("wordtext");
const { ok, done } = L.suite();
const NAME = "רחל פרידמן", SUBS = [{ value: NAME, kind: "NAME", replacement: "יעל כהן" }];
const OPT = L.optsOf(E);
const run = async (o, subs = SUBS, extra) => { const res = await E.redactDocx(docx(o), subs, [], extra ? L.optsOf(E, extra) : OPT); return { res, o: await outOf(E, res), copy: copyOf(E, res) }; };
const ptab = (al) => `<w:r><w:ptab w:relativeTo="margin" w:alignment="${al}" w:leader="none"/></w:r>`;

(async () => {
  console.log("\n— Word's own separators are the characters a reader sees —");
  {
    // Insert → Header → «Blank (Three Columns)»
    const hdr = part("hdr", P(R(NAME) + ptab("center") + R("בקשה למזונות") + ptab("right") + R("עמוד 1")));
    const o = { body: P(R(`המבקשת ${NAME} הגישה בקשה.`)), parts: [{ name: "word/header1.xml", body: hdr, ct: CT + "header+xml", rel: "header" }] };
    const blocks = await E.readBlocks(docx(o));
    ok(blocks.some((b) => b.text === "רחל פרידמן בקשה למזונות עמוד 1"), "a three-part header is three fields to every reader: " + JSON.stringify(blocks.map((b) => b.text)));
    const r = await run(o);
    ok(!left(r.o, "פרידמן").length, "the surname in the header is replaced too, still in: " + left(r.o, "פרידמן"));
    ok(r.copy.split("\n").includes("יעל כהן בקשה למזונות עמוד 1"), "the copied text reads the header as written: " + JSON.stringify(r.copy));
    ok(r.res.verification.passed, "and the final check passes: " + JSON.stringify(r.res.verification.leaks));
    // the name between two positional tabs, in a footer
    const ftr = part("ftr", P(R("עמוד 2") + ptab("center") + R(`עו"ד ${NAME}`) + ptab("right") + R("תיק 1234-05-26")));
    const f = await run({ body: P(R(`המבקשת ${NAME} הגישה בקשה.`)), parts: [{ name: "word/footer1.xml", body: ftr, ct: CT + "footer+xml", rel: "footer" }] });
    ok(!left(f.o, "פרידמן").length && !left(f.o, "רחל").length, "a name between two positional tabs in a footer is replaced: " + left(f.o, "פרידמן"));
    ok(f.res.verification.passed, "and the bar is not red with nothing to fix: " + JSON.stringify(f.res.verification.leaks));
  }
  {
    const cases = [
      ["a tab between the first name and the surname", `<w:r><w:t>המורה רחל</w:t><w:tab/><w:t>פרידמן אמרה.</w:t></w:r>`],
      ["a positional tab between them", `<w:r><w:t>המורה רחל</w:t><w:ptab w:relativeTo="margin" w:alignment="center" w:leader="none"/><w:t>פרידמן אמרה.</w:t></w:r>`],
      ["a line break between them", `<w:r><w:t>המורה רחל</w:t><w:br/><w:t>פרידמן אמרה.</w:t></w:r>`],
      ["a carriage return between them", `<w:r><w:t>המורה רחל</w:t><w:cr/><w:t>פרידמן אמרה.</w:t></w:r>`],
      ["a soft hyphen inside the surname", `<w:r><w:t>המורה רחל פרי</w:t><w:softHyphen/><w:t>דמן אמרה.</w:t></w:r>`],
      ["runs with other formatting around a positional tab", R("המורה ") + R("רחל", "<w:rPr><w:b/></w:rPr>") + ptab("center") + R("פרידמן") + R(" אמרה.")],
    ];
    for (const [what, body] of cases) {
      const r = await run({ body: P(body) });
      ok(!left(r.o, "רחל").length && !left(r.o, "פרידמן").length && !left(r.o, "דמן").length, `${what}: one name, replaced: ` + left(r.o, "פרידמן").concat(left(r.o, "רחל")));
      ok(r.copy === "המורה יעל כהן אמרה.", `${what}: the copied text: ` + JSON.stringify(r.copy));
    }
    const h = await run({ body: P("<w:r><w:t>המורה אורי בן</w:t><w:noBreakHyphen/><w:t>שחר אמר.</w:t></w:r>") }, [{ value: "אורי בן-שחר", kind: "NAME", replacement: "יובל שמיר" }]);
    ok(!left(h.o, "שחר").length && h.copy === "המורה יובל שמיר אמר.", "a non-breaking hyphen inside a double surname: " + JSON.stringify(h.copy));
    // counterexample: a soft hyphen is a place a word may break, not a space
    const soft = await E.readBlocks(docx({ body: P("<w:r><w:t>המסמך נחתם בירושל</w:t><w:softHyphen/><w:t>ים.</w:t></w:r>") }));
    ok(soft.some((b) => b.text === "המסמך נחתם בירושלים."), "a soft hyphen does not split a word: " + JSON.stringify(soft.map((b) => b.text)));
  }
  {
    // the final check reads the same characters
    const leak = (body) => E.verify(docx({ body }), [NAME]);
    let v = await leak(P(`<w:r><w:t>רחל</w:t><w:ptab w:relativeTo="margin" w:alignment="center" w:leader="none"/><w:t>פרידמן</w:t></w:r>`));
    ok(!v.passed, "the final check sees a name across a positional tab");
    v = await E.verify(docx({ body: P(`<w:r><w:t>אורי בן</w:t><w:noBreakHyphen w:val="x"/><w:t>שחר</w:t></w:r>`) }), ["אורי בן-שחר"]);
    ok(!v.passed, "and across a non-breaking hyphen however it is written");
    v = await E.verify(docx({ body: P(`<w:r><w:t>פרי</w:t><w:softHyphen/><w:t>דמן</w:t></w:r>`) }), ["פרידמן"]);
    ok(!v.passed, "and through a soft hyphen");
  }

  console.log("\n— a surname glued to the next word —");
  {
    let r = await run({ body: P(R("המבקשת רחל פרידמןהגישה בקשה.")) });
    ok(!left(r.o, "פרידמן").length, "a missing space after a surname that ends in a final letter: the surname is replaced: " + JSON.stringify(r.copy));
    ok(r.copy === "המבקשת יעל כהןהגישה בקשה.", "the whole name, not an invented first name beside the real surname: " + JSON.stringify(r.copy));
    r = await run({ body: P(R("המבקשת רחל פרידמןשהיא אמה של הקטין.")) + P(R(`${NAME} הגישה בקשה.`)) });
    ok(!left(r.o, "פרידמן").length, "and next to a clean occurrence: " + JSON.stringify(r.copy));
    r = await run({ body: P(R("שוחחתי עםרחל פרידמן אתמול.")) });
    ok(!left(r.o, "רחל").length && !left(r.o, "פרידמן").length, "a missing space before the name, after a final letter: " + JSON.stringify(r.copy));
    // counterexamples: a letter that is not final still joins the word
    r = await run({ body: P(R("בבית הכנסת ישבו הלויים.")) + P(R("שירה לוי הגישה.")) }, [{ value: "שירה לוי", kind: "NAME", replacement: "נועה גל" }]);
    ok(r.copy.includes("הלויים"), "«הלויים» is not the surname «לוי»: " + JSON.stringify(r.copy));
    r = await run({ body: P(R("אהרון הגיע לדיון.")) + P(R("רון שמעוני הגיע.")) }, [{ value: "רון שמעוני", kind: "NAME", replacement: "עידו גל" }]);
    ok(r.copy.startsWith("אהרון הגיע לדיון."), "«אהרון» is not the first name «רון»: " + JSON.stringify(r.copy));
    r = await run({ body: P(R("השכנים גרים ליד גן הבנים.")) }, [{ value: "גני טל", kind: "PLACE", replacement: "כפר ורדים" }]);
    ok(r.copy.includes("גן הבנים"), "a word that only starts like a listed place is not it: " + JSON.stringify(r.copy));
  }

  console.log("\n— the copied text has the clause numbers and footnote marks Word shows —");
  const NUMP = (id = 1, lvl = 0, more = "") => `<w:pPr>${more}<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${id}"/></w:numPr><w:bidi/></w:pPr>`;
  const LVL = (i, fmt, text, start = 1, extra = "") => `<w:lvl w:ilvl="${i}"><w:start w:val="${start}"/><w:numFmt w:val="${fmt}"/>${extra}<w:lvlText w:val="${text}"/></w:lvl>`;
  const numbering = (abs, nums) => ({ name: "word/numbering.xml", ct: CT + "numbering+xml", rel: "numbering", body: part("numbering", abs + nums) });
  const ABS = (id, lvls) => `<w:abstractNum w:abstractNumId="${id}">${lvls}</w:abstractNum>`;
  const NUM = (id, abs, over = "") => `<w:num w:numId="${id}"><w:abstractNumId w:val="${abs}"/>${over}</w:num>`;
  const fnr = (id, more = "") => `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference${more} w:id="${id}"/></w:r>`;
  const note = (id, t, tag = "footnote", ref = "footnoteRef") => `<w:${tag} w:id="${id}">${P(`<w:r><w:${ref}/></w:r>` + R(t))}</w:${tag}>`;
  const SEPS = `<w:footnote w:type="separator" w:id="-1">${P("<w:r><w:separator/></w:r>")}</w:footnote><w:footnote w:type="continuationSeparator" w:id="0">${P("<w:r><w:continuationSeparator/></w:r>")}</w:footnote>`;
  const footnotes = (body) => ({ name: "word/footnotes.xml", ct: CT + "footnotes+xml", rel: "footnotes", body: part("footnotes", SEPS + body) });
  {
    const o = {
      body: P(R("תצהיר")) + P(R(`אני, ${NAME}, המבקשת בתיק זה.`), NUMP()) + P(R("הנתבע לא שילם מזונות מאז ינואר.") + fnr(1), NUMP()) + P(R("כאמור בסעיף 2 לעיל, החוב גדל.") + fnr(2), NUMP()),
      parts: [numbering(ABS(0, LVL(0, "decimal", "%1.")), NUM(1, 0)), footnotes(note(1, " ראו נספח א.") + note(2, " ראו נספח ב."))],
    };
    const r = await run(o);
    const want = ["תצהיר", "1. אני, יעל כהן, המבקשת בתיק זה.", "2. הנתבע לא שילם מזונות מאז ינואר.[1]", "3. כאמור בסעיף 2 לעיל, החוב גדל.[2]", "[1] ראו נספח א.", "[2] ראו נספח ב."];
    ok(r.copy === want.join("\n"), "a numbered affidavit with two footnotes reads as Word shows it: " + JSON.stringify(r.copy));
    const d = r.o.text("word/document.xml");
    ok(!d.includes("[1]") && !/<w:t[^>]*>\d\. /.test(d) && (d.match(/<w:numPr>/g) || []).length === 3, "the file itself is not changed by it: Word still numbers the clauses");
    ok(problems(r.o).length === 0, "and the file is whole: " + problems(r.o));
    // every mark on the review sheet still sits on its replacement
    const bad = [];
    for (const b of r.res.preview) for (const m of b.marks) if (!m.del && !m.flag && b.text.slice(m.s, m.e) !== r.res.applied[m.id].rep) bad.push(b.text.slice(m.s, m.e));
    ok(!bad.length && r.res.preview.some((b) => b.marks.length), "the marks on the review sheet still sit on the replacements: " + JSON.stringify(bad));
  }
  {
    // the ID is deleted: the small mark where it was moves with the clause number
    const r = await run({ body: P(R(`ת"ז 039337423 של המבקשת.`), NUMP()), parts: [numbering(ABS(0, LVL(0, "decimal", "%1.")), NUM(1, 0))] });
    const b = r.res.preview.find((x) => x.marks.some((m) => m.del));
    const m = b && b.marks.find((x) => x.del);
    ok(b && b.text.startsWith("1. ") && b.text.slice(0, m.s) === '1. ת"ז ', "the mark of a deleted number stays where the number was: " + JSON.stringify(b && b.text) + " at " + (m && m.s));
  }
  {
    // footnotes are numbered in the order they are referenced, not by their id
    const r = await run({ body: P(R("טענה ראשונה.") + fnr(7)) + P(R("טענה שנייה.") + fnr(3)), parts: [footnotes(note(3, " הערה ב.") + note(7, " הערה א."))] });
    ok(r.copy === "טענה ראשונה.[1]\nטענה שנייה.[2]\n[2] הערה ב.\n[1] הערה א.", "footnote numbers follow the order of reference: " + JSON.stringify(r.copy));
    // a footnote with its own mark keeps the mark and takes no number
    const c = await run({ body: P(R("טענה.") + `<w:r><w:footnoteReference w:customMarkFollows="1" w:id="4"/><w:t>*</w:t></w:r>`) + P(R("ועוד.") + fnr(5)), parts: [footnotes(`<w:footnote w:id="4">${P(R("* הערה בסימן משלה."))}</w:footnote>` + note(5, " הערה רגילה."))] });
    ok(c.copy === "טענה.*\nועוד.[1]\n* הערה בסימן משלה.\n[1] הערה רגילה.", "a custom footnote mark: " + JSON.stringify(c.copy));
    // endnotes are i, ii, iii unless the document says otherwise
    const en = await run({ body: P(R("טענה.") + `<w:r><w:endnoteReference w:id="1"/></w:r>`), parts: [{ name: "word/endnotes.xml", ct: CT + "endnotes+xml", rel: "endnotes", body: part("endnotes", note(1, " מקור.", "endnote", "endnoteRef")) }] });
    ok(en.copy === "טענה.[i]\n[i] מקור.", "an endnote: " + JSON.stringify(en.copy));
  }
  {
    // two levels: 1. 1.1. 1.2. 2. 2.1.
    const r = await run({
      body: P(R("רקע"), NUMP(1, 0)) + P(R("הצדדים נישאו."), NUMP(1, 1)) + P(R("נולדו להם ילדים."), NUMP(1, 1)) + P(R("הטענות"), NUMP(1, 0)) + P(R("הנתבע לא שילם."), NUMP(1, 1)),
      parts: [numbering(ABS(0, LVL(0, "decimal", "%1.") + LVL(1, "decimal", "%1.%2.")), NUM(1, 0))],
    });
    ok(r.copy === "1. רקע\n1.1. הצדדים נישאו.\n1.2. נולדו להם ילדים.\n2. הטענות\n2.1. הנתבע לא שילם.", "two levels, the lower one restarting: " + JSON.stringify(r.copy));
    // legal numbering (isLgl) writes the upper level in digits; a level that never restarts keeps counting
    const body = P(R("רקע"), NUMP(1, 0)) + P(R("פרט"), NUMP(1, 1)) + P(R("הטענות"), NUMP(1, 0)) + P(R("פרט נוסף"), NUMP(1, 1));
    const lg = await run({ body, parts: [numbering(ABS(0, LVL(0, "hebrew1", "%1.") + LVL(1, "decimal", "%1.%2.", 1, "<w:isLgl/>")), NUM(1, 0))] });
    ok(lg.copy === "א. רקע\n1.1. פרט\nב. הטענות\n2.1. פרט נוסף", "legal numbering: " + JSON.stringify(lg.copy));
    const nr = await run({ body, parts: [numbering(ABS(0, LVL(0, "hebrew1", "%1.") + LVL(1, "decimal", "%1.%2.", 1, '<w:lvlRestart w:val="0"/>')), NUM(1, 0))] });
    ok(nr.copy === "א. רקע\nא.1. פרט\nב. הטענות\nב.2. פרט נוסף", "a level that never restarts: " + JSON.stringify(nr.copy));
  }
  {
    // Hebrew letters, Roman numerals, letters in brackets, zero-padded, a bullet
    const many = (n, id) => Array.from({ length: n }, (_, i) => P(R("סעיף " + (i + 1)), NUMP(id))).join("");
    const r = await run({
      body: many(16, 1) + many(4, 2) + many(2, 3) + many(2, 4) + P(R("נקודה"), NUMP(5)) + many(3, 6),
      parts: [numbering(ABS(1, LVL(0, "hebrew1", "%1.")) + ABS(2, LVL(0, "upperRoman", "%1.")) + ABS(3, LVL(0, "lowerLetter", "(%1)")) + ABS(4, LVL(0, "decimalZero", "%1.")) +
        ABS(5, LVL(0, "bullet", "\uF0B7")) + ABS(6, LVL(0, "hebrew2", "%1)")), NUM(1, 1) + NUM(2, 2) + NUM(3, 3) + NUM(4, 4) + NUM(5, 5) + NUM(6, 6))],
    });
    const lines = r.copy.split("\n");
    ok(lines[0] === "א. סעיף 1" && lines[9] === "י. סעיף 10" && lines[10] === "יא. סעיף 11" && lines[14] === "טו. סעיף 15" && lines[15] === "טז. סעיף 16", "Hebrew numerals: " + JSON.stringify(lines.slice(0, 16)));
    ok(lines[19] === "IV. סעיף 4", "Roman numerals: " + lines[19]);
    ok(lines[20] === "(a) סעיף 1" && lines[21] === "(b) סעיף 2", "letters in brackets: " + lines.slice(20, 22));
    ok(lines[22] === "01. סעיף 1", "zero-padded: " + lines[22]);
    ok(lines[24] === "• נקודה", "a bullet from a symbol font is a bullet: " + JSON.stringify(lines[24]));
    ok(lines[25] === "א) סעיף 1" && lines[27] === "ג) סעיף 3", "the Hebrew alphabet: " + lines.slice(25, 28));
  }
  {
    // numbering that comes from the paragraph's style, a style based on it, a paragraph that turns it off, a restart
    const styles = part("styles", '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Clause"><w:name w:val="Clause"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Clause2"><w:name w:val="Clause2"/><w:basedOn w:val="Clause"/></w:style>');
    const st = (s, more = "") => `<w:pPr><w:pStyle w:val="${s}"/>${more}</w:pPr>`;
    const r = await run({
      styles,
      body: P(R("ראשון"), st("Clause")) + P(R("שני"), st("Clause2")) + P(R("בלי מספר"), st("Clause", '<w:numPr><w:numId w:val="0"/></w:numPr>')) + P(R("שלישי"), st("Clause")) +
        P(R("מתחיל מחדש"), NUMP(2)) + P(R("וממשיך"), NUMP(2)),
      parts: [numbering(ABS(0, LVL(0, "decimal", "%1.", 1, '<w:pStyle w:val="Clause"/>')), NUM(1, 0) + NUM(2, 0, '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>'))],
    });
    ok(r.copy === "1. ראשון\n2. שני\nבלי מספר\n3. שלישי\n1. מתחיל מחדש\n2. וממשיך", "numbering from a style, a style based on it, numId 0, a restart: " + JSON.stringify(r.copy));
  }
  {
    // an empty numbered paragraph still takes its number
    const r = await run({ body: P(R("א"), NUMP()) + P("", NUMP()) + P(R("ג"), NUMP()), parts: [numbering(ABS(0, LVL(0, "decimal", "%1.")), NUM(1, 0))] });
    ok(r.copy === "1. א\n3. ג", "an empty clause keeps its number: " + JSON.stringify(r.copy));
  }

  console.log("\n— a text box is read once —");
  const box = (choice, fallback) => P(`<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="1" name="Text Box 1"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:txbx><w:txbxContent>${P(R(choice))}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape type="#_x0000_t202"><v:textbox><w:txbxContent>${P(R(fallback))}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`);
  {
    const t = `הערה: ${NAME} ביקשה דחייה.`;
    const r = await run({ body: P(R("פתיח.")) + box(t, t) + P(R("סוף.")) });
    ok(r.copy === "פתיח.\nהערה: יעל כהן ביקשה דחייה.\nסוף.", "the text box once in the copied text: " + JSON.stringify(r.copy));
    ok(!left(r.o, "פרידמן").length && (r.o.text("word/document.xml").match(/יעל כהן/g) || []).length === 2, "and both of its copies in the file are replaced");
    ok(r.res.applied.filter((x) => x.value === NAME).length === 1, "and the replacement is counted once: " + r.res.applied.filter((x) => x.value === NAME).length);
    const blocks = await E.readBlocks(docx({ body: P(R("פתיח.")) + box(t, t) }));
    ok(blocks.filter((b) => b.text === t).length === 1, "every reader sees it once: " + JSON.stringify(blocks.map((b) => b.text)));
    // counterexample: a fallback that says something else is read
    const d = await run({ body: box("הערה ראשונה.", `הערה של ${NAME}.`) });
    ok(d.copy.includes("הערה ראשונה.") && d.copy.includes("הערה של יעל כהן.") && !left(d.o, "פרידמן").length, "a fallback with other text is read and replaced: " + JSON.stringify(d.copy));
    // SmartArt is written twice too: its data model and the drawing Word renders from it
    const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    const ap = (t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`;
    const data = `<?xml version="1.0"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" ${A}><dgm:ptLst><dgm:pt modelId="1"><dgm:t>${ap(NAME)}</dgm:t></dgm:pt><dgm:pt modelId="2"><dgm:t>${ap("הילדים")}</dgm:t></dgm:pt></dgm:ptLst></dgm:dataModel>`;
    const drawing = `<?xml version="1.0"?><dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" ${A}><dsp:spTree><dsp:sp><dsp:txBody>${ap(NAME)}</dsp:txBody></dsp:sp><dsp:sp><dsp:txBody>${ap("הילדים")}</dsp:txBody></dsp:sp></dsp:spTree></dsp:drawing>`;
    const sa = await run({ body: P(R("התרשים:")), parts: [{ name: "word/diagrams/data1.xml", body: data }, { name: "word/diagrams/drawing1.xml", body: drawing }] });
    ok(sa.copy === "התרשים:\nיעל כהן\nהילדים", "a SmartArt shape once in the copied text: " + JSON.stringify(sa.copy));
    ok(!left(sa.o, "פרידמן").length && sa.o.text("word/diagrams/drawing1.xml").includes("יעל כהן"), "and replaced in both parts: " + left(sa.o, "פרידמן"));
  }

  console.log("\n— placeholder text Word never shows is not copied —");
  {
    const gl = part("glossaryDocument", "<w:docParts>" + ["לחץ או הקש כאן להזנת טקסט.", "לחץ או הקש כדי להזין תאריך.", `עו"ד ${NAME} הגישה את הבקשה.`].map((t, i) =>
      `<w:docPart><w:docPartPr><w:name w:val="DefaultPlaceholder_${i}"/><w:category><w:name w:val="General"/><w:gallery w:val="placeholder"/></w:category><w:types><w:type w:val="bbPlcHdr"/></w:types><w:guid w:val="{0000000${i}-0000-0000-0000-000000000000}"/></w:docPartPr><w:docPartBody>${P(`<w:r><w:rPr><w:rStyle w:val="PlaceholderText"/></w:rPr><w:t>${t}</w:t></w:r>`)}</w:docPartBody></w:docPart>`).join("") + "</w:docParts>");
    const o = { body: P(R("שם המבקשת: ") + `<w:sdt><w:sdtPr><w:placeholder><w:docPart w:val="DefaultPlaceholder_0"/></w:placeholder></w:sdtPr><w:sdtContent>${R("נועה גל")}</w:sdtContent></w:sdt>`) + P(R("הבקשה הוגשה היום.")),
      parts: [{ name: "word/glossary/document.xml", body: gl, ct: CT + "document.glossary+xml", rel: "glossaryDocument" }] };
    const r = await run(o);
    ok(!r.copy.includes("לחץ או הקש") && !r.copy.includes("הגישה את הבקשה"), "the copied text has no placeholder text: " + JSON.stringify(r.copy));
    ok(r.copy === "שם המבקשת: נועה גל\nהבקשה הוגשה היום.", "only what Word shows: " + JSON.stringify(r.copy));
    ok(!left(r.o, "פרידמן").length, "a listed name in a building block is still replaced in the file");
    const un = await run(o, []);
    ok(un.res.verification.suggest.some((x) => x.value === NAME), "and an unlisted one there is still put in front of her: " + JSON.stringify(un.res.verification.suggest.map((x) => x.value)));
  }

  console.log("\n— text XML cannot store: pasted text and PDF text —");
  {
    const textToDocx = L.textToDocxOf(E);
    const parsed = async (buf) => { try { return await E.readBlocks(buf.slice(0)); } catch (e) { return e; } };
    const docOf = async (buf) => E.TXT.decode((await E.unzip(buf.slice(0))).find((f) => f.name === "word/document.xml").data);
    const BADCH = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;
    // Word's manual line break (Shift+Enter) comes as U+000B
    const txt = `עו"ד ${NAME}\u000Bרחוב הזית 12, חיפה\nהמבקשת הגישה בקשה למזונות ביום חמישי.`;
    let buf = null; try { buf = await textToDocx(txt); } catch (e) { buf = null; }
    const blocks = buf && await parsed(buf);
    ok(Array.isArray(blocks), "a manual line break: the text is read, not «XML פגום»: " + (blocks && blocks.message));
    if (Array.isArray(blocks)) {
      ok(blocks[0] && blocks[0].text === `עו"ד ${NAME} רחוב הזית 12, חיפה`, "and it is a break between the words, not glue: " + JSON.stringify(blocks.map((b) => b.text)));
      const x = await docOf(buf);
      ok(x.includes("<w:br/>") && !BADCH.test(x), "written as Word's own line break");
      const res = await E.redactDocx(buf.slice(0), SUBS, [], OPT);
      const copy = copyOf(E, res);
      ok(copy.includes('עו"ד יעל כהן') && !copy.includes("פרידמן"), "the listed name is replaced: " + JSON.stringify(copy));
      const pairs = res.applied.filter((a) => a.rep).map((a) => [a.base || a.value, a.baseRep || a.rep]);
      const back = E.restoreNames(`לכבוד עו"ד יעל כהן,\u000Bהבקשה התקבלה.\nבברכה, יעל כהן`, pairs);
      ok(back.text.includes(`עו"ד ${NAME},\u000Bהבקשה`) && back.text.endsWith(NAME) && back.count === 2, "and the answer comes back with the real name: " + JSON.stringify(back.text));
    }
    for (const [what, input, want] of [
      ["a page break (U+000C)", "המבקשת הגישה בקשה.\u000Cעמוד 2: הדיון נדחה לחודש הבא.", "המבקשת הגישה בקשה. עמוד 2: הדיון נדחה לחודש הבא."],
      ["Acrobat's line-end hyphen (U+0002)", "The respondent's em\u0002ployer, ההודעה נשלחה למעסיק.", "The respondent's employer, ההודעה נשלחה למעסיק."],
      ["Word's non-breaking hyphen (U+001E)", "המורה אורי בן\u001Eשחר אמר.", "המורה אורי בן-שחר אמר."],
      ["Word's optional hyphen (U+001F)", "המסמך נחתם בירושל\u001Fים ביום חמישי.", "המסמך נחתם בירושלים ביום חמישי."],
      ["other control characters and non-characters", "המבקשת\u0000 הגישה\u0007 בקשה\u001B למזונות\uFFFE היום\uFFFF.", "המבקשת הגישה בקשה למזונות היום."],
      ["half of a surrogate pair", "המבקשת הגישה\uD800 בקשה למזונות.", "המבקשת הגישה בקשה למזונות."],
    ]) {
      let b2 = null; try { b2 = await textToDocx(input); } catch (e) { b2 = null; }
      const bl = b2 && await parsed(b2);
      ok(Array.isArray(bl) && bl.length === 1 && bl[0].text === want, `${what}: ` + JSON.stringify(Array.isArray(bl) ? bl.map((b) => b.text) : bl && bl.message));
      const x = b2 && await docOf(b2);
      ok(x && !BADCH.test(x) && !x.includes("\uFFFD"), `${what}: nothing in the file XML cannot store`);
    }
    {
      const b2 = await textToDocx("המבקשת הגישה בקשה.\u000Cעמוד 2.");
      ok((await docOf(b2)).includes('<w:br w:type="page"/>'), "a page break is Word's page break");
      const b3 = await textToDocx("אורי בן\u001Eשחר ופרי\u001Fדמן");
      const x3 = await docOf(b3);
      ok(x3.includes("<w:noBreakHyphen/>") && x3.includes("<w:softHyphen/>"), "Word's two hyphens are Word's elements");
    }
    // control: plain text is unchanged
    const plain = "המבקשת הגישה בקשה למזונות.\nהדיון נקבע ליום חמישי.";
    const pb = await parsed(await textToDocx(plain));
    ok(Array.isArray(pb) && pb.map((b) => b.text).join("\n") === plain, "plain text reads as before");
    // a replacement she typed with such a character still gives a file the browser can open
    const typed = await E.redactDocx(docx({ body: P(R(`המבקשת ${NAME} הגישה.`)) }), [{ value: NAME, kind: "NAME", replacement: "יעל\u000Bכהן" }], [], OPT);
    const to = await outOf(E, typed);
    ok(!problems(to).length && !BADCH.test(to.text("word/document.xml")), "a replacement with such a character is cleaned before it is written: " + problems(to));
  }

  done();
})().catch((e) => { console.log("  ✗ the suite threw: " + (e && e.stack || e)); console.log("\n0 passed, 1 failed"); process.exitCode = 1; });
