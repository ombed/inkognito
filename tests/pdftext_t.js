/* What the PDF reader reads (the hunt of 11.10).

   1. A Hebrew line drawn as separate runs placed from right to left (a bold name in the middle of a line, as some
      writers and OCR layers do) came out glued: «המבקשתרחל פרידמןהגישה». pdf.js adds a space only when the drawing
      moves rightwards, so a listed name was not found (a red bar with nothing to fix) and an unlisted one was not
      suggested. A gap on the page between two items is now a space; items that touch stay one word.
   2. A filled PDF form keeps its values in the fields, and Acrobat's «Fill & Sign» writes in text boxes: only the
      printed labels were read, so a short form looked like a scan and a long one loaded without its values.
      Every filled field and text box is now read on the row of its label.
   The reader runs here as the page runs it (pdf-text.js, the vendored pdf.js), on PDFs written by tests/pdfmk.js.
   Every name and number is invented. */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { mkpdf, visual } = require("./pdfmk.js");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  ✗ " + m)); };

const ROOT = path.join(__dirname, "..");
// the repo has no "type":"module": the reader is copied as an ES module, its vendor folder named in full
const base = pathToFileURL(ROOT + path.sep).href;
fs.writeFileSync(path.join(__dirname, "pdftext-core.mjs"), fs.readFileSync(path.join(ROOT, "pdf-text.js"), "utf8").replace(/new URL\("\.\/vendor\//g, 'new URL("' + base + "vendor/"));
const W = 6; // the writer's glyphs are 500/1000 of a 12-point font
// runs of one line, placed from right to left at x, each drawn in visual order; gap: the space between runs
const rtlRuns = (runs, gap, y = 780) => { let x = 540; return runs.map((r) => { x -= r.length * W; const it = { text: visual(r), logical: true, x, y }; x -= gap; return it; }); };

(async () => {
  const { pdfToText } = await import(pathToFileURL(path.join(__dirname, "pdftext-core.mjs")).href);
  const read = async (pages, opt) => { const b = mkpdf(pages, opt); return pdfToText(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };

  console.log("\n— a line drawn as runs from right to left —");
  for (const [what, runs, gap, want] of [
    ["runs with a gap and no space glyph", ["המבקשת", "רחל פרידמן", "הגישה בקשה למזונות."], W, "המבקשת רחל פרידמן הגישה בקשה למזונות."],
    ["runs with the space glyph at their edges", ["המבקשת ", "רחל פרידמן", " הגישה בקשה למזונות."], 0, "המבקשת רחל פרידמן הגישה בקשה למזונות."],
    ["a number in the middle of the line", ["תעודת הזהות", "034567128", "של האם."], W, "תעודת הזהות 034567128 של האם."],
    ["a wide gap, as between two cells of a table row", ["שם המבקשת", "רחל פרידמן"], 60, "שם המבקשת רחל פרידמן"],
  ]) {
    const r = await read([rtlRuns(runs, gap)]);
    ok(r.text === want, `${what}: «${r.text}»`);
  }
  {
    // the same runs written left to right, as Chrome prints: as before
    const r = await read([rtlRuns(["המבקשת", "רחל פרידמן", "הגישה בקשה למזונות."], W).reverse()]);
    ok(r.text === "המבקשת רחל פרידמן הגישה בקשה למזונות.", "the same runs written left to right: «" + r.text + "»");
  }

  console.log("\n— counterexamples: what touches stays one word —");
  for (const [what, runs, want] of [
    ["a word in two runs that touch (one letter bold)", ["פרי", "דמן"], "פרידמן"],
    ["a name and a punctuation run that touch", ["רחל פרידמן", "."], "רחל פרידמן."],
    ["a plain line of one run", ["המבקשת רחל פרידמן הגישה בקשה."], "המבקשת רחל פרידמן הגישה בקשה."],
  ]) {
    const r = await read([rtlRuns(runs, 0)]);
    ok(r.text === want, `${what}: «${r.text}»`);
  }

  console.log("\n— a filled form —");
  {
    const labels = ["טופס הרצאת פרטים", "שם המבקשת:", "מספר זהות:", "כתובת:"];
    const page = labels.map((l, i) => { const b = visual(l); return { text: b, logical: true, x: 540 - b.length * W, y: 780 - i * 30 }; });
    const values = ["רחל פרידמן", "039337423", "רחוב הזית 12 חיפה"];
    const fields = values.map((value, i) => ({ value, rect: [200, 745 - i * 30, 450, 765 - i * 30] }));
    const r = await read([page], { fields });
    const lines = r.text.split("\n");
    ok(lines.includes("שם המבקשת: רחל פרידמן") && lines.includes("מספר זהות: 039337423") && lines.includes("כתובת: רחוב הזית 12 חיפה"), "each value is read after its label: " + JSON.stringify(lines));
    ok(!r.scanned && r.imagePages.length === 0, "a short filled form is not taken for a scan");
    const empty = await read([page], { fields: fields.map((f) => ({ ...f, value: "" })) });
    ok(empty.text.split("\n").includes("שם המבקשת:") && !/רחל|0393/.test(empty.text), "an empty form reads its labels only: " + JSON.stringify(empty.text));
    // a field with no label beside it is a line of its own, in its place on the page
    const alone = await read([page], { fields: [{ value: "הנספח צורף לבקשה", rect: [200, 640, 450, 660] }] });
    ok(/כתובת:\nהנספח צורף לבקשה$/.test(alone.text), "a field with no label beside it is a line of its own: " + JSON.stringify(alone.text));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log("  ✗ the reader ran: " + (e && e.stack || e)); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exitCode = 1; });
