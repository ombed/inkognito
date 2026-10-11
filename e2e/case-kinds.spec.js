const { test, expect } = require("./base");
const H = require("./helpers");

/* A saved case gives each value back as its kind (the hunt of 11.10). Every pair in a case's map came back as
   a person when the case was used: the date «12.3.2026», shifted to another date in the first document, became
   a rule for a name, and pinned that one date in the next document against the shift of all its other dates.
   The case now keeps each value's kind (currentKinds), and a date is not a rule: each document shifts its own.
   Every name here is invented. */

const DOC = ["סיכום פגישה", "הלקוחה ליה סיפרה שגרה בחולון מאז 12.3.2026.", "ליה מבקשת לקבוע מועד."].join("\n");
const rules = (page) => page.evaluate(() => window.__pib.state().rules.map((r) => [r.value, r.kind]));

async function settingsOpen(page) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
}

test("a case saved with a shifted date, a town and a person gives each back as its kind", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await settingsOpen(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "first.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("ליה"); await input.press("Enter");
  await page.locator("[data-case-field] input").fill("תיק בדיקה");
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  // the case holds each value's kind: the date as a date, the town as a place, the person as a person
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}")["תיק בדיקה"] || {})).kinds || {}, { timeout: 5000 })
    .toMatchObject({ "12.3.2026": "DATE", "חולון": "PLACE", "ליה": "NAME" });
  // a fresh page, the case chosen first
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload();
  await page.locator('[data-case="תיק בדיקה"]').getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await expect.poll(() => rules(page)).toContainEqual(["ליה", "NAME"]);
  const back = await rules(page);
  expect(back).toContainEqual(["חולון", "PLACE"]);
  expect(back.map(([v]) => v), "the shifted date of the first document is no rule here, and no person").not.toContain("12.3.2026");
  // and the next document's people list has the person, not the date
  await settingsOpen(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "second.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const listed = await H.listedNames(page);
  expect(listed).toContain("ליה");
  expect(listed).not.toContain("12.3.2026");
});
