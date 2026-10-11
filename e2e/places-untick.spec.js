const { test, expect } = require("./base");
const H = require("./helpers");

/* What the places screen shows is what happens (the hunt of 11.10). Unticking «להחליף» on a town she did not type —
   one the tool found by itself, in «יישובים נוספים שנמצאו» — did nothing, and the town was replaced in every
   sentence, though the card says ticked means replaced. Every name here is invented. */

const DOC = ["סיכום פגישה", "הלקוחה רונית לוי גרה בחולון עם בתה.", "רונית לוי עובדת בחולון כגננת."].join("\n");
const sheet = (page) => page.locator("[data-work] section").first();

async function toPlaces(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "meeting.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("רונית לוי"); await input.press("Enter");
  await H.goOn(page);
}

test("unticking a town the tool found keeps it in the text", async ({ page }) => {
  await toPlaces(page);
  const row = page.locator("[data-wrap]").filter({ hasText: "חולון" }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  const box = row.getByRole("checkbox", { name: "להחליף" });
  await expect(box).toBeChecked();
  await box.uncheck();
  await H.throughPlaces(page, page.getByRole("button", { name: "המשך לבדיקה" }));
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(sheet(page)).toContainText("בחולון");
  expect((await sheet(page).innerText()).split("חולון").length - 1, "both sentences keep it").toBe(2);
});

test("left ticked, the town the tool found is replaced", async ({ page }) => {
  await toPlaces(page);
  const row = page.locator("[data-wrap]").filter({ hasText: "חולון" }).first();
  await expect(row.getByRole("checkbox", { name: "להחליף" })).toBeChecked({ timeout: 15000 });
  await H.throughPlaces(page, page.getByRole("button", { name: "המשך לבדיקה" }));
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
  await expect(sheet(page)).not.toContainText("חולון");
});
