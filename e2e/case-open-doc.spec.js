const { test, expect } = require("./base");
const H = require("./helpers");

/* The case controls and a document already open (the hunt of 11.10). A case chosen on «קובץ», on «החזרת שמות»
   or on the work screen replaced the open document's whole list and processed it again; «בלי התיק הזה» emptied
   it. Either way the names typed for this document went to the AI in clear, under a green bar, and the next save
   wrote one client's names into the other's case. And typing a case name saved a case per keystroke, each one
   holding the client's real names. Every name here is invented. */

const profile = (name, real, fake) => ({ v: 1, name, created: "2026-09-01T09:00:00.000Z", updated: "2026-09-01T09:00:00.000Z", mode: "real",
  rules: [{ value: real, kind: "NAME", replacement: fake, auto: false, g: null }], allow: [], map: { [real]: fake }, removed: [], sent: {},
  styles: { num: "blank", date: "name" } });
const CASE_A = profile("כרמי נ׳ שגיא", "דנה כרמי", "מרים הרשקוביץ");
const LETTER = "מכתב: מרשתי, ליה, מבקשת לקבוע מועד לדיון. נכחו גם בני משפחת טננבאום, וגם דנה כרמי.";
const cases = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("redact-cases") || "{}"));
const paper = (page) => page.locator("[data-paper]");

function seed(page, items) {
  return page.addInitScript((items) => {
    try {
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  }, items);
}

// the letter, with two names the rules do not find by themselves typed in, through to the work screen
async function letterToWork(page, caseName) {
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "letter.docx", LETTER);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/), add = page.getByRole("button", { name: "הוספה", exact: true });
  for (const n of ["ליה", "טננבאום"]) { await input.fill(n); await add.click(); }
  if (caseName) await page.locator("[data-case-field] input").fill(caseName);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  await expect(paper(page)).not.toContainText("ליה");
  await expect(paper(page)).not.toContainText("טננבאום");
}

// back to «מי בתיק» and on to the document's choice, with the letter still open, then «שימוש בתיק הזה» on a saved case
async function useCaseFromEntry(page, name) {
  for (const label of ["מי בתיק", "קובץ"]) await page.locator("[data-back]").filter({ hasText: label }).click();
  await page.locator(`[data-case="${name}"]`).getByRole("button", { name: "שימוש בתיק הזה" }).click();
}

test("a case chosen while a letter is open adds its people, and the letter's own names stay replaced", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [CASE_A.name]: CASE_A } });
  await H.boot(page);
  await letterToWork(page);
  await useCaseFromEntry(page, CASE_A.name);
  // «המשך — איתור שמות במסמך»: the list keeps the letter's two typed names, and the case's person joins them
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  expect(await H.listedNames(page)).toEqual(expect.arrayContaining(["ליה", "טננבאום", "דנה כרמי"]));
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  // the case's person gets the case's invented name, and the letter's own two are still replaced
  await expect(paper(page)).not.toContainText("ליה");
  await expect(paper(page)).not.toContainText("טננבאום");
  await expect(paper(page)).not.toContainText("דנה כרמי");
  await expect(paper(page)).toContainText("מרים הרשקוביץ");
});

test("a letter that belongs to one case stays in it when another case is chosen, and nothing of it goes into the other", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [CASE_A.name]: CASE_A } });
  await H.boot(page);
  await letterToWork(page, "ליה נ׳ טננבאום");
  await useCaseFromEntry(page, CASE_A.name);
  await expect(page.locator("[data-notice]")).toContainText("המסמך הפתוח שייך לתיק «ליה נ׳ טננבאום», והוא נשאר בו. כדי לעבוד עם «כרמי נ׳ שגיא», פותחים מסמך חדש.");
  const stored = await cases(page);
  expect(stored[CASE_A.name]).toEqual(CASE_A);
  expect(Object.keys(stored).sort()).toEqual([CASE_A.name, "ליה נ׳ טננבאום"].sort());
});

test("«בלי התיק הזה» keeps every name that is in the letter replaced, and drops the case's people who are not in it", async ({ page }) => {
  await H.serveEngineWithStub(page);
  const other = { ...CASE_A, rules: [...CASE_A.rules, { value: "עוזי פלג", kind: "NAME", replacement: "גיל ברק", auto: false, g: null }], map: { ...CASE_A.map, "עוזי פלג": "גיל ברק" } };
  await seed(page, { "redact-cases": { [CASE_A.name]: other } });
  await H.boot(page);
  // the case first, then the letter: «דנה כרמי» is replaced only because the case lists her
  await page.locator(`[data-case="${CASE_A.name}"]`).getByRole("button", { name: "שימוש בתיק הזה" }).click();
  await letterToWork(page);
  await expect(paper(page)).not.toContainText("דנה כרמי");
  // the chip is on every screen but the review screen: here, the restore screen, then back to the letter
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await page.locator("[data-case-chip]").getByRole("button", { name: "בלי התיק הזה" }).click();
  await expect(page.locator("[data-case-chip]")).toHaveCount(0);
  await page.locator("[data-back]").filter({ hasText: "חזרה למסמך" }).click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
  for (const n of ["דנה כרמי", "ליה", "טננבאום"]) await expect(paper(page)).not.toContainText(n);
  // the case's person who is not in the letter is no longer on its list
  const rules = await page.evaluate(() => window.__pib.state().rules.map((r) => r.value));
  expect(rules).not.toContain("עוזי פלג");
  expect(rules).toEqual(expect.arrayContaining(["דנה כרמי", "ליה", "טננבאום"]));
});

test("a case name typed on the work screen is saved once, when the field is left, and a renamed one replaces it", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [CASE_A.name]: CASE_A } });
  await H.boot(page);
  await letterToWork(page);
  await page.getByRole("button", { name: /התיק ורשימת השמות/ }).click();
  const field = page.getByPlaceholder(/שם התיק/);
  await field.click();
  await page.keyboard.type("ליה נ׳ טננבאום");
  // a moment after typing stops, one case for the name: none per keystroke
  await expect.poll(async () => Object.keys(await cases(page)).sort()).toEqual([CASE_A.name, "ליה נ׳ טננבאום"].sort());
  await field.blur();
  expect(Object.keys(await cases(page)).sort()).toEqual([CASE_A.name, "ליה נ׳ טננבאום"].sort());
  // renamed: the case this letter made under the first name goes; the case that was there before stays
  await field.click();
  await page.keyboard.type(" 2");
  await field.blur();
  await expect.poll(async () => Object.keys(await cases(page)).sort()).toEqual([CASE_A.name, "ליה נ׳ טננבאום 2"].sort());
  expect((await cases(page))[CASE_A.name]).toEqual(CASE_A);
});

test("a pause on a name that is another case's does not write the letter into that case", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [CASE_A.name]: CASE_A } });
  await H.boot(page);
  await letterToWork(page);
  await page.getByRole("button", { name: /התיק ורשימת השמות/ }).click();
  const field = page.getByPlaceholder(/שם התיק/);
  await field.click();
  // typed so far: the other client's case name, and a pause longer than the moment the case list waits for
  await page.keyboard.type(CASE_A.name);
  await page.waitForTimeout(1500);
  expect((await cases(page))[CASE_A.name]).toEqual(CASE_A);
  // the name goes on, and the letter gets a case of its own; the other one is as it was
  await page.keyboard.type(" 2");
  await field.blur();
  await expect.poll(async () => Object.keys(await cases(page)).sort()).toEqual([CASE_A.name, CASE_A.name + " 2"].sort());
  expect((await cases(page))[CASE_A.name]).toEqual(CASE_A);
});
