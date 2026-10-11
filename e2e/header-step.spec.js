const { test, expect } = require("./base");
const H = require("./helpers");

/* Every way forward from «מי בתיק» goes with the list on the screen (the hunt of 11.10). The rules were built
   from the list only by «המשך»: the step «יישובים» in the header went on with the rules of the last run (and
   on a first pass with none), so a name typed on «מי בתיק» stayed in clear under a green bar; «קובץ» and then
   «יישובים» did the same, and «קובץ» and then «מי בתיק» took a typed name off the list. Every name here is
   invented, and none of them is in the pool of invented names, so the text can only keep one by a leak. */

const DOC = ["סיכום פגישה עם הלקוחה רונית לוי", "רונית לוי סיפרה שהשכנה, אלומה, שומרת על הילדים אחרי הגן.", "לדבריה אלומה גרה בחולון ומוכנה להעיד אם יידרש."].join("\n");
const sheet = (page) => page.locator("[data-work] section").first();
const step = (page, name) => page.locator("header nav").getByRole("button", { name, exact: true });
const back = (page, label) => page.locator("[data-back]").filter({ hasText: label }).click();
const type = async (page, name) => { const input = page.getByPlaceholder(/שם מלא/); await input.fill(name); await input.press("Enter"); };

async function open(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  if (!(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "meeting.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}
// from the places screen to the review screen, as she would
async function toWork(page) {
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
// a first run with her client, then back to «מי בתיק»
async function roundTrip(page) {
  await open(page);
  await type(page, "רונית לוי");
  await H.goOn(page);
  await toWork(page);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("רונית לוי");
  await back(page, "מי בתיק");
}

test("«יישובים» in the header, after a round trip: a name typed on «מי בתיק» is replaced", async ({ page }) => {
  await roundTrip(page);
  await type(page, "אלומה");
  await step(page, "יישובים").click();
  await toWork(page);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("אלומה");
  expect(await sheet(page).innerText()).not.toContain("רונית לוי");
});

test("«יישובים» in the header on the first pass: the names on the list are replaced", async ({ page }) => {
  await open(page);
  await type(page, "רונית לוי");
  await type(page, "אלומה");
  await step(page, "יישובים").click();
  await toWork(page);
  const text = await sheet(page).innerText();
  expect(text).not.toContain("רונית לוי");
  expect(text).not.toContain("אלומה");
});

test("a name typed but not yet added goes with «יישובים» in the header, as with «המשך»", async ({ page }) => {
  await roundTrip(page);
  await page.getByPlaceholder(/שם מלא/).fill("אלומה");
  await step(page, "יישובים").click();
  await toWork(page);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("אלומה");
});

test("«קובץ» and then «יישובים»: the name typed on «מי בתיק» is replaced", async ({ page }) => {
  await roundTrip(page);
  await type(page, "אלומה");
  await step(page, "קובץ").click();
  await step(page, "יישובים").click();
  await toWork(page);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("אלומה");
});

test("«קובץ» and then «מי בתיק»: the name typed there is still on the list", async ({ page }) => {
  await roundTrip(page);
  await type(page, "אלומה");
  await step(page, "קובץ").click();
  await step(page, "מי בתיק").click();
  expect(await H.listedNames(page)).toEqual(expect.arrayContaining(["רונית לוי", "אלומה"]));
});
