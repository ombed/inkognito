const { test, expect } = require("./base");
const H = require("./helpers");

/* The invented names come from a secret key kept in this browser (the owner's decision, 12.10; the engineering audit).
   Until then they came from the real name by public code alone: anyone holding the text the AI saw and a list of
   suspects could compute each suspect's invented name and confirm who was in it, and every lawyer's documents gave one
   person the same invented name. The key is made once, per account (caseKey), and stays in the browser.
   tests/aliaskey_t.js checks the computation itself. Invented names only. */

const DOC = "פרוטוקול דיון — התובעת: רונית לוי\nרונית לוי הגישה בקשה לצו הגנה.\nהדיון התקיים ביום שלישי.";
const K1 = "0123456789abcdef".repeat(4), K2 = "fedcba9876543210".repeat(4);

async function inventedName(page) {
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await H.throughPlaces(page, page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first());
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  await expect.poll(() => page.evaluate(() => window.__copied || "")).toContain("הגישה");
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).not.toContain("רונית לוי");
  const m = copied.match(/([֐-׿]+ [֐-׿]+) הגישה/);
  expect(m, "an invented name before «הגישה»").toBeTruthy();
  return m[1];
}

test("the invented names come from this browser's secret key: the same key keeps them, another key changes them", async ({ page }) => {
  await H.serveEngineWithStub(page);
  // a key put in place before the page starts, as another browser would have its own
  await page.addInitScript(() => { const k = window.sessionStorage.getItem("test-key"); if (k) localStorage.setItem("redact-alias-key", k); });
  await H.boot(page);

  // with none stored, the page makes its own: 64 hex characters, kept across a reload
  const stored = () => page.evaluate(() => localStorage.getItem("redact-alias-key"));
  await expect.poll(stored).toMatch(/^[0-9a-f]{64}$/);
  const own = await stored();
  await page.reload();
  await expect(page.locator("#dc-root")).toBeAttached({ timeout: 60000 });
  expect(await stored(), "a reload keeps the key").toBe(own);

  // each run starts with no saved case, so the name comes from the key and not from the last run's list
  const withKey = async (k) => {
    await page.evaluate((k) => {
      window.sessionStorage.setItem("test-key", k);
      for (const s of Object.keys(localStorage)) if (/^redact-(cases|profile-last)(:|$)/.test(s)) localStorage.removeItem(s);
    }, k);
    await page.reload();
    return inventedName(page);
  };
  const a = await withKey(K1), again = await withKey(K1), b = await withKey(K2);
  expect(again, "the same key, the same invented name (her documents stay consistent)").toBe(a);
  expect(b, "another key, another invented name (what another lawyer sends does not link to hers)").not.toBe(a);
});
