const { test, expect } = require("./base");
const H = require("./helpers");

/* What she decided stays decided (the hunt of 11.10). One Ctrl+Z on the review screen restored the whole list
   from before a round trip through «מי בתיק», and the name added there went out in clear under a green bar;
   «ניסיון נוסף» rebuilt the people list from the scan and dropped the names she typed; and copying or downloading
   while the re-run of her last decision was still running exported the result from before it. Every name here
   is invented, and none of them is in the pool of invented names, so the text can only lose one by a leak. */

const sheet = (page) => page.locator("[data-work] section").first();

async function onward(page) {
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  await expect(page.locator("[data-bar]")).toBeVisible({ timeout: 20000 });
}
async function toWork(page, doc, names, stub = true) {
  if (stub) await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  if (!(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "doc.docx", doc);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const input = page.getByPlaceholder(/שם מלא/);
  for (const n of names) { await input.fill(n); await input.press("Enter"); }
  await onward(page);
}

test("Ctrl+Z after a round trip through «מי בתיק» does not bring back a name added there", async ({ page }) => {
  const DOC = ["סיכום פגישה עם הלקוחה רונית לוי", "רונית לוי סיפרה שהשכנה, אלומה, שומרת על הילדים אחרי הגן.", "לדבריה אלומה מוכנה להעיד אם יידרש."].join("\n");
  await toWork(page, DOC, ["רונית לוי"]);
  // a decision on the review screen: another pseudonym for her
  await page.locator('[data-mark][data-val="רונית לוי"]').first().click();
  const ed = page.locator("[data-inline]");
  await ed.getByPlaceholder("תחליף אחר").fill("גלית ורד");
  await ed.getByPlaceholder("תחליף אחר").press("Enter");
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).toContain("גלית ורד");
  // back to «מי בתיק», «אלומה» added, and on again
  await page.locator("[data-back]").filter({ hasText: "מי בתיק" }).click();
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("אלומה");
  await input.press("Enter");
  await onward(page);
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("אלומה");
  // the list was rebuilt there: there is no older step to go back to, and Ctrl+Z changes nothing
  await expect(page.getByRole("button", { name: "ביטול הפעולה האחרונה" })).toBeDisabled();
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(1000);
  expect(await sheet(page).innerText()).not.toContain("אלומה");
});

test("«ניסיון נוסף» after the model failed keeps the names typed on «מי בתיק»", async ({ page }) => {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  await page.evaluate(() => { window.__ner = { error: "הרשת חסומה" }; });
  await H.upload(page, "case.docx", ["פרוטוקול פגישה בעניין הקטינה", "מיכל שרעבי: הילדה מספרת שהמורה שלגית עוזרת לה בשיעורים.", "אורן שרעבי: גם אני שמעתי ששלגית מלווה אותה."].join("\n"));
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
  const retry = page.getByRole("button", { name: "ניסיון נוסף" });
  await expect(retry).toBeVisible();
  const input = page.getByPlaceholder(/שם מלא/);
  await input.fill("שלגית");
  await input.press("Enter");
  expect(await H.listedNames(page)).toContain("שלגית");
  await retry.click();
  // the model fails again; the name she typed is still on the list
  await expect(retry).toBeVisible({ timeout: 15000 });
  expect(await H.listedNames(page)).toContain("שלגית");
});

test("copy and download wait for the re-run that her last decision started", async ({ page }) => {
  // the engine as the site serves it, with every re-run after the first held three seconds
  await page.route("**/redact-engine.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()) + "\nconst __rd = redactDocx; redactDocx = async (...a) => { const r = await __rd(...a); if ((window.__n = (window.__n || 0) + 1) > 1) await new Promise((z) => setTimeout(z, 3000)); return r; };\n";
    await route.fulfill({ response: res, body, headers: { ...res.headers(), "content-type": "text/javascript; charset=utf-8" } });
  });
  // people after a title wait on the review screen, «לבדיקה»
  const DOC = ["פרוטוקול דיון", "עו״ד רונן אלמליח פתח. השופטת נועה קלדרון שאלה.", "עו״ד רונן אלמליח השיב. השופטת נועה קלדרון סיכמה.", "רונית לוי: אני מבקשת לפתוח.", "רונית לוי: תודה."].join("\n");
  await toWork(page, DOC, [], false);
  const copy = page.getByRole("button", { name: /^העתקה ל/ }), download = page.getByRole("button", { name: /^הורדת Word/ });
  await expect(copy).toBeEnabled();
  await page.locator("[data-pend-item]").filter({ hasText: "רונן אלמליח" }).first().getByRole("button", { name: "להחליף" }).click();
  // the re-run is held: nothing can be exported until it lands
  await expect(copy).toBeDisabled();
  await expect(download).toBeDisabled();
  // it lands: the name is replaced, and copy and download are back
  await expect.poll(() => sheet(page).innerText(), { timeout: 15000 }).not.toContain("רונן אלמליח");
  await expect(copy).toBeEnabled();
  await expect(download).toBeEnabled();
});
