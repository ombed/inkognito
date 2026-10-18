const { test, expect } = require("./base");
const H = require("./helpers");
const PL = require("../page-logic.js");

/* A case file with a password (the owner's decision of 12.10, «A», the wording approved; the engineering audit: exports
   were plain text with the real names). «ייצוא לקובץ» asks for a password and downloads the case encrypted; importing it
   asks for the password, says so when it is wrong, and takes the case when it is right. tests/lockfile_t.js checks the
   encryption itself. Invented names only. */
const DOC = "פרוטוקול דיון\nהתובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.";
// since 18.10 (the owner's decision and wording; the outside review, F11): eight characters at least, typed twice,
// and the file named by its date, not by the case, whose name is often the client's
const PW_EXPORT = "סיסמה לקובץ התיקים, לפחות 8 תווים. צריך אותה כדי לייבא אותו:";
const PW_SHORT = "הסיסמה קצרה מ-8 תווים.", PW_DIFF = "שתי הסיסמאות שונות.";
const PW_IMPORT = "הקובץ מוגן בסיסמה. סיסמה:";
const PW_BAD = "הסיסמה לא נכונה, או שהקובץ פגום.";
const CASE = { v: 1, name: "רום נ׳ רום", created: "2026-08-20T09:00:00.000Z", updated: "2026-09-01T09:00:00.000Z", mode: "real",
  rules: [{ value: "שרה רום", kind: "NAME", replacement: "דנה לב", auto: false, g: null }], allow: [], map: { "שרה רום": "דנה לב" }, removed: [], sent: {},
  styles: { num: "blank", date: "name" } };

test("«ייצוא לקובץ» asks for a password, and the file it downloads is locked, with no name in it", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await H.throughPlaces(page, page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first());
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /התיק ורשימת השמות/ }).click();
  await page.getByPlaceholder(/שם התיק/).fill("רונית לוי");
  await page.getByRole("button", { name: "ייצוא לקובץ" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(PW_EXPORT);
  await expect(dialog).toContainText("שוב, לבדיקה:");
  const ok = dialog.locator("[data-pw-ok]");
  await expect(ok).toBeDisabled();
  await dialog.locator("[data-pw-in]").fill("a long password 7");
  await expect(ok).toBeDisabled();
  // too short, and two that differ: said, and nothing downloads
  await dialog.locator("[data-pw-in]").fill("short7");
  await dialog.locator("[data-pw-again]").fill("short7");
  await ok.click();
  await expect(dialog.locator("[data-pw-err]")).toHaveText(PW_SHORT);
  await dialog.locator("[data-pw-in]").fill("a long password 7");
  await dialog.locator("[data-pw-again]").fill("a long password 8");
  await ok.click();
  await expect(dialog.locator("[data-pw-err]")).toHaveText(PW_DIFF);
  await dialog.locator("[data-pw-again]").fill("a long password 7");
  const dl = page.waitForEvent("download");
  await ok.click();
  const got = await dl;
  expect(got.suggestedFilename()).toMatch(/^תיק-מוצפן-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await got.path();
  const text = require("fs").readFileSync(file, "utf8");
  const locked = JSON.parse(text);
  expect(locked.inkognito).toBe("locked");
  expect(text).not.toContain("רונית");
  expect(text).not.toContain("לוי");
  await expect(dialog).toHaveCount(0);
  // and it opens with its password
  const back = await PL.unlockJSON(locked, "a long password 7");
  expect(back.rules.map((r) => r.value)).toContain("רונית לוי");
});

test("a locked case file asks for its password: cancel imports nothing, a wrong one says so, the right one takes the case", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const locked = await PL.lockJSON(CASE, "a long password 7");
  const pick = async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "ייבוא תיק מקובץ", exact: true }).first().click();
    await (await chooser).setFiles({ name: "תיק.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(locked)) });
  };
  const dialog = page.getByRole("dialog");
  await pick();
  await expect(dialog).toContainText(PW_IMPORT);
  await dialog.getByRole("button", { name: "ביטול" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-case-chip]")).toHaveCount(0);

  await pick();
  await dialog.locator("[data-pw-in]").fill("not the password");
  await dialog.locator("[data-pw-ok]").click();
  await expect(dialog.locator("[data-pw-err]")).toHaveText(PW_BAD);
  await expect(dialog.locator("[data-pw-in]")).toHaveValue("");
  await dialog.locator("[data-pw-in]").fill("a long password 7");
  await dialog.locator("[data-pw-in]").press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-case-chip]")).toContainText("תיק: " + CASE.name);
});
