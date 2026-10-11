const { test, expect } = require("./base");
const H = require("./helpers");
const { chromium } = require("@playwright/test");

/* Only Chromium prints a page to PDF (page.pdf). In WebKit and Firefox the same PDF is printed by a
   Chromium of its own, and the engine under test reads it back: what is checked is the reading. */
async function printPdf(context, browserName, html) {
  if (browserName === "chromium") {
    const printer = await context.newPage();
    await printer.setContent(html);
    const pdf = await printer.pdf({ format: "A4" });
    await printer.close();
    return pdf;
  }
  const b = await chromium.launch();
  try {
    const printer = await b.newPage();
    await printer.setContent(html);
    return await printer.pdf({ format: "A4" });
  } finally { await b.close(); }
}

/* pdf-text.js had no behavioural test (review M11), and it sorted every line's text items
   by ascending x. A Hebrew line split into several items, which one bold word is enough to
   cause, came out with its items reversed: a name split across two items arrived backwards
   and was missed, with fewer findings and no error. The PDF here is printed by the browser
   from a page with a known reading order, and read back by the shipped extractor. */

const LINES = [
  ["העובדת הסוציאלית הגישה את הדוח היום", "העובדת הסוציאלית הגישה את הדוח היום"],
  ["האם <b>רונית לוי</b> מתגוררת בחיפה", "האם רונית לוי מתגוררת בחיפה"],
  ["הקטינה <b>נועה</b> בן-דוד ת.ז. 314277062 טלפון 052-6613874", "הקטינה נועה בן-דוד ת.ז. 314277062 טלפון 052-6613874"],
  ["The mother <b>Ronit Levy</b> lives in Haifa", "The mother Ronit Levy lives in Haifa"],
];

test("a Hebrew PDF is read in reading order, line by line, also when a line is split by formatting", async ({ page, context, browserName }) => {
  test.info().annotations.push({ type: "no-self-check" }); // no document is loaded into the app here
  const pdf = await printPdf(context, browserName, `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;line-height:2.2;margin:40px">${LINES.map(([h]) => `<p style="margin:0 0 18px">${h}</p>`).join("")}</body></html>`);

  await H.servePdfJsLocally(page);
  await page.goto("/index.html");
  const got = await page.evaluate(async (bytes) => {
    const { pdfToText } = await import("./pdf-text.js");
    return pdfToText(new Uint8Array(bytes).buffer);
  }, [...pdf]);
  expect(got.scanned).toBe(false);
  expect(got.pages).toBe(1);
  expect(got.text.split("\n").filter(Boolean)).toEqual(LINES.map(([, logical]) => logical));
});

/* The hunt of 11.10: every visual line of a PDF became a paragraph of its own, and the details are found one
   paragraph at a time, so a phone wrapped after «052-» and an address wrapped after «ברחוב» reached the AI
   whole, under a green bar. A paragraph's wrapped lines (they fill the text block, one line apart) are one
   paragraph again; a line ending in a hyphen joins the next without a space. The paragraphs above, each one
   short line, still come back one per line. */
