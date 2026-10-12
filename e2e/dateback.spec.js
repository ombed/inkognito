const { test, expect } = require("./base");
const H = require("./helpers");

/* A deadline the AI computes from a shifted date comes back by the same weeks, marked (the owner's decision of 12.10,
   «A»). The engine's rule is in tests/dateback_t.js; here the whole loop runs in the page: the document's date goes out
   shifted, the AI's answer counts 45 days from it, and the restore gives the real hearing date and the real deadline,
   the deadline marked with the approved sentence. Invented names and dates only. */
const DOC = "פרוטוקול דיון\nהדיון התקיים ביום 12.3.2026 בנוכחות דנה כהן.\nדנה כהן הגישה בקשה לדחייה.";
const NOTE = "תאריך שה-AI חישב מתאריך מוזז, והוחזר בהתאם. כדאי לבדוק.";

test("a deadline the AI computed from a shifted date comes back by the same weeks, marked", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "case.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  await H.goOn(page);
  await H.throughPlaces(page, page.getByRole("button", { name: /החלת הקבוצה והמשך|המשך לבדיקה|המשך לעיבוד/ }).first());
  await expect(page.locator("[data-mark]").first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await page.locator("[data-bar]").getByRole("button", { name: /העתקה ל־AI|הועתק/ }).click();
  const anyway = page.getByRole("button", { name: /בכל זאת/ });
  if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
  await expect.poll(() => page.evaluate(() => window.__copied || "")).toContain("הדיון התקיים");
  const copied = await page.evaluate(() => window.__copied);
  const m = copied.match(/ביום (\d{1,2})\.(\d{1,2})\.(\d{4})/);
  expect(m, "the hearing date went out shifted").toBeTruthy();
  expect(m[0]).not.toBe("ביום 12.3.2026");
  const fake = `${m[1]}.${m[2]}.${m[3]}`;
  const t = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1] + 45));
  const computed = `${t.getUTCDate()}.${t.getUTCMonth() + 1}.${t.getUTCFullYear()}`;

  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  await page.getByPlaceholder("הדבקת תשובת ה-AI…").fill(`הדיון התקיים ב-${fake}. המועד להגשת ערעור הוא 45 יום, כלומר עד ${computed}.`);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  const out = page.locator("[data-rv-out]");
  // 12.3.2026 and 45 days: 26.4.2026, whatever the shift was
  await expect(out).toHaveText("הדיון התקיים ב-12.3.2026. המועד להגשת ערעור הוא 45 יום, כלומר עד 26.4.2026.");
  const mark = out.locator("[data-rv-date]");
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveText("26.4.2026");
  await expect(mark).toHaveAttribute("title", NOTE);
  await expect(page.locator("[data-rv-dates] li")).toHaveText([`«26.4.2026»: ${NOTE}`]);
  // the date the tool wrote itself is restored as before, unmarked
  await expect(out.locator("[data-left]")).toHaveCount(0);
});
