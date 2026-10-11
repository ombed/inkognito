const { test, expect } = require("./base");
const H = require("./helpers");

/* Three things she does that did nothing or one thing too many (the hunt of 11.10):
   - on a phone, a long-press selection in the document never opened «הוספת … בתור:», since only a mouse-up
     or Shift opened it, though the help page says «מסמנים אותו במסמך ומוסיפים אותו»;
   - a document with no places still stopped on «יישובים», with «לא נמצאו יישובים במסמך.» and one button;
   - a second answer pasted on the restore screen kept the first one's result under it, and the filled
     button copied the old text.
   Every name here is invented. */

// two people who each speak twice, so the list fills without the model; no town anywhere
const DOC = ["פרוטוקול דיון", "רחל פרידמן: אני מבקשת לפתוח.", "דוד כהן: אני המשיב.", "רחל פרידמן: תודה.", "דוד כהן: נסכם בכתב. גם השכנה, שושנה ברקוביץ, הגיעה."].join("\n");

async function open(page) {
  await H.serveEngineWithStub(page);
  await H.boot(page);
  const toggle = page.locator("[data-settings-toggle]");
  if (await toggle.isVisible().catch(() => false) && !(await page.getByRole("checkbox").first().isVisible().catch(() => false))) await toggle.click();
  await page.getByRole("checkbox").first().uncheck();
  await H.upload(page, "hearing.docx", DOC);
  await H.startScan(page);
  await expect(H.goButton(page)).toBeVisible({ timeout: 10000 });
}

test("a document with no places goes from «מי בתיק» straight to the review screen", async ({ page }) => {
  await open(page);
  await H.goOn(page);
  const bar = page.locator("[data-bar]"), places = page.getByText("לא נמצאו יישובים במסמך.");
  await expect(bar.or(places).first()).toBeVisible({ timeout: 20000 });
  expect(await places.isVisible().catch(() => false), "no screen that only says no places were found").toBe(false);
  await expect(bar).toBeVisible();
});

test("a selection made without a mouse (a long press on a phone) opens «הוספת … בתור:»", async ({ page }) => {
  await open(page);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  const sheet = page.locator("[data-work] section").first();
  await expect(sheet).toContainText("שושנה ברקוביץ");
  // the selection changes and nothing else happens: no mouse-up, no key
  await page.evaluate((w) => {
    const root = document.querySelector("[data-work] section");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) { const i = node.textContent.indexOf(w); if (i >= 0) {
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + w.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); break; } }
  }, "שושנה ברקוביץ");
  const popup = page.locator("[data-popup]");
  await expect(popup).toBeVisible({ timeout: 3000 });
  await popup.getByRole("button", { name: "אדם", exact: true }).click();
  await expect(sheet).not.toContainText("שושנה ברקוביץ");
});

test("a new answer in the box takes the previous result away, and «החזרת שמות» is the action again", async ({ page }) => {
  await open(page);
  await H.goOn(page);
  const run = page.getByRole("button", { name: /החלת הקבוצה|המשך לבדיקה/ }).first();
  await expect(run.or(page.locator("[data-bar]")).first()).toBeVisible({ timeout: 20000 });
  await H.throughPlaces(page, run);
  const fake = (await page.locator('[data-mark][data-val="רחל פרידמן"]').first().innerText()).trim();
  await page.getByRole("button", { name: "החזרת שמות מתשובת AI" }).click();
  const box = page.getByPlaceholder("הדבקת תשובת ה-AI…"), out = page.locator("[data-rv-out]");
  await box.fill(`${fake} היא המבקשת.`);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(out).toHaveText("רחל פרידמן היא המבקשת.");
  // the AI's follow-up, pasted over the first answer
  await box.fill("ההחלטה תינתן בכתב.");
  await expect(out).toHaveCount(0);
  await expect(page.getByRole("button", { name: "העתקת הטקסט המשוחזר" })).toHaveCount(0);
  await page.getByRole("button", { name: "החזרת שמות", exact: true }).click();
  await expect(out).toHaveText("ההחלטה תינתן בכתב.");
});
