const { test, expect } = require("./base");
const H = require("./helpers");

/* A merge decided on the review screen survives the way back (the hunt of 11.10). «זה אותו אחד כמו…» was written
   on the rule only, and «מי בתיק» rebuilt the list without it: «המשך» then gave the same person a second
   pseudonym. The list now takes the merge decided there, and shows it («= …»).
   Every name here is invented. */

const DOC = ["תצהיר", "אברהם כהן הגיש את התצהיר ביום ראשון.", "בשיחה עם העובדת הסוציאלית, אבי כהן אמר שהוא לא יוותר על הקשר עם הבנות.", "אברהם כהן חתם בפני עורך הדין."].join("\n");
const sheet = (page) => page.locator("[data-work] section").first();
const reps = (page) => page.evaluate(() => Object.fromEntries(window.__pib.state().rules.map((r) => [r.value, r.sameAs || ""])));

async function toWork(page) {
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}

test("«אותו אדם כמו» on the review screen holds through «מי בתיק» and «המשך»", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  if (!(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "affidavit.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of ["אברהם כהן", "אבי כהן"]) { await input.fill(n); await input.press("Enter"); }
  await toWork(page);
  // the review screen: «אבי כהן» is the same person as «אברהם כהן»
  await page.locator('[data-mark][data-val="אבי כהן"]').first().click();
  await page.locator("[data-inline]").getByLabel("אותו אדם כמו").selectOption("אברהם כהן");
  await expect.poll(() => reps(page), { timeout: 15000 }).toMatchObject({ "אבי כהן": "אברהם כהן" });
  const one = async () => {
    const t = await sheet(page).innerText();
    return !/אברהם כהן|אבי כהן/.test(t);
  };
  await expect.poll(one, { timeout: 15000 }).toBe(true);
  // back to «מי בתיק»: the list shows the merge
  await page.locator("[data-back]").filter({ hasText: "מי בתיק" }).click();
  await expect(page.getByText("= אברהם כהן")).toBeVisible();
  // and on again: still one person
  await toWork(page);
  expect(await reps(page)).toMatchObject({ "אבי כהן": "אברהם כהן" });
  const lines = (await sheet(page).innerText()).split("\n").filter((l) => /הגיש את התצהיר|אמר שהוא/.test(l));
  const first = (lines[0] || "").match(/^(\S+ \S+) הגיש/), second = (lines[1] || "").match(/סוציאלית, (\S+ \S+) אמר/);
  expect(first && second && first[1] === second[1], "one pseudonym for both: " + JSON.stringify(lines)).toBe(true);
});
