const { test, expect } = require("./base");
const H = require("./helpers");

/* The last list is kept 24 hours (the owner's decision of 18.10; the outside review, F5). After every document the
   browser keeps the list of real names and their substitutes, without her pressing Save, so the restore screen and
   the entry screen can offer «the list from last time». It stayed for good, in plain text, beside the key of the
   substitutes. Now, a day after it was last updated, it is gone: not offered, and not in the browser. A case she saved
   stays in the case list. Invented names only. */
const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";
const OFFER = "להמשיך עם רשימת השמות מהפעם הקודמת?";

test.beforeEach(async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await H.throughPlaces(page, page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first());
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("redact-profile-last") || "null"));
  expect(saved && saved.rules.map((r) => r.value)).toContain("רונית לוי");
});

for (const [hours, kept] of [[23, true], [25, false]]) {
  test(`${hours} hours later the last list is ${kept ? "still offered" : "gone, from the screen and from the browser"}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(Date.now() + hours * 3600e3));
    await page.reload();
    await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
    if (kept) {
      await expect(page.getByText(OFFER)).toBeVisible();
    } else {
      await expect(page.getByText(OFFER)).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("redact-profile-last"))).toBeNull();
    }
  });
}