test("a paragraph wrapped across lines is read as one, so a wrapped phone or address is found", async ({ page, context, browserName }) => {
  test.info().annotations.push({ type: "no-self-check" }); // no document is loaded into the app here
  const para = "המבקשת רחל פרידמן מתגוררת עם ילדיה בדירה שכורה ברחוב<br>הזית 12 בחיפה, וניתן להשיג אותה בכל שעה בטלפון 052-<br>123-4567 וכן בדואר, בכל יום מימות השבוע.";
  const pdf = await printPdf(context, browserName, `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;margin:40px"><p style="margin:0 0 24px;text-align:justify;text-align-last:justify">${para}</p><p style="margin:0">1. סעיף נפרד שאינו חלק מהפסקה.</p></body></html>`);
  await H.servePdfJsLocally(page);
  await page.goto("/index.html");
  const got = await page.evaluate(async (bytes) => {
    const { pdfToText } = await import("./pdf-text.js");
    return pdfToText(new Uint8Array(bytes).buffer);
  }, [...pdf]);
  const lines = got.text.split("\n").filter(Boolean);
  expect(lines[0]).toBe("המבקשת רחל פרידמן מתגוררת עם ילדיה בדירה שכורה ברחוב הזית 12 בחיפה, וניתן להשיג אותה בכל שעה בטלפון 052-123-4567 וכן בדואר, בכל יום מימות השבוע.");
  expect(lines[1]).toBe("1. סעיף נפרד שאינו חלק מהפסקה.");
  // and what the engine makes of that line: the phone and the street, whole
  const found = await page.evaluate(async (t) => {
    const E = await import("./redact-engine.js");
    const on = new Set(["PHONE_MOBILE", "ADDRESS_STREET"]);
    return new E.Engine([], [], { on, flag: new Set(), mode: "real", near: false, body: false, prefixes: "normal" }, t).detect(t).map((h) => h.text);
  }, lines[0]);
  expect(found).toEqual(expect.arrayContaining(["052-123-4567", "ברחוב הזית 12"]));
});

/* Suspicion from the review, confirmed here: `scanned` was "fewer than 40 characters a page", so
   a scanned document whose pages each carry a printed court header came through as text, and
   she was never told that the body is a picture. A page counts as a picture when what is left
   after the lines repeated on most pages is under 40 characters. */
const HEADER = "בית המשפט לענייני משפחה בחיפה — תיק 12345-06-24";
const page_ = (body) => `<section style="page-break-after:always"><p style="margin:0 0 18px">${HEADER}</p>${body}</section>`;
const picture = `<div style="width:600px;height:700px;background:repeating-linear-gradient(45deg,#999 0 6px,#fff 6px 12px)"></div>`;
async function readPdf(page, context, browserName, html) {
  const pdf = await printPdf(context, browserName, `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;margin:40px">${html}</body></html>`);
  await H.servePdfJsLocally(page);
  await page.goto("/index.html");
  return page.evaluate(async (bytes) => { const { pdfToText } = await import("./pdf-text.js"); return pdfToText(new Uint8Array(bytes).buffer); }, [...pdf]);
}

test("a scanned PDF with a printed header on every page is still a scanned PDF", async ({ page, context, browserName }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const got = await readPdf(page, context, browserName, page_(picture) + page_(picture) + page_(picture));
  expect(got.pages).toBe(3);
  expect(got.scanned).toBe(true);
});

test("a PDF with some pages that are pictures says which", async ({ page, context, browserName }) => {
  test.info().annotations.push({ type: "no-self-check" });
  const one = `<p>העובדת הסוציאלית הגישה את הדוח היום, והאם רונית לוי מסרה את גרסתה בפני הוועדה.</p>`;
  const three = `<p>הדיון נדחה לחודש הבא, והצדדים יגישו עד אז את עמדותיהם בכתב לבית המשפט.</p>`;
  const got = await readPdf(page, context, browserName, page_(one) + page_(picture) + page_(three));
  expect(got.scanned).toBe(false);
  expect(got.imagePages).toEqual([2]);
});

test("the app tells her which pages of the PDF are pictures", async ({ page, context, browserName }) => {
  test.info().annotations.push({ type: "no-self-check" }); // stops at the entry screen
  const one = `<p>העובדת הסוציאלית הגישה את הדוח היום, והאם רונית לוי מסרה את גרסתה בפני הוועדה.</p>`;
  const three = `<p>הדיון נדחה לחודש הבא, והצדדים יגישו עד אז את עמדותיהם בכתב לבית המשפט.</p>`;
  const pdf = await printPdf(context, browserName, `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:18px;margin:40px">${page_(one) + page_(picture) + page_(three)}</body></html>`);
  await H.servePdfJsLocally(page);
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "case.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.locator("[data-notice]")).toContainText("עמוד 2 ב־PDF הוא תמונה");
});
