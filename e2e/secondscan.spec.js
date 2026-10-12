const { test, expect } = require("./base");
const H = require("./helpers");

/* The second scan in the page (the owner's decision of 12.10, «A», the wording approved). The cleaning replaces what it
   found; two first names it did not find stay. Until 12.10 the status was the list's own green. Now it is amber, in the
   approved words, the two names wait in «לבדיקה» with «להחליף» and «להשאיר», and copying is not stopped by them. The
   engine's rules are in tests/secondscan_t.js. Invented names only. */
const DOC = "פרוטוקול דיון\nאבי בוסקילה הגיש את הבקשה.\nנכחו בדיון גם קארין ושלומית מהמשרד.";

test("names the cleaning did not find turn the status amber, wait with «להחליף» and «להשאיר», and do not stop copying", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await H.throughPlaces(page, page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first());
  const bar = page.locator("[data-bar-text]");
  await expect(bar).toContainText("בבדיקה שנייה נמצאו פרטים שאינם ברשימה", { timeout: 15000 });
  await expect(bar).toContainText("2 מילים שנראות כמו שמות. כדאי לבדוק אותם לפני שליחה.");
  const item = (v) => page.locator("[data-pend-item]").filter({ hasText: v }).first();
  await expect(item("קארין")).toContainText("בבדיקה שנייה · אדם");
  await expect(item("שלומית")).toContainText("בבדיקה שנייה · אדם");

  // copying stays open: no question first
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  await expect.poll(() => page.evaluate(() => window.__copied || "")).toContain("מהמשרד");
  await expect(page.getByRole("button", { name: /בכל זאת/ })).toHaveCount(0);

  // «להחליף» on one: it is replaced, and the line counts the one left
  await item("קארין").getByRole("button", { name: "להחליף" }).click();
  await expect(bar).toContainText("מילה אחת שנראית כמו שם. כדאי לבדוק אותה לפני שליחה.", { timeout: 15000 });
  // «להשאיר» on the other: nothing waits, and the status is the list's own again
  await item("שלומית").getByRole("button", { name: "להשאיר" }).click();
  await expect(bar).toContainText("לא נשארו בטקסט שמות או מספרים מהרשימה", { timeout: 15000 });
});
