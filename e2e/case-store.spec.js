const { test, expect } = require("./base");
const H = require("./helpers");

/* Saved cases belong to whoever uses the tool (the move to inkognito.co.il, 6.10.2026). The hosted
   service runs this same page for every account, and several accounts can share one computer, so every
   read, write and removal of the two case keys ("redact-cases", "redact-profile-last"), and the check
   on their storage events, goes through caseKey(k): the key itself while window.__inkStoreSuffix is
   unset (the public tool, where the saved cases already are), k + ":" + the suffix once the hosted page
   sets it to the signed-in account. The display keys (redact-theme, redact-intro-seen, redact-tour-seen)
   stay shared. Every name here is invented. */

const DOC = ["פרוטוקול", "רחל פרידמן: אני מבקשת לפתוח.", "אבנר שטרן: הגעתי.", "רחל פרידמן: תודה.", "אבנר שטרן: נכון."].join("\n");
const profile = (name, real, fake, updated = "2026-09-01T09:00:00.000Z") => ({ v: 1, name, created: "2026-08-20T09:00:00.000Z", updated, mode: "real",
  rules: [{ value: real, kind: "NAME", replacement: fake, auto: false, g: null }], allow: [], map: { [real]: fake }, removed: [], sent: {},
  styles: { num: "blank", date: "name" } });
const PLAIN_CASE = profile("פלדמן נ׳ גרוס", "מיכאל פלדמן", "יואב כרמי");
const PLAIN_LAST = profile("", "דפנה גרוס", "שירה אלון");
const ACCOUNT_CASE = profile("ברק נ׳ ברק", "עדי ברק", "נועה שגב");
const LAST_CARD = "להמשיך עם הפרופיל מהפעם הקודמת?";

// what the browser holds under the case keys, plain and suffixed, parsed
const store = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
  .filter((k) => /^redact-(cases|profile-last)(:|$)/.test(k)).sort().map((k) => [k, JSON.parse(localStorage.getItem(k))])));

// an init script runs again on every navigation: the storage is seeded once, the suffix set every time
function seed(page, items, suffix) {
  return page.addInitScript(([items, suffix]) => {
    if (suffix !== null) window.__inkStoreSuffix = suffix;
    try {
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  }, [items, suffix === undefined ? null : suffix]);
}

// a document through to the work screen, saved as a named case
async function workAndName(page, caseName) {
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await page.locator("[data-case-field] input").fill(caseName);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 15000 });
  if (await run.isVisible()) await run.click();
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 15000 });
}

test("without an account suffix the keys are the ones the public tool always used: her saved case and last profile are offered, and a new case is written there", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await seed(page, { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE }, "redact-profile-last": PLAIN_LAST });
  await H.boot(page);
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toBeVisible();
  await expect(page.getByText(LAST_CARD)).toBeVisible();

  await workAndName(page, "לוי נ׳ לוי");
  await expect.poll(async () => Object.keys((await store(page))["redact-cases"] || {}).sort()).toEqual(["לוי נ׳ לוי", PLAIN_CASE.name].sort());
  const s = await store(page);
  expect(Object.keys(s)).toEqual(["redact-cases", "redact-profile-last"]);
  expect(s["redact-cases"][PLAIN_CASE.name]).toEqual(PLAIN_CASE);
  expect(s["redact-profile-last"].name).toBe("לוי נ׳ לוי");
});

test("with an account suffix, cases are read, written and removed under the account's keys, and the plain keys are neither shown nor touched", async ({ page, context }) => {
  await H.serveEngineWithStub(page);
  const plain = { "redact-cases": { [PLAIN_CASE.name]: PLAIN_CASE }, "redact-profile-last": PLAIN_LAST };
  await seed(page, { ...plain, "redact-cases:acct-7": { [ACCOUNT_CASE.name]: ACCOUNT_CASE } }, "acct-7");
  await H.boot(page);
  await expect(page.locator(`[data-case="${ACCOUNT_CASE.name}"]`)).toBeVisible();
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toHaveCount(0);
  await expect(page.getByText(LAST_CARD)).toHaveCount(0);

  // another tab of the same account saves a case: this tab's list follows it (the storage event on the account's key)
  const other = await context.newPage();
  await other.goto("/icon.svg");
  const added = profile("שחר נ׳ שחר", "גלית שחר", "מורן לב", "2026-09-03T09:00:00.000Z");
  await other.evaluate(([k, p]) => { const m = JSON.parse(localStorage.getItem(k) || "{}"); m[p.name] = p; localStorage.setItem(k, JSON.stringify(m)); }, ["redact-cases:acct-7", added]);
  await expect(page.locator(`[data-case="${added.name}"]`)).toBeVisible();
  await other.close();

  await workAndName(page, "לוי נ׳ לוי");
  await expect.poll(async () => Object.keys((await store(page))["redact-cases:acct-7"] || {}).sort()).toEqual([ACCOUNT_CASE.name, added.name, "לוי נ׳ לוי"].sort());
  let s = await store(page);
  expect(s["redact-profile-last:acct-7"].name).toBe("לוי נ׳ לוי");
  expect(s["redact-cases"]).toEqual(plain["redact-cases"]);
  expect(s["redact-profile-last"]).toEqual(plain["redact-profile-last"]);

  // a new document: the account's cases are offered, the plain ones are not, and deleting one removes it from the account only
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "מסמך חדש" }).click();
  await expect(page.locator('[data-case="לוי נ׳ לוי"]')).toBeVisible();
  await expect(page.locator(`[data-case="${PLAIN_CASE.name}"]`)).toHaveCount(0);
  await expect(page.getByText(LAST_CARD)).toHaveCount(0);
  await page.locator('[data-case="לוי נ׳ לוי"]').getByRole("button", { name: "מחיקה", exact: true }).click();
  await expect(page.locator('[data-case="לוי נ׳ לוי"]')).toHaveCount(0);
  s = await store(page);
  expect(Object.keys(s["redact-cases:acct-7"]).sort()).toEqual([ACCOUNT_CASE.name, added.name].sort());
  expect(s["redact-profile-last:acct-7"]).toBeUndefined();
  expect(s["redact-cases"]).toEqual(plain["redact-cases"]);
  expect(s["redact-profile-last"]).toEqual(plain["redact-profile-last"]);
});
