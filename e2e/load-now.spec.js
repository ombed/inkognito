const { test, expect } = require("./base");
const H = require("./helpers");

/* The previous document leaves the screen as soon as the next one starts loading (12.10). Preparing pasted text takes a
   moment (the converter loads, the text becomes a Word file, the file is read back); until then the previous document's
   card stayed, with its «המשך — איתור שמות במסמך», and a press in that moment went on with the previous client's
   document. Found by the WebKit run under load (e2e/restore.spec.js, "the next document, loaded by pasted text");
   here the converter is held back so the moment is long on any machine. Invented names only. */
const FIRST = "פרוטוקול דיון\nרחל פרידמן: אני מבקשת לפתוח.\nדוד כהן: הגעתי הבוקר.";
const NEXT = "פרוטוקול ישיבה\nיעל ברגר: אני המבקשת.\nמשה גולן: אני המשיב.";

test("while pasted text is being prepared, the previous document's card and its «המשך» are already gone", async ({ page }) => {
  await H.serveEngineWithStub(page);
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route("**/text-to-docx.js", async (route) => { await held; await route.continue(); });
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  // built here, not with the page's converter (H.upload uses it): the converter is first fetched by the paste
  const { mkzip } = require("../tests/mkzip.js"), L = require("../tests/structure-lib.js");
  const file = Buffer.from(new Uint8Array(mkzip([...L.base, { name: "word/document.xml", body: L.doc(FIRST.split("\n").map((t) => L.P(L.R(t))).join("")) }])));
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: "first.docx", mimeType: H.DOCX, buffer: file });
  await expect(page.getByText("first.docx")).toBeVisible();
  const go = page.getByRole("button", { name: "המשך — איתור שמות במסמך" });
  await expect(go).toBeVisible();
  await expect(page.locator("main")).toContainText("first.docx");

  await page.getByPlaceholder("הדבקת טקסט לבדיקה…").fill(NEXT);
  await page.getByRole("button", { name: "שימוש בטקסט הזה" }).click();
  // the converter is still held: the previous document is off the screen already
  await expect(go).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("first.docx");
  await expect(page.getByPlaceholder("הדבקת טקסט לבדיקה…")).toHaveValue(NEXT);

  release();
  await expect(go).toBeVisible({ timeout: 20000 });
  await expect(page.locator("main")).toContainText("טקסט שהודבק");
});
