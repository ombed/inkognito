const { test, expect } = require("./base");
const H = require("./helpers");
const { mkzip } = require("../tests/mkzip.js");
const L = require("../tests/structure-lib.js");

/* A citation of another case stays as written (the owner's decision, 13.10; engine/07-cite.js, tests/cite_t.js): its
   names and number are not this case's, and the AI needs them. In the app: a precedent's party is not put on the list
   of names, the work screen shows the kept citation under «ציטוטים של תיקים אחרים», the document shows it as written,
   and ↩ replaces it like any other name, as one step that «ביטול» takes back. Every name is invented. */
const KEPT = "ע\"א 1234/90 כהן נ' לוי";
const RULING = [
  "בבית המשפט העליון",
  "ע\"א 4711/19",
  "המשיב: יורם שטרנפלד",
  "פסק-דין",
  `כפי שנקבע ב${KEPT}, פ"ד מה(2) 233, הנטל על התובע.`,
  "וכן ע\"א 2468/05 יוסי ברקמן נ' דוד אלמגור, פ\"ד ס(1) 77.",
  "המשיב יורם שטרנפלד לא הוכיח את טענתו.",
];
const file = () => Buffer.from(new Uint8Array(mkzip([...L.base, { name: "word/document.xml",
  body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document ${L.NS}><w:body>` + RULING.map((t) => L.P(L.R(t.replace(/&/g, "&amp;").replace(/</g, "&lt;")))).join("") + "</w:body></w:document>" }])));

test("a citation of another case stays as written, off the list, and ↩ replaces it as one step", async ({ page }) => {
  await H.serveEngineWithStub(page);
  // the stub answers from the text it is handed: this case's respondent, and a precedent's two parties
  await page.addInitScript(() => { window.__ner = { names: (t) => ["יורם שטרנפלד", "יוסי ברקמן", "דוד אלמגור"].filter((n) => t.includes(n)), cached: true }; });
  await H.boot(page);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: "ruling.docx", mimeType: H.DOCX, buffer: file() });
  await expect(page.getByText("ruling.docx")).toBeVisible();
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 15000 });
  const listed = await H.listedNames(page);
  expect(listed, "this case's respondent is on the list").toContain("יורם שטרנפלד");
  expect(listed.some((n) => /ברקמן|אלמגור/.test(n)), "a precedent's parties are not: " + JSON.stringify(listed)).toBe(false);

  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });

  const row = page.locator("[data-cited]"), paper = page.locator("[data-paper]");
  await expect(row).toBeVisible();
  await expect(row).toContainText("1234/90");
  await expect(row).toContainText("2468/05");
  await expect(paper).toContainText(KEPT);
  await expect(paper).toContainText("יוסי ברקמן נ' דוד אלמגור");
  await expect(paper).not.toContainText("שטרנפלד");
  await expect(paper).not.toContainText("4711/19");

  // ↩ on the first citation: replaced like any other name, the other one stays
  await row.getByRole("button", { name: /1234\/90/ }).click();
  await expect(paper).not.toContainText("1234/90", { timeout: 15000 });
  await expect(paper).toContainText("2468/05");
  await expect(row).not.toContainText("1234/90");

  // and it is one step: «ביטול» brings the citation back
  await page.getByRole("button", { name: "ביטול הפעולה האחרונה" }).click();
  await expect(paper).toContainText(KEPT, { timeout: 15000 });
  await expect(row).toContainText("1234/90");
});
